import { AuditLogModel } from '@/server/models/audit-log';
import { safeJson } from '@/lib/utils';

export type AuditAction = 'create' | 'update' | 'delete' | 'issue' | 'return';

export async function writeAuditLog(input: {
  action: AuditAction;
  entityType: 'vendor' | 'product' | 'transaction' | 'settlement' | 'payment';
  entityId: string;
  actor?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await AuditLogModel.create({
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    actor: input.actor ?? 'operator',
    before: input.before ? safeJson(input.before) : undefined,
    after: input.after ? safeJson(input.after) : undefined
  });
}
