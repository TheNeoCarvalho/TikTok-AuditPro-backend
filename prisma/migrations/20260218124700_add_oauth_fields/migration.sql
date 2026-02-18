-- AlterTable: Add TikTok OAuth v2 fields
ALTER TABLE "tiktok_accounts" ADD COLUMN IF NOT EXISTS "open_id" TEXT;
ALTER TABLE "tiktok_accounts" ADD COLUMN IF NOT EXISTS "access_token" TEXT;
ALTER TABLE "tiktok_accounts" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT;
ALTER TABLE "tiktok_accounts" ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMP(3);
ALTER TABLE "tiktok_accounts" ADD COLUMN IF NOT EXISTS "refresh_expires_at" TIMESTAMP(3);
ALTER TABLE "tiktok_accounts" ADD COLUMN IF NOT EXISTS "scopes" TEXT;
