import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getPredictionService } from "./services/predictionService";
import { getUserPredictions } from "./db";
import { getMockRaces, getRandomMockRace, type MockRace } from "./services/mockRaceDataService";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  prediction: router({
    // Get mock races for testing
    getMockRaces: publicProcedure.query(() => {
      return getMockRaces();
    }),

    // Get a random mock race
    getRandomRace: publicProcedure.query(() => {
      return getRandomMockRace();
    }),

    // Get model information and performance metrics
    getModelInfo: publicProcedure.query(() => {
      const service = getPredictionService();
      return service.getModelInfo();
    }),

    // Predict rankings for a single race
    predictRace: publicProcedure
      .input(
        z.object({
          features: z.record(z.string(), z.number()),
          raceId: z.string().optional(),
          horseNames: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const service = getPredictionService();
        return service.predictRace(input);
      }),

    // Predict rankings for multiple races (batch)
    predictBatch: publicProcedure
      .input(
        z.array(
          z.object({
            features: z.record(z.string(), z.number()),
            raceId: z.string().optional(),
          })
        )
      )
      .mutation(async ({ input }) => {
        const service = getPredictionService();
        return service.predictBatch(input);
      }),

    // Get prediction history for authenticated user
    getHistory: protectedProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(50),
        })
      )
      .query(async ({ ctx, input }) => {
        return getUserPredictions(ctx.user.id, input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
