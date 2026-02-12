import { model, models, Schema, type Types } from 'mongoose';

export interface AuditLog {
  _id: Types.ObjectId;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  before?: unknown;
  after?: unknown;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    actor: { type: String, required: true, default: 'operator' },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

export const AuditLogModel = models.AuditLog || model<AuditLog>('AuditLog', auditLogSchema);
