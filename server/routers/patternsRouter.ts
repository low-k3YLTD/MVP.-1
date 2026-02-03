import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { WorkflowEventService } from "../services/workflowEventService";
import { PatternRecognitionService } from "../services/patternRecognitionEngine";

export const patternsRouter = router({
  analyzeWorkflows: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);
        const events = await WorkflowEventService.getEvents(ctx.user.id, { startDate, limit: 100 });
        
        if (events.length === 0) {
          return {
            correlations: [],
            anomalies: [],
            trends: [],
            patterns: [],
            blindSpots: [],
            summary: "No workflow events found for analysis",
          };
        }

        const formattedEvents = events.map((e: any) => ({
          id: e.id,
          userId: e.userId,
          eventType: e.eventType,
          eventName: e.eventName,
          metrics: e.metrics ? JSON.parse(e.metrics) : undefined,
          createdAt: e.createdAt,
        }));

        return PatternRecognitionService.analyzeWorkflows(formattedEvents);
      } catch (error) {
        console.error("[Pattern Analysis] Error:", error);
        return {
          correlations: [],
          anomalies: [],
          trends: [],
          patterns: [],
          blindSpots: [],
          summary: "Error analyzing workflows",
        };
      }
    }),

  getEventStats: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(7) }))
    .query(async ({ ctx, input }) => {
      return WorkflowEventService.getEventStats(ctx.user.id, input.days);
    }),

  getEvents: protectedProcedure
    .input(z.object({ eventType: z.string().optional(), limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      return WorkflowEventService.getEvents(ctx.user.id, {
        eventType: input.eventType,
        limit: input.limit,
      });
    }),

  logEvent: protectedProcedure
    .input(
      z.object({
        eventType: z.enum(["calibration", "training", "prompt", "prediction", "modeling", "development", "outcome"]),
        eventName: z.string(),
        description: z.string().optional(),
        metrics: z.record(z.string(), z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const eventId = await WorkflowEventService.logEvent({
          userId: ctx.user.id,
          eventType: input.eventType,
          eventName: input.eventName,
          description: input.description,
          metrics: input.metrics,
        });
        return { success: true, eventId };
      } catch (error) {
        console.error("[Log Event] Error:", error);
        throw error;
      }
    }),
});
