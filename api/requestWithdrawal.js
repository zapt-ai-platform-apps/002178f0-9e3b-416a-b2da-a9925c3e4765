import { userBalances, withdrawals } from '../drizzle/schema.js';
import { authenticateUser } from "./_apiUtils.js";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.VITE_PUBLIC_SENTRY_DSN,
  environment: process.env.VITE_PUBLIC_APP_ENV,
  initialScope: {
    tags: {
      type: 'backend',
      projectId: process.env.PROJECT_ID
    }
  }
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const user = await authenticateUser(req);

    const { amount, walletAddress } = req.body;

    if (!amount || !walletAddress) {
      return res.status(400).json({ error: 'Amount and wallet address are required' });
    }

    const sql = neon(process.env.NEON_DB_URL);
    const db = drizzle(sql);

    const userBalance = await db.select()
      .from(userBalances)
      .where(eq(userBalances.userId, user.id))
      .limit(1);

    const balance = userBalance.length > 0 ? parseFloat(userBalance[0].balance) : 0;

    if (amount > balance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct amount from user balance
    const newBalance = balance - amount;
    await db.update(userBalances)
      .set({ balance: newBalance })
      .where(eq(userBalances.userId, user.id));

    // Insert withdrawal request
    await db.insert(withdrawals).values({
      userId: user.id,
      amount: amount,
      walletAddress: walletAddress,
    });

    res.status(200).json({ message: 'Withdrawal request submitted' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error processing withdrawal:', error);
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      res.status(401).json({ error: 'Authentication failed' });
    } else {
      res.status(500).json({ error: 'Error processing withdrawal' });
    }
  }
}