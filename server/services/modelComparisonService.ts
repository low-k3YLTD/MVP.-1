/**
 * Model Comparison Service
 * Tracks NDCG@3, model weights, drift detection, and A/B testing results
 * Provides metrics for model performance comparison and automated retraining decisions
 */

export interface ModelMetrics {
  modelId: string;
  modelName: string;
  version: string;
  ndcgAt3: number;
  ndcgAt5: number;
  winAccuracy: number;
  placeAccuracy: number;
  showAccuracy: number;
  totalPredictions: number;
  correctPredictions: number;
  averageConfidence: number;
  roi: number;
  lastUpdated: Date;
  driftScore?: number; // KS-test drift magnitude
  conceptDrift?: number; // Concept drift magnitude
}

export interface ModelWeight {
  modelId: string;
  weight: number; // 0-1, sum of all weights = 1
  performanceBased: boolean;
  lastAdjusted: Date;
}

export interface DriftAlert {
  alertId: string;
  modelId: string;
  alertType: "data_drift" | "prediction_drift" | "concept_drift" | "performance_drift";
  severity: "low" | "medium" | "high" | "critical";
  driftMagnitude: number;
  threshold: number;
  message: string;
  timestamp: Date;
  requiresRetraining: boolean;
}

export interface ABTestResult {
  testId: string;
  controlModelId: string;
  treatmentModelId: string;
  controlNDCG: number;
  treatmentNDCG: number;
  improvement: number; // percentage
  statisticalSignificance: number; // p-value
  isSignificant: boolean;
  recommendedWinner: string;
  trafficSplit: { control: number; treatment: number }; // percentages
  startDate: Date;
  endDate?: Date;
  status: "active" | "concluded";
}

class ModelComparisonService {
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private modelWeights: Map<string, ModelWeight> = new Map();
  private driftAlerts: Map<string, DriftAlert> = new Map();
  private abTests: Map<string, ABTestResult> = new Map();

  /**
   * Register a model for tracking
   */
  registerModel(metrics: ModelMetrics): void {
    this.modelMetrics.set(metrics.modelId, metrics);
    console.log(`[ModelComparison] Registered model: ${metrics.modelName} v${metrics.version}`);
  }

  /**
   * Update model metrics
   */
  updateModelMetrics(modelId: string, metrics: Partial<ModelMetrics>): void {
    const existing = this.modelMetrics.get(modelId);
    if (!existing) {
      console.warn(`[ModelComparison] Model ${modelId} not found`);
      return;
    }

    const updated = { ...existing, ...metrics, lastUpdated: new Date() };
    this.modelMetrics.set(modelId, updated);
    console.log(`[ModelComparison] Updated metrics for model: ${modelId}`);
  }

  /**
   * Get model metrics by ID
   */
  getModelMetrics(modelId: string): ModelMetrics | undefined {
    return this.modelMetrics.get(modelId);
  }

  /**
   * Get all model metrics sorted by NDCG@3 (descending)
   */
  getAllModelMetrics(): ModelMetrics[] {
    return Array.from(this.modelMetrics.values()).sort((a, b) => b.ndcgAt3 - a.ndcgAt3);
  }

  /**
   * Set model weight for ensemble
   */
  setModelWeight(modelId: string, weight: number, performanceBased: boolean = false): void {
    // Normalize weights to sum to 1
    const totalWeight = Array.from(this.modelWeights.values()).reduce((sum, w) => sum + w.weight, 0) +
      weight;

    if (totalWeight > 0) {
      const factor = 1 / totalWeight;
      this.modelWeights.forEach((w) => {
        w.weight *= factor;
      });
    }

    this.modelWeights.set(modelId, {
      modelId,
      weight: Math.max(0, Math.min(1, weight)),
      performanceBased,
      lastAdjusted: new Date(),
    });

    console.log(`[ModelComparison] Set weight for model ${modelId}: ${weight.toFixed(3)}`);
  }

  /**
   * Get current model weights
   */
  getModelWeights(): ModelWeight[] {
    return Array.from(this.modelWeights.values());
  }

  /**
   * Adjust weights based on performance
   * Higher NDCG@3 = higher weight
   */
  adjustWeightsBasedOnPerformance(): void {
    const models = this.getAllModelMetrics();
    if (models.length === 0) return;

    // Calculate total NDCG for normalization
    const totalNDCG = models.reduce((sum, m) => sum + m.ndcgAt3, 0);
    if (totalNDCG === 0) return;

    // Assign weights proportional to NDCG
    for (const model of models) {
      const weight = model.ndcgAt3 / totalNDCG;
      this.setModelWeight(model.modelId, weight, true);
    }

    console.log("[ModelComparison] Adjusted weights based on performance");
  }

  /**
   * Create drift alert
   */
  createDriftAlert(alert: DriftAlert): void {
    this.driftAlerts.set(alert.alertId, alert);
    console.log(`[ModelComparison] Drift alert: ${alert.message} (${alert.severity})`);
  }

  /**
   * Get active drift alerts
   */
  getActiveDriftAlerts(): DriftAlert[] {
    return Array.from(this.driftAlerts.values()).filter(
      (a) => a.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
    );
  }

  /**
   * Get critical drift alerts requiring retraining
   */
  getCriticalDriftAlerts(): DriftAlert[] {
    return this.getActiveDriftAlerts().filter((a) => a.requiresRetraining);
  }

  /**
   * Create A/B test
   */
  createABTest(test: ABTestResult): void {
    this.abTests.set(test.testId, test);
    console.log(`[ModelComparison] Created A/B test: ${test.testId}`);
  }

  /**
   * Update A/B test results
   */
  updateABTest(testId: string, updates: Partial<ABTestResult>): void {
    const existing = this.abTests.get(testId);
    if (!existing) {
      console.warn(`[ModelComparison] A/B test ${testId} not found`);
      return;
    }

    const updated = { ...existing, ...updates };
    this.abTests.set(testId, updated);
    console.log(`[ModelComparison] Updated A/B test: ${testId}`);
  }

  /**
   * Get active A/B tests
   */
  getActiveABTests(): ABTestResult[] {
    return Array.from(this.abTests.values()).filter((t) => t.status === "active");
  }

  /**
   * Get A/B test by ID
   */
  getABTest(testId: string): ABTestResult | undefined {
    return this.abTests.get(testId);
  }

  /**
   * Calculate statistical significance using chi-square test
   * Returns p-value (lower = more significant)
   */
  calculateStatisticalSignificance(
    controlWins: number,
    controlTotal: number,
    treatmentWins: number,
    treatmentTotal: number
  ): number {
    // Chi-square test for independence
    const controlLosses = controlTotal - controlWins;
    const treatmentLosses = treatmentTotal - treatmentWins;

    const n = controlTotal + treatmentTotal;
    const expectedControl = ((controlWins + treatmentWins) / n) * controlTotal;
    const expectedTreatment = ((controlWins + treatmentWins) / n) * treatmentTotal;

    const chi2 =
      Math.pow(controlWins - expectedControl, 2) / expectedControl +
      Math.pow(treatmentWins - expectedTreatment, 2) / expectedTreatment +
      Math.pow(controlLosses - (controlTotal - expectedControl), 2) / (controlTotal - expectedControl) +
      Math.pow(treatmentLosses - (treatmentTotal - expectedTreatment), 2) /
        (treatmentTotal - expectedTreatment);

    // Approximate p-value using chi-square distribution
    // For 1 degree of freedom: p ≈ 0.05 when chi2 ≈ 3.84
    return Math.exp(-chi2 / 2);
  }

  /**
   * Determine if retraining is needed based on drift
   */
  shouldRetrain(): boolean {
    const criticalAlerts = this.getCriticalDriftAlerts();
    return criticalAlerts.length > 0;
  }

  /**
   * Get retraining recommendation
   */
  getRetrainingRecommendation(): {
    shouldRetrain: boolean;
    reason: string;
    priority: "low" | "medium" | "high" | "critical";
    affectedModels: string[];
  } {
    const criticalAlerts = this.getCriticalDriftAlerts();

    if (criticalAlerts.length === 0) {
      return {
        shouldRetrain: false,
        reason: "No critical drift detected",
        priority: "low",
        affectedModels: [],
      };
    }

    const affectedModels = Array.from(new Set(criticalAlerts.map((a) => a.modelId)));
    const maxSeverity = criticalAlerts.reduce((max, a) => {
      const severityMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
      return Math.max(max, severityMap[a.severity]);
    }, 0);

    const severityNames = ["low", "medium", "high", "critical"] as const;
    const priority: "low" | "medium" | "high" | "critical" = (severityNames[maxSeverity - 1] || "low") as "low" | "medium" | "high" | "critical";

    return {
      shouldRetrain: true,
      reason: `Critical drift detected in ${affectedModels.length} model(s)`,
      priority,
      affectedModels,
    };
  }

  /**
   * Get model performance comparison summary
   */
  getPerformanceSummary(): {
    bestModel: ModelMetrics | null;
    worstModel: ModelMetrics | null;
    averageNDCG: number;
    ndcgVariance: number;
    topModels: ModelMetrics[];
  } {
    const models = this.getAllModelMetrics();

    if (models.length === 0) {
      return {
        bestModel: null,
        worstModel: null,
        averageNDCG: 0,
        ndcgVariance: 0,
        topModels: [],
      };
    }

    const bestModel = models[0];
    const worstModel = models[models.length - 1];
    const averageNDCG = models.reduce((sum, m) => sum + m.ndcgAt3, 0) / models.length;
    const ndcgVariance =
      models.reduce((sum, m) => sum + Math.pow(m.ndcgAt3 - averageNDCG, 2), 0) / models.length;

    return {
      bestModel,
      worstModel,
      averageNDCG,
      ndcgVariance,
      topModels: models.slice(0, 3),
    };
  }
}

// Singleton instance
let modelComparisonService: ModelComparisonService | null = null;

export function getModelComparisonService(): ModelComparisonService {
  if (!modelComparisonService) {
    modelComparisonService = new ModelComparisonService();
  }
  return modelComparisonService;
}
