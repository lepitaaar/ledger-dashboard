import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { connectMongo } from '@/lib/db';
import { settlementExportQuerySchema } from '@/lib/dto/settlement';
import { handleApiError, HttpError } from '@/lib/http';
import { type Transaction, TransactionModel } from '@/server/models/transaction';
import { type Vendor, VendorModel } from '@/server/models/vendor';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const query = settlementExportQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const vendorObjectId = new Types.ObjectId(query.vendorId);

    const vendor = await VendorModel.findOne({
      _id: vendorObjectId,
      deletedAt: null
    }).lean<Vendor | null>();

    if (!vendor) {
      throw new HttpError(404, '업체를 찾을 수 없습니다.');
    }

    const transactions = await TransactionModel.find({
      vendorId: vendorObjectId,
      dateKey: query.dateKey,
      deletedAt: null
    })
      .sort({ registeredTimeKST: 1, createdAt: 1 })
      .lean<Transaction[]>();

    const rows = transactions.map((row) => [
      row.productName,
      row.productUnit ?? '',
      row.qty,
      row.unitPrice,
      row.amount
    ]);

    const header = ['품목', '규격', '수량', '단가', '합계'];
    const totalAmount = transactions.reduce((acc, row) => acc + Number(row.amount ?? 0), 0);

    const sheet = XLSX.utils.aoa_to_sheet([
      header,
      ...rows,
      [],
      ['총합계', '', '', '', totalAmount]
    ]);

    sheet['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '계산서관리');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const safeVendorName = vendor.name.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `settlement_${safeVendorName}_${query.dateKey}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
