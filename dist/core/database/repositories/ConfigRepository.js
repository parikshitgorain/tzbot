/**
 * ConfigRepository handles configuration storage and retrieval
 * Provides key-value storage for bot configuration
 */
export class ConfigRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Get a configuration value by key
     * Returns null if key not found
     */
    async get(key) {
        const query = `
      SELECT value
      FROM config
      WHERE key = $1
    `;
        try {
            const result = await this.pool.query(query, [key]);
            if (result.rows.length === 0) {
                return null;
            }
            const rawValue = result.rows[0].value;
            // If it's a Discord snowflake ID (18-19 digit number string), keep as string
            // Discord IDs are 64-bit integers that lose precision in JavaScript
            if (/^\d{18,19}$/.test(rawValue)) {
                return rawValue;
            }
            // If it looks like a comma-separated list of Discord IDs, keep as string
            if (/^\d{18,19}(,\d{18,19})*$/.test(rawValue)) {
                return rawValue;
            }
            // Try to parse as JSON, fall back to string if parsing fails
            try {
                return JSON.parse(rawValue);
            }
            catch {
                return rawValue;
            }
        }
        catch (error) {
            throw new Error(`Failed to get config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Set a configuration value
     * Uses UPSERT to handle both insert and update cases
     */
    async set(key, value) {
        const query = `
      INSERT INTO config (key, value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key) 
      DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
    `;
        try {
            // Serialize value as JSON
            const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
            await this.pool.query(query, [key, serializedValue]);
        }
        catch (error) {
            throw new Error(`Failed to set config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get multiple configuration values by keys
     * Returns a map of key-value pairs
     */
    async getMany(keys) {
        const query = `
      SELECT key, value
      FROM config
      WHERE key = ANY($1)
    `;
        try {
            const result = await this.pool.query(query, [keys]);
            const configMap = new Map();
            for (const row of result.rows) {
                const rawValue = row.value;
                // If it's a Discord snowflake ID (18-19 digit number string), keep as string
                if (/^\d{18,19}$/.test(rawValue)) {
                    configMap.set(row.key, rawValue);
                    continue;
                }
                // If it looks like a comma-separated list of Discord IDs, keep as string
                if (/^\d{18,19}(,\d{18,19})*$/.test(rawValue)) {
                    configMap.set(row.key, rawValue);
                    continue;
                }
                try {
                    configMap.set(row.key, JSON.parse(rawValue));
                }
                catch {
                    configMap.set(row.key, rawValue);
                }
            }
            return configMap;
        }
        catch (error) {
            throw new Error(`Failed to get multiple configs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Set multiple configuration values at once
     * More efficient than calling set() multiple times
     */
    async setMany(configs) {
        if (configs.size === 0) {
            return;
        }
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const query = `
        INSERT INTO config (key, value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
      `;
            for (const [key, value] of configs.entries()) {
                const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
                await client.query(query, [key, serializedValue]);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Failed to set multiple configs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            client.release();
        }
    }
    /**
     * Delete a configuration value
     * Returns true if key was deleted, false if key didn't exist
     */
    async delete(key) {
        const query = 'DELETE FROM config WHERE key = $1';
        try {
            const result = await this.pool.query(query, [key]);
            return (result.rowCount || 0) > 0;
        }
        catch (error) {
            throw new Error(`Failed to delete config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get all configuration keys
     * Useful for listing available configuration options
     */
    async getAllKeys() {
        const query = 'SELECT key FROM config ORDER BY key';
        try {
            const result = await this.pool.query(query);
            return result.rows.map(row => row.key);
        }
        catch (error) {
            throw new Error(`Failed to get all config keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get all configuration values
     * Returns a map of all key-value pairs
     */
    async getAll() {
        const query = 'SELECT key, value FROM config';
        try {
            const result = await this.pool.query(query);
            const configMap = new Map();
            for (const row of result.rows) {
                const rawValue = row.value;
                // If it's a Discord snowflake ID (18-19 digit number string), keep as string
                if (/^\d{18,19}$/.test(rawValue)) {
                    configMap.set(row.key, rawValue);
                    continue;
                }
                // If it looks like a comma-separated list of Discord IDs, keep as string
                if (/^\d{18,19}(,\d{18,19})*$/.test(rawValue)) {
                    configMap.set(row.key, rawValue);
                    continue;
                }
                try {
                    configMap.set(row.key, JSON.parse(rawValue));
                }
                catch {
                    configMap.set(row.key, rawValue);
                }
            }
            return configMap;
        }
        catch (error) {
            throw new Error(`Failed to get all configs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Check if a configuration key exists
     * Returns true if key exists, false otherwise
     */
    async has(key) {
        const query = 'SELECT 1 FROM config WHERE key = $1';
        try {
            const result = await this.pool.query(query, [key]);
            return result.rows.length > 0;
        }
        catch (error) {
            throw new Error(`Failed to check config existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
//# sourceMappingURL=ConfigRepository.js.map