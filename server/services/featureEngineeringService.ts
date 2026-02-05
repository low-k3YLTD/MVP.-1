/**
 * Feature Engineering Service
 * Transforms raw race and horse data into ML-ready features
 */

import { getDb } from "../db";
import type { Prediction } from "../../drizzle/schema";

export interface RawRaceData {
  raceId: string;
  raceName: string;
  track: string;
  raceDate: Date;
  raceClass: string;
  distance: number;
  surface: string;
  weather: string;
  horses: Array<{
    name: string;
    number: number;
    weight: number;
    jockey: string;
    trainer: string;
    formRating: number;
    odds: number;
    recentForm: string; // e.g., "123" = 1st, 2nd, 3rd in last 3 races
    daysRest: number;
    winPercentage: number;
    placePercentage: number;
  }>;
}

export interface EngineereedFeatures {
  horseId: string;
  horseName: string;
  raceId: string;
  features: Record<string, number>;
  featureNames: string[];
}

export interface FeatureStats {
  mean: number;
  std: number;
  min: number;
  max: number;
}

class FeatureEngineeringService {
  private featureStats: Map<string, FeatureStats> = new Map();
  private readonly MIN_DATA_POINTS = 100;

  /**
   * Engineer features from raw race data
   */
  engineerFeatures(raceData: RawRaceData): EngineereedFeatures[] {
    return raceData.horses.map((horse) => {
      const features = this.extractFeatures(horse, raceData);
      const normalized = this.normalizeFeatures(features);

      return {
        horseId: `${raceData.raceId}_${horse.number}`,
        horseName: horse.name,
        raceId: raceData.raceId,
        features: normalized,
        featureNames: Object.keys(normalized),
      };
    });
  }

  /**
   * Extract raw features from horse and race data
   */
  private extractFeatures(
    horse: RawRaceData["horses"][0],
    raceData: RawRaceData
  ): Record<string, number> {
    // Horse-specific features
    const horseFeatures = {
      weight: horse.weight,
      daysRest: horse.daysRest,
      winPercentage: horse.winPercentage,
      placePercentage: horse.placePercentage,
      odds: horse.odds,
      formRating: horse.formRating,
    };

    // Form-based features
    const formFeatures = this.extractFormFeatures(horse.recentForm);

    // Race-specific features
    const raceFeatures = {
      distance: raceData.distance,
      raceClass: this.encodeRaceClass(raceData.raceClass),
      surfaceType: this.encodeSurface(raceData.surface),
      weatherCondition: this.encodeWeather(raceData.weather),
    };

    // Interaction features
    const interactionFeatures = {
      weightToDistance: horse.weight / (raceData.distance / 1000),
      oddsToFormRating: horse.odds > 0 ? horse.formRating / Math.log(horse.odds + 1) : 0,
      restToOdds: horse.daysRest > 0 ? Math.log(horse.daysRest + 1) / Math.log(horse.odds + 1) : 0,
    };

    // Combine all features
    return {
      ...horseFeatures,
      ...formFeatures,
      ...raceFeatures,
      ...interactionFeatures,
    };
  }

  /**
   * Extract features from recent form string (e.g., "123" = 1st, 2nd, 3rd)
   */
  private extractFormFeatures(recentForm: string): Record<string, number> {
    const positions = recentForm.split("").map((p) => parseInt(p, 10));

    return {
      lastRacePosition: positions.length > 0 ? positions[0] : 0,
      secondLastPosition: positions.length > 1 ? positions[1] : 0,
      thirdLastPosition: positions.length > 2 ? positions[2] : 0,
      formConsistency: this.calculateFormConsistency(positions),
      averageFormPosition: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : 0,
      formTrend: this.calculateFormTrend(positions),
    };
  }

  /**
   * Calculate form consistency (lower variance = more consistent)
   */
  private calculateFormConsistency(positions: number[]): number {
    if (positions.length === 0) return 0;

    const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
    const variance = positions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / positions.length;

    // Invert so higher consistency = higher score
    return Math.max(0, 1 - variance / 25);
  }

  /**
   * Calculate form trend (improving, declining, or stable)
   */
  private calculateFormTrend(positions: number[]): number {
    if (positions.length < 2) return 0;

    // Simple linear regression slope
    const n = positions.length;
    const xMean = (n - 1) / 2;
    const yMean = positions.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (positions[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Negative slope = improving (lower position numbers), positive = declining
    return -slope;
  }

  /**
   * Encode race class as numeric value
   */
  private encodeRaceClass(raceClass: string): number {
    const classMap: Record<string, number> = {
      Class1: 5,
      Class2: 4,
      Class3: 3,
      Class4: 2,
      Class5: 1,
      Maiden: 0,
    };
    return classMap[raceClass] || 2;
  }

  /**
   * Encode surface type as numeric value
   */
  private encodeSurface(surface: string): number {
    const surfaceMap: Record<string, number> = {
      Turf: 1,
      Dirt: 2,
      Synthetic: 3,
      All_Weather: 4,
    };
    return surfaceMap[surface] || 1;
  }

  /**
   * Encode weather condition as numeric value
   */
  private encodeWeather(weather: string): number {
    const weatherMap: Record<string, number> = {
      Clear: 1,
      Cloudy: 2,
      Rainy: 3,
      Snowy: 4,
      Windy: 5,
    };
    return weatherMap[weather] || 1;
  }

  /**
   * Normalize features using z-score normalization
   */
  private normalizeFeatures(features: Record<string, number>): Record<string, number> {
    const normalized: Record<string, number> = {};

    for (const [key, value] of Object.entries(features)) {
      const stats = this.featureStats.get(key);

      if (stats && stats.std > 0) {
        // Z-score normalization
        normalized[key] = (value - stats.mean) / stats.std;
      } else {
        // No stats available, use min-max scaling with default range
        normalized[key] = (value - 50) / 50;
      }
    }

    return normalized;
  }

  /**
   * Update feature statistics from training data
   */
  async updateFeatureStats(predictions: Prediction[]): Promise<void> {
    if (predictions.length < this.MIN_DATA_POINTS) {
      console.log(`[FeatureEngineering] Insufficient data for stats update: ${predictions.length}/${this.MIN_DATA_POINTS}`);
      return;
    }

    const featureMap: Map<string, number[]> = new Map();

    // Aggregate features from predictions
    for (const pred of predictions) {
      try {
        const features = JSON.parse(pred.features || "{}");

        for (const [key, value] of Object.entries(features)) {
          if (typeof value === "number") {
            if (!featureMap.has(key)) {
              featureMap.set(key, []);
            }
            featureMap.get(key)!.push(value);
          }
        }
      } catch (error) {
        console.error("[FeatureEngineering] Failed to parse features:", error);
      }
    }

    // Calculate statistics for each feature
    featureMap.forEach((values: number[], key: string) => {
      if (values.length > 0) {
        const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
        const variance = values.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const std = Math.sqrt(variance);
        const min = Math.min(...values);
        const max = Math.max(...values);

        this.featureStats.set(key, { mean, std, min, max });
      }
    });

    console.log(`[FeatureEngineering] Updated stats for ${this.featureStats.size} features`);
  }

  /**
   * Get feature statistics for inspection
   */
  getFeatureStats(): Record<string, FeatureStats> {
    const stats: Record<string, FeatureStats> = {};

    this.featureStats.forEach((value: FeatureStats, key: string) => {
      stats[key] = value;
    });

    return stats;
  }

  /**
   * Create feature importance mapping
   */
  getFeatureImportance(): Map<string, number> {
    // Placeholder for feature importance tracking
    // Will be populated by model training
    const importance = new Map<string, number>();
    return importance;
  }
}

let instance: FeatureEngineeringService | null = null;

export function getFeatureEngineeringService(): FeatureEngineeringService {
  if (!instance) {
    instance = new FeatureEngineeringService();
  }
  return instance;
}
