/**
 * Outcome Router
 * tRPC procedures for outcome validation, accuracy tracking, and model comparison
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getOutcomeValidationService } from "../services/outcomeValidationService";
import { getModelComparisonService } from "../services/modelComparisonService";
import { getLiveRaceDataService } from "../services/liveRaceDataService";
import { getDb } from "../db";
import { predictions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const outcomeRouter = router({
  /**
   * Validate predictions against race results
   * Fetches actual race outcomes and calculates accuracy metrics
   */
  validatePredictions: protectedProcedure
    .input(
      z.object({
        raceDate: z.string().default("today"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const validationService = getOutcomeValidationService();
        const raceService = getLiveRaceDataService();
        const db = await getDb();

        if (!db) {
          throw new Error("Database not available");
        }

        // Fetch race results from The Racing API
        const raceResults = await raceService.getRaceResults(input.raceDate);

        if (raceResults.length === 0) {
          return {
            success: false,
            message: "No race results found for the specified date",
            validations: [],
            metrics: null,
          };
        }

        // Get user's predictions for the date
        const userPredictions = await db
          .select()
          .from(predictions)
          .where(eq(predictions.userId, ctx.user.id))
          .limit(100);

        // Validate predictions against results
        const validationMap = validationService.matchPredictionsToResults(
          userPredictions,
          raceResults
        );

        // Calculate metrics
        const validations = Array.from(validationMap.values());
        const metrics = validationService.calculateMetrics(validations as any);

        // Update predictions in database with outcomes
        for (const [predId, validation] of Array.from(validationMap.entries())) {
          await db
            .update(predictions)
            .set({
              actualRank: validation.actualRank,
              isCorrect: validation.isCorrect ? 1 : 0,
              accuracy: validation.accuracy,
              status: "completed",
              updatedAt: new Date(),
            })
            .where(eq(predictions.id, predId));
        }

        return {
          success: true,
          message: `Validated ${validations.length} predictions`,
          validations,
          metrics,
          raceCount: raceResults.length,
        };
      } catch (error) {
        console.error("[OutcomeRouter] Error validating predictions:", error);
        throw error;
      }
    }),

  /**
   * Get accuracy metrics for a user
   */
  getAccuracyMetrics: protectedProcedure
    .input(
      z.object({
        days: z.number().default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - input.days);

        // Get user's completed predictions
        const userPredictions = await db
          .select()
          .from(predictions)
          .where(eq(predictions.userId, ctx.user.id))
          .limit(1000);

        const completedPredictions = userPredictions.filter(
          (p) => p.status === "completed" && p.actualRank !== null
        );

        if (completedPredictions.length === 0) {
          return {
            totalPredictions: 0,
            correctPredictions: 0,
            partialPredictions: 0,
            winAccuracy: 0,
            placeAccuracy: 0,
            showAccuracy: 0,
            ndcgAt3: 0,
            ndcgAt5: 0,
            averageConfidence: 0,
            totalROI: 0,
          };
        }

        // Calculate metrics from completed predictions
        const validationService = getOutcomeValidationService();
        const validations = completedPredictions.map((p) => ({
          predictionId: p.id,
          horseName: p.horseName,
          predictedRank: p.predictedRank,
          actualRank: p.actualRank || undefined,
          isCorrect: p.isCorrect === 1,
          accuracy: (p.accuracy as "correct" | "partial" | "incorrect") || "incorrect",
          ndcgScore: p.accuracy === "correct" ? 1.0 : p.accuracy === "partial" ? 0.5 : 0.0,
          winAccuracy: p.predictedRank === 1 && p.actualRank === 1 ? true : false,
          placeAccuracy: p.predictedRank <= 3 && p.actualRank && p.actualRank <= 3 ? true : false,
          showAccuracy: p.predictedRank <= 5 && p.actualRank && p.actualRank <= 5 ? true : false,
          roi: undefined,
        })) as any;

        const metrics = validationService.calculateMetrics(validations as any);

        return metrics;
      } catch (error) {
        console.error("[OutcomeRouter] Error getting accuracy metrics:", error);
        throw error;
      }
    }),

  /**
   * Get model performance metrics
   */
  getModelMetrics: publicProcedure.query(async () => {
    try {
      const modelService = getModelComparisonService();
      const models = modelService.getAllModelMetrics();

      return {
        models,
        summary: modelService.getPerformanceSummary(),
      };
    } catch (error) {
      console.error("[OutcomeRouter] Error getting model metrics:", error);
      throw error;
    }
  }),

  /**
   * Get model weights for ensemble
   */
  getModelWeights: publicProcedure.query(async () => {
    try {
      const modelService = getModelComparisonService();
      const weights = modelService.getModelWeights();

      return {
        weights,
        total: weights.reduce((sum, w) => sum + w.weight, 0),
      };
    } catch (error) {
      console.error("[OutcomeRouter] Error getting model weights:", error);
      throw error;
    }
  }),

  /**
   * Get drift alerts
   */
  getDriftAlerts: publicProcedure.query(async () => {
    try {
      const modelService = getModelComparisonService();
      const alerts = modelService.getActiveDriftAlerts();
      const criticalAlerts = modelService.getCriticalDriftAlerts();

      return {
        allAlerts: alerts,
        criticalAlerts,
        shouldRetrain: modelService.shouldRetrain(),
        recommendation: modelService.getRetrainingRecommendation(),
      };
    } catch (error) {
      console.error("[OutcomeRouter] Error getting drift alerts:", error);
      throw error;
    }
  }),

  /**
   * Get A/B test results
   */
  getABTests: publicProcedure.query(async () => {
    try {
      const modelService = getModelComparisonService();
      const activeTests = modelService.getActiveABTests();

      return {
        activeTests,
        count: activeTests.length,
      };
    } catch (error) {
      console.error("[OutcomeRouter] Error getting A/B tests:", error);
      throw error;
    }
  }),

  /**
   * Update model metrics (admin only)
   */
  updateModelMetrics: protectedProcedure
    .input(
      z.object({
        modelId: z.string(),
        ndcgAt3: z.number().optional(),
        ndcgAt5: z.number().optional(),
        winAccuracy: z.number().optional(),
        placeAccuracy: z.number().optional(),
        showAccuracy: z.number().optional(),
        roi: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Only allow admin users to update metrics
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      try {
        const modelService = getModelComparisonService();
        const updateData = {
          modelName: input.modelId,
          version: "1.0.0",
          totalPredictions: 0,
          correctPredictions: 0,
          averageConfidence: 0,
          ...input,
          lastUpdated: new Date(),
        };
        modelService.updateModelMetrics(input.modelId, updateData as any);

        return {
          success: true,
          message: `Updated metrics for model ${input.modelId}`,
        };
      } catch (error) {
        console.error("[OutcomeRouter] Error updating model metrics:", error);
        throw error;
      }
    }),

  /**
   * Adjust model weights based on performance
   */
  adjustWeights: protectedProcedure.mutation(async ({ ctx }) => {
    // Only allow admin users
    if (ctx.user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    try {
      const modelService = getModelComparisonService();
      modelService.adjustWeightsBasedOnPerformance();

      return {
        success: true,
        weights: modelService.getModelWeights(),
        message: "Model weights adjusted based on performance",
      };
    } catch (error) {
      console.error("[OutcomeRouter] Error adjusting weights:", error);
      throw error;
    }
  }),
});
