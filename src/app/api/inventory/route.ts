import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { handleApiError } from '@/lib/http';
import { getInventoryStatus } from '@/server/services/inventory';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    await connectMongo();

    const data = await getInventoryStatus();

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
