/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from './pool.js';
import { EMBEDDED_MIGRATIONS, type EmbeddedMigration } from './migrations-embedded.js';

// Simple logger interface
interface Logger {
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Fallback logger
const fallbackLogger: Logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || ''),
};

let logger: Logger = fallbackLogger;

// Try to import the main logger
try {
  const loggerModule = await import('../logger/logger.js');
  if (loggerModule.logger) {
    logger = loggerModule.logger;
  }
} catch {
  // Use fallback logger
}

// Use embedded migrations (no file I/O needed)
const MIGRATIONS: EmbeddedMigration[] = EMBEDDED_MIGRATIONS;

/**
 * Ensure schema_migrations table exists
 */
async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  logger.debug('Ensured schema_migrations table exists');
}

/**
 * Get current database schema version
 */
async function getCurrentVersion(): Promise<number> {
  const pool = getPool();

  try {
    const result = await pool.query(
      'SELECT MAX(version) as version FROM schema_migrations',
    );

    const version = result.rows[0]?.version || 0;
    logger.debug('Current database version', { version });
    return version;
  } catch (error) {
    logger.debug('No migrations applied yet', { error });
    return 0;
  }
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: EmbeddedMigration): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Applying migration', {
      version: migration.version,
      name: migration.name,
    });

    // Execute embedded migration SQL (no file I/O needed)
    await client.query(migration.up);

    // Record migration in schema_migrations table
    await client.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
      [migration.version, migration.name]
    );

    logger.info('Migration applied successfully', {
      version: migration.version,
      name: migration.name,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed, rolled back', {
      version: migration.version,
      name: migration.name,
      error,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rollback a single migration
 */
async function rollbackMigration(migration: EmbeddedMigration): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Rolling back migration', {
      version: migration.version,
      name: migration.name,
    });

    // Execute embedded rollback SQL (no file I/O needed)
    await client.query(migration.down);

    // Remove migration record
    await client.query(
      'DELETE FROM schema_migrations WHERE version = $1',
      [migration.version]
    );

    logger.info('Migration rolled back successfully', {
      version: migration.version,
      name: migration.name,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Rollback failed', {
      version: migration.version,
      name: migration.name,
      error,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 * Automatically runs on startup per requirements
 */
export async function runMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations');

    await ensureMigrationsTable();
    const currentVersion = await getCurrentVersion();

    const pendingMigrations = MIGRATIONS.filter(
      (m) => m.version > currentVersion,
    );

    if (pendingMigrations.length === 0) {
      logger.info('Database is up to date', { version: currentVersion });
      return;
    }

    logger.info('Found pending migrations', {
      count: pendingMigrations.length,
      currentVersion,
      targetVersion: MIGRATIONS[MIGRATIONS.length - 1].version,
    });

    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }

    const newVersion = await getCurrentVersion();
    logger.info('All migrations completed successfully', {
      oldVersion: currentVersion,
      newVersion,
    });
  } catch (error) {
    logger.error('Migration process failed', { error });
    throw error;
  }
}

/**
 * Rollback to a specific version
 * Used for development/testing
 */
export async function rollbackTo(targetVersion: number): Promise<void> {
  try {
    logger.info('Starting migration rollback', { targetVersion });

    await ensureMigrationsTable();
    const currentVersion = await getCurrentVersion();

    if (targetVersion >= currentVersion) {
      logger.warn('Target version is not lower than current version', {
        currentVersion,
        targetVersion,
      });
      return;
    }

    const migrationsToRollback = MIGRATIONS.filter(
      (m) => m.version > targetVersion && m.version <= currentVersion,
    ).reverse(); // Rollback in reverse order

    logger.info('Rolling back migrations', {
      count: migrationsToRollback.length,
      currentVersion,
      targetVersion,
    });

    for (const migration of migrationsToRollback) {
      await rollbackMigration(migration);
    }

    const newVersion = await getCurrentVersion();
    logger.info('Rollback completed successfully', {
      oldVersion: currentVersion,
      newVersion,
    });
  } catch (error) {
    logger.error('Rollback process failed', { error });
    throw error;
  }
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<{
  currentVersion: number;
  latestVersion: number;
  pendingMigrations: number;
  appliedMigrations: EmbeddedMigration[];
}> {
  await ensureMigrationsTable();
  const currentVersion = await getCurrentVersion();
  const latestVersion = MIGRATIONS[MIGRATIONS.length - 1]?.version || 0;
  const pendingMigrations = MIGRATIONS.filter(
    (m) => m.version > currentVersion,
  ).length;
  const appliedMigrations = MIGRATIONS.filter(
    (m) => m.version <= currentVersion,
  );

  return {
    currentVersion,
    latestVersion,
    pendingMigrations,
    appliedMigrations,
  };
}
