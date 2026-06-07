import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { handleApiError } from '@/lib/http';
import { INVENTORY_BASELINE_DATE_KEY } from '@/lib/inventory';
import { getInventoryStatus } from '@/server/services/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await connectMongo();

    const data = await getInventoryStatus();

    return NextResponse.json({
      data,
      meta: {
        baselineDateKey: INVENTORY_BASELINE_DATE_KEY
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
