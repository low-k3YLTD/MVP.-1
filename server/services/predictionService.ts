import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { TRPCError } from '@trpc/server';
import { getEnsemblePredictionService, HorseFeatures } from './ensemblePredictionService';
import { fileURLToPath } from 'url';

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
   * Predict rankings for a single race using the ensemble model.
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

      // Prepare horse features for the ensemble service
      const horseFeatures: HorseFeatures[] = horseNames.map((name, idx) => ({
        horse_name: name,
        ...Object.fromEntries(
          Object.entries(input.features).map(([key, value]) => [`${key}_${idx}`, value])
        ),
      }));

      // Get predictions from the ensemble service
      const ensembleService = getEnsemblePredictionService();
      const predictions = await ensembleService.predictRaceOutcome(raceId, horseFeatures);

      // Calculate ensemble score (average of all prediction scores)
      const ensembleScore = predictions.reduce((sum, p) => sum + p.score, 0) / predictions.length;

      const result: PredictionResult = {
        raceId,
        predictions: predictions.map((p) => ({
          horseName: p.horse_name,
          score: p.score,
          rank: p.position,
        })),
        ensembleScore,
        timestamp: new Date(),
      };

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
        strategy: 'averaging',
        components: [
          'LightGBM Ranker',
          'Logistic Regression',
          'XGBoost',
          'Old LightGBM',
        ],
        meanNdcg3: 0.9529,
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
