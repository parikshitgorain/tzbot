import type { Pool } from 'pg';
import { GiveawayConfig } from '../../../types/models.js';
/**
 * GiveawayConfigRepository handles giveaway permission configuration
 * Manages allowed roles and users for giveaway commands
 */
export declare class GiveawayConfigRepository {
    private pool;
    constructor(pool: Pool);
    /**
     * Get giveaway permissions for a guild
     * Returns null if no configuration exists (defaults to admin-only)
     */
    getGiveawayPermissions(guildId: string): Promise<GiveawayConfig | null>;
    /**
     * Update giveaway permissions for a guild
     * Creates new config if doesn't exist, updates if it does
     */
    updateGiveawayPermissions(guildId: string, allowedRoles: string[], allowedUsers: string[]): Promise<void>;
}
//# sourceMappingURL=GiveawayConfigRepository.d.ts.map