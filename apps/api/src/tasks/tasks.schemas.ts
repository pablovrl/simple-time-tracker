import { z } from 'zod';

const currencies = new Set<string>(Intl.supportedValuesOf('currency'));

export const createTaskSchema = z.strictObject({
  client: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(255),
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
  status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
});

export const listTasksSchema = z.strictObject({
  client: z.string().trim().min(1).max(120).optional(),
});

export type CreateTask = z.infer<typeof createTaskSchema>;
export type ListTasks = z.infer<typeof listTasksSchema>;
