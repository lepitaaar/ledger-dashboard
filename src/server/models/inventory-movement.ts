import { model, models, Schema, type Types } from 'mongoose';

export interface InventoryMovement {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  type: 'initial' | 'purchase' | 'sale' | 'return';
  referenceId: Types.ObjectId | null; // AuctionPurchase or Transaction ID (null for 'initial')
  dateKey: string;             // 'YYYY-MM-DD'
  timeKey: string;             // 'HH:mm:ss' (매입은 '00:00:00')
  qtyChange: number;           // 수량 변화 (매입: +trqt, 매출: -qty, 반품: +|qty|)
  unitPrice: number;           // 낙찰단가 혹은 판매단가
  amount: number;              // 금액 (trqt * actoUpr 혹은 판매금액)
  costApplied: number;         // 적용 원가 (이동평균 원가 또는 매입가)
  endingQty: number;           // 해당 시점의 잔여 수량
  endingMovingAvg: number;     // 해당 시점의 이동평균 원가
  status: 'normal' | 'insufficient_inventory';
  createdAt: Date;
  updatedAt: Date;
}

const inventoryMovementSchema = new Schema<InventoryMovement>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: ['initial', 'purchase', 'sale', 'return'], required: true },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    dateKey: { type: String, required: true },
    timeKey: { type: String, required: true },
    qtyChange: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true },
    costApplied: { type: Number, required: true },
    endingQty: { type: Number, required: true },
    endingMovingAvg: { type: Number, required: true },
    status: { type: String, enum: ['normal', 'insufficient_inventory'], required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

inventoryMovementSchema.index({ productId: 1, dateKey: 1, timeKey: 1, _id: 1 });
inventoryMovementSchema.index({ referenceId: 1 });

export const InventoryMovementModel =
  models.InventoryMovement || model<InventoryMovement>('InventoryMovement', inventoryMovementSchema);
