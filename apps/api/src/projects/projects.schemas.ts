import { z } from 'zod';

const currencies = new Set<string>(Intl.supportedValuesOf('currency'));

export const createProjectSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(10000).nullable().optional(),
  hourlyRate: z
    .string()
    .regex(
      /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/,
      'Use a nonnegative decimal string with at most 12 integer and 6 decimal digits',
    ),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .refine(
      (value) => currencies.has(value),
      'Use a supported ISO 4217 currency code',
    ),
});

export const listProjectsSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

export type CreateProject = z.infer<typeof createProjectSchema>;
export type ListProjects = z.infer<typeof listProjectsSchema>;
