/**
 * Outcome Validation Service
 * Validates predictions against actual race results and calculates accuracy metrics
 * Computes NDCG@3, win/place/show accuracy, and ROI for performance tracking
 */

import { type RaceResult, type HorseResult } from "./liveRaceDataService";
import { type Prediction } from "../../drizzle/schema";

export interface ValidationResult {
  predictionId: number;
  horseName: string;
  predictedRank: number;
  actualRank?: number;
  isCorrect: boolean;
  accuracy: "correct" | "partial" | "incorrect";
  ndcgScore: number;
  winAccuracy: boolean;
  placeAccuracy: boolean;
  showAccuracy: boolean;
  roi?: number;
}

export interface AccuracyMetrics {
  totalPredictions: number;
  correctPredictions: number;
  partialPredictions: number;
  winAccuracy: number; // percentage
  placeAccuracy: number; // percentage
  showAccuracy: number; // percentage
  ndcgAt3: number;
  ndcgAt5: number;
  averageConfidence: number;
  totalROI: number;
}

class OutcomeValidationService {
  /**
   * Calculate NDCG (Normalized Discounted Cumulative Gain) at position k
   * NDCG measures ranking quality - higher scores for correct predictions at top positions
   */
  private calculateNDCG(predictions: Array<{ rank: number; isCorrect: boolean }>, k: number): number {
    if (predictions.length === 0) return 0;

    // Calculate DCG (Discounted Cumulative Gain)
    let dcg = 0;
    for (let i = 0; i < Math.min(k, predictions.length); i++) {
      const relevance = predictions[i].isCorrect ? 1 : 0;
      dcg += relevance / Math.log2(i + 2); // log2(i+2) because position is 1-indexed
    }

    // Calculate IDCG (Ideal DCG - all correct predictions at top)
    let idcg = 0;
    for (let i = 0; i < Math.min(k, predictions.length); i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    // NDCG = DCG / IDCG
    return idcg > 0 ? dcg / idcg : 0;
  }

  /**
   * Validate a single prediction against race results
   */
  validatePrediction(
    prediction: Prediction,
    raceResults: RaceResult
  ): ValidationResult {
    const actualResult = raceResults.results.find(
      (r) => r.name.toLowerCase() === prediction.horseName.toLowerCase()
    );

    const actualRank = actualResult?.finishing_position;
    const predictedRank = prediction.predictedRank;

    // Determine accuracy type
    let accuracy: "correct" | "partial" | "incorrect" = "incorrect";
    let isCorrect = false;

    if (actualRank === predictedRank) {
      accuracy = "correct";
      isCorrect = true;
    } else if (actualRank && Math.abs(actualRank - predictedRank) <= 1) {
      accuracy = "partial"; // Off by one position
      isCorrect = false;
    }

    // Calculate NDCG score (1.0 for exact match, 0.5 for partial, 0.0 for incorrect)
    const ndcgScore = accuracy === "correct" ? 1.0 : accuracy === "partial" ? 0.5 : 0.0;

    // Win accuracy: predicted top 1 and finished in top 1
    const winAccuracy = predictedRank === 1 && actualRank === 1 ? true : false;

    // Place accuracy: predicted top 3 and finished in top 3
    const placeAccuracy = predictedRank <= 3 && actualRank && actualRank <= 3 ? true : false;

    // Show accuracy: predicted top 5 and finished in top 5
    const showAccuracy = predictedRank <= 5 && actualRank && actualRank <= 5 ? true : false;

    // Calculate ROI if odds are available
    let roi: number | undefined;
    if (actualResult?.odds) {
      const stake = 1; // Assume $1 stake
      const payout = winAccuracy ? stake * actualResult.odds : 0;
      roi = ((payout - stake) / stake) * 100;
    }

    return {
      predictionId: prediction.id,
      horseName: prediction.horseName,
      predictedRank,
      actualRank,
      isCorrect,
      accuracy,
      ndcgScore,
      winAccuracy,
      placeAccuracy,
      showAccuracy,
      roi,
    };
  }

  /**
   * Validate multiple predictions against race results
   */
  validatePredictions(
    predictions: Prediction[],
    raceResults: RaceResult
  ): ValidationResult[] {
    return predictions.map((pred) => this.validatePrediction(pred, raceResults));
  }

  /**
   * Calculate accuracy metrics from validation results
   */
  calculateMetrics(validationResults: ValidationResult[]): AccuracyMetrics {
    if (validationResults.length === 0) {
      return {
        totalPredictions: 0,
        correctPredictions: 0,
        partialPredictions: 0,
        winAccuracy: 0,
        placeAccuracy: 0,
        showAccuracy: 0,
        ndcgAt3: 0,
        ndcgAt5: 0,
        averageConfidence: 0,
        totalROI: 0,
      };
    }

    const correctCount = validationResults.filter((r) => r.accuracy === "correct").length;
    const partialCount = validationResults.filter((r) => r.accuracy === "partial").length;
    const winCount = validationResults.filter((r) => r.winAccuracy).length;
    const placeCount = validationResults.filter((r) => r.placeAccuracy).length;
    const showCount = validationResults.filter((r) => r.showAccuracy).length;

    // Calculate NDCG@3 and NDCG@5
    const sortedByRank = [...validationResults].sort((a, b) => a.predictedRank - b.predictedRank);
    const ndcgAt3 = this.calculateNDCG(
      sortedByRank.map((r) => ({ rank: r.predictedRank, isCorrect: r.isCorrect })),
      3
    );
    const ndcgAt5 = this.calculateNDCG(
      sortedByRank.map((r) => ({ rank: r.predictedRank, isCorrect: r.isCorrect })),
      5
    );

    // Calculate average confidence
    const avgConfidence =
      validationResults.reduce((sum, r) => {
        const conf = parseFloat(r.ndcgScore.toString());
        return sum + (isNaN(conf) ? 0 : conf);
      }, 0) / validationResults.length;

    // Calculate total ROI
    const totalROI = validationResults.reduce((sum, r) => sum + (r.roi || 0), 0);

    return {
      totalPredictions: validationResults.length,
      correctPredictions: correctCount,
      partialPredictions: partialCount,
      winAccuracy: (winCount / validationResults.length) * 100,
      placeAccuracy: (placeCount / validationResults.length) * 100,
      showAccuracy: (showCount / validationResults.length) * 100,
      ndcgAt3,
      ndcgAt5,
      averageConfidence: avgConfidence,
      totalROI,
    };
  }

  /**
   * Match predictions to race results by race ID and horse name
   */
  matchPredictionsToResults(
    predictions: Prediction[],
    raceResults: RaceResult[]
  ): Map<number, ValidationResult> {
    const validationMap = new Map<number, ValidationResult>();

    for (const prediction of predictions) {
      // Find matching race results
      const matchingRace = raceResults.find(
        (race) =>
          race.raceId === prediction.raceId ||
          (race.track.toLowerCase() === prediction.raceName?.toLowerCase() &&
            new Date(race.raceDate).toDateString() ===
              new Date(prediction.raceDate || "").toDateString())
      );

      if (matchingRace) {
        const validation = this.validatePrediction(prediction, matchingRace);
        validationMap.set(prediction.id, validation);
      }
    }

    return validationMap;
  }

  /**
   * Calculate drift in accuracy metrics over time
   * Returns percentage change from baseline
   */
  calculateDrift(
    currentMetrics: AccuracyMetrics,
    baselineMetrics: AccuracyMetrics
  ): {
    ndcgDrift: number;
    winAccuracyDrift: number;
    placeAccuracyDrift: number;
    overallDrift: number;
  } {
    const ndcgDrift =
      baselineMetrics.ndcgAt3 > 0
        ? ((currentMetrics.ndcgAt3 - baselineMetrics.ndcgAt3) / baselineMetrics.ndcgAt3) * 100
        : 0;

    const winAccuracyDrift =
      baselineMetrics.winAccuracy > 0
        ? ((currentMetrics.winAccuracy - baselineMetrics.winAccuracy) / baselineMetrics.winAccuracy) *
          100
        : 0;

    const placeAccuracyDrift =
      baselineMetrics.placeAccuracy > 0
        ? ((currentMetrics.placeAccuracy - baselineMetrics.placeAccuracy) /
            baselineMetrics.placeAccuracy) *
          100
        : 0;

    const overallDrift = (ndcgDrift + winAccuracyDrift + placeAccuracyDrift) / 3;

    return {
      ndcgDrift,
      winAccuracyDrift,
      placeAccuracyDrift,
      overallDrift,
    };
  }
}

// Singleton instance
let outcomeValidationService: OutcomeValidationService | null = null;

export function getOutcomeValidationService(): OutcomeValidationService {
  if (!outcomeValidationService) {
    outcomeValidationService = new OutcomeValidationService();
  }
  return outcomeValidationService;
}
