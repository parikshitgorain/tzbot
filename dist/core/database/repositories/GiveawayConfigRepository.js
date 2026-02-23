/**
 * GiveawayConfigRepository handles giveaway permission configuration
 * Manages allowed roles and users for giveaway commands
 */
export class GiveawayConfigRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Get giveaway permissions for a guild
     * Returns null if no configuration exists (defaults to admin-only)
     */
    async getGiveawayPermissions(guildId) {
        const query = `
      SELECT guild_id, allowed_roles, allowed_users, created_at, updated_at
      FROM giveaway_config
      WHERE guild_id = $1
    `;
        try {
            const result = await this.pool.query(query, [guildId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                guildId: row.guild_id,
                allowedRoles: row.allowed_roles || [],
                allowedUsers: row.allowed_users || [],
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            };
        }
        catch (error) {
            throw new Error(`Failed to get giveaway permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Update giveaway permissions for a guild
     * Creates new config if doesn't exist, updates if it does
     */
    async updateGiveawayPermissions(guildId, allowedRoles, allowedUsers) {
        const query = `
      INSERT INTO giveaway_config (guild_id, allowed_roles, allowed_users)
      VALUES ($1, $2, $3)
      ON CONFLICT (guild_id)
      DO UPDATE SET
        allowed_roles = EXCLUDED.allowed_roles,
        allowed_users = EXCLUDED.allowed_users,
        updated_at = CURRENT_TIMESTAMP
    `;
        try {
            await this.pool.query(query, [guildId, allowedRoles, allowedUsers]);
        }
        catch (error) {
            throw new Error(`Failed to update giveaway permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
//# sourceMappingURL=GiveawayConfigRepository.js.map