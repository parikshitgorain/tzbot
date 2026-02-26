/**
 * @file announcement-relay.manager.ts
 * @description Announcement relay system for moderator messages
 *
 * Features:
 * - Relay messages from private moderator channel to public channels
 * - Preserve formatting, embeds, and attachments
 * - !embed command: Convert message content to Discord embeds
 * - Automatic failure notifications
 *
 * @module managers
 */
import { EmbedBuilder } from 'discord.js';
import { logger, logError } from '../core/logger/logger.js';
/**
 * Announcement relay manager
 *
 * Requirements:
 * - 6.1: Relay messages within 2 seconds
 * - 6.2: Preserve message formatting, embeds, and attachments
 * - 6.3: Attribute messages to TZBOT
 * - 6.4: Relay to all configured public channels
 * - 6.5: Notify moderator on relay failure
 */
export class AnnouncementRelayManager {
    discordClient;
    config;
    enabled = true;
    isListening = false;
    constructor(discordClient, config) {
        this.discordClient = discordClient;
        this.config = config;
        logger.info('AnnouncementRelayManager initialized', {
            privateChannelId: config.privateChannelId,
            publicChannelCount: config.publicChannelIds.length,
            publicChannelIds: config.publicChannelIds,
        });
    }
    /**
     * Message handler bound to this instance
     */
    boundMessageHandler;
    /**
     * Start monitoring the private channel for announcements
     */
    start() {
        // Prevent duplicate listener registration
        if (this.isListening) {
            logger.debug('AnnouncementRelayManager already listening, skipping start');
            return;
        }
        // Create bound handler for this instance
        this.boundMessageHandler = async (message) => {
            await this.handleMessage(message);
        };
        this.discordClient.on('messageCreate', this.boundMessageHandler);
        this.isListening = true;
        logger.info('AnnouncementRelayManager started');
    }
    /**
     * Handle incoming messages from the private channel
     */
    async handleMessage(message) {
        // Ignore if relay is disabled
        if (!this.enabled) {
            return;
        }
        // Only process messages from the designated private channel
        if (message.channelId !== this.config.privateChannelId) {
            return;
        }
        // Ignore bot messages to prevent loops
        if (message.author.bot) {
            return;
        }
        // Verify the user is a moderator
        const isModerator = await this.isUserModerator(message);
        if (!isModerator) {
            logger.debug('Non-moderator message in private channel ignored', {
                userId: message.author.id,
                username: message.author.username,
                channelId: message.channelId,
            });
            return;
        }
        // Relay the message
        await this.relayMessage(message);
    }
    /**
     * Check if the message author is a moderator
     */
    async isUserModerator(message) {
        try {
            const member = await this.discordClient.getMember(this.config.guildId, message.author.id);
            if (!member) {
                logger.debug('Member not found for moderator check', {
                    userId: message.author.id,
                    guildId: this.config.guildId,
                });
                return false;
            }
            // Check if user is server owner
            if (member.guild.ownerId === message.author.id) {
                logger.debug('User is server owner', {
                    userId: message.author.id,
                });
                return true;
            }
            // Check if user has administrator permission
            if (member.permissions.has('Administrator')) {
                logger.debug('User has administrator permission', {
                    userId: message.author.id,
                });
                return true;
            }
            // Check if user has the moderator role
            const hasModerator = member.roles.cache.has(this.config.moderatorRoleId);
            logger.debug('Moderator role check', {
                userId: message.author.id,
                moderatorRoleId: this.config.moderatorRoleId,
                hasModerator,
                userRoles: Array.from(member.roles.cache.keys()),
            });
            return hasModerator;
        }
        catch (error) {
            logError('Failed to check moderator status', error, {
                userId: message.author.id,
                guildId: this.config.guildId,
            });
            return false;
        }
    }
    /**
     * Relay a message to all configured public channels
     * Requirement 6.1: Relay within 2 seconds
     * Requirement 6.2: Preserve formatting, embeds, and attachments
     * Requirement 6.3: Attribute to TZBOT
     * Requirement 6.4: Relay to all configured channels
     * Requirement 6.5: Notify on failure
     */
    async relayMessage(originalMessage) {
        const startTime = Date.now();
        logger.info('Relaying announcement', {
            messageId: originalMessage.id,
            authorId: originalMessage.author.id,
            authorUsername: originalMessage.author.username,
            targetChannels: this.config.publicChannelIds.length,
            hasContent: !!originalMessage.content,
            embedCount: originalMessage.embeds.length,
            attachmentCount: originalMessage.attachments.size,
        });
        // Prepare message content (Requirement 6.2: Preserve formatting)
        const messageContent = this.prepareMessageContent(originalMessage);
        // Relay to all public channels (Requirement 6.4)
        const relayResults = await Promise.allSettled(this.config.publicChannelIds.map((channelId) => this.relayToChannel(channelId, messageContent)));
        // Process results
        const results = relayResults.map((result, index) => {
            const channelId = this.config.publicChannelIds[index];
            if (result.status === 'fulfilled') {
                return {
                    channelId,
                    success: true,
                    messageId: result.value.id,
                };
            }
            else {
                return {
                    channelId,
                    success: false,
                    error: result.reason?.message || 'Unknown error',
                };
            }
        });
        // Check for failures
        const failures = results.filter((r) => !r.success);
        const successes = results.filter((r) => r.success);
        const relayTime = Date.now() - startTime;
        logger.info('Announcement relay completed', {
            messageId: originalMessage.id,
            relayTimeMs: relayTime,
            successCount: successes.length,
            failureCount: failures.length,
            totalChannels: this.config.publicChannelIds.length,
        });
        // Log warning if relay took longer than 2 seconds
        if (relayTime > 2000) {
            logger.warn('Announcement relay exceeded 2 seconds', {
                messageId: originalMessage.id,
                relayTimeMs: relayTime,
            });
        }
        // Notify moderator on failure (Requirement 6.5)
        if (failures.length > 0) {
            await this.notifyModeratorOfFailures(originalMessage, failures);
        }
    }
    /**
     * Prepare message content for relay
     * Requirement 6.2: Preserve message formatting, embeds, and attachments
     */
    prepareMessageContent(message) {
        // Check if message starts with !embed command
        if (message.content.trim().startsWith('!embed')) {
            return this.prepareEmbedMessage(message);
        }
        // Convert Discord Embed objects to EmbedBuilder for sending
        const embeds = message.embeds.length > 0
            ? message.embeds.map((embed) => {
                const builder = new EmbedBuilder(embed.data);
                return builder;
            })
            : undefined;
        return {
            content: message.content || undefined,
            embeds,
            files: message.attachments.size > 0
                ? Array.from(message.attachments.values()).map((attachment) => ({
                    attachment: attachment.url,
                    name: attachment.name,
                }))
                : undefined,
        };
    }
    /**
     * Prepare embed message from !embed command
     * Supports both plain text and JSON format
     *
     * Plain text: !embed Your message here
     * JSON (embed only): !embed {"title": "Title", "description": "Description", "color": 0xFF0000}
     * JSON (full message): !embed {"content": "@everyone", "embeds": [{"title": "Title", ...}]}
     */
    prepareEmbedMessage(message) {
        // Extract content after !embed
        const content = message.content.trim();
        const embedContent = content.substring('!embed'.length).trim();
        if (!embedContent) {
            logger.warn('Empty !embed command detected', {
                messageId: message.id,
                authorId: message.author.id,
            });
            return {
                content: '⚠️ Empty embed content',
            };
        }
        // Try to parse as JSON first
        if (embedContent.startsWith('{') || embedContent.startsWith('[')) {
            try {
                const data = JSON.parse(embedContent);
                // Check if it's a full message object with content and embeds
                if (data.content !== undefined || data.embeds !== undefined) {
                    const result = {};
                    // Add content if present
                    if (data.content) {
                        result.content = data.content;
                    }
                    // Add embeds if present
                    if (Array.isArray(data.embeds)) {
                        result.embeds = data.embeds.map((embedData) => this.createEmbedFromJSON(embedData, message));
                    }
                    // Add attachments if present
                    if (message.attachments.size > 0) {
                        result.files = Array.from(message.attachments.values()).map((attachment) => ({
                            attachment: attachment.url,
                            name: attachment.name,
                        }));
                    }
                    return result;
                }
                // Handle array of embeds (legacy format)
                if (Array.isArray(data)) {
                    const embeds = data.map(embedData => this.createEmbedFromJSON(embedData, message));
                    return {
                        embeds,
                        files: message.attachments.size > 0
                            ? Array.from(message.attachments.values()).map((attachment) => ({
                                attachment: attachment.url,
                                name: attachment.name,
                            }))
                            : undefined,
                    };
                }
                // Single embed object (legacy format)
                const embed = this.createEmbedFromJSON(data, message);
                return {
                    embeds: [embed],
                    files: message.attachments.size > 0
                        ? Array.from(message.attachments.values()).map((attachment) => ({
                            attachment: attachment.url,
                            name: attachment.name,
                        }))
                        : undefined,
                };
            }
            catch (error) {
                logger.warn('Failed to parse embed JSON, treating as plain text', {
                    messageId: message.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                // Fall through to plain text handling
            }
        }
        // Plain text embed
        const embed = new EmbedBuilder()
            .setDescription(embedContent)
            .setColor(0x5865F2) // Discord blurple color
            .setTimestamp();
        // Add author footer if available
        if (message.author) {
            embed.setFooter({
                text: `Posted by ${message.author.username}`,
                iconURL: message.author.displayAvatarURL(),
            });
        }
        return {
            embeds: [embed],
            files: message.attachments.size > 0
                ? Array.from(message.attachments.values()).map((attachment) => ({
                    attachment: attachment.url,
                    name: attachment.name,
                }))
                : undefined,
        };
    }
    /**
     * Create EmbedBuilder from JSON data
     */
    createEmbedFromJSON(data, message) {
        const embed = new EmbedBuilder();
        // Set basic properties
        if (data.title)
            embed.setTitle(data.title);
        if (data.description)
            embed.setDescription(data.description);
        if (data.url)
            embed.setURL(data.url);
        if (data.color !== undefined)
            embed.setColor(data.color);
        if (data.timestamp)
            embed.setTimestamp(new Date(data.timestamp));
        // Set thumbnail
        if (data.thumbnail?.url) {
            embed.setThumbnail(data.thumbnail.url);
        }
        // Set image
        if (data.image?.url) {
            embed.setImage(data.image.url);
        }
        // Set author
        if (data.author) {
            embed.setAuthor({
                name: data.author.name || 'Unknown',
                iconURL: data.author.icon_url,
                url: data.author.url,
            });
        }
        // Add fields with timestamp conversion
        if (Array.isArray(data.fields)) {
            for (const field of data.fields) {
                if (field.name && field.value) {
                    // Convert timestamps in field values
                    const processedValue = this.processTimestamps(field.value);
                    embed.addFields({
                        name: field.name,
                        value: processedValue,
                        inline: field.inline === true,
                    });
                }
            }
        }
        // Set footer
        if (data.footer) {
            embed.setFooter({
                text: data.footer.text || '',
                iconURL: data.footer.icon_url,
            });
        }
        else {
            // Add default footer with poster's name
            embed.setFooter({
                text: `Posted by ${message.author.username}`,
                iconURL: message.author.displayAvatarURL(),
            });
        }
        return embed;
    }
    /**
     * Process timestamps in text to Discord's dynamic timestamp format
     * Converts patterns like <t:UNIX_TIMESTAMP:R> or {{UNIX_TIMESTAMP}} to Discord timestamps
     */
    processTimestamps(text) {
        // Already formatted Discord timestamps - leave as is
        if (text.includes('<t:')) {
            return text;
        }
        // Convert {{UNIX_TIMESTAMP}} or {{UNIX_TIMESTAMP:R}} format
        text = text.replace(/\{\{(\d+)(?::([RrTtDdFf]))?\}\}/g, (_match, timestamp, format) => {
            return `<t:${timestamp}:${format || 'R'}>`;
        });
        // Convert plain UNIX_TIMESTAMP in specific contexts (10-digit numbers)
        // Only convert if it looks like a Unix timestamp (10 digits, reasonable range)
        text = text.replace(/\b(1[6-9]\d{8}|[2-9]\d{9})\b/g, (match) => {
            const timestamp = parseInt(match);
            const now = Math.floor(Date.now() / 1000);
            // Only convert if it's within reasonable range (not too far in past/future)
            if (timestamp > now - 31536000 && timestamp < now + 31536000) {
                return `<t:${timestamp}:R>`;
            }
            return match;
        });
        return text;
    }
    /**
     * Relay message to a specific channel
     */
    async relayToChannel(channelId, messageContent) {
        try {
            // Send message (Requirement 6.3: Attributed to TZBOT)
            const message = await this.discordClient.sendMessage(channelId, messageContent);
            logger.debug('Message relayed to channel', {
                channelId,
                messageId: message.id,
            });
            return message;
        }
        catch (error) {
            logError('Failed to relay message to channel', error, {
                channelId,
            });
            throw error;
        }
    }
    /**
     * Notify moderator of relay failures
     * Requirement 6.5: Notify moderator in private channel on failure
     */
    async notifyModeratorOfFailures(originalMessage, failures) {
        try {
            const failureList = failures
                .map((f) => `• <#${f.channelId}>: ${f.error}`)
                .join('\n');
            const notificationContent = {
                content: `⚠️ **Announcement Relay Failure**\n\nFailed to relay your message to the following channels:\n${failureList}\n\nOriginal message: ${originalMessage.url}`,
            };
            await this.discordClient.sendMessage(this.config.privateChannelId, notificationContent);
            logger.info('Moderator notified of relay failures', {
                originalMessageId: originalMessage.id,
                failureCount: failures.length,
            });
        }
        catch (error) {
            logError('Failed to notify moderator of relay failures', error, {
                originalMessageId: originalMessage.id,
                failureCount: failures.length,
            });
        }
    }
    /**
     * Enable the announcement relay
     */
    enable() {
        this.enabled = true;
        logger.info('AnnouncementRelayManager enabled');
    }
    /**
     * Disable the announcement relay
     */
    disable() {
        this.enabled = false;
        logger.info('AnnouncementRelayManager disabled');
    }
    /**
     * Stop monitoring (remove event listener)
     */
    stop() {
        if (!this.isListening) {
            logger.debug('AnnouncementRelayManager not listening, skipping stop');
            return;
        }
        // Remove the specific event listener for this instance
        if (this.boundMessageHandler) {
            this.discordClient.off('messageCreate', this.boundMessageHandler);
            this.boundMessageHandler = undefined;
        }
        this.isListening = false;
        logger.info('AnnouncementRelayManager stopped');
    }
    /**
     * Check if relay is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        if (config.privateChannelId) {
            this.config.privateChannelId = config.privateChannelId;
        }
        if (config.publicChannelIds) {
            this.config.publicChannelIds = config.publicChannelIds;
        }
        if (config.guildId) {
            this.config.guildId = config.guildId;
        }
        if (config.moderatorRoleId) {
            this.config.moderatorRoleId = config.moderatorRoleId;
        }
        logger.info('AnnouncementRelayManager configuration updated', {
            privateChannelId: this.config.privateChannelId,
            publicChannelCount: this.config.publicChannelIds.length,
        });
    }
}
//# sourceMappingURL=announcement-relay.manager.js.map