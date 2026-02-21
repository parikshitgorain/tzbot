import pg from 'pg';

const { Pool } = pg;

// Simple logger interface
interface Logger {
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Fallback logger for when main logger is not available (e.g., in tests)
const fallbackLogger: Logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || ''),
};

let logger: Logger = fallbackLogger;

// Try to import the main logger, but don't fail if it's not available
try {
  const loggerModule = await import('../logger/logger.js');
  logger = loggerModule.logger;
} catch {
  // Use fallback logger
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: { rejectUnauthorized: boolean } | boolean;
}

let pool: pg.Pool | null = null;

/**
 * Create and configure database connection pool
 * Max 20 connections as per requirements
 */
export function createPool(config: DatabaseConfig): pg.Pool {
  if (pool) {
    logger.warn('Database pool already exists, returning existing pool');
    return pool;
  }

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max || 20, // Maximum 20 connections per requirements
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 20000, // Increased to 20s for Neon cold starts
    ssl: config.ssl,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { error: err });
  });

  // Log pool events for monitoring
  pool.on('connect', () => {
    logger.debug('New database client connected to pool');
  });

  pool.on('remove', () => {
    logger.debug('Database client removed from pool');
  });

  logger.info('Database connection pool created', {
    host: config.host,
    port: config.port,
    database: config.database,
    maxConnections: config.max || 20,
  });

  return pool;
}

/**
 * Get the current database pool
 * Throws error if pool hasn't been created
 */
export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call createPool() first.');
  }
  return pool;
}

/**
 * Test database connectivity
 * Returns true if connection successful, false otherwise
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    logger.info('Database connection test successful', {
      currentTime: result.rows[0].current_time,
    });
    
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error });
    return false;
  }
}

/**
 * Close the database pool
 * Should be called during graceful shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats() {
  if (!pool) {
    return null;
  }

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
