/**
 * Predictive Meta-Learning Engine
 * Forecasts workflow evolution and pattern phase transitions
 * Anticipates optimal moments for intervention
 */

export interface PatternMetrics {
  timestamp: Date;
  correlationStrength: number;
  anomalyDensity: number;
  trendAcceleration: number;
  entropyLevel: number;
  confidenceVariance: number;
}

export interface WorkflowForecast {
  horizon: "1week" | "2weeks" | "1month";
  predictedPhase: "acceleration" | "deceleration" | "plateau" | "transition" | "chaos";
  confidence: number;
  keyIndicators: string[];
  recommendedActions: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  opportunityWindow: {
    startsIn: number; // days
    duration: number; // days
    action: string;
  };
}

export interface CapabilityUnlock {
  capabilityId: string;
  name: string;
  description: string;
  triggerPatterns: string[];
  readinessScore: number; // 0-1
  estimatedTimeToUnlock: number; // days
  prerequisiteCapabilities: string[];
}

export class PredictiveMetaLearningService {
  /**
   * Forecast workflow evolution based on pattern trajectory
   */
  static forecastWorkflow(metrics: PatternMetrics[]): WorkflowForecast {
    if (metrics.length < 3) {
      return {
        horizon: "1week",
        predictedPhase: "plateau",
        confidence: 0.3,
        keyIndicators: ["Insufficient data"],
        recommendedActions: ["Continue collecting workflow data"],
        riskLevel: "low",
        opportunityWindow: { startsIn: 7, duration: 7, action: "Monitor" },
      };
    }

    // Calculate second-order derivatives (acceleration)
    const trendAccelerations = this.calculateAccelerations(metrics);
    const entropyTrend = this.calculateTrend(metrics.map((m) => m.entropyLevel));
    const correlationTrend = this.calculateTrend(metrics.map((m) => m.correlationStrength));
    const anomalyTrend = this.calculateTrend(metrics.map((m) => m.anomalyDensity));

    // Detect phase transitions
    const phase = this.detectPhase(trendAccelerations, entropyTrend, anomalyTrend);
    const confidence = this.calculateForecastConfidence(metrics);

    // Generate recommendations based on phase
    const recommendations = this.generateRecommendations(phase, metrics);
    const opportunityWindow = this.identifyOpportunityWindow(phase, metrics);

    return {
      horizon: "2weeks",
      predictedPhase: phase,
      confidence,
      keyIndicators: this.extractKeyIndicators(metrics, phase),
      recommendedActions: recommendations,
      riskLevel: this.assessRiskLevel(phase, confidence),
      opportunityWindow,
    };
  }

  /**
   * Discover capabilities user is ready to unlock
   */
  static discoverCapabilities(metrics: PatternMetrics[], userHistory: any[]): CapabilityUnlock[] {
    const capabilities: CapabilityUnlock[] = [];

    // Capability 1: Advanced Ensemble Weighting
    if (this.meetsEnsembleCapability(metrics)) {
      capabilities.push({
        capabilityId: "advanced-ensemble",
        name: "Advanced Ensemble Weighting",
        description: "Dynamically weight models based on real-time performance patterns",
        triggerPatterns: ["high-correlation-stability", "low-anomaly-density"],
        readinessScore: this.calculateReadiness(metrics, ["high-correlation-stability"]),
        estimatedTimeToUnlock: 3,
        prerequisiteCapabilities: [],
      });
    }

    // Capability 2: Exotic Bet Optimization
    if (this.meetsExoticBetCapability(metrics, userHistory)) {
      capabilities.push({
        capabilityId: "exotic-bets",
        name: "Exotic Bet Optimization",
        description: "Optimize complex multi-leg bets using pattern-based probability",
        triggerPatterns: ["high-accuracy", "stable-trends", "low-variance"],
        readinessScore: this.calculateReadiness(metrics, ["high-accuracy", "stable-trends"]),
        estimatedTimeToUnlock: 5,
        prerequisiteCapabilities: ["advanced-ensemble"],
      });
    }

    // Capability 3: Real-Time Adaptation
    if (this.meetsAdaptationCapability(metrics)) {
      capabilities.push({
        capabilityId: "real-time-adapt",
        name: "Real-Time Adaptation",
        description: "Automatically recalibrate models as new patterns emerge",
        triggerPatterns: ["high-anomaly-detection", "fast-recovery"],
        readinessScore: this.calculateReadiness(metrics, ["high-anomaly-detection"]),
        estimatedTimeToUnlock: 7,
        prerequisiteCapabilities: [],
      });
    }

    // Capability 4: Collaborative Pattern Sharing
    if (this.meetsCollaborationCapability(metrics)) {
      capabilities.push({
        capabilityId: "collab-patterns",
        name: "Collaborative Pattern Sharing",
        description: "Share and learn from other users' pattern discoveries",
        triggerPatterns: ["pattern-mastery", "high-confidence"],
        readinessScore: this.calculateReadiness(metrics, ["pattern-mastery"]),
        estimatedTimeToUnlock: 2,
        prerequisiteCapabilities: [],
      });
    }

    return capabilities.sort((a, b) => b.readinessScore - a.readinessScore);
  }

  /**
   * Identify optimal intervention moments
   */
  static identifyInterventionMoments(metrics: PatternMetrics[]): Array<{
    timepoint: Date;
    action: string;
    expectedImpact: "high" | "medium" | "low";
    urgency: "immediate" | "soon" | "planned";
  }> {
    const moments: Array<{
      timepoint: Date;
      action: string;
      expectedImpact: "high" | "medium" | "low";
      urgency: "immediate" | "soon" | "planned";
    }> = [];

    if (metrics.length < 2) return moments;

    const latest = metrics[metrics.length - 1];
    const previous = metrics[metrics.length - 2];

    // Detect anomaly clusters (precursor to phase transitions)
    if (latest.anomalyDensity > 0.6 && previous.anomalyDensity > 0.4) {
      moments.push({
        timepoint: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        action: "Investigate emerging anomalies before they compound",
        expectedImpact: "high",
        urgency: "soon",
      });
    }

    // Detect entropy spikes (chaos emerging)
    if (latest.entropyLevel > 0.7 && previous.entropyLevel < 0.5) {
      moments.push({
        timepoint: new Date(),
        action: "Recalibrate models immediately - chaos detected",
        expectedImpact: "high",
        urgency: "immediate",
      });
    }

    // Detect correlation weakening (model agreement breaking down)
    if (latest.correlationStrength < 0.5 && previous.correlationStrength > 0.7) {
      moments.push({
        timepoint: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
        action: "Review model ensemble - agreement degrading",
        expectedImpact: "medium",
        urgency: "soon",
      });
    }

    // Detect positive acceleration (momentum building)
    if (latest.trendAcceleration > 0.3 && previous.trendAcceleration > 0.2) {
      moments.push({
        timepoint: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        action: "Scale up successful patterns - momentum detected",
        expectedImpact: "medium",
        urgency: "planned",
      });
    }

    return moments;
  }

  // ============ Private Helpers ============

  private static calculateAccelerations(metrics: PatternMetrics[]): number[] {
    const accelerations: number[] = [];
    for (let i = 2; i < metrics.length; i++) {
      const acc =
        (metrics[i].trendAcceleration - metrics[i - 1].trendAcceleration) -
        (metrics[i - 1].trendAcceleration - metrics[i - 2].trendAcceleration);
      accelerations.push(acc);
    }
    return accelerations;
  }

  private static calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const recent = values.slice(-5);
    const slope = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
    return slope;
  }

  private static detectPhase(
    accelerations: number[],
    entropyTrend: number,
    anomalyTrend: number
  ): "acceleration" | "deceleration" | "plateau" | "transition" | "chaos" {
    const avgAccel = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;

    if (entropyTrend > 0.3) return "chaos";
    if (Math.abs(avgAccel) > 0.2 && avgAccel > 0) return "acceleration";
    if (Math.abs(avgAccel) > 0.2 && avgAccel < 0) return "deceleration";
    if (anomalyTrend > 0.15) return "transition";
    return "plateau";
  }

  private static calculateForecastConfidence(metrics: PatternMetrics[]): number {
    // More consistent metrics = higher confidence
    const variances = [
      this.variance(metrics.map((m) => m.correlationStrength)),
      this.variance(metrics.map((m) => m.anomalyDensity)),
      this.variance(metrics.map((m) => m.entropyLevel)),
    ];
    const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
    return Math.max(0.3, 1 - avgVariance);
  }

  private static variance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private static generateRecommendations(
    phase: string,
    metrics: PatternMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    switch (phase) {
      case "acceleration":
        recommendations.push("Increase prediction frequency to capture momentum");
        recommendations.push("Scale successful calibration patterns");
        break;
      case "deceleration":
        recommendations.push("Review and refresh training data");
        recommendations.push("Investigate model drift");
        break;
      case "chaos":
        recommendations.push("Pause production predictions");
        recommendations.push("Initiate emergency recalibration");
        break;
      case "transition":
        recommendations.push("Prepare for workflow changes");
        recommendations.push("Document current patterns before shift");
        break;
      case "plateau":
        recommendations.push("Optimize existing patterns");
        recommendations.push("Explore new feature combinations");
        break;
    }

    return recommendations;
  }

  private static identifyOpportunityWindow(phase: string, metrics: PatternMetrics[]) {
    return {
      startsIn: phase === "acceleration" ? 1 : phase === "transition" ? 3 : 7,
      duration: phase === "acceleration" ? 14 : phase === "transition" ? 7 : 30,
      action:
        phase === "acceleration"
          ? "Scale up"
          : phase === "transition"
            ? "Prepare for change"
            : "Optimize",
    };
  }

  private static extractKeyIndicators(metrics: PatternMetrics[], phase: string): string[] {
    const latest = metrics[metrics.length - 1];
    const indicators: string[] = [];

    if (latest.correlationStrength > 0.7) indicators.push("High model agreement");
    if (latest.anomalyDensity > 0.5) indicators.push("Elevated anomalies");
    if (latest.entropyLevel > 0.6) indicators.push("High entropy");
    if (latest.trendAcceleration > 0.3) indicators.push("Positive acceleration");

    return indicators.length > 0 ? indicators : ["Stable patterns"];
  }

  private static assessRiskLevel(
    phase: string,
    confidence: number
  ): "low" | "medium" | "high" | "critical" {
    if (phase === "chaos") return "critical";
    if (phase === "transition" && confidence < 0.5) return "high";
    if (phase === "deceleration") return "medium";
    return "low";
  }

  private static meetsEnsembleCapability(metrics: PatternMetrics[]): boolean {
    const recent = metrics.slice(-10);
    const avgCorrelation = recent.reduce((a, m) => a + m.correlationStrength, 0) / recent.length;
    return avgCorrelation > 0.65;
  }

  private static meetsExoticBetCapability(metrics: PatternMetrics[], userHistory: any[]): boolean {
    const recent = metrics.slice(-10);
    const avgCorrelation = recent.reduce((a, m) => a + m.correlationStrength, 0) / recent.length;
    const avgAnomaly = recent.reduce((a, m) => a + m.anomalyDensity, 0) / recent.length;
    return avgCorrelation > 0.7 && avgAnomaly < 0.3;
  }

  private static meetsAdaptationCapability(metrics: PatternMetrics[]): boolean {
    const recent = metrics.slice(-10);
    const avgAnomaly = recent.reduce((a, m) => a + m.anomalyDensity, 0) / recent.length;
    return avgAnomaly > 0.4; // User handles anomalies well
  }

  private static meetsCollaborationCapability(metrics: PatternMetrics[]): boolean {
    const recent = metrics.slice(-10);
    const avgConfidence = recent.reduce((a, m) => a + (1 - m.confidenceVariance), 0) / recent.length;
    return avgConfidence > 0.75;
  }

  private static calculateReadiness(metrics: PatternMetrics[], triggerPatterns: string[]): number {
    let score = 0;
    const recent = metrics.slice(-10);

    for (const pattern of triggerPatterns) {
      if (pattern === "high-correlation-stability") {
        const avgCorr = recent.reduce((a, m) => a + m.correlationStrength, 0) / recent.length;
        score += Math.min(avgCorr / 0.8, 1);
      } else if (pattern === "high-accuracy") {
        score += 0.8; // Placeholder
      } else if (pattern === "stable-trends") {
        const variance = this.variance(recent.map((m) => m.trendAcceleration));
        score += Math.max(0, 1 - variance * 2);
      } else if (pattern === "low-variance") {
        const variance = this.variance(recent.map((m) => m.confidenceVariance));
        score += Math.max(0, 1 - variance);
      } else if (pattern === "high-anomaly-detection") {
        const avgAnomaly = recent.reduce((a, m) => a + m.anomalyDensity, 0) / recent.length;
        score += Math.min(avgAnomaly / 0.5, 1);
      } else if (pattern === "pattern-mastery") {
        score += 0.9; // High bar
      }
    }

    return Math.min(score / Math.max(triggerPatterns.length, 1), 1);
  }
}
