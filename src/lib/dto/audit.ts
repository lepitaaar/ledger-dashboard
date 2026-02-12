import { z } from 'zod';

import { queryNumberSchema } from '@/lib/dto/common';

export const auditListQuerySchema = z.object({
  page: queryNumberSchema(1),
  limit: queryNumberSchema(50),
  entityType: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  action: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
});
