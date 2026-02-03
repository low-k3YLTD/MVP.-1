/**
 * Pattern Recognition Engine
 * Analyzes workflow events to detect correlations, anomalies, and trends
 * Identifies repeatable R&D processes and blind spots
 */

export interface WorkflowEvent {
  id: number;
  userId: number;
  eventType: string;
  eventName: string;
  metrics?: Record<string, number>;
  createdAt: Date;
}

export interface CorrelationResult {
  metric1: string;
  metric2: string;
  coefficient: number; // -1 to 1
  strength: "strong" | "moderate" | "weak" | "none";
  significance: number; // p-value
}

export interface AnomalyResult {
  eventId: number;
  eventName: string;
  anomalyScore: number; // 0 to 1
  severity: "critical" | "high" | "medium" | "low";
  reason: string;
  timestamp: Date;
}

export interface TrendResult {
  metric: string;
  direction: "increasing" | "decreasing" | "stable";
  slope: number;
  rSquared: number; // goodness of fit
  confidence: number; // 0 to 1
  forecast: number[]; // next 5 values
}

export interface PatternResult {
  patternId: string;
  name: string;
  description: string;
  frequency: number;
  eventSequence: string[];
  confidence: number;
  impact: "high" | "medium" | "low";
}

export interface BlindSpot {
  id: string;
  title: string;
  description: string;
  signal: string; // what signal we're missing
  impact: "critical" | "high" | "medium";
  recommendation: string;
}

/**
 * Correlation Detection Engine
 * Finds relationships between metrics in workflow events
 */
export class CorrelationDetector {
  /**
   * Calculate Pearson correlation coefficient between two metric arrays
   */
  static calculatePearsonCorrelation(x: number[], y: number[]): CorrelationResult | null {
    if (x.length !== y.length || x.length < 3) {
      return null;
    }

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b) / n;
    const meanY = y.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denominator = Math.sqrt(denomX * denomY);
    if (denominator === 0) return null;

    const coefficient = numerator / denominator;

    // Calculate p-value using t-distribution approximation
    const tStat = coefficient * Math.sqrt(n - 2) / Math.sqrt(1 - coefficient * coefficient);
    const pValue = this.calculatePValue(Math.abs(tStat), n - 2);

    return {
      metric1: "metric1",
      metric2: "metric2",
      coefficient,
      strength: this.getCorrelationStrength(coefficient),
      significance: pValue,
    };
  }

  /**
   * Detect all significant correlations in event metrics
   */
  static detectCorrelations(events: WorkflowEvent[]): CorrelationResult[] {
    const metricMap = new Map<string, number[]>();

    // Aggregate metrics by name
    for (const event of events) {
      if (!event.metrics) continue;
      for (const [key, value] of Object.entries(event.metrics)) {
        if (!metricMap.has(key)) {
          metricMap.set(key, []);
        }
        metricMap.get(key)!.push(value);
      }
    }

    const correlations: CorrelationResult[] = [];
    const metrics = Array.from(metricMap.keys());

    // Compare all metric pairs
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const x = metricMap.get(metrics[i])!;
        const y = metricMap.get(metrics[j])!;

        if (x.length === y.length && x.length >= 3) {
          const result = this.calculatePearsonCorrelation(x, y);
          if (result && Math.abs(result.coefficient) > 0.3) {
            correlations.push({
              ...result,
              metric1: metrics[i],
              metric2: metrics[j],
            });
          }
        }
      }
    }

    return correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  }

  private static getCorrelationStrength(coefficient: number): "strong" | "moderate" | "weak" | "none" {
    const abs = Math.abs(coefficient);
    if (abs > 0.7) return "strong";
    if (abs > 0.4) return "moderate";
    if (abs > 0.2) return "weak";
    return "none";
  }

  private static calculatePValue(tStat: number, df: number): number {
    // Simplified p-value calculation
    // In production, use a proper statistical library
    if (tStat > 3) return 0.001;
    if (tStat > 2) return 0.05;
    if (tStat > 1.5) return 0.1;
    return 0.5;
  }
}

/**
 * Anomaly Detection Engine
 * Identifies unusual patterns and outliers in workflow events
 */
export class AnomalyDetector {
  /**
   * Detect anomalies using Z-score method
   */
  static detectAnomalies(events: WorkflowEvent[]): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];
    const metricMap = new Map<string, { values: number[]; events: WorkflowEvent[] }>();

    // Aggregate metrics
    for (const event of events) {
      if (!event.metrics) continue;
      for (const [key, value] of Object.entries(event.metrics)) {
        if (!metricMap.has(key)) {
          metricMap.set(key, { values: [], events: [] });
        }
        metricMap.get(key)!.values.push(value);
        metricMap.get(key)!.events.push(event);
      }
    }

    // Detect anomalies per metric
    for (const entry of Array.from(metricMap.entries())) {
      const [metric, data] = entry;
      const { values, events: metricEvents } = data;
      if (values.length < 4) continue;

      const mean = values.reduce((a: number, b: number) => a + b) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / values.length
      );

      if (stdDev === 0) continue;

      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        const zScore = Math.abs((val - mean) / stdDev);
        if (zScore > 2.5) {
          // Threshold for anomaly
          anomalies.push({
            eventId: metricEvents[i].id,
            eventName: metricEvents[i].eventName,
            anomalyScore: Math.min(zScore / 4, 1), // Normalize to 0-1
            severity: zScore > 4 ? "critical" : zScore > 3 ? "high" : "medium",
            reason: `${metric} value ${values[i].toFixed(2)} is ${zScore.toFixed(1)} standard deviations from mean`,
            timestamp: metricEvents[i].createdAt,
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore);
  }

  /**
   * Detect event frequency anomalies
   */
  static detectEventFrequencyAnomalies(events: WorkflowEvent[]): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];
    const eventCounts = new Map<string, number>();

    // Count events by type
    for (const event of events) {
      eventCounts.set(event.eventType, (eventCounts.get(event.eventType) || 0) + 1);
    }

    const counts = Array.from(eventCounts.values());
    if (counts.length < 2) return anomalies;

    const mean = counts.reduce((a: number, b: number) => a + b) / counts.length;
    const stdDev = Math.sqrt(counts.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / counts.length);

    // Find event types with unusual frequency
    for (const entry of Array.from(eventCounts.entries())) {
      const [eventType, count] = entry;
      if (stdDev > 0) {
        const zScore = Math.abs((count - mean) / stdDev);
        if (zScore > 2) {
          anomalies.push({
            eventId: 0,
            eventName: eventType,
            anomalyScore: Math.min(zScore / 4, 1),
            severity: zScore > 3 ? "high" : "medium",
            reason: `Event type "${eventType}" occurs ${count} times, unusual frequency detected`,
            timestamp: new Date(),
          });
        }
      }
    }

    return anomalies;
  }
}

/**
 * Trend Analysis Engine
 * Identifies trends and forecasts in workflow metrics
 */
export class TrendAnalyzer {
  /**
   * Perform linear regression on metric time series
   */
  static analyzeTrend(values: number[], metric: string): TrendResult | null {
    if (values.length < 3) return null;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    // Calculate linear regression
    const meanX = x.reduce((a, b) => a + b) / n;
    const meanY = y.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += (x[i] - meanX) * (x[i] - meanX);
    }

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;

    // Calculate R-squared
    const yPred = x.map((xi) => slope * xi + intercept);
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - yPred[i], 2), 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const rSquared = 1 - ssRes / ssTot;

    // Forecast next 5 values
    const forecast = Array.from({ length: 5 }, (_, i) => slope * (n + i) + intercept);

    return {
      metric,
      direction: slope > 0.1 ? "increasing" : slope < -0.1 ? "decreasing" : "stable",
      slope,
      rSquared: Math.max(0, Math.min(1, rSquared)),
      confidence: Math.max(0, Math.min(1, Math.abs(rSquared))),
      forecast,
    };
  }

  /**
   * Detect all trends in event metrics
   */
  static detectTrends(events: WorkflowEvent[]): TrendResult[] {
    const metricMap = new Map<string, number[]>();

    // Aggregate metrics in chronological order
    const sortedEvents = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const event of sortedEvents) {
      if (!event.metrics) continue;
      for (const [key, value] of Object.entries(event.metrics)) {
        if (!metricMap.has(key)) {
          metricMap.set(key, []);
        }
        metricMap.get(key)!.push(value);
      }
    }

    const trends: TrendResult[] = [];

    for (const entry of Array.from(metricMap.entries())) {
      const [metric, values] = entry;
      const trend = this.analyzeTrend(values, metric);
      if (trend && trend.rSquared > 0.3) {
        trends.push(trend);
      }
    }

    return trends.sort((a, b) => b.rSquared - a.rSquared);
  }
}

/**
 * Pattern Recognition Service
 * Unified interface for all pattern detection capabilities
 */
export class PatternRecognitionService {
  /**
   * Perform comprehensive pattern analysis on workflow events
   */
  static async analyzeWorkflows(events: WorkflowEvent[]) {
    if (events.length < 5) {
      return {
        correlations: [],
        anomalies: [],
        trends: [],
        patterns: [],
        blindSpots: [],
        summary: "Insufficient data for pattern analysis (minimum 5 events required)",
      };
    }

    const correlations = CorrelationDetector.detectCorrelations(events);
    const anomalies = [
      ...AnomalyDetector.detectAnomalies(events),
      ...AnomalyDetector.detectEventFrequencyAnomalies(events),
    ];
    const trends = TrendAnalyzer.detectTrends(events);
    const patterns = this.detectPatterns(events);
    const blindSpots = this.identifyBlindSpots(events, correlations, anomalies, trends);

    return {
      correlations,
      anomalies,
      trends,
      patterns,
      blindSpots,
      summary: this.generateSummary(correlations, anomalies, trends, patterns, blindSpots),
    };
  }

  /**
   * Detect repeatable event sequences and patterns
   */
  private static detectPatterns(events: WorkflowEvent[]): PatternResult[] {
    const patterns: PatternResult[] = [];
    const eventSequences = new Map<string, number>();

    // Group events by type
    const eventsByType = new Map<string, WorkflowEvent[]>();
    for (const event of events) {
      if (!eventsByType.has(event.eventType)) {
        eventsByType.set(event.eventType, []);
      }
      eventsByType.get(event.eventType)!.push(event);
    }

    // Detect common sequences
    for (const entry of Array.from(eventsByType.entries())) {
      const [eventType, typeEvents] = entry;
      const frequency = typeEvents.length;
      if (frequency >= 3) {
        // Pattern must occur at least 3 times
        patterns.push({
          patternId: `pattern_${eventType}`,
          name: `Repeating ${eventType}`,
          description: `Event type "${eventType}" occurs ${frequency} times in the workflow`,
          frequency,
          eventSequence: [eventType],
          confidence: Math.min(frequency / events.length, 1),
          impact: frequency > events.length * 0.5 ? "high" : frequency > events.length * 0.2 ? "medium" : "low",
        });
      }
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Identify blind spots - signals we're not capturing
   */
  private static identifyBlindSpots(
    events: WorkflowEvent[],
    correlations: CorrelationResult[],
    anomalies: AnomalyResult[],
    trends: TrendResult[]
  ): BlindSpot[] {
    const blindSpots: BlindSpot[] = [];

    // Blind spot 1: Uncorrelated metrics might indicate missing signals
    if (correlations.length === 0 && events.length > 10) {
      blindSpots.push({
        id: "blind_spot_1",
        title: "No Metric Correlations Detected",
        description: "Workflow metrics show no significant correlations",
        signal: "Missing causal relationships between events",
        impact: "high",
        recommendation: "Investigate if metrics are independent or if measurement is incomplete",
      });
    }

    // Blind spot 2: High anomaly rate might indicate measurement issues
    const anomalyRate = anomalies.length / Math.max(events.length, 1);
    if (anomalyRate > 0.2) {
      blindSpots.push({
        id: "blind_spot_2",
        title: "High Anomaly Rate",
        description: `${(anomalyRate * 100).toFixed(1)}% of events are anomalous`,
        signal: "Potential data quality issues or extreme variability",
        impact: "high",
        recommendation: "Review data collection methods and validate measurement accuracy",
      });
    }

    // Blind spot 3: Unstable trends might indicate external factors
    const unstableTrends = trends.filter((t) => t.rSquared < 0.4);
    if (unstableTrends.length > 0) {
      blindSpots.push({
        id: "blind_spot_3",
        title: "Unstable Trends",
        description: `${unstableTrends.length} metrics show unstable trends (R² < 0.4)`,
        signal: "External factors or unmeasured variables affecting outcomes",
        impact: "medium",
        recommendation: "Identify and measure external variables that might influence metrics",
      });
    }

    // Blind spot 4: Event type imbalance
    const eventTypes = new Set(events.map((e) => e.eventType));
    if (eventTypes.size === 1) {
      blindSpots.push({
        id: "blind_spot_4",
        title: "Single Event Type Only",
        description: "All events are of the same type",
        signal: "Missing visibility into other workflow phases",
        impact: "critical",
        recommendation: "Expand event logging to capture all R&D workflow phases",
      });
    }

    return blindSpots;
  }

  /**
   * Generate human-readable summary of pattern analysis
   */
  private static generateSummary(
    correlations: CorrelationResult[],
    anomalies: AnomalyResult[],
    trends: TrendResult[],
    patterns: PatternResult[],
    blindSpots: BlindSpot[]
  ): string {
    const parts: string[] = [];

    if (correlations.length > 0) {
      parts.push(`Found ${correlations.length} significant metric correlations`);
    }

    if (anomalies.length > 0) {
      parts.push(`Detected ${anomalies.length} anomalies in workflow data`);
    }

    if (trends.length > 0) {
      const increasing = trends.filter((t) => t.direction === "increasing").length;
      const decreasing = trends.filter((t) => t.direction === "decreasing").length;
      parts.push(`${increasing} increasing and ${decreasing} decreasing trends`);
    }

    if (patterns.length > 0) {
      parts.push(`Identified ${patterns.length} repeatable workflow patterns`);
    }

    if (blindSpots.length > 0) {
      parts.push(`⚠️ ${blindSpots.length} potential blind spots detected`);
    }

    return parts.join(" • ") || "No significant patterns detected";
  }
}
