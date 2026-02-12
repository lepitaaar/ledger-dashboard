import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import {
  settlementLineCreateSchema,
  settlementLineDeleteSchema,
  settlementLineUpdateSchema,
  settlementManageQuerySchema
} from '@/lib/dto/settlement';
import { handleApiError, HttpError } from '@/lib/http';
import { getNowTimeKeyKst } from '@/lib/kst';
import { type Transaction, TransactionModel } from '@/server/models/transaction';
import { type Vendor, VendorModel } from '@/server/models/vendor';
import { writeAuditLog } from '@/server/services/audit';
import { calculateAmount } from '@/server/services/transactions';

export const runtime = 'nodejs';

function mapTransactionRow(row: Transaction): Record<string, unknown> {
  return {
    _id: String(row._id),
    dateKey: row.dateKey,
    vendorId: String(row.vendorId),
    productName: row.productName,
    productUnit: row.productUnit ?? '',
    qty: row.qty,
    unitPrice: row.unitPrice,
    amount: row.amount,
    registeredTimeKST: row.registeredTimeKST,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const query = settlementManageQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
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

    const rows = transactions.map((row) => mapTransactionRow(row));
    const totalAmount = transactions.reduce((acc, row) => acc + Number(row.amount ?? 0), 0);

    return NextResponse.json({
      data: {
        vendor: {
          _id: String(vendor._id),
          name: vendor.name
        },
        dateKey: query.dateKey,
        rows,
        totalAmount
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = settlementLineCreateSchema.parse(await request.json());
    const vendorObjectId = new Types.ObjectId(body.vendorId);

    const vendorExists = await VendorModel.exists({
      _id: vendorObjectId,
      deletedAt: null
    });

    if (!vendorExists) {
      throw new HttpError(404, '업체를 찾을 수 없습니다.');
    }

    const created = await TransactionModel.create({
      dateKey: body.dateKey,
      vendorId: vendorObjectId,
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

    return NextResponse.json({ data: mapTransactionRow(created.toObject() as Transaction) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = settlementLineUpdateSchema.parse(await request.json());
    const transaction = await TransactionModel.findOne({
      _id: new Types.ObjectId(body.id),
      deletedAt: null
    });

    if (!transaction) {
      throw new HttpError(404, '거래 행을 찾을 수 없습니다.');
    }

    const before = transaction.toObject();

    if (body.productName !== undefined) {
      transaction.productName = body.productName;
    }

    if (body.productUnit !== undefined) {
      transaction.productUnit = body.productUnit;
    }

    if (body.qty !== undefined) {
      transaction.qty = body.qty;
    }

    if (body.unitPrice !== undefined) {
      transaction.unitPrice = body.unitPrice;
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

    return NextResponse.json({ data: mapTransactionRow(transaction.toObject() as Transaction) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = settlementLineDeleteSchema.parse(await request.json());
    const transaction = await TransactionModel.findOne({
      _id: new Types.ObjectId(body.id),
      deletedAt: null
    });

    if (!transaction) {
      throw new HttpError(404, '거래 행을 찾을 수 없습니다.');
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
