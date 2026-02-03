import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getPredictionService } from "./services/predictionService";
import { getUserPredictions, savePredictionWithHistory, getUserPredictionStats, updatePredictionOutcome, updatePredictionStats } from "./db";
import { getMockRaces, getRandomMockRace, type MockRace } from "./services/mockRaceDataService";
import { getLiveRaceDataService, type LiveRace } from "./services/liveRaceDataService";
import { exoticBetOptimizer } from "./services/exoticBetOptimizer";
import {
  getSubscriptionPlans,
  createCheckoutSession,
  getUserSubscription,
  getPredictionUsage,
  canMakePrediction,
  logPredictionUsage,
} from "./services/subscriptionService";
import { automationRouter } from "./routers/automationRouter";

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

    // Get predictions with win probabilities for all horses in a race
    getRaceHorsePredictions: publicProcedure
      .input(
        z.object({
          raceId: z.string(),
          horses: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              weight: z.string().optional(),
              jockey: z.string().optional(),
              trainer: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const service = getPredictionService();
        // Create feature vectors for each horse
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
        
        // Convert scores to win probabilities (softmax)
        const scores = firstResult?.predictions?.map(p => p.score) || [];
        const maxScore = Math.max(...scores);
        const expScores = scores.map(s => Math.exp(s - maxScore));
        const sumExp = expScores.reduce((a, b) => a + b, 0);
        const probabilities = expScores.map(exp => exp / sumExp);
        
        // Return horses with win probabilities
        const horsesWithPredictions = input.horses.map((horse, idx) => ({
          ...horse,
          score: firstResult?.predictions[idx]?.score || 0,
          rank: firstResult?.predictions[idx]?.rank || idx + 1,
          winProbability: probabilities[idx] || 0,
        })).sort((a, b) => b.score - a.score);
        
        return {
          raceId: input.raceId,
          horses: horsesWithPredictions,
          ensembleScore: firstResult?.ensembleScore || 0,
        };
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

    // Save a prediction to history
    savePredictionHistory: protectedProcedure
      .input(
        z.object({
          raceId: z.string(),
          raceName: z.string().optional(),
          raceDate: z.date().optional(),
          horseName: z.string(),
          predictedRank: z.number(),
          predictedScore: z.string(),
          confidenceScore: z.string(),
          features: z.record(z.string(), z.number()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await savePredictionWithHistory(
          ctx.user.id,
          input.raceId,
          input.raceName,
          input.raceDate,
          input.horseName,
          input.predictedRank,
          input.predictedScore,
          input.confidenceScore,
          input.features
        );
        return { success: true };
      }),

    // Get prediction statistics for authenticated user
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return getUserPredictionStats(ctx.user.id);
    }),

    // Update prediction outcome
    updateOutcome: protectedProcedure
      .input(
        z.object({
          predictionId: z.number(),
          actualRank: z.number(),
          isCorrect: z.boolean(),
          raceOutcome: z.record(z.string(), z.any()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updatePredictionOutcome(
          input.predictionId,
          input.actualRank,
          input.isCorrect,
          input.raceOutcome
        );
        // Recalculate stats after updating outcome
        await updatePredictionStats(ctx.user.id);
        return { success: true };
      }),
  }),

  exoticBets: router({
    optimizeRace: publicProcedure
      .input(
        z.object({
          raceId: z.string(),
          horses: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              winProbability: z.number(),
              odds: z.number(),
              formRating: z.number().optional(),
              speedRating: z.number().optional(),
              classRating: z.number().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        return exoticBetOptimizer.optimize(input.raceId, input.horses);
      }),
  }),

  subscription: router({
    // Get all available subscription plans
    getPlans: publicProcedure.query(async () => {
      return getSubscriptionPlans();
    }),

    // Get current user's subscription
    getCurrentSubscription: protectedProcedure.query(async ({ ctx }) => {
      return getUserSubscription(ctx.user.id);
    }),

    // Get user's prediction usage
    getPredictionUsage: protectedProcedure.query(async ({ ctx }) => {
      return getPredictionUsage(ctx.user.id);
    }),

    // Create a checkout session
    createCheckout: protectedProcedure
      .input(
        z.object({
          planId: z.number(),
          successUrl: z.string(),
          cancelUrl: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const session = await createCheckoutSession(
          ctx.user.id,
          input.planId,
          input.successUrl,
          input.cancelUrl
        );
        return { sessionId: session.id, url: session.url };
      }),

    // Check if user can make a prediction
    canMakePrediction: protectedProcedure.query(async ({ ctx }) => {
      const can = await canMakePrediction(ctx.user.id);
      const usage = await getPredictionUsage(ctx.user.id);
      return { canMake: can, usage };
    }),

    // Log a prediction usage (called after successful prediction)
    logPredictionUsage: protectedProcedure
      .input(z.object({ count: z.number().default(1) }))
      .mutation(async ({ ctx, input }) => {
        await logPredictionUsage(ctx.user.id, input.count);
        return { success: true };
      }),
  }),

  automation: automationRouter,
});

export type AppRouter = typeof appRouter;
