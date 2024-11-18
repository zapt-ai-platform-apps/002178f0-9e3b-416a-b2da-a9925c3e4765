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

    const userBalance = await db.select()
      .from(userBalances)
      .where(eq(userBalances.userId, userId))
      .limit(1);

    const balance = userBalance.length > 0 ? userBalance[0].balance : 0;

    // Fetch last faucet claim time
    const lastClaim = await db.select()
      .from(faucetClaims)
      .where(eq(faucetClaims.userId, userId))
      .orderBy(faucetClaims.claimedAt, { descending: true })
      .limit(1);

    const lastClaimTime = lastClaim.length > 0 ? lastClaim[0].claimedAt : null;

    res.status(200).json({ balance, lastClaimTime });
  } catch (error) {
    Sentry.captureException(error);
    console.error('خطأ في جلب الرصيد:', error);
    res.status(500).json({ error: 'خطأ في جلب الرصيد' });
  }
}