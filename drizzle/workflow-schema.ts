import {
  int,
  varchar,
  text,
  timestamp,
  json,
  mysqlEnum,
  mysqlTable,
  index,
  decimal,
} from "drizzle-orm/mysql-core";

/**
 * Workflow Events - Captures all R&D activities
 * Used for pattern detection and blind spot discovery
 */
export const workflowEvents = mysqlTable(
  "workflow_events",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    eventType: mysqlEnum("eventType", [
      "calibration",
      "training",
      "prompt",
      "prediction",
      "modeling",
      "development",
      "outcome",
    ]).notNull(),
    eventName: varchar("eventName", { length: 255 }).notNull(),
    description: text("description"),
    context: json("context"), // Stores event-specific data
    metrics: json("metrics"), // Stores numeric metrics
    metadata: json("metadata"), // source, version, environment
    source: varchar("source", { length: 100 }), // 'ui', 'api', 'automation', 'external'
    environment: mysqlEnum("environment", ["dev", "staging", "production"]).default("dev"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("workflow_events_userId_idx").on(table.userId),
    eventTypeIdx: index("workflow_events_eventType_idx").on(table.eventType),
    createdAtIdx: index("workflow_events_createdAt_idx").on(table.createdAt),
  })
);

/**
 * Detected Patterns - Results of pattern recognition analysis
 */
export const detectedPatterns = mysqlTable(
  "detected_patterns",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    patternType: mysqlEnum("patternType", [
      "frequency",
      "correlation",
      "anomaly",
      "drift",
      "causality",
      "cycle",
      "trend",
    ]).notNull(),
    patternName: varchar("patternName", { length: 255 }).notNull(),
    description: text("description"),
    confidence: decimal("confidence", { precision: 5, scale: 4 }), // 0.0 - 1.0
    eventTypes: json("eventTypes"), // Array of event types involved
    metrics: json("metrics"), // Pattern-specific metrics
    firstDetected: timestamp("firstDetected").notNull(),
    lastSeen: timestamp("lastSeen").notNull(),
    occurrenceCount: int("occurrenceCount").default(1),
    isActive: int("isActive").default(1), // 1 = active, 0 = inactive
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("detected_patterns_userId_idx").on(table.userId),
    patternTypeIdx: index("detected_patterns_patternType_idx").on(table.patternType),
  })
);

/**
 * Blind Spots - Identified gaps in observation
 */
export const blindSpots = mysqlTable(
  "blind_spots",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    blindSpotType: mysqlEnum("blindSpotType", [
      "missing_event_type",
      "silent_failure",
      "latent_variable",
      "external_signal",
      "temporal_gap",
      "correlation_surprise",
      "drift_undetected",
    ]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium"),
    evidence: json("evidence"), // Data supporting this blind spot
    suggestedAction: text("suggestedAction"),
    status: mysqlEnum("status", ["open", "investigating", "resolved", "ignored"]).default("open"),
    detectedAt: timestamp("detectedAt").notNull(),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("blind_spots_userId_idx").on(table.userId),
    statusIdx: index("blind_spots_status_idx").on(table.status),
  })
);

/**
 * Precision Tools - Modular tools for R&D workflows
 */
export const precisionTools = mysqlTable(
  "precision_tools",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    toolName: varchar("toolName", { length: 255 }).notNull(),
    description: text("description"),
    toolType: mysqlEnum("toolType", [
      "calibration",
      "training",
      "prompt_engineering",
      "prediction",
      "modeling",
      "analysis",
      "custom",
    ]).notNull(),
    inputs: json("inputs"), // Input schema
    outputs: json("outputs"), // Output schema
    config: json("config"), // Tool configuration
    adapters: json("adapters"), // Connected adapters (github, deployment, etc)
    isActive: int("isActive").default(1),
    usageCount: int("usageCount").default(0),
    successRate: decimal("successRate", { precision: 5, scale: 4 }), // 0.0 - 1.0
    averageExecutionTime: int("averageExecutionTime"), // milliseconds
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("precision_tools_userId_idx").on(table.userId),
    toolTypeIdx: index("precision_tools_toolType_idx").on(table.toolType),
  })
);

/**
 * Tool Executions - Track tool usage and performance
 */
export const toolExecutions = mysqlTable(
  "tool_executions",
  {
    id: int("id").autoincrement().primaryKey(),
    toolId: int("toolId").notNull(),
    userId: int("userId").notNull(),
    inputs: json("inputs"),
    outputs: json("outputs"),
    status: mysqlEnum("status", ["pending", "running", "success", "failed"]).notNull(),
    errorMessage: text("errorMessage"),
    executionTime: int("executionTime"), // milliseconds
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    toolIdIdx: index("tool_executions_toolId_idx").on(table.toolId),
    userIdIdx: index("tool_executions_userId_idx").on(table.userId),
  })
);

/**
 * External Signals - Data from GitHub, deployments, etc
 */
export const externalSignals = mysqlTable(
  "external_signals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    signalSource: mysqlEnum("signalSource", [
      "github",
      "deployment",
      "monitoring",
      "market",
      "custom",
    ]).notNull(),
    signalType: varchar("signalType", { length: 100 }).notNull(),
    signalName: varchar("signalName", { length: 255 }).notNull(),
    value: text("value"),
    metadata: json("metadata"),
    correlationWithPredictions: decimal("correlationWithPredictions", { precision: 5, scale: 4 }),
    isRelevant: int("isRelevant"), // 1 = relevant, 0 = not relevant, null = unknown
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("external_signals_userId_idx").on(table.userId),
    signalSourceIdx: index("external_signals_signalSource_idx").on(table.signalSource),
  })
);

/**
 * Workflow Insights - Aggregated insights from analysis
 */
export const workflowInsights = mysqlTable(
  "workflow_insights",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    insightType: mysqlEnum("insightType", [
      "pattern",
      "anomaly",
      "recommendation",
      "alert",
      "opportunity",
    ]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    data: json("data"),
    impact: mysqlEnum("impact", ["low", "medium", "high"]).default("medium"),
    actionable: int("actionable").default(1), // 1 = actionable, 0 = informational
    status: mysqlEnum("status", ["new", "acknowledged", "acted_upon", "dismissed"]).default("new"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("workflow_insights_userId_idx").on(table.userId),
    statusIdx: index("workflow_insights_status_idx").on(table.status),
  })
);

// Type exports
export type WorkflowEvent = typeof workflowEvents.$inferSelect;
export type InsertWorkflowEvent = typeof workflowEvents.$inferInsert;

export type DetectedPattern = typeof detectedPatterns.$inferSelect;
export type InsertDetectedPattern = typeof detectedPatterns.$inferInsert;

export type BlindSpot = typeof blindSpots.$inferSelect;
export type InsertBlindSpot = typeof blindSpots.$inferInsert;

export type PrecisionTool = typeof precisionTools.$inferSelect;
export type InsertPrecisionTool = typeof precisionTools.$inferInsert;

export type ToolExecution = typeof toolExecutions.$inferSelect;
export type InsertToolExecution = typeof toolExecutions.$inferInsert;

export type ExternalSignal = typeof externalSignals.$inferSelect;
export type InsertExternalSignal = typeof externalSignals.$inferInsert;

export type WorkflowInsight = typeof workflowInsights.$inferSelect;
export type InsertWorkflowInsight = typeof workflowInsights.$inferInsert;
