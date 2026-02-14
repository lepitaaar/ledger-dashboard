import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import { vendorDetailParamSchema, vendorDetailQuerySchema } from '@/lib/dto/vendor';
import { handleApiError } from '@/lib/http';
import { getVendorDetailView } from '@/server/services/vendor-detail';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await connectMongo();

    const params = vendorDetailParamSchema.parse(context.params);
    const query = vendorDetailQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const detail = await getVendorDetailView({
      vendorId: params.id,
      page: query.page,
      limit: query.limit
    });

    return NextResponse.json({
      data: detail.data,
      meta: detail.meta
    });
  } catch (error) {
    return handleApiError(error);
  }
}
