import { tasks, taskCompletions, userBalances } from '../drizzle/schema.js';
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

    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
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
      .where(eq(taskCompletions.userId, user.id), eq(taskCompletions.taskId, taskId))
      .limit(1);

    if (existingCompletion.length > 0) {
      return res.status(400).json({ error: 'Task already completed' });
    }

    // Insert task completion record
    await db.insert(taskCompletions).values({
      userId: user.id,
      taskId: taskId,
    });

    // Update user balance
    const userBalance = await db.select()
      .from(userBalances)
      .where(eq(userBalances.userId, user.id))
      .limit(1);

    if (userBalance.length === 0) {
      // Create new balance record
      await db.insert(userBalances).values({
        userId: user.id,
        balance: reward,
      });
    } else {
      // Update existing balance
      const newBalance = parseFloat(userBalance[0].balance) + parseFloat(reward);
      await db.update(userBalances)
        .set({ balance: newBalance })
        .where(eq(userBalances.userId, user.id));
    }

    res.status(200).json({ message: 'Task completed successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error completing task:', error);
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      res.status(401).json({ error: 'Authentication failed' });
    } else {
      res.status(500).json({ error: 'Error completing task' });
    }
  }
}