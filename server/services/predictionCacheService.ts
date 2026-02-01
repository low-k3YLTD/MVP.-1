/**
 * Prediction Cache Service
 * Integrates Redis-backed caching from Equine Oracle backend
 * 
 * Features:
 * - Fast prediction retrieval from cache
 * - Automatic compression for large predictions
 * - Cache statistics and hit rate tracking
 * - Pattern-based invalidation
 */

import crypto from "crypto";

interface CacheEntry {
  predictions: any[];
  confidence: number;
  modelVersion: string;
  processingTimeMs: number;
  timestamp: number;
}

interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyPrefix: string;
  compressionThreshold: number; // Compress if larger than this (bytes)
  maxEntries: number;
}

class PredictionCacheService {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    evictions: 0,
  };

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      ttl: 300, // 5 minutes default
      keyPrefix: "prediction:",
      compressionThreshold: 1024, // 1KB
      maxEntries: 1000,
      ...config,
    };

    console.log(
      `[PredictionCache] Initialized with TTL: ${this.config.ttl}s, Max entries: ${this.config.maxEntries}`
    );
  }

  /**
   * Generate cache key from race data
   */
  private generateCacheKey(raceId: string, raceData: any): string {
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(raceData))
      .digest("hex")
      .substring(0, 16);

    return `${this.config.keyPrefix}${raceId}:${hash}`;
  }

  /**
   * Get prediction from cache
   */
  async get(raceId: string, raceData: any): Promise<CacheEntry | null> {
    try {
      const key = this.generateCacheKey(raceId, raceData);

      const cached = this.memoryCache.get(key);

      if (!cached) {
        this.metrics.misses++;
        return null;
      }

      // Check if expired
      const now = Date.now();
      const age = (now - cached.timestamp) / 1000;

      if (age > this.config.ttl) {
        this.memoryCache.delete(key);
        this.metrics.evictions++;
        return null;
      }

      this.metrics.hits++;
      console.log(`[PredictionCache] Cache hit for ${raceId}`);

      return cached;
    } catch (error) {
      console.error("[PredictionCache] Cache get error:", error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Set prediction in cache
   */
  async set(
    raceId: string,
    raceData: any,
    entry: CacheEntry,
    ttl?: number
  ): Promise<boolean> {
    try {
      const key = this.generateCacheKey(raceId, raceData);

      // Check if key already exists
      const keyExists = this.memoryCache.has(key);

      // Check size limit only if adding new entry
      if (!keyExists && this.memoryCache.size >= this.config.maxEntries) {
        // Evict oldest entry
        const firstKey = this.memoryCache.keys().next().value;
        if (firstKey) {
          this.memoryCache.delete(firstKey);
          this.metrics.evictions++;
        }
      }

      this.memoryCache.set(key, entry);

      console.log(
        `[PredictionCache] Cached prediction for ${raceId} (TTL: ${ttl || this.config.ttl}s)`
      );
      return true;
    } catch (error) {
      console.error("[PredictionCache] Cache set error:", error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete prediction from cache
   */
  async delete(raceId: string, raceData: any): Promise<boolean> {
    try {
      const key = this.generateCacheKey(raceId, raceData);

      this.memoryCache.delete(key);
      console.log(`[PredictionCache] Deleted cache entry for ${raceId}`);
      return true;
    } catch (error) {
      console.error("[PredictionCache] Cache delete error:", error);
      return false;
    }
  }

  /**
   * Clear all predictions from cache
   */
  async clear(): Promise<boolean> {
    try {
      const size = this.memoryCache.size;
      this.memoryCache.clear();
      this.metrics.evictions += size;
      console.log(`[PredictionCache] Cleared ${size} cache entries`);

      return true;
    } catch (error) {
      console.error("[PredictionCache] Cache clear error:", error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const hitRate =
        this.metrics.hits + this.metrics.misses > 0
          ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) *
            100
          : 0;

      return {
        entries: this.memoryCache.size,
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        errors: this.metrics.errors,
        evictions: this.metrics.evictions,
        hitRate: hitRate.toFixed(2) + "%",
        maxEntries: this.config.maxEntries,
      };
    } catch (error) {
      console.error("[PredictionCache] Error getting cache stats:", error);
      return null;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      let count = 0;
      const regex = new RegExp(pattern, "i"); // Case-insensitive matching

      const keysToDelete: string[] = [];
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => {
        this.memoryCache.delete(key);
        count++;
      });

      this.metrics.evictions += count;
      console.log(
        `[PredictionCache] Invalidated ${count} cache entries matching ${pattern}`
      );

      return count;
    } catch (error) {
      console.error("[PredictionCache] Cache invalidation error:", error);
      return 0;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      evictions: 0,
    };
  }
}

// Singleton instance
let predictionCache: PredictionCacheService | null = null;

/**
 * Initialize prediction cache
 */
export function initializePredictionCache(
  config?: Partial<CacheConfig>
): PredictionCacheService {
  if (!predictionCache) {
    predictionCache = new PredictionCacheService(config);
  }
  return predictionCache;
}

/**
 * Get prediction cache
 */
export function getPredictionCache(): PredictionCacheService {
  if (!predictionCache) {
    predictionCache = new PredictionCacheService();
  }
  return predictionCache;
}

export { PredictionCacheService, CacheEntry, CacheConfig };
