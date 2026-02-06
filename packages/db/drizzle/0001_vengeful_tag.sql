CREATE TYPE "public"."file_access_types" AS ENUM('public', 'private');--> statement-breakpoint
ALTER TABLE "file_keys" ADD COLUMN "is_public" boolean;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_file_access" "file_access_types" DEFAULT 'private' NOT NULL;