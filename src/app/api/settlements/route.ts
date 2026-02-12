import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import { settlementIssueSchema, settlementListQuerySchema } from '@/lib/dto/settlement';
import { handleApiError, HttpError } from '@/lib/http';
import { buildPageMeta, normalizePagination } from '@/lib/pagination';
import { SettlementModel } from '@/server/models/settlement';
import { issueSettlement } from '@/server/services/settlements';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const query = settlementListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const match: Record<string, unknown> = {};
    if (query.vendorId) {
      match.vendorId = new Types.ObjectId(query.vendorId);
    }
    if (query.issueStartKey || query.issueEndKey) {
      const issueDate: Record<string, string> = {};
      if (query.issueStartKey) {
        issueDate.$gte = query.issueStartKey;
      }
      if (query.issueEndKey) {
        issueDate.$lte = query.issueEndKey;
      }
      match.issueDateKey = issueDate;
    }

    const [result] = await SettlementModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor'
        }
      },
      { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                issueDateKey: 1,
                vendorId: 1,
                vendorName: { $ifNull: ['$vendor.name', '삭제된 업체'] },
                rangeStartKey: 1,
                rangeEndKey: 1,
                totalAmount: 1,
                itemsCount: { $size: '$itemsSnapshot' },
                createdAt: 1
              }
            }
          ],
          total: [{ $count: 'count' }]
        }
      }
    ]);

    const items = ((result?.items as Array<Record<string, unknown>>) ?? []).map((item) => ({
      ...item,
      _id: String(item._id),
      vendorId: String(item.vendorId)
    }));

    const total = Number((result?.total?.[0] as { count?: number } | undefined)?.count ?? 0);

    return NextResponse.json({
      data: items,
      meta: buildPageMeta(page, limit, total)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = settlementIssueSchema.parse(await request.json());
    const issued = await issueSettlement(body);

    const [detail] = await SettlementModel.aggregate([
      { $match: { _id: new Types.ObjectId(issued.id) } },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor'
        }
      },
      { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
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

    if (!detail) {
      throw new HttpError(500, '정산서 상세 조회에 실패했습니다.');
    }

    return NextResponse.json(
      {
        data: {
          ...detail,
          _id: String(detail._id),
          vendorId: String(detail.vendorId)
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
