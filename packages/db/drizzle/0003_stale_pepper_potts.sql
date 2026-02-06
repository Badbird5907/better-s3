ALTER TABLE "file_keys" ALTER COLUMN "is_public" SET DEFAULT false;--> statement-breakpoint
UPDATE "file_keys" SET "is_public" = false WHERE "is_public" IS NULL;--> statement-breakpoint
ALTER TABLE "file_keys" ALTER COLUMN "is_public" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "is_public";