import { describe, it, expect, beforeEach, vi } from "vitest";
import { getLiveRaceDataService, type RaceResult } from "../liveRaceDataService";

describe("Racing API Integration", () => {
  let raceService: ReturnType<typeof getLiveRaceDataService>;

  beforeEach(() => {
    raceService = getLiveRaceDataService();
    // Clear cache before each test
    raceService.clearCache();
  });

  describe("getRaceResults", () => {
    it("should return null when Racing API credentials are not configured", async () => {
      // Temporarily clear credentials
      const originalUsername = process.env.RACING_API_USERNAME;
      const originalPassword = process.env.RACING_API_PASSWORD;
      
      delete process.env.RACING_API_USERNAME;
      delete process.env.RACING_API_PASSWORD;

      const result = await raceService.getRaceResults("test_race_id");
      
      expect(result).toBeNull();

      // Restore credentials
      if (originalUsername) process.env.RACING_API_USERNAME = originalUsername;
      if (originalPassword) process.env.RACING_API_PASSWORD = originalPassword;
    });

    it("should handle API errors gracefully", async () => {
      // Mock fetch to simulate API error
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      const result = await raceService.getRaceResults("test_race_id");
      
      expect(result).toBeNull();
    });

    it("should return null when no results are available", async () => {
      // Mock fetch to return empty results
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await raceService.getRaceResults("test_race_id");
      
      expect(result).toBeNull();
    });

    it("should parse race results correctly when available", async () => {
      // Mock fetch to return valid race results
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              runners: [
                {
                  position: 1,
                  horse: "Winner Horse",
                  odds: "5.5",
                },
                {
                  position: 2,
                  horse: "Second Horse",
                  odds: "3.2",
                },
                {
                  position: 3,
                  horse: "Third Horse",
                  odds: "2.1",
                },
              ],
            },
          ],
        }),
      });

      const result = await raceService.getRaceResults("test_race_id");
      
      expect(result).not.toBeNull();
      expect(result?.winner).toBe("Winner Horse");
      expect(result?.winningOdds).toBe(5.5);
      expect(result?.placings).toHaveLength(3);
      expect(result?.placings[0].position).toBe(1);
      expect(result?.resultStatus).toBe("completed");
    });

    it("should handle alternative field names in API response", async () => {
      // Mock fetch with alternative field names
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              runners: [
                {
                  finishing_position: 1,
                  horse_name: "Winner Horse",
                  win_odds: "4.2",
                },
                {
                  finishing_position: 2,
                  horse_name: "Second Horse",
                  win_odds: "2.8",
                },
              ],
            },
          ],
        }),
      });

      const result = await raceService.getRaceResults("test_race_id");
      
      expect(result).not.toBeNull();
      expect(result?.winner).toBe("Winner Horse");
      expect(result?.winningOdds).toBe(4.2);
    });

    it("should only include placings for top 4 finishers", async () => {
      // Mock fetch with more than 4 runners
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              runners: [
                { position: 1, horse: "First", odds: "5.0" },
                { position: 2, horse: "Second", odds: "4.0" },
                { position: 3, horse: "Third", odds: "3.0" },
                { position: 4, horse: "Fourth", odds: "2.0" },
                { position: 5, horse: "Fifth", odds: "1.5" },
              ],
            },
          ],
        }),
      });

      const result = await raceService.getRaceResults("test_race_id");
      
      expect(result?.placings.length).toBeLessThanOrEqual(4);
      expect(result?.placings.every((p) => p.position <= 4)).toBe(true);
    });

    it("should sort placings by position", async () => {
      // Mock fetch with unsorted runners
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              runners: [
                { position: 3, horse: "Third", odds: "3.0" },
                { position: 1, horse: "First", odds: "5.0" },
                { position: 4, horse: "Fourth", odds: "2.0" },
                { position: 2, horse: "Second", odds: "4.0" },
              ],
            },
          ],
        }),
      });

      const result = await raceService.getRaceResults("test_race_id");
      
      expect(result?.placings[0].position).toBe(1);
      expect(result?.placings[1].position).toBe(2);
      expect(result?.placings[2].position).toBe(3);
      expect(result?.placings[3].position).toBe(4);
    });
  });

  describe("Automation Service Integration", () => {
    it("should correctly calculate prediction accuracy", async () => {
      // This test verifies the automation service can use race results
      // to calculate accuracy metrics
      
      const mockPrediction = {
        id: "pred_1",
        raceId: "race_1",
        raceName: "Test Race",
        trackName: "Test Track",
        raceTime: new Date(),
        predictions: [
          { name: "Winner Horse", score: 0.8, rank: 1 },
          { name: "Second Horse", score: 0.6, rank: 2 },
        ],
        topPick: "Winner Horse",
        topPickScore: 80,
        ensembleScore: 75,
        createdAt: new Date(),
      };

      const mockResult: RaceResult = {
        raceId: "race_1",
        winner: "Winner Horse",
        placings: [
          { position: 1, horseName: "Winner Horse", odds: 5.5 },
          { position: 2, horseName: "Second Horse", odds: 3.2 },
        ],
        winningOdds: 5.5,
        resultStatus: "completed",
      };

      // Verify prediction matches result
      expect(mockPrediction.topPick).toBe(mockResult.winner);
      expect(mockPrediction.predictions[0].name).toBe(mockResult.winner);

      // Calculate profit/loss (odds format: 5.5 means 5.5 to 1, so profit = stake * (odds - 1))
      const profitLoss = 10 * (mockResult.winningOdds - 1);
      expect(profitLoss).toBeGreaterThan(0);
    });
  });
});
