/**
 * Model Training Orchestrator
 * Orchestrates the complete ML pipeline: data preparation → training → evaluation → deployment
 */

import { getDb } from "../db";
import { getFeatureEngineeringService } from "./featureEngineeringService";
import { getMLTrainingService, type TrainingResult } from "./mlTrainingService";
import { getModelComparisonService } from "./modelComparisonService";
import { getDriftIntegrationService } from "./driftIntegrationService";
import type { Prediction } from "../../drizzle/schema";

export interface OrchestrationConfig {
  minDataPoints: number;
  trainingStrategy: "single" | "ensemble" | "both";
  autoPromoteThreshold: number;
  saveModels: boolean;
  logExperiments: boolean;
}

export interface OrchestrationResult {
  success: boolean;
  trainedModels: TrainingResult[];
  bestModel: TrainingResult | null;
  improvement: number;
  executionTime: number;
  error?: string;
}

class ModelTrainingOrchestrator {
  private config: OrchestrationConfig;
  private executionHistory: OrchestrationResult[] = [];

  constructor(config?: Partial<OrchestrationConfig>) {
    this.config = {
      minDataPoints: 100,
      trainingStrategy: "ensemble",
      autoPromoteThreshold: 0.01, // 1% improvement
      saveModels: true,
      logExperiments: true,
      ...config,
    };
  }

  /**
   * Execute complete training pipeline
   */
  async executeTrainingPipeline(retrainingReason: string): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const trainedModels: TrainingResult[] = [];

    try {
      console.log(`[Orchestrator] Starting training pipeline: ${retrainingReason}`);

      // Step 1: Fetch training data
      const predictions = await this.fetchTrainingData();
      if (predictions.length < this.config.minDataPoints) {
        throw new Error(`Insufficient data: ${predictions.length}/${this.config.minDataPoints} required`);
      }

      console.log(`[Orchestrator] Fetched ${predictions.length} training samples`);

      // Step 2: Prepare features
      const featureService = getFeatureEngineeringService();
      const trainingService = getMLTrainingService();
      const trainingData = await trainingService.prepareTrainingData(predictions);

      console.log(`[Orchestrator] Engineered ${trainingData.featureNames.length} features`);

      // Step 3: Train models based on strategy
      if (this.config.trainingStrategy === "single" || this.config.trainingStrategy === "both") {
        const catboostResult = await trainingService.trainModel(trainingData, "catboost");
        trainedModels.push(catboostResult);

        if (catboostResult.success) {
          console.log(`[Orchestrator] CatBoost NDCG@3: ${catboostResult.ndcgAt3.toFixed(4)}`);
        } else {
          console.error(`[Orchestrator] CatBoost training failed: ${catboostResult.error}`);
        }
      }

      if (this.config.trainingStrategy === "ensemble" || this.config.trainingStrategy === "both") {
        const ensembleResult = await trainingService.trainModel(trainingData, "ensemble");
        trainedModels.push(ensembleResult);

        if (ensembleResult.success) {
          console.log(`[Orchestrator] Ensemble NDCG@3: ${ensembleResult.ndcgAt3.toFixed(4)}`);
        } else {
          console.error(`[Orchestrator] Ensemble training failed: ${ensembleResult.error}`);
        }
      }

      // Step 4: Evaluate and compare
      const bestModel = this.selectBestModel(trainedModels);
      const improvement = this.calculateImprovement(bestModel);

      console.log(`[Orchestrator] Best model: ${bestModel?.modelId} with NDCG@3: ${bestModel?.ndcgAt3.toFixed(4)}`);
      console.log(`[Orchestrator] Improvement: ${(improvement * 100).toFixed(2)}%`);

      // Step 5: Register model if improvement meets threshold
      if (bestModel && improvement >= this.config.autoPromoteThreshold) {
        await this.registerAndPromoteModel(bestModel, retrainingReason);
      }

      // Step 6: Log experiments
      if (this.config.logExperiments) {
        await this.logExperiments(trainedModels, retrainingReason);
      }

      const executionTime = Date.now() - startTime;

      const result: OrchestrationResult = {
        success: true,
        trainedModels,
        bestModel,
        improvement,
        executionTime,
      };

      this.executionHistory.push(result);
      console.log(`[Orchestrator] Pipeline completed in ${executionTime}ms`);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`[Orchestrator] Pipeline failed: ${errorMsg}`);

      const result: OrchestrationResult = {
        success: false,
        trainedModels,
        bestModel: null,
        improvement: 0,
        executionTime,
        error: errorMsg,
      };

      this.executionHistory.push(result);
      return result;
    }
  }

  /**
   * Fetch training data from database
   */
  private async fetchTrainingData(): Promise<Prediction[]> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Fetch recent predictions with outcomes
    // In production, this would query from the database
    // For now, return mock data
    const mockPredictions: Prediction[] = [];

    for (let i = 0; i < 150; i++) {
      mockPredictions.push({
        id: i,
        userId: 1,
        raceId: `race_${i}`,
        raceName: "Mock Race",
        raceDate: new Date(),
        horseName: `Horse_${i % 10}`,
        predictedRank: Math.floor(Math.random() * 5) + 1,
        predictedScore: (Math.random() * 0.5 + 0.5).toString(),
        confidenceScore: (Math.random() * 0.3 + 0.7).toString(),
        actualRank: Math.floor(Math.random() * 10) + 1,
        isCorrect: Math.random() > 0.7 ? 1 : 0,
        accuracy: Math.random() > 0.7 ? "correct" : "incorrect",
        features: JSON.stringify({
          weight: 500 + Math.random() * 100,
          daysRest: Math.floor(Math.random() * 30),
          winPercentage: Math.random() * 50,
          formRating: 50 + Math.random() * 50,
          odds: 2 + Math.random() * 10,
        }),
        raceOutcome: "{}",
        status: "completed",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return mockPredictions;
  }

  /**
   * Select best model from trained models
   */
  private selectBestModel(models: TrainingResult[]): TrainingResult | null {
    if (models.length === 0) return null;

    return models.reduce((best, current) => {
      if (!current.success) return best;
      if (!best.success) return current;
      return current.ndcgAt3 > best.ndcgAt3 ? current : best;
    });
  }

  /**
   * Calculate improvement over baseline
   */
  private calculateImprovement(bestModel: TrainingResult | null): number {
    if (!bestModel || !bestModel.success) return 0;

    // Baseline NDCG from current ensemble
    const baseline = 0.95;
    const improvement = (bestModel.ndcgAt3 - baseline) / baseline;

    return Math.max(0, improvement);
  }

  /**
   * Register model and promote if improvement is significant
   */
  private async registerAndPromoteModel(model: TrainingResult, reason: string): Promise<void> {
    const modelService = getModelComparisonService();

    // Register the new model
    modelService.registerModel({
      modelId: model.modelId,
      modelName: model.modelType,
      version: "1.0.0",
      ndcgAt3: model.ndcgAt3,
      ndcgAt5: model.ndcgAt5,
      winAccuracy: model.winAccuracy,
      placeAccuracy: model.placeAccuracy,
      showAccuracy: model.showAccuracy,
      totalPredictions: model.dataPoints,
      correctPredictions: Math.floor(model.dataPoints * model.winAccuracy),
      averageConfidence: 0.8,
      roi: 5.0,
      lastUpdated: new Date(),
    });

    console.log(`[Orchestrator] Registered model: ${model.modelId}`);

    // Adjust weights to favor the new model
    modelService.adjustWeightsBasedOnPerformance();

    console.log(`[Orchestrator] Updated model weights based on performance`);
  }

  /**
   * Log experiments to MLflow (placeholder)
   */
  private async logExperiments(models: TrainingResult[], reason: string): Promise<void> {
    console.log(`[Orchestrator] Logging ${models.length} experiments for reason: ${reason}`);

    // In production, this would log to MLflow
    for (const model of models) {
      console.log(`  - ${model.modelId}: NDCG@3=${model.ndcgAt3.toFixed(4)}, Time=${model.trainingTime}ms`);
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): OrchestrationResult[] {
    return [...this.executionHistory];
  }

  /**
   * Get latest execution result
   */
  getLatestExecution(): OrchestrationResult | null {
    return this.executionHistory.length > 0 ? this.executionHistory[this.executionHistory.length - 1] : null;
  }

  /**
   * Get statistics from execution history
   */
  getStatistics(): Record<string, any> {
    const successful = this.executionHistory.filter((r) => r.success);
    const avgImprovement = successful.length > 0 ? successful.reduce((sum, r) => sum + r.improvement, 0) / successful.length : 0;
    const avgTime = this.executionHistory.length > 0 ? this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0) / this.executionHistory.length : 0;

    return {
      totalExecutions: this.executionHistory.length,
      successfulExecutions: successful.length,
      failedExecutions: this.executionHistory.length - successful.length,
      averageImprovement: avgImprovement,
      averageExecutionTime: avgTime,
      lastExecution: this.executionHistory[this.executionHistory.length - 1] || null,
    };
  }
}

let instance: ModelTrainingOrchestrator | null = null;

export function getModelTrainingOrchestrator(config?: Partial<OrchestrationConfig>): ModelTrainingOrchestrator {
  if (!instance) {
    instance = new ModelTrainingOrchestrator(config);
  }
  return instance;
}
