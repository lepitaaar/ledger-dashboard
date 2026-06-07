import { type FilterQuery, Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectMongo } from "@/lib/db";
import {
  productCreateSchema,
  productDeleteSchema,
  productListQuerySchema,
  productUpdateSchema,
} from "@/lib/dto/product";
import { handleApiError, HttpError } from "@/lib/http";
import { buildPageMeta, normalizePagination } from "@/lib/pagination";
import { escapeRegExp } from "@/lib/utils";
import { ProductModel } from "@/server/models/product";

import { writeAuditLog } from "@/server/services/audit";

export const runtime = "nodejs";

type ProductRow = {
  _id: unknown;
  name: string;
  unit?: string;
  initialQty?: number;
  initialCost?: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapProduct(product: ProductRow): Record<string, unknown> {
  return {
    _id: String(product._id),
    name: product.name,
    unit: product.unit,
    initialQty: product.initialQty || 0,
    initialCost: product.initialCost || 0,
    deletedAt: product.deletedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const query = productListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const filter: FilterQuery<ProductRow> = query.includeDeleted
      ? {}
      : { deletedAt: null };

    if (query.keyword) {
      filter.$or = [
        { name: { $regex: escapeRegExp(query.keyword), $options: "i" } },
        { unit: { $regex: escapeRegExp(query.keyword), $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      ProductModel.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean<ProductRow[]>(),
      ProductModel.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: products.map((product) => mapProduct(product)),
      meta: buildPageMeta(page, limit, total),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = productCreateSchema.parse(await request.json());

    const created = await ProductModel.create({
      name: body.name,
      unit: body.unit || undefined,
      initialQty: body.initialQty || 0,
      initialCost: body.initialCost || 0,
    });

    const { recalculateInventory } = await import("@/server/services/inventory");
    await recalculateInventory(created._id);

    await writeAuditLog({
      action: "create",
      entityType: "product",
      entityId: String(created._id),
      after: created.toObject(),
    });

    return NextResponse.json(
      { data: mapProduct(created.toObject() as ProductRow) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = productUpdateSchema.parse(await request.json());

    const product = await ProductModel.findOne({
      _id: new Types.ObjectId(body.id),
      deletedAt: null,
    });

    if (!product) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    const before = product.toObject();

    if (body.name !== undefined) {
      product.name = body.name;
    }

    if (body.unit !== undefined) {
      product.unit = body.unit;
    }

    let isInitialChanged = false;
    if (body.initialQty !== undefined && body.initialQty !== product.initialQty) {
      product.initialQty = body.initialQty;
      isInitialChanged = true;
    }

    if (body.initialCost !== undefined && body.initialCost !== product.initialCost) {
      product.initialCost = body.initialCost;
      isInitialChanged = true;
    }

    await product.save();

    if (isInitialChanged) {
      const { recalculateInventory } = await import("@/server/services/inventory");
      await recalculateInventory(product._id);
    }

    await writeAuditLog({
      action: "update",
      entityType: "product",
      entityId: String(product._id),
      before,
      after: product.toObject(),
    });

    return NextResponse.json({
      data: mapProduct(product.toObject() as ProductRow),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const body = productDeleteSchema.parse(await request.json());

    const product = await ProductModel.findOne({
      _id: new Types.ObjectId(body.id),
      deletedAt: null,
    });

    if (!product) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    const before = product.toObject();

    product.deletedAt = new Date();
    await product.save();

    await writeAuditLog({
      action: "delete",
      entityType: "product",
      entityId: String(product._id),
      before,
      after: product.toObject(),
    });

    return NextResponse.json({ data: { id: body.id } });
  } catch (error) {
    return handleApiError(error);
  }
}
