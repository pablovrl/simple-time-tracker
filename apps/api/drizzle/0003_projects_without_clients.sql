-- Copy client ownership and billing settings before removing the relationship.
ALTER TABLE "projects" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "hourly_rate" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
UPDATE "projects" AS p
SET "user_id" = c."user_id",
    "hourly_rate" = c."hourly_rate",
    "currency" = c."currency",
    "archived_at" = COALESCE(p."archived_at", c."archived_at")
FROM "clients" AS c
WHERE p."client_id" = c."id";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "hourly_rate" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_hourly_rate_nonnegative" CHECK ("projects"."hourly_rate" >= 0);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_currency_format" CHECK ("projects"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_client_id_clients_id_fk";--> statement-breakpoint
DROP INDEX "projects_client_id_idx";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "client_id";--> statement-breakpoint
DROP TABLE "clients";
