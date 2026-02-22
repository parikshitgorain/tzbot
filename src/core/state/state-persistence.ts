/**
 * @file state-persistence.ts
 * @description State persistence service for saving and recovering critical bot state
 * @module core/state
 * 
 * Requirements:
 * - 14.3: Persist critical state to disk every 60 seconds
 * - 14.4: Restore state from most recent persisted data on restart
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { logger, logError } from '@/core/logger/logger.js';
import { createHash } from 'crypto';

/**
 * Critical state data structure
 */
export interface BotState {
  version: string;
  timestamp: Date;
  checksum: string;
  data: {
    chatRain?: {
      lastExecutionTime: Date | null;
    };
    notificationQueue?: Array<{
      id: string;
      eventId: string;
      eventType: string;
      embedData: Record<string, unknown>;
      attempts: number;
      lastAttempt?: Date;
      createdAt: Date;
    }>;
    activeGiveaways?: Array<{
      id: string;
      endsAt: Date;
    }>;
  };
}

/**
 * State persistence configuration
 */
export interface StatePersistenceConfig {
  /** Directory to store state files */
  stateDir: string;
  /** Filename for state file */
  stateFile?: string;
  /** Persistence interval in milliseconds (default: 60000 = 60 seconds) */
  persistIntervalMs?: number;
  /** Maximum number of backup files to keep */
  maxBackups?: number;
}

/**
 * State persistence service
 * Handles saving and loading critical bot state to/from disk
 * 
 * Validates: Requirements 14.3, 14.4
 */
export class StatePersistenceService {
  private config: Required<StatePersistenceConfig>;
  private persistenceTimer: NodeJS.Timeout | null = null;
  private currentState: BotState | null = null;
  private stateFilePath: string;
  private isPersisting: boolean = false;

  constructor(config: StatePersistenceConfig) {
    this.config = {
      stateDir: config.stateDir,
      stateFile: config.stateFile ?? 'bot-state.json',
      persistIntervalMs: config.persistIntervalMs ?? 60000, // 60 seconds
      maxBackups: config.maxBackups ?? 5,
    };

    this.stateFilePath = join(this.config.stateDir, this.config.stateFile);
  }

  /**
   * Initialize the state persistence service
   * Creates state directory if it doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      // Ensure state directory exists
      await fs.mkdir(this.config.stateDir, { recursive: true });

      logger.info('State persistence service initialized', {
        stateDir: this.config.stateDir,
        stateFile: this.config.stateFile,
        persistIntervalMs: this.config.persistIntervalMs,
      });
    } catch (error) {
      logError('Failed to initialize state persistence service', error as Error, {
        stateDir: this.config.stateDir,
      });
      throw error;
    }
  }

  /**
   * Start automatic state persistence
   * Requirement 14.3: Persist critical state every 60 seconds
   */
  startAutoPersistence(): void {
    if (this.persistenceTimer) {
      logger.warn('Auto-persistence already started');
      return;
    }

    this.persistenceTimer = setInterval(() => {
      void this.persistState();
    }, this.config.persistIntervalMs);

    logger.info('Auto-persistence started', {
      intervalMs: this.config.persistIntervalMs,
    });
  }

  /**
   * Stop automatic state persistence
   */
  stopAutoPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
      logger.info('Auto-persistence stopped');
    }
  }

  /**
   * Update the current state
   * This should be called by managers when their state changes
   */
  updateState(partialState: Partial<BotState['data']>): void {
    if (!this.currentState) {
      this.currentState = {
        version: '1.0.0',
        timestamp: new Date(),
        checksum: '',
        data: {},
      };
    }

    // Merge partial state into current state
    this.currentState.data = {
      ...this.currentState.data,
      ...partialState,
    };

    this.currentState.timestamp = new Date();
  }

  /**
   * Persist current state to disk
   * Requirement 14.3: Persist critical state to disk every 60 seconds
   */
  async persistState(): Promise<void> {
    if (this.isPersisting) {
      logger.debug('State persistence already in progress, skipping');
      return;
    }

    if (!this.currentState) {
      logger.debug('No state to persist');
      return;
    }

    this.isPersisting = true;

    try {
      const startTime = Date.now();

      // Update timestamp
      this.currentState.timestamp = new Date();

      // Calculate checksum for integrity verification
      const stateJson = JSON.stringify(this.currentState.data);
      this.currentState.checksum = this.calculateChecksum(stateJson);

      // Create backup of existing state file
      await this.createBackup();

      // Write state to file
      const stateContent = JSON.stringify(this.currentState, null, 2);
      await fs.writeFile(this.stateFilePath, stateContent, 'utf8');

      const duration = Date.now() - startTime;

      logger.info('State persisted successfully', {
        stateFile: this.stateFilePath,
        timestamp: this.currentState.timestamp.toISOString(),
        checksum: this.currentState.checksum,
        durationMs: duration,
      });

      // Clean up old backups
      await this.cleanupOldBackups();
    } catch (error) {
      logError('Failed to persist state', error as Error, {
        stateFile: this.stateFilePath,
      });
    } finally {
      this.isPersisting = false;
    }
  }

  /**
   * Recover state from disk on startup
   * Requirement 14.4: Restore state from most recent persisted data
   */
  async recoverState(): Promise<BotState | null> {
    try {
      logger.info('Attempting to recover state from disk', {
        stateFile: this.stateFilePath,
      });

      // Check if state file exists
      try {
        await fs.access(this.stateFilePath);
      } catch {
        logger.info('No existing state file found, starting fresh');
        return null;
      }

      // Read state file
      const stateContent = await fs.readFile(this.stateFilePath, 'utf8');
      const state = JSON.parse(stateContent) as BotState;

      // Verify checksum
      const dataJson = JSON.stringify(state.data);
      const calculatedChecksum = this.calculateChecksum(dataJson);

      if (calculatedChecksum !== state.checksum) {
        logger.error('State file checksum mismatch, attempting backup recovery', {
          expectedChecksum: state.checksum,
          calculatedChecksum,
        });

        // Try to recover from backup
        return await this.recoverFromBackup();
      }

      // Convert date strings back to Date objects
      state.timestamp = new Date(state.timestamp);
      if (state.data.chatRain?.lastExecutionTime) {
        state.data.chatRain.lastExecutionTime = new Date(
          state.data.chatRain.lastExecutionTime
        );
      }
      if (state.data.notificationQueue) {
        state.data.notificationQueue = state.data.notificationQueue.map((item) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          lastAttempt: item.lastAttempt ? new Date(item.lastAttempt) : undefined,
        }));
      }
      if (state.data.activeGiveaways) {
        state.data.activeGiveaways = state.data.activeGiveaways.map((item) => ({
          ...item,
          endsAt: new Date(item.endsAt),
        }));
      }

      this.currentState = state;

      logger.info('State recovered successfully', {
        version: state.version,
        timestamp: state.timestamp.toISOString(),
        checksum: state.checksum,
        hasChatRainState: !!state.data.chatRain,
        notificationQueueSize: state.data.notificationQueue?.length ?? 0,
        activeGiveawaysCount: state.data.activeGiveaways?.length ?? 0,
      });

      return state;
    } catch (error) {
      logError('Failed to recover state', error as Error, {
        stateFile: this.stateFilePath,
      });

      // Try to recover from backup
      logger.info('Attempting to recover from backup');
      return await this.recoverFromBackup();
    }
  }

  /**
   * Recover state from most recent backup file
   * Handles corrupted state gracefully
   */
  private async recoverFromBackup(): Promise<BotState | null> {
    try {
      // Get list of backup files
      const files = await fs.readdir(this.config.stateDir);
      const baseFilename = this.config.stateFile.replace('.json', '');
      const backupFiles = files
        .filter((f) => f.startsWith(`${baseFilename}.backup.`))
        .sort()
        .reverse(); // Most recent first

      if (backupFiles.length === 0) {
        logger.warn('No backup files found');
        return null;
      }

      // Try each backup file until we find a valid one
      for (const backupFile of backupFiles) {
        try {
          const backupPath = join(this.config.stateDir, backupFile);
          const backupContent = await fs.readFile(backupPath, 'utf8');
          const state = JSON.parse(backupContent) as BotState;

          // Verify checksum
          const dataJson = JSON.stringify(state.data);
          const calculatedChecksum = this.calculateChecksum(dataJson);

          if (calculatedChecksum === state.checksum) {
            logger.info('Successfully recovered from backup', {
              backupFile,
              timestamp: state.timestamp,
            });

            // Convert date strings back to Date objects
            state.timestamp = new Date(state.timestamp);
            if (state.data.chatRain?.lastExecutionTime) {
              state.data.chatRain.lastExecutionTime = new Date(
                state.data.chatRain.lastExecutionTime
              );
            }
            if (state.data.notificationQueue) {
              state.data.notificationQueue = state.data.notificationQueue.map(
                (item) => ({
                  ...item,
                  createdAt: new Date(item.createdAt),
                  lastAttempt: item.lastAttempt
                    ? new Date(item.lastAttempt)
                    : undefined,
                })
              );
            }
            if (state.data.activeGiveaways) {
              state.data.activeGiveaways = state.data.activeGiveaways.map(
                (item) => ({
                  ...item,
                  endsAt: new Date(item.endsAt),
                })
              );
            }

            this.currentState = state;
            return state;
          } else {
            logger.warn('Backup file checksum mismatch, trying next backup', {
              backupFile,
            });
          }
        } catch (error) {
          logger.warn('Failed to read backup file, trying next', {
            backupFile,
            error: (error as Error).message,
          });
        }
      }

      logger.error('All backup files are corrupted or invalid');
      return null;
    } catch (error) {
      logError('Failed to recover from backup', error as Error);
      return null;
    }
  }

  /**
   * Create a backup of the current state file
   */
  private async createBackup(): Promise<void> {
    try {
      // Check if state file exists
      try {
        await fs.access(this.stateFilePath);
      } catch {
        // No existing file to backup
        return;
      }

      // Create backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = this.config.stateFile.replace('.json', '');
      const backupFile = `${baseFilename}.backup.${timestamp}.json`;
      const backupPath = join(this.config.stateDir, backupFile);

      // Copy current state file to backup
      await fs.copyFile(this.stateFilePath, backupPath);

      logger.debug('State backup created', { backupFile });
    } catch (error) {
      logError('Failed to create state backup', error as Error);
      // Don't throw - backup failure shouldn't prevent state persistence
    }
  }

  /**
   * Clean up old backup files, keeping only the most recent N backups
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.stateDir);
      const baseFilename = this.config.stateFile.replace('.json', '');
      const backupFiles = files
        .filter((f) => f.startsWith(`${baseFilename}.backup.`))
        .sort()
        .reverse(); // Most recent first

      // Delete old backups beyond maxBackups
      const filesToDelete = backupFiles.slice(this.config.maxBackups);

      for (const file of filesToDelete) {
        const filePath = join(this.config.stateDir, file);
        await fs.unlink(filePath);
        logger.debug('Deleted old backup file', { file });
      }

      if (filesToDelete.length > 0) {
        logger.info('Cleaned up old backups', {
          deletedCount: filesToDelete.length,
          remainingCount: this.config.maxBackups,
        });
      }
    } catch (error) {
      logError('Failed to cleanup old backups', error as Error);
      // Don't throw - cleanup failure shouldn't prevent state persistence
    }
  }

  /**
   * Calculate SHA-256 checksum for data integrity verification
   */
  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get the current state
   */
  getCurrentState(): BotState | null {
    return this.currentState;
  }

  /**
   * Force immediate state persistence
   * Useful for graceful shutdown
   */
  async forcePersist(): Promise<void> {
    await this.persistState();
  }

  /**
   * Shutdown the state persistence service
   * Stops auto-persistence and performs final state save
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down state persistence service');

    // Stop auto-persistence
    this.stopAutoPersistence();

    // Perform final state save
    await this.persistState();

    logger.info('State persistence service shutdown complete');
  }
}
