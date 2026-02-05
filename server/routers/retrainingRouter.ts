/**
 * Retraining Router
 * tRPC procedures for managing automated retraining jobs and monitoring
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getAutomatedRetrainingService } from "../services/automatedRetrainingService";
import { getDriftIntegrationService } from "../services/driftIntegrationService";
import { getModelComparisonService } from "../services/modelComparisonService";

export const retrainingRouter = router({
  /**
   * Check if models need retraining
   */
  checkRetrainingNeeds: publicProcedure.query(async () => {
    try {
      const retrainingService = getAutomatedRetrainingService();
      const needs = retrainingService.checkRetrainingNeeds();

      return {
        success: true,
        modelsNeedingRetrain: needs.modelsNeedingRetrain,
        reasons: needs.reasons,
        shouldRetrain: needs.modelsNeedingRetrain.length > 0,
      };
    } catch (error) {
      console.error("[RetrainingRouter] Error checking retraining needs:", error);
      throw error;
    }
  }),

  /**
   * Queue a manual retraining job
   */
  queueRetrainingJob: protectedProcedure
    .input(
      z.object({
        modelId: z.string(),
        reason: z.enum(["drift_detected", "performance_degradation", "scheduled", "manual"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Only allow admin users
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      try {
        const retrainingService = getAutomatedRetrainingService();
        const job = retrainingService.queueRetrainingJob(input.modelId, input.reason);

        return {
          success: true,
          jobId: job.jobId,
          message: `Queued retraining job for model ${input.modelId}`,
        };
      } catch (error) {
        console.error("[RetrainingRouter] Error queuing retraining job:", error);
        throw error;
      }
    }),

  /**
   * Get retraining job status
   */
  getJobStatus: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      try {
        const retrainingService = getAutomatedRetrainingService();
        const job = retrainingService.getJobStatus(input.jobId);

        if (!job) {
          return {
            success: false,
            message: `Job ${input.jobId} not found`,
          };
        }

        return {
          success: true,
          job,
        };
      } catch (error) {
        console.error("[RetrainingRouter] Error getting job status:", error);
        throw error;
      }
    }),

  /**
   * Get active retraining jobs
   */
  getActiveJobs: publicProcedure.query(async () => {
    try {
      const retrainingService = getAutomatedRetrainingService();
      const jobs = retrainingService.getActiveJobs();

      return {
        success: true,
        jobs,
        count: jobs.length,
      };
    } catch (error) {
      console.error("[RetrainingRouter] Error getting active jobs:", error);
      throw error;
    }
  }),

  /**
   * Get queue status
   */
  getQueueStatus: publicProcedure.query(async () => {
    try {
      const retrainingService = getAutomatedRetrainingService();
      const status = retrainingService.getQueueStatus();

      return {
        success: true,
        ...status,
      };
    } catch (error) {
      console.error("[RetrainingRouter] Error getting queue status:", error);
      throw error;
    }
  }),

  /**
   * Get retraining statistics
   */
  getStatistics: publicProcedure.query(async () => {
    try {
      const retrainingService = getAutomatedRetrainingService();
      const stats = retrainingService.getStatistics();

      return {
        success: true,
        ...stats,
      };
    } catch (error) {
      console.error("[RetrainingRouter] Error getting statistics:", error);
      throw error;
    }
  }),

  /**
   * Get drift summary
   */
  getDriftSummary: publicProcedure.query(async () => {
    try {
      const driftService = getDriftIntegrationService();
      const summary = driftService.getDriftSummary();

      return {
        success: true,
        ...summary,
      };
    } catch (error) {
      console.error("[RetrainingRouter] Error getting drift summary:", error);
      throw error;
    }
  }),

  /**
   * Get NDCG trend for a model
   */
  getNDCGTrend: publicProcedure
    .input(z.object({ modelId: z.string() }))
    .query(async ({ input }) => {
      try {
        const driftService = getDriftIntegrationService();
        const trend = driftService.calculateNDCGTrend(input.modelId);

        return {
          success: true,
          ...trend,
        };
      } catch (error) {
        console.error("[RetrainingRouter] Error getting NDCG trend:", error);
        throw error;
      }
    }),

  /**
   * Promote A/B test winner to production
   */
  promoteABTestWinner: protectedProcedure
    .input(z.object({ testId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Only allow admin users
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      try {
        const retrainingService = getAutomatedRetrainingService();
        const result = retrainingService.promoteABTestWinner(input.testId);

        return result;
      } catch (error) {
        console.error("[RetrainingRouter] Error promoting A/B test winner:", error);
        throw error;
      }
    }),

  /**
   * Start automated retraining service
   */
  startRetrainingService: protectedProcedure.mutation(async ({ ctx }) => {
    // Only allow admin users
    if (ctx.user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    try {
      const retrainingService = getAutomatedRetrainingService();
      retrainingService.start();

      return {
        success: true,
        message: "Automated retraining service started",
      };
    } catch (error) {
      console.error("[RetrainingRouter] Error starting retraining service:", error);
      throw error;
    }
  }),

  /**
   * Stop automated retraining service
   */
  stopRetrainingService: protectedProcedure.mutation(async ({ ctx }) => {
    // Only allow admin users
    if (ctx.user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    try {
      const retrainingService = getAutomatedRetrainingService();
      retrainingService.stop();

      return {
        success: true,
        message: "Automated retraining service stopped",
      };
    } catch (error) {
      console.error("[RetrainingRouter] Error stopping retraining service:", error);
      throw error;
    }
  }),
});
