import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo, withMongoTransaction } from '@/lib/db';
import { settlementBulkSchema } from '@/lib/dto/settlement';
import { handleApiError, HttpError } from '@/lib/http';
import { getNowTimeKeyKst } from '@/lib/kst';
import { TransactionModel } from '@/server/models/transaction';
import { writeAuditLog } from '@/server/services/audit';
import { calculateAmount } from '@/server/services/transactions';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = settlementBulkSchema.parse(await request.json());
    const uniqueIds = Array.from(new Set(body.transactionIds));

    const result = await withMongoTransaction(async (session) => {
      const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));
      const transactions = await TransactionModel.find({
        _id: { $in: objectIds },
        deletedAt: null
      }).session(session);

      if (transactions.length !== uniqueIds.length) {
        throw new HttpError(400, '존재하지 않거나 이미 삭제된 거래가 포함되어 있습니다.');
      }
      if (body.action === 'return' && transactions.some((transaction) => transaction.qty <= 0)) {
        throw new HttpError(400, '반품은 수량이 양수인 거래만 허용됩니다.');
      }

      const processedIds: string[] = [];
      const createdIds: string[] = [];
      const affectedProductIds = new Set<string>();

      for (const transaction of transactions) {
        const before = transaction.toObject();

        if (body.action === 'delete') {
          transaction.deletedAt = new Date();
          await transaction.save({ session });
          await writeAuditLog({
            action: 'delete',
            entityType: 'transaction',
            entityId: String(transaction._id),
            before,
            after: transaction.toObject()
          }, session);
        } else {
          const returnQty = -transaction.qty;
          const [created] = await TransactionModel.create([{
            dateKey: transaction.dateKey,
            vendorId: transaction.vendorId,
            productId: transaction.productId,
            productName: transaction.productName,
            productUnit: transaction.productUnit,
            unitPrice: transaction.unitPrice,
            qty: returnQty,
            amount: calculateAmount(transaction.unitPrice, returnQty),
            registeredTimeKST: getNowTimeKeyKst()
          }], { session });

          await writeAuditLog({
            action: 'return',
            entityType: 'transaction',
            entityId: String(created._id),
            before,
            after: created.toObject()
          }, session);
          createdIds.push(String(created._id));
        }

        if (transaction.productId) affectedProductIds.add(String(transaction.productId));
        processedIds.push(String(transaction._id));
      }

      const { recalculateInventory } = await import('@/server/services/inventory');
      for (const productId of affectedProductIds) await recalculateInventory(productId, session);
      return { processedIds, createdIds };
    });

    return NextResponse.json({
      data: {
        action: body.action,
        processedIds: result.processedIds,
        createdIds: result.createdIds
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
