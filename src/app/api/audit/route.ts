import { NextRequest, NextResponse } from "next/server";

import { connectMongo } from "@/lib/db";
import { auditListQuerySchema } from "@/lib/dto/audit";
import { handleApiError } from "@/lib/http";
import { buildPageMeta, normalizePagination } from "@/lib/pagination";
import { AuditLogModel } from "@/server/models/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const query = auditListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const filter: Record<string, unknown> = {};
    if (query.entityType) {
      filter.entityType = query.entityType;
    }
    if (query.action) {
      filter.action = query.action;
    }

    const [items, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: items.map((item) => ({
        ...item,
        _id: String(item._id),
      })),
      meta: buildPageMeta(page, limit, total),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
