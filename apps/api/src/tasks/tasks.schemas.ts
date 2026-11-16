import { z } from 'zod';

export const createTaskSchema = z.strictObject({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
});

export const listTasksSchema = z.strictObject({
  projectId: z.uuid().optional(),
});

export type CreateTask = z.infer<typeof createTaskSchema>;
export type ListTasks = z.infer<typeof listTasksSchema>;
