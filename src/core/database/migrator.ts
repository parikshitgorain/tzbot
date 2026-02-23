/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

export interface Migration {
  version: number;
  name: string;
  upPath: string;
  downPath: string;
}

/**
 * Available migrations in order
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    upPath: join(__dirname, 'schema', '001_initial_schema.sql'),
    downPath: join(__dirname, 'schema', '001_initial_schema_down.sql'),
  },
  {
    version: 2,
    name: '002_offense_tracking',
    upPath: join(__dirname, 'schema', '002_offense_tracking.sql'),
    downPath: join(__dirname, 'schema', '002_offense_tracking_down.sql'),
  },
  {
    version: 3,
    name: '003_giveaway_enhancements',
    upPath: join(__dirname, 'schema', '003_giveaway_enhancements.sql'),
    downPath: join(__dirname, 'schema', '003_giveaway_enhancements_down.sql'),
  },
  {
    version: 4,
    name: '004_giveaway_winner_confirmation',
    upPath: join(__dirname, 'schema', '004_giveaway_winner_confirmation.sql'),
    downPath: join(__dirname, 'schema', '004_giveaway_winner_confirmation_down.sql'),
  },
  {
    version: 5,
    name: '005_add_guild_id_to_giveaways',
    upPath: join(__dirname, 'schema', '005_add_guild_id_to_giveaways.sql'),
    downPath: join(__dirname, 'schema', '005_add_guild_id_to_giveaways_down.sql'),
  },
  {
    version: 6,
    name: '006_add_hosted_by_to_giveaways',
    upPath: join(__dirname, 'schema', '006_add_hosted_by_to_giveaways.sql'),
    downPath: join(__dirname, 'schema', '006_add_hosted_by_to_giveaways_down.sql'),
  },
];

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
async function applyMigration(migration: Migration): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Applying migration', {
      version: migration.version,
      name: migration.name,
    });

    // Read and execute migration SQL
    const sql = await readFile(migration.upPath, 'utf-8');
    await client.query(sql);

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
async function rollbackMigration(migration: Migration): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Rolling back migration', {
      version: migration.version,
      name: migration.name,
    });

    // Read and execute rollback SQL
    const sql = await readFile(migration.downPath, 'utf-8');
    await client.query(sql);

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
  appliedMigrations: Migration[];
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
