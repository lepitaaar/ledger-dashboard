import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
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

    const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));

    // Fetch all transactions to validate
    const transactions = await TransactionModel.find({
      _id: { $in: objectIds },
      deletedAt: null
    });

    if (transactions.length !== uniqueIds.length) {
      throw new HttpError(400, '존재하지 않거나 이미 삭제된 거래가 포함되어 있습니다.');
    }

    if (body.action === 'return') {
      // Validate that all transactions have positive quantity
      const hasInvalid = transactions.some((t) => t.qty <= 0);
      if (hasInvalid) {
        throw new HttpError(400, '반품은 수량이 양수인 거래만 허용됩니다.');
      }
    }

    const processedIds: string[] = [];
    const createdIds: string[] = [];

    if (body.action === 'delete') {
      for (const t of transactions) {
        const before = t.toObject();
        t.deletedAt = new Date();
        await t.save();

        await writeAuditLog({
          action: 'delete',
          entityType: 'transaction',
          entityId: String(t._id),
          before,
          after: t.toObject()
        });

        processedIds.push(String(t._id));
      }
    } else if (body.action === 'return') {
      const nowTimeKey = getNowTimeKeyKst();
      for (const t of transactions) {
        const returnQty = -t.qty;
        const created = await TransactionModel.create({
          dateKey: t.dateKey,
          vendorId: t.vendorId,
          productId: t.productId,
          productName: t.productName,
          productUnit: t.productUnit,
          unitPrice: t.unitPrice,
          qty: returnQty,
          amount: calculateAmount(t.unitPrice, returnQty),
          registeredTimeKST: nowTimeKey
        });

        await writeAuditLog({
          action: 'return',
          entityType: 'transaction',
          entityId: String(created._id),
          before: t.toObject(),
          after: created.toObject()
        });

        processedIds.push(String(t._id));
        createdIds.push(String(created._id));

        if (created.productId) {
          const { recalculateInventory } = await import('@/server/services/inventory');
          await recalculateInventory(created.productId);
        }
      }
    }

    return NextResponse.json({
      data: {
        action: body.action,
        processedIds,
        createdIds
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
