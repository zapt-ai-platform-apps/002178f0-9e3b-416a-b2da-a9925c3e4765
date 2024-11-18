-- Create faucet_claims table
CREATE TABLE "faucet_claims" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "claimed_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create an index on user_id to optimize queries
CREATE INDEX ON "faucet_claims" ("user_id");