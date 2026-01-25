import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const predictions = mysqlTable("predictions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  raceId: varchar("raceId", { length: 128 }).notNull(),
  horseName: varchar("horseName", { length: 256 }).notNull(),
  predictedRank: int("predictedRank").notNull(),
  predictedScore: varchar("predictedScore", { length: 50 }).notNull(),
  actualRank: int("actualRank"),
  features: text("features"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Prediction = typeof predictions.$inferSelect;
export type InsertPrediction = typeof predictions.$inferInsert;

// Exotic Bet Optimizer Tables
export const races = mysqlTable("races", {
  id: int("id").autoincrement().primaryKey(),
  raceId: varchar("raceId", { length: 100 }).notNull().unique(),
  raceName: varchar("raceName", { length: 200 }),
  trackName: varchar("trackName", { length: 100 }),
  raceDate: timestamp("raceDate").notNull(),
  raceTime: varchar("raceTime", { length: 10 }),
  distance: varchar("distance", { length: 20 }),
  surface: varchar("surface", { length: 20 }), // Dirt, Turf, Synthetic
  raceClass: varchar("raceClass", { length: 50 }),
  purse: int("purse"),
  fieldSize: int("fieldSize"),
  weatherConditions: varchar("weatherConditions", { length: 100 }),
  trackCondition: varchar("trackCondition", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Race = typeof races.$inferSelect;
export type InsertRace = typeof races.$inferInsert;

export const raceHorses = mysqlTable("race_horses", {
  id: int("id").autoincrement().primaryKey(),
  raceId: int("raceId").notNull().references(() => races.id),
  horseId: int("horseId").notNull(),
  horseName: varchar("horseName", { length: 100 }).notNull(),
  postPosition: int("postPosition"),
  jockeyName: varchar("jockeyName", { length: 100 }),
  trainerName: varchar("trainerName", { length: 100 }),
  ownerName: varchar("ownerName", { length: 100 }),
  morningLineOdds: int("morningLineOdds"),
  finalOdds: int("finalOdds"),
  originalWinProbability: int("originalWinProbability"),
  calibratedWinProbability: int("calibratedWinProbability"),
  placeProbability: int("placeProbability"),
  showProbability: int("showProbability"),
  formRating: int("formRating"),
  speedRating: int("speedRating"),
  classRating: int("classRating"),
  paceRating: int("paceRating"),
  age: int("age"),
  sex: varchar("sex", { length: 10 }),
  weight: int("weight"),
  equipmentChange: varchar("equipmentChange", { length: 200 }),
  medication: varchar("medication", { length: 200 }),
  recentForm: text("recentForm"), // JSON
  lifetimeStats: text("lifetimeStats"), // JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RaceHorse = typeof raceHorses.$inferSelect;
export type InsertRaceHorse = typeof raceHorses.$inferInsert;

export const optimizationRuns = mysqlTable("optimization_runs", {
  id: int("id").autoincrement().primaryKey(),
  raceId: int("raceId").notNull().references(() => races.id),
  runTimestamp: timestamp("runTimestamp").defaultNow().notNull(),
  minEvThreshold: int("minEvThreshold").default(5),
  maxExactaCombinations: int("maxExactaCombinations").default(20),
  maxTrifectaCombinations: int("maxTrifectaCombinations").default(15),
  maxSuperfectaCombinations: int("maxSuperfectaCombinations").default(10),
  totalCombinationsAnalyzed: int("totalCombinationsAnalyzed"),
  profitableOpportunities: int("profitableOpportunities"),
  profitabilityRate: int("profitabilityRate"),
  averageExpectedValue: int("averageExpectedValue"),
  maxExpectedValue: int("maxExpectedValue"),
  totalKellyAllocation: int("totalKellyAllocation"),
  processingTimeSeconds: int("processingTimeSeconds"),
  optimizationVersion: varchar("optimizationVersion", { length: 20 }).default("1.0.0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OptimizationRun = typeof optimizationRuns.$inferSelect;
export type InsertOptimizationRun = typeof optimizationRuns.$inferInsert;

export const exoticBetResults = mysqlTable("exotic_bet_results", {
  id: int("id").autoincrement().primaryKey(),
  optimizationRunId: int("optimizationRunId").notNull().references(() => optimizationRuns.id),
  betType: varchar("betType", { length: 20 }).notNull(), // exacta, trifecta, superfecta
  combination: text("combination").notNull(), // JSON
  combinationNames: text("combinationNames"), // JSON
  probability: int("probability").notNull(),
  payoutOdds: int("payoutOdds"),
  expectedValue: int("expectedValue").notNull(),
  kellyFraction: int("kellyFraction"),
  confidenceScore: int("confidenceScore"),
  evRank: int("evRank"),
  probabilityRank: int("probabilityRank"),
  confidenceRank: int("confidenceRank"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExoticBetResult = typeof exoticBetResults.$inferSelect;
export type InsertExoticBetResult = typeof exoticBetResults.$inferInsert;

export const evSignals = mysqlTable("ev_signals", {
  id: int("id").autoincrement().primaryKey(),
  optimizationRunId: int("optimizationRunId").notNull().references(() => optimizationRuns.id),
  signalTimestamp: timestamp("signalTimestamp").defaultNow().notNull(),
  betType: varchar("betType", { length: 20 }).notNull(),
  combination: text("combination").notNull(), // JSON
  probability: int("probability").notNull(),
  expectedValue: int("expectedValue").notNull(),
  kellyFraction: int("kellyFraction"),
  confidenceScore: int("confidenceScore"),
  signalStrength: int("signalStrength"),
  riskLevel: varchar("riskLevel", { length: 20 }), // LOW, MEDIUM, HIGH, VERY_HIGH
  recommendedStake: int("recommendedStake"),
  maxLoss: int("maxLoss"),
  potentialProfit: int("potentialProfit"),
  isActive: int("isActive").default(1),
  isProfitable: int("isProfitable").default(1),
  alertSent: int("alertSent").default(0),
  actualResult: varchar("actualResult", { length: 20 }), // WIN, LOSS, PENDING
  actualPayout: int("actualPayout"),
  roi: int("roi"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EvSignal = typeof evSignals.$inferSelect;
export type InsertEvSignal = typeof evSignals.$inferInsert;

export const optimizationConfigs = mysqlTable("optimization_configs", {
  id: int("id").autoincrement().primaryKey(),
  configName: varchar("configName", { length: 100 }).notNull().unique(),
  description: text("description"),
  marketEfficiencyFactor: int("marketEfficiencyFactor").default(85),
  modelWeight: int("modelWeight").default(70),
  marketWeight: int("marketWeight").default(30),
  minProbabilityThreshold: int("minProbabilityThreshold").default(1),
  maxExactaCombinations: int("maxExactaCombinations").default(20),
  maxTrifectaCombinations: int("maxTrifectaCombinations").default(15),
  maxSuperfectaCombinations: int("maxSuperfectaCombinations").default(10),
  minEvThreshold: int("minEvThreshold").default(5),
  maxKellyFraction: int("maxKellyFraction").default(25),
  confidenceWeight: int("confidenceWeight").default(35),
  maxDailyExposure: int("maxDailyExposure").default(1000),
  maxPerBetExposure: int("maxPerBetExposure").default(100),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OptimizationConfig = typeof optimizationConfigs.$inferSelect;
export type InsertOptimizationConfig = typeof optimizationConfigs.$inferInsert;

export const performanceMetrics = mysqlTable("performance_metrics", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  totalRacesAnalyzed: int("totalRacesAnalyzed").default(0),
  totalSignalsGenerated: int("totalSignalsGenerated").default(0),
  profitableSignals: int("profitableSignals").default(0),
  avgExpectedValue: int("avgExpectedValue").default(0),
  avgSignalStrength: int("avgSignalStrength").default(0),
  avgConfidenceScore: int("avgConfidenceScore").default(0),
  totalKellyAllocation: int("totalKellyAllocation").default(0),
  totalBetsPlaced: int("totalBetsPlaced").default(0),
  winningBets: int("winningBets").default(0),
  totalWagered: int("totalWagered").default(0),
  totalReturned: int("totalReturned").default(0),
  netProfit: int("netProfit").default(0),
  roiPercentage: int("roiPercentage").default(0),
  maxDrawdown: int("maxDrawdown").default(0),
  volatility: int("volatility").default(0),
  sharpeRatio: int("sharpeRatio").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetrics = typeof performanceMetrics.$inferInsert;

// Subscription and Payment Tables
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(), // Basic, Pro, Premium
  stripeProductId: varchar("stripeProductId", { length: 100 }).notNull().unique(),
  stripePriceId: varchar("stripePriceId", { length: 100 }).notNull().unique(),
  priceInCents: int("priceInCents").notNull(), // Price in cents (e.g., 999 = $9.99)
  billingPeriod: varchar("billingPeriod", { length: 20 }).notNull(), // monthly, yearly
  predictionsPerMonth: int("predictionsPerMonth").notNull(), // -1 for unlimited
  hasApiAccess: int("hasApiAccess").default(0).notNull(),
  description: text("description"),
  features: text("features"), // JSON array of feature strings
  displayOrder: int("displayOrder").default(0),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  planId: int("planId").notNull().references(() => subscriptionPlans.id),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 100 }).notNull().unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(), // active, past_due, canceled, unpaid
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  canceledAt: timestamp("canceledAt"),
  cancelAtPeriodEnd: int("cancelAtPeriodEnd").default(0),
  predictionsUsedThisMonth: int("predictionsUsedThisMonth").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

export const paymentHistory = mysqlTable("payment_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 100 }).notNull().unique(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 100 }),
  amountInCents: int("amountInCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("usd"),
  status: varchar("status", { length: 20 }).notNull(), // paid, pending, failed
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentHistory = typeof paymentHistory.$inferSelect;
export type InsertPaymentHistory = typeof paymentHistory.$inferInsert;

export const predictionUsageLog = mysqlTable("prediction_usage_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  predictionsUsed: int("predictionsUsed").default(1),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM format
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PredictionUsageLog = typeof predictionUsageLog.$inferSelect;
export type InsertPredictionUsageLog = typeof predictionUsageLog.$inferInsert;
