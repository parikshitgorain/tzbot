import type { Pool } from 'pg';
/**
 * ConfigRepository handles configuration storage and retrieval
 * Provides key-value storage for bot configuration
 */
export declare class ConfigRepository {
    private pool;
    constructor(pool: Pool);
    /**
     * Get a configuration value by key
     * Returns null if key not found
     */
    get(key: string): Promise<unknown>;
    /**
     * Set a configuration value
     * Uses UPSERT to handle both insert and update cases
     */
    set(key: string, value: unknown): Promise<void>;
    /**
     * Get multiple configuration values by keys
     * Returns a map of key-value pairs
     */
    getMany(keys: string[]): Promise<Map<string, unknown>>;
    /**
     * Set multiple configuration values at once
     * More efficient than calling set() multiple times
     */
    setMany(configs: Map<string, unknown>): Promise<void>;
    /**
     * Delete a configuration value
     * Returns true if key was deleted, false if key didn't exist
     */
    delete(key: string): Promise<boolean>;
    /**
     * Get all configuration keys
     * Useful for listing available configuration options
     */
    getAllKeys(): Promise<string[]>;
    /**
     * Get all configuration values
     * Returns a map of all key-value pairs
     */
    getAll(): Promise<Map<string, unknown>>;
    /**
     * Check if a configuration key exists
     * Returns true if key exists, false otherwise
     */
    has(key: string): Promise<boolean>;
}
//# sourceMappingURL=ConfigRepository.d.ts.map