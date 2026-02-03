/**
 * Advanced ML Model Training Pipeline
 * CatBoost + TabNet Ensemble with SHAP Explainability
 * Target: NDCG > 0.97
 */

import { spawn } from "child_process";
import * as path from "path";

export interface TrainingConfig {
  modelType: "catboost" | "tabnet" | "ensemble";
  dataPath: string;
  outputPath: string;
  testSize: number;
  randomState: number;
  hyperparameters: Record<string, unknown>;
}

export interface ModelMetrics {
  ndcg4: number;
  ndcg3: number;
  ndcg2: number;
  accuracy: number;
  precision: number;
  recall: number;
  calibrationError: number;
  inferenceLatency: number; // ms
}

export interface TrainingResult {
  modelPath: string;
  metrics: ModelMetrics;
  timestamp: Date;
  hyperparameters: Record<string, unknown>;
  featureImportance: Array<{ feature: string; importance: number }>;
}

/**
 * CatBoost Model Training
 * Optimized for ranking with YetiRank loss
 */
export async function trainCatBoostModel(config: TrainingConfig): Promise<TrainingResult> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "train_catboost.py");

    const pythonProcess = spawn("python3", [pythonScript, JSON.stringify(config)]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log(`[CatBoost] ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error(`[CatBoost Error] ${data}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`CatBoost training failed: ${errorOutput}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        resolve(result as TrainingResult);
      } catch (e) {
        reject(new Error(`Failed to parse CatBoost output: ${output}`));
      }
    });
  });
}

/**
 * TabNet Model Training
 * Attention-based neural network with interpretability
 */
export async function trainTabNetModel(config: TrainingConfig): Promise<TrainingResult> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "train_tabnet.py");

    const pythonProcess = spawn("python3", [pythonScript, JSON.stringify(config)]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log(`[TabNet] ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error(`[TabNet Error] ${data}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`TabNet training failed: ${errorOutput}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        resolve(result as TrainingResult);
      } catch (e) {
        reject(new Error(`Failed to parse TabNet output: ${output}`));
      }
    });
  });
}

/**
 * Build Ensemble Stacking Layer
 * Combines CatBoost and TabNet with optimal weights
 */
export async function buildEnsembleStack(
  catboostModel: TrainingResult,
  tabnetModel: TrainingResult,
  validationDataPath: string
): Promise<TrainingResult> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "build_ensemble.py");

    const config = {
      catboostModelPath: catboostModel.modelPath,
      tabnetModelPath: tabnetModel.modelPath,
      validationDataPath,
      weights: {
        catboost: 0.6, // CatBoost stronger for ranking
        tabnet: 0.4, // TabNet for non-linearity
      },
    };

    const pythonProcess = spawn("python3", [pythonScript, JSON.stringify(config)]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log(`[Ensemble] ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error(`[Ensemble Error] ${data}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Ensemble building failed: ${errorOutput}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        resolve(result as TrainingResult);
      } catch (e) {
        reject(new Error(`Failed to parse ensemble output: ${output}`));
      }
    });
  });
}

/**
 * Full Training Pipeline
 * Trains both models and builds ensemble
 */
export async function runFullTrainingPipeline(config: TrainingConfig): Promise<{
  catboost: TrainingResult;
  tabnet: TrainingResult;
  ensemble: TrainingResult;
}> {
  console.log("[Training Pipeline] Starting full training pipeline...");

  try {
    // Train CatBoost
    console.log("[Training Pipeline] Training CatBoost model...");
    const catboostResult = await trainCatBoostModel({
      ...config,
      modelType: "catboost",
      hyperparameters: {
        iterations: 1000,
        learning_rate: 0.05,
        depth: 8,
        loss_function: "YetiRank",
        eval_metric: "NDCG:top=4",
        early_stopping_rounds: 50,
      },
    });
    console.log(`[Training Pipeline] CatBoost NDCG@4: ${catboostResult.metrics.ndcg4}`);

    // Train TabNet
    console.log("[Training Pipeline] Training TabNet model...");
    const tabnetResult = await trainTabNetModel({
      ...config,
      modelType: "tabnet",
      hyperparameters: {
        n_steps: 5,
        n_independent: 2,
        n_shared: 2,
        mask_type: "sparsemax",
        lambda_sparse: 0.001,
      },
    });
    console.log(`[Training Pipeline] TabNet NDCG@4: ${tabnetResult.metrics.ndcg4}`);

    // Build Ensemble
    console.log("[Training Pipeline] Building ensemble stack...");
    const ensembleResult = await buildEnsembleStack(
      catboostResult,
      tabnetResult,
      config.dataPath // Use validation set
    );
    console.log(`[Training Pipeline] Ensemble NDCG@4: ${ensembleResult.metrics.ndcg4}`);

    // Validate NDCG target
    if (ensembleResult.metrics.ndcg4 < 0.97) {
      console.warn(
        `[Training Pipeline] Warning: NDCG@4 (${ensembleResult.metrics.ndcg4}) below target (0.97)`
      );
    } else {
      console.log("[Training Pipeline] ✓ NDCG target achieved!");
    }

    return {
      catboost: catboostResult,
      tabnet: tabnetResult,
      ensemble: ensembleResult,
    };
  } catch (error) {
    console.error("[Training Pipeline] Error:", error);
    throw error;
  }
}

/**
 * Model Validation
 * Ensures model meets quality standards before deployment
 */
export function validateModel(result: TrainingResult): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check NDCG
  if (result.metrics.ndcg4 < 0.95) {
    issues.push(`NDCG@4 too low: ${result.metrics.ndcg4} (target: >0.97)`);
  }
  if (result.metrics.ndcg4 < 0.97) {
    warnings.push(`NDCG@4 below target: ${result.metrics.ndcg4}`);
  }

  // Check accuracy
  if (result.metrics.accuracy < 0.85) {
    issues.push(`Accuracy too low: ${result.metrics.accuracy} (target: >0.93)`);
  }
  if (result.metrics.accuracy < 0.93) {
    warnings.push(`Accuracy below target: ${result.metrics.accuracy}`);
  }

  // Check calibration
  if (result.metrics.calibrationError > 0.1) {
    warnings.push(`Calibration error high: ${result.metrics.calibrationError}`);
  }

  // Check inference latency
  if (result.metrics.inferenceLatency > 200) {
    warnings.push(`Inference latency high: ${result.metrics.inferenceLatency}ms`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
  };
}
