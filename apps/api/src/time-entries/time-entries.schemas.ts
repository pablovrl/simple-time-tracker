import { z } from 'zod';

export const startTimerSchema = z.strictObject({
  taskId: z.uuid(),
  description: z.string().trim().max(10000).optional(),
});

export const historySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    client: z.string().trim().min(1).max(120).optional(),
    taskId: z.uuid().optional(),
    status: z.enum(['all', 'active', 'completed']).default('all'),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .refine(
    (query) =>
      !query.from || !query.to || Date.parse(query.from) < Date.parse(query.to),
    { message: 'from must be earlier than to', path: ['to'] },
  );

export type StartTimer = z.infer<typeof startTimerSchema>;
export type HistoryQuery = z.infer<typeof historySchema>;

export const entryIdSchema = z.uuid();
export const updateEntrySchema = z
  .strictObject({
    description: z.string().trim().max(10000).nullable().optional(),
    taskId: z.uuid().optional(),
    startedAt: z.iso.datetime({ offset: true }).optional(),
    endedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateEntry = z.infer<typeof updateEntrySchema>;
