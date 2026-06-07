import { type FilterQuery, Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { handleApiError, HttpError } from '@/lib/http';
import { normalizePagination } from '@/lib/pagination';
import { escapeRegExp } from '@/lib/utils';
import { AuctionPurchase, AuctionPurchaseModel } from '@/server/models/auction-purchase';
import { getTodayDateKey } from '@/lib/kst';
import { dateKeySchema } from '@/lib/dto/common';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const { searchParams } = request.nextUrl;
    const pageParam = Number(searchParams.get('page') || '1');
    const limitParam = Number(searchParams.get('limit') || '50');
    const { page, limit, skip } = normalizePagination(pageParam, limitParam);

    const startKey = searchParams.get('startKey') || getTodayDateKey();
    const endKey = searchParams.get('endKey') || getTodayDateKey();
    const productId = searchParams.get('productId');
    const mappingStatus = searchParams.get('mappingStatus') || 'all'; // 'all' | 'mapped' | 'unmapped'
    const recordStatus = searchParams.get('recordStatus') || 'active'; // 'active' | 'canceled' | 'all'
    const keyword = searchParams.get('keyword');

    if (!dateKeySchema.safeParse(startKey).success || !dateKeySchema.safeParse(endKey).success) {
      throw new HttpError(400, '조회 기간은 YYYY-MM-DD 형식이어야 합니다.');
    }
    if (startKey > endKey) {
      throw new HttpError(400, '시작일은 종료일보다 클 수 없습니다.');
    }

    const filter: FilterQuery<AuctionPurchase> = {
      dateKey: { $gte: startKey, $lte: endKey }
    };

    if (recordStatus === 'active') {
      filter.isActive = true;
    } else if (recordStatus === 'canceled') {
      filter.isActive = false;
    }

    if (productId) {
      filter.productId = new Types.ObjectId(productId);
    } else if (mappingStatus === 'mapped') {
      filter.productId = { $ne: null };
    } else if (mappingStatus === 'unmapped') {
      filter.productId = null;
    }

    if (keyword) {
      const regex = new RegExp(escapeRegExp(keyword), 'i');
      filter.$or = [
        { wmcLatcnm: regex },
        { wmSogmnm: regex }
      ];
    }

    // 1. 데이터 조회 (Product와 조인하여 상품명 등을 화면에 표시하기 유용하게 가공)
    const [items, total, totalAmountResult] = await Promise.all([
      AuctionPurchaseModel.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $unwind: {
            path: '$product',
            preserveNullAndEmptyArrays: true
          }
        },
        { $sort: { dateKey: -1, oslpNo: -1, aucNo: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            dateKey: 1,
            naBzplc: 1,
            gbn: 1,
            oslpNo: 1,
            aucNo: 1,
            naLatc: 1,
            wmcLatcnm: 1,
            wmSogmnm: 1,
            wmWt: 1,
            grdWmBaseInfCnm: 1,
            budlCn: 1,
            szeWmBaseInfCnm: 1,
            trqt: 1,
            actoUpr: 1,
            selAm: 1,
            etcRmkCntn: 1,
            productId: 1,
            productName: { $ifNull: ['$product.name', null] },
            productUnit: { $ifNull: ['$product.unit', null] },
            isActive: 1,
            createdAt: 1,
            updatedAt: 1,
            hasAmountMismatch: {
              $gt: [
                { $abs: { $subtract: ['$selAm', { $multiply: ['$trqt', '$actoUpr'] }] } },
                0.01
              ]
            }
          }
        }
      ]),
      AuctionPurchaseModel.countDocuments(filter),
      AuctionPurchaseModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: '$selAm' },
            totalQuantity: { $sum: '$trqt' },
            amountMismatchCount: {
              $sum: {
                $cond: [
                  {
                    $gt: [
                      { $abs: { $subtract: ['$selAm', { $multiply: ['$trqt', '$actoUpr'] }] } },
                      0.01
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    const periodTotalAmount = totalAmountResult[0]?.total || 0;
    const periodTotalQuantity = totalAmountResult[0]?.totalQuantity || 0;
    const amountMismatchCount = totalAmountResult[0]?.amountMismatchCount || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        periodTotalAmount,
        periodTotalQuantity,
        amountMismatchCount
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
