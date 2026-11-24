import { z } from 'zod';

export const summarySchema = z
  .strictObject({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine((query) => Date.parse(query.from) < Date.parse(query.to), {
    message: 'from must be earlier than to',
    path: ['to'],
  });

export type SummaryQuery = z.infer<typeof summarySchema>;
