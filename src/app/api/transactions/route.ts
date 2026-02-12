import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import { transactionCreateSchema, transactionDeleteSchema, transactionListQuerySchema, transactionUpdateSchema } from '@/lib/dto/transaction';
import { getDateRangeByPreset, getNowTimeKeyKst, normalizeDateRange } from '@/lib/kst';
import { handleApiError, HttpError } from '@/lib/http';
import { buildPageMeta } from '@/lib/pagination';
import { TransactionModel } from '@/server/models/transaction';
import { VendorModel } from '@/server/models/vendor';
import { writeAuditLog } from '@/server/services/audit';
import { calculateAmount, listTransactions } from '@/server/services/transactions';

export const runtime = 'nodejs';

function resolveRange(input: { startKey?: string; endKey?: string; preset?: 'today' | '1w' | '1m' | '3m' }):
  | {
      startKey: string;
      endKey: string;
    }
  | undefined {
  const fromPreset = input.preset && !input.startKey && !input.endKey ? getDateRangeByPreset(input.preset) : undefined;

  try {
    return normalizeDateRange(input.startKey ?? fromPreset?.startKey, input.endKey ?? fromPreset?.endKey);
  } catch {
    throw new HttpError(400, '기간 필터가 올바르지 않습니다.');
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const query = transactionListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const range = resolveRange({ startKey: query.startKey, endKey: query.endKey, preset: query.preset });

    const result = await listTransactions(
      {
        vendorId: query.vendorId,
        productName: query.productName,
        keyword: query.keyword,
        includeDeleted: query.includeDeleted,
        startKey: range?.startKey,
        endKey: range?.endKey
      },
      {
        page: query.page,
        limit: query.limit
      }
    );

    return NextResponse.json({
      data: result.items,
      meta: {
        ...buildPageMeta(result.page, result.limit, result.total),
        todayTotalAmount: result.todayTotalAmount,
        appliedRange: range ?? null
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = transactionCreateSchema.parse(await request.json());

    const vendorExists = await VendorModel.exists({
      _id: new Types.ObjectId(body.vendorId),
      deletedAt: null
    });

    if (!vendorExists) {
      throw new HttpError(404, '업체를 찾을 수 없습니다.');
    }

    const created = await TransactionModel.create({
      dateKey: body.dateKey,
      vendorId: new Types.ObjectId(body.vendorId),
      productName: body.productName,
      productUnit: body.productUnit,
      unitPrice: body.unitPrice,
      qty: body.qty,
      amount: calculateAmount(body.unitPrice, body.qty),
      registeredTimeKST: body.registeredTimeKST ?? getNowTimeKeyKst()
    });

    await writeAuditLog({
      action: 'create',
      entityType: 'transaction',
      entityId: String(created._id),
      after: created.toObject()
    });

    return NextResponse.json({ data: created.toObject() }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = transactionUpdateSchema.parse(await request.json());

    const transaction = await TransactionModel.findOne({
      _id: new Types.ObjectId(body.id),
      deletedAt: null
    });

    if (!transaction) {
      throw new HttpError(404, '거래를 찾을 수 없습니다.');
    }

    if (body.vendorId) {
      const vendorExists = await VendorModel.exists({
        _id: new Types.ObjectId(body.vendorId),
        deletedAt: null
      });

      if (!vendorExists) {
        throw new HttpError(404, '업체를 찾을 수 없습니다.');
      }
    }

    const before = transaction.toObject();

    if (body.dateKey !== undefined) {
      transaction.dateKey = body.dateKey;
    }

    if (body.vendorId !== undefined) {
      transaction.vendorId = new Types.ObjectId(body.vendorId);
    }

    if (body.productName !== undefined) {
      transaction.productName = body.productName;
    }

    if (body.productUnit !== undefined) {
      transaction.productUnit = body.productUnit;
    }

    if (body.unitPrice !== undefined) {
      transaction.unitPrice = body.unitPrice;
    }

    if (body.qty !== undefined) {
      transaction.qty = body.qty;
    }

    if (body.registeredTimeKST !== undefined) {
      transaction.registeredTimeKST = body.registeredTimeKST;
    }

    transaction.amount = calculateAmount(transaction.unitPrice, transaction.qty);

    await transaction.save();

    await writeAuditLog({
      action: 'update',
      entityType: 'transaction',
      entityId: String(transaction._id),
      before,
      after: transaction.toObject()
    });

    return NextResponse.json({ data: transaction.toObject() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = transactionDeleteSchema.parse(await request.json());

    const transaction = await TransactionModel.findOne({
      _id: new Types.ObjectId(body.id),
      deletedAt: null
    });

    if (!transaction) {
      throw new HttpError(404, '거래를 찾을 수 없습니다.');
    }

    const before = transaction.toObject();

    transaction.deletedAt = new Date();
    await transaction.save();

    await writeAuditLog({
      action: 'delete',
      entityType: 'transaction',
      entityId: String(transaction._id),
      before,
      after: transaction.toObject()
    });

    return NextResponse.json({ data: { id: body.id } });
  } catch (error) {
    return handleApiError(error);
  }
}
