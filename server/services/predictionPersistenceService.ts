/**
 * Prediction Persistence Service
 * Handles saving and retrieving automated predictions and race results from the database
 */

import { getDb } from "../db";
import {
  automationRuns,
  raceResultsLog,
  automationStats,
  type InsertAutomationRun,
  type InsertRaceResultsLog,
  type InsertAutomationStats,
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface StoredPrediction {
  raceId: string;
  raceName: string;
  trackName: string;
  raceTime: Date;
  predictions: Array<{
    horseName: string;
    score: number;
    rank: number;
    winProb: number;
  }>;
  topPick: string;
  topPickScore: number;
  exoticPicks: Array<{
    type: string;
    horses: string[];
    probability: number;
    ev: number;
  }>;
  ensembleScore: number;
}

export interface StoredResult {
  raceId: string;
  raceName: string;
  raceTime: Date;
  winner: string;
  placings: Array<{
    position: number;
    horseName: string;
    number?: number;
  }>;
  winningOdds: number;
  resultStatus: string;
}

export interface PredictionAccuracy {
  raceId: string;
  topPickCorrect: boolean;
  topPickInPlace: boolean;
  exactaHit: boolean;
  trifectaHit: boolean;
  superfectaHit: boolean;
  profitLoss: number;
  roi: number;
}

class PredictionPersistenceService {
  /**
   * Save a prediction to the database
   */
  async savePrediction(prediction: StoredPrediction): Promise<void> {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return;
    }

    try {
      const data: InsertAutomationRun = {
        raceId: prediction.raceId,
        raceName: prediction.raceName,
        trackName: prediction.trackName,
        raceTime: prediction.raceTime,
        predictions: JSON.stringify(prediction.predictions),
        topPick: prediction.topPick,
        topPickScore: prediction.topPickScore,
        exoticPicks: JSON.stringify(prediction.exoticPicks),
        ensembleScore: prediction.ensembleScore,
      };

      await db.insert(automationRuns).values(data);
      console.log(`[PersistenceService] Saved prediction for race ${prediction.raceId}`);
    } catch (error) {
      console.error("[PersistenceService] Error saving prediction:", error);
      throw error;
    }
  }

  /**
   * Save a race result to the database
   */
  async saveResult(result: StoredResult): Promise<void> {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return;
    }

    try {
      const data: InsertRaceResultsLog = {
        raceId: result.raceId,
        raceName: result.raceName,
        raceTime: result.raceTime,
        winner: result.winner,
        placings: JSON.stringify(result.placings),
        winningOdds: result.winningOdds,
        resultStatus: result.resultStatus,
        resultFetchedAt: new Date(),
      };

      await db
        .insert(raceResultsLog)
        .values(data)
        .onDuplicateKeyUpdate({
          set: {
            winner: result.winner,
            placings: JSON.stringify(result.placings),
            winningOdds: result.winningOdds,
            resultStatus: result.resultStatus,
            resultFetchedAt: new Date(),
          },
        });

      console.log(`[PersistenceService] Saved result for race ${result.raceId}: ${result.winner}`);
    } catch (error) {
      console.error("[PersistenceService] Error saving result:", error);
      throw error;
    }
  }

  /**
   * Get prediction for a race
   */
  async getPrediction(raceId: string): Promise<StoredPrediction | null> {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return null;
    }

    try {
      const results = await db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.raceId, raceId))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      const row = results[0];
      return {
        raceId: row.raceId,
        raceName: row.raceName || "",
        trackName: row.trackName || "",
        raceTime: row.raceTime,
        predictions: row.predictions ? JSON.parse(row.predictions) : [],
        topPick: row.topPick || "",
        topPickScore: row.topPickScore || 0,
        exoticPicks: row.exoticPicks ? JSON.parse(row.exoticPicks) : [],
        ensembleScore: row.ensembleScore || 0,
      };
    } catch (error) {
      console.error("[PersistenceService] Error getting prediction:", error);
      return null;
    }
  }

  /**
   * Get result for a race
   */
  async getResult(raceId: string): Promise<StoredResult | null> {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return null;
    }

    try {
      const results = await db
        .select()
        .from(raceResultsLog)
        .where(eq(raceResultsLog.raceId, raceId))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      const row = results[0];
      return {
        raceId: row.raceId,
        raceName: row.raceName || "",
        raceTime: row.raceTime,
        winner: row.winner || "",
        placings: row.placings ? JSON.parse(row.placings) : [],
        winningOdds: row.winningOdds || 0,
        resultStatus: row.resultStatus || "pending",
      };
    } catch (error) {
      console.error("[PersistenceService] Error getting result:", error);
      return null;
    }
  }

  /**
   * Get all predictions for a date range
   */
  async getPredictionsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<StoredPrediction[]> {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return [];
    }

    try {
      const results = await db
        .select()
        .from(automationRuns)
        .where(
          and(
            gte(automationRuns.raceTime, startDate),
            lte(automationRuns.raceTime, endDate)
          )
        )
        .orderBy(desc(automationRuns.raceTime));

      return results.map((row) => ({
        raceId: row.raceId,
        raceName: row.raceName || "",
        trackName: row.trackName || "",
        raceTime: row.raceTime,
        predictions: row.predictions ? JSON.parse(row.predictions) : [],
        topPick: row.topPick || "",
        topPickScore: row.topPickScore || 0,
        exoticPicks: row.exoticPicks ? JSON.parse(row.exoticPicks) : [],
        ensembleScore: row.ensembleScore || 0,
      }));
    } catch (error) {
      console.error("[PersistenceService] Error getting predictions by date range:", error);
      return [];
    }
  }

  /**
   * Get all results for a date range
   */
  async getResultsByDateRange(startDate: Date, endDate: Date): Promise<StoredResult[]> {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return [];
    }

    try {
      const results = await db
        .select()
        .from(raceResultsLog)
        .where(
          and(
            gte(raceResultsLog.raceTime, startDate),
            lte(raceResultsLog.raceTime, endDate)
          )
        )
        .orderBy(desc(raceResultsLog.raceTime));

      return results.map((row) => ({
        raceId: row.raceId,
        raceName: row.raceName || "",
        raceTime: row.raceTime,
        winner: row.winner || "",
        placings: row.placings ? JSON.parse(row.placings) : [],
        winningOdds: row.winningOdds || 0,
        resultStatus: row.resultStatus || "pending",
      }));
    } catch (error) {
      console.error("[PersistenceService] Error getting results by date range:", error);
      return [];
    }
  }

  /**
   * Calculate prediction accuracy by comparing prediction to result
   */
  calculateAccuracy(prediction: StoredPrediction, result: StoredResult): PredictionAccuracy {
    const topPickCorrect = prediction.topPick.toLowerCase() === result.winner.toLowerCase();

    // Check if top pick is in placings
    const topPickInPlace =
      topPickCorrect ||
      result.placings.some(
        (p) => p.horseName.toLowerCase() === prediction.topPick.toLowerCase()
      );

    // Check exotic hits
    const winnerNumber = result.placings.find(
      (p) => p.horseName.toLowerCase() === result.winner.toLowerCase()
    )?.number;

    const exactaHit =
      prediction.exoticPicks.some((pick) => {
        if (pick.type !== "exacta" || pick.horses.length < 2) return false;
        const first = pick.horses[0].toLowerCase();
        const second = pick.horses[1].toLowerCase();
        const placingFirst = result.placings[0]?.horseName.toLowerCase();
        const placingSecond = result.placings[1]?.horseName.toLowerCase();
        return first === placingFirst && second === placingSecond;
      }) || false;

    const trifectaHit =
      prediction.exoticPicks.some((pick) => {
        if (pick.type !== "trifecta" || pick.horses.length < 3) return false;
        const first = pick.horses[0].toLowerCase();
        const second = pick.horses[1].toLowerCase();
        const third = pick.horses[2].toLowerCase();
        const placingFirst = result.placings[0]?.horseName.toLowerCase();
        const placingSecond = result.placings[1]?.horseName.toLowerCase();
        const placingThird = result.placings[2]?.horseName.toLowerCase();
        return first === placingFirst && second === placingSecond && third === placingThird;
      }) || false;

    const superfectaHit =
      prediction.exoticPicks.some((pick) => {
        if (pick.type !== "superfecta" || pick.horses.length < 4) return false;
        const first = pick.horses[0].toLowerCase();
        const second = pick.horses[1].toLowerCase();
        const third = pick.horses[2].toLowerCase();
        const fourth = pick.horses[3].toLowerCase();
        const placingFirst = result.placings[0]?.horseName.toLowerCase();
        const placingSecond = result.placings[1]?.horseName.toLowerCase();
        const placingThird = result.placings[2]?.horseName.toLowerCase();
        const placingFourth = result.placings[3]?.horseName.toLowerCase();
        return (
          first === placingFirst &&
          second === placingSecond &&
          third === placingThird &&
          fourth === placingFourth
        );
      }) || false;

    // Calculate profit/loss (assuming $10 bet on top pick at winning odds)
    const profitLoss = topPickCorrect ? 10 * (result.winningOdds - 1) : -10;
    const roi = topPickCorrect ? ((result.winningOdds - 1) * 100).toFixed(2) : "-100";

    return {
      raceId: prediction.raceId,
      topPickCorrect,
      topPickInPlace,
      exactaHit,
      trifectaHit,
      superfectaHit,
      profitLoss,
      roi: parseFloat(roi as string),
    };
  }

  /**
   * Save daily automation statistics
   */
  async saveDailyStats(stats: InsertAutomationStats): Promise<void> {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return;
    }

    try {
      await db
        .insert(automationStats)
        .values(stats)
        .onDuplicateKeyUpdate({
          set: stats,
        });

      console.log("[PersistenceService] Saved daily automation statistics");
    } catch (error) {
      console.error("[PersistenceService] Error saving daily stats:", error);
      throw error;
    }
  }

  /**
   * Get daily stats for a specific date
   */
  async getDailyStats(date: Date) {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return null;
    }

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const results = await db
        .select()
        .from(automationStats)
        .where(
          and(gte(automationStats.date, startOfDay), lte(automationStats.date, endOfDay))
        )
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error("[PersistenceService] Error getting daily stats:", error);
      return null;
    }
  }

  /**
   * Get stats for last N days
   */
  async getStatsForLastDays(days: number) {
    const db = await getDb();
    if (!db) {
      console.warn("[PersistenceService] Database not available");
      return [];
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const results = await db
        .select()
        .from(automationStats)
        .where(gte(automationStats.date, startDate))
        .orderBy(desc(automationStats.date));

      return results;
    } catch (error) {
      console.error("[PersistenceService] Error getting stats for last days:", error);
      return [];
    }
  }
}

// Singleton instance
let persistenceService: PredictionPersistenceService | null = null;

export function getPredictionPersistenceService(): PredictionPersistenceService {
  if (!persistenceService) {
    persistenceService = new PredictionPersistenceService();
  }
  return persistenceService;
}
