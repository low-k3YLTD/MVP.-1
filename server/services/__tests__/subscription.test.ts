import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  getSubscriptionPlans,
  canMakePrediction,
  getPredictionUsage,
} from "../subscriptionService";
import { getDb } from "../../db";

// Mock the database
vi.mock("../../db", () => ({
  getDb: vi.fn(),
}));

describe("Subscription Service", () => {
  describe("getSubscriptionPlans", () => {
    it("should return subscription plans with features parsed", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 1,
            name: "Basic",
            priceInCents: 999,
            billingPeriod: "monthly",
            predictionsPerMonth: 50,
            hasApiAccess: 0,
            features: JSON.stringify(["50 predictions per month", "Live race data"]),
            displayOrder: 1,
            isActive: 1,
          },
          {
            id: 2,
            name: "Pro",
            priceInCents: 2999,
            billingPeriod: "monthly",
            predictionsPerMonth: -1,
            hasApiAccess: 0,
            features: JSON.stringify(["Unlimited predictions", "Live race data"]),
            displayOrder: 2,
            isActive: 1,
          },
        ]),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const plans = await getSubscriptionPlans();

      expect(plans).toHaveLength(2);
      expect(plans[0].name).toBe("Basic");
      expect(plans[0].features).toEqual(["50 predictions per month", "Live race data"]);
      expect(plans[1].name).toBe("Pro");
      expect(plans[1].predictionsPerMonth).toBe(-1);
    });

    it("should throw error if database is not available", async () => {
      vi.mocked(getDb).mockResolvedValue(null);

      await expect(getSubscriptionPlans()).rejects.toThrow("Database not available");
    });
  });

  describe("canMakePrediction", () => {
    it("should return false if user has no active subscription", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await canMakePrediction(1);

      expect(result).toBe(false);
    });

    it("should return true if user has unlimited predictions", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              userId: 1,
              planId: 2,
              stripeSubscriptionId: "sub_123",
              stripeCustomerId: "cus_123",
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(),
              predictionsUsedThisMonth: 0,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 2,
              name: "Pro",
              predictionsPerMonth: -1,
            },
          ]),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await canMakePrediction(1);

      expect(result).toBe(true);
    });

    it("should check usage limits for limited plans", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              userId: 1,
              planId: 1,
              stripeSubscriptionId: "sub_123",
              stripeCustomerId: "cus_123",
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(),
              predictionsUsedThisMonth: 45,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 1,
              name: "Basic",
              predictionsPerMonth: 50,
            },
          ])
          .mockResolvedValueOnce([]),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await canMakePrediction(1);

      expect(result).toBe(true);
    });

    it("should return false when usage limit reached", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              userId: 1,
              planId: 1,
              stripeSubscriptionId: "sub_123",
              stripeCustomerId: "cus_123",
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(),
              predictionsUsedThisMonth: 50,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 1,
              name: "Basic",
              predictionsPerMonth: 50,
            },
          ])
          .mockResolvedValueOnce([
            { predictionsUsed: 50 },
          ]),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await canMakePrediction(1);

      expect(result).toBe(false);
    });
  });

  describe("getPredictionUsage", () => {
    it("should return usage info for user with subscription", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              userId: 1,
              planId: 1,
              stripeSubscriptionId: "sub_123",
              stripeCustomerId: "cus_123",
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(),
              predictionsUsedThisMonth: 25,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 1,
              name: "Basic",
              predictionsPerMonth: 50,
            },
          ]),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const usage = await getPredictionUsage(1);

      expect(usage.used).toBe(25);
      expect(usage.limit).toBe(50);
      expect(usage.remaining).toBe(25);
      expect(usage.isUnlimited).toBe(false);
    });

    it("should return unlimited info for Pro plan", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              userId: 1,
              planId: 2,
              stripeSubscriptionId: "sub_123",
              stripeCustomerId: "cus_123",
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(),
              predictionsUsedThisMonth: 100,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 2,
              name: "Pro",
              predictionsPerMonth: -1,
            },
          ]),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const usage = await getPredictionUsage(1);

      expect(usage.isUnlimited).toBe(true);
      expect(usage.remaining).toBe(-1);
    });

    it("should return zero usage for user without subscription", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const usage = await getPredictionUsage(1);

      expect(usage.used).toBe(0);
      expect(usage.limit).toBe(0);
      expect(usage.remaining).toBe(0);
      expect(usage.isUnlimited).toBe(false);
    });
  });
});
