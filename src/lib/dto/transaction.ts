import { z } from 'zod';

import { dateKeySchema, objectIdSchema, queryBooleanSchema, queryNumberSchema, timeKeySchema } from '@/lib/dto/common';

const baseTransactionSchema = {
  dateKey: dateKeySchema,
  vendorId: objectIdSchema,
  productName: z.string().trim().min(1, '상품명은 필수입니다.').max(200),
  productUnit: z.string().trim().max(50).optional(),
  unitPrice: z.coerce.number().finite().min(0, '단가는 0 이상이어야 합니다.'),
  qty: z.coerce.number().finite(),
  registeredTimeKST: timeKeySchema.optional()
};

export const transactionCreateSchema = z.object(baseTransactionSchema);

export const transactionUpdateSchema = z
  .object({
    id: objectIdSchema,
    dateKey: dateKeySchema.optional(),
    vendorId: objectIdSchema.optional(),
    productName: z.string().trim().min(1).max(200).optional(),
    productUnit: z.string().trim().max(50).optional(),
    unitPrice: z.coerce.number().finite().min(0).optional(),
    qty: z.coerce.number().finite().optional(),
    registeredTimeKST: timeKeySchema.optional()
  })
  .superRefine((value, ctx) => {
    const hasUpdatableField =
      value.dateKey !== undefined ||
      value.vendorId !== undefined ||
      value.productName !== undefined ||
      value.productUnit !== undefined ||
      value.unitPrice !== undefined ||
      value.qty !== undefined ||
      value.registeredTimeKST !== undefined;

    if (!hasUpdatableField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '수정할 필드가 없습니다.'
      });
    }
  });

export const transactionDeleteSchema = z.object({
  id: objectIdSchema
});

export const transactionListQuerySchema = z
  .object({
    page: queryNumberSchema(1),
    limit: queryNumberSchema(50),
    vendorId: objectIdSchema.optional(),
    productName: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    keyword: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    startKey: dateKeySchema.optional(),
    endKey: dateKeySchema.optional(),
    preset: z.enum(['today', '1w', '1m', '3m']).optional(),
    includeDeleted: queryBooleanSchema
  })
  .superRefine((value, ctx) => {
    if (value.startKey && value.endKey && value.startKey > value.endKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startKey'],
        message: '시작일은 종료일보다 클 수 없습니다.'
      });
    }
  });

export const transactionExportQuerySchema = z
  .object({
    vendorId: objectIdSchema.optional(),
    productName: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    keyword: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    startKey: dateKeySchema.optional(),
    endKey: dateKeySchema.optional(),
    preset: z.enum(['today', '1w', '1m', '3m']).optional(),
    includeDeleted: queryBooleanSchema
  })
  .superRefine((value, ctx) => {
    if (value.startKey && value.endKey && value.startKey > value.endKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startKey'],
        message: '시작일은 종료일보다 클 수 없습니다.'
      });
    }
  });

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
