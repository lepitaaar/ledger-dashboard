import { model, models, Schema, type Types } from 'mongoose';

export interface Payment {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  dateKey: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<Payment>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    dateKey: { type: String, required: true },
    amount: { type: Number, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

paymentSchema.index({ vendorId: 1, dateKey: 1 });
paymentSchema.index({ dateKey: 1 });

export const PaymentModel = models.Payment || model<Payment>('Payment', paymentSchema);
