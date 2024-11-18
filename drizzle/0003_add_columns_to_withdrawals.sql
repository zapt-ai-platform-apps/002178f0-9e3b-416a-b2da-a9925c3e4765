-- Add currency and transaction_id columns to withdrawals table
ALTER TABLE "withdrawals"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BTC',
ADD COLUMN "transaction_id" TEXT;