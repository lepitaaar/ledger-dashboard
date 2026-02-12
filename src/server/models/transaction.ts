import { model, models, Schema, type Types } from 'mongoose';

export interface Transaction {
  _id: Types.ObjectId;
  dateKey: string;
  vendorId: Types.ObjectId;
  productName: string;
  productUnit?: string;
  unitPrice: number;
  qty: number;
  amount: number;
  registeredTimeKST: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<Transaction>(
  {
    dateKey: { type: String, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productName: { type: String, required: true, trim: true },
    productUnit: { type: String, trim: true },
    unitPrice: { type: Number, required: true },
    qty: { type: Number, required: true },
    amount: { type: Number, required: true },
    registeredTimeKST: { type: String, required: true },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

transactionSchema.index({ dateKey: 1 });
transactionSchema.index({ vendorId: 1, dateKey: 1 });
transactionSchema.index({ productName: 1 });
transactionSchema.index({ deletedAt: 1 });

export const TransactionModel = models.Transaction || model<Transaction>('Transaction', transactionSchema);
