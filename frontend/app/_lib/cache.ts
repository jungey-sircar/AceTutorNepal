import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'examace_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Silently fail - cache is best-effort
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {}
}

export async function getCacheSize(): Promise<string> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    let totalSize = 0;
    for (const key of cacheKeys) {
      const val = await AsyncStorage.getItem(key);
      if (val) totalSize += val.length;
    }
    if (totalSize < 1024) return `${totalSize} B`;
    if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
    return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return '0 B';
  }
}

/**
 * Fetch with cache-first strategy.
 * Tries cache first, falls back to network, then updates cache.
 * If network fails and cache exists (even expired), use stale cache.
 */
export async function fetchWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  // Try network first
  try {
    const data = await fetcher();
    await setCache(cacheKey, data);
    return { data, fromCache: false };
  } catch {
    // Network failed - try cache (even expired)
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + cacheKey);
      if (raw) {
        const entry: CacheEntry<T> = JSON.parse(raw);
        return { data: entry.data, fromCache: true };
      }
    } catch {}
    throw new Error('No data available - check your connection');
  }
}
