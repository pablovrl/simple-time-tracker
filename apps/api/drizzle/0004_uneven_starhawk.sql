ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_task_project_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_id_project_id_unique";--> statement-breakpoint
DROP TABLE "projects";--> statement-breakpoint
DROP INDEX "tasks_project_id_idx";--> statement-breakpoint
DROP INDEX "time_entries_project_id_idx";--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "task_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "client" varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "hourly_rate" numeric(18, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "currency" varchar(3) NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "time_entries" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_id_user_id_unique" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_user_fk" FOREIGN KEY ("task_id","user_id") REFERENCES "public"."tasks"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_hourly_rate_nonnegative" CHECK ("tasks"."hourly_rate" >= 0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_currency_format" CHECK ("tasks"."currency" ~ '^[A-Z]{3}$');
