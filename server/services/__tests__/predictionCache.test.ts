import { describe, it, expect, beforeEach } from "vitest";
import {
  initializePredictionCache,
  getPredictionCache,
  type CacheEntry,
} from "../predictionCacheService";

describe("PredictionCacheService", () => {
  beforeEach(() => {
    // Get fresh cache instance
    const cache = getPredictionCache();
    cache.clear();
    cache.resetMetrics();
  });

  it("should initialize cache with default config", () => {
    const cache = initializePredictionCache();
    expect(cache).toBeDefined();
  });

  it("should cache and retrieve predictions", async () => {
    const cache = getPredictionCache();

    const raceId = "race-123";
    const raceData = { track: "Ascot", distance: 2000 };
    const entry: CacheEntry = {
      predictions: [{ horse: "Horse A", score: 0.8 }],
      confidence: 0.85,
      modelVersion: "2.0",
      processingTimeMs: 150,
      timestamp: Date.now(),
    };

    // Set cache
    const setResult = await cache.set(raceId, raceData, entry);
    expect(setResult).toBe(true);

    // Get from cache
    const cached = await cache.get(raceId, raceData);
    expect(cached).toBeDefined();
    expect(cached?.predictions).toEqual(entry.predictions);
    expect(cached?.confidence).toBe(entry.confidence);
  });

  it("should return null for cache miss", async () => {
    const cache = getPredictionCache();

    const raceId = "non-existent-race";
    const raceData = { track: "Ascot" };

    const cached = await cache.get(raceId, raceData);
    expect(cached).toBeNull();
  });

  it("should track cache hits and misses", async () => {
    const cache = getPredictionCache();

    const raceId = "race-123";
    const raceData = { track: "Ascot" };
    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    // Miss
    await cache.get(raceId, raceData);

    // Hit
    await cache.set(raceId, raceData, entry);
    await cache.get(raceId, raceData);

    const stats = await cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it("should delete cache entries", async () => {
    const cache = getPredictionCache();

    const raceId = "race-123";
    const raceData = { track: "Ascot" };
    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    await cache.set(raceId, raceData, entry);

    const cached = await cache.get(raceId, raceData);
    expect(cached).toBeDefined();

    await cache.delete(raceId, raceData);

    const deletedCache = await cache.get(raceId, raceData);
    expect(deletedCache).toBeNull();
  });

  it("should clear all cache entries", async () => {
    const cache = getPredictionCache();

    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    // Add multiple entries
    await cache.set("race-1", { track: "Ascot" }, entry);
    await cache.set("race-2", { track: "Epsom" }, entry);
    await cache.set("race-3", { track: "Cheltenham" }, entry);

    const statsBefore = await cache.getStats();
    expect(statsBefore.entries).toBe(3);

    await cache.clear();

    const statsAfter = await cache.getStats();
    expect(statsAfter.entries).toBe(0);
  });

  it("should calculate hit rate correctly", async () => {
    const cache = getPredictionCache();

    const raceData = { track: "Ascot" };
    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    // 2 misses
    await cache.get("race-1", raceData);
    await cache.get("race-2", raceData);

    // 1 hit
    await cache.set("race-3", raceData, entry);
    await cache.get("race-3", raceData);

    const stats = await cache.getStats();
    expect(stats.hitRate).toContain("33");
  });

  it("should invalidate by pattern", async () => {
    const cache = getPredictionCache();

    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    // Add entries with different patterns
    await cache.set("race-ascot-1", { track: "Ascot" }, entry);
    await cache.set("race-ascot-2", { track: "Ascot" }, entry);
    await cache.set("race-epsom-1", { track: "Epsom" }, entry);

    const statsBefore = await cache.getStats();
    expect(statsBefore.entries).toBe(3);

    // Invalidate all Ascot races
    const invalidated = await cache.invalidateByPattern("ascot");

    const statsAfter = await cache.getStats();
    expect(statsAfter.entries).toBe(1);
  });

  it("should respect max entries limit", async () => {
    const existingCache = getPredictionCache();
    await existingCache.clear();

    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    // Add 100 entries
    for (let i = 0; i < 100; i++) {
      await existingCache.set(`limit-test-${i}`, { track: "Track" }, entry);
    }

    const stats = await existingCache.getStats();
    expect(stats.entries).toBe(100);
    expect(stats.maxEntries).toBe(1000);
  });

  it("should handle cache eviction", async () => {
    const existingCache = getPredictionCache();
    await existingCache.clear();

    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    const initialMetrics = existingCache.getMetrics();
    expect(initialMetrics.evictions).toBe(0);
  });

  it("should track metrics correctly", async () => {
    const cache = getPredictionCache();

    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    const initialMetrics = cache.getMetrics();
    expect(initialMetrics.hits).toBe(0);
    expect(initialMetrics.misses).toBe(0);

    await cache.set("race-1", { track: "Ascot" }, entry);
    await cache.get("race-1", { track: "Ascot" });
    await cache.get("race-2", { track: "Epsom" });

    const updatedMetrics = cache.getMetrics();
    expect(updatedMetrics.hits).toBe(1);
    expect(updatedMetrics.misses).toBe(1);
  });

  it("should reset metrics", async () => {
    const cache = getPredictionCache();

    const entry: CacheEntry = {
      predictions: [],
      confidence: 0.8,
      modelVersion: "2.0",
      processingTimeMs: 100,
      timestamp: Date.now(),
    };

    await cache.set("race-1", { track: "Ascot" }, entry);
    await cache.get("race-1", { track: "Ascot" });

    let metrics = cache.getMetrics();
    expect(metrics.hits).toBe(1);

    cache.resetMetrics();

    metrics = cache.getMetrics();
    expect(metrics.hits).toBe(0);
    expect(metrics.misses).toBe(0);
  });
});
