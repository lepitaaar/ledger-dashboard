import { model, models, Schema, type Types } from 'mongoose';

export interface Vendor {
  _id: Types.ObjectId;
  name: string;
  representativeName: string;
  phone: string;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<Vendor>(
  {
    name: { type: String, required: true, trim: true },
    representativeName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, required: true, default: true },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

vendorSchema.index({ name: 1 });
vendorSchema.index({ phone: 1 });
vendorSchema.index({ isActive: 1 });
vendorSchema.index({ deletedAt: 1 });

export const VendorModel = models.Vendor || model<Vendor>('Vendor', vendorSchema);
