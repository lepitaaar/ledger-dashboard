import { ProductModel } from '@/server/models/product';

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
