import { userBalances, withdrawals } from '../drizzle/schema.js';
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
      return res.status(405).end(`الطريقة ${req.method} غير مسموح بها`);
    }

    const { userId, amount, walletAddress } = req.body;

    if (!userId || !amount || !walletAddress) {
      return res.status(400).json({ error: 'مطلوب معرف المستخدم والمبلغ وعنوان المحفظة' });
    }

    const sql = neon(process.env.NEON_DB_URL);
    const db = drizzle(sql);

    const userBalance = await db.select()
      .from(userBalances)
      .where(eq(userBalances.userId, userId))
      .limit(1);

    const balance = userBalance.length > 0 ? parseFloat(userBalance[0].balance) : 0;

    if (amount > balance) {
      return res.status(400).json({ error: 'رصيد غير كافٍ' });
    }

    // Deduct amount from user balance
    const newBalance = balance - amount;
    await db.update(userBalances)
      .set({ balance: newBalance })
      .where(eq(userBalances.userId, userId));

    // Insert withdrawal request
    await db.insert(withdrawals).values({
      userId: userId,
      amount: amount,
      walletAddress: walletAddress,
    });

    res.status(200).json({ message: 'تم تقديم طلب السحب' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('خطأ في معالجة السحب:', error);
    res.status(500).json({ error: 'خطأ في معالجة السحب' });
  }
}