import { z } from "zod";

import {
  objectIdSchema,
  queryBooleanSchema,
  queryNumberSchema,
} from "@/lib/dto/common";

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, "상품명은 필수입니다.").max(120),
  unit: z.string().trim().max(50).optional(),
});

export const productUpdateSchema = z.object({
  id: objectIdSchema,
  name: z.string().trim().min(1).max(120).optional(),
  unit: z.string().trim().max(50).optional(),
});

export const productDeleteSchema = z.object({
  id: objectIdSchema,
});

export const productListQuerySchema = z.object({
  page: queryNumberSchema(1),
  limit: queryNumberSchema(50),
  keyword: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  includeDeleted: queryBooleanSchema,
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
