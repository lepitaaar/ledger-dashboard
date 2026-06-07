import { model, models, Schema, type Types } from "mongoose";

export interface Product {
  _id: Types.ObjectId;
  name: string;
  unit?: string;
  initialQty?: number;
  initialCost?: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<Product>(
  {
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true },
    initialQty: { type: Number, default: 0 },
    initialCost: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

productSchema.index({ name: 1 });
productSchema.index({ deletedAt: 1 });

export const ProductModel =
  models.Product || model<Product>("Product", productSchema);
