import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import { vendorDetailParamSchema, vendorDetailQuerySchema } from '@/lib/dto/vendor';
import { handleApiError, HttpError } from '@/lib/http';
import { KST_ZONE, getCurrentMonthDateRange } from '@/lib/kst';
import { buildPageMeta, normalizePagination } from '@/lib/pagination';
import { type Payment, PaymentModel } from '@/server/models/payment';
import { type Transaction, TransactionModel } from '@/server/models/transaction';
import { type Vendor, VendorModel } from '@/server/models/vendor';

export const runtime = 'nodejs';

type RawHistoryItem = {
  id: string;
  dateKey: string;
  type: '매출' | '입금';
  amount: number;
  note: string;
  sortTime: string;
};

function toKstTime(date: Date): string {
  return DateTime.fromJSDate(date).setZone(KST_ZONE).toFormat('HH:mm:ss');
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await connectMongo();

    const params = vendorDetailParamSchema.parse(context.params);
    const query = vendorDetailQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const vendor = await VendorModel.findOne({
      _id: new Types.ObjectId(params.id),
      deletedAt: null
    }).lean<Vendor | null>();

    if (!vendor) {
      throw new HttpError(404, '업체를 찾을 수 없습니다.');
    }

    const [transactions, payments] = await Promise.all([
      TransactionModel.find({
        vendorId: vendor._id,
        deletedAt: null
      })
        .sort({ dateKey: 1, registeredTimeKST: 1, createdAt: 1 })
        .lean<Transaction[]>(),
      PaymentModel.find({
        vendorId: vendor._id
      })
        .sort({ dateKey: 1, createdAt: 1 })
        .lean<Payment[]>()
    ]);

    const monthRange = getCurrentMonthDateRange();

    const totalSalesAmount = transactions.reduce((acc, item) => acc + Number(item.amount ?? 0), 0);
    const totalPaymentAmount = payments.reduce((acc, item) => acc + Number(item.amount ?? 0), 0);

    const monthlySalesAmount = transactions
      .filter((item) => item.dateKey >= monthRange.startKey && item.dateKey <= monthRange.endKey)
      .reduce((acc, item) => acc + Number(item.amount ?? 0), 0);

    const monthlyPaymentAmount = payments
      .filter((item) => item.dateKey >= monthRange.startKey && item.dateKey <= monthRange.endKey)
      .reduce((acc, item) => acc + Number(item.amount ?? 0), 0);

    const rawHistory: RawHistoryItem[] = [
      ...transactions.map((item) => ({
        id: String(item._id),
        dateKey: item.dateKey,
        type: '매출' as const,
        amount: Number(item.amount),
        note: item.productName,
        sortTime: item.registeredTimeKST || '00:00:00'
      })),
      ...payments.map((item) => ({
        id: String(item._id),
        dateKey: item.dateKey,
        type: '입금' as const,
        amount: -Math.abs(Number(item.amount)),
        note: '입금 기록',
        sortTime: toKstTime(item.createdAt)
      }))
    ];

    rawHistory.sort((a, b) => {
      if (a.dateKey !== b.dateKey) {
        return a.dateKey.localeCompare(b.dateKey);
      }

      if (a.sortTime !== b.sortTime) {
        return a.sortTime.localeCompare(b.sortTime);
      }

      return a.id.localeCompare(b.id);
    });

    let runningBalance = 0;
    const historyWithBalance = rawHistory.map((item) => {
      runningBalance += item.amount;
      return {
        id: item.id,
        dateKey: item.dateKey,
        type: item.type,
        amount: item.amount,
        balance: runningBalance,
        note: item.note,
        timeKST: item.sortTime
      };
    });

    const sortedForView = [...historyWithBalance].reverse();
    const pagedHistory = sortedForView.slice(skip, skip + limit);

    return NextResponse.json({
      data: {
        vendor: {
          _id: String(vendor._id),
          name: vendor.name,
          representativeName: vendor.representativeName ?? '',
          phone: vendor.phone ?? '',
          isActive: vendor.isActive
        },
        metrics: {
          monthlySalesAmount,
          monthlyPaymentAmount,
          totalSalesAmount,
          totalPaymentAmount,
          outstandingAmount: totalSalesAmount - totalPaymentAmount
        },
        history: pagedHistory
      },
      meta: {
        ...buildPageMeta(page, limit, sortedForView.length)
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
