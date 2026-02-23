/**
 * @file client.ts
 * @description Discord client wrapper with connection management and operations
 * @module core/discord
 */
import { Client, GatewayIntentBits, Partials, } from 'discord.js';
import { logger, logError } from '../../core/logger/logger.js';
import { verifyPermissionsOnStartup } from './permissions.js';
/**
 * Discord client wrapper implementation
 */
export class DiscordClient {
    client;
    connected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 5000; // 5 seconds
    constructor() {
        // Initialize Discord.js client with required intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ],
            partials: [Partials.Channel, Partials.Message],
        });
        this.setupInternalEventHandlers();
    }
    /**
     * Set up internal event handlers for connection management
     */
    setupInternalEventHandlers() {
        // Handle clientReady event (renamed from 'ready' in Discord.js v14+)
        this.client.on('clientReady', () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            logger.info('Discord client connected', {
                username: this.client.user?.username,
                id: this.client.user?.id,
                guilds: this.client.guilds.cache.size,
            });
            // Verify permissions in all guilds
            this.client.guilds.cache.forEach((guild) => {
                try {
                    verifyPermissionsOnStartup(guild);
                }
                catch (error) {
                    logError('Failed to verify permissions', error, {
                        guildId: guild.id,
                        guildName: guild.name,
                    });
                }
            });
        });
        // Handle disconnect
        this.client.on('disconnect', () => {
            this.connected = false;
            logger.warn('Discord client disconnected');
        });
        // Handle errors
        this.client.on('error', (error) => {
            logError('Discord client error', error, {
                connected: this.connected,
            });
        });
        // Handle warnings
        this.client.on('warn', (warning) => {
            logger.warn('Discord client warning', { warning });
        });
        // Handle shard errors
        this.client.on('shardError', (error, shardId) => {
            logError('Discord shard error', error, { shardId });
        });
        // Handle shard reconnecting
        this.client.on('shardReconnecting', (shardId) => {
            logger.info('Discord shard reconnecting', { shardId });
        });
        // Handle shard resume
        this.client.on('shardResume', (shardId) => {
            logger.info('Discord shard resumed', { shardId });
        });
    }
    /**
     * Connect to Discord with auto-reconnect
     */
    async connect(token) {
        try {
            logger.info('Connecting to Discord...');
            await this.client.login(token);
            logger.info('Discord login successful');
        }
        catch (error) {
            logError('Failed to connect to Discord', error);
            // Attempt reconnection with exponential backoff
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                logger.info('Attempting to reconnect to Discord', {
                    attempt: this.reconnectAttempts,
                    maxAttempts: this.maxReconnectAttempts,
                    delayMs: delay,
                });
                await new Promise((resolve) => setTimeout(resolve, delay));
                return this.connect(token);
            }
            throw new Error(`Failed to connect to Discord after ${this.maxReconnectAttempts} attempts`);
        }
    }
    /**
     * Disconnect from Discord
     */
    async disconnect() {
        logger.info('Disconnecting from Discord...');
        this.connected = false;
        await this.client.destroy();
        logger.info('Discord client disconnected');
    }
    /**
     * Check if client is connected
     */
    isConnected() {
        return this.connected && this.client.isReady();
    }
    /**
     * Subscribe to Discord events
     */
    on(event, handler) {
        this.client.on(event, handler);
    }
    /**
     * Subscribe to Discord events (one-time)
     */
    once(event, handler) {
        this.client.once(event, handler);
    }
    /**
     * Unsubscribe from Discord events
     */
    off(event, handler) {
        this.client.off(event, handler);
    }
    /**
     * Send a message to a channel
     */
    async sendMessage(channelId, content) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                throw new Error(`Channel ${channelId} is not a text channel`);
            }
            const message = await channel.send({
                content: content.content,
                embeds: content.embeds,
                files: content.files,
            });
            logger.debug('Message sent', {
                channelId,
                messageId: message.id,
                hasContent: !!content.content,
                embedCount: content.embeds?.length || 0,
                fileCount: content.files?.length || 0,
            });
            return message;
        }
        catch (error) {
            logError('Failed to send message', error, { channelId });
            throw error;
        }
    }
    /**
     * Delete a message from a channel
     */
    async deleteMessage(channelId, messageId) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                throw new Error(`Channel ${channelId} is not a text channel`);
            }
            const message = await channel.messages.fetch(messageId);
            await message.delete();
            logger.debug('Message deleted', { channelId, messageId });
        }
        catch (error) {
            logError('Failed to delete message', error, {
                channelId,
                messageId,
            });
            throw error;
        }
    }
    /**
     * Get a message from a channel
     */
    async getMessage(channelId, messageId) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                throw new Error(`Channel ${channelId} is not a text channel`);
            }
            const message = await channel.messages.fetch(messageId);
            logger.debug('Message fetched', { channelId, messageId });
            return message;
        }
        catch (error) {
            logError('Failed to fetch message', error, {
                channelId,
                messageId,
            });
            throw error;
        }
    }
    /**
     * Send a direct message to a user
     */
    async sendDirectMessage(userId, content) {
        try {
            const user = await this.client.users.fetch(userId);
            const dmChannel = await user.createDM();
            const message = await dmChannel.send({
                content: content.content,
                embeds: content.embeds,
                files: content.files,
            });
            logger.debug('Direct message sent', {
                userId,
                messageId: message.id,
                hasContent: !!content.content,
                embedCount: content.embeds?.length || 0,
            });
            return message;
        }
        catch (error) {
            logError('Failed to send direct message', error, { userId });
            throw error;
        }
    }
    /**
     * Ban a user from a guild
     */
    async banUser(guildId, userId, reason) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            await guild.members.ban(userId, { reason });
            logger.info('User banned', {
                guildId,
                userId,
                reason,
            });
        }
        catch (error) {
            logError('Failed to ban user', error, {
                guildId,
                userId,
                reason,
            });
            throw error;
        }
    }
    /**
     * Kick a user from a guild
     */
    async kickUser(guildId, userId, reason) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            await member.kick(reason);
            logger.info('User kicked', {
                guildId,
                userId,
                reason,
            });
        }
        catch (error) {
            logError('Failed to kick user', error, {
                guildId,
                userId,
                reason,
            });
            throw error;
        }
    }
    /**
     * Timeout a user in a guild
     */
    async timeoutUser(guildId, userId, duration, reason) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            // Discord timeout duration is in milliseconds
            const timeoutUntil = new Date(Date.now() + duration);
            await member.timeout(duration, reason);
            logger.info('User timed out', {
                guildId,
                userId,
                durationMs: duration,
                timeoutUntil: timeoutUntil.toISOString(),
                reason,
            });
        }
        catch (error) {
            logError('Failed to timeout user', error, {
                guildId,
                userId,
                duration,
                reason,
            });
            throw error;
        }
    }
    /**
     * Add a role to a user
     */
    async addRole(guildId, userId, roleId) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            await member.roles.add(roleId);
            logger.info('Role added to user', {
                guildId,
                userId,
                roleId,
            });
        }
        catch (error) {
            logError('Failed to add role', error, {
                guildId,
                userId,
                roleId,
            });
            throw error;
        }
    }
    /**
     * Remove a role from a user
     */
    async removeRole(guildId, userId, roleId) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            await member.roles.remove(roleId);
            logger.info('Role removed from user', {
                guildId,
                userId,
                roleId,
            });
        }
        catch (error) {
            logError('Failed to remove role', error, {
                guildId,
                userId,
                roleId,
            });
            throw error;
        }
    }
    /**
     * Get a guild by ID
     */
    getGuild(guildId) {
        return this.client.guilds.cache.get(guildId);
    }
    /**
     * Get a guild member by ID
     */
    async getMember(guildId, userId) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            return member;
        }
        catch (error) {
            logger.debug('Failed to fetch member', {
                guildId,
                userId,
                error: error.message,
            });
            return null;
        }
    }
}
//# sourceMappingURL=client.js.map