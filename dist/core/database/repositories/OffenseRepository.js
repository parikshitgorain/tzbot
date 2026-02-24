/**
 * OffenseRepository handles all offense-related database operations
 * Provides data access for the progressive spam punishment system
 */
export class OffenseRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Get offense record for a user with all offense entries
     * Returns null if user has no offense record
     */
    async getOffenseRecord(userId) {
        const client = await this.pool.connect();
        try {
            // Get offense record
            const recordQuery = `
        SELECT user_id, total_offenses, last_offense_timestamp, 
               current_timeout_duration, is_banned
        FROM offense_records
        WHERE user_id = $1
      `;
            const recordResult = await client.query(recordQuery, [userId]);
            if (recordResult.rows.length === 0) {
                return null;
            }
            const record = recordResult.rows[0];
            // Get all offense entries for this user
            const entriesQuery = `
        SELECT id, timestamp, reason, punishment_applied, 
               moderator_id, timeout_duration
        FROM offense_entries
        WHERE user_id = $1
        ORDER BY timestamp ASC
      `;
            const entriesResult = await client.query(entriesQuery, [userId]);
            return {
                user_id: record.user_id,
                total_offenses: record.total_offenses,
                last_offense_timestamp: record.last_offense_timestamp,
                current_timeout_duration: record.current_timeout_duration,
                is_banned: record.is_banned,
                warning_history: entriesResult.rows.map(row => ({
                    id: row.id,
                    timestamp: row.timestamp,
                    reason: row.reason,
                    punishment_applied: row.punishment_applied,
                    moderator_id: row.moderator_id,
                    timeout_duration: row.timeout_duration,
                })),
            };
        }
        catch (error) {
            throw new Error(`Failed to get offense record: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            client.release();
        }
    }
    /**
     * Save or update an offense record (upsert)
     * Creates new record if doesn't exist, updates if it does
     */
    async saveOffenseRecord(record) {
        const query = `
      INSERT INTO offense_records (
        user_id, total_offenses, last_offense_timestamp, 
        current_timeout_duration, is_banned, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        total_offenses = EXCLUDED.total_offenses,
        last_offense_timestamp = EXCLUDED.last_offense_timestamp,
        current_timeout_duration = EXCLUDED.current_timeout_duration,
        is_banned = EXCLUDED.is_banned,
        updated_at = CURRENT_TIMESTAMP
    `;
        try {
            await this.pool.query(query, [
                record.user_id,
                record.total_offenses,
                record.last_offense_timestamp,
                record.current_timeout_duration,
                record.is_banned,
            ]);
        }
        catch (error) {
            throw new Error(`Failed to save offense record: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Add a new offense entry to the offense_entries table
     * Must be called after saveOffenseRecord to ensure parent record exists
     */
    async addOffenseEntry(userId, entry) {
        const query = `
      INSERT INTO offense_entries (
        user_id, timestamp, reason, punishment_applied, 
        moderator_id, timeout_duration
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
        try {
            await this.pool.query(query, [
                userId,
                entry.timestamp,
                entry.reason,
                entry.punishment_applied,
                entry.moderator_id,
                entry.timeout_duration || null,
            ]);
        }
        catch (error) {
            throw new Error(`Failed to add offense entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get all users with active offenses
     * Returns array of offense records with their entries
     */
    async getAllActiveOffenses() {
        const client = await this.pool.connect();
        try {
            // Get all offense records
            const recordsQuery = `
        SELECT user_id, total_offenses, last_offense_timestamp, 
               current_timeout_duration, is_banned
        FROM offense_records
        WHERE total_offenses > 0
        ORDER BY last_offense_timestamp DESC
      `;
            const recordsResult = await client.query(recordsQuery);
            if (recordsResult.rows.length === 0) {
                return [];
            }
            // Get all entries for all users in one query
            const userIds = recordsResult.rows.map(row => row.user_id);
            const entriesQuery = `
        SELECT id, user_id, timestamp, reason, punishment_applied, 
               moderator_id, timeout_duration
        FROM offense_entries
        WHERE user_id = ANY($1)
        ORDER BY user_id, timestamp ASC
      `;
            const entriesResult = await client.query(entriesQuery, [userIds]);
            // Group entries by user_id
            const entriesByUser = new Map();
            for (const row of entriesResult.rows) {
                if (!entriesByUser.has(row.user_id)) {
                    entriesByUser.set(row.user_id, []);
                }
                entriesByUser.get(row.user_id).push({
                    id: row.id,
                    timestamp: row.timestamp,
                    reason: row.reason,
                    punishment_applied: row.punishment_applied,
                    moderator_id: row.moderator_id,
                    timeout_duration: row.timeout_duration,
                });
            }
            // Combine records with their entries
            return recordsResult.rows.map(record => ({
                user_id: record.user_id,
                total_offenses: record.total_offenses,
                last_offense_timestamp: record.last_offense_timestamp,
                current_timeout_duration: record.current_timeout_duration,
                is_banned: record.is_banned,
                warning_history: entriesByUser.get(record.user_id) || [],
            }));
        }
        catch (error) {
            throw new Error(`Failed to get all active offenses: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            client.release();
        }
    }
    /**
     * Remove the most recent offense entry for a user
     * Used by /clearwarn command
     */
    async removeLastOffense(userId) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Delete the most recent offense entry
            const deleteQuery = `
        DELETE FROM offense_entries
        WHERE id = (
          SELECT id FROM offense_entries
          WHERE user_id = $1
          ORDER BY timestamp DESC
          LIMIT 1
        )
      `;
            await client.query(deleteQuery, [userId]);
            // Update the offense record to decrement total_offenses
            const updateQuery = `
        UPDATE offense_records
        SET total_offenses = GREATEST(total_offenses - 1, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `;
            await client.query(updateQuery, [userId]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Failed to remove last offense: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            client.release();
        }
    }
    /**
     * Reset all offenses for a user
     * Deletes the offense_record which cascades to delete all offense_entries
     * Used by /resetoffenses command and 30-day auto-reset
     */
    async resetOffenses(userId) {
        const query = 'DELETE FROM offense_records WHERE user_id = $1';
        try {
            await this.pool.query(query, [userId]);
        }
        catch (error) {
            throw new Error(`Failed to reset offenses: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Execute a function within a database transaction
     * Provides transaction support for complex operations
     */
    async withTransaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
}
//# sourceMappingURL=OffenseRepository.js.map