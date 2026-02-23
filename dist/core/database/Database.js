import { getPool, createPool, closePool } from './pool.js';
import { runMigrations } from './migrator.js';
import { logger } from '../logger/logger.js';
import { UserRepository, ViolationRepository, GiveawayRepository, ChatActivityRepository, ConfigRepository, WinnerStateRepository, } from './repositories/index.js';
/**
 * Database class implements the Database interface
 * Provides a unified interface to all repository operations
 * Follows the repository pattern for clean data access
 */
export class Database {
    pool = null;
    userRepo = null;
    violationRepo = null;
    giveawayRepo = null;
    chatActivityRepo = null;
    configRepo = null;
    winnerStateRepo = null;
    /**
     * Connect to the database and initialize repositories
     * Runs migrations automatically on startup
     * Includes retry logic for Neon database cold starts
     */
    async connect(config) {
        if (this.pool) {
            throw new Error('Database already connected');
        }
        // Create pool with provided config or use existing pool
        if (config) {
            this.pool = createPool(config);
        }
        else {
            this.pool = getPool();
        }
        // Test connection with retry logic (for Neon cold starts)
        const maxRetries = 3;
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const client = await this.pool.connect();
                await client.query('SELECT 1');
                client.release();
                break; // Connection successful
            }
            catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    const delay = attempt * 2000; // 2s, 4s
                    logger.info(`Database connection attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        if (lastError) {
            throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${lastError.message}`);
        }
        // Run migrations automatically
        await runMigrations();
        // Initialize repositories
        this.userRepo = new UserRepository(this.pool);
        this.violationRepo = new ViolationRepository(this.pool);
        this.giveawayRepo = new GiveawayRepository(this.pool);
        this.chatActivityRepo = new ChatActivityRepository(this.pool);
        this.configRepo = new ConfigRepository(this.pool);
        this.winnerStateRepo = new WinnerStateRepository(this.pool);
    }
    /**
     * Disconnect from the database
     * Should be called during graceful shutdown
     */
    async disconnect() {
        await closePool();
        this.pool = null;
        this.userRepo = null;
        this.violationRepo = null;
        this.giveawayRepo = null;
        this.chatActivityRepo = null;
        this.configRepo = null;
        this.winnerStateRepo = null;
    }
    // User operations
    async saveUser(user) {
        this.ensureConnected();
        await this.userRepo.save(user);
    }
    async getUser(userId) {
        this.ensureConnected();
        return await this.userRepo.get(userId);
    }
    async getUserByKickUsername(kickUsername) {
        this.ensureConnected();
        return await this.userRepo.getByKickUsername(kickUsername);
    }
    // Violation operations
    async saveViolation(violation) {
        this.ensureConnected();
        await this.violationRepo.save(violation);
    }
    async getViolations(userId, since) {
        this.ensureConnected();
        return await this.violationRepo.get(userId, since);
    }
    async clearViolations(userId) {
        this.ensureConnected();
        await this.violationRepo.clear(userId);
    }
    // Giveaway operations
    async saveGiveaway(giveaway) {
        this.ensureConnected();
        await this.giveawayRepo.save(giveaway);
    }
    async getGiveaway(giveawayId) {
        this.ensureConnected();
        return await this.giveawayRepo.get(giveawayId);
    }
    async addGiveawayEntry(giveawayId, userId) {
        this.ensureConnected();
        await this.giveawayRepo.addEntry(giveawayId, userId);
    }
    // Chat activity operations
    async recordChatActivity(userId, timestamp) {
        this.ensureConnected();
        await this.chatActivityRepo.record(userId, timestamp);
    }
    async getActiveChatters(since) {
        this.ensureConnected();
        return await this.chatActivityRepo.getActiveChatters(since);
    }
    async recordChatRainWinner(userId, timestamp) {
        this.ensureConnected();
        await this.chatActivityRepo.recordWinner(userId, timestamp, 'default');
    }
    // Configuration operations
    async getConfig(key) {
        this.ensureConnected();
        return await this.configRepo.get(key);
    }
    async setConfig(key, value) {
        this.ensureConnected();
        await this.configRepo.set(key, value);
    }
    // Data retention operations
    async deleteAllUserData(userId) {
        this.ensureConnected();
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Delete message content
            await client.query('DELETE FROM message_content WHERE user_id = $1', [userId]);
            // Delete chat activity
            await client.query('DELETE FROM chat_activity WHERE user_id = $1', [userId]);
            // Delete chat rain winners
            await client.query('DELETE FROM chat_rain_winners WHERE user_id = $1', [userId]);
            // Delete giveaway entries
            await client.query('DELETE FROM giveaway_entries WHERE user_id = $1', [userId]);
            // Delete violations (will cascade from user deletion, but explicit for clarity)
            await client.query('DELETE FROM violations WHERE user_id = $1', [userId]);
            // Delete moderation logs where user is the target
            await client.query('DELETE FROM moderation_logs WHERE target_user_id = $1', [userId]);
            // Delete user record (this will cascade to violations due to foreign key)
            await client.query('DELETE FROM users WHERE discord_id = $1', [userId]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Failed to delete user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            client.release();
        }
    }
    /**
     * Health check - executes a simple query to verify database connectivity
     * Used by the health check system to monitor database health
     */
    async healthCheck() {
        this.ensureConnected();
        await this.pool.query('SELECT 1');
    }
    /**
     * Get direct access to repositories for advanced operations
     * Use with caution - prefer using the Database interface methods
     */
    get repositories() {
        this.ensureConnected();
        return {
            users: this.userRepo,
            violations: this.violationRepo,
            giveaways: this.giveawayRepo,
            chatActivity: this.chatActivityRepo,
            config: this.configRepo,
            winnerState: this.winnerStateRepo,
        };
    }
    /**
     * Get direct access to the connection pool
     * Use with caution - prefer using repository methods
     */
    getPool() {
        this.ensureConnected();
        return this.pool;
    }
    /**
     * Ensure database is connected before operations
     */
    ensureConnected() {
        if (!this.pool || !this.userRepo) {
            throw new Error('Database not connected. Call connect() first.');
        }
    }
}
/**
 * Create a new Database instance
 * Convenience function for creating database instances
 */
export function createDatabase() {
    return new Database();
}
//# sourceMappingURL=Database.js.map