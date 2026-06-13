import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo, withMongoTransaction } from '@/lib/db';
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
    const created = await withMongoTransaction(async (session) => {
      const vendorExists = await VendorModel.exists({
        _id: new Types.ObjectId(body.vendorId),
        deletedAt: null
      }).session(session);

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
        }).session(session);
        if (matchedProduct) {
          finalProductId = matchedProduct._id;
        }
      }

      const [transaction] = await TransactionModel.create([{
        dateKey: body.dateKey,
        vendorId: new Types.ObjectId(body.vendorId),
        productId: finalProductId,
        productName: body.productName,
        productUnit: body.productUnit,
        unitPrice: body.unitPrice,
        qty: body.qty,
        amount: calculateAmount(body.unitPrice, body.qty),
        registeredTimeKST: body.registeredTimeKST ?? getNowTimeKeyKst()
      }], { session });

      if (transaction.productId) {
        const { recalculateInventory } = await import('@/server/services/inventory');
        await recalculateInventory(transaction.productId, session);
      }

      await writeAuditLog({
        action: 'create',
        entityType: 'transaction',
        entityId: String(transaction._id),
        after: transaction.toObject()
      }, session);

      return transaction;
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
    const transaction = await withMongoTransaction(async (session) => {
      const found = await TransactionModel.findOne({
        _id: new Types.ObjectId(body.id),
        deletedAt: null
      }).session(session);

      if (!found) {
        throw new HttpError(404, '거래를 찾을 수 없습니다.');
      }

      if (body.vendorId) {
        const vendorExists = await VendorModel.exists({
          _id: new Types.ObjectId(body.vendorId),
          deletedAt: null
        }).session(session);

        if (!vendorExists) {
          throw new HttpError(404, '업체를 찾을 수 없습니다.');
        }
      }

      const before = found.toObject();
      const oldProductId = found.productId;
      let isValueFieldChanged = false;
      let isMappingChanged = false;

      if (body.dateKey !== undefined && body.dateKey !== found.dateKey) {
        found.dateKey = body.dateKey;
        isValueFieldChanged = true;
      }
      if (body.vendorId !== undefined) found.vendorId = new Types.ObjectId(body.vendorId);
      if (body.productId !== undefined) {
        const newPid = body.productId ? new Types.ObjectId(body.productId) : null;
        if (String(newPid) !== String(oldProductId)) {
          found.productId = newPid;
          isMappingChanged = true;
        }
      }
      if (body.productName !== undefined && body.productName !== found.productName) {
        found.productName = body.productName;
        isValueFieldChanged = true;
      }
      if (body.productUnit !== undefined && body.productUnit !== found.productUnit) {
        found.productUnit = body.productUnit;
        isValueFieldChanged = true;
      }
      if (body.unitPrice !== undefined && body.unitPrice !== found.unitPrice) {
        found.unitPrice = body.unitPrice;
        isValueFieldChanged = true;
      }
      if (body.qty !== undefined && body.qty !== found.qty) {
        found.qty = body.qty;
        isValueFieldChanged = true;
      }
      if (body.registeredTimeKST !== undefined && body.registeredTimeKST !== found.registeredTimeKST) {
        found.registeredTimeKST = body.registeredTimeKST;
        isValueFieldChanged = true;
      }

      found.amount = calculateAmount(found.unitPrice, found.qty);
      await found.save({ session });

      const affectedIds = new Set<string>();
      if (oldProductId) affectedIds.add(String(oldProductId));
      if (found.productId) affectedIds.add(String(found.productId));

      if (affectedIds.size > 0 && (isMappingChanged || isValueFieldChanged)) {
        const { recalculateInventory } = await import('@/server/services/inventory');
        for (const pid of affectedIds) await recalculateInventory(pid, session);
      }

      await writeAuditLog({
        action: 'update',
        entityType: 'transaction',
        entityId: String(found._id),
        before,
        after: found.toObject()
      }, session);

      return found;
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
    await withMongoTransaction(async (session) => {
      const transaction = await TransactionModel.findOne({
        _id: new Types.ObjectId(body.id),
        deletedAt: null
      }).session(session);

      if (!transaction) throw new HttpError(404, '거래를 찾을 수 없습니다.');

      const before = transaction.toObject();
      transaction.deletedAt = new Date();
      await transaction.save({ session });

      if (transaction.productId) {
        const { recalculateInventory } = await import('@/server/services/inventory');
        await recalculateInventory(transaction.productId, session);
      }

      await writeAuditLog({
        action: 'delete',
        entityType: 'transaction',
        entityId: String(transaction._id),
        before,
        after: transaction.toObject()
      }, session);

      return true;
    });

    return NextResponse.json({ data: { id: body.id } });
  } catch (error) {
    return handleApiError(error);
  }
}
