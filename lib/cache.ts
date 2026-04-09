// lib/cache.ts
// Simple in-memory TTL cache — prevents duplicate API calls for same content
// Resets on server restart (acceptable for Next.js serverless)

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>()
  private ttlMs: number

  constructor(ttlMinutes = 10) {
    this.ttlMs = ttlMinutes * 60 * 1000
  }

  get(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  set(key: string, value: T): void {
    // Evict oldest entries if cache grows too large (max 100 entries)
    if (this.store.size >= 100) {
      const firstKey = this.store.keys().next().value
      if (firstKey) this.store.delete(firstKey)
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  size(): number {
    return this.store.size
  }
}

// Single shared cache instances — module-level singletons
export const analysisCache = new TTLCache<any>(10)   // 10 min TTL for full analysis
export const factCheckCache = new TTLCache<any>(15)  // 15 min TTL for fact-checks
export const newsApiCache = new TTLCache<any>(10)    // 10 min TTL for NewsAPI results

// Generate a stable cache key from content
export function makeCacheKey(content: string, type: string): string {
  // Use first 500 chars + length as key — fast and collision-resistant enough
  const normalized = content.trim().toLowerCase().replace(/\s+/g, " ").substring(0, 500)
  return `${type}:${normalized.length}:${normalized}`
}

// Generate a cache key for API sub-calls
export function makeQueryKey(query: string, prefix: string): string {
  return `${prefix}:${query.toLowerCase().trim()}`
}