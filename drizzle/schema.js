import { pgTable, serial, text, timestamp, numeric } from 'drizzle-orm/pg-core';

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  description: text('description').notNull(),
  type: text('type').notNull(),
  reward: numeric('reward').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userBalances = pgTable('user_balances', {
  userId: text('user_id').primaryKey(),
  balance: numeric('balance').default(0),
});

export const taskCompletions = pgTable('task_completions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  taskId: serial('task_id').notNull(),
  completedAt: timestamp('completed_at').defaultNow(),
});

export const withdrawals = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  amount: numeric('amount').notNull(),
  currency: text('currency').notNull().default('BTC'),
  walletAddress: text('wallet_address').notNull(),
  status: text('status').default('pending'),
  transactionId: text('transaction_id'),
  requestedAt: timestamp('requested_at').defaultNow(),
});

export const faucetClaims = pgTable('faucet_claims', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  claimedAt: timestamp('claimed_at').defaultNow(),
});