/**
 * Exotic Bet Optimizer Service
 * Generates optimal exotic bet combinations (exacta, trifecta, superfecta)
 * with expected value analysis and Kelly criterion allocation
 */

export interface HorseData {
  id: number;
  name: string;
  winProbability: number;
  odds: number;
  formRating?: number;
  speedRating?: number;
  classRating?: number;
}

export interface BetCombination {
  betType: "exacta" | "trifecta" | "superfecta";
  combination: number[]; // Horse IDs
  combinationNames: string[];
  probability: number;
  payoutOdds: number;
  expectedValue: number;
  kellyFraction: number;
  confidenceScore: number;
  evRank?: number;
}

export interface OptimizationResult {
  raceId: string;
  totalCombinationsAnalyzed: number;
  profitableOpportunities: number;
  profitabilityRate: number;
  averageExpectedValue: number;
  maxExpectedValue: number;
  topOpportunities: BetCombination[];
  exactaBets: BetCombination[];
  trifectaBets: BetCombination[];
  superfectaBets: BetCombination[];
  processingTimeMs: number;
}

interface OptimizationConfig {
  minEvThreshold: number;
  maxExactaCombinations: number;
  maxTrifectaCombinations: number;
  maxSuperfectaCombinations: number;
  marketEfficiencyFactor: number;
  modelWeight: number;
  marketWeight: number;
  maxKellyFraction: number;
}

class ExoticBetOptimizer {
  private config: OptimizationConfig;

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      minEvThreshold: config?.minEvThreshold ?? -0.1, // Allow slightly negative EV for testing
      maxExactaCombinations: config?.maxExactaCombinations ?? 20,
      maxTrifectaCombinations: config?.maxTrifectaCombinations ?? 15,
      maxSuperfectaCombinations: config?.maxSuperfectaCombinations ?? 10,
      marketEfficiencyFactor: config?.marketEfficiencyFactor ?? 0.85,
      modelWeight: config?.modelWeight ?? 0.7,
      marketWeight: config?.marketWeight ?? 0.3,
      maxKellyFraction: config?.maxKellyFraction ?? 0.25,
    };
  }

  /**
   * Calibrate win probabilities using market odds
   */
  private calibrateProbabilities(horses: HorseData[]): HorseData[] {
    const impliedProbabilities = horses.map((h) => {
      // Convert odds to implied probability
      const impliedProb = 1 / (h.odds + 1);
      return impliedProb;
    });

    const sumImplied = impliedProbabilities.reduce((a, b) => a + b, 0);

    // Blend model predictions with market odds
    return horses.map((horse, idx) => {
      const marketProb = impliedProbabilities[idx] / sumImplied;
      const calibratedProb =
        this.config.modelWeight * horse.winProbability +
        this.config.marketWeight * marketProb;

      return {
        ...horse,
        winProbability: Math.min(calibratedProb, 0.99),
      };
    });
  }

  /**
   * Generate exacta combinations
   */
  private generateExactaCombinations(horses: HorseData[]): BetCombination[] {
    const combinations: BetCombination[] = [];

    for (let i = 0; i < horses.length; i++) {
      for (let j = 0; j < horses.length; j++) {
        if (i !== j) {
          const horse1 = horses[i];
          const horse2 = horses[j];

          // Probability of this exact order
          const probability = horse1.winProbability * horse2.winProbability;

          // Estimate payout odds for exacta
          // Exacta payouts are typically 4-6x the product of individual odds
          const oddsProduct = horse1.odds * horse2.odds;
          const payoutOdds = oddsProduct * 2; // Multiply by 2 for realistic exacta payout

          // Expected value: (probability * payout) - 1 (the $1 bet)
          const expectedValue = probability * payoutOdds - 1;

          // Kelly fraction
          const kellyFraction =
            expectedValue > 0
              ? Math.min(
                  (probability * payoutOdds - 1) / payoutOdds,
                  this.config.maxKellyFraction
                )
              : 0;

          // Confidence score based on form ratings
          const confidence = this.calculateConfidence(horse1, horse2);

          if (expectedValue >= this.config.minEvThreshold) {
            combinations.push({
              betType: "exacta",
              combination: [horse1.id, horse2.id],
              combinationNames: [horse1.name, horse2.name],
              probability,
              payoutOdds,
              expectedValue,
              kellyFraction,
              confidenceScore: confidence,
            });
          }
        }
      }
    }

    // Sort by expected value and limit
    return combinations
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, this.config.maxExactaCombinations);
  }

  /**
   * Generate trifecta combinations
   */
  private generateTrifectaCombinations(horses: HorseData[]): BetCombination[] {
    const combinations: BetCombination[] = [];

    // Only consider top horses to reduce combinations
    const topHorses = horses.slice(0, Math.min(8, horses.length));

    for (let i = 0; i < topHorses.length; i++) {
      for (let j = 0; j < topHorses.length; j++) {
        for (let k = 0; k < topHorses.length; k++) {
          if (i !== j && j !== k && i !== k) {
            const horse1 = topHorses[i];
            const horse2 = topHorses[j];
            const horse3 = topHorses[k];

            const probability =
              horse1.winProbability *
              horse2.winProbability *
              horse3.winProbability;

            // Trifecta payouts are typically 8-15x the product of odds
            const oddsProduct = horse1.odds * horse2.odds * horse3.odds;
            const payoutOdds = oddsProduct * 3; // Multiply by 3 for realistic trifecta payout
            const expectedValue = probability * payoutOdds - 1;

            const kellyFraction =
              expectedValue > 0
                ? Math.min(
                    (probability * payoutOdds - 1) / payoutOdds,
                    this.config.maxKellyFraction
                  )
                : 0;

            const confidence = this.calculateConfidence(
              horse1,
              horse2,
              horse3
            );

            if (expectedValue >= this.config.minEvThreshold) {
              combinations.push({
                betType: "trifecta",
                combination: [horse1.id, horse2.id, horse3.id],
                combinationNames: [horse1.name, horse2.name, horse3.name],
                probability,
                payoutOdds,
                expectedValue,
                kellyFraction,
                confidenceScore: confidence,
              });
            }
          }
        }
      }
    }

    return combinations
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, this.config.maxTrifectaCombinations);
  }

  /**
   * Generate superfecta combinations
   */
  private generateSuperfectaCombinations(
    horses: HorseData[]
  ): BetCombination[] {
    const combinations: BetCombination[] = [];

    // Only consider top horses
    const topHorses = horses.slice(0, Math.min(6, horses.length));

    for (let i = 0; i < topHorses.length; i++) {
      for (let j = 0; j < topHorses.length; j++) {
        for (let k = 0; k < topHorses.length; k++) {
          for (let l = 0; l < topHorses.length; l++) {
            if (i !== j && j !== k && k !== l && i !== k && i !== l && j !== l) {
              const horse1 = topHorses[i];
              const horse2 = topHorses[j];
              const horse3 = topHorses[k];
              const horse4 = topHorses[l];

              const probability =
                horse1.winProbability *
                horse2.winProbability *
                horse3.winProbability *
                horse4.winProbability;

              // Superfecta payouts are typically 20-50x the product of odds
              const oddsProduct = horse1.odds * horse2.odds * horse3.odds * horse4.odds;
              const payoutOdds = oddsProduct * 5; // Multiply by 5 for realistic superfecta payout
              const expectedValue = probability * payoutOdds - 1;

              const kellyFraction =
                expectedValue > 0
                  ? Math.min(
                      (probability * payoutOdds - 1) / payoutOdds,
                      this.config.maxKellyFraction
                    )
                  : 0;

              const confidence = this.calculateConfidence(
                horse1,
                horse2,
                horse3,
                horse4
              );

              if (expectedValue >= this.config.minEvThreshold) {
                combinations.push({
                  betType: "superfecta",
                  combination: [horse1.id, horse2.id, horse3.id, horse4.id],
                  combinationNames: [
                    horse1.name,
                    horse2.name,
                    horse3.name,
                    horse4.name,
                  ],
                  probability,
                  payoutOdds,
                  expectedValue,
                  kellyFraction,
                  confidenceScore: confidence,
                });
              }
            }
          }
        }
      }
    }

    return combinations
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, this.config.maxSuperfectaCombinations);
  }

  /**
   * Calculate confidence score based on form ratings
   */
  private calculateConfidence(...horses: HorseData[]): number {
    const avgFormRating =
      horses.reduce((sum, h) => sum + (h.formRating ?? 70), 0) / horses.length;
    const avgSpeedRating =
      horses.reduce((sum, h) => sum + (h.speedRating ?? 70), 0) / horses.length;

    // Normalize to 0-1 range
    const formConfidence = Math.min(avgFormRating / 100, 1);
    const speedConfidence = Math.min(avgSpeedRating / 100, 1);

    return (formConfidence + speedConfidence) / 2;
  }

  /**
   * Optimize race for exotic bets
   */
  optimize(raceId: string, horses: HorseData[]): OptimizationResult {
    const startTime = Date.now();

    // Step 1: Calibrate probabilities
    const calibratedHorses = this.calibrateProbabilities(horses);

    // Step 2: Sort by win probability
    const sortedHorses = [...calibratedHorses].sort(
      (a, b) => b.winProbability - a.winProbability
    );

    // Step 3: Generate combinations
    const exactaBets = this.generateExactaCombinations(sortedHorses);
    const trifectaBets = this.generateTrifectaCombinations(sortedHorses);
    const superfectaBets = this.generateSuperfectaCombinations(sortedHorses);

    // Step 4: Combine and rank
    const allBets = [...exactaBets, ...trifectaBets, ...superfectaBets];
    const topOpportunities = allBets
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, 10)
      .map((bet, idx) => ({
        ...bet,
        evRank: idx + 1,
      }));

    // Step 5: Calculate metrics
    const profitableBets = allBets.filter((b) => b.expectedValue > 0);
    const avgEV =
      allBets.length > 0
        ? allBets.reduce((sum, b) => sum + b.expectedValue, 0) / allBets.length
        : 0;
    const maxEV = allBets.length > 0 ? allBets[0].expectedValue : 0;

    const processingTimeMs = Date.now() - startTime;

    return {
      raceId,
      totalCombinationsAnalyzed: allBets.length,
      profitableOpportunities: profitableBets.length,
      profitabilityRate:
        allBets.length > 0 ? profitableBets.length / allBets.length : 0,
      averageExpectedValue: avgEV,
      maxExpectedValue: maxEV,
      topOpportunities,
      exactaBets: exactaBets.slice(0, 5),
      trifectaBets: trifectaBets.slice(0, 5),
      superfectaBets: superfectaBets.slice(0, 5),
      processingTimeMs,
    };
  }
}

// Export singleton instance
export const exoticBetOptimizer = new ExoticBetOptimizer();
