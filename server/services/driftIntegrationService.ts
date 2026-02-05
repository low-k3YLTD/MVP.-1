/**
 * Drift Integration Service
 * Connects drift detection results to model comparison and triggers automated retraining
 * Monitors NDCG trends, data distribution changes, and concept drift
 */

import { getModelComparisonService, type DriftAlert } from "./modelComparisonService";
import { getOutcomeValidationService, type AccuracyMetrics } from "./outcomeValidationService";

export interface DriftMonitoringConfig {
  ndcgDriftThreshold: number; // percentage drop that triggers alert
  dataDriftThreshold: number; // KS-test p-value threshold
  conceptDriftThreshold: number; // magnitude threshold for concept drift
  windowSize: number; // number of predictions to analyze
  cooldownPeriod: number; // milliseconds between retraining attempts
}

const DEFAULT_CONFIG: DriftMonitoringConfig = {
  ndcgDriftThreshold: 0.02, // 2% drop in NDCG triggers alert
  dataDriftThreshold: 0.05, // p-value < 0.05 indicates drift
  conceptDriftThreshold: 0.15, // 15% magnitude indicates concept drift
  windowSize: 100,
  cooldownPeriod: 60 * 60 * 1000, // 1 hour
};

class DriftIntegrationService {
  private config: DriftMonitoringConfig;
  private lastRetrainingTime: Map<string, number> = new Map();
  private baselineMetrics: Map<string, AccuracyMetrics> = new Map();
  private metricsHistory: Map<string, AccuracyMetrics[]> = new Map();

  constructor(config: Partial<DriftMonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set baseline metrics for a model
   */
  setBaseline(modelId: string, metrics: AccuracyMetrics): void {
    this.baselineMetrics.set(modelId, metrics);
    this.metricsHistory.set(modelId, [metrics]);
    console.log(`[DriftIntegration] Set baseline for model ${modelId}: NDCG@3=${metrics.ndcgAt3.toFixed(3)}`);
  }

  /**
   * Monitor model performance and detect drift
   */
  monitorPerformance(modelId: string, currentMetrics: AccuracyMetrics): DriftAlert[] {
    const alerts: DriftAlert[] = [];
    const baseline = this.baselineMetrics.get(modelId);

    if (!baseline) {
      console.warn(`[DriftIntegration] No baseline for model ${modelId}`);
      return alerts;
    }

    // Update metrics history
    const history = this.metricsHistory.get(modelId) || [];
    history.push(currentMetrics);
    if (history.length > this.config.windowSize) {
      history.shift();
    }
    this.metricsHistory.set(modelId, history);

    // Check for NDCG drift (performance degradation)
    const ndcgDrift = (baseline.ndcgAt3 - currentMetrics.ndcgAt3) / baseline.ndcgAt3;
    if (ndcgDrift > this.config.ndcgDriftThreshold) {
      alerts.push({
        alertId: `drift_ndcg_${modelId}_${Date.now()}`,
        modelId,
        alertType: "performance_drift",
        severity: ndcgDrift > 0.05 ? "critical" : ndcgDrift > 0.03 ? "high" : "medium",
        driftMagnitude: ndcgDrift,
        threshold: this.config.ndcgDriftThreshold,
        message: `NDCG@3 dropped ${(ndcgDrift * 100).toFixed(1)}% from baseline (${baseline.ndcgAt3.toFixed(3)} → ${currentMetrics.ndcgAt3.toFixed(3)})`,
        timestamp: new Date(),
        requiresRetraining: ndcgDrift > 0.05,
      });
    }

    // Check for win accuracy drift
    const winAccuracyDrift =
      (baseline.winAccuracy - currentMetrics.winAccuracy) / baseline.winAccuracy;
    if (Math.abs(winAccuracyDrift) > 0.1) {
      alerts.push({
        alertId: `drift_win_${modelId}_${Date.now()}`,
        modelId,
        alertType: "prediction_drift",
        severity: Math.abs(winAccuracyDrift) > 0.2 ? "high" : "medium",
        driftMagnitude: Math.abs(winAccuracyDrift),
        threshold: 0.1,
        message: `Win accuracy changed ${(winAccuracyDrift * 100).toFixed(1)}% (${baseline.winAccuracy.toFixed(1)}% → ${currentMetrics.winAccuracy.toFixed(1)}%)`,
        timestamp: new Date(),
        requiresRetraining: Math.abs(winAccuracyDrift) > 0.2,
      });
    }

    // Check for place accuracy drift
    const placeAccuracyDrift =
      (baseline.placeAccuracy - currentMetrics.placeAccuracy) / baseline.placeAccuracy;
    if (Math.abs(placeAccuracyDrift) > 0.08) {
      alerts.push({
        alertId: `drift_place_${modelId}_${Date.now()}`,
        modelId,
        alertType: "prediction_drift",
        severity: Math.abs(placeAccuracyDrift) > 0.15 ? "high" : "medium",
        driftMagnitude: Math.abs(placeAccuracyDrift),
        threshold: 0.08,
        message: `Place accuracy changed ${(placeAccuracyDrift * 100).toFixed(1)}% (${baseline.placeAccuracy.toFixed(1)}% → ${currentMetrics.placeAccuracy.toFixed(1)}%)`,
        timestamp: new Date(),
        requiresRetraining: Math.abs(placeAccuracyDrift) > 0.15,
      });
    }

    // Register alerts with model comparison service
    const modelService = getModelComparisonService();
    for (const alert of alerts) {
      modelService.createDriftAlert(alert);
    }

    return alerts;
  }

  /**
   * Detect concept drift using statistical tests
   * Compares recent predictions to baseline distribution
   */
  detectConceptDrift(
    modelId: string,
    recentPredictions: number[],
    baselinePredictions: number[]
  ): DriftAlert | null {
    // Kolmogorov-Smirnov test approximation
    const ksStatistic = this.calculateKSStatistic(recentPredictions, baselinePredictions);

    if (ksStatistic > this.config.conceptDriftThreshold) {
      const alert: DriftAlert = {
        alertId: `drift_concept_${modelId}_${Date.now()}`,
        modelId,
        alertType: "concept_drift",
        severity: ksStatistic > 0.3 ? "critical" : ksStatistic > 0.2 ? "high" : "medium",
        driftMagnitude: ksStatistic,
        threshold: this.config.conceptDriftThreshold,
        message: `Concept drift detected (KS=${ksStatistic.toFixed(3)}). Prediction distribution has shifted significantly.`,
        timestamp: new Date(),
        requiresRetraining: ksStatistic > 0.25,
      };

      const modelService = getModelComparisonService();
      modelService.createDriftAlert(alert);

      return alert;
    }

    return null;
  }

  /**
   * Kolmogorov-Smirnov statistic calculation
   * Measures maximum distance between two cumulative distributions
   */
  private calculateKSStatistic(sample1: number[], sample2: number[]): number {
    if (sample1.length === 0 || sample2.length === 0) return 0;

    // Sort both samples
    const sorted1 = [...sample1].sort((a, b) => a - b);
    const sorted2 = [...sample2].sort((a, b) => a - b);

    let maxDistance = 0;
    let i = 0,
      j = 0;

    // Calculate empirical CDFs and find max distance
    while (i < sorted1.length && j < sorted2.length) {
      const cdf1 = (i + 1) / sorted1.length;
      const cdf2 = (j + 1) / sorted2.length;

      maxDistance = Math.max(maxDistance, Math.abs(cdf1 - cdf2));

      if (sorted1[i] <= sorted2[j]) {
        i++;
      } else {
        j++;
      }
    }

    // Account for remaining elements
    while (i < sorted1.length) {
      maxDistance = Math.max(maxDistance, Math.abs(1 - (i + 1) / sorted1.length));
      i++;
    }

    while (j < sorted2.length) {
      maxDistance = Math.max(maxDistance, Math.abs(1 - (j + 1) / sorted2.length));
      j++;
    }

    return maxDistance;
  }

  /**
   * Check if retraining is needed and not on cooldown
   */
  shouldRetrain(modelId: string): boolean {
    const modelService = getModelComparisonService();
    const recommendation = modelService.getRetrainingRecommendation();

    if (!recommendation.shouldRetrain || !recommendation.affectedModels.includes(modelId)) {
      return false;
    }

    // Check cooldown period
    const lastRetrain = this.lastRetrainingTime.get(modelId) || 0;
    const timeSinceLastRetrain = Date.now() - lastRetrain;

    if (timeSinceLastRetrain < this.config.cooldownPeriod) {
      console.log(
        `[DriftIntegration] Model ${modelId} on cooldown (${(
          (this.config.cooldownPeriod - timeSinceLastRetrain) /
          1000 /
          60
        ).toFixed(1)} minutes remaining)`
      );
      return false;
    }

    return true;
  }

  /**
   * Mark model as retrained
   */
  markRetrained(modelId: string): void {
    this.lastRetrainingTime.set(modelId, Date.now());
    console.log(`[DriftIntegration] Marked model ${modelId} as retrained at ${new Date().toISOString()}`);
  }

  /**
   * Get drift summary for all models
   */
  getDriftSummary(): {
    modelsWithDrift: string[];
    criticalAlerts: number;
    recommendedActions: string[];
  } {
    const modelService = getModelComparisonService();
    const alerts = modelService.getActiveDriftAlerts();
    const criticalAlerts = modelService.getCriticalDriftAlerts();
    const recommendation = modelService.getRetrainingRecommendation();

    const modelsWithDrift = Array.from(new Set(alerts.map((a) => a.modelId)));

    const recommendedActions: string[] = [];
    if (criticalAlerts.length > 0) {
      recommendedActions.push(`Retrain ${recommendation.affectedModels.length} model(s) immediately`);
    }
    if (alerts.length > 5) {
      recommendedActions.push("Review ensemble weights and consider model replacement");
    }
    if (modelsWithDrift.length === modelService.getAllModelMetrics().length) {
      recommendedActions.push("Systemic drift detected - check data pipeline for issues");
    }

    return {
      modelsWithDrift,
      criticalAlerts: criticalAlerts.length,
      recommendedActions,
    };
  }

  /**
   * Get metrics history for a model
   */
  getMetricsHistory(modelId: string): AccuracyMetrics[] {
    return this.metricsHistory.get(modelId) || [];
  }

  /**
   * Calculate trend in NDCG over time
   */
  calculateNDCGTrend(modelId: string): {
    trend: "improving" | "degrading" | "stable";
    changePercent: number;
    slope: number;
  } {
    const history = this.getMetricsHistory(modelId);
    if (history.length < 2) {
      return { trend: "stable", changePercent: 0, slope: 0 };
    }

    // Calculate linear regression slope
    const n = history.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = history.reduce((sum, m) => sum + m.ndcgAt3, 0);
    const sumXY = history.reduce((sum, m, i) => sum + (i + 1) * m.ndcgAt3, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const firstNDCG = history[0].ndcgAt3;
    const lastNDCG = history[history.length - 1].ndcgAt3;
    const changePercent = ((lastNDCG - firstNDCG) / firstNDCG) * 100;

    let trend: "improving" | "degrading" | "stable" = "stable";
    if (slope > 0.001) {
      trend = "improving";
    } else if (slope < -0.001) {
      trend = "degrading";
    }

    return { trend, changePercent, slope };
  }
}

// Singleton instance
let driftIntegrationService: DriftIntegrationService | null = null;

export function getDriftIntegrationService(): DriftIntegrationService {
  if (!driftIntegrationService) {
    driftIntegrationService = new DriftIntegrationService();
  }
  return driftIntegrationService;
}
