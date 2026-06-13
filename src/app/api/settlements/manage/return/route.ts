import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import { settlementLineReturnSchema } from '@/lib/dto/settlement';
import { handleApiError, HttpError } from '@/lib/http';
import { getNowTimeKeyKst } from '@/lib/kst';
import { TransactionModel } from '@/server/models/transaction';
import { writeAuditLog } from '@/server/services/audit';
import { calculateAmount } from '@/server/services/transactions';
import { runIdempotentMongoTransaction } from '@/server/services/idempotency';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = settlementLineReturnSchema.parse(await request.json());
    const { value: created, replayed } = await runIdempotentMongoTransaction(
      request,
      'settlement-lines:return',
      async (session) => {
        const source = await TransactionModel.findOne({
          _id: new Types.ObjectId(body.transactionId),
          deletedAt: null
        }).session(session);

        if (!source) throw new HttpError(404, '반품 처리할 원본 거래를 찾을 수 없습니다.');

        const returnQty = source.qty > 0 ? -source.qty : source.qty;
        const [transaction] = await TransactionModel.create([{
          dateKey: source.dateKey,
          vendorId: source.vendorId,
          productId: source.productId,
          productName: source.productName,
          productUnit: source.productUnit,
          unitPrice: source.unitPrice,
          qty: returnQty,
          amount: calculateAmount(source.unitPrice, returnQty),
          registeredTimeKST: getNowTimeKeyKst()
        }], { session });

        await writeAuditLog({
          action: 'return',
          entityType: 'transaction',
          entityId: String(transaction._id),
          before: source.toObject(),
          after: transaction.toObject()
        }, session);

        if (transaction.productId) {
          const { recalculateInventory } = await import('@/server/services/inventory');
          await recalculateInventory(transaction.productId, session);
        }
        return { _id: String(transaction._id) };
      }
    );

    return NextResponse.json({
      data: {
        _id: created._id
      }
    }, { headers: { 'Idempotency-Replayed': String(replayed) } });
  } catch (error) {
    return handleApiError(error);
  }
}
