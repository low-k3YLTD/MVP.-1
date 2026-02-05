/**
 * MLflow Integration Service
 * Tracks experiments, logs metrics, and manages model registry
 */

import type { TrainingResult } from "./mlTrainingService";

export interface ExperimentConfig {
  experimentName: string;
  runName: string;
  tags: Record<string, string>;
  params: Record<string, any>;
}

export interface MLflowRun {
  runId: string;
  experimentId: string;
  status: "RUNNING" | "SCHEDULED" | "FINISHED" | "FAILED";
  startTime: number;
  endTime?: number;
  metrics: Record<string, number>;
  params: Record<string, string>;
  tags: Record<string, string>;
}

export interface RegisteredModel {
  name: string;
  version: number;
  stage: "None" | "Staging" | "Production" | "Archived";
  source: string;
  createdAt: Date;
  metrics: Record<string, number>;
}

class MLflowIntegrationService {
  private runs: Map<string, MLflowRun> = new Map();
  private experiments: Map<string, string[]> = new Map();
  private registeredModels: Map<string, RegisteredModel[]> = new Map();
  private currentRunId: string | null = null;

  /**
   * Create or get experiment
   */
  createExperiment(experimentName: string): string {
    const experimentId = `exp_${Date.now()}`;

    if (!this.experiments.has(experimentId)) {
      this.experiments.set(experimentId, []);
    }

    console.log(`[MLflow] Created experiment: ${experimentName} (${experimentId})`);
    return experimentId;
  }

  /**
   * Start a new run
   */
  startRun(config: ExperimentConfig): string {
    const runId = `run_${Date.now()}`;

    const run: MLflowRun = {
      runId,
      experimentId: config.experimentName,
      status: "RUNNING",
      startTime: Date.now(),
      metrics: {},
      params: Object.entries(config.params).reduce(
        (acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        },
        {} as Record<string, string>
      ),
      tags: config.tags,
    };

    this.runs.set(runId, run);
    this.currentRunId = runId;

    console.log(`[MLflow] Started run: ${config.runName} (${runId})`);
    return runId;
  }

  /**
   * Log metrics to current run
   */
  logMetrics(metrics: Record<string, number>, step?: number): void {
    if (!this.currentRunId) {
      console.warn("[MLflow] No active run, cannot log metrics");
      return;
    }

    const run = this.runs.get(this.currentRunId);
    if (!run) return;

    for (const [key, value] of Object.entries(metrics)) {
      const metricKey = step !== undefined ? `${key}_step_${step}` : key;
      run.metrics[metricKey] = value;
    }

    console.log(`[MLflow] Logged ${Object.keys(metrics).length} metrics`);
  }

  /**
   * Log parameters to current run
   */
  logParams(params: Record<string, any>): void {
    if (!this.currentRunId) {
      console.warn("[MLflow] No active run, cannot log params");
      return;
    }

    const run = this.runs.get(this.currentRunId);
    if (!run) return;

    for (const [key, value] of Object.entries(params)) {
      run.params[key] = String(value);
    }

    console.log(`[MLflow] Logged ${Object.keys(params).length} parameters`);
  }

  /**
   * Log tags to current run
   */
  logTags(tags: Record<string, string>): void {
    if (!this.currentRunId) {
      console.warn("[MLflow] No active run, cannot log tags");
      return;
    }

    const run = this.runs.get(this.currentRunId);
    if (!run) return;

    run.tags = { ...run.tags, ...tags };

    console.log(`[MLflow] Logged ${Object.keys(tags).length} tags`);
  }

  /**
   * End current run
   */
  endRun(status: "FINISHED" | "FAILED" = "FINISHED"): void {
    if (!this.currentRunId) {
      console.warn("[MLflow] No active run to end");
      return;
    }

    const run = this.runs.get(this.currentRunId);
    if (run) {
      run.status = status;
      run.endTime = Date.now();

      const duration = ((run.endTime - run.startTime) / 1000).toFixed(2);
      console.log(`[MLflow] Ended run: ${this.currentRunId} (${duration}s, status: ${status})`);
    }

    this.currentRunId = null;
  }

  /**
   * Register model to registry
   */
  registerModel(modelName: string, source: string, metrics: Record<string, number>): RegisteredModel {
    if (!this.registeredModels.has(modelName)) {
      this.registeredModels.set(modelName, []);
    }

    const versions = this.registeredModels.get(modelName)!;
    const version = versions.length + 1;

    const model: RegisteredModel = {
      name: modelName,
      version,
      stage: "None",
      source,
      createdAt: new Date(),
      metrics,
    };

    versions.push(model);

    console.log(`[MLflow] Registered model: ${modelName} v${version}`);
    return model;
  }

  /**
   * Transition model stage
   */
  transitionModelStage(modelName: string, version: number, stage: "Staging" | "Production" | "Archived"): void {
    const versions = this.registeredModels.get(modelName);
    if (!versions) {
      console.warn(`[MLflow] Model not found: ${modelName}`);
      return;
    }

    const model = versions.find((m) => m.version === version);
    if (!model) {
      console.warn(`[MLflow] Model version not found: ${modelName} v${version}`);
      return;
    }

    model.stage = stage;
    console.log(`[MLflow] Transitioned ${modelName} v${version} to ${stage}`);
  }

  /**
   * Log training result
   */
  async logTrainingResult(result: TrainingResult, config: ExperimentConfig): Promise<void> {
    const runId = this.startRun(config);

    this.logParams({
      model_type: result.modelType,
      data_points: result.dataPoints,
      ...result.hyperparameters,
    });

    this.logMetrics({
      ndcg_at_3: result.ndcgAt3,
      ndcg_at_5: result.ndcgAt5,
      win_accuracy: result.winAccuracy,
      place_accuracy: result.placeAccuracy,
      show_accuracy: result.showAccuracy,
      training_time_ms: result.trainingTime,
    });

    this.logTags({
      model_id: result.modelId,
      status: result.success ? "success" : "failed",
    });

    this.endRun(result.success ? "FINISHED" : "FAILED");

    if (result.success) {
      this.registerModel(result.modelType, result.modelId, {
        ndcg_at_3: result.ndcgAt3,
        ndcg_at_5: result.ndcgAt5,
        win_accuracy: result.winAccuracy,
      });
    }
  }

  /**
   * Get run details
   */
  getRun(runId: string): MLflowRun | null {
    return this.runs.get(runId) || null;
  }

  /**
   * Get all runs for experiment
   */
  getExperimentRuns(experimentId: string): MLflowRun[] {
    const runIds = this.experiments.get(experimentId) || [];
    return runIds.map((id) => this.runs.get(id)!).filter((r) => r !== undefined);
  }

  /**
   * Get registered models
   */
  getRegisteredModels(modelName?: string): RegisteredModel[] {
    if (modelName) {
      return this.registeredModels.get(modelName) || [];
    }

    const allModels: RegisteredModel[] = [];
    this.registeredModels.forEach((versions) => {
      allModels.push(...versions);
    });
    return allModels;
  }

  /**
   * Get best model by metric
   */
  getBestModel(metric: string = "ndcg_at_3"): RegisteredModel | null {
    const allModels = this.getRegisteredModels();
    if (allModels.length === 0) return null;

    return allModels.reduce((best, current) => {
      const bestMetric = best.metrics[metric] || 0;
      const currentMetric = current.metrics[metric] || 0;
      return currentMetric > bestMetric ? current : best;
    });
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const allRuns = Array.from(this.runs.values());
    const finishedRuns = allRuns.filter((r) => r.status === "FINISHED");
    const failedRuns = allRuns.filter((r) => r.status === "FAILED");

    const metrics = finishedRuns.flatMap((r) => Object.values(r.metrics));

    return {
      totalRuns: allRuns.length,
      finishedRuns: finishedRuns.length,
      failedRuns: failedRuns.length,
      totalExperiments: this.experiments.size,
      totalRegisteredModels: this.registeredModels.size,
      averageMetric: metrics.length > 0 ? metrics.reduce((a, b) => a + b, 0) / metrics.length : 0,
    };
  }
}

let instance: MLflowIntegrationService | null = null;

export function getMLflowIntegrationService(): MLflowIntegrationService {
  if (!instance) {
    instance = new MLflowIntegrationService();
  }
  return instance;
}
