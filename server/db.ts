import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, predictions, InsertPrediction, predictionStats, InsertPredictionStats } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserPredictions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get predictions: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(predictions)
      .where(eq(predictions.userId, userId))
      .orderBy(desc(predictions.createdAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get user predictions:", error);
    return [];
  }
}

export async function savePrediction(prediction: InsertPrediction) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save prediction: database not available");
    return;
  }

  try {
    await db.insert(predictions).values(prediction);
  } catch (error) {
    console.error("[Database] Failed to save prediction:", error);
    throw error;
  }
}

// Prediction History Functions

export async function savePredictionWithHistory(
  userId: number,
  raceId: string,
  raceName: string | undefined,
  raceDate: Date | undefined,
  horseName: string,
  predictedRank: number,
  predictedScore: string,
  confidenceScore: string,
  features: Record<string, number>
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save prediction: database not available");
    return;
  }

  try {
    const prediction: InsertPrediction = {
      userId,
      raceId,
      raceName,
      raceDate,
      horseName,
      predictedRank,
      predictedScore,
      confidenceScore,
      features: JSON.stringify(features),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(predictions).values(prediction);
  } catch (error) {
    console.error("[Database] Failed to save prediction:", error);
    throw error;
  }
}

export async function updatePredictionOutcome(
  predictionId: number,
  actualRank: number,
  isCorrect: boolean,
  raceOutcome?: Record<string, any>
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update prediction: database not available");
    return;
  }

  try {
    await db
      .update(predictions)
      .set({
        actualRank,
        isCorrect: isCorrect ? 1 : 0,
        raceOutcome: raceOutcome ? JSON.stringify(raceOutcome) : null,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(predictions.id, predictionId));
  } catch (error) {
    console.error("[Database] Failed to update prediction outcome:", error);
    throw error;
  }
}

export async function getUserPredictionStats(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get prediction stats: database not available");
    return null;
  }

  try {
    const result = await db
      .select()
      .from(predictionStats)
      .where(eq(predictionStats.userId, userId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get prediction stats:", error);
    return null;
  }
}

export async function updatePredictionStats(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update stats: database not available");
    return;
  }

  try {
    // Get all completed predictions for this user
    const userPredictions = await db
      .select()
      .from(predictions)
      .where(and(eq(predictions.userId, userId), eq(predictions.status, "completed")));

    const totalPredictions = userPredictions.length;
    const correctPredictions = userPredictions.filter((p) => p.isCorrect === 1).length;
    const accuracyPercentage =
      totalPredictions > 0 ? ((correctPredictions / totalPredictions) * 100).toFixed(2) : "0";

    // Calculate average confidence
    const confidenceScores = userPredictions
      .map((p) => parseFloat(p.confidenceScore || "0"))
      .filter((score) => !isNaN(score));
    const averageConfidence =
      confidenceScores.length > 0
        ? (confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length).toFixed(2)
        : "0";

    // Calculate streaks
    let bestStreak = 0;
    let currentStreak = 0;

    for (const pred of userPredictions) {
      if (pred.isCorrect === 1) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Upsert stats
    const existingStats = await getUserPredictionStats(userId);

    if (existingStats) {
      await db
        .update(predictionStats)
        .set({
          totalPredictions,
          correctPredictions,
          accuracyPercentage,
          averageConfidence,
          bestStreak,
          currentStreak,
          lastUpdated: new Date(),
        })
        .where(eq(predictionStats.userId, userId));
    } else {
      await db.insert(predictionStats).values({
        userId,
        totalPredictions,
        correctPredictions,
        accuracyPercentage,
        averageConfidence,
        bestStreak,
        currentStreak,
        createdAt: new Date(),
        lastUpdated: new Date(),
      });
    }
  } catch (error) {
    console.error("[Database] Failed to update prediction stats:", error);
    throw error;
  }
}

export async function getPredictionHistory(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get prediction history: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(predictions)
      .where(eq(predictions.userId, userId))
      .orderBy(desc(predictions.createdAt))
      .limit(limit);

    return result;
  } catch (error) {
    console.error("[Database] Failed to get prediction history:", error);
    return [];
  }
}
