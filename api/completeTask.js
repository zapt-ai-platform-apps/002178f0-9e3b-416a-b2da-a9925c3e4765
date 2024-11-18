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
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { userId, taskId } = req.body;

    if (!userId || !taskId) {
      return res.status(400).json({ error: 'User ID and Task ID are required' });
    }

    const sql = neon(process.env.NEON_DB_URL);
    const db = drizzle(sql);

    // Check if task exists
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

    if (task.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const reward = task[0].reward;

    // Check if user has already completed the task
    const existingCompletion = await db.select()
      .from(taskCompletions)
      .where(and(eq(taskCompletions.userId, userId), eq(taskCompletions.taskId, taskId)))
      .limit(1);

    if (existingCompletion.length > 0) {
      return res.status(400).json({ error: 'Task already completed' });
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

    res.status(200).json({ message: 'Task completed successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Error completing task' });
  }
}