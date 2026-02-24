/**
 * @file state-persistence.ts
 * @description State persistence service for saving and recovering critical bot state
 * @module core/state
 *
 * Requirements:
 * - 14.3: Persist critical state to disk every 60 seconds
 * - 14.4: Restore state from most recent persisted data on restart
 */
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
export declare class StatePersistenceService {
    private config;
    private persistenceTimer;
    private currentState;
    private stateFilePath;
    private isPersisting;
    constructor(config: StatePersistenceConfig);
    /**
     * Initialize the state persistence service
     * Creates state directory if it doesn't exist
     */
    initialize(): Promise<void>;
    /**
     * Start automatic state persistence
     * Requirement 14.3: Persist critical state every 60 seconds
     */
    startAutoPersistence(): void;
    /**
     * Stop automatic state persistence
     */
    stopAutoPersistence(): void;
    /**
     * Update the current state
     * This should be called by managers when their state changes
     */
    updateState(partialState: Partial<BotState['data']>): void;
    /**
     * Persist current state to disk
     * Requirement 14.3: Persist critical state to disk every 60 seconds
     */
    persistState(): Promise<void>;
    /**
     * Recover state from disk on startup
     * Requirement 14.4: Restore state from most recent persisted data
     */
    recoverState(): Promise<BotState | null>;
    /**
     * Recover state from most recent backup file
     * Handles corrupted state gracefully
     */
    private recoverFromBackup;
    /**
     * Create a backup of the current state file
     */
    private createBackup;
    /**
     * Clean up old backup files, keeping only the most recent N backups
     */
    private cleanupOldBackups;
    /**
     * Calculate SHA-256 checksum for data integrity verification
     */
    private calculateChecksum;
    /**
     * Get the current state
     */
    getCurrentState(): BotState | null;
    /**
     * Force immediate state persistence
     * Useful for graceful shutdown
     */
    forcePersist(): Promise<void>;
    /**
     * Shutdown the state persistence service
     * Stops auto-persistence and performs final state save
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=state-persistence.d.ts.map