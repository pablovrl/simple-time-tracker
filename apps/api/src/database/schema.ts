import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const taskStatus = pgEnum('task_status', [
  'pending',
  'in_progress',
  'done',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  googleSubject: varchar('google_subject', { length: 255 }).unique(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  ...timestamps(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    client: varchar('client', { length: 120 }).notNull(),
    description: text('description'),
    status: taskStatus('status').default('pending').notNull(),
    hourlyRate: numeric('hourly_rate', { precision: 18, scale: 6 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index('tasks_user_id_idx').on(table.userId),
    unique('tasks_id_user_id_unique').on(table.id, table.userId),
    check('tasks_hourly_rate_nonnegative', sql`${table.hourlyRate} >= 0`),
    check('tasks_currency_format', sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    taskId: uuid('task_id').notNull(),
    description: text('description'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    hourlyRate: numeric('hourly_rate', { precision: 18, scale: 6 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    amount: numeric('amount', { precision: 24, scale: 6 }),
    ...timestamps(),
  },
  (table) => [
    index('time_entries_user_id_idx').on(table.userId),
    index('time_entries_task_id_idx').on(table.taskId),
    check(
      'time_entries_hourly_rate_nonnegative',
      sql`${table.hourlyRate} >= 0`,
    ),
    check(
      'time_entries_currency_format',
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check('time_entries_amount_nonnegative', sql`${table.amount} >= 0`),
    check(
      'time_entries_amount_matches_state',
      sql`(${table.endedAt} IS NULL AND ${table.amount} IS NULL) OR (${table.endedAt} IS NOT NULL AND ${table.amount} IS NOT NULL)`,
    ),
    foreignKey({
      name: 'time_entries_task_user_fk',
      columns: [table.taskId, table.userId],
      foreignColumns: [tasks.id, tasks.userId],
    }),
    uniqueIndex('time_entries_one_active_per_user')
      .on(table.userId)
      .where(sql`${table.endedAt} IS NULL`),
    check(
      'time_entries_end_after_start',
      sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`,
    ),
  ],
);
