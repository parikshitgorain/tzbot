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
export { createPool, getPool, testConnection, closePool, getPoolStats, type DatabaseConfig, } from './pool.js';
export { runMigrations, rollbackTo, getMigrationStatus, } from './migrator.js';
export type { EmbeddedMigration } from './migrations-embedded.js';
export { Database, createDatabase, } from './Database.js';
export { UserRepository, ViolationRepository, GiveawayRepository, ChatActivityRepository, ConfigRepository, } from './repositories/index.js';
import { type DatabaseConfig } from './pool.js';
/**
 * Initialize database with connection pool and run migrations
 * This should be called on application startup
 */
export declare function initializeDatabase(config: DatabaseConfig): Promise<void>;
//# sourceMappingURL=index.d.ts.map