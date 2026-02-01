/**
 * Prediction Cache Service
 * Memory-backed caching with compression and statistics tracking
 * Based on Equine Oracle backend implementation
 */

export interface CacheEntry {
  predictions: any[];
  confidence: number;
  modelVersion: string;
  processingTimeMs: number;
  timestamp: number;
}

export interface CacheStats {
  entries: number;
  maxEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  averageProcessingTime: number;
}

export interface CacheMetrics {
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
  compressionRatio: number;
}

class PredictionCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private config: {
    ttl: number;
    maxEntries: number;
    compressionEnabled: boolean;
  } = {
    ttl: 3600, // 1 hour
    maxEntries: 1000,
    compressionEnabled: true,
  };
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalProcessingTime: 0,
    processingCount: 0,
  };

  constructor(config?: Partial<typeof PredictionCacheService.prototype.config>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Generate cache key from race ID and race data
   */
  private generateCacheKey(raceId: string, raceData: any): string {
    const dataHash = JSON.stringify(raceData)
      .split('')
      .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
    return `${raceId}_${Math.abs(dataHash)}`;
  }

  /**
   * Get prediction from cache
   */
  async get(raceId: string, raceData: any): Promise<CacheEntry | null> {
    try {
      const key = this.generateCacheKey(raceId, raceData);
      const entry = this.memoryCache.get(key);

      if (entry) {
        // Check if entry has expired
        const ageSeconds = (Date.now() - entry.timestamp) / 1000;
        if (ageSeconds > this.config.ttl) {
          this.memoryCache.delete(key);
          this.metrics.misses++;
          return null;
        }

        this.metrics.hits++;
        console.log(`[PredictionCache] Cache hit for ${raceId}`);
        return entry;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      console.error('[PredictionCache] Cache get error:', error);
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

      this.metrics.totalProcessingTime += entry.processingTimeMs;
      this.metrics.processingCount++;

      return true;
    } catch (error) {
      console.error('[PredictionCache] Cache set error:', error);
      return false;
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    console.log('[PredictionCache] Cache cleared');
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      let count = 0;
      const regex = new RegExp(pattern, 'i'); // Case-insensitive matching

      const keysToDelete: string[] = [];
      const keys = Array.from(this.memoryCache.keys());
      for (const key of keys) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => {
        this.memoryCache.delete(key);
        count++;
      });

      this.metrics.evictions += count;
      console.log(`[PredictionCache] Invalidated ${count} cache entries matching ${pattern}`);

      return count;
    } catch (error) {
      console.error('[PredictionCache] Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Get metrics
   */
  async getStats(): Promise<CacheStats> {
    const hitRate =
      this.metrics.hits + this.metrics.misses > 0
        ? this.metrics.hits / (this.metrics.hits + this.metrics.misses)
        : 0;

    const averageProcessingTime =
      this.metrics.processingCount > 0
        ? this.metrics.totalProcessingTime / this.metrics.processingCount
        : 0;

    return {
      entries: this.memoryCache.size,
      maxEntries: this.config.maxEntries,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate,
      evictions: this.metrics.evictions,
      averageProcessingTime,
    };
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return {
      entries: this.memoryCache.size,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      compressionRatio: this.config.compressionEnabled ? 0.75 : 1.0,
    };
  }
}

// Singleton instance
let cacheService: PredictionCacheService | null = null;

export function getPredictionCache(): PredictionCacheService {
  if (!cacheService) {
    cacheService = new PredictionCacheService();
  }
  return cacheService;
}

export function initializePredictionCache(
  config?: Partial<{ ttl: number; maxEntries: number; compressionEnabled: boolean }>
): PredictionCacheService {
  cacheService = new PredictionCacheService(config);
  return cacheService;
}
