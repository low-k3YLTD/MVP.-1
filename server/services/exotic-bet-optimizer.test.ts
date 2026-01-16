import { describe, it, expect } from "vitest";
import {
  exoticBetOptimizer,
  type HorseData,
  type OptimizationResult,
} from "./exoticBetOptimizer";

describe("Exotic Bet Optimizer", () => {
  const mockHorses: HorseData[] = [
    {
      id: 1,
      name: "Thunder Bolt",
      winProbability: 0.25,
      odds: 4.0,
      formRating: 92,
      speedRating: 95,
      classRating: 90,
    },
    {
      id: 2,
      name: "Lightning Strike",
      winProbability: 0.2,
      odds: 5.0,
      formRating: 88,
      speedRating: 92,
      classRating: 85,
    },
    {
      id: 3,
      name: "Storm Runner",
      winProbability: 0.18,
      odds: 5.5,
      formRating: 85,
      speedRating: 88,
      classRating: 82,
    },
    {
      id: 4,
      name: "Wind Dancer",
      winProbability: 0.15,
      odds: 6.5,
      formRating: 80,
      speedRating: 85,
      classRating: 78,
    },
    {
      id: 5,
      name: "Sky Flyer",
      winProbability: 0.12,
      odds: 8.0,
      formRating: 75,
      speedRating: 80,
      classRating: 72,
    },
    {
      id: 6,
      name: "Cloud Jumper",
      winProbability: 0.1,
      odds: 10.0,
      formRating: 70,
      speedRating: 75,
      classRating: 68,
    },
  ];

  it("should optimize a race and return results", () => {
    const result = exoticBetOptimizer.optimize("TEST_RACE_001", mockHorses);

    expect(result).toBeDefined();
    expect(result.raceId).toBe("TEST_RACE_001");
    expect(result.totalCombinationsAnalyzed).toBeGreaterThan(0);
    expect(result.topOpportunities).toBeDefined();
    expect(Array.isArray(result.topOpportunities)).toBe(true);
  });

  it("should generate exacta combinations", () => {
    const result = exoticBetOptimizer.optimize("TEST_RACE_002", mockHorses);

    expect(result.exactaBets).toBeDefined();
    expect(Array.isArray(result.exactaBets)).toBe(true);
    expect(result.exactaBets.length).toBeGreaterThan(0);

    // Verify exacta structure
    result.exactaBets.forEach((bet) => {
      expect(bet.betType).toBe("exacta");
      expect(bet.combination.length).toBe(2);
      expect(bet.combinationNames.length).toBe(2);
      expect(bet.probability).toBeGreaterThan(0);
      expect(bet.probability).toBeLessThanOrEqual(1);
      expect(bet.expectedValue).toBeDefined();
      expect(bet.kellyFraction).toBeGreaterThanOrEqual(0);
      expect(bet.kellyFraction).toBeLessThanOrEqual(0.25);
    });
  });

  it("should generate trifecta combinations", () => {
    const result = exoticBetOptimizer.optimize("TEST_RACE_003", mockHorses);

    expect(result.trifectaBets).toBeDefined();
    expect(Array.isArray(result.trifectaBets)).toBe(true);

    // Verify trifecta structure
    result.trifectaBets.forEach((bet) => {
      expect(bet.betType).toBe("trifecta");
      expect(bet.combination.length).toBe(3);
      expect(bet.combinationNames.length).toBe(3);
      expect(bet.probability).toBeGreaterThan(0);
      expect(bet.probability).toBeLessThanOrEqual(1);
    });
  });

  it("should generate superfecta combinations", () => {
    const result = exoticBetOptimizer.optimize("TEST_RACE_004", mockHorses);

    expect(result.superfectaBets).toBeDefined();
    expect(Array.isArray(result.superfectaBets)).toBe(true);

    // Verify superfecta structure
    result.superfectaBets.forEach((bet) => {
      expect(bet.betType).toBe("superfecta");
      expect(bet.combination.length).toBe(4);
      expect(bet.combinationNames.length).toBe(4);
      expect(bet.probability).toBeGreaterThan(0);
      expect(bet.probability).toBeLessThanOrEqual(1);
    });
  });

  it("should rank combinations by expected value", () => {
    const result = exoticBetOptimizer.optimize("TEST_RACE_005", mockHorses);

    // Top opportunities should be sorted by EV
    for (let i = 1; i < result.topOpportunities.length; i++) {
      expect(result.topOpportunities[i - 1].expectedValue).toBeGreaterThanOrEqual(
        result.topOpportunities[i].expectedValue
      );
    }
  });

  it("should calculate profitability metrics", () => {
    const result = exoticBetOptimizer.optimize("TEST_RACE_006", mockHorses);

    expect(result.profitableOpportunities).toBeGreaterThanOrEqual(0);
    expect(result.profitabilityRate).toBeGreaterThanOrEqual(0);
    expect(result.profitabilityRate).toBeLessThanOrEqual(1);
    expect(result.averageExpectedValue).toBeDefined();
    expect(result.maxExpectedValue).toBeDefined();
  });

  it("should handle horses with different form ratings", () => {
    const horsesWithFormRatings: HorseData[] = [
      {
        id: 1,
        name: "Good Form",
        winProbability: 0.3,
        odds: 3.5,
        formRating: 95,
        speedRating: 90,
      },
      {
        id: 2,
        name: "Bad Form",
        winProbability: 0.2,
        odds: 5.0,
        formRating: 50,
        speedRating: 70,
      },
      {
        id: 3,
        name: "Average Form",
        winProbability: 0.25,
        odds: 4.0,
        formRating: 75,
        speedRating: 80,
      },
    ];

    const result = exoticBetOptimizer.optimize(
      "TEST_RACE_007",
      horsesWithFormRatings
    );

    expect(result.topOpportunities).toBeDefined();
    expect(result.topOpportunities.length).toBeGreaterThan(0);

    // Horses with better form should have higher confidence scores
    const goodFormBets = result.topOpportunities.filter((b) =>
      b.combinationNames.includes("Good Form")
    );
    const badFormBets = result.topOpportunities.filter((b) =>
      b.combinationNames.includes("Bad Form")
    );

    if (goodFormBets.length > 0 && badFormBets.length > 0) {
      const avgGoodConfidence =
        goodFormBets.reduce((sum, b) => sum + b.confidenceScore, 0) /
        goodFormBets.length;
      const avgBadConfidence =
        badFormBets.reduce((sum, b) => sum + b.confidenceScore, 0) /
        badFormBets.length;

      expect(avgGoodConfidence).toBeGreaterThanOrEqual(avgBadConfidence);
    }
  });

  it("should process race in reasonable time", () => {
    const startTime = Date.now();
    const result = exoticBetOptimizer.optimize("TEST_RACE_008", mockHorses);
    const endTime = Date.now();

    expect(result.processingTimeMs).toBeLessThan(5000); // Should complete in under 5 seconds
    expect(endTime - startTime).toBeLessThan(5000);
  });

  it("should handle edge case with single horse", () => {
    const singleHorse: HorseData[] = [
      {
        id: 1,
        name: "Only Horse",
        winProbability: 1.0,
        odds: 1.0,
      },
    ];

    const result = exoticBetOptimizer.optimize("TEST_RACE_009", singleHorse);

    expect(result).toBeDefined();
    expect(result.raceId).toBe("TEST_RACE_009");
    // With only one horse, no exotic combinations are possible
    expect(result.exactaBets.length).toBe(0);
    expect(result.trifectaBets.length).toBe(0);
    expect(result.superfectaBets.length).toBe(0);
  });

  it("should handle edge case with two horses", () => {
    const twoHorses: HorseData[] = [
      {
        id: 1,
        name: "Horse A",
        winProbability: 0.5,
        odds: 2.0,
      },
      {
        id: 2,
        name: "Horse B",
        winProbability: 0.5,
        odds: 2.0,
      },
    ];

    const result = exoticBetOptimizer.optimize("TEST_RACE_010", twoHorses);

    expect(result).toBeDefined();
    // With two horses, only exacta combinations are possible
    expect(result.exactaBets.length).toBeGreaterThan(0);
    expect(result.trifectaBets.length).toBe(0);
    expect(result.superfectaBets.length).toBe(0);
  });

  it("should calibrate probabilities using market odds", () => {
    // Horses with high odds (low market probability) but high model probability
    const horsesWithOddsMismatch: HorseData[] = [
      {
        id: 1,
        name: "Undervalued",
        winProbability: 0.4, // High model probability
        odds: 10.0, // Low market probability
      },
      {
        id: 2,
        name: "Overvalued",
        winProbability: 0.1, // Low model probability
        odds: 1.5, // High market probability
      },
    ];

    const result = exoticBetOptimizer.optimize(
      "TEST_RACE_011",
      horsesWithOddsMismatch
    );

    expect(result).toBeDefined();
    // The optimizer should identify the undervalued horse as having better EV
    const undervaluedBets = result.topOpportunities.filter((b) =>
      b.combinationNames.includes("Undervalued")
    );
    expect(undervaluedBets.length).toBeGreaterThan(0);
  });
});
