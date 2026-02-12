import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import { vendorDetailParamSchema, vendorPaymentCreateSchema } from '@/lib/dto/vendor';
import { handleApiError, HttpError } from '@/lib/http';
import { PaymentModel } from '@/server/models/payment';
import { VendorModel } from '@/server/models/vendor';
import { writeAuditLog } from '@/server/services/audit';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await connectMongo();

    const params = vendorDetailParamSchema.parse(context.params);

    const rows = await PaymentModel.find({
      vendorId: new Types.ObjectId(params.id)
    })
      .sort({ dateKey: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      data: rows.map((row) => ({
        _id: String(row._id),
        vendorId: String(row.vendorId),
        dateKey: row.dateKey,
        amount: row.amount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await connectMongo();

    const params = vendorDetailParamSchema.parse(context.params);
    const body = vendorPaymentCreateSchema.parse(await request.json());

    const vendor = await VendorModel.findOne({
      _id: new Types.ObjectId(params.id),
      deletedAt: null
    });

    if (!vendor) {
      throw new HttpError(404, '업체를 찾을 수 없습니다.');
    }

    const created = await PaymentModel.create({
      vendorId: vendor._id,
      dateKey: body.dateKey,
      amount: Math.abs(body.amount)
    });

    await writeAuditLog({
      action: 'create',
      entityType: 'payment',
      entityId: String(created._id),
      after: created.toObject()
    });

    return NextResponse.json(
      {
        data: {
          _id: String(created._id),
          vendorId: String(created.vendorId),
          dateKey: created.dateKey,
          amount: created.amount,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
