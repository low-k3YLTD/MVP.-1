/**
 * Race Outcome Integration Tests
 * Tests the complete workflow: race results → outcome validation → drift detection → retraining
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getOutcomeValidationService } from "../outcomeValidationService";
import { getModelComparisonService } from "../modelComparisonService";
import { getDriftIntegrationService } from "../driftIntegrationService";
import { getAutomatedRetrainingService } from "../automatedRetrainingService";
import type { RaceResult, HorseResult } from "../liveRaceDataService";
import type { Prediction } from "../../../drizzle/schema";

describe("Race Outcome Integration Workflow", () => {
  let validationService: ReturnType<typeof getOutcomeValidationService>;
  let modelService: ReturnType<typeof getModelComparisonService>;
  let driftService: ReturnType<typeof getDriftIntegrationService>;
  let retrainingService: ReturnType<typeof getAutomatedRetrainingService>;

  beforeEach(() => {
    validationService = getOutcomeValidationService();
    modelService = getModelComparisonService();
    driftService = getDriftIntegrationService();
    retrainingService = getAutomatedRetrainingService();
  });

  describe("Outcome Validation", () => {
    it("should validate predictions against race results", () => {
      const mockPrediction: Prediction = {
        id: 1,
        userId: 1,
        raceId: "race_123",
        raceName: "Ascot",
        raceDate: new Date(),
        horseName: "Thunder Strike",
        predictedRank: 1,
        predictedScore: "0.95",
        confidenceScore: "0.85",
        actualRank: 1,
        isCorrect: 1,
        accuracy: "correct",
        features: "{}",
        raceOutcome: "{}",
        status: "completed",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRaceResult: RaceResult = {
        raceId: "race_123",
        raceName: "Ascot",
        track: "Ascot",
        raceDate: "2026-02-06",
        results: [
          {
            name: "Thunder Strike",
            number: 1,
            finishing_position: 1,
            odds: 2.5,
          },
          {
            name: "Golden Dream",
            number: 2,
            finishing_position: 2,
            odds: 4.0,
          },
        ],
      };

      const validation = validationService.validatePrediction(mockPrediction, mockRaceResult);

      expect(validation.isCorrect).toBe(true);
      expect(validation.accuracy).toBe("correct");
      expect(validation.ndcgScore).toBe(1.0);
      expect(validation.winAccuracy).toBe(true);
    });

    it("should calculate NDCG metrics", () => {
      const predictions = [
        { id: 1, userId: 1, raceId: "r1", raceName: "Ascot", raceDate: new Date(), horseName: "Horse1", predictedRank: 1, predictedScore: "0.9", confidenceScore: "0.8", actualRank: 1, isCorrect: 1, accuracy: "correct" as const, features: "{}", raceOutcome: "{}", status: "completed" as const, notes: null, createdAt: new Date(), updatedAt: new Date() },
        { id: 2, userId: 1, raceId: "r1", raceName: "Ascot", raceDate: new Date(), horseName: "Horse2", predictedRank: 2, predictedScore: "0.8", confidenceScore: "0.7", actualRank: 2, isCorrect: 1, accuracy: "correct" as const, features: "{}", raceOutcome: "{}", status: "completed" as const, notes: null, createdAt: new Date(), updatedAt: new Date() },
        { id: 3, userId: 1, raceId: "r1", raceName: "Ascot", raceDate: new Date(), horseName: "Horse3", predictedRank: 3, predictedScore: "0.7", confidenceScore: "0.6", actualRank: 5, isCorrect: 0, accuracy: "incorrect" as const, features: "{}", raceOutcome: "{}", status: "completed" as const, notes: null, createdAt: new Date(), updatedAt: new Date() },
      ];

      const validations = predictions.map((p) => ({
        predictionId: p.id,
        horseName: p.horseName,
        predictedRank: p.predictedRank,
        actualRank: p.actualRank,
        isCorrect: p.isCorrect === 1,
        accuracy: p.accuracy,
        ndcgScore: p.accuracy === "correct" ? 1.0 : 0.0,
        winAccuracy: p.predictedRank === 1 && p.actualRank === 1,
        placeAccuracy: p.predictedRank <= 3 && p.actualRank && p.actualRank <= 3,
        showAccuracy: p.predictedRank <= 5 && p.actualRank && p.actualRank <= 5,
        roi: undefined,
      }));

      const metrics = validationService.calculateMetrics(validations as any);

      expect(metrics.totalPredictions).toBe(3);
      expect(metrics.correctPredictions).toBe(2);
      expect(metrics.winAccuracy).toBeGreaterThan(0);
      expect(metrics.placeAccuracy).toBeGreaterThan(0);
      expect(metrics.ndcgAt3).toBeGreaterThan(0);
    });
  });

  describe("Model Comparison", () => {
    it("should register and track model metrics", () => {
      const modelMetrics = {
        modelId: "model_1",
        modelName: "LightGBM",
        version: "1.0.0",
        ndcgAt3: 0.85,
        ndcgAt5: 0.88,
        winAccuracy: 0.24,
        placeAccuracy: 0.52,
        showAccuracy: 0.68,
        totalPredictions: 100,
        correctPredictions: 24,
        averageConfidence: 0.79,
        roi: 5.2,
        lastUpdated: new Date(),
      };

      modelService.registerModel(modelMetrics);
      const retrieved = modelService.getModelMetrics("model_1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.ndcgAt3).toBe(0.85);
      expect(retrieved?.modelName).toBe("LightGBM");
    });

    it("should calculate performance summary", () => {
      const model1 = {
        modelId: "model_1",
        modelName: "LightGBM",
        version: "1.0.0",
        ndcgAt3: 0.85,
        ndcgAt5: 0.88,
        winAccuracy: 0.24,
        placeAccuracy: 0.52,
        showAccuracy: 0.68,
        totalPredictions: 100,
        correctPredictions: 24,
        averageConfidence: 0.79,
        roi: 5.2,
        lastUpdated: new Date(),
      };

      const model2 = {
        modelId: "model_2",
        modelName: "XGBoost",
        version: "1.0.0",
        ndcgAt3: 0.88,
        ndcgAt5: 0.91,
        winAccuracy: 0.26,
        placeAccuracy: 0.54,
        showAccuracy: 0.70,
        totalPredictions: 100,
        correctPredictions: 26,
        averageConfidence: 0.82,
        roi: 7.1,
        lastUpdated: new Date(),
      };

      modelService.registerModel(model1);
      modelService.registerModel(model2);

      const summary = modelService.getPerformanceSummary();

      expect(summary.bestModel?.modelId).toBe("model_2");
      expect(summary.topModels.length).toBe(2);
      expect(summary.averageNDCG).toBeGreaterThan(0.85);
    });

    it("should adjust weights based on performance", () => {
      const model1 = {
        modelId: "model_1",
        modelName: "LightGBM",
        version: "1.0.0",
        ndcgAt3: 0.80,
        ndcgAt5: 0.83,
        winAccuracy: 0.20,
        placeAccuracy: 0.50,
        showAccuracy: 0.65,
        totalPredictions: 100,
        correctPredictions: 20,
        averageConfidence: 0.75,
        roi: 2.0,
        lastUpdated: new Date(),
      };

      const model2 = {
        modelId: "model_2",
        modelName: "XGBoost",
        version: "1.0.0",
        ndcgAt3: 0.90,
        ndcgAt5: 0.93,
        winAccuracy: 0.30,
        placeAccuracy: 0.60,
        showAccuracy: 0.75,
        totalPredictions: 100,
        correctPredictions: 30,
        averageConfidence: 0.85,
        roi: 10.0,
        lastUpdated: new Date(),
      };

      modelService.registerModel(model1);
      modelService.registerModel(model2);
      modelService.adjustWeightsBasedOnPerformance();

      const weights = modelService.getModelWeights();
      const model2Weight = weights.find((w) => w.modelId === "model_2");

      expect(model2Weight?.weight).toBeGreaterThan(0.5);
    });
  });

  describe("Drift Detection", () => {
    it("should detect NDCG drift", () => {
      const baseline = {
        totalPredictions: 100,
        correctPredictions: 25,
        partialPredictions: 10,
        winAccuracy: 0.25,
        placeAccuracy: 0.55,
        showAccuracy: 0.70,
        ndcgAt3: 0.85,
        ndcgAt5: 0.88,
        averageConfidence: 0.80,
        totalROI: 5.0,
      };

      const current = {
        totalPredictions: 100,
        correctPredictions: 20,
        partialPredictions: 8,
        winAccuracy: 0.20,
        placeAccuracy: 0.50,
        showAccuracy: 0.65,
        ndcgAt3: 0.81,
        ndcgAt5: 0.84,
        averageConfidence: 0.76,
        totalROI: 2.0,
      };

      driftService.setBaseline("model_1", baseline as any);
      const alerts = driftService.monitorPerformance("model_1", current as any);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some((a) => a.alertType === "performance_drift")).toBe(true);
    });

    it("should detect concept drift using KS test", () => {
      const baseline = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
      const recent = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3];

      const alert = driftService.detectConceptDrift("model_1", recent, baseline);

      expect(alert).toBeDefined();
      expect(alert?.alertType).toBe("concept_drift");
      expect(alert?.driftMagnitude).toBeGreaterThan(0);
    });

    it("should calculate NDCG trend", () => {
      const baseline = {
        totalPredictions: 100,
        correctPredictions: 25,
        partialPredictions: 10,
        winAccuracy: 0.25,
        placeAccuracy: 0.55,
        showAccuracy: 0.70,
        ndcgAt3: 0.85,
        ndcgAt5: 0.88,
        averageConfidence: 0.80,
        totalROI: 5.0,
      };

      driftService.setBaseline("model_1", baseline as any);

      // Simulate improving trend
      for (let i = 0; i < 5; i++) {
        const improved = {
          ...baseline,
          ndcgAt3: baseline.ndcgAt3 + i * 0.01,
        };
        driftService.monitorPerformance("model_1", improved as any);
      }

      const trend = driftService.calculateNDCGTrend("model_1");

      expect(trend.trend).toBe("improving");
      expect(trend.slope).toBeGreaterThan(0);
    });
  });

  describe("Automated Retraining", () => {
    it("should queue retraining jobs", () => {
      const job = retrainingService.queueRetrainingJob("model_1", "drift_detected");

      expect(job.jobId).toBeDefined();
      expect(job.modelId).toBe("model_1");
      expect(job.status).toBe("pending");
    });

    it("should check retraining needs", () => {
      const needs = retrainingService.checkRetrainingNeeds();

      expect(needs.modelsNeedingRetrain).toBeDefined();
      expect(Array.isArray(needs.modelsNeedingRetrain)).toBe(true);
    });

    it("should get queue status", () => {
      retrainingService.queueRetrainingJob("model_1", "drift_detected");
      const status = retrainingService.getQueueStatus();

      expect(status.queueLength).toBeGreaterThanOrEqual(1);
      expect(status.activeJobs).toBeDefined();
      expect(status.completedJobs).toBeDefined();
    });

    it("should track retraining statistics", () => {
      const stats = retrainingService.getStatistics();

      expect(stats.totalJobsCompleted).toBeDefined();
      expect(stats.successfulJobs).toBeDefined();
      expect(stats.failedJobs).toBeDefined();
      expect(stats.averageNDCGImprovement).toBeDefined();
    });
  });

  describe("End-to-End Workflow", () => {
    it("should complete full race outcome workflow", async () => {
      // 1. Register models
      const model1 = {
        modelId: "model_1",
        modelName: "LightGBM",
        version: "1.0.0",
        ndcgAt3: 0.85,
        ndcgAt5: 0.88,
        winAccuracy: 0.25,
        placeAccuracy: 0.55,
        showAccuracy: 0.70,
        totalPredictions: 100,
        correctPredictions: 25,
        averageConfidence: 0.80,
        roi: 5.0,
        lastUpdated: new Date(),
      };

      modelService.registerModel(model1);

      // 2. Set baseline for drift detection
      const baseline = {
        totalPredictions: 100,
        correctPredictions: 25,
        partialPredictions: 10,
        winAccuracy: 0.25,
        placeAccuracy: 0.55,
        showAccuracy: 0.70,
        ndcgAt3: 0.85,
        ndcgAt5: 0.88,
        averageConfidence: 0.80,
        totalROI: 5.0,
      };

      driftService.setBaseline("model_1", baseline as any);

      // 3. Simulate performance degradation
      const degraded = {
        totalPredictions: 100,
        correctPredictions: 20,
        partialPredictions: 8,
        winAccuracy: 0.20,
        placeAccuracy: 0.50,
        showAccuracy: 0.65,
        ndcgAt3: 0.80,
        ndcgAt5: 0.83,
        averageConfidence: 0.75,
        totalROI: 2.0,
      };

      const alerts = driftService.monitorPerformance("model_1", degraded as any);

      // 4. Check if retraining is needed
      const needs = retrainingService.checkRetrainingNeeds();

      // 5. Queue retraining if needed
      if (needs.modelsNeedingRetrain.length > 0) {
        const job = retrainingService.queueRetrainingJob("model_1", "drift_detected");
        expect(job.status).toBe("pending");
      }

      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});
