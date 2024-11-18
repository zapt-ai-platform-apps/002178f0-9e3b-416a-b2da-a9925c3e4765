-- Alter userBalances table
ALTER TABLE "user_balances" ALTER COLUMN "user_id" TYPE TEXT;

-- Alter taskCompletions table
ALTER TABLE "task_completions" ALTER COLUMN "user_id" TYPE TEXT;

-- Alter withdrawals table
ALTER TABLE "withdrawals" ALTER COLUMN "user_id" TYPE TEXT;