/**
 * Automated Retraining Service
 * Orchestrates model retraining based on drift detection and performance metrics
 * Manages retraining queue, model versioning, and A/B test promotion
 */

import { getDriftIntegrationService } from "./driftIntegrationService";
import { getModelComparisonService } from "./modelComparisonService";
import { getModelTrainingOrchestrator } from "./modelTrainingOrchestrator";
import { getMLflowIntegrationService } from "./mlflowIntegrationService";

export interface RetrainingJob {
  jobId: string;
  modelId: string;
  triggerReason: "drift_detected" | "performance_degradation" | "scheduled" | "manual";
  status: "pending" | "running" | "completed" | "failed";
  startTime?: Date;
  endTime?: Date;
  newModelVersion?: string;
  ndcgImprovement?: number;
  error?: string;
}

export interface RetrainingConfig {
  maxConcurrentJobs: number;
  jobTimeout: number; // milliseconds
  minDatapointsForRetraining: number;
  performanceThreshold: number; // minimum NDCG improvement required
  autoPromoteThreshold: number; // p-value for auto-promotion in A/B tests
}

const DEFAULT_CONFIG: RetrainingConfig = {
  maxConcurrentJobs: 2,
  jobTimeout: 30 * 60 * 1000, // 30 minutes
  minDatapointsForRetraining: 50,
  performanceThreshold: 0.01, // 1% improvement required
  autoPromoteThreshold: 0.05, // p < 0.05 for significance
};

class AutomatedRetrainingService {
  private config: RetrainingConfig;
  private retrainingQueue: RetrainingJob[] = [];
  private activeJobs: Map<string, RetrainingJob> = new Map();
  private completedJobs: Map<string, RetrainingJob> = new Map();
  private isRunning = false;

  constructor(config: Partial<RetrainingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the retraining orchestrator
   */
  start(): void {
    if (this.isRunning) {
      console.log("[AutomatedRetraining] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[AutomatedRetraining] Starting automated retraining service");
    this.processQueue();
  }

  /**
   * Stop the retraining orchestrator
   */
  stop(): void {
    this.isRunning = false;
    console.log("[AutomatedRetraining] Stopping automated retraining service");
  }

  /**
   * Queue a retraining job
   */
  queueRetrainingJob(
    modelId: string,
    triggerReason: RetrainingJob["triggerReason"]
  ): RetrainingJob {
    const job: RetrainingJob = {
      jobId: `retrain_${modelId}_${Date.now()}`,
      modelId,
      triggerReason,
      status: "pending",
    };

    this.retrainingQueue.push(job);
    console.log(`[AutomatedRetraining] Queued retraining job for model ${modelId}: ${triggerReason}`);

    return job;
  }

  /**
   * Process the retraining queue
   */
  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      try {
        // Process pending jobs if under concurrency limit
        if (this.activeJobs.size < this.config.maxConcurrentJobs && this.retrainingQueue.length > 0) {
          const job = this.retrainingQueue.shift()!;
          await this.executeRetrainingJob(job);
        }

        // Check for completed jobs
        for (const [jobId, job] of Array.from(this.activeJobs.entries())) {
          if (job.endTime && Date.now() - job.endTime.getTime() > 5000) {
            this.activeJobs.delete(jobId);
            this.completedJobs.set(jobId, job);
          }
        }

        // Sleep before next iteration
        await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 seconds
      } catch (error) {
        console.error("[AutomatedRetraining] Error in queue processing:", error);
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds before retrying
      }
    }
  }

  /**
   * Execute a retraining job
   */
  private async executeRetrainingJob(job: RetrainingJob): Promise<void> {
    job.status = "running";
    job.startTime = new Date();

    this.activeJobs.set(job.jobId, job);
    console.log(`[AutomatedRetraining] Starting job ${job.jobId} for model ${job.modelId}`);

    try {
      // Check if model should be retrained
      const driftService = getDriftIntegrationService();
      if (!driftService.shouldRetrain(job.modelId)) {
        job.status = "failed";
        job.error = "Model on cooldown or no critical drift";
        job.endTime = new Date();
        console.log(`[AutomatedRetraining] Job ${job.jobId} skipped: ${job.error}`);
        return;
      }

      // Execute real ML training pipeline
      const ndcgImprovement = await this.executeRealTraining(job.modelId, job.triggerReason);

      if (ndcgImprovement >= this.config.performanceThreshold) {
        job.status = "completed";
        job.newModelVersion = `v${Date.now()}`;
        job.ndcgImprovement = ndcgImprovement;

        // Mark model as retrained
        driftService.markRetrained(job.modelId);

        // Update model metrics
        const modelService = getModelComparisonService();
        const currentMetrics = modelService.getModelMetrics(job.modelId);
        if (currentMetrics) {
          modelService.updateModelMetrics(job.modelId, {
            ndcgAt3: currentMetrics.ndcgAt3 + ndcgImprovement,
            version: job.newModelVersion,
          });
        }

        console.log(
          `[AutomatedRetraining] Job ${job.jobId} completed successfully. NDCG improvement: ${(
            ndcgImprovement * 100
          ).toFixed(2)}%`
        );
      } else {
        job.status = "failed";
        job.error = `NDCG improvement (${(ndcgImprovement * 100).toFixed(2)}%) below threshold (${(
          this.config.performanceThreshold * 100
        ).toFixed(2)}%)`;
        console.log(`[AutomatedRetraining] Job ${job.jobId} failed: ${job.error}`);
      }
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown error";
      console.error(`[AutomatedRetraining] Job ${job.jobId} error:`, error);
    } finally {
      job.endTime = new Date();
    }
  }

  /**
   * Execute real ML training pipeline
   */
  private async executeRealTraining(modelId: string, reason: string): Promise<number> {
    const orchestrator = getModelTrainingOrchestrator();
    const mlflow = getMLflowIntegrationService();

    try {
      console.log(`[AutomatedRetraining] Starting real ML training for ${modelId}`);

      // Execute training pipeline
      const result = await orchestrator.executeTrainingPipeline(reason);

      if (!result.success) {
        console.error(`[AutomatedRetraining] Training failed: ${result.error}`);
        return 0;
      }

      // Log to MLflow
      if (result.bestModel) {
        await mlflow.logTrainingResult(result.bestModel, {
          experimentName: "horse_race_predictions",
          runName: `${modelId}_${reason}`,
          tags: {
            model_id: modelId,
            trigger_reason: reason,
          },
          params: result.bestModel.hyperparameters,
        });
      }

      return result.improvement;
    } catch (error) {
      console.error(`[AutomatedRetraining] Real training error:`, error);
      return 0;
    }
  }

  /**
   * Simulate retraining (fallback for testing)
   */
  private async simulateRetraining(modelId: string): Promise<number> {
    // Simulate retraining delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Return simulated NDCG improvement (0.5-2%)
    return 0.005 + Math.random() * 0.015;
  }

  /**
   * Get retraining job status
   */
  getJobStatus(jobId: string): RetrainingJob | null {
    return this.activeJobs.get(jobId) || this.completedJobs.get(jobId) || null;
  }

  /**
   * Use real training pipeline (production mode)
   */
  enableRealTraining(): void {
    console.log("[AutomatedRetraining] Real ML training pipeline enabled");
  }

  /**
   * Use simulated training (testing mode)
   */
  enableSimulatedTraining(): void {
    console.log("[AutomatedRetraining] Simulated training enabled");
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): RetrainingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get all completed jobs
   */
  getCompletedJobs(limit: number = 10): RetrainingJob[] {
    return Array.from(this.completedJobs.values()).slice(-limit);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    activeJobs: number;
    completedJobs: number;
  } {
    return {
      queueLength: this.retrainingQueue.length,
      activeJobs: this.activeJobs.size,
      completedJobs: this.completedJobs.size,
    };
  }

  /**
   * Check if any models need retraining
   */
  checkRetrainingNeeds(): {
    modelsNeedingRetrain: string[];
    reasons: Record<string, string>;
  } {
    const driftService = getDriftIntegrationService();
    const modelService = getModelComparisonService();
    const recommendation = modelService.getRetrainingRecommendation();

    const modelsNeedingRetrain = recommendation.affectedModels.filter((modelId) =>
      driftService.shouldRetrain(modelId)
    );

    const reasons: Record<string, string> = {};
    for (const modelId of modelsNeedingRetrain) {
      reasons[modelId] = recommendation.reason;
    }

    return { modelsNeedingRetrain, reasons };
  }

  /**
   * Promote winner from A/B test to production
   */
  promoteABTestWinner(testId: string): {
    success: boolean;
    message: string;
    promotedModel?: string;
  } {
    const modelService = getModelComparisonService();
    const test = modelService.getABTest(testId);

    if (!test) {
      return { success: false, message: `A/B test ${testId} not found` };
    }

    if (test.status !== "concluded") {
      return { success: false, message: `A/B test ${testId} is still active` };
    }

    if (!test.isSignificant) {
      return { success: false, message: `A/B test ${testId} results not statistically significant` };
    }

    // Promote treatment model if it has better NDCG
    const winner = test.treatmentNDCG > test.controlNDCG ? test.treatmentModelId : test.controlModelId;

    // Update weights to favor winner
    modelService.setModelWeight(winner, 0.7, true);
    const loser = winner === test.treatmentModelId ? test.controlModelId : test.treatmentModelId;
    modelService.setModelWeight(loser, 0.3, true);

    console.log(`[AutomatedRetraining] Promoted ${winner} from A/B test ${testId}`);

    return {
      success: true,
      message: `Promoted ${winner} to production with 70% weight`,
      promotedModel: winner,
    };
  }

  /**
   * Get retraining statistics
   */
  getStatistics(): {
    totalJobsCompleted: number;
    successfulJobs: number;
    failedJobs: number;
    averageNDCGImprovement: number;
    lastRetrainingTime?: Date;
  } {
    const completed = Array.from(this.completedJobs.values());
    const successful = completed.filter((j) => j.status === "completed");
    const failed = completed.filter((j) => j.status === "failed");
    const avgImprovement =
      successful.length > 0
        ? successful.reduce((sum, j) => sum + (j.ndcgImprovement || 0), 0) / successful.length
        : 0;

    const lastJob = completed[completed.length - 1];

    return {
      totalJobsCompleted: completed.length,
      successfulJobs: successful.length,
      failedJobs: failed.length,
      averageNDCGImprovement: avgImprovement,
      lastRetrainingTime: lastJob?.endTime,
    };
  }
}

// Singleton instance
let automatedRetrainingService: AutomatedRetrainingService | null = null;

export function getAutomatedRetrainingService(): AutomatedRetrainingService {
  if (!automatedRetrainingService) {
    automatedRetrainingService = new AutomatedRetrainingService();
  }
  return automatedRetrainingService;
}
