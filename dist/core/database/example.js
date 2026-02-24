/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Database Layer Usage Examples
 *
 * This file demonstrates how to use the database layer in TZBOT.
 */
import { initializeDatabase, getPool, closePool } from './index.js';
/**
 * Example 1: Initialize database on startup
 */
async function exampleInitialize() {
    await initializeDatabase({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'tzbot',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
    });
    console.log('Database initialized with connection pool and migrations');
}
/**
 * Example 2: Insert a user
 */
async function exampleInsertUser(discordId, kickUsername) {
    const pool = getPool();
    const result = await pool.query('INSERT INTO users (discord_id, kick_username) VALUES ($1, $2) RETURNING *', [discordId, kickUsername || null]);
    return result.rows[0];
}
/**
 * Example 3: Record a violation
 */
async function exampleRecordViolation(userId, type, severity, details, punishment) {
    const pool = getPool();
    const result = await pool.query(`INSERT INTO violations (user_id, type, severity, timestamp, details, punishment_applied)
     VALUES ($1, $2, $3, NOW(), $4, $5)
     RETURNING *`, [userId, type, severity, details, punishment || null]);
    return result.rows[0];
}
/**
 * Example 4: Get user violations in last 24 hours
 */
async function exampleGetRecentViolations(userId) {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM violations 
     WHERE user_id = $1 
     AND timestamp > NOW() - INTERVAL '24 hours'
     ORDER BY timestamp DESC`, [userId]);
    return result.rows;
}
/**
 * Example 5: Create a giveaway
 */
async function exampleCreateGiveaway(title, description, channelId, messageId, requiredRoles, winnerCount, endsAt) {
    const pool = getPool();
    const result = await pool.query(`INSERT INTO giveaways (title, description, channel_id, message_id, required_roles, winner_count, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`, [title, description, channelId, messageId, JSON.stringify(requiredRoles), winnerCount, endsAt]);
    return result.rows[0];
}
/**
 * Example 6: Add giveaway entry
 */
async function exampleAddGiveawayEntry(giveawayId, userId) {
    const pool = getPool();
    try {
        await pool.query('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES ($1, $2)', [giveawayId, userId]);
        return true;
    }
    catch (error) {
        // Handle duplicate entry (user already entered)
        if (error.code === '23505') {
            return false;
        }
        throw error;
    }
}
/**
 * Example 7: Get active giveaways
 */
async function exampleGetActiveGiveaways() {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM giveaways 
     WHERE status = 'active' 
     AND ends_at > NOW()
     ORDER BY ends_at ASC`);
    return result.rows;
}
/**
 * Example 8: Record chat activity
 */
async function exampleRecordChatActivity(userId) {
    const pool = getPool();
    await pool.query('INSERT INTO chat_activity (user_id, timestamp) VALUES ($1, NOW())', [userId]);
}
/**
 * Example 9: Get active chatters (3+ messages in last 10 minutes)
 */
async function exampleGetActiveChatters() {
    const pool = getPool();
    const result = await pool.query(`SELECT user_id, COUNT(*) as message_count
     FROM chat_activity
     WHERE timestamp > NOW() - INTERVAL '10 minutes'
     GROUP BY user_id
     HAVING COUNT(*) >= 3`);
    return result.rows.map(row => row.user_id);
}
/**
 * Example 10: Using transactions
 */
async function exampleTransaction(userId) {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Insert user
        await client.query('INSERT INTO users (discord_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
        // Record violation
        await client.query('INSERT INTO violations (user_id, type, severity, timestamp) VALUES ($1, $2, $3, NOW())', [userId, 'spam', 1]);
        // Log moderation action
        await client.query('INSERT INTO moderation_logs (moderator_id, target_user_id, action_type, reason) VALUES ($1, $2, $3, $4)', ['system', userId, 'warn', 'Automatic spam detection']);
        await client.query('COMMIT');
        console.log('Transaction completed successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction failed, rolled back', error);
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Example 11: Cleanup old data (7-day retention for messages)
 */
async function exampleCleanupOldMessages() {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM message_content 
     WHERE timestamp < NOW() - INTERVAL '7 days'
     RETURNING message_id`);
    console.log(`Deleted ${result.rowCount} old messages`);
    return result.rowCount;
}
/**
 * Example 12: Graceful shutdown
 */
async function exampleShutdown() {
    await closePool();
    console.log('Database connection pool closed');
}
// Export examples for documentation
export { exampleInitialize, exampleInsertUser, exampleRecordViolation, exampleGetRecentViolations, exampleCreateGiveaway, exampleAddGiveawayEntry, exampleGetActiveGiveaways, exampleRecordChatActivity, exampleGetActiveChatters, exampleTransaction, exampleCleanupOldMessages, exampleShutdown, };
//# sourceMappingURL=example.js.map