import { ProductModel } from '@/server/models/product';
import { writeAuditLog } from '@/server/services/audit';
import type { ClientSession } from 'mongoose';

export type ProductOption = {
  _id: string;
  name: string;
  unit?: string;
};

type ProductOptionRow = {
  _id: unknown;
  name: string;
  unit?: string;
};

export async function listProductOptions(limit: number = 500): Promise<ProductOption[]> {
  const rows = await ProductModel.find({
    deletedAt: null
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<ProductOptionRow[]>();

  return rows.map((row) => ({
    _id: String(row._id),
    name: row.name,
    unit: row.unit
  }));
}

export async function ensureProductByName(
  name: string,
  session?: ClientSession
): Promise<{ _id: unknown; name: string; unit?: string }> {
  const normalizedName = name.trim();
  const existingQuery = ProductModel.findOne({
    name: normalizedName,
    deletedAt: null
  });
  const existing = session ? await existingQuery.session(session) : await existingQuery;

  if (existing) {
    return existing;
  }

  const productInput = {
    name: normalizedName,
    unit: undefined,
    initialQty: 0,
    initialCost: 0
  };
  const created = session
    ? (await ProductModel.create([productInput], { session }))[0]
    : await ProductModel.create(productInput);

  const auditInput = {
    action: 'create',
    entityType: 'product',
    entityId: String(created._id),
    after: created.toObject()
  } as const;

  if (session) {
    await writeAuditLog(auditInput, session);
  } else {
    await writeAuditLog(auditInput);
  }

  return created;
}
