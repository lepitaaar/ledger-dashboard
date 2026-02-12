import { z } from 'zod';

import { dateKeySchema, objectIdSchema, queryBooleanSchema, queryNumberSchema } from '@/lib/dto/common';

const phoneSchema = z
  .string()
  .trim()
  .min(7, '전화번호를 입력하세요.')
  .max(30, '전화번호가 너무 깁니다.')
  .regex(/^[0-9+\-\s()]+$/, '전화번호 형식이 올바르지 않습니다.');

export const vendorCreateSchema = z.object({
  name: z.string().trim().min(1, '업체명은 필수입니다.').max(120),
  representativeName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : '미입력')),
  phone: phoneSchema
});

export const vendorUpdateSchema = z
  .object({
    id: objectIdSchema,
    name: z.string().trim().min(1).max(120).optional(),
    representativeName: z.string().trim().min(1).max(80).optional(),
    phone: phoneSchema.optional(),
    isActive: z.boolean().optional()
  })
  .superRefine((value, ctx) => {
    const hasAnyField =
      value.name !== undefined ||
      value.representativeName !== undefined ||
      value.phone !== undefined ||
      value.isActive !== undefined;

    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '수정할 필드가 없습니다.'
      });
    }
  });

export const vendorDeleteSchema = z.object({
  id: objectIdSchema
});

export const vendorListQuerySchema = z.object({
  page: queryNumberSchema(1),
  limit: queryNumberSchema(50),
  keyword: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  includeDeleted: queryBooleanSchema
});

export const vendorDetailParamSchema = z.object({
  id: objectIdSchema
});

export const vendorDetailQuerySchema = z.object({
  page: queryNumberSchema(1),
  limit: queryNumberSchema(50)
});

export const vendorPaymentCreateSchema = z.object({
  dateKey: dateKeySchema,
  amount: z.coerce.number().positive('입금액은 0보다 커야 합니다.')
});

export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;
export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;
export type VendorListQuery = z.infer<typeof vendorListQuerySchema>;
