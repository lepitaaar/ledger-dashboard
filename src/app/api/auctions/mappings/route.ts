import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongo } from '@/lib/db';
import { handleApiError, HttpError } from '@/lib/http';
import { AuctionProductMappingModel } from '@/server/models/auction-product-mapping';
import { AuctionPurchaseModel } from '@/server/models/auction-purchase';
import { ProductModel } from '@/server/models/product';
import { recalculateInventory } from '@/server/services/inventory';
import { buildPageMeta, normalizePagination } from '@/lib/pagination';

export const runtime = 'nodejs';

// 매핑 목록 조회
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const { searchParams } = request.nextUrl;
    const pageParam = Number(searchParams.get('page') || '1');
    const limitParam = Number(searchParams.get('limit') || '50');
    const { page, limit, skip } = normalizePagination(pageParam, limitParam);

    const [items, total, suggestions] = await Promise.all([
      AuctionProductMappingModel.aggregate([
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
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            naBzplc: 1,
            gbn: 1,
            naLatc: 1,
            productId: 1,
            productName: { $ifNull: ['$product.name', '삭제된 상품'] },
            productUnit: { $ifNull: ['$product.unit', ''] },
            createdAt: 1,
            updatedAt: 1
          }
        }
      ]),
      AuctionProductMappingModel.countDocuments(),
      AuctionPurchaseModel.aggregate([
        { $match: { productId: null, isActive: true } },
        {
          $group: {
            _id: {
              naBzplc: '$naBzplc',
              gbn: '$gbn',
              naLatc: '$naLatc'
            },
            wmcLatcnm: { $first: '$wmcLatcnm' },
            count: { $sum: 1 },
            latestDateKey: { $max: '$dateKey' }
          }
        },
        { $sort: { count: -1, latestDateKey: -1 } },
        {
          $project: {
            _id: 0,
            naBzplc: '$_id.naBzplc',
            gbn: '$_id.gbn',
            naLatc: '$_id.naLatc',
            wmcLatcnm: 1,
            count: 1,
            latestDateKey: 1
          }
        }
      ])
    ]);

    return NextResponse.json({
      data: items,
      suggestions,
      meta: buildPageMeta(page, limit, total)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// 매핑 추가 / 업데이트
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = await request.json();
    const { naBzplc, gbn, naLatc, productId } = body;

    if (!naBzplc || !gbn || !naLatc || !productId) {
      throw new HttpError(400, 'naBzplc, gbn, naLatc, productId는 필수 입력값입니다.');
    }

    const prodId = new Types.ObjectId(productId);
    const productExists = await ProductModel.exists({ _id: prodId, deletedAt: null });
    if (!productExists) {
      throw new HttpError(404, '존재하지 않거나 삭제된 상품입니다.');
    }

    // 1. 기존 매핑이 있었는지 조회
    const existingMapping = await AuctionProductMappingModel.findOne({ naBzplc, gbn, naLatc });
    const oldProductId = existingMapping ? existingMapping.productId : null;

    // 2. 매핑 저장 (Upsert)
    const saved = await AuctionProductMappingModel.findOneAndUpdate(
      { naBzplc, gbn, naLatc },
      { productId: prodId },
      { upsert: true, new: true }
    );

    // 3. 기존 수집된 AuctionPurchase 상품 연결 정보 일괄 업데이트
    await AuctionPurchaseModel.updateMany(
      { naBzplc, gbn, naLatc },
      { productId: prodId }
    );

    // 4. 재고 원장 재계산 트리거 (이전 연결 상품 및 현재 연결 상품 모두 재계산)
    const affectedIds = new Set<string>();
    if (oldProductId) affectedIds.add(String(oldProductId));
    affectedIds.add(String(prodId));

    for (const pid of affectedIds) {
      await recalculateInventory(pid);
    }

    return NextResponse.json({
      data: saved.toObject(),
      message: '품목 매핑 정보가 성공적으로 반영되었습니다.'
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// 매핑 삭제
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      throw new HttpError(400, '삭제할 매핑 ID가 필요합니다.');
    }

    const mapping = await AuctionProductMappingModel.findById(id);
    if (!mapping) {
      throw new HttpError(404, '매핑 정보를 찾을 수 없습니다.');
    }

    const { naBzplc, gbn, naLatc, productId } = mapping;

    // 1. 매핑 레코드 제거
    await AuctionProductMappingModel.findByIdAndDelete(id);

    // 2. 경매 매입건 연결 해제
    await AuctionPurchaseModel.updateMany(
      { naBzplc, gbn, naLatc },
      { productId: null }
    );

    // 3. 재고 원장 재계산 트리거
    await recalculateInventory(productId);

    return NextResponse.json({
      success: true,
      message: '매핑 정보가 해제되었습니다.'
    });
  } catch (error) {
    return handleApiError(error);
  }
}
