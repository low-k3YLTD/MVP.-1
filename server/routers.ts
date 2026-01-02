import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getPredictionService } from "./services/predictionService";
import { getUserPredictions } from "./db";
import { getMockRaces, getRandomMockRace, type MockRace } from "./services/mockRaceDataService";
import { getLiveRaceDataService, type LiveRace } from "./services/liveRaceDataService";

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

    // Get upcoming live races
    getUpcomingRaces: publicProcedure
      .input(
        z.object({
          provider: z.enum(["racing-api", "rapidapi", "auto"]).default("auto"),
        }).optional()
      )
      .query(async ({ input }) => {
        const service = getLiveRaceDataService();
        const provider = input?.provider || "auto";
        return service.getUpcomingRaces(provider);
      }),

    // Get live races by country
    getLiveRacesByCountry: publicProcedure
      .input(z.object({ country: z.string() }))
      .query(async ({ input }) => {
        const service = getLiveRaceDataService();
        return service.getRacesByCountry(input.country);
      }),

    // Get live races by track
    getLiveRacesByTrack: publicProcedure
      .input(z.object({ track: z.string() }))
      .query(async ({ input }) => {
        const service = getLiveRaceDataService();
        return service.getRacesByTrack(input.track);
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

    // Predict rankings for a live race with horse data
    predictLiveRace: publicProcedure
      .input(
        z.object({
          raceId: z.string(),
          horses: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              number: z.number(),
              jockey: z.string().optional(),
              trainer: z.string().optional(),
              weight: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const service = getPredictionService();
        const predictions = input.horses.map((horse) => ({
          features: {
            horse_age: 4 + Math.random() * 8,
            jockey_experience: 50 + Math.random() * 150,
            trainer_wins: 20 + Math.random() * 100,
            recent_form: Math.floor(Math.random() * 5),
            distance_preference: 1200 + Math.random() * 2000,
            track_preference: 0.5 + Math.random() * 0.5,
            weight: parseInt(horse.weight?.replace(/[^0-9]/g, '') || '140'),
          },
          raceId: input.raceId,
        }));
        const results = await service.predictBatch(predictions);
        const firstResult = results[0];
        const rankedHorses = input.horses.map((horse, idx) => {
          const pred = firstResult?.predictions[idx];
          return { ...horse, score: pred?.score || 0, rank: pred?.rank || idx + 1 };
        }).sort((a, b) => b.score - a.score);
        return { raceId: input.raceId, horses: rankedHorses, ensembleScore: firstResult?.ensembleScore || 0 };
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
