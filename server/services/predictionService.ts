import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import { TRPCError } from '@trpc/server';
import { getEnsemblePredictionService, HorseFeatures } from './ensemblePredictionService';
import { getAdvancedEnsembleService } from './advancedEnsembleService';
import { getPredictionCache } from './predictionCacheService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PredictionService manages the ensemble prediction models.
 * Models are loaded once and cached for performance.
 */

interface PredictionInput {
  features: Record<string, number>;
  raceId?: string;
  horseNames?: string[];
}

interface PredictionResult {
  raceId: string;
  predictions: Array<{
    horseName: string;
    score: number;
    rank: number;
  }>;
  ensembleScore: number;
  timestamp: Date;
}

class PredictionService {
  private modelsLoaded = false;
  private modelPath: string;

  constructor() {
    try {
      this.modelPath = path.join(__dirname, '../models');
    } catch (error) {
      // Fallback for browser/client context
      this.modelPath = '/models';
    }
    this.ensureModelsExist();
  }

  private ensureModelsExist(): void {
    if (!fs.existsSync(this.modelPath)) {
      console.warn(`Models directory not found at ${this.modelPath}`);
      return;
    }

    const requiredModels = ['lightgbm_ranker_large.pkl'];
    for (const model of requiredModels) {
      const modelFile = path.join(this.modelPath, model);
      if (!fs.existsSync(modelFile)) {
        console.warn(`Model not found: ${modelFile}, will use mock predictions`);
      }
    }
  }

  /**
   * Predict rankings for a single race using the advanced ensemble model.
   */
  async predictRace(input: PredictionInput): Promise<PredictionResult> {
    try {
      // Validate input
      if (!input.features || Object.keys(input.features).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Race features are required for prediction',
        });
      }

      const raceId = input.raceId || `race_${Date.now()}`;
      const horseNames = input.horseNames || Object.keys(input.features).map((_, i) => `Horse_${i + 1}`);

      // Check cache first
      const cache = getPredictionCache();
      const raceData = { features: input.features, horseNames };
      const cachedResult = await cache.get(raceId, raceData);
      
      if (cachedResult) {
        console.log(`[PredictionService] Cache hit for race ${raceId}`);
        return {
          raceId,
          predictions: cachedResult.predictions.map((p: any) => ({
            horseName: p.horse_name,
            score: p.ensembleScore,
            rank: p.rank,
          })),
          ensembleScore: cachedResult.confidence * 100,
          timestamp: new Date(),
        };
      }

      // Prepare horse features for the advanced ensemble service
      const horseFeatures = horseNames.map((name, idx) => ({
        horse_name: name,
        form_rating: input.features[`form_${idx}`] || 50,
        speed_figure: input.features[`speed_${idx}`] || 50,
        jockey_rating: input.features[`jockey_${idx}`] || 50,
        trainer_rating: input.features[`trainer_${idx}`] || 50,
        recent_wins: input.features[`wins_${idx}`] || 0,
        recent_places: input.features[`places_${idx}`] || 0,
        odds: input.features[`odds_${idx}`] || 5.0,
        weight: input.features[`weight_${idx}`] || 60,
        distance_suitability: input.features[`distance_${idx}`] || 50,
        track_record: input.features[`track_${idx}`] || 50,
      }));

      // Get predictions from the advanced ensemble service
      const advancedEnsemble = getAdvancedEnsembleService();
      const predictions = await advancedEnsemble.predictWithConfidence(horseFeatures);

      // Calculate ensemble score
      const ensembleScore = predictions.ensembleScore;

      const result: PredictionResult = {
        raceId,
        predictions: predictions.predictions.map((p) => ({
          horseName: p.horse_name,
          score: p.confidence * 100, // Convert confidence (0-1) to percentage (0-100)
          rank: p.rank,
        })),
        ensembleScore,
        timestamp: new Date(),
      };

      // Cache the result
      await cache.set(raceId, raceData, {
        predictions: predictions.predictions,
        confidence: predictions.confidence,
        modelVersion: '2.0-oracle',
        processingTimeMs: 0,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Predict rankings for multiple races (batch prediction).
   */
  async predictBatch(inputs: PredictionInput[]): Promise<PredictionResult[]> {
    try {
      if (!Array.isArray(inputs) || inputs.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one race is required for batch prediction',
        });
      }

      if (inputs.length > 100) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Batch size limited to 100 races',
        });
      }

      // Process each race
      const results = await Promise.all(
        inputs.map((input, idx) =>
          this.predictRace({
            ...input,
            raceId: input.raceId || `race_${idx}`,
          })
        )
      );

      return results;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Batch prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Get model information and performance metrics.
   */
  getModelInfo() {
    return {
      status: 'ready',
      models: [
        {
          name: 'LightGBM Ranker (Large)',
          version: '1.0',
          ndcg3: 0.9713,
          path: 'lightgbm_ranker_large.pkl',
        },
      ],
      ensemble: {
        strategy: 'performance-weighted',
        components: [
          'LightGBM Ranker',
          'Logistic Regression',
          'XGBoost',
          'Old LightGBM',
        ],
        meanNdcg3: 0.9529,
        version: '2.0-oracle',
      },
      lastUpdated: new Date('2025-11-12'),
    };
  }
}

// Singleton instance
let predictionService: PredictionService | null = null;

export function getPredictionService(): PredictionService {
  if (!predictionService) {
    predictionService = new PredictionService();
  }
  return predictionService;
}
