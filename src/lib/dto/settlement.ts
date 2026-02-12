import { z } from 'zod';

import { dateKeySchema, objectIdSchema, queryNumberSchema, timeKeySchema } from '@/lib/dto/common';

export const settlementIssueSchema = z
  .object({
    issueDateKey: dateKeySchema,
    vendorId: objectIdSchema,
    rangeStartKey: dateKeySchema,
    rangeEndKey: dateKeySchema
  })
  .superRefine((value, ctx) => {
    if (value.rangeStartKey > value.rangeEndKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rangeStartKey'],
        message: '시작일은 종료일보다 클 수 없습니다.'
      });
    }
  });

export const settlementListQuerySchema = z
  .object({
    page: queryNumberSchema(1),
    limit: queryNumberSchema(50),
    vendorId: objectIdSchema.optional(),
    issueStartKey: dateKeySchema.optional(),
    issueEndKey: dateKeySchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.issueStartKey && value.issueEndKey && value.issueStartKey > value.issueEndKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['issueStartKey'],
        message: '시작일은 종료일보다 클 수 없습니다.'
      });
    }
  });

export const settlementIdParamSchema = z.object({
  id: objectIdSchema
});

export const settlementManageQuerySchema = z.object({
  vendorId: objectIdSchema,
  dateKey: dateKeySchema
});

const settlementLineBaseSchema = {
  vendorId: objectIdSchema,
  dateKey: dateKeySchema,
  productName: z.string().trim().min(1, '품목은 필수입니다.').max(200),
  productUnit: z.string().trim().max(50).optional(),
  qty: z.coerce.number().finite('수량은 숫자여야 합니다.'),
  unitPrice: z.coerce.number().finite('단가는 숫자여야 합니다.').min(0, '단가는 0 이상이어야 합니다.'),
  registeredTimeKST: timeKeySchema.optional()
};

export const settlementLineCreateSchema = z.object(settlementLineBaseSchema);

export const settlementLineUpdateSchema = z
  .object({
    id: objectIdSchema,
    productName: z.string().trim().min(1).max(200).optional(),
    productUnit: z.string().trim().max(50).optional(),
    qty: z.coerce.number().finite().optional(),
    unitPrice: z.coerce.number().finite().min(0).optional(),
    registeredTimeKST: timeKeySchema.optional()
  })
  .superRefine((value, ctx) => {
    const hasAnyField =
      value.productName !== undefined ||
      value.productUnit !== undefined ||
      value.qty !== undefined ||
      value.unitPrice !== undefined ||
      value.registeredTimeKST !== undefined;

    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '수정할 필드가 없습니다.'
      });
    }
  });

export const settlementLineDeleteSchema = z.object({
  id: objectIdSchema
});

export const settlementLineReturnSchema = z.object({
  transactionId: objectIdSchema
});

export const settlementExportQuerySchema = z.object({
  vendorId: objectIdSchema,
  dateKey: dateKeySchema
});

export type SettlementIssueInput = z.infer<typeof settlementIssueSchema>;
export type SettlementListQuery = z.infer<typeof settlementListQuerySchema>;
export type SettlementManageQuery = z.infer<typeof settlementManageQuerySchema>;
export type SettlementLineCreateInput = z.infer<typeof settlementLineCreateSchema>;
export type SettlementLineUpdateInput = z.infer<typeof settlementLineUpdateSchema>;
