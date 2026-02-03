import { getDb } from "../db";
import { workflowEvents, InsertWorkflowEvent } from "../../drizzle/workflow-schema";

/**
 * Workflow Event Service
 * Captures and logs all R&D activities for pattern detection and blind spot discovery
 */

export interface WorkflowEventInput {
  userId: number;
  eventType: "calibration" | "training" | "prompt" | "prediction" | "modeling" | "development" | "outcome";
  eventName: string;
  description?: string;
  context?: Record<string, any>;
  metrics?: Record<string, number>;
  source?: string;
  environment?: "dev" | "staging" | "production";
}

export class WorkflowEventService {
  /**
   * Log a workflow event
   */
  static async logEvent(input: WorkflowEventInput): Promise<number> {
    const db = await getDb();
    if (!db) {
      console.warn("[WorkflowEvent] Database not available");
      throw new Error("Database connection failed");
    }

    try {
      const event: InsertWorkflowEvent = {
        userId: input.userId,
        eventType: input.eventType,
        eventName: input.eventName,
        description: input.description,
        context: input.context ? JSON.stringify(input.context) : null,
        metrics: input.metrics ? JSON.stringify(input.metrics) : null,
        source: input.source || "api",
        environment: input.environment || "production",
      };

      const result = await db.insert(workflowEvents).values(event);
      console.log(`[WorkflowEvent] Logged ${input.eventType}: ${input.eventName}`);
      return (result as any).insertId || 0;
    } catch (error) {
      console.error("[WorkflowEvent] Failed to log event:", error);
      throw error;
    }
  }

  /**
   * Get events for a user within a time range
   */
  static async getEvents(
    userId: number,
    options?: {
      eventType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    const db = await getDb();
    if (!db) {
      console.warn("[WorkflowEvent] Database not available");
      return [];
    }

    try {
      const { eq, and, gte, lte } = await import("drizzle-orm");
      let conditions: any[] = [eq(workflowEvents.userId, userId)];

      if (options?.eventType) {
        conditions.push(eq(workflowEvents.eventType as any, options.eventType));
      }

      if (options?.startDate) {
        conditions.push(gte(workflowEvents.createdAt, options.startDate));
      }

      if (options?.endDate) {
        conditions.push(lte(workflowEvents.createdAt, options.endDate));
      }

      const events = await db
        .select()
        .from(workflowEvents)
        .where(and(...conditions))
        .orderBy(workflowEvents.createdAt)
        .limit(options?.limit || 100);

      return events;
    } catch (error) {
      console.error("[WorkflowEvent] Failed to get events:", error);
      return [];
    }
  }

  /**
   * Get event statistics for a user
   */
  static async getEventStats(userId: number, days: number = 7) {
    const db = await getDb();
    if (!db) {
      console.warn("[WorkflowEvent] Database not available");
      return null;
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const events = await this.getEvents(userId, {
        startDate,
        limit: 1000,
      });

      const stats = {
        totalEvents: events.length,
        eventsByType: {} as Record<string, number>,
        eventsBySource: {} as Record<string, number>,
        metricsAverage: {} as Record<string, number>,
        timeRange: {
          start: startDate,
          end: new Date(),
          days,
        },
      };

      // Aggregate statistics
      for (const event of events) {
        // Count by type
        const eventType = event.eventType || "unknown";
        stats.eventsByType[eventType] = (stats.eventsByType[eventType] || 0) + 1;

        // Count by source
        const source = event.source || "unknown";
        stats.eventsBySource[source] = (stats.eventsBySource[source] || 0) + 1;

        // Average metrics
        if (event.metrics) {
          try {
            const metrics = typeof event.metrics === "string" ? JSON.parse(event.metrics) : event.metrics;
            if (metrics && typeof metrics === "object") {
              for (const [key, value] of Object.entries(metrics)) {
                if (typeof value === "number") {
                  stats.metricsAverage[key] = (stats.metricsAverage[key] || 0) + value;
                }
              }
            }
          } catch (e) {
            // Skip invalid metrics
          }
        }
      }

      // Calculate averages
      for (const key in stats.metricsAverage) {
        stats.metricsAverage[key] = stats.metricsAverage[key] / events.length;
      }

      return stats;
    } catch (error) {
      console.error("[WorkflowEvent] Failed to get event stats:", error);
      return null;
    }
  }

  /**
   * Log a prediction event
   */
  static async logPrediction(
    userId: number,
    horseName: string,
    predictedRank: number,
    confidence: number,
    metrics?: Record<string, number>
  ) {
    return this.logEvent({
      userId,
      eventType: "prediction",
      eventName: `Prediction for ${horseName}`,
      description: `Predicted rank ${predictedRank} with ${(confidence * 100).toFixed(1)}% confidence`,
      context: {
        horseName,
        predictedRank,
        confidence,
      },
      metrics: {
        confidence,
        rank: predictedRank,
        ...metrics,
      },
    });
  }

  /**
   * Log a training event
   */
  static async logTraining(
    userId: number,
    modelName: string,
    metrics: Record<string, number>
  ) {
    return this.logEvent({
      userId,
      eventType: "training",
      eventName: `Training: ${modelName}`,
      description: `Model training completed`,
      context: {
        modelName,
      },
      metrics,
    });
  }

  /**
   * Log a calibration event
   */
  static async logCalibration(
    userId: number,
    parameterName: string,
    oldValue: any,
    newValue: any
  ) {
    return this.logEvent({
      userId,
      eventType: "calibration",
      eventName: `Calibration: ${parameterName}`,
      description: `${parameterName} changed from ${oldValue} to ${newValue}`,
      context: {
        parameterName,
        oldValue,
        newValue,
      },
    });
  }

  /**
   * Log an outcome event
   */
  static async logOutcome(
    userId: number,
    predictionId: number,
    actualRank: number,
    isCorrect: boolean
  ) {
    return this.logEvent({
      userId,
      eventType: "outcome",
      eventName: `Outcome recorded for prediction ${predictionId}`,
      description: `Actual rank: ${actualRank}, Correct: ${isCorrect}`,
      context: {
        predictionId,
        actualRank,
        isCorrect,
      },
      metrics: {
        actualRank,
        isCorrect: isCorrect ? 1 : 0,
      },
    });
  }
}
