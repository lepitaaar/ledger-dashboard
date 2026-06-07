import { ProductModel } from '@/server/models/product';
import { writeAuditLog } from '@/server/services/audit';

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

export async function ensureProductByName(name: string): Promise<{ _id: unknown; name: string; unit?: string }> {
  const normalizedName = name.trim();
  const existing = await ProductModel.findOne({
    name: normalizedName,
    deletedAt: null
  });

  if (existing) {
    return existing;
  }

  const created = await ProductModel.create({
    name: normalizedName,
    unit: undefined,
    initialQty: 0,
    initialCost: 0
  });

  await writeAuditLog({
    action: 'create',
    entityType: 'product',
    entityId: String(created._id),
    after: created.toObject()
  });

  return created;
}
