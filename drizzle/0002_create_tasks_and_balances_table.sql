-- Create tasks table
CREATE TABLE "tasks" (
  "id" SERIAL PRIMARY KEY,
  "description" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reward" NUMERIC NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create user_balances table
CREATE TABLE "user_balances" (
  "user_id" UUID PRIMARY KEY,
  "balance" NUMERIC DEFAULT 0
);

-- Create task_completions table
CREATE TABLE "task_completions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "task_id" INTEGER NOT NULL,
  "completed_at" TIMESTAMP DEFAULT NOW()
);

-- Create withdrawals table
CREATE TABLE "withdrawals" (
  "id" SERIAL PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "amount" NUMERIC NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "status" TEXT DEFAULT 'pending',
  "requested_at" TIMESTAMP DEFAULT NOW()
);