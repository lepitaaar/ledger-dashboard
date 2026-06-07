import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { handleApiError, HttpError } from '@/lib/http';
import { syncAuctionPurchases } from '@/server/services/nonghyup-sync';
import { getTodayDateKey } from '@/lib/kst';
import { AuctionSyncRunModel } from '@/server/models/auction-sync-run';
import { dateKeySchema } from '@/lib/dto/common';

export const runtime = 'nodejs';

// 동기화 실행 이력 조회
export async function GET(): Promise<NextResponse> {
  try {
    await connectMongo();

    const runs = await AuctionSyncRunModel.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({ data: runs });
  } catch (error) {
    return handleApiError(error);
  }
}

// 수동 동기화 실행
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    // X-Sync-Secret 인증 확인
    const syncSecret = request.headers.get('x-sync-secret') || request.headers.get('X-Sync-Secret');
    const expectedSecret = process.env.SYNC_SECRET;

    if (!expectedSecret || syncSecret !== expectedSecret) {
      throw new HttpError(401, '인증되지 않은 요청입니다. X-Sync-Secret 헤더를 확인해 주세요.');
    }

    let body: Record<string, string> = {};
    try {
      body = await request.json();
    } catch {
      // JSON 바디가 비어 있을 경우 기본값 처리
    }

    const today = getTodayDateKey();
    const startDateKey = body.startDateKey || today;
    const endDateKey = body.endDateKey || today;

    if (!dateKeySchema.safeParse(startDateKey).success || !dateKeySchema.safeParse(endDateKey).success) {
      throw new HttpError(400, '동기화 기간은 YYYY-MM-DD 형식이어야 합니다.');
    }

    if (startDateKey > endDateKey) {
      throw new HttpError(400, '시작일은 종료일보다 클 수 없습니다.');
    }

    const result = await syncAuctionPurchases(startDateKey, endDateKey);

    if (result.status === 'failed') {
      return NextResponse.json(
        {
          success: false,
          message: result.error || '일부 날짜의 동기화 검증에 실패했습니다.',
          data: result
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `동기화 완료: ${startDateKey} ~ ${endDateKey}`,
      data: result
    });
  } catch (error) {
    return handleApiError(error);
  }
}
