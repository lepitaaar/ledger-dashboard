import { model, models, Schema, type Types } from 'mongoose';

export interface SettlementItemSnapshot {
  transactionId: Types.ObjectId;
  dateKey: string;
  productName: string;
  productUnit?: string;
  unitPrice: number;
  qty: number;
  amount: number;
  registeredTimeKST: string;
}

export interface Settlement {
  _id: Types.ObjectId;
  issueDateKey: string;
  vendorId: Types.ObjectId;
  rangeStartKey: string;
  rangeEndKey: string;
  itemsSnapshot: SettlementItemSnapshot[];
  totalAmount: number;
  createdAt: Date;
}

const settlementItemSchema = new Schema<SettlementItemSnapshot>(
  {
    transactionId: { type: Schema.Types.ObjectId, required: true },
    dateKey: { type: String, required: true },
    productName: { type: String, required: true },
    productUnit: { type: String },
    unitPrice: { type: Number, required: true },
    qty: { type: Number, required: true },
    amount: { type: Number, required: true },
    registeredTimeKST: { type: String, required: true }
  },
  {
    _id: false,
    versionKey: false
  }
);

const settlementSchema = new Schema<Settlement>(
  {
    issueDateKey: { type: String, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    rangeStartKey: { type: String, required: true },
    rangeEndKey: { type: String, required: true },
    itemsSnapshot: { type: [settlementItemSchema], required: true },
    totalAmount: { type: Number, required: true }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

settlementSchema.index({ vendorId: 1, issueDateKey: 1 });
settlementSchema.index({ rangeStartKey: 1, rangeEndKey: 1 });

export const SettlementModel = models.Settlement || model<Settlement>('Settlement', settlementSchema);
