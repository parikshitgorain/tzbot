import type { Pool } from 'pg';
import type { Database as IDatabase } from '../../types/interfaces.js';
import type { User, Violation, Giveaway } from '../../types/models.js';
import { type DatabaseConfig } from './pool.js';
import { UserRepository, ViolationRepository, GiveawayRepository, ChatActivityRepository, ConfigRepository, WinnerStateRepository } from './repositories/index.js';
/**
 * Database class implements the Database interface
 * Provides a unified interface to all repository operations
 * Follows the repository pattern for clean data access
 */
export declare class Database implements IDatabase {
    private pool;
    private userRepo;
    private violationRepo;
    private giveawayRepo;
    private chatActivityRepo;
    private configRepo;
    private winnerStateRepo;
    /**
     * Connect to the database and initialize repositories
     * Runs migrations automatically on startup
     * Includes retry logic for Neon database cold starts
     */
    connect(config?: DatabaseConfig): Promise<void>;
    /**
     * Disconnect from the database
     * Should be called during graceful shutdown
     */
    disconnect(): Promise<void>;
    saveUser(user: User): Promise<void>;
    getUser(userId: string): Promise<User | null>;
    getUserByKickUsername(kickUsername: string): Promise<User | null>;
    saveViolation(violation: Violation): Promise<void>;
    getViolations(userId: string, since: Date): Promise<Violation[]>;
    clearViolations(userId: string): Promise<void>;
    saveGiveaway(giveaway: Giveaway): Promise<void>;
    getGiveaway(giveawayId: string): Promise<Giveaway | null>;
    addGiveawayEntry(giveawayId: string, userId: string): Promise<void>;
    recordChatActivity(userId: string, timestamp: Date): Promise<void>;
    getActiveChatters(since: Date): Promise<string[]>;
    recordChatRainWinner(userId: string, timestamp: Date): Promise<void>;
    getConfig(key: string): Promise<unknown>;
    setConfig(key: string, value: unknown): Promise<void>;
    deleteAllUserData(userId: string): Promise<void>;
    /**
     * Health check - executes a simple query to verify database connectivity
     * Used by the health check system to monitor database health
     */
    healthCheck(): Promise<void>;
    /**
     * Get direct access to repositories for advanced operations
     * Use with caution - prefer using the Database interface methods
     */
    get repositories(): {
        users: UserRepository;
        violations: ViolationRepository;
        giveaways: GiveawayRepository;
        chatActivity: ChatActivityRepository;
        config: ConfigRepository;
        winnerState: WinnerStateRepository;
    };
    /**
     * Get direct access to the connection pool
     * Use with caution - prefer using repository methods
     */
    getPool(): Pool;
    /**
     * Ensure database is connected before operations
     */
    private ensureConnected;
}
/**
 * Create a new Database instance
 * Convenience function for creating database instances
 */
export declare function createDatabase(): Database;
//# sourceMappingURL=Database.d.ts.map