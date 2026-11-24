import { z } from 'zod';

export const summarySchema = z
  .strictObject({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    timeZone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Invalid time zone')
      .optional(),
  })
  .refine((query) => Date.parse(query.from) < Date.parse(query.to), {
    message: 'from must be earlier than to',
    path: ['to'],
  });

export type SummaryQuery = z.infer<typeof summarySchema>;
