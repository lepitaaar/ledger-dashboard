import { model, models, Schema, type Types } from 'mongoose';

export interface IdempotencyRecord {
  _id: Types.ObjectId;
  scope: string;
  key: string;
  status: 'processing' | 'completed';
  response: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const idempotencyRecordSchema = new Schema<IdempotencyRecord>(
  {
    scope: { type: String, required: true },
    key: { type: String, required: true },
    status: { type: String, enum: ['processing', 'completed'], required: true },
    response: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

idempotencyRecordSchema.index({ scope: 1, key: 1 }, { unique: true });
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyRecordModel =
  models.IdempotencyRecord ||
  model<IdempotencyRecord>('IdempotencyRecord', idempotencyRecordSchema);
