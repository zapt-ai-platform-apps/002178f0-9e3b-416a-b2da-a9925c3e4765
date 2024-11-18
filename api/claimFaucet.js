import { userBalances, faucetClaims } from '../drizzle/schema.js';
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

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'مطلوب معرف المستخدم' });
    }

    const sql = neon(process.env.NEON_DB_URL);
    const db = drizzle(sql);

    // Check if user has claimed faucet in the last 24 hours
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const lastClaim = await db.select()
      .from(faucetClaims)
      .where(eq(faucetClaims.userId, userId))
      .orderBy(faucetClaims.claimedAt, { descending: true })
      .limit(1);

    if (lastClaim.length > 0 && new Date(lastClaim[0].claimedAt) >= last24Hours) {
      return res.status(400).json({ error: 'يمكنك استخدام الصنبور مرة واحدة كل 24 ساعة' });
    }

    const faucetReward = 10; // Define the reward amount

    // Update user balance
    const userBalance = await db.select()
      .from(userBalances)
      .where(eq(userBalances.userId, userId))
      .limit(1);

    if (userBalance.length === 0) {
      // Create new balance record
      await db.insert(userBalances).values({
        userId: userId,
        balance: faucetReward,
      });
    } else {
      // Update existing balance
      const newBalance = parseFloat(userBalance[0].balance) + faucetReward;
      await db.update(userBalances)
        .set({ balance: newBalance })
        .where(eq(userBalances.userId, userId));
    }

    // Record faucet claim
    await db.insert(faucetClaims).values({
      userId: userId,
    });

    res.status(200).json({ message: 'تم جمع المكافأة من الصنبور بنجاح' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('خطأ في جمع المكافأة من الصنبور:', error);
    res.status(500).json({ error: 'خطأ في جمع المكافأة من الصنبور' });
  }
}