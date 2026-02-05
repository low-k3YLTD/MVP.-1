/**
 * ML Pipeline Integration Tests
 * Tests the complete ML training pipeline with real orchestration
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getFeatureEngineeringService } from "../featureEngineeringService";
import { getMLTrainingService } from "../mlTrainingService";
import { getModelTrainingOrchestrator } from "../modelTrainingOrchestrator";
import { getHyperparameterOptimizationService } from "../hyperparameterOptimizationService";
import { getMLflowIntegrationService } from "../mlflowIntegrationService";
import { getAutomatedRetrainingService } from "../automatedRetrainingService";
import type { Prediction } from "../../../drizzle/schema";

describe("ML Pipeline Integration", () => {
  let featureService: ReturnType<typeof getFeatureEngineeringService>;
  let trainingService: ReturnType<typeof getMLTrainingService>;
  let orchestrator: ReturnType<typeof getModelTrainingOrchestrator>;
  let hpoService: ReturnType<typeof getHyperparameterOptimizationService>;
  let mlflowService: ReturnType<typeof getMLflowIntegrationService>;
  let retrainingService: ReturnType<typeof getAutomatedRetrainingService>;

  beforeEach(() => {
    featureService = getFeatureEngineeringService();
    trainingService = getMLTrainingService();
    orchestrator = getModelTrainingOrchestrator();
    hpoService = getHyperparameterOptimizationService();
    mlflowService = getMLflowIntegrationService();
    retrainingService = getAutomatedRetrainingService();
  });

  describe("Feature Engineering", () => {
    it("should engineer features from raw race data", () => {
      const raceData = {
        raceId: "race_123",
        raceName: "Ascot Derby",
        track: "Ascot",
        raceDate: new Date(),
        raceClass: "Class1",
        distance: 2000,
        surface: "Turf",
        weather: "Clear",
        horses: [
          {
            name: "Thunder Strike",
            number: 1,
            weight: 520,
            jockey: "John Smith",
            trainer: "Jane Doe",
            formRating: 85,
            odds: 3.5,
            recentForm: "123",
            daysRest: 14,
            winPercentage: 35,
            placePercentage: 60,
          },
        ],
      };

      const engineered = featureService.engineerFeatures(raceData);

      expect(engineered).toHaveLength(1);
      expect(engineered[0].horseName).toBe("Thunder Strike");
      expect(engineered[0].features).toBeDefined();
      expect(Object.keys(engineered[0].features).length).toBeGreaterThan(0);
    });

    it("should extract form features correctly", () => {
      const raceData = {
        raceId: "race_123",
        raceName: "Test Race",
        track: "Test",
        raceDate: new Date(),
        raceClass: "Class2",
        distance: 1600,
        surface: "Turf",
        weather: "Cloudy",
        horses: [
          {
            name: "Test Horse",
            number: 1,
            weight: 500,
            jockey: "Test",
            trainer: "Test",
            formRating: 70,
            odds: 5.0,
            recentForm: "123",
            daysRest: 7,
            winPercentage: 25,
            placePercentage: 50,
          },
        ],
      };

      const engineered = featureService.engineerFeatures(raceData);
      const features = engineered[0].features;

      expect(features.lastRacePosition).toBeDefined();
      expect(typeof features.lastRacePosition).toBe("number");
      expect(features.formTrend).toBeDefined();
      expect(typeof features.formConsistency).toBe("number");
    });

    it("should update feature statistics", async () => {
      const predictions: Prediction[] = [];

      for (let i = 0; i < 150; i++) {
        predictions.push({
          id: i,
          userId: 1,
          raceId: `race_${i}`,
          raceName: "Test",
          raceDate: new Date(),
          horseName: `Horse_${i}`,
          predictedRank: Math.floor(Math.random() * 5) + 1,
          predictedScore: (Math.random() * 0.5 + 0.5).toString(),
          confidenceScore: (Math.random() * 0.3 + 0.7).toString(),
          actualRank: Math.floor(Math.random() * 10) + 1,
          isCorrect: Math.random() > 0.7 ? 1 : 0,
          accuracy: "correct",
          features: JSON.stringify({
            weight: 500 + Math.random() * 100,
            formRating: 50 + Math.random() * 50,
          }),
          raceOutcome: "{}",
          status: "completed",
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await featureService.updateFeatureStats(predictions);
      const stats = featureService.getFeatureStats();

      expect(Object.keys(stats).length).toBeGreaterThan(0);
      expect(stats.weight).toBeDefined();
      expect(stats.weight.mean).toBeGreaterThan(0);
      expect(stats.weight.std).toBeGreaterThan(0);
    });
  });

  describe("Model Training", () => {
    it("should prepare training data", async () => {
      const predictions: Prediction[] = [];

      for (let i = 0; i < 100; i++) {
        predictions.push({
          id: i,
          userId: 1,
          raceId: `race_${i}`,
          raceName: "Test",
          raceDate: new Date(),
          horseName: `Horse_${i % 10}`,
          predictedRank: Math.floor(Math.random() * 5) + 1,
          predictedScore: (Math.random() * 0.5 + 0.5).toString(),
          confidenceScore: (Math.random() * 0.3 + 0.7).toString(),
          actualRank: Math.floor(Math.random() * 10) + 1,
          isCorrect: Math.random() > 0.7 ? 1 : 0,
          accuracy: "correct",
          features: JSON.stringify({
            weight: 500 + Math.random() * 100,
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

      const trainingData = await trainingService.prepareTrainingData(predictions);

      expect(trainingData.X.length).toBe(100);
      expect(trainingData.y.length).toBe(100);
      expect(trainingData.featureNames.length).toBeGreaterThan(0);
    });

    it("should train CatBoost model", async () => {
      const predictions: Prediction[] = [];

      for (let i = 0; i < 100; i++) {
        predictions.push({
          id: i,
          userId: 1,
          raceId: `race_${i}`,
          raceName: "Test",
          raceDate: new Date(),
          horseName: `Horse_${i % 10}`,
          predictedRank: Math.floor(Math.random() * 5) + 1,
          predictedScore: (Math.random() * 0.5 + 0.5).toString(),
          confidenceScore: (Math.random() * 0.3 + 0.7).toString(),
          actualRank: Math.floor(Math.random() * 10) + 1,
          isCorrect: Math.random() > 0.7 ? 1 : 0,
          accuracy: "correct",
          features: JSON.stringify({
            weight: 500 + Math.random() * 100,
            formRating: 50 + Math.random() * 50,
          }),
          raceOutcome: "{}",
          status: "completed",
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const trainingData = await trainingService.prepareTrainingData(predictions);
      const result = await trainingService.trainCatBoostModel(trainingData);

      expect(result.success).toBe(true);
      expect(result.ndcgAt3).toBeGreaterThanOrEqual(0);
      expect(result.ndcgAt5).toBeGreaterThanOrEqual(0);
      expect(result.trainingTime).toBeGreaterThanOrEqual(0);
    });

    it("should train ensemble model", async () => {
      const predictions: Prediction[] = [];

      for (let i = 0; i < 100; i++) {
        predictions.push({
          id: i,
          userId: 1,
          raceId: `race_${i}`,
          raceName: "Test",
          raceDate: new Date(),
          horseName: `Horse_${i % 10}`,
          predictedRank: Math.floor(Math.random() * 5) + 1,
          predictedScore: (Math.random() * 0.5 + 0.5).toString(),
          confidenceScore: (Math.random() * 0.3 + 0.7).toString(),
          actualRank: Math.floor(Math.random() * 10) + 1,
          isCorrect: Math.random() > 0.7 ? 1 : 0,
          accuracy: "correct",
          features: JSON.stringify({
            weight: 500 + Math.random() * 100,
            formRating: 50 + Math.random() * 50,
          }),
          raceOutcome: "{}",
          status: "completed",
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const trainingData = await trainingService.prepareTrainingData(predictions);
      const result = await trainingService.trainEnsembleModel(trainingData);

      expect(result.success).toBe(true);
      expect(result.ndcgAt3).toBeGreaterThan(0);
      expect(result.modelType).toBe("ensemble");
    });
  });

  describe("Hyperparameter Optimization", () => {
    it("should optimize hyperparameters", async () => {
      const objectiveFunction = async (params: Record<string, number>) => {
        // Simulate objective function
        const score = params.learningRate * 100 + params.depth * 10 - Math.abs(params.l2LeafReg - 5) * 5;
        return Math.max(0, Math.min(100, score));
      };

      const result = await hpoService.optimizeHyperparameters(objectiveFunction, 20);

      expect(result.bestParams).toBeDefined();
      expect(result.bestScore).toBeGreaterThanOrEqual(0);
      expect(result.trialsCompleted).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should validate hyperparameters", () => {
      const validParams = {
        learningRate: 0.05,
        depth: 6,
        l2LeafReg: 3,
        iterations: 1000,
        subsample: 0.8,
      };

      const validation = hpoService.validateParams(validParams);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject invalid hyperparameters", () => {
      const invalidParams = {
        learningRate: 0.5, // Too high
        depth: 15, // Too high
        l2LeafReg: 20, // Too high
        iterations: 5000, // Too high
        subsample: 1.5, // Too high
      };

      const validation = hpoService.validateParams(invalidParams);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("MLflow Integration", () => {
    it("should create experiment", () => {
      const expId = mlflowService.createExperiment("test_experiment");

      expect(expId).toBeDefined();
      expect(expId.startsWith("exp_")).toBe(true);
    });

    it("should start and end run", () => {
      const runId = mlflowService.startRun({
        experimentName: "test_exp",
        runName: "test_run",
        tags: { test: "true" },
        params: { lr: 0.05 },
      });

      expect(runId).toBeDefined();

      mlflowService.logMetrics({ ndcg: 0.95 });
      mlflowService.endRun("FINISHED");

      const run = mlflowService.getRun(runId);
      expect(run?.status).toBe("FINISHED");
      expect(run?.metrics.ndcg).toBe(0.95);
    });

    it("should register model", () => {
      const model = mlflowService.registerModel("test_model", "model_123", { ndcg_at_3: 0.95 });

      expect(model.name).toBe("test_model");
      expect(model.version).toBe(1);
      expect(model.metrics.ndcg_at_3).toBe(0.95);
    });

    it("should transition model stage", () => {
      mlflowService.registerModel("test_model_2", "model_456", { ndcg_at_3: 0.96 });
      mlflowService.transitionModelStage("test_model_2", 1, "Production");

      const models = mlflowService.getRegisteredModels("test_model_2");
      expect(models[0].stage).toBe("Production");
    });
  });

  describe("Training Orchestration", () => {
    it("should execute training pipeline", async () => {
      const result = await orchestrator.executeTrainingPipeline("drift_detected");

      expect(result.success).toBe(true);
      expect(result.trainedModels.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it("should get execution statistics", async () => {
      await orchestrator.executeTrainingPipeline("drift_detected");
      const stats = orchestrator.getStatistics();

      expect(stats.totalExecutions).toBeGreaterThan(0);
      expect(stats.successfulExecutions).toBeGreaterThanOrEqual(0);
      expect(stats.averageImprovement).toBeDefined();
    });
  });

  describe("End-to-End ML Pipeline", () => {
    it("should complete full training pipeline", async () => {
      // 1. Prepare training data
      const predictions: Prediction[] = [];

      for (let i = 0; i < 120; i++) {
        predictions.push({
          id: i,
          userId: 1,
          raceId: `race_${i}`,
          raceName: "Test",
          raceDate: new Date(),
          horseName: `Horse_${i % 10}`,
          predictedRank: Math.floor(Math.random() * 5) + 1,
          predictedScore: (Math.random() * 0.5 + 0.5).toString(),
          confidenceScore: (Math.random() * 0.3 + 0.7).toString(),
          actualRank: Math.floor(Math.random() * 10) + 1,
          isCorrect: Math.random() > 0.7 ? 1 : 0,
          accuracy: "correct",
          features: JSON.stringify({
            weight: 500 + Math.random() * 100,
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

      // 2. Engineer features
      await featureService.updateFeatureStats(predictions);

      // 3. Prepare training data
      const trainingData = await trainingService.prepareTrainingData(predictions);
      expect(trainingData.X.length).toBeGreaterThan(0);

      // 4. Train model
      const trainResult = await trainingService.trainCatBoostModel(trainingData);
      expect(trainResult.success).toBe(true);

      // 5. Log to MLflow
      const runId = mlflowService.startRun({
        experimentName: "e2e_test",
        runName: "full_pipeline",
        tags: { test: "e2e" },
        params: trainResult.hyperparameters,
      });

      mlflowService.logMetrics({
        ndcg_at_3: trainResult.ndcgAt3,
        ndcg_at_5: trainResult.ndcgAt5,
      });

      mlflowService.endRun("FINISHED");

      // 6. Register model
      const model = mlflowService.registerModel(trainResult.modelId, trainResult.modelId, {
        ndcg_at_3: trainResult.ndcgAt3,
      });

      expect(model.version).toBe(1);

      // 7. Verify end-to-end
      const run = mlflowService.getRun(runId);
      expect(run?.status).toBe("FINISHED");
      expect(run?.metrics.ndcg_at_3).toBe(trainResult.ndcgAt3);
    });
  });
});
