import { Types } from 'mongoose';

import { HttpError } from '@/lib/http';
import { SettlementIssueInput } from '@/lib/dto/settlement';
import { SettlementModel } from '@/server/models/settlement';
import { TransactionModel } from '@/server/models/transaction';
import { VendorModel } from '@/server/models/vendor';
import { writeAuditLog } from '@/server/services/audit';

export async function issueSettlement(input: SettlementIssueInput): Promise<{ id: string }> {
  const vendor = await VendorModel.findOne({
    _id: new Types.ObjectId(input.vendorId),
    deletedAt: null
  }).lean();

  if (!vendor) {
    throw new HttpError(404, '업체를 찾을 수 없습니다.');
  }

  const transactions = await TransactionModel.find({
    vendorId: new Types.ObjectId(input.vendorId),
    dateKey: { $gte: input.rangeStartKey, $lte: input.rangeEndKey },
    deletedAt: null
  })
    .sort({ dateKey: 1, registeredTimeKST: 1, createdAt: 1 })
    .lean();

  if (transactions.length === 0) {
    throw new HttpError(400, '선택한 기간에 발행할 거래가 없습니다.');
  }

  const itemsSnapshot = transactions.map((transaction) => ({
    transactionId: transaction._id,
    dateKey: transaction.dateKey,
    productName: transaction.productName,
    productUnit: transaction.productUnit,
    unitPrice: transaction.unitPrice,
    qty: transaction.qty,
    amount: transaction.amount,
    registeredTimeKST: transaction.registeredTimeKST
  }));

  const totalAmount = itemsSnapshot.reduce((acc, item) => acc + item.amount, 0);

  const created = await SettlementModel.create({
    issueDateKey: input.issueDateKey,
    vendorId: new Types.ObjectId(input.vendorId),
    rangeStartKey: input.rangeStartKey,
    rangeEndKey: input.rangeEndKey,
    itemsSnapshot,
    totalAmount
  });

  await writeAuditLog({
    action: 'issue',
    entityType: 'settlement',
    entityId: String(created._id),
    after: created.toObject()
  });

  return { id: String(created._id) };
}
