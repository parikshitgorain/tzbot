import { logger, logError } from '../core/logger/logger.js';
/**
 * RewardSystem handles distribution of rewards to chat rain winners
 * Supports multiple reward types: role, currency, announcement
 *
 * Requirements:
 * - 11.7: Announce winners in chat
 */
/**
 * Types of rewards that can be distributed
 */
export var RewardType;
(function (RewardType) {
    /** Assign a temporary or permanent role */
    RewardType["ROLE"] = "role";
    /** Award server currency/points (requires external economy bot) */
    RewardType["CURRENCY"] = "currency";
    /** Announce winner without tangible reward */
    RewardType["ANNOUNCEMENT"] = "announcement";
    /** Custom reward via webhook or external system */
    RewardType["CUSTOM"] = "custom";
})(RewardType || (RewardType = {}));
/**
 * RewardSystem manages distribution of rewards to chat rain winners
 */
export class RewardSystem {
    client;
    chatActivityRepo;
    guildId;
    constructor(client, chatActivityRepo, guildId) {
        this.client = client;
        this.chatActivityRepo = chatActivityRepo;
        this.guildId = guildId;
    }
    /**
     * Distribute rewards to multiple winners
     *
     * @param userIds Array of Discord user IDs
     * @param reward Reward configuration
     * @param channelId Channel to announce winners in
     * @returns Distribution result with successful and failed recipients
     *
     * Validates: Requirement 11.7
     */
    async distributeRewards(userIds, reward, channelId) {
        const result = {
            successful: [],
            failed: [],
            errors: new Map(),
        };
        // Distribute rewards to each winner
        for (const userId of userIds) {
            try {
                await this.distributeRewardToUser(userId, reward);
                result.successful.push(userId);
                // Record reward in database
                await this.recordRewardDistribution(userId, reward);
            }
            catch (error) {
                result.failed.push(userId);
                result.errors.set(userId, error instanceof Error ? error.message : 'Unknown error');
            }
        }
        // Announce winners in chat
        await this.announceWinners(reward, channelId, result);
        return result;
    }
    /**
     * Distribute reward to a single user
     */
    async distributeRewardToUser(userId, reward) {
        const guild = await this.client.guilds.fetch(this.guildId);
        const member = await guild.members.fetch(userId);
        switch (reward.type) {
            case RewardType.ROLE:
                await this.assignRole(member, reward);
                break;
            case RewardType.CURRENCY:
                await this.awardCurrency(member, reward);
                break;
            case RewardType.ANNOUNCEMENT:
                // No action needed, just announcement
                break;
            case RewardType.CUSTOM:
                await this.handleCustomReward(member, reward);
                break;
            default:
                throw new Error(`Unknown reward type: ${reward.type}`);
        }
    }
    /**
     * Assign a role to a member
     */
    async assignRole(member, reward) {
        if (!reward.value) {
            throw new Error('Role reward requires a role ID in value field');
        }
        const role = await member.guild.roles.fetch(reward.value);
        if (!role) {
            throw new Error(`Role not found: ${reward.value}`);
        }
        await member.roles.add(role);
        // If temporary role, schedule removal
        if (reward.durationMs) {
            setTimeout(async () => {
                try {
                    // Re-fetch guild and member to ensure they still exist
                    const guild = await this.client.guilds.fetch(this.guildId);
                    const currentMember = await guild.members.fetch(member.id);
                    const currentRole = await guild.roles.fetch(reward.value);
                    if (currentRole) {
                        await currentMember.roles.remove(currentRole);
                    }
                }
                catch (error) {
                    logError(`Failed to remove temporary role from ${member.id}`, error);
                }
            }, reward.durationMs);
        }
    }
    /**
     * Award currency to a member
     * Note: This requires integration with an economy bot or custom currency system
     */
    async awardCurrency(member, reward) {
        if (!reward.value) {
            throw new Error('Currency reward requires an amount in value field');
        }
        // This is a placeholder for currency integration
        // In a real implementation, this would:
        // 1. Call an economy bot API
        // 2. Update a currency database
        // 3. Trigger a webhook to external system
        // For now, we just log it
        logger.info(`Would award ${reward.value} currency to ${member.id}`);
        // You could integrate with popular economy bots like:
        // - UnbelievaBoat
        // - Dank Memer
        // - Custom economy system
    }
    /**
     * Handle custom reward via webhook or external system
     */
    async handleCustomReward(member, reward) {
        if (!reward.value) {
            throw new Error('Custom reward requires a payload in value field');
        }
        // This is a placeholder for custom reward integration
        // In a real implementation, this would:
        // 1. Parse the custom payload
        // 2. Send webhook to external system
        // 3. Execute custom logic
        logger.info(`Would execute custom reward for ${member.id}:`, { value: reward.value });
    }
    /**
     * Announce winners in the chat channel
     *
     * Validates: Requirement 11.7
     */
    async announceWinners(reward, channelId, result) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                throw new Error(`Channel ${channelId} is not a text channel`);
            }
            // Build announcement message
            const message = this.buildAnnouncementMessage(reward, result);
            await channel.send(message);
        }
        catch (error) {
            logError('Failed to announce winners', error);
            throw error;
        }
    }
    /**
     * Build the announcement message for winners
     */
    buildAnnouncementMessage(reward, result) {
        const successfulMentions = result.successful.map(id => `<@${id}>`).join(', ');
        let message = '🌧️ **Chat Rain!** 🌧️\n\n';
        if (result.successful.length > 0) {
            message += `Congratulations to: ${successfulMentions}\n\n`;
            // Add reward-specific message
            switch (reward.type) {
                case RewardType.ROLE:
                    message += 'You\'ve been awarded a special role!';
                    if (reward.durationMs) {
                        const hours = Math.floor(reward.durationMs / (1000 * 60 * 60));
                        message += ` (${hours} hour${hours !== 1 ? 's' : ''})`;
                    }
                    break;
                case RewardType.CURRENCY:
                    message += `You've been awarded ${reward.value} currency!`;
                    break;
                case RewardType.ANNOUNCEMENT:
                    message += reward.customMessage || 'You\'ve been recognized as an active chatter!';
                    break;
                case RewardType.CUSTOM:
                    message += reward.customMessage || 'You\'ve received a special reward!';
                    break;
            }
        }
        if (result.failed.length > 0) {
            message += `\n\n⚠️ Failed to distribute rewards to ${result.failed.length} user(s).`;
        }
        return message;
    }
    /**
     * Record reward distribution in the database
     */
    async recordRewardDistribution(userId, reward) {
        await this.chatActivityRepo.recordWinner(userId, new Date(), reward.type, reward.value);
    }
    /**
     * Get reward history for a user
     *
     * @param userId Discord user ID
     * @param since Optional date to filter rewards after
     * @returns Array of reward records
     */
    async getRewardHistory(userId, since) {
        return await this.chatActivityRepo.getRewardHistory(userId, since);
    }
}
//# sourceMappingURL=reward-system.js.map