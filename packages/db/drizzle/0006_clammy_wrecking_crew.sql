CREATE TYPE "public"."file_key_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "file_keys" ADD COLUMN "status" "file_key_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE "file_keys" SET "status" = 'completed' WHERE "file_id" IS NOT NULL;--> statement-breakpoint
UPDATE "file_keys" SET "status" = 'failed' WHERE "upload_failed_at" IS NOT NULL AND "file_id" IS NULL;