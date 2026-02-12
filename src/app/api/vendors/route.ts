import { type FilterQuery, Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectMongo } from '@/lib/db';
import { vendorCreateSchema, vendorDeleteSchema, vendorListQuerySchema, vendorUpdateSchema } from '@/lib/dto/vendor';
import { handleApiError, HttpError } from '@/lib/http';
import { getCurrentMonthDateRange } from '@/lib/kst';
import { buildPageMeta, normalizePagination } from '@/lib/pagination';
import { escapeRegExp } from '@/lib/utils';
import { TransactionModel } from '@/server/models/transaction';
import { VendorModel } from '@/server/models/vendor';
import { writeAuditLog } from '@/server/services/audit';

export const runtime = 'nodejs';

type VendorRow = {
  _id: unknown;
  name: string;
  representativeName?: string;
  phone?: string;
  isActive?: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  thisMonthAmount?: number;
};

function mapVendor(vendor: VendorRow): Record<string, unknown> {
  return {
    _id: String(vendor._id),
    name: vendor.name,
    representativeName: vendor.representativeName ?? '',
    phone: vendor.phone ?? '',
    isActive: vendor.isActive ?? true,
    thisMonthAmount: vendor.thisMonthAmount ?? 0,
    deletedAt: vendor.deletedAt ?? null,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt
  };
}

function normalizeVendorCreatePayload(raw: unknown): Record<string, unknown> {
  const input = (raw ?? {}) as Record<string, unknown>;

  return {
    name: input.name ?? input.vendorName ?? input.companyName,
    representativeName: input.representativeName ?? input.representative ?? input.ownerName,
    phone: input.phone ?? input.contact ?? input.tel
  };
}

function normalizeVendorUpdatePayload(raw: unknown): Record<string, unknown> {
  const input = (raw ?? {}) as Record<string, unknown>;

  return {
    id: input.id,
    name: input.name ?? input.vendorName ?? input.companyName,
    representativeName: input.representativeName ?? input.representative ?? input.ownerName,
    phone: input.phone ?? input.contact ?? input.tel,
    isActive: input.isActive
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const query = vendorListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const filter: FilterQuery<VendorRow> = query.includeDeleted ? {} : { deletedAt: null };

    if (query.keyword) {
      const regex = { $regex: escapeRegExp(query.keyword), $options: 'i' };
      filter.$or = [{ name: regex }, { representativeName: regex }, { phone: regex }];
    }

    const [vendors, total, activeCount] = await Promise.all([
      VendorModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<VendorRow[]>(),
      VendorModel.countDocuments(filter),
      VendorModel.countDocuments({ ...filter, isActive: true })
    ]);

    const vendorIds = vendors.map((vendor) => vendor._id);
    const monthRange = getCurrentMonthDateRange();

    const monthlyAgg =
      vendorIds.length === 0
        ? []
        : await TransactionModel.aggregate([
            {
              $match: {
                deletedAt: null,
                vendorId: { $in: vendorIds },
                dateKey: { $gte: monthRange.startKey, $lte: monthRange.endKey }
              }
            },
            {
              $group: {
                _id: '$vendorId',
                total: { $sum: '$amount' }
              }
            }
          ]);

    const monthlyMap = new Map<string, number>();
    for (const row of monthlyAgg as Array<{ _id: Types.ObjectId; total: number }>) {
      monthlyMap.set(String(row._id), Number(row.total ?? 0));
    }

    return NextResponse.json({
      data: vendors.map((vendor) =>
        mapVendor({
          ...vendor,
          thisMonthAmount: monthlyMap.get(String(vendor._id)) ?? 0
        })
      ),
      meta: {
        ...buildPageMeta(page, limit, total),
        activeCount
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = vendorCreateSchema.parse(normalizeVendorCreatePayload(await request.json()));

    const duplicate = await VendorModel.exists({
      name: body.name,
      deletedAt: null
    });

    if (duplicate) {
      throw new HttpError(409, '이미 등록된 업체명입니다.');
    }

    const created = await VendorModel.create({
      name: body.name,
      representativeName: body.representativeName,
      phone: body.phone,
      isActive: true
    });

    await writeAuditLog({
      action: 'create',
      entityType: 'vendor',
      entityId: String(created._id),
      after: created.toObject()
    });

    return NextResponse.json({ data: mapVendor(created.toObject() as VendorRow) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = vendorUpdateSchema.parse(normalizeVendorUpdatePayload(await request.json()));

    const vendor = await VendorModel.findOne({
      _id: new Types.ObjectId(body.id),
      deletedAt: null
    });

    if (!vendor) {
      throw new HttpError(404, '업체를 찾을 수 없습니다.');
    }

    if (body.name && body.name !== vendor.name) {
      const duplicate = await VendorModel.exists({
        _id: { $ne: vendor._id },
        name: body.name,
        deletedAt: null
      });

      if (duplicate) {
        throw new HttpError(409, '이미 등록된 업체명입니다.');
      }
    }

    const before = vendor.toObject();

    if (body.name !== undefined) {
      vendor.name = body.name;
    }

    if (body.representativeName !== undefined) {
      vendor.representativeName = body.representativeName;
    }

    if (body.phone !== undefined) {
      vendor.phone = body.phone;
    }

    if (body.isActive !== undefined) {
      vendor.isActive = body.isActive;
    }

    await vendor.save();

    await writeAuditLog({
      action: 'update',
      entityType: 'vendor',
      entityId: String(vendor._id),
      before,
      after: vendor.toObject()
    });

    return NextResponse.json({ data: mapVendor(vendor.toObject() as VendorRow) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = vendorDeleteSchema.parse(await request.json());

    const vendor = await VendorModel.findOne({
      _id: new Types.ObjectId(body.id),
      deletedAt: null
    });

    if (!vendor) {
      throw new HttpError(404, '업체를 찾을 수 없습니다.');
    }

    const before = vendor.toObject();

    vendor.deletedAt = new Date();
    await vendor.save();

    await writeAuditLog({
      action: 'delete',
      entityType: 'vendor',
      entityId: String(vendor._id),
      before,
      after: vendor.toObject()
    });

    return NextResponse.json({ data: { id: body.id } });
  } catch (error) {
    return handleApiError(error);
  }
}
