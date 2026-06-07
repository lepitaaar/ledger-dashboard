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
        periodTotalAmount: result.periodTotalAmount,
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

    let finalProductId = body.productId ? new Types.ObjectId(body.productId) : null;
    if (!finalProductId) {
      const { ProductModel } = await import('@/server/models/product');
      const matchedProduct = await ProductModel.findOne({
        name: body.productName,
        unit: body.productUnit || undefined,
        deletedAt: null
      });
      if (matchedProduct) {
        finalProductId = matchedProduct._id;
      }
    }

    const created = await TransactionModel.create({
      dateKey: body.dateKey,
      vendorId: new Types.ObjectId(body.vendorId),
      productId: finalProductId,
      productName: body.productName,
      productUnit: body.productUnit,
      unitPrice: body.unitPrice,
      qty: body.qty,
      amount: calculateAmount(body.unitPrice, body.qty),
      registeredTimeKST: body.registeredTimeKST ?? getNowTimeKeyKst()
    });

    if (created.productId) {
      const { recalculateInventory } = await import('@/server/services/inventory');
      await recalculateInventory(created.productId);
    }

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
    const oldProductId = transaction.productId;
    let isValueFieldChanged = false;
    let isMappingChanged = false;

    if (body.dateKey !== undefined && body.dateKey !== transaction.dateKey) {
      transaction.dateKey = body.dateKey;
      isValueFieldChanged = true;
    }

    if (body.vendorId !== undefined) {
      transaction.vendorId = new Types.ObjectId(body.vendorId);
    }

    if (body.productId !== undefined) {
      const newPid = body.productId ? new Types.ObjectId(body.productId) : null;
      if (String(newPid) !== String(oldProductId)) {
        transaction.productId = newPid;
        isMappingChanged = true;
      }
    }

    if (body.productName !== undefined && body.productName !== transaction.productName) {
      transaction.productName = body.productName;
      isValueFieldChanged = true;
    }

    if (body.productUnit !== undefined && body.productUnit !== transaction.productUnit) {
      transaction.productUnit = body.productUnit;
      isValueFieldChanged = true;
    }

    if (body.unitPrice !== undefined && body.unitPrice !== transaction.unitPrice) {
      transaction.unitPrice = body.unitPrice;
      isValueFieldChanged = true;
    }

    if (body.qty !== undefined && body.qty !== transaction.qty) {
      transaction.qty = body.qty;
      isValueFieldChanged = true;
    }

    if (body.registeredTimeKST !== undefined && body.registeredTimeKST !== transaction.registeredTimeKST) {
      transaction.registeredTimeKST = body.registeredTimeKST;
      isValueFieldChanged = true;
    }

    transaction.amount = calculateAmount(transaction.unitPrice, transaction.qty);

    await transaction.save();

    // 재고 변동 재계산 트리거
    const affectedIds = new Set<string>();
    if (oldProductId) affectedIds.add(String(oldProductId));
    if (transaction.productId) affectedIds.add(String(transaction.productId));

    if (affectedIds.size > 0 && (isMappingChanged || isValueFieldChanged)) {
      const { recalculateInventory } = await import('@/server/services/inventory');
      for (const pid of affectedIds) {
        await recalculateInventory(pid);
      }
    }

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

    // 삭제된 매출 건에 대해서도 재고 원장 재계산
    if (transaction.productId) {
      const { recalculateInventory } = await import('@/server/services/inventory');
      await recalculateInventory(transaction.productId);
    }

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
