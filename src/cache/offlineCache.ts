import { VaultBalances, VaultTx, AnalyticsData } from "@/utils/contractHelpers";

interface CachePayload<T> {
  data: T;
  timestamp: number;
}

type CacheReadOptions = {
  ttlMs?: number | null;
  removeExpired?: boolean;
};

const STORAGE_KEYS = {
  BALANCES: (wallet: string) => `axionvera:cache:balances:${wallet}`,
  TRANSACTIONS: (wallet: string) => `axionvera:cache:transactions:${wallet}`,
  ANALYTICS: (wallet: string) => `axionvera:cache:analytics:${wallet}`,
  SYNC_QUEUE: "axionvera:cache:syncQueue",
};

export const OFFLINE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

/**
 * Saves item to localStorage with a timestamp wrapper.
 */
function setItem<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;

  try {
    const payload: CachePayload<T> = {
      data,
      timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.error(`[OfflineCache] Failed to write cache key "${key}":`, error);
  }
}

/**
 * Retrieves item from localStorage and enforces TTL by default.
 * Returns null if missing, expired, malformed, or if an error occurs.
 */
function getItem<T>(key: string, options: CacheReadOptions = {}): T | null {
  if (typeof window === "undefined") return null;

  const ttlMs = options.ttlMs === undefined ? OFFLINE_CACHE_TTL_MS : options.ttlMs;
  const removeExpired = options.removeExpired ?? true;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const payload = JSON.parse(raw) as Partial<CachePayload<T>>;

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("data" in payload) ||
      typeof payload.timestamp !== "number"
    ) {
      localStorage.removeItem(key);
      return null;
    }

    if (ttlMs !== null && Date.now() - payload.timestamp > ttlMs) {
      if (removeExpired) {
        localStorage.removeItem(key);
      }

      return null;
    }

    return payload.data as T;
  } catch (error) {
    console.error(`[OfflineCache] Failed to parse cache key "${key}":`, error);
    return null;
  }
}

/**
 * Caches vault balances for a specific wallet address.
 */
export function cacheBalances(walletAddress: string, balances: VaultBalances): void {
  setItem(STORAGE_KEYS.BALANCES(walletAddress), balances);
}

/**
 * Gets cached vault balances.
 */
export function getCachedBalances(walletAddress: string): VaultBalances | null {
  return getItem<VaultBalances>(STORAGE_KEYS.BALANCES(walletAddress));
}

/**
 * Caches vault transaction history.
 */
export function cacheTransactions(walletAddress: string, transactions: VaultTx[]): void {
  setItem(STORAGE_KEYS.TRANSACTIONS(walletAddress), transactions);
}

/**
 * Gets cached transaction history.
 */
export function getCachedTransactions(walletAddress: string): VaultTx[] | null {
  return getItem<VaultTx[]>(STORAGE_KEYS.TRANSACTIONS(walletAddress));
}

/**
 * Caches dashboard analytics data.
 */
export function cacheAnalytics(walletAddress: string, analytics: AnalyticsData): void {
  setItem(STORAGE_KEYS.ANALYTICS(walletAddress), analytics);
}

/**
 * Gets cached analytics data.
 */
export function getCachedAnalytics(walletAddress: string): AnalyticsData | null {
  return getItem<AnalyticsData>(STORAGE_KEYS.ANALYTICS(walletAddress));
}

export function cacheSyncQueue<T>(queue: T[]): void {
  setItem(STORAGE_KEYS.SYNC_QUEUE, queue);
}

export function getCachedSyncQueue<T>(): T[] | null {
  return getItem<T[]>(STORAGE_KEYS.SYNC_QUEUE, { ttlMs: null });
}

export function clearSyncQueue(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
  } catch (error) {
    console.error("[OfflineCache] Failed to clear sync queue:", error);
  }
}

/**
 * Clears all cached application data for a wallet address.
 */
export function clearWalletCache(walletAddress: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEYS.BALANCES(walletAddress));
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS(walletAddress));
    localStorage.removeItem(STORAGE_KEYS.ANALYTICS(walletAddress));
  } catch (error) {
    console.error("[OfflineCache] Failed to clear wallet cache:", error);
  }
}
