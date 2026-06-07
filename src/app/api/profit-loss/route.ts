import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { handleApiError, HttpError } from '@/lib/http';
import { getProfitLoss } from '@/server/services/inventory';
import { getDateRangeByPreset } from '@/lib/kst';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const { searchParams } = request.nextUrl;

    // 기본값은 지난 1개월로 설정
    const range = getDateRangeByPreset('1m');
    const startKey = searchParams.get('startKey') || range.startKey;
    const endKey = searchParams.get('endKey') || range.endKey;

    if (startKey > endKey) {
      throw new HttpError(400, '시작일은 종료일보다 클 수 없습니다.');
    }

    const data = await getProfitLoss(startKey, endKey);

    return NextResponse.json({
      data,
      meta: {
        appliedRange: { startKey, endKey }
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
