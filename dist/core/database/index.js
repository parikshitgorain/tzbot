/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Database Layer
 *
 * Provides PostgreSQL connection pooling, migration system, and database utilities.
 *
 * Features:
 * - Connection pool with max 20 connections
 * - Automatic migration execution on startup
 * - Version tracking for schema changes
 * - Connection health testing
 *
 * Usage:
 * ```typescript
 * import { initializeDatabase } from './core/database';
 *
 * // Initialize on startup
 * await initializeDatabase({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'tzbot',
 *   user: 'postgres',
 *   password: 'password'
 * });
 * ```
 */
export { createPool, getPool, testConnection, closePool, getPoolStats, } from './pool.js';
export { runMigrations, rollbackTo, getMigrationStatus, } from './migrator.js';
export { Database, createDatabase, } from './Database.js';
export { UserRepository, ViolationRepository, GiveawayRepository, ChatActivityRepository, ConfigRepository, } from './repositories/index.js';
import { createPool, testConnection } from './pool.js';
import { runMigrations } from './migrator.js';
// Fallback logger
const fallbackLogger = {
    info: (message, meta) => console.log(`[INFO] ${message}`, meta || ''),
    error: (message, meta) => console.error(`[ERROR] ${message}`, meta || ''),
};
let logger = fallbackLogger;
// Try to import the main logger
try {
    const loggerModule = await import('../logger/logger.js');
    logger = loggerModule.logger;
}
catch {
    // Use fallback logger
}
/**
 * Initialize database with connection pool and run migrations
 * This should be called on application startup
 */
export async function initializeDatabase(config) {
    try {
        logger.info('Initializing database');
        // Create connection pool
        createPool(config);
        // Test connectivity
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Failed to connect to database');
        }
        // Run migrations automatically on startup (per requirements)
        await runMigrations();
        logger.info('Database initialized successfully');
    }
    catch (error) {
        logger.error('Failed to initialize database', { error });
        throw error;
    }
}
//# sourceMappingURL=index.js.map