import pg from 'pg';
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    ssl?: {
        rejectUnauthorized: boolean;
    } | boolean;
}
/**
 * Create and configure database connection pool
 * Max 20 connections as per requirements
 */
export declare function createPool(config: DatabaseConfig): pg.Pool;
/**
 * Get the current database pool
 * Throws error if pool hasn't been created
 */
export declare function getPool(): pg.Pool;
/**
 * Test database connectivity
 * Returns true if connection successful, false otherwise
 */
export declare function testConnection(): Promise<boolean>;
/**
 * Close the database pool
 * Should be called during graceful shutdown
 */
export declare function closePool(): Promise<void>;
/**
 * Get pool statistics for monitoring
 */
export declare function getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
} | null;
//# sourceMappingURL=pool.d.ts.map