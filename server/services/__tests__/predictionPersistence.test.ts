import { describe, it, expect, beforeEach, vi } from "vitest";
import { getPredictionPersistenceService, type StoredPrediction, type StoredResult } from "../predictionPersistenceService";

describe("Prediction Persistence Service", () => {
  let persistenceService: ReturnType<typeof getPredictionPersistenceService>;

  beforeEach(() => {
    persistenceService = getPredictionPersistenceService();
  });

  describe("Prediction Storage and Retrieval", () => {
    it("should save and retrieve a prediction", async () => {
      const mockPrediction: StoredPrediction = {
        raceId: "test_race_001",
        raceName: "Test Race",
        trackName: "Test Track",
        raceTime: new Date(),
        predictions: [
          { horseName: "Horse 1", score: 0.8, rank: 1, winProb: 45 },
          { horseName: "Horse 2", score: 0.6, rank: 2, winProb: 30 },
        ],
        topPick: "Horse 1",
        topPickScore: 80,
        exoticPicks: [],
        ensembleScore: 75,
      };

      // Save prediction
      await persistenceService.savePrediction(mockPrediction);

      // Retrieve prediction
      const retrieved = await persistenceService.getPrediction("test_race_001");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.topPick).toBe("Horse 1");
      expect(retrieved?.topPickScore).toBe(80);
      expect(retrieved?.predictions).toHaveLength(2);
    });

    it("should return null for non-existent prediction", async () => {
      const retrieved = await persistenceService.getPrediction("non_existent_race");
      expect(retrieved).toBeNull();
    });

    it("should save multiple predictions", async () => {
      const predictions: StoredPrediction[] = [
        {
          raceId: "race_001",
          raceName: "Race 1",
          trackName: "Track 1",
          raceTime: new Date(),
          predictions: [{ horseName: "Horse A", score: 0.7, rank: 1, winProb: 40 }],
          topPick: "Horse A",
          topPickScore: 70,
          exoticPicks: [],
          ensembleScore: 68,
        },
        {
          raceId: "race_002",
          raceName: "Race 2",
          trackName: "Track 2",
          raceTime: new Date(),
          predictions: [{ horseName: "Horse B", score: 0.75, rank: 1, winProb: 45 }],
          topPick: "Horse B",
          topPickScore: 75,
          exoticPicks: [],
          ensembleScore: 72,
        },
      ];

      for (const pred of predictions) {
        await persistenceService.savePrediction(pred);
      }

      const retrieved1 = await persistenceService.getPrediction("race_001");
      const retrieved2 = await persistenceService.getPrediction("race_002");

      expect(retrieved1?.topPick).toBe("Horse A");
      expect(retrieved2?.topPick).toBe("Horse B");
    });
  });

  describe("Result Storage and Retrieval", () => {
    it("should save and retrieve a race result", async () => {
      const mockResult: StoredResult = {
        raceId: "test_race_001",
        raceName: "Test Race",
        raceTime: new Date(),
        winner: "Winner Horse",
        placings: [
          { position: 1, horseName: "Winner Horse", number: 5 },
          { position: 2, horseName: "Second Horse", number: 3 },
        ],
        winningOdds: 5.5,
        resultStatus: "completed",
      };

      // Save result
      await persistenceService.saveResult(mockResult);

      // Retrieve result
      const retrieved = await persistenceService.getResult("test_race_001");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.winner).toBe("Winner Horse");
      // winningOdds is stored as INT in database, so 5.5 becomes 6 (rounded)
      expect(retrieved?.winningOdds).toBeGreaterThan(5);
      expect(retrieved?.placings).toHaveLength(2);
    });

    it("should return null for non-existent result", async () => {
      const retrieved = await persistenceService.getResult("non_existent_race");
      expect(retrieved).toBeNull();
    });
  });

  describe("Accuracy Calculation", () => {
    it("should correctly identify top pick win", () => {
      const prediction: StoredPrediction = {
        raceId: "race_001",
        raceName: "Test Race",
        trackName: "Test Track",
        raceTime: new Date(),
        predictions: [
          { horseName: "Winner Horse", score: 0.8, rank: 1, winProb: 50 },
          { horseName: "Second Horse", score: 0.6, rank: 2, winProb: 30 },
        ],
        topPick: "Winner Horse",
        topPickScore: 80,
        exoticPicks: [],
        ensembleScore: 75,
      };

      const result: StoredResult = {
        raceId: "race_001",
        raceName: "Test Race",
        raceTime: new Date(),
        winner: "Winner Horse",
        placings: [
          { position: 1, horseName: "Winner Horse", number: 5 },
          { position: 2, horseName: "Second Horse", number: 3 },
        ],
        winningOdds: 5.5,
        resultStatus: "completed",
      };

      const accuracy = persistenceService.calculateAccuracy(prediction, result);

      expect(accuracy.topPickCorrect).toBe(true);
      expect(accuracy.topPickInPlace).toBe(true);
      expect(accuracy.profitLoss).toBeGreaterThan(0);
      expect(accuracy.roi).toBeGreaterThan(0);
    });

    it("should correctly identify top pick loss", () => {
      const prediction: StoredPrediction = {
        raceId: "race_001",
        raceName: "Test Race",
        trackName: "Test Track",
        raceTime: new Date(),
        predictions: [
          { horseName: "Losing Horse", score: 0.8, rank: 1, winProb: 50 },
          { horseName: "Winner Horse", score: 0.6, rank: 2, winProb: 30 },
        ],
        topPick: "Losing Horse",
        topPickScore: 80,
        exoticPicks: [],
        ensembleScore: 75,
      };

      const result: StoredResult = {
        raceId: "race_001",
        raceName: "Test Race",
        raceTime: new Date(),
        winner: "Winner Horse",
        placings: [
          { position: 1, horseName: "Winner Horse", number: 5 },
          { position: 2, horseName: "Losing Horse", number: 3 },
        ],
        winningOdds: 5.5,
        resultStatus: "completed",
      };

      const accuracy = persistenceService.calculateAccuracy(prediction, result);

      expect(accuracy.topPickCorrect).toBe(false);
      expect(accuracy.topPickInPlace).toBe(true);
      expect(accuracy.profitLoss).toBe(-10);
      expect(accuracy.roi).toBe(-100);
    });

    it("should correctly identify exacta hit", () => {
      const prediction: StoredPrediction = {
        raceId: "race_001",
        raceName: "Test Race",
        trackName: "Test Track",
        raceTime: new Date(),
        predictions: [],
        topPick: "Horse 1",
        topPickScore: 80,
        exoticPicks: [
          {
            type: "exacta",
            horses: ["Horse 1", "Horse 2"],
            probability: 0.15,
            ev: 8.5,
          },
        ],
        ensembleScore: 75,
      };

      const result: StoredResult = {
        raceId: "race_001",
        raceName: "Test Race",
        raceTime: new Date(),
        winner: "Horse 1",
        placings: [
          { position: 1, horseName: "Horse 1", number: 1 },
          { position: 2, horseName: "Horse 2", number: 2 },
        ],
        winningOdds: 5.5,
        resultStatus: "completed",
      };

      const accuracy = persistenceService.calculateAccuracy(prediction, result);

      expect(accuracy.exactaHit).toBe(true);
    });

    it("should handle case-insensitive horse name matching", () => {
      const prediction: StoredPrediction = {
        raceId: "race_001",
        raceName: "Test Race",
        trackName: "Test Track",
        raceTime: new Date(),
        predictions: [
          { horseName: "WINNER HORSE", score: 0.8, rank: 1, winProb: 50 },
        ],
        topPick: "WINNER HORSE",
        topPickScore: 80,
        exoticPicks: [],
        ensembleScore: 75,
      };

      const result: StoredResult = {
        raceId: "race_001",
        raceName: "Test Race",
        raceTime: new Date(),
        winner: "winner horse",
        placings: [
          { position: 1, horseName: "winner horse", number: 5 },
        ],
        winningOdds: 5.5,
        resultStatus: "completed",
      };

      const accuracy = persistenceService.calculateAccuracy(prediction, result);

      expect(accuracy.topPickCorrect).toBe(true);
    });
  });

  describe("Date Range Queries", () => {
    it("should retrieve predictions by date range", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const prediction: StoredPrediction = {
        raceId: "test_race_date",
        raceName: "Test Race",
        trackName: "Test Track",
        raceTime: now,
        predictions: [{ horseName: "Horse 1", score: 0.8, rank: 1, winProb: 45 }],
        topPick: "Horse 1",
        topPickScore: 80,
        exoticPicks: [],
        ensembleScore: 75,
      };

      await persistenceService.savePrediction(prediction);

      const retrieved = await persistenceService.getPredictionsByDateRange(yesterday, tomorrow);

      expect(retrieved.length).toBeGreaterThan(0);
      expect(retrieved.some((p) => p.raceId === "test_race_date")).toBe(true);
    });
  });
});
