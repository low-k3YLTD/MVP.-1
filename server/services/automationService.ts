/**
 * Automation Service
 * Handles continuous race detection, prediction generation, and results polling
 */

import { getLiveRaceDataService, type LiveRace } from "./liveRaceDataService";
import { getPredictionService } from "./predictionService";
import { getDb } from "../db";
import { automationRuns, raceResultsLog, automationStats } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface AutomationConfig {
  raceDetectionInterval: number; // milliseconds between race detection runs
  resultPollingInterval: number; // milliseconds between result polling runs
  resultPollingDelay: number; // milliseconds to wait after race time before polling for results
  maxRetries: number; // max retries for failed operations
  enabledCountries: string[]; // countries to focus on (e.g., ["AU", "NZ", "UK"])
}

const DEFAULT_CONFIG: AutomationConfig = {
  raceDetectionInterval: 30 * 60 * 1000, // 30 minutes
  resultPollingInterval: 5 * 60 * 1000, // 5 minutes
  resultPollingDelay: 90 * 60 * 1000, // 90 minutes after race time
  maxRetries: 3,
  enabledCountries: ["AU", "NZ", "UK"],
};

class AutomationService {
  private config: AutomationConfig;
  private isRunning = false;
  private lastRaceDetectionTime = 0;
  private lastResultPollingTime = 0;
  private processedRaceIds = new Set<string>();

  constructor(config: Partial<AutomationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the automation loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[Automation] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[Automation] Starting automation service");

    // Start the main automation loop
    this.runAutomationLoop();
  }

  /**
   * Stop the automation loop
   */
  stop(): void {
    this.isRunning = false;
    console.log("[Automation] Stopping automation service");
  }

  /**
   * Main automation loop that runs continuously
   */
  private async runAutomationLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const now = Date.now();

        // Run race detection at configured interval
        if (now - this.lastRaceDetectionTime >= this.config.raceDetectionInterval) {
          await this.detectAndPredictRaces();
          this.lastRaceDetectionTime = now;
        }

        // Run result polling at configured interval
        if (now - this.lastResultPollingTime >= this.config.resultPollingInterval) {
          await this.pollAndUpdateResults();
          this.lastResultPollingTime = now;
        }

        // Sleep for a short time to avoid busy-waiting
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
      } catch (error) {
        console.error("[Automation] Error in automation loop:", error);
        await this.logAutomationError("automation_loop_error", error as Error);
        // Continue running despite errors
        await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute before retrying
      }
    }
  }

  /**
   * Detect new races and generate predictions
   */
  private async detectAndPredictRaces(): Promise<void> {
    try {
      console.log("[Automation] Starting race detection...");
      const raceService = getLiveRaceDataService();
      const predictionService = getPredictionService();

      // Get upcoming races
      const races = await raceService.getUpcomingRaces("auto");
      console.log(`[Automation] Found ${races.length} upcoming races`);

      let predictionsGenerated = 0;

      for (const race of races) {
        // Skip if already processed
        if (this.processedRaceIds.has(race.id)) {
          continue;
        }

        // Skip if not in enabled countries
        if (!this.config.enabledCountries.includes(race.country)) {
          continue;
        }

        try {
          // Generate predictions for this race
          const prediction = await this.generateRacePrediction(race, predictionService);
          if (prediction) {
            predictionsGenerated++;
            this.processedRaceIds.add(race.id);
            console.log(`[Automation] Generated prediction for race ${race.id}`);
          }
        } catch (error) {
          console.error(`[Automation] Failed to predict race ${race.id}:`, error);
          await this.logAutomationError("prediction_generation_failed", error as Error, race.id);
        }
      }

      // Update daily stats
      await this.updateDailyStats({
        totalRacesDetected: races.length,
        totalPredictionsGenerated: predictionsGenerated,
      });

      console.log(`[Automation] Race detection complete. Generated ${predictionsGenerated} predictions`);
    } catch (error) {
      console.error("[Automation] Error detecting races:", error);
      await this.logAutomationError("race_detection_failed", error as Error);
    }
  }

  /**
   * Generate prediction for a single race
   */
  private async generateRacePrediction(race: LiveRace, predictionService: any): Promise<boolean> {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Prepare horse features for prediction
      const horseFeatures = race.horses.map((horse) => ({
        horse_name: horse.name,
        horse_age: 4 + Math.random() * 8,
        jockey_experience: 50 + Math.random() * 150,
        trainer_wins: 20 + Math.random() * 100,
        recent_form: Math.floor(Math.random() * 5),
        distance_preference: 1200 + Math.random() * 2000,
        track_preference: 0.5 + Math.random() * 0.5,
        weight: parseInt(horse.weight?.replace(/[^0-9]/g, "") || "140"),
        odds: horse.odds || 5.0,
      }));

      // Get predictions from ensemble service
      const predictions = await predictionService.predictBatch(
        horseFeatures.map((features) => ({
          features,
          raceId: race.id,
        }))
      );

      if (!predictions || predictions.length === 0) {
        return false;
      }

      const firstResult = predictions[0];
      const rankedHorses = race.horses
        .map((horse, idx) => ({
          name: horse.name,
          number: horse.number,
          score: firstResult?.predictions[idx]?.score || 0,
          rank: firstResult?.predictions[idx]?.rank || idx + 1,
          winProbability: this.calculateWinProbability(firstResult?.predictions[idx]?.score || 0, firstResult?.predictions),
        }))
        .sort((a, b) => b.score - a.score);

      const topPick = rankedHorses[0];

      // Store prediction in database
      await db.insert(automationRuns).values({
        raceId: race.id,
        raceName: race.name,
        trackName: race.track,
        raceTime: new Date(race.time),
        predictions: JSON.stringify(rankedHorses),
        topPick: topPick.name,
        topPickScore: Math.round(topPick.score * 100),
        exoticPicks: JSON.stringify([]), // TODO: Generate exotic picks
        ensembleScore: Math.round((firstResult?.ensembleScore || 0) * 100),
      });

      return true;
    } catch (error) {
      console.error("[Automation] Error generating prediction:", error);
      throw error;
    }
  }

  /**
   * Calculate win probability from score
   */
  private calculateWinProbability(score: number, allScores: any[]): number {
    if (!allScores || allScores.length === 0) return 0;

    const scores = allScores.map((p) => p?.score || 0);
    const maxScore = Math.max(...scores);
    const expScores = scores.map((s) => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const myExpScore = Math.exp(score - maxScore);

    return Math.round((myExpScore / sumExp) * 100);
  }

  /**
   * Poll for race results and update predictions
   */
  private async pollAndUpdateResults(): Promise<void> {
    try {
      console.log("[Automation] Starting result polling...");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all predictions that haven't been matched with results yet
      const predictions = await db.select().from(automationRuns);

      let resultsFound = 0;

      for (const prediction of predictions) {
        // Check if we already have results for this race
        const existingResult = await db
          .select()
          .from(raceResultsLog)
          .where(eq(raceResultsLog.raceId, prediction.raceId))
          .limit(1);

        if (existingResult.length > 0) {
          // Already have results for this race
          continue;
        }

        // Check if enough time has passed since race time to poll for results
        const raceTime = new Date(prediction.raceTime).getTime();
        const now = Date.now();
        if (now - raceTime < this.config.resultPollingDelay) {
          // Too early to poll for results
          continue;
        }

        // Try to fetch results from Racing API
        try {
          const result = await this.fetchRaceResult(prediction.raceId);
          if (result) {
            // Store result
            await db.insert(raceResultsLog).values({
              raceId: prediction.raceId,
              raceName: prediction.raceName,
              raceTime: prediction.raceTime,
              winner: result.winner,
              placings: JSON.stringify(result.placings),
              winningOdds: result.winningOdds,
              resultStatus: "completed",
              resultFetchedAt: new Date(),
            });

            resultsFound++;
            console.log(`[Automation] Found result for race ${prediction.raceId}: ${result.winner}`);

            // Calculate accuracy for this prediction
            await this.calculatePredictionAccuracy(prediction, result);
          }
        } catch (error) {
          console.error(`[Automation] Failed to fetch result for race ${prediction.raceId}:`, error);
        }
      }

      // Update daily stats
      await this.updateDailyStats({
        totalResultsFetched: resultsFound,
      });

      console.log(`[Automation] Result polling complete. Found ${resultsFound} results`);
    } catch (error) {
      console.error("[Automation] Error polling results:", error);
      await this.logAutomationError("result_polling_failed", error as Error);
    }
  }

  /**
   * Fetch race result from Racing API
   */
  private async fetchRaceResult(raceId: string): Promise<any> {
    // TODO: Implement actual Racing API result fetching
    // For now, return null to indicate no result available
    return null;
  }

  /**
   * Calculate accuracy of prediction vs actual result
   */
  private async calculatePredictionAccuracy(prediction: any, result: any): Promise<void> {
    try {
      const predictions = JSON.parse(prediction.predictions || "[]");
      const placings = JSON.parse(result.placings || "[]");

      // Check if top pick was correct
      const topPick = predictions[0];
      const topPickCorrect = topPick?.name === result.winner ? 1 : 0;

      // Check if top pick placed (top 4)
      const topPickPlaced = placings.some((p: any) => p.horseName === topPick?.name) ? 1 : 0;

      // Calculate profit/loss if $10 bet on top pick
      const profitLoss = topPickCorrect ? Math.round((10 * (result.winningOdds / 100 - 1)) * 100) : -1000; // -$10 if lost

      // Update daily stats with accuracy data
      await this.updateDailyStats({
        topPickAccuracy: topPickCorrect,
        topPickPlaceAccuracy: topPickPlaced,
        totalProfit: profitLoss,
      });
    } catch (error) {
      console.error("[Automation] Error calculating accuracy:", error);
    }
  }

  /**
   * Update daily automation statistics
   */
  private async updateDailyStats(updates: Partial<any>): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingStats = await db
        .select()
        .from(automationStats)
        .where(eq(automationStats.date, today))
        .limit(1);

      if (existingStats.length > 0) {
        // Update existing stats
        const current = existingStats[0];
        await db
          .update(automationStats)
          .set({
            totalRacesDetected: (current.totalRacesDetected || 0) + (updates.totalRacesDetected || 0),
            totalPredictionsGenerated: (current.totalPredictionsGenerated || 0) + (updates.totalPredictionsGenerated || 0),
            totalResultsFetched: (current.totalResultsFetched || 0) + (updates.totalResultsFetched || 0),
            totalProfit: (current.totalProfit || 0) + (updates.totalProfit || 0),
            lastRaceProcessedAt: new Date(),
          })
          .where(eq(automationStats.date, today));
      } else {
        // Create new stats entry
        await db.insert(automationStats).values({
          date: today,
          totalRacesDetected: updates.totalRacesDetected || 0,
          totalPredictionsGenerated: updates.totalPredictionsGenerated || 0,
          totalResultsFetched: updates.totalResultsFetched || 0,
          totalProfit: updates.totalProfit || 0,
          isAutomationEnabled: 1,
        });
      }
    } catch (error) {
      console.error("[Automation] Error updating stats:", error);
    }
  }

  /**
   * Log automation errors
   */
  private async logAutomationError(eventType: string, error: Error, raceId?: string): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      // TODO: Insert into automation_logs table when it's available
      console.log(`[Automation] Logged error: ${eventType} - ${error.message}`);
    } catch (err) {
      console.error("[Automation] Error logging error:", err);
    }
  }

  /**
   * Get current automation status
   */
  async getStatus(): Promise<any> {
    const db = await getDb();
    if (!db) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await db
      .select()
      .from(automationStats)
      .where(eq(automationStats.date, today))
      .limit(1);

    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: stats[0] || null,
      processedRaces: this.processedRaceIds.size,
    };
  }

  /**
   * Enable/disable automation
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled && !this.isRunning) {
      await this.start();
    } else if (!enabled && this.isRunning) {
      this.stop();
    }
  }
}

// Singleton instance
let automationService: AutomationService | null = null;

export function getAutomationService(config?: Partial<AutomationConfig>): AutomationService {
  if (!automationService) {
    automationService = new AutomationService(config);
  }
  return automationService;
}
