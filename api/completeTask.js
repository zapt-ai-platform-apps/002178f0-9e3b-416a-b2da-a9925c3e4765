import { tasks, taskCompletions, userBalances } from '../drizzle/schema.js';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
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

    const { userId, taskId } = req.body;

    if (!userId || !taskId) {
      return res.status(400).json({ error: 'مطلوب معرف المستخدم ومعرف المهمة' });
    }

    const sql = neon(process.env.NEON_DB_URL);
    const db = drizzle(sql);

    // Check if task exists
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

    if (task.length === 0) {
      return res.status(404).json({ error: 'لم يتم العثور على المهمة' });
    }

    const reward = task[0].reward;

    // Check if user has already completed the task
    const existingCompletion = await db.select()
      .from(taskCompletions)
      .where(and(eq(taskCompletions.userId, userId), eq(taskCompletions.taskId, taskId)))
      .limit(1);

    if (existingCompletion.length > 0) {
      return res.status(400).json({ error: 'تم إكمال المهمة سابقًا' });
    }

    // Insert task completion record
    await db.insert(taskCompletions).values({
      userId: userId,
      taskId: taskId,
    });

    // Update user balance
    const userBalance = await db.select()
      .from(userBalances)
      .where(eq(userBalances.userId, userId))
      .limit(1);

    if (userBalance.length === 0) {
      // Create new balance record
      await db.insert(userBalances).values({
        userId: userId,
        balance: reward,
      });
    } else {
      // Update existing balance
      const newBalance = parseFloat(userBalance[0].balance) + parseFloat(reward);
      await db.update(userBalances)
        .set({ balance: newBalance })
        .where(eq(userBalances.userId, userId));
    }

    res.status(200).json({ message: 'تم إكمال المهمة بنجاح' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('خطأ في إكمال المهمة:', error);
    res.status(500).json({ error: 'خطأ في إكمال المهمة' });
  }
}