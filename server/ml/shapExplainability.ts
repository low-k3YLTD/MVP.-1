/**
 * SHAP Explainability Service
 * Generates trustworthy explanations for predictions
 * Drives premium upsell through transparency
 */

import { spawn } from "child_process";
import * as path from "path";

export interface ShapExplanation {
  prediction: number;
  confidence: number;
  topReasons: Array<{
    feature: string;
    impact: number; // SHAP value
    direction: "positive" | "negative";
    description: string;
  }>;
  modelAgreement: number; // 0-1, how well models agree
  historicalValidation: {
    similarRaces: number;
    winRate: number;
    successCriteria: string;
  };
  riskFactors: string[];
  trustScore: number; // 0-100
}

export interface ExplanationRequest {
  prediction: number;
  features: Record<string, number>;
  horseName: string;
  raceName: string;
  modelPath: string;
}

/**
 * Generate SHAP-based explanation for a prediction
 */
export async function generateExplanation(request: ExplanationRequest): Promise<ShapExplanation> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "generate_shap_explanation.py");

    const pythonProcess = spawn("python3", [pythonScript, JSON.stringify(request)]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log(`[SHAP] ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error(`[SHAP Error] ${data}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`SHAP explanation failed: ${errorOutput}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        resolve(result as ShapExplanation);
      } catch (e) {
        reject(new Error(`Failed to parse SHAP output: ${output}`));
      }
    });
  });
}

/**
 * Format explanation for user display
 */
export function formatExplanationForUI(explanation: ShapExplanation): {
  headline: string;
  reasons: string[];
  confidence: string;
  validation: string;
  risks: string[];
  trustBadge: "high" | "medium" | "low";
} {
  // Headline
  const topReason = explanation.topReasons[0];
  const headline = `We favor this horse because of ${topReason.feature.toLowerCase()} (${topReason.description})`;

  // Reasons
  const reasons = explanation.topReasons.map((r) => {
    const impact = Math.abs(r.impact).toFixed(2);
    const direction = r.direction === "positive" ? "✓" : "✗";
    return `${direction} ${r.feature}: ${r.description} (${impact})`;
  });

  // Confidence
  const confidenceLevel =
    explanation.confidence > 0.8
      ? "Very High"
      : explanation.confidence > 0.6
        ? "High"
        : explanation.confidence > 0.4
          ? "Medium"
          : "Low";
  const confidence = `${confidenceLevel} Confidence (${(explanation.confidence * 100).toFixed(0)}%)`;

  // Validation
  const validation = `In ${explanation.historicalValidation.similarRaces} similar races, horses with this profile won ${(explanation.historicalValidation.winRate * 100).toFixed(0)}% of the time`;

  // Trust badge
  const trustBadge: "high" | "medium" | "low" =
    explanation.trustScore > 75 ? "high" : explanation.trustScore > 50 ? "medium" : "low";

  return {
    headline,
    reasons,
    confidence,
    validation,
    risks: explanation.riskFactors,
    trustBadge,
  };
}

/**
 * Generate comparative explanation
 * Why this horse vs. competitors
 */
export async function generateComparativeExplanation(
  predictions: Array<{
    horseName: string;
    prediction: number;
    features: Record<string, number>;
  }>,
  modelPath: string
): Promise<{
  topHorse: string;
  keyDifferentiators: Array<{
    feature: string;
    topValue: number;
    competitorAvg: number;
    advantage: number;
  }>;
  riskFactors: Array<{
    feature: string;
    topValue: number;
    competitorAvg: number;
    concern: string;
  }>;
}> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "generate_comparative_explanation.py");

    const request = {
      predictions,
      modelPath,
    };

    const pythonProcess = spawn("python3", [pythonScript, JSON.stringify(request)]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error(`[Comparative Explanation Error] ${data}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Comparative explanation failed: ${errorOutput}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse comparative explanation: ${output}`));
      }
    });
  });
}

/**
 * Calculate trust score based on multiple factors
 */
export function calculateTrustScore(explanation: Partial<ShapExplanation>): number {
  let score = 50; // Base score

  // Model agreement (0-25 points)
  if (explanation.modelAgreement !== undefined) {
    score += explanation.modelAgreement * 25;
  }

  // Confidence (0-25 points)
  if (explanation.confidence !== undefined) {
    score += explanation.confidence * 25;
  }

  // Historical validation (0-25 points)
  if (explanation.historicalValidation?.winRate !== undefined) {
    score += explanation.historicalValidation.winRate * 25;
  }

  // Risk factors penalty (-0-25 points)
  if (explanation.riskFactors && explanation.riskFactors.length > 0) {
    score -= explanation.riskFactors.length * 3;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine if explanation is good enough for premium upsell
 */
export function shouldPromotePremium(explanation: ShapExplanation): boolean {
  // Premium upsell when:
  // 1. High confidence (>0.75)
  // 2. High model agreement (>0.85)
  // 3. Good historical validation (>60% win rate)
  // 4. Few risk factors (<2)

  const highConfidence = explanation.confidence > 0.75;
  const highAgreement = explanation.modelAgreement > 0.85;
  const goodValidation = explanation.historicalValidation.winRate > 0.6;
  const fewRisks = explanation.riskFactors.length < 2;

  return highConfidence && highAgreement && goodValidation && fewRisks;
}

/**
 * Generate explanation summary for logging/analytics
 */
export function summarizeExplanation(explanation: ShapExplanation): {
  topFeature: string;
  topImpact: number;
  confidenceLevel: string;
  trustLevel: string;
  premiumReady: boolean;
} {
  const topFeature = explanation.topReasons[0]?.feature || "Unknown";
  const topImpact = Math.abs(explanation.topReasons[0]?.impact || 0);

  const confidenceLevel =
    explanation.confidence > 0.8
      ? "Very High"
      : explanation.confidence > 0.6
        ? "High"
        : explanation.confidence > 0.4
          ? "Medium"
          : "Low";

  const trustLevel =
    explanation.trustScore > 75
      ? "High"
      : explanation.trustScore > 50
        ? "Medium"
        : "Low";

  const premiumReady = shouldPromotePremium(explanation);

  return {
    topFeature,
    topImpact,
    confidenceLevel,
    trustLevel,
    premiumReady,
  };
}
