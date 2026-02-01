/**
 * Automation Service
 * Handles continuous race detection, prediction generation, and results polling
 */

import { getLiveRaceDataService, type LiveRace } from "./liveRaceDataService";
import { getPredictionService } from "./predictionService";

export interface AutomationConfig {
  raceDetectionInterval: number; // milliseconds between race detection runs
  resultPollingInterval: number; // milliseconds between result polling runs
  resultPollingDelay: number; // milliseconds to wait after race time before polling for results
  maxRetries: number; // max retries for failed operations
  enabledCountries: string[]; // countries to focus on (e.g., ["AU", "NZ", "UK"])
}

const DEFAULT_CONFIG: AutomationConfig = {
  raceDetectionInterval: 5 * 60 * 1000, // 5 minutes for testing (change to 30 * 60 * 1000 for production)
  resultPollingInterval: 5 * 60 * 1000, // 5 minutes
  resultPollingDelay: 90 * 60 * 1000, // 90 minutes after race time
  maxRetries: 3,
  enabledCountries: ["AU", "NZ", "UK"],
};

// In-memory storage for predictions and results
interface StoredPrediction {
  id: string;
  raceId: string;
  raceName: string;
  trackName: string;
  raceTime: Date;
  predictions: any[];
  topPick: string;
  topPickScore: number;
  ensembleScore: number;
  createdAt: Date;
}

interface StoredResult {
  raceId: string;
  raceName: string;
  raceTime: Date;
  winner: string;
  placings: any[];
  winningOdds: number;
  resultFetchedAt: Date;
}

interface DailyStats {
  date: Date;
  totalRacesDetected: number;
  totalPredictionsGenerated: number;
  totalResultsFetched: number;
  topPickAccuracy: number;
  topPickPlaceAccuracy: number;
  totalProfit: number;
  isAutomationEnabled: number;
  lastRaceProcessedAt: Date;
}

class AutomationService {
  private config: AutomationConfig;
  private isRunning = false;
  private lastRaceDetectionTime = 0;
  private lastResultPollingTime = 0;
  private processedRaceIds = new Set<string>();
  
  // In-memory storage
  private predictions: Map<string, StoredPrediction> = new Map();
  private results: Map<string, StoredResult> = new Map();
  private dailyStats: DailyStats | null = null;

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
    console.log("[Automation] Automation loop started");
    
    while (this.isRunning) {
      try {
        const now = Date.now();

        // Run race detection immediately on first iteration, then at configured interval
        if (this.lastRaceDetectionTime === 0 || now - this.lastRaceDetectionTime >= this.config.raceDetectionInterval) {
          console.log("[Automation] Running race detection cycle");
          await this.detectAndPredictRaces();
          this.lastRaceDetectionTime = now;
        }

        // Run result polling at configured interval
        if (this.lastResultPollingTime === 0 || now - this.lastResultPollingTime >= this.config.resultPollingInterval) {
          console.log("[Automation] Running result polling cycle");
          await this.pollAndUpdateResults();
          this.lastResultPollingTime = now;
        }

        // Sleep for a short time to avoid busy-waiting
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
      } catch (error) {
        console.error("[Automation] Error in automation loop:", error);
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
      let races: LiveRace[] = [];
      try {
        races = await raceService.getUpcomingRaces("auto");
        console.log(`[Automation] Found ${races.length} upcoming races`);
      } catch (error) {
        console.error("[Automation] Error fetching races:", error);
        return;
      }

      let predictionsGenerated = 0;

      for (const race of races) {
        // Skip if already processed
        if (this.processedRaceIds.has(race.id)) {
          console.log(`[Automation] Skipping already processed race: ${race.id}`);
          continue;
        }

        // Skip if not in enabled countries
        if (!this.config.enabledCountries.includes(race.country)) {
          console.log(`[Automation] Skipping race ${race.id} - country ${race.country} not enabled`);
          continue;
        }

        try {
          // Generate predictions for this race
          console.log(`[Automation] Generating prediction for race ${race.id} (${race.name})`);
          const prediction = await this.generateRacePrediction(race, predictionService);
          if (prediction) {
            predictionsGenerated++;
            this.processedRaceIds.add(race.id);
            console.log(`[Automation] ✓ Generated prediction for race ${race.id}`);
          } else {
            console.log(`[Automation] ✗ Failed to generate prediction for race ${race.id}`);
          }
        } catch (error) {
          console.error(`[Automation] Error predicting race ${race.id}:`, error);
        }
      }

      // Update daily stats
      this.updateDailyStats({
        totalRacesDetected: races.length,
        totalPredictionsGenerated: predictionsGenerated,
      });

      console.log(`[Automation] Race detection complete. Generated ${predictionsGenerated}/${races.length} predictions`);
    } catch (error) {
      console.error("[Automation] Error in detectAndPredictRaces:", error);
    }
  }

  /**
   * Generate prediction for a single race
   */
  private async generateRacePrediction(race: LiveRace, predictionService: any): Promise<boolean> {
    try {
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

      console.log(`[Automation] Calling prediction service for ${horseFeatures.length} horses`);

      // Get predictions from ensemble service
      const predictions = await predictionService.predictBatch(
        horseFeatures.map((features) => ({
          features,
          raceId: race.id,
        }))
      );

      console.log(`[Automation] Received predictions:`, predictions);

      if (!predictions || predictions.length === 0) {
        console.log(`[Automation] No predictions returned for race ${race.id}`);
        return false;
      }

      const firstResult = predictions[0];
      const rankedHorses = race.horses
        .map((horse, idx) => ({
          name: horse.name,
          number: horse.number,
          score: firstResult?.predictions?.[idx]?.score || 0,
          rank: firstResult?.predictions?.[idx]?.rank || idx + 1,
          winProbability: this.calculateWinProbability(
            firstResult?.predictions?.[idx]?.score || 0,
            firstResult?.predictions
          ),
        }))
        .sort((a, b) => b.score - a.score);

      const topPick = rankedHorses[0];

      // Store prediction in memory
      const predictionId = `pred_${race.id}_${Date.now()}`;
      const storedPrediction: StoredPrediction = {
        id: predictionId,
        raceId: race.id,
        raceName: race.name,
        trackName: race.track,
        raceTime: new Date(race.time),
        predictions: rankedHorses,
        topPick: topPick.name,
        topPickScore: Math.round(topPick.score * 100),
        ensembleScore: Math.round((firstResult?.ensembleScore || 0) * 100),
        createdAt: new Date(),
      };

      this.predictions.set(race.id, storedPrediction);
      console.log(`[Automation] Stored prediction for race ${race.id}: Top pick = ${topPick.name} (${topPick.score * 100}%)`);

      return true;
    } catch (error) {
      console.error("[Automation] Error in generateRacePrediction:", error);
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

      let resultsFound = 0;

      for (const [raceId, prediction] of [...this.predictions.entries()]) {
        // Check if we already have results for this race
        if (this.results.has(raceId)) {
          continue;
        }

        // Check if enough time has passed since race time to poll for results
        const raceTime = prediction.raceTime.getTime();
        const now = Date.now();
        if (now - raceTime < this.config.resultPollingDelay) {
          // Too early to poll for results
          continue;
        }

        // Try to fetch results (placeholder - would call Racing API)
        try {
          const result = await this.fetchRaceResult(raceId);
          if (result) {
            this.results.set(raceId, result);
            resultsFound++;
            console.log(`[Automation] Found result for race ${raceId}: ${result.winner}`);

            // Calculate accuracy for this prediction
            this.calculatePredictionAccuracy(prediction, result);
          }
        } catch (error) {
          console.error(`[Automation] Failed to fetch result for race ${raceId}:`, error);
        }
      }

      console.log(`[Automation] Result polling complete. Found ${resultsFound} results`);
    } catch (error) {
      console.error("[Automation] Error in pollAndUpdateResults:", error);
    }
  }

  /**
   * Fetch race result from Racing API
   */
  private async fetchRaceResult(raceId: string): Promise<StoredResult | null> {
    // TODO: Implement actual Racing API result fetching
    // For now, return null to indicate no result available
    return null;
  }

  /**
   * Calculate accuracy of prediction vs actual result
   */
  private calculatePredictionAccuracy(prediction: StoredPrediction, result: StoredResult): void {
    try {
      const topPick = prediction.predictions[0];
      const topPickCorrect = topPick?.name === result.winner ? 1 : 0;
      const topPickPlaced = result.placings.some((p: any) => p.horseName === topPick?.name) ? 1 : 0;

      // Calculate profit/loss if $10 bet on top pick
      const profitLoss = topPickCorrect ? Math.round((10 * (result.winningOdds / 100 - 1)) * 100) : -1000;

      // Update daily stats with accuracy data
      this.updateDailyStats({
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
  private updateDailyStats(updates: Partial<DailyStats>): void {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!this.dailyStats) {
        this.dailyStats = {
          date: today,
          totalRacesDetected: updates.totalRacesDetected || 0,
          totalPredictionsGenerated: updates.totalPredictionsGenerated || 0,
          totalResultsFetched: updates.totalResultsFetched || 0,
          topPickAccuracy: updates.topPickAccuracy || 0,
          topPickPlaceAccuracy: updates.topPickPlaceAccuracy || 0,
          totalProfit: updates.totalProfit || 0,
          isAutomationEnabled: 1,
          lastRaceProcessedAt: new Date(),
        };
      } else {
        this.dailyStats.totalRacesDetected = (this.dailyStats.totalRacesDetected || 0) + (updates.totalRacesDetected || 0);
        this.dailyStats.totalPredictionsGenerated = (this.dailyStats.totalPredictionsGenerated || 0) + (updates.totalPredictionsGenerated || 0);
        this.dailyStats.totalResultsFetched = (this.dailyStats.totalResultsFetched || 0) + (updates.totalResultsFetched || 0);
        this.dailyStats.topPickAccuracy = (this.dailyStats.topPickAccuracy || 0) + (updates.topPickAccuracy || 0);
        this.dailyStats.topPickPlaceAccuracy = (this.dailyStats.topPickPlaceAccuracy || 0) + (updates.topPickPlaceAccuracy || 0);
        this.dailyStats.totalProfit = (this.dailyStats.totalProfit || 0) + (updates.totalProfit || 0);
        this.dailyStats.lastRaceProcessedAt = new Date();
      }
    } catch (error) {
      console.error("[Automation] Error updating stats:", error);
    }
  }

  /**
   * Get current automation status
   */
  async getStatus(): Promise<any> {
    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: this.dailyStats,
      predictionsCount: this.predictions.size,
      resultsCount: this.results.size,
      processedRaces: this.processedRaceIds.size,
    };
  }

  /**
   * Get live predictions
   */
  async getLivePredictions(limit: number = 20, offset: number = 0): Promise<any> {
    const predictions = Array.from(this.predictions.entries()).map(([_, p]) => p)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);

    return {
      predictions: predictions.map((p) => ({
        id: p.id,
        raceId: p.raceId,
        raceName: p.raceName,
        trackName: p.trackName,
        raceTime: p.raceTime,
        topPick: p.topPick,
        topPickScore: p.topPickScore,
        ensembleScore: p.ensembleScore,
        predictions: p.predictions,
        createdAt: p.createdAt,
      })),
      total: this.predictions.size,
    };
  }

  /**
   * Get race results
   */
  async getRaceResults(limit: number = 20, offset: number = 0): Promise<any> {
    const results = Array.from(this.results.entries()).map(([_, r]) => r)
      .sort((a, b) => b.raceTime.getTime() - a.raceTime.getTime())
      .slice(offset, offset + limit);

    return {
      results: results.map((r) => ({
        raceId: r.raceId,
        raceName: r.raceName,
        raceTime: r.raceTime,
        winner: r.winner,
        placings: r.placings,
        resultFetchedAt: r.resultFetchedAt,
      })),
      total: this.results.size,
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    let topPickHits = 0;
    let topPickPlaces = 0;
    let totalProfit = 0;

    for (const [raceId, prediction] of [...this.predictions.entries()]) {
      const result = this.results.get(raceId);
      if (!result) continue;

      const topPick = prediction.predictions[0];
      if (topPick?.name === result.winner) {
        topPickHits++;
        totalProfit += Math.round((10 * (result.winningOdds / 100 - 1)) * 100);
      } else {
        totalProfit -= 1000;
      }

      if (result.placings.some((p: any) => p.horseName === topPick?.name)) {
        topPickPlaces++;
      }
    }

    const completedRaces = Array.from(this.predictions.values()).filter((p) =>
      this.results.has(p.raceId)
    ).length;

    return {
      totalPredictions: this.predictions.size,
      completedRaces,
      topPickAccuracy: completedRaces > 0 ? Math.round((topPickHits / completedRaces) * 10000) / 100 : 0,
      topPickPlaceAccuracy: completedRaces > 0 ? Math.round((topPickPlaces / completedRaces) * 10000) / 100 : 0,
      totalProfit,
      roi: completedRaces > 0 ? Math.round((totalProfit / (completedRaces * 1000)) * 10000) / 100 : 0,
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
