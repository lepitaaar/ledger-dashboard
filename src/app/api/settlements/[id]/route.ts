import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import { settlementIdParamSchema } from '@/lib/dto/settlement';
import { handleApiError, HttpError } from '@/lib/http';
import { SettlementModel } from '@/server/models/settlement';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await connectMongo();

    const params = settlementIdParamSchema.parse(context.params);

    const [settlement] = await SettlementModel.aggregate([
      { $match: { _id: new Types.ObjectId(params.id) } },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor'
        }
      },
      {
        $unwind: {
          path: '$vendor',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          issueDateKey: 1,
          vendorId: 1,
          vendorName: { $ifNull: ['$vendor.name', '삭제된 업체'] },
          rangeStartKey: 1,
          rangeEndKey: 1,
          itemsSnapshot: 1,
          totalAmount: 1,
          createdAt: 1
        }
      }
    ]);

    if (!settlement) {
      throw new HttpError(404, '정산서를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      data: {
        ...settlement,
        _id: String(settlement._id),
        vendorId: String(settlement.vendorId)
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
