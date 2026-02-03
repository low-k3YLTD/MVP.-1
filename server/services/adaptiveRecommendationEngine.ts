/**
 * Adaptive Recommendation Engine
 * Suggests personalized next actions based on pattern trajectory
 * Learns from user responses to improve recommendations over time
 */

export interface PatternTrajectory {
  metric: string;
  currentValue: number;
  trend: "increasing" | "decreasing" | "stable";
  velocity: number; // rate of change
  acceleration: number; // rate of trend change
  confidence: number;
}

export interface Recommendation {
  id: string;
  action: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  expectedOutcome: string;
  timeframe: "immediate" | "today" | "this-week" | "this-month";
  category: "calibration" | "scaling" | "investigation" | "optimization" | "learning";
  relatedMetrics: string[];
  successCriteria: string;
  estimatedImpact: number; // 0-1
  confidence: number; // 0-1
}

export interface RecommendationResponse {
  recommendations: Recommendation[];
  summary: string;
  nextCheckpoint: Date;
  riskAssessment: {
    level: "low" | "medium" | "high" | "critical";
    reason: string;
    mitigationActions: string[];
  };
}

export class AdaptiveRecommendationEngine {
  /**
   * Generate personalized recommendations based on trajectory
   */
  static generateRecommendations(trajectories: PatternTrajectory[]): RecommendationResponse {
    const recommendations: Recommendation[] = [];

    // Analyze each trajectory and generate relevant recommendations
    for (const traj of trajectories) {
      const recs = this.analyzeTrajectory(traj);
      recommendations.push(...recs);
    }

    // Prioritize by impact and urgency
    recommendations.sort((a, b) => {
      const priorityMap = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityMap[b.priority] - priorityMap[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedImpact - a.estimatedImpact;
    });

    // Limit to top 5 recommendations to avoid overwhelm
    const topRecommendations = recommendations.slice(0, 5);

    // Generate summary
    const summary = this.generateSummary(topRecommendations, trajectories);

    // Assess overall risk
    const riskAssessment = this.assessRisk(trajectories);

    // Calculate next checkpoint
    const nextCheckpoint = this.calculateNextCheckpoint(trajectories);

    return {
      recommendations: topRecommendations,
      summary,
      nextCheckpoint,
      riskAssessment,
    };
  }

  /**
   * Analyze individual trajectory and generate recommendations
   */
  private static analyzeTrajectory(traj: PatternTrajectory): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Pattern: Strong positive acceleration
    if (traj.acceleration > 0.3 && traj.trend === "increasing") {
      recommendations.push({
        id: `rec-${traj.metric}-scale-up`,
        action: "Scale up successful patterns",
        description: `Your ${traj.metric} is accelerating positively. This is the optimal time to increase investment in this area.`,
        priority: "high",
        expectedOutcome: "Amplify gains and compound success",
        timeframe: "immediate",
        category: "scaling",
        relatedMetrics: [traj.metric],
        successCriteria: "Maintain acceleration for 2+ weeks",
        estimatedImpact: 0.8,
        confidence: traj.confidence,
      });
    }

    // Pattern: Deceleration of positive trend
    if (traj.acceleration < -0.2 && traj.trend === "increasing" && traj.velocity > 0) {
      recommendations.push({
        id: `rec-${traj.metric}-investigate`,
        action: "Investigate momentum loss",
        description: `Your ${traj.metric} is still increasing but losing momentum. Investigate before it reverses.`,
        priority: "medium",
        expectedOutcome: "Identify and fix momentum blockers",
        timeframe: "this-week",
        category: "investigation",
        relatedMetrics: [traj.metric],
        successCriteria: "Restore acceleration or stabilize at new level",
        estimatedImpact: 0.6,
        confidence: traj.confidence,
      });
    }

    // Pattern: Trend reversal (was increasing, now decreasing)
    if (traj.trend === "decreasing" && traj.velocity < -0.15) {
      recommendations.push({
        id: `rec-${traj.metric}-reverse-alert`,
        action: "Address trend reversal",
        description: `Your ${traj.metric} has reversed direction. This requires immediate attention to prevent further decline.`,
        priority: "high",
        expectedOutcome: "Stabilize metric and reverse decline",
        timeframe: "immediate",
        category: "calibration",
        relatedMetrics: [traj.metric],
        successCriteria: "Stop decline within 3 days",
        estimatedImpact: 0.9,
        confidence: traj.confidence,
      });
    }

    // Pattern: High volatility (unstable)
    if (Math.abs(traj.acceleration) > 0.4) {
      recommendations.push({
        id: `rec-${traj.metric}-stabilize`,
        action: "Stabilize volatile metric",
        description: `Your ${traj.metric} is highly volatile. Implement stabilization measures to reduce noise.`,
        priority: "medium",
        expectedOutcome: "Reduce volatility and improve predictability",
        timeframe: "this-week",
        category: "optimization",
        relatedMetrics: [traj.metric],
        successCriteria: "Reduce acceleration magnitude below 0.2",
        estimatedImpact: 0.7,
        confidence: Math.max(0.5, traj.confidence - 0.2),
      });
    }

    // Pattern: Stagnation (stable but low)
    if (traj.trend === "stable" && traj.currentValue < 0.4) {
      recommendations.push({
        id: `rec-${traj.metric}-optimize`,
        action: "Optimize stagnant metric",
        description: `Your ${traj.metric} has plateaued at a low level. Explore new approaches to break through.`,
        priority: "low",
        expectedOutcome: "Unlock new growth trajectory",
        timeframe: "this-month",
        category: "learning",
        relatedMetrics: [traj.metric],
        successCriteria: "Achieve 20% improvement within 30 days",
        estimatedImpact: 0.5,
        confidence: traj.confidence,
      });
    }

    // Pattern: Approaching critical threshold
    if (traj.currentValue > 0.8 && traj.trend === "increasing") {
      recommendations.push({
        id: `rec-${traj.metric}-prepare-next-level`,
        action: "Prepare for next level",
        description: `Your ${traj.metric} is approaching peak performance. Prepare to transition to advanced techniques.`,
        priority: "medium",
        expectedOutcome: "Unlock advanced capabilities",
        timeframe: "this-week",
        category: "learning",
        relatedMetrics: [traj.metric],
        successCriteria: "Complete advanced training module",
        estimatedImpact: 0.7,
        confidence: traj.confidence,
      });
    }

    return recommendations;
  }

  /**
   * Generate human-readable summary of recommendations
   */
  private static generateSummary(recommendations: Recommendation[], trajectories: PatternTrajectory[]): string {
    if (recommendations.length === 0) {
      return "Your patterns are stable. Continue current approach and monitor for changes.";
    }

    const criticalCount = recommendations.filter((r) => r.priority === "critical").length;
    const highCount = recommendations.filter((r) => r.priority === "high").length;

    if (criticalCount > 0) {
      return `⚠️ Critical action required: ${recommendations[0].action}. This requires immediate attention to prevent deterioration.`;
    }

    if (highCount > 0) {
      return `📈 Opportunity detected: ${recommendations[0].action}. This is an optimal time to make this change.`;
    }

    return `💡 Suggestion: ${recommendations[0].action}. This could improve your outcomes.`;
  }

  /**
   * Assess overall risk level
   */
  private static assessRisk(
    trajectories: PatternTrajectory[]
  ): {
    level: "low" | "medium" | "high" | "critical";
    reason: string;
    mitigationActions: string[];
  } {
    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    const issues: string[] = [];
    const mitigations: string[] = [];

    for (const traj of trajectories) {
      // Critical: Multiple metrics declining rapidly
      if (traj.trend === "decreasing" && traj.velocity < -0.2) {
        issues.push(`${traj.metric} declining rapidly`);
        mitigations.push(`Investigate and stabilize ${traj.metric}`);
        riskLevel = "high";
      }

      // High: Volatility increasing
      if (Math.abs(traj.acceleration) > 0.5) {
        issues.push(`${traj.metric} highly volatile`);
        mitigations.push(`Implement stabilization for ${traj.metric}`);
        if (riskLevel === "low") riskLevel = "medium";
      }

      // Medium: Confidence declining
      if (traj.confidence < 0.4) {
        issues.push(`Low confidence in ${traj.metric} predictions`);
        mitigations.push(`Collect more data for ${traj.metric}`);
        if (riskLevel === "low") riskLevel = "medium";
      }
    }

    const reason =
      issues.length > 0 ? `Issues detected: ${issues.join(", ")}` : "Patterns are stable and predictable";

    return {
      level: riskLevel,
      reason,
      mitigationActions: mitigations,
    };
  }

  /**
   * Calculate when to check next
   */
  private static calculateNextCheckpoint(trajectories: PatternTrajectory[]): Date {
    const now = new Date();

    // If any critical metrics, check in 1 day
    if (trajectories.some((t) => Math.abs(t.acceleration) > 0.5)) {
      return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    }

    // If high volatility, check in 3 days
    if (trajectories.some((t) => Math.abs(t.acceleration) > 0.3)) {
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    }

    // Otherwise, check in 7 days
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * Learn from user response to recommendation
   * (Used to improve future recommendations)
   */
  static recordRecommendationResponse(
    recommendationId: string,
    response: "accepted" | "rejected" | "deferred",
    outcome?: "success" | "failure" | "neutral"
  ): void {
    // In production, this would update a learning model
    // For now, just log for analysis
    console.log(`[Recommendation Learning] ${recommendationId}: ${response} → ${outcome || "pending"}`);
  }
}
