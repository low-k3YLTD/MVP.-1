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
      const automationService = getAutomationService();
      return automationService.getLivePredictions(input.limit, input.offset);
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
      const automationService = getAutomationService();
      const results = await automationService.getRaceResults(input.limit, input.offset);
      
      // Enrich results with prediction accuracy
      const enrichedResults = results.results.map((result: any) => ({
        ...result,
        topPickCorrect: 0,
        topPickPlaced: 0,
        topPickWinProbability: 0,
        profitLoss: 0,
      }));

      return {
        results: enrichedResults,
        total: results.total,
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
    const automationService = getAutomationService();
    return automationService.getPerformanceMetrics();
  }),
});
