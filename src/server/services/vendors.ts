import { VendorModel } from '@/server/models/vendor';

export type VendorOption = {
  _id: string;
  name: string;
};

type VendorOptionRow = {
  _id: unknown;
  name: string;
};

export async function listVendorOptions(limit: number = 500): Promise<VendorOption[]> {
  const rows = await VendorModel.find({
    deletedAt: null
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<VendorOptionRow[]>();

  return rows.map((row) => ({
    _id: String(row._id),
    name: row.name
  }));
}
