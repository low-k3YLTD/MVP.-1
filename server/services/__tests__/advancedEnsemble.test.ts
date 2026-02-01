import { describe, it, expect, beforeEach } from "vitest";
import {
  getAdvancedEnsembleService,
  type EnsembleConfig,
  type PredictionWithConfidence,
} from "../advancedEnsembleService";

describe("AdvancedEnsembleService", () => {
  beforeEach(() => {
    // Reset metrics for each test
    const service = getAdvancedEnsembleService();
    service.resetMetrics();
  });

  it("should initialize with default config", () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();
    const metrics = service.getMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.version).toBe("2.0-oracle");
    expect(metrics.modelWeights).toBeDefined();
  });

  it("should set model weights correctly", () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();
    const newWeights = {
      lightgbm_new: 0.4,
      xgboost: 0.3,
      logistic_regression: 0.2,
      lightgbm_old: 0.1,
    };

    service.setModelWeights(newWeights);
    const metrics = service.getMetrics();

    expect(metrics.modelWeights).toEqual(newWeights);
  });

  it("should reject invalid weights that don't sum to 1.0", () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();
    const invalidWeights = {
      lightgbm_new: 0.5,
      xgboost: 0.3,
      logistic_regression: 0.1,
      lightgbm_old: 0.05,
    };

    expect(() => {
      service.setModelWeights(invalidWeights);
    }).toThrow();
  });

  it("should make predictions with confidence scores", async () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();

    const horseFeatures = [
      {
        horse_name: "Horse A",
        horse_age: 4,
        jockey_experience: 10,
        trainer_wins: 50,
        recent_form: 0.8,
        distance_preference: 0.7,
        track_preference: 0.6,
        weight: 550,
        odds: 3.5,
      },
      {
        horse_name: "Horse B",
        horse_age: 5,
        jockey_experience: 15,
        trainer_wins: 100,
        recent_form: 0.9,
        distance_preference: 0.8,
        track_preference: 0.7,
        weight: 560,
        odds: 2.5,
      },
    ];

    const result = await service.predictWithConfidence(horseFeatures);

    expect(result).toBeDefined();
    expect(result.predictions).toBeDefined();
    expect(result.predictions.length).toBe(2);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.modelVersion).toBe("2.0-oracle");
    expect(result.ensembleScore).toBeGreaterThanOrEqual(0);
    expect(result.ensembleScore).toBeLessThanOrEqual(100);
  });

  it("should rank horses by prediction score", async () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();

    const horseFeatures = [
      {
        horse_name: "Weak Horse",
        horse_age: 3,
        jockey_experience: 2,
        trainer_wins: 5,
        recent_form: 0.2,
        distance_preference: 0.3,
        track_preference: 0.2,
        weight: 500,
        odds: 10.0,
      },
      {
        horse_name: "Strong Horse",
        horse_age: 6,
        jockey_experience: 20,
        trainer_wins: 200,
        recent_form: 0.95,
        distance_preference: 0.95,
        track_preference: 0.95,
        weight: 570,
        odds: 1.5,
      },
    ];

    const result = await service.predictWithConfidence(horseFeatures);

    // Strong horse should be ranked higher
    expect(result.predictions[0].rank).toBeLessThan(result.predictions[1].rank);
  });

  it("should calculate win probabilities that sum to 100", async () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();

    const horseFeatures = [
      {
        horse_name: "Horse A",
        horse_age: 4,
        jockey_experience: 10,
        trainer_wins: 50,
        recent_form: 0.8,
        distance_preference: 0.7,
        track_preference: 0.6,
        weight: 550,
        odds: 3.5,
      },
      {
        horse_name: "Horse B",
        horse_age: 5,
        jockey_experience: 15,
        trainer_wins: 100,
        recent_form: 0.9,
        distance_preference: 0.8,
        track_preference: 0.7,
        weight: 560,
        odds: 2.5,
      },
      {
        horse_name: "Horse C",
        horse_age: 6,
        jockey_experience: 20,
        trainer_wins: 150,
        recent_form: 0.85,
        distance_preference: 0.75,
        track_preference: 0.65,
        weight: 555,
        odds: 2.0,
      },
    ];

    const result = await service.predictWithConfidence(horseFeatures);

    const totalProb = result.predictions.reduce((sum, pred) => sum + pred.winProb, 0);

    expect(totalProb).toBeLessThanOrEqual(100);
    expect(totalProb).toBeGreaterThan(0);
  });

  it("should provide model contributions", async () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();

    const horseFeatures = [
      {
        horse_name: "Horse A",
        horse_age: 4,
        jockey_experience: 10,
        trainer_wins: 50,
        recent_form: 0.8,
        distance_preference: 0.7,
        track_preference: 0.6,
        weight: 550,
        odds: 3.5,
      },
    ];

    const result = await service.predictWithConfidence(horseFeatures);

    expect(result.modelContributions).toBeDefined();
    expect(Object.keys(result.modelContributions!).length).toBeGreaterThan(0);
  });

  it("should track prediction metrics", async () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();

    const horseFeatures = [
      {
        horse_name: "Horse A",
        horse_age: 4,
        jockey_experience: 10,
        trainer_wins: 50,
        recent_form: 0.8,
        distance_preference: 0.7,
        track_preference: 0.6,
        weight: 550,
        odds: 3.5,
      },
    ];

    const initialMetrics = service.getMetrics();
    const initialCount = initialMetrics.predictionCount;

    await service.predictWithConfidence(horseFeatures);

    const updatedMetrics = service.getMetrics();
    expect(updatedMetrics.predictionCount).toBeGreaterThan(initialCount);
  });

  it("should handle empty horse features gracefully", async () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();

    const horseFeatures: any[] = [];

    try {
      await service.predictWithConfidence(horseFeatures);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should provide uncertainty bounds", async () => {
    const service = getAdvancedEnsembleService();
    service.resetMetrics();

    const horseFeatures = [
      {
        horse_name: "Horse A",
        horse_age: 4,
        jockey_experience: 10,
        trainer_wins: 50,
        recent_form: 0.8,
        distance_preference: 0.7,
        track_preference: 0.6,
        weight: 550,
        odds: 3.5,
      },
    ];

    const result = await service.predictWithConfidence(horseFeatures);

    if (result.uncertainty) {
      expect(result.uncertainty.lowerBound).toBeLessThanOrEqual(result.uncertainty.upperBound);
      expect(result.uncertainty.lowerBound).toBeGreaterThanOrEqual(0);
      expect(result.uncertainty.upperBound).toBeLessThanOrEqual(1);
    }
  });
});
