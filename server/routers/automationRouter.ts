/**
 * Automation Router
 * tRPC procedures for controlling and monitoring the automation system
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getAutomationService } from "../services/automationService";
import { getDb } from "../db";
import { automationRuns, raceResultsLog, automationStats } from "../../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export const automationRouter = router({
  /**
   * Start the automation system
   */
  start: protectedProcedure.mutation(async ({ ctx }) => {
    const automationService = getAutomationService();
    await automationService.setEnabled(true);

    return {
      success: true,
      message: "Automation started",
    };
  }),

  /**
   * Stop the automation system
   */
  stop: protectedProcedure.mutation(async ({ ctx }) => {
    const automationService = getAutomationService();
    automationService.stop();

    return {
      success: true,
      message: "Automation stopped",
    };
  }),

  /**
   * Get automation status
   */
  getStatus: publicProcedure.query(async () => {
    const automationService = getAutomationService();
    const status = await automationService.getStatus();

    return status;
  }),

  /**
   * Get live predictions (upcoming races with predictions)
   */
  getLivePredictions: publicProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { predictions: [], total: 0 };

      // Get recent predictions
      const predictions = await db
        .select()
        .from(automationRuns)
        .orderBy(desc(automationRuns.raceTime))
        .limit(input.limit)
        .offset(input.offset);

      // Parse predictions JSON
      const formattedPredictions = predictions.map((p) => ({
        id: p.id,
        raceId: p.raceId,
        raceName: p.raceName,
        trackName: p.trackName,
        raceTime: p.raceTime,
        topPick: p.topPick,
        topPickScore: p.topPickScore,
        ensembleScore: p.ensembleScore,
        predictions: p.predictions ? JSON.parse(p.predictions) : [],
        exoticPicks: p.exoticPicks ? JSON.parse(p.exoticPicks) : [],
        createdAt: p.createdAt,
      }));

      return {
        predictions: formattedPredictions,
        total: predictions.length,
      };
    }),

  /**
   * Get race results and accuracy
   */
  getRaceResults: publicProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { results: [], total: 0 };

      // Get recent results
      const results = await db
        .select()
        .from(raceResultsLog)
        .orderBy(desc(raceResultsLog.raceTime))
        .limit(input.limit)
        .offset(input.offset);

      // For each result, try to find the corresponding prediction
      const enrichedResults = await Promise.all(
        results.map(async (result) => {
          const prediction = await db
            .select()
            .from(automationRuns)
            .where(eq(automationRuns.raceId, result.raceId))
            .limit(1);

          const pred = prediction[0];
          const predictions = pred?.predictions ? JSON.parse(pred.predictions) : [];
          const placings = result.placings ? JSON.parse(result.placings) : [];

          // Calculate accuracy metrics
          const topPick = predictions[0];
          const topPickCorrect = topPick?.name === result.winner ? 1 : 0;
          const topPickPlaced = placings.some((p: any) => p.horseName === topPick?.name) ? 1 : 0;
          const topPickWinProbability = topPick?.winProbability || 0;

          // Calculate profit/loss
          const profitLoss = topPickCorrect ? Math.round((10 * (result.winningOdds! / 100 - 1)) * 100) : -1000;

          return {
            raceId: result.raceId,
            raceName: result.raceName,
            raceTime: result.raceTime,
            winner: result.winner,
            placings: placings,
            topPick: topPick?.name,
            topPickCorrect,
            topPickPlaced,
            topPickWinProbability,
            profitLoss,
            resultFetchedAt: result.resultFetchedAt,
          };
        })
      );

      return {
        results: enrichedResults,
        total: results.length,
      };
    }),

  /**
   * Get daily performance statistics
   */
  getDailyStats: publicProcedure
    .input(
      z.object({
        days: z.number().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { stats: [] };

      // Get stats for the last N days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const stats = await db
        .select()
        .from(automationStats)
        .where(gte(automationStats.date, startDate))
        .orderBy(desc(automationStats.date));

      return {
        stats: stats,
        summary: {
          totalRacesDetected: stats.reduce((sum, s) => sum + (s.totalRacesDetected || 0), 0),
          totalPredictionsGenerated: stats.reduce((sum, s) => sum + (s.totalPredictionsGenerated || 0), 0),
          totalResultsFetched: stats.reduce((sum, s) => sum + (s.totalResultsFetched || 0), 0),
          avgTopPickAccuracy:
            stats.length > 0
              ? Math.round(
                  (stats.reduce((sum, s) => sum + (s.topPickAccuracy || 0), 0) / stats.length) * 100
                ) / 100
              : 0,
          totalProfit: stats.reduce((sum, s) => sum + (s.totalProfit || 0), 0),
        },
      };
    }),

  /**
   * Get prediction accuracy for a specific race
   */
  getRacePredictionAccuracy: publicProcedure
    .input(
      z.object({
        raceId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Get prediction
      const prediction = await db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.raceId, input.raceId))
        .limit(1);

      if (!prediction.length) return null;

      // Get result
      const result = await db
        .select()
        .from(raceResultsLog)
        .where(eq(raceResultsLog.raceId, input.raceId))
        .limit(1);

      if (!result.length) {
        return {
          prediction: prediction[0],
          result: null,
          accuracy: null,
        };
      }

      const pred = prediction[0];
      const res = result[0];
      const predictions = pred.predictions ? JSON.parse(pred.predictions) : [];
      const placings = res.placings ? JSON.parse(res.placings) : [];

      const topPick = predictions[0];
      const topPickCorrect = topPick?.name === res.winner ? 1 : 0;
      const topPickPlaced = placings.some((p: any) => p.horseName === topPick?.name) ? 1 : 0;

      return {
        prediction: pred,
        result: res,
        accuracy: {
          topPickCorrect,
          topPickPlaced,
          topPickName: topPick?.name,
          winner: res.winner,
          topPickWinProbability: topPick?.winProbability || 0,
        },
      };
    }),

  /**
   * Get overall performance metrics
   */
  getPerformanceMetrics: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    // Get all predictions and results
    const predictions = await db.select().from(automationRuns);
    const results = await db.select().from(raceResultsLog);

    let topPickHits = 0;
    let topPickPlaces = 0;
    let totalProfit = 0;

    // Calculate accuracy for each prediction with a result
    for (const pred of predictions) {
      const result = results.find((r) => r.raceId === pred.raceId);
      if (!result) continue;

      const predictions_parsed = pred.predictions ? JSON.parse(pred.predictions) : [];
      const placings = result.placings ? JSON.parse(result.placings) : [];

      const topPick = predictions_parsed[0];
      if (topPick?.name === result.winner) {
        topPickHits++;
        totalProfit += Math.round((10 * (result.winningOdds! / 100 - 1)) * 100);
      } else {
        totalProfit -= 1000; // Lost $10
      }

      if (placings.some((p: any) => p.horseName === topPick?.name)) {
        topPickPlaces++;
      }
    }

    const completedRaces = predictions.filter((p) => results.some((r) => r.raceId === p.raceId)).length;

    return {
      totalPredictions: predictions.length,
      completedRaces,
      topPickAccuracy: completedRaces > 0 ? Math.round((topPickHits / completedRaces) * 10000) / 100 : 0,
      topPickPlaceAccuracy: completedRaces > 0 ? Math.round((topPickPlaces / completedRaces) * 10000) / 100 : 0,
      totalProfit,
      roi: completedRaces > 0 ? Math.round((totalProfit / (completedRaces * 1000)) * 10000) / 100 : 0,
    };
  }),
});
