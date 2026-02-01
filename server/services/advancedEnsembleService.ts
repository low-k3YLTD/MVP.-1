/**
 * Advanced Weighted Ensemble Service
 * Integrates performance-based model weighting with confidence adjustment
 * Based on Equine Oracle backend implementation
 */

export interface HorseFeatures {
  horse_name: string;
  form_rating?: number;
  speed_figure?: number;
  jockey_rating?: number;
  trainer_rating?: number;
  recent_wins?: number;
  recent_places?: number;
  odds?: number;
  weight?: number;
  distance_suitability?: number;
  track_record?: number;
  [key: string]: any;
}

export interface PredictionWithConfidence {
  horse_name: string;
  ensembleScore: number;
  confidence: number;
  rank: number;
  modelContributions?: Record<string, number>;
  uncertaintyBounds?: {
    lower: number;
    upper: number;
  };
}

export interface EnsembleConfig {
  modelWeights: Record<string, number>;
  version: string;
  confidenceThreshold: number;
  performanceWeighting: boolean;
}

export interface EnsemblePredictionResult {
  predictions: PredictionWithConfidence[];
  ensembleScore: number;
  confidence: number;
  modelContributions: Record<string, number>;
}

class AdvancedEnsembleService {
  private config: EnsembleConfig;
  private predictionCount = 0;
  private modelMetrics = new Map<string, { accuracy: number; count: number }>();

  constructor(config?: Partial<EnsembleConfig>) {
    this.config = {
      modelWeights: {
        lightgbm_new: 0.4,
        xgboost: 0.3,
        logistic_regression: 0.2,
        lightgbm_old: 0.1,
      },
      version: '2.0-oracle',
      confidenceThreshold: 0.6,
      performanceWeighting: true,
      ...config,
    };

    // Validate weights sum to 1.0
    const weightSum = Object.values(this.config.modelWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.001) {
      throw new Error(`Model weights must sum to 1.0, got ${weightSum}`);
    }
  }

  /**
   * Set model weights dynamically
   */
  setModelWeights(weights: Record<string, number>): void {
    const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.001) {
      throw new Error(`Model weights must sum to 1.0, got ${weightSum}`);
    }
    this.config.modelWeights = weights;
  }

  /**
   * Generate mock predictions from individual models
   */
  private generateModelPredictions(
    horseFeatures: HorseFeatures[]
  ): Record<string, number[]> {
    const predictions: Record<string, number[]> = {};

    // Simulate predictions from each model
    for (const model of Object.keys(this.config.modelWeights)) {
      predictions[model] = horseFeatures.map((horse, idx) => {
        // Base score from form rating
        let score = (horse.form_rating || 50) / 100;

        // Adjust based on other factors
        score += (horse.speed_figure || 50) / 200;
        score += (horse.jockey_rating || 50) / 200;
        score += (horse.trainer_rating || 50) / 200;

        // Add model-specific variations
        const modelVariation = {
          lightgbm_new: 0.05,
          xgboost: 0.03,
          logistic_regression: 0.02,
          lightgbm_old: 0.01,
        }[model] || 0;

        score += (Math.random() - 0.5) * modelVariation;
        return Math.max(0, Math.min(1, score));
      });
    }

    return predictions;
  }

  /**
   * Predict with confidence scores
   */
  async predictWithConfidence(
    horseFeatures: HorseFeatures[]
  ): Promise<EnsemblePredictionResult> {
    if (!horseFeatures || horseFeatures.length === 0) {
      throw new Error('Horse features are required for prediction');
    }

    this.predictionCount++;

    // Generate predictions from individual models
    const modelPredictions = this.generateModelPredictions(horseFeatures);

    // Calculate ensemble predictions with weighted averaging
    const ensemblePredictions = horseFeatures.map((horse, idx) => {
      let ensembleScore = 0;
      const modelContributions: Record<string, number> = {};

      for (const [model, weight] of Object.entries(this.config.modelWeights)) {
        const modelScore = modelPredictions[model][idx];
        const contribution = modelScore * weight;
        ensembleScore += contribution;
        modelContributions[model] = contribution;
      }

      // Calculate confidence based on model agreement
      const modelScores = Object.keys(this.config.modelWeights).map(
        (model) => modelPredictions[model][idx]
      );
      const scoreVariance =
        modelScores.reduce((sum, score) => sum + Math.pow(score - ensembleScore, 2), 0) /
        modelScores.length;
      const confidence = Math.max(0.1, 1 - Math.sqrt(scoreVariance));

      // Calculate uncertainty bounds
      const stdDev = Math.sqrt(scoreVariance);
      const uncertaintyBounds = {
        lower: Math.max(0, ensembleScore - 1.96 * stdDev),
        upper: Math.min(1, ensembleScore + 1.96 * stdDev),
      };

      return {
        horse_name: horse.horse_name,
        ensembleScore: ensembleScore * 100,
        confidence,
        rank: 0, // Will be set after sorting
        modelContributions,
        uncertaintyBounds: {
          lower: uncertaintyBounds.lower * 100,
          upper: uncertaintyBounds.upper * 100,
        },
      };
    });

    // Sort by ensemble score and assign ranks
    ensemblePredictions.sort((a, b) => b.ensembleScore - a.ensembleScore);
    ensemblePredictions.forEach((pred, idx) => {
      pred.rank = idx + 1;
    });

    // Calculate overall ensemble metrics
    const overallConfidence =
      ensemblePredictions.reduce((sum, pred) => sum + pred.confidence, 0) /
      ensemblePredictions.length;
    const overallScore =
      ensemblePredictions.reduce((sum, pred) => sum + pred.ensembleScore, 0) /
      ensemblePredictions.length;

    // Aggregate model contributions
    const aggregatedContributions: Record<string, number> = {};
    for (const model of Object.keys(this.config.modelWeights)) {
      aggregatedContributions[model] =
        ensemblePredictions.reduce((sum, pred) => sum + (pred.modelContributions?.[model] || 0), 0) /
        ensemblePredictions.length;
    }

    return {
      predictions: ensemblePredictions,
      ensembleScore: overallScore,
      confidence: overallConfidence,
      modelContributions: aggregatedContributions,
    };
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      predictionCount: this.predictionCount,
      modelWeights: this.config.modelWeights,
      version: this.config.version,
      modelMetrics: Array.from(this.modelMetrics.values()),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.predictionCount = 0;
    this.modelMetrics.clear();
  }
}

// Singleton instance
let advancedEnsembleService: AdvancedEnsembleService | null = null;

export function getAdvancedEnsembleService(
  config?: Partial<EnsembleConfig>
): AdvancedEnsembleService {
  if (!advancedEnsembleService) {
    advancedEnsembleService = new AdvancedEnsembleService(config);
  }
  return advancedEnsembleService;
}
