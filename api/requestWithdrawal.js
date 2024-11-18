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

    const { userId, amount, walletAddress, apiKey } = req.body;

    if (!userId || !amount || !walletAddress || !apiKey) {
      return res.status(400).json({ error: 'مطلوب معرف المستخدم، المبلغ، عنوان المحفظة، ومفتاح API' });
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

    const faucetPayUrl = 'https://faucetpay.io/api/v1/send';

    // Assume the currency is BTC
    const currency = 'BTC';

    // Convert amount to Satoshi (smallest unit)
    // Assuming 1 coin = 1 Satoshi
    const amountInSatoshi = amount;

    if (amountInSatoshi <= 0) {
      return res.status(400).json({ error: 'المبلغ غير كافٍ للسحب' });
    }

    const params = {
      api_key: apiKey,
      amount: amountInSatoshi.toString(),
      to: walletAddress,
      currency: currency,
    };

    const formBody = new URLSearchParams(params).toString();

    const response = await fetch(faucetPayUrl, {
      method: 'POST',
      body: formBody,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    });

    const faucetPayResult = await response.json();

    if (faucetPayResult.status === 200) {
      // Deduct amount from user balance
      const newBalance = balance - amount;
      await db.update(userBalances)
        .set({ balance: newBalance })
        .where(eq(userBalances.userId, userId));

      // Insert withdrawal record with status 'processed'
      await db.insert(withdrawals).values({
        userId: userId,
        amount: amount,
        walletAddress: walletAddress,
        status: 'processed',
        currency: currency,
        transactionId: faucetPayResult.data['transactionId'] || '',
      });

      res.status(200).json({ message: 'تم معالجة السحب بنجاح' });
    } else {
      // Insert withdrawal record with status 'failed'
      await db.insert(withdrawals).values({
        userId: userId,
        amount: amount,
        walletAddress: walletAddress,
        status: 'failed',
        currency: currency,
        transactionId: '',
      });

      res.status(400).json({ error: 'فشل في معالجة السحب: ' + faucetPayResult.message });
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error('خطأ في معالجة السحب:', error);
    res.status(500).json({ error: 'خطأ في معالجة السحب' });
  }
}