import { model, models, Schema, type Types } from 'mongoose';

export interface AuctionSyncLock {
  _id: Types.ObjectId;
  key: string;       // 유일 키 ('sync_lock')
  isLocked: boolean;
  lockedAt: Date | null;
  ownerId: string | null;
}

const auctionSyncLockSchema = new Schema<AuctionSyncLock>(
  {
    key: { type: String, required: true, unique: true, default: 'sync_lock' },
    isLocked: { type: Boolean, required: true, default: false },
    lockedAt: { type: Date, default: null },
    ownerId: { type: String, default: null }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

export const AuctionSyncLockModel =
  models.AuctionSyncLock || model<AuctionSyncLock>('AuctionSyncLock', auctionSyncLockSchema);
