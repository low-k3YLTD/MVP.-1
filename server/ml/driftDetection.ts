/**
 * Drift Detection Engine
 * Monitors for data drift, prediction drift, and concept drift
 * Triggers auto-retraining when drift detected
 */

import { spawn } from "child_process";
import * as path from "path";

export interface DriftSignal {
  type: "data" | "prediction" | "concept";
  severity: "low" | "medium" | "high" | "critical";
  pValue: number;
  threshold: number;
  detectedAt: Date;
  affectedFeatures: string[];
  recommendation: string;
}

export interface DriftReport {
  timestamp: Date;
  signals: DriftSignal[];
  overallDriftDetected: boolean;
  shouldRetrain: boolean;
  retrainingPriority: "low" | "medium" | "high" | "critical";
  nextCheckTime: Date;
}

/**
 * Detect data drift using Kolmogorov-Smirnov test
 */
export async function detectDataDrift(
  baselineDataPath: string,
  recentDataPath: string
): Promise<DriftSignal[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "detect_data_drift.py");

    const config = {
      baselineDataPath,
      recentDataPath,
      threshold: 0.05, // p-value threshold
    };

    const pythonProcess = spawn("python3", [pythonScript, JSON.stringify(config)]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log(`[Data Drift Detection] ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error(`[Data Drift Error] ${data}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Data drift detection failed: ${errorOutput}`));
        return;
      }

      try {
        const signals = JSON.parse(output) as DriftSignal[];
        resolve(signals);
      } catch (e) {
        reject(new Error(`Failed to parse drift signals: ${output}`));
      }
    });
  });
}

/**
 * Detect prediction drift
 * Monitors if model output distribution is changing
 */
export async function detectPredictionDrift(
  baselinePredictions: number[],
  recentPredictions: number[]
): Promise<DriftSignal | null> {
  // Calculate statistics
  const baselineStats = calculateStats(baselinePredictions);
  const recentStats = calculateStats(recentPredictions);

  // Kolmogorov-Smirnov test
  const ksStatistic = kolmogorovSmirnovTest(baselinePredictions, recentPredictions);
  const pValue = ksStatistic.pValue;

  if (pValue < 0.05) {
    // Drift detected
    const severity =
      pValue < 0.01
        ? "critical"
        : pValue < 0.02
          ? "high"
          : pValue < 0.04
            ? "medium"
            : "low";

    return {
      type: "prediction",
      severity,
      pValue,
      threshold: 0.05,
      detectedAt: new Date(),
      affectedFeatures: ["prediction_output"],
      recommendation:
        severity === "critical"
          ? "Immediate retraining required"
          : "Schedule retraining within 24 hours",
    };
  }

  return null;
}

/**
 * Detect concept drift
 * Monitors if relationship between features and target is changing
 */
export async function detectConceptDrift(
  baselineAccuracy: number,
  recentAccuracy: number,
  threshold: number = 0.03
): Promise<DriftSignal | null> {
  const accuracyDrop = baselineAccuracy - recentAccuracy;

  if (accuracyDrop > threshold) {
    const severity =
      accuracyDrop > 0.08
        ? "critical"
        : accuracyDrop > 0.05
          ? "high"
          : accuracyDrop > 0.03
            ? "medium"
            : "low";

    return {
      type: "concept",
      severity,
      pValue: accuracyDrop, // Pseudo p-value
      threshold,
      detectedAt: new Date(),
      affectedFeatures: ["model_target_relationship"],
      recommendation:
        severity === "critical"
          ? "Immediate model retraining required"
          : "Investigate model performance degradation",
    };
  }

  return null;
}

/**
 * Run comprehensive drift detection
 */
export async function runDriftDetection(config: {
  baselineDataPath: string;
  recentDataPath: string;
  baselineAccuracy: number;
  recentAccuracy: number;
  baselinePredictions: number[];
  recentPredictions: number[];
}): Promise<DriftReport> {
  const signals: DriftSignal[] = [];

  try {
    // Data drift
    console.log("[Drift Detection] Checking for data drift...");
    const dataSignals = await detectDataDrift(config.baselineDataPath, config.recentDataPath);
    signals.push(...dataSignals);

    // Prediction drift
    console.log("[Drift Detection] Checking for prediction drift...");
    const predictionSignal = await detectPredictionDrift(
      config.baselinePredictions,
      config.recentPredictions
    );
    if (predictionSignal) signals.push(predictionSignal);

    // Concept drift
    console.log("[Drift Detection] Checking for concept drift...");
    const conceptSignal = await detectConceptDrift(config.baselineAccuracy, config.recentAccuracy);
    if (conceptSignal) signals.push(conceptSignal);

    // Determine if retraining is needed
    const overallDriftDetected = signals.length > 0;
    const criticalSignals = signals.filter((s) => s.severity === "critical");
    const shouldRetrain = overallDriftDetected;
    const retrainingPriority = criticalSignals.length > 0 ? "critical" : "high";

    // Calculate next check time
    const nextCheckTime = new Date();
    if (overallDriftDetected) {
      nextCheckTime.setHours(nextCheckTime.getHours() + 1); // Check again in 1 hour
    } else {
      nextCheckTime.setDate(nextCheckTime.getDate() + 1); // Check again tomorrow
    }

    return {
      timestamp: new Date(),
      signals,
      overallDriftDetected,
      shouldRetrain,
      retrainingPriority,
      nextCheckTime,
    };
  } catch (error) {
    console.error("[Drift Detection] Error:", error);
    throw error;
  }
}

/**
 * Helper: Calculate statistics for a dataset
 */
function calculateStats(data: number[]): {
  mean: number;
  std: number;
  min: number;
  max: number;
} {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance =
    data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
  const std = Math.sqrt(variance);

  return {
    mean,
    std,
    min: Math.min(...data),
    max: Math.max(...data),
  };
}

/**
 * Kolmogorov-Smirnov test
 * Tests if two distributions are different
 */
function kolmogorovSmirnovTest(
  data1: number[],
  data2: number[]
): {
  statistic: number;
  pValue: number;
} {
  // Sort both datasets
  const sorted1 = [...data1].sort((a, b) => a - b);
  const sorted2 = [...data2].sort((a, b) => a - b);

  // Calculate empirical CDFs
  let maxDiff = 0;
  let i = 0,
    j = 0;

  while (i < sorted1.length && j < sorted2.length) {
    const cdf1 = (i + 1) / sorted1.length;
    const cdf2 = (j + 1) / sorted2.length;

    const diff = Math.abs(cdf1 - cdf2);
    maxDiff = Math.max(maxDiff, diff);

    if (sorted1[i] <= sorted2[j]) {
      i++;
    } else {
      j++;
    }
  }

  // Approximate p-value using Kolmogorov distribution
  const n = Math.min(sorted1.length, sorted2.length);
  const pValue = Math.exp(-2 * n * maxDiff * maxDiff);

  return {
    statistic: maxDiff,
    pValue,
  };
}

/**
 * Format drift report for logging
 */
export function formatDriftReport(report: DriftReport): string {
  let output = `\n[Drift Detection Report] ${report.timestamp.toISOString()}\n`;
  output += `Overall Drift Detected: ${report.overallDriftDetected ? "YES" : "NO"}\n`;
  output += `Should Retrain: ${report.shouldRetrain ? "YES" : "NO"}\n`;
  output += `Retraining Priority: ${report.retrainingPriority}\n`;
  output += `Next Check: ${report.nextCheckTime.toISOString()}\n`;

  if (report.signals.length > 0) {
    output += `\nDetected Signals (${report.signals.length}):\n`;
    for (const signal of report.signals) {
      output += `  - [${signal.severity.toUpperCase()}] ${signal.type} drift (p=${signal.pValue.toFixed(4)})\n`;
      output += `    Recommendation: ${signal.recommendation}\n`;
    }
  }

  return output;
}
