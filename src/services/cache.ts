interface CacheEntry<T> {
    data: T;
    timestamp?: number;
}

/**
 * Simple in-memory cache service that supports multiple singleton instances based on keys
 */
export class CacheService {
    private static instances = new Map<string, CacheService>();
    private cache: Map<string, CacheEntry<unknown>>;
    private ttl?: number;

    private constructor(ttl?: number) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    /**
     * Initialize a new cache service instance
     *
     * @param key - unique identifier for the cache instance
     * @param ttl - time-to-live in seconds (default: 15 minutes)
     */
    public static init(key: string, ttl?: number): CacheService {
        if (!CacheService.instances.has(key)) {
            CacheService.instances.set(key, new CacheService(ttl));
        }
        return CacheService.instances.get(key)!;
    }

    set<T>(key: string, data: T, ttl = this.ttl): void {
        this.cache.set(key, {
            data,
            timestamp: ttl ? Date.now() + ttl * 1000 : undefined,
        });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (entry.timestamp && Date.now() > entry.timestamp) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    static generateKey(owner: string, repo: string, key: string): string {
        return `${ owner }/${ repo }:${ key }`;
    }
}
