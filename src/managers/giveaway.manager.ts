/**
 * @file giveaway.manager.ts
 * @description Giveaway manager for creating and managing role-gated giveaways
 * @module managers
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ButtonInteraction,
} from 'discord.js';
import { randomBytes } from 'crypto';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { GiveawayRepository } from '@/core/database/repositories/GiveawayRepository.js';
import type { Giveaway } from '@/types/models.js';
import { GiveawayStatus } from '@/types/models.js';
import { logger, logError } from '@/core/logger/logger.js';
import { ConfirmationSystem } from '@/giveaway/confirmation-system.js';
import { ConfigManager } from '@/giveaway/config-manager.js';
import { redisClient } from '@/core/cache/redis.client.js';

/**
 * Options for creating a giveaway
 */
export interface CreateGiveawayOptions {
  title: string;
  description: string;
  channelId: string;
  guildId: string;
  requiredRoles: string[];
  winnerCount: number;
  durationMs: number;
  condition?: string;
  hostedBy?: string; // Discord user ID of the giveaway host
}

/**
 * Result of entry validation
 */
export interface EntryValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Giveaway manager handles creation, entry validation, and winner selection
 * Implements requirements 9.1, 9.2, 9.4, 9.5, 9.6
 */
export class GiveawayManager {
  private activeGiveaways: Map<string, NodeJS.Timeout> = new Map();
  private countdownIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastUpdateTime: Map<string, number> = new Map();
  private confirmationSystem: ConfirmationSystem | null = null;
  private configManager: ConfigManager | null = null;

  constructor(
    private discordClient: IDiscordClient,
    private giveawayRepository: GiveawayRepository,
  ) {}

  /**
   * Set the confirmation system (called during initialization)
   */
  setConfirmationSystem(confirmationSystem: ConfirmationSystem): void {
    this.confirmationSystem = confirmationSystem;
  }

  /**
   * Get the confirmation system
   */
  getConfirmationSystem(): ConfirmationSystem | null {
    return this.confirmationSystem;
  }

  /**
   * Set the config manager (called during initialization)
   */
  setConfigManager(configManager: ConfigManager): void {
    this.configManager = configManager;
  }

  /**
   * Get the config manager
   */
  getConfigManager(): ConfigManager {
    if (!this.configManager) {
      throw new Error('ConfigManager not initialized');
    }
    return this.configManager;
  }

  /**
   * Create a new giveaway with interactive button
   * Requirement 9.4: Interactive buttons for users to enter giveaways
   */
  async createGiveaway(options: CreateGiveawayOptions): Promise<Giveaway> {
    try {
      // Generate unique giveaway ID
      const giveawayId = this.generateGiveawayId();
      const now = new Date();
      const endsAt = new Date(now.getTime() + options.durationMs);

      // Create giveaway embed
      const embed = this.createGiveawayEmbed(
        options.title,
        options.description,
        endsAt,
        options.winnerCount,
        options.requiredRoles,
        options.hostedBy,
      );

      // Create entry button - clean and simple
      const enterButton = new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveawayId}`)
        .setLabel('Enter')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎉');

      // Create view participants button - clean and simple
      const viewButton = new ButtonBuilder()
        .setCustomId(`giveaway_view_${giveawayId}`)
        .setLabel('Participants')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👥');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton, viewButton);

      // Send giveaway message with buttons
      const message = await this.discordClient.sendMessage(options.channelId, {
        embeds: [embed],
        components: [row],
      });

      // Create giveaway object
      const giveaway: Giveaway = {
        id: giveawayId,
        guildId: options.guildId,
        title: options.title,
        description: options.description,
        channelId: options.channelId,
        messageId: message.id,
        requiredRoles: options.requiredRoles,
        winnerCount: options.winnerCount,
        entries: [],
        status: GiveawayStatus.ACTIVE,
        endsAt,
        createdAt: now,
        condition: options.condition,
        winners: [],
        hostedBy: options.hostedBy,
      };

      // Save to database
      await this.giveawayRepository.save(giveaway);

      // Schedule giveaway end
      this.scheduleGiveawayEnd(giveaway, options.guildId);

      // Start countdown updates (smart rate limiting)
      this.startSmartCountdown(giveaway);

      logger.info('Giveaway created', {
        giveawayId,
        title: options.title,
        channelId: options.channelId,
        endsAt: endsAt.toISOString(),
        winnerCount: options.winnerCount,
        requiredRoles: options.requiredRoles,
      });

      return giveaway;
    } catch (error) {
      logError('Failed to create giveaway', error as Error, {
        title: options.title,
        channelId: options.channelId,
      });
      throw error;
    }
  }

  /**
   * Handle giveaway entry button interaction
   * Requirements 9.1, 9.2, 9.5, 9.6
   */
  async handleEntryInteraction(
    interaction: ButtonInteraction,
    guildId: string,
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check if this is a view participants button
      if (interaction.customId.startsWith('giveaway_view_')) {
        await this.handleViewParticipants(interaction);
        return;
      }

      // CRITICAL: Defer reply immediately to prevent timeout (Discord requires response within 3 seconds)
      await interaction.deferReply({ ephemeral: true });

      // Extract giveaway ID from button custom ID
      const giveawayId = interaction.customId.replace('giveaway_enter_', '');

      // Get giveaway from database
      const giveaway = await this.giveawayRepository.get(giveawayId);

      if (!giveaway) {
        await this.queueResponse(interaction, '❌ This giveaway no longer exists.');
        return;
      }

      // Check if giveaway is still active and not expired
      if (giveaway.status !== 'active') {
        await this.queueResponse(interaction, '❌ This giveaway has ended.');
        return;
      }

      // Check if giveaway has expired (even if status is still 'active')
      if (giveaway.endsAt.getTime() <= Date.now()) {
        await this.queueResponse(interaction, '❌ This giveaway has ended.');
        // Trigger end process if not already ended
        void this.endGiveaway(giveaway.id, guildId);
        return;
      }

      // Validate entry
      const validation = await this.validateEntry(
        interaction.user.id,
        guildId,
        giveaway,
      );

      if (!validation.allowed) {
        // Requirement 9.2: Send ephemeral message explaining restriction
        await this.queueResponse(interaction, `❌ ${validation.reason}`);
        return;
      }

      // Check for duplicate entry using Redis with atomic operation
      // Requirement 9.6: Prevent duplicate entries
      const entryKey = `giveaway:entry:${giveawayId}:${interaction.user.id}`;
      
      try {
        const timestamp = new Date().toISOString();
        const entryData = JSON.stringify({ userId: interaction.user.id, timestamp });
        
        // ATOMIC: Use SETNX (SET if Not eXists) to prevent race condition
        const wasSet = await redisClient.setnx(entryKey, entryData, 86400);
        
        if (!wasSet) {
          // Entry already exists
          await this.queueResponse(interaction, '✅ Already entered!');
          return;
        }
        
        // Entry successfully recorded atomically
        
        // Add to entries list (for counting and winner selection)
        const entriesListKey = `giveaway:entries:list:${giveawayId}`;
        const currentList = await redisClient.get(entriesListKey);
        const entries = currentList ? JSON.parse(currentList) : [];
        entries.push({ userId: interaction.user.id, timestamp });
        await redisClient.set(entriesListKey, JSON.stringify(entries), 86400);
        
        // Increment entry count
        const countKey = `giveaway:entries:count:${giveawayId}`;
        const entryCount = await redisClient.incr(countKey);
        await redisClient.expire(countKey, 86400);
        
        // Also write to database for durability
        await this.giveawayRepository.addEntry(giveawayId, interaction.user.id).catch(err => {
          logger.warn('Failed to write entry to database (may already exist)', {
            giveawayId,
            userId: interaction.user.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
        
        // Update giveaway message with new entry count (don't await)
        void this.updateGiveawayMessage(giveaway, entryCount);

        // Queue the response (1 second delay between responses)
        await this.queueResponse(interaction, '🎉 Entered!');

        logger.info('Giveaway entry recorded', {
          giveawayId,
          userId: interaction.user.id,
          totalEntries: entryCount,
          processingTime: Date.now() - startTime,
        });
      } catch (error) {
        // If Redis fails completely, rollback and use database
        logger.error('Redis operation failed, using database fallback', {
          giveawayId,
          userId: interaction.user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        // Try to delete the entry key if it was set
        await redisClient.del(entryKey).catch(() => {});
        
        // Check database for duplicate
        const hasEntry = await this.giveawayRepository.hasEntry(giveawayId, interaction.user.id);
        if (hasEntry) {
          await this.queueResponse(interaction, '✅ Already entered!');
          return;
        }
        
        await this.giveawayRepository.addEntry(giveawayId, interaction.user.id);
        const entries = await this.giveawayRepository.getEntries(giveawayId);
        void this.updateGiveawayMessage(giveaway, entries.length);
        
        await this.queueResponse(interaction, '🎉 Entered!');
      }
    } catch (error) {
      logError('Failed to handle giveaway entry', error as Error, {
        userId: interaction.user.id,
        customId: interaction.customId,
      });

      await this.queueResponse(interaction, '❌ Error. Please try again.').catch(() => {});
    }
  }

  /**
   * Queue a response with rate limiting (1 second between responses)
   */
  private async queueResponse(interaction: ButtonInteraction, content: string): Promise<void> {
    // Check queue size to prevent memory exhaustion
    if (this.responseQueue.length >= this.MAX_QUEUE_SIZE) {
      logger.warn('Response queue full, rejecting entry', {
        queueSize: this.responseQueue.length,
        userId: interaction.user.id,
      });
      
      try {
        await interaction.editReply({
          content: '❌ Server is busy. Please try again in a moment.',
        });
      } catch (error) {
        logger.error('Failed to send queue full message', { error });
      }
      return;
    }

    // Add to response queue
    this.responseQueue.push({
      interaction,
      content,
      timestamp: Date.now(),
    });

    // Start processing if not already running
    if (!this.processingQueue) {
      void this.processResponseQueue();
    }
  }

  private responseQueue: Array<{ interaction: ButtonInteraction; content: string; timestamp: number }> = [];
  private readonly MAX_QUEUE_SIZE = 1000; // Prevent memory exhaustion
  private processingQueue = false;
  private lastResponseTime = 0;

  /**
   * Process queued responses with 1 second delay between each
   */
  private async processResponseQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    while (this.responseQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastResponse = now - this.lastResponseTime;

      // Wait 1 second between responses to avoid rate limits
      if (timeSinceLastResponse < 1000 && this.lastResponseTime > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastResponse));
      }

      const item = this.responseQueue.shift();
      if (!item) break;

      try {
        if (item.interaction.deferred && !item.interaction.replied) {
          await item.interaction.editReply({ content: item.content });
          this.lastResponseTime = Date.now();
        }
      } catch (error) {
        logger.debug('Failed to send queued response (interaction may have expired)', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    this.processingQueue = false;
  }

  /**
   * Handle view participants button interaction
   * Shows real-time list of participants from cache or database
   */
  private async handleViewParticipants(interaction: ButtonInteraction): Promise<void> {
    try {
      // Defer reply immediately to prevent timeout (Discord requires response within 3 seconds)
      await interaction.deferReply({ ephemeral: true });

      // Extract giveaway ID from button custom ID
      const giveawayId = interaction.customId.replace('giveaway_view_', '');

      // Get giveaway from database
      const giveaway = await this.giveawayRepository.get(giveawayId);

      if (!giveaway) {
        await interaction.editReply({
          content: '❌ This giveaway no longer exists.',
        });
        return;
      }

      // Get all entries - try cache first, then database
      let entries: Array<{ userId: string; timestamp: Date }> = [];
      
      try {
        // Try to get from Redis cache first (for active giveaways)
        const entriesListKey = `giveaway:entries:list:${giveawayId}`;
        const cachedEntries = await redisClient.get(entriesListKey);
        
        if (cachedEntries) {
          const parsedEntries = JSON.parse(cachedEntries) as Array<{ userId: string; timestamp: string }>;
          entries = parsedEntries.map((e) => ({
            userId: e.userId,
            timestamp: new Date(e.timestamp),
          }));
          logger.debug('Loaded participants from cache', { giveawayId, count: entries.length });
        } else {
          // Fallback to database (for ended giveaways or cache miss)
          entries = await this.giveawayRepository.getEntries(giveawayId);
          logger.debug('Loaded participants from database', { giveawayId, count: entries.length });
        }
      } catch (cacheError) {
        // If cache fails, use database
        logger.warn('Failed to load from cache, using database', {
          giveawayId,
          error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
        });
        entries = await this.giveawayRepository.getEntries(giveawayId);
      }

      if (entries.length === 0) {
        await interaction.editReply({
          content: '📋 No participants yet. Be the first to enter!',
        });
        return;
      }

      // Build participants list
      const embed = new EmbedBuilder()
        .setTitle(`📋 ${giveaway.title} - Participants`)
        .setColor(0x5865f2)
        .setTimestamp()
        .setFooter({ text: `🎁 Total Participants: ${entries.length}` });

      // Add description with giveaway info
      let description = `**🏆 Winners to be selected:** ${giveaway.winnerCount}\n`;
      description += `**⏰ Ends:** <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>\n\n`;
      
      if (giveaway.hostedBy) {
        description += `**🎤 Hosted by:** <@${giveaway.hostedBy}>\n\n`;
      }

      description += `**👥 Participants (${entries.length}):**\n`;

      // Limit to 50 participants per page to avoid message length limits
      const maxDisplay = 50;
      const displayEntries = entries.slice(0, maxDisplay);

      // Sort by timestamp (oldest first)
      displayEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Add participants with entry number
      for (let i = 0; i < displayEntries.length; i++) {
        const entry = displayEntries[i];
        const entryNumber = i + 1;
        const timestamp = Math.floor(entry.timestamp.getTime() / 1000);
        description += `${entryNumber}. <@${entry.userId}> - <t:${timestamp}:R>\n`;
      }

      if (entries.length > maxDisplay) {
        description += `\n*...and ${entries.length - maxDisplay} more participants*`;
      }

      embed.setDescription(description);

      // Add statistics field
      const now = Date.now();
      const timeRemaining = giveaway.endsAt.getTime() - now;
      const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

      let statsValue = `**Entry Rate:** ${entries.length} participants\n`;
      if (hoursRemaining > 0) {
        statsValue += `**Time Left:** ${hoursRemaining}h ${minutesRemaining}m\n`;
      } else if (minutesRemaining > 0) {
        statsValue += `**Time Left:** ${minutesRemaining}m\n`;
      } else {
        statsValue += `**Time Left:** Ending soon!\n`;
      }
      statsValue += `**Your Odds:** 1 in ${entries.length}`;

      embed.addFields({
        name: '📊 Statistics',
        value: statsValue,
        inline: false,
      });

      await interaction.editReply({
        embeds: [embed],
      });

      logger.info('Giveaway participants viewed', {
        giveawayId,
        userId: interaction.user.id,
        totalParticipants: entries.length,
      });
    } catch (error) {
      logError('Failed to show giveaway participants', error as Error, {
        userId: interaction.user.id,
        customId: interaction.customId,
      });

      // Check if we can still reply
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while loading participants. Please try again.',
        });
      } else if (!interaction.replied) {
        await interaction.reply({
          content: '❌ An error occurred while loading participants. Please try again.',
          ephemeral: true,
        });
      }
    }
  }

  /**
   * Validate if a user can enter a giveaway
   * Requirement 9.1: Only allow users with required roles to enter
   */
  private async validateEntry(
    userId: string,
    guildId: string,
    giveaway: Giveaway,
  ): Promise<EntryValidationResult> {
    try {
      // If no role restrictions, allow entry
      if (giveaway.requiredRoles.length === 0) {
        return { allowed: true };
      }

      // Get member from guild
      const member = await this.discordClient.getMember(guildId, userId);

      if (!member) {
        return {
          allowed: false,
          reason: 'Could not verify your server membership.',
        };
      }

      // Check if user has at least one required role
      const hasRequiredRole = giveaway.requiredRoles.some((roleId) =>
        member.roles.cache.has(roleId),
      );

      if (!hasRequiredRole) {
        const roleNames = giveaway.requiredRoles
          .map((roleId) => {
            const role = member.guild.roles.cache.get(roleId);
            return role ? `@${role.name}` : roleId;
          })
          .join(', ');

        return {
          allowed: false,
          reason: `You need one of the following roles to enter: ${roleNames}`,
        };
      }

      return { allowed: true };
    } catch (error) {
      logError('Failed to validate giveaway entry', error as Error, {
        userId,
        guildId,
        giveawayId: giveaway.id,
      });

      return {
        allowed: false,
        reason: 'An error occurred while validating your entry.',
      };
    }
  }

  /**
   * Schedule giveaway end event
   */
  private scheduleGiveawayEnd(giveaway: Giveaway, guildId: string): void {
    const now = Date.now();
    const endsAt = giveaway.endsAt.getTime();
    const delay = endsAt - now;

    // If giveaway should have already ended, end it immediately
    if (delay <= 0) {
      void this.endGiveaway(giveaway.id, guildId);
      return;
    }

    // Schedule end event at EXACT time (not early, not late)
    const timeout = setTimeout(() => {
      void this.endGiveaway(giveaway.id, guildId);
    }, delay);

    this.activeGiveaways.set(giveaway.id, timeout);

    logger.debug('Giveaway end scheduled', {
      giveawayId: giveaway.id,
      endsAt: giveaway.endsAt.toISOString(),
      delayMs: delay,
      willTriggerAt: new Date(endsAt).toISOString(),
    });
  }

  /**
   * Start smart countdown that updates every second but respects rate limits
   * Strategy: Only update if at least 1 second has passed since last update
   */
  private startSmartCountdown(giveaway: Giveaway): void {
    this.stopSmartCountdown(giveaway.id);

    // Don't start countdown if already expired
    const now = Date.now();
    if (giveaway.endsAt.getTime() <= now) {
      logger.warn('Attempted to start countdown for expired giveaway', {
        giveawayId: giveaway.id,
        endsAt: giveaway.endsAt.toISOString(),
      });
      return;
    }

    const interval = setInterval(async () => {
      try {
        const now = Date.now();
        const timeRemaining = giveaway.endsAt.getTime() - now;

        // Stop if ended
        if (timeRemaining <= 0) {
          this.stopSmartCountdown(giveaway.id);
          return;
        }

        // Check if we should update (avoid rate limits)
        const lastUpdate = this.lastUpdateTime.get(giveaway.id) || 0;
        const timeSinceUpdate = now - lastUpdate;

        // Only update if at least 1 second passed
        if (timeSinceUpdate < 1000) {
          return;
        }

        // Get entry count from cache
        let entryCount = 0;
        try {
          const countKey = `giveaway:entries:count:${giveaway.id}`;
          const cached = await redisClient.get(countKey);
          entryCount = cached ? parseInt(cached, 10) : 0;
        } catch {
          const entries = await this.giveawayRepository.getEntries(giveaway.id);
          entryCount = entries.length;
        }

        // Update message
        await this.updateCountdown(giveaway, entryCount, timeRemaining);
        this.lastUpdateTime.set(giveaway.id, now);
      } catch (error) {
        // Silently handle errors
        if (error instanceof Error && error.message.includes('rate limit')) {
          logger.debug('Rate limited, skipping update', { giveawayId: giveaway.id });
        }
      }
    }, 1000); // Check every second

    this.countdownIntervals.set(giveaway.id, interval);
  }

  /**
   * Stop smart countdown
   */
  private stopSmartCountdown(giveawayId: string): void {
    const interval = this.countdownIntervals.get(giveawayId);
    if (interval) {
      clearInterval(interval);
      this.countdownIntervals.delete(giveawayId);
      this.lastUpdateTime.delete(giveawayId);
    }
  }

  /**
   * Update countdown in message
   */
  private async updateCountdown(
    giveaway: Giveaway,
    entryCount: number,
    timeRemainingMs: number,
  ): Promise<void> {
    try {
      const message = await this.discordClient.getMessage(giveaway.channelId, giveaway.messageId);
      if (message.embeds.length === 0) return;

      const embed = EmbedBuilder.from(message.embeds[0]);

      // Format countdown
      const totalSeconds = Math.floor(timeRemainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      let countdown = '';
      if (hours > 0) {
        countdown = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        countdown = `${minutes}m ${seconds}s`;
      } else {
        countdown = `${seconds}s`;
      }

      // Update description with countdown
      const timestamp = Math.floor(giveaway.endsAt.getTime() / 1000);
      let embedDescription = `${giveaway.description}\n\n`;
      embedDescription += `✨ **Click the button below to enter!**\n\n`;
      embedDescription += `⏰ **Ends:** in ${countdown} (<t:${timestamp}:f>)\n`;

      if (giveaway.hostedBy) {
        embedDescription += `🎤 **Hosted by** <@${giveaway.hostedBy}>\n`;
      }

      embed.setDescription(embedDescription);

      // Update entries field
      const fields = embed.data.fields || [];
      const entriesIndex = fields.findIndex(f => f.name === 'Entries');
      if (entriesIndex !== -1) {
        fields[entriesIndex].value = `👥 ${entryCount}`;
        embed.setFields(fields);
      }

      await message.edit({ embeds: [embed] });
    } catch (error) {
      // If message not found, stop the countdown
      if (error instanceof Error && error.message.includes('Unknown Message')) {
        logger.warn('Giveaway message deleted, stopping countdown', { giveawayId: giveaway.id });
        this.stopSmartCountdown(giveaway.id);
        return;
      }
      // Silently ignore other errors
    }
  }

  /**
   * End a giveaway and select winners
   */
  private async endGiveaway(giveawayId: string, guildId: string): Promise<void> {
    // Use Redis distributed lock to prevent race condition
    const lockKey = `giveaway:end:lock:${giveawayId}`;
    
    try {
      // Try to acquire lock (60 second expiry as safety)
      const lockAcquired = await redisClient.setnx(lockKey, '1', 60);
      
      if (!lockAcquired) {
        logger.debug('Giveaway end already in progress', { giveawayId });
        return;
      }

      // Get giveaway from database
      const giveaway = await this.giveawayRepository.get(giveawayId);

      if (!giveaway) {
        logger.warn('Giveaway not found when ending', { giveawayId });
        await redisClient.del(lockKey);
        return;
      }

      if (giveaway.status !== 'active') {
        logger.debug('Giveaway already ended', { giveawayId, status: giveaway.status });
        await redisClient.del(lockKey);
        return;
      }

      // Update status to ended
      await this.giveawayRepository.updateStatus(giveawayId, GiveawayStatus.ENDED);

      // Stop countdown
      this.stopSmartCountdown(giveawayId);

      // Get all entries - merge Redis and database to handle partial failures
      let entries: Array<{ userId: string; timestamp: Date }> = [];
      const userIdSet = new Set<string>();
      
      try {
        const entriesListKey = `giveaway:entries:list:${giveawayId}`;
        const cachedEntries = await redisClient.get(entriesListKey);
        
        if (cachedEntries) {
          const parsedEntries = JSON.parse(cachedEntries) as Array<{ userId: string; timestamp: string }>;
          entries = parsedEntries.map((e) => ({
            userId: e.userId,
            timestamp: new Date(e.timestamp),
          }));
          
          // Track user IDs
          entries.forEach(e => userIdSet.add(e.userId));
          
          // Batch write all entries to database now
          logger.info('Writing giveaway entries to database', {
            giveawayId,
            entryCount: entries.length,
          });
          
          for (const entry of entries) {
            try {
              await this.giveawayRepository.addEntry(giveawayId, entry.userId);
            } catch (dbError) {
              logger.warn('Failed to write entry to database', {
                giveawayId,
                userId: entry.userId,
                error: dbError instanceof Error ? dbError.message : 'Unknown error',
              });
            }
          }
          
          // Clean up Redis cache
          await redisClient.del(entriesListKey);
          await redisClient.del(`giveaway:entries:count:${giveawayId}`);
          
          // Clean up individual entry keys
          for (const entry of entries) {
            await redisClient.del(`giveaway:entry:${giveawayId}:${entry.userId}`);
          }
          
          logger.info('Batch wrote entries to database and cleaned cache', {
            giveawayId,
            entryCount: entries.length,
          });
        }
        
        // Also get entries from database (in case some were written as fallback)
        const dbEntries = await this.giveawayRepository.getEntries(giveawayId);
        
        // Merge with Redis entries (avoid duplicates)
        for (const dbEntry of dbEntries) {
          if (!userIdSet.has(dbEntry.userId)) {
            entries.push(dbEntry);
            userIdSet.add(dbEntry.userId);
          }
        }
        
        logger.info('Merged entries from Redis and database', {
          giveawayId,
          totalEntries: entries.length,
          uniqueUsers: userIdSet.size,
        });
      } catch (cacheError) {
        // If Redis fails, get entries from database
        logger.warn('Failed to get entries from cache, using database', {
          giveawayId,
          error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
        });
        entries = await this.giveawayRepository.getEntries(giveawayId);
      }

      // Remove scheduled timeout
      const timeout = this.activeGiveaways.get(giveawayId);
      if (timeout) {
        clearTimeout(timeout);
        this.activeGiveaways.delete(giveawayId);
      }

      // Check if there are any entries
      if (entries.length === 0) {
        await this.announceNoWinners(giveaway);
        logger.info('Giveaway ended with no entries', { giveawayId });
        await redisClient.del(lockKey);
        return;
      }

      // Select winners using CSPRNG
      const winnerCount = Math.min(giveaway.winnerCount, entries.length);
      const winners = this.selectWinners(entries.map((e) => e.userId), winnerCount);

      // Announce winners
      await this.announceWinners(giveaway, winners, guildId);

      logger.info('Giveaway ended', {
        giveawayId,
        totalEntries: entries.length,
        winnerCount: winners.length,
        winners,
      });
      
      // Release lock
      await redisClient.del(lockKey);
    } catch (error) {
      // Release lock on error
      await redisClient.del(lockKey).catch(() => {});
      logError('Failed to end giveaway', error as Error, { giveawayId });
    }
  }

  /**
   * Select random winners using CSPRNG
   * Uses crypto.randomBytes for cryptographically secure random selection
   */
  private selectWinners(userIds: string[], count: number): string[] {
    if (userIds.length === 0 || count === 0) {
      return [];
    }

    // Log selection details for transparency
    logger.info('Starting winner selection with CSPRNG', {
      totalParticipants: userIds.length,
      winnersToSelect: count,
      participants: userIds,
    });

    const winners: string[] = [];
    const available = [...userIds]; // Create a copy
    const selectionLog: Array<{ round: number; poolSize: number; randomIndex: number; winner: string }> = [];

    for (let i = 0; i < count && available.length > 0; i++) {
      // Generate cryptographically secure random index
      const randomIndex = this.secureRandomInt(0, available.length);
      const selectedWinner = available[randomIndex];
      
      winners.push(selectedWinner);
      
      // Log each selection for transparency
      selectionLog.push({
        round: i + 1,
        poolSize: available.length,
        randomIndex,
        winner: selectedWinner,
      });
      
      available.splice(randomIndex, 1); // Remove selected winner
    }

    // Log complete selection process
    logger.info('Winner selection completed', {
      totalParticipants: userIds.length,
      winnersSelected: winners.length,
      winners,
      selectionProcess: selectionLog,
    });

    return winners;
  }

  /**
   * Generate cryptographically secure random integer in range [min, max)
   */
  private secureRandomInt(min: number, max: number): number {
    const range = max - min;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytesNeeded);
    const threshold = maxValue - (maxValue % range);

    let randomValue: number;
    do {
      const randomBytes = this.getRandomBytes(bytesNeeded);
      randomValue = 0;
      for (let i = 0; i < bytesNeeded; i++) {
        randomValue = randomValue * 256 + randomBytes[i];
      }
    } while (randomValue >= threshold);

    return min + (randomValue % range);
  }

  /**
   * Get cryptographically secure random bytes
   */
  private getRandomBytes(count: number): Buffer {
    return randomBytes(count);
  }

  /**
   * Announce giveaway winners
   */
  private async announceWinners(
    giveaway: Giveaway,
    winners: string[],
    guildId: string,
  ): Promise<void> {
    try {
      // If confirmation system is available, use it
      if (this.confirmationSystem) {
        // Fetch User objects for winners
        const winnerUsers = [];
        for (const winnerId of winners) {
          try {
            const member = await this.discordClient.getMember(guildId, winnerId);
            if (member) {
              winnerUsers.push(member.user);
            }
          } catch (error) {
            logger.warn('Failed to fetch winner user', { winnerId, error });
          }
        }

        // Start confirmation process
        await this.confirmationSystem.startConfirmation(giveaway.id, winnerUsers);

        // Store winners in database
        await this.giveawayRepository.updateWinners(giveaway.id, winners);

        // Update original giveaway message
        await this.updateGiveawayMessageEnded(giveaway, winners);

        logger.info('Giveaway ended with confirmation system', {
          giveawayId: giveaway.id,
          winnerCount: winners.length,
        });

        return;
      }

      // Fallback to original announcement (if confirmation system not available)
      const winnerMentions = winners.map((id) => `<@${id}>`).join(', ');

      // Build announcement description
      let description = `🎊 Congratulations to the winners!\n\n**🏆 Winners:**\n`;
      
      // List each winner on a separate line
      winners.forEach((id) => {
        description += `<@${id}>\n`;
      });

      if (giveaway.hostedBy) {
        description += `\n**🎤 Hosted by:** <@${giveaway.hostedBy}>`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.title} - Winners Announced!`)
        .setDescription(description)
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: '🎁 Congratulations to all winners!' });

      // Add reroll commands as separate fields (easier to copy on mobile)
      if (winners.length > 0) {
        for (let index = 0; index < winners.length; index++) {
          const id = winners[index];
          try {
            const member = await this.discordClient.getMember(guildId, id);
            if (member) {
              // Use @username format for better Discord auto-detection
              embed.addFields({
                name: winners.length > 1 ? `Reroll Command ${index + 1}` : 'Reroll Command',
                value: `\`gw.reroll ${giveaway.id} @${member.user.username}\``,
                inline: false,
              });
            } else {
              // Fallback to user ID if member not found
              embed.addFields({
                name: winners.length > 1 ? `Reroll Command ${index + 1}` : 'Reroll Command',
                value: `\`gw.reroll ${giveaway.id} <@${id}>\``,
                inline: false,
              });
            }
          } catch {
            // Fallback to user ID if fetch fails
            embed.addFields({
              name: winners.length > 1 ? `Reroll Command ${index + 1}` : 'Reroll Command',
              value: `\`gw.reroll ${giveaway.id} <@${id}>\``,
              inline: false,
            });
          }
        }
      }

      await this.discordClient.sendMessage(giveaway.channelId, {
        content: winnerMentions,
        embeds: [embed],
      });

      // Store winners in database
      await this.giveawayRepository.updateWinners(giveaway.id, winners);

      // Send DM to each winner with @mention and condition
      for (const winnerId of winners) {
        try {
          const member = await this.discordClient.getMember(guildId, winnerId);
          if (member) {
            let dmMessage = `<@${winnerId}> 🎉 You Won!\n\nCongratulations! You won the giveaway: **${giveaway.title}**`;

            if (giveaway.condition) {
              dmMessage += `\n\n**Next Steps:**\n${giveaway.condition}`;
            } else {
              dmMessage += '\n\nCheck the giveaway channel for more details!';
            }

            await member.send(dmMessage);
          }
        } catch (error) {
          logger.debug('Failed to send DM to winner', {
            winnerId,
            error: (error as Error).message,
          });
        }
      }

      // Update original giveaway message
      await this.updateGiveawayMessageEnded(giveaway, winners);
    } catch (error) {
      logError('Failed to announce winners', error as Error, {
        giveawayId: giveaway.id,
      });
    }
  }

  /**
   * Announce that giveaway ended with no winners
   */
  private async announceNoWinners(giveaway: Giveaway): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.title} - Ended`)
        .setDescription(
          '❌ **No Winner**\n\n' +
          'This giveaway ended with no entries.\n\n' +
          'Better luck next time!'
        )
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: '🎁 No participants entered' });

      if (giveaway.hostedBy) {
        embed.addFields({
          name: '🎤 Hosted by',
          value: `<@${giveaway.hostedBy}>`,
          inline: false,
        });
      }

      await this.discordClient.sendMessage(giveaway.channelId, {
        embeds: [embed],
      });

      // Update original message
      await this.updateGiveawayMessageEnded(giveaway, []);
    } catch (error) {
      logError('Failed to announce no winners', error as Error, {
        giveawayId: giveaway.id,
      });
    }
  }

  /**
   * Create giveaway embed with dynamic countdown
   * Uses Discord's native timestamp feature - updates automatically on client side
   */
  private createGiveawayEmbed(
      title: string,
      description: string,
      endsAt: Date,
      winnerCount: number,
      requiredRoles: string[],
      hostedBy?: string,
    ): EmbedBuilder {
      const timestamp = Math.floor(endsAt.getTime() / 1000);
      
      // Clean, professional description with dynamic countdown
      let embedDescription = `${description}\n\n`;
      embedDescription += `✨ **Click the button below to enter!**\n\n`;
      
      // Add countdown that updates automatically
      embedDescription += `⏰ **Ends:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n`;

      // Add hosted by in description if present
      if (hostedBy) {
        embedDescription += `🎤 **Hosted by** <@${hostedBy}>\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${title}`)
        .setDescription(embedDescription)
        .setColor(0x5865f2) // Discord blurple
        .addFields(
          { 
            name: 'Winners', 
            value: `🏆 ${winnerCount}`, 
            inline: true 
          },
          { 
            name: 'Entries', 
            value: `👥 0`, 
            inline: true 
          },
        )
        .setTimestamp()
        .setFooter({ text: '🎁 Good luck to all participants!' });

      // Add required roles if present
      if (requiredRoles.length > 0) {
        embed.addFields({
          name: 'Required Roles',
          value: `🔒 ${requiredRoles.map((id) => `<@&${id}>`).join(', ')}`,
          inline: false,
        });
      }

      return embed;
    }


  /**
   * Update giveaway message with current entry count
   */
  private async updateGiveawayMessage(
    giveaway: Giveaway,
    entryCount: number,
  ): Promise<void> {
    try {
      // Fetch the message
      const message = await this.discordClient.getMessage(giveaway.channelId, giveaway.messageId);

      if (message.embeds.length > 0) {
        const embed = EmbedBuilder.from(message.embeds[0]);

        // Update entries field - match the field name exactly as created
        const fields = embed.data.fields || [];
        const entryFieldIndex = fields.findIndex((f) => f.name === 'Entries');

        if (entryFieldIndex !== -1) {
          fields[entryFieldIndex].value = `👥 ${entryCount}`;
          embed.setFields(fields);
        } else {
          logger.warn('Entries field not found in giveaway embed', {
            giveawayId: giveaway.id,
            availableFields: fields.map(f => f.name),
          });
        }

        await message.edit({ embeds: [embed] });
      }
    } catch (error) {
      logError('Failed to update giveaway message', error as Error, {
        giveawayId: giveaway.id,
        entryCount,
      });
    }
  }

  /**
   * Update giveaway message when ended
   * Shows "Ended X time ago" using Discord's dynamic timestamp
   */
  private async updateGiveawayMessageEnded(
    giveaway: Giveaway,
    winners: string[],
  ): Promise<void> {
    try {
      // Fetch the message
      const message = await this.discordClient.getMessage(giveaway.channelId, giveaway.messageId);

      const endTimestamp = Math.floor(giveaway.endsAt.getTime() / 1000);

      // Clean ended message description with "ended X ago" timestamp
      let embedDescription = `${giveaway.description}\n\n`;
      embedDescription += `⏰ **Ended:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n`;
      
      if (giveaway.hostedBy) {
        embedDescription += `🎤 **Hosted by** <@${giveaway.hostedBy}>\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.title} - Ended`)
        .setDescription(embedDescription)
        .setColor(0x808080) // Gray for ended
        .setTimestamp()
        .setFooter({ text: '🎁 Giveaway has ended' });

      if (winners.length > 0) {
        embed.addFields({
          name: '🏆 Winners',
          value: winners.map((id) => `<@${id}>`).join('\n'),
          inline: false,
        });
      } else {
        embed.addFields({
          name: '❌ Winners',
          value: 'No entries',
          inline: false,
        });
      }

      // Remove buttons when ended
      await message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      // If message was deleted, just log and continue
      if (error instanceof Error && error.message.includes('Unknown Message')) {
        logger.info('Giveaway message was deleted, skipping update', {
          giveawayId: giveaway.id,
        });
        return;
      }
      
      logger.debug('Failed to update ended giveaway message', {
        giveawayId: giveaway.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Generate unique giveaway ID in format: GW-MM-XXXXX
   * Example: GW-02-47821 (February, random 5-digit number)
   */
  private generateGiveawayId(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 01-12
    
    // Generate cryptographically secure 5-digit random number (10000-99999)
    const randomNum = this.secureRandomInt(10000, 99999);
    
    return `GW-${month}-${randomNum}`;
  }

  /**
   * Recover active giveaways on startup
   * Used for state recovery after bot restart
   */
  async recoverActiveGiveaways(guildId: string): Promise<void> {
    try {
      const activeGiveaways = await this.giveawayRepository.getActive();

      logger.info('Recovering active giveaways', {
        count: activeGiveaways.length,
      });

      const now = Date.now();
      let recoveredCount = 0;
      let expiredCount = 0;

      for (const giveaway of activeGiveaways) {
        // Double-check if giveaway has expired (in case of clock skew or race conditions)
        if (giveaway.endsAt.getTime() <= now) {
          logger.info('Found expired giveaway during recovery, ending immediately', {
            giveawayId: giveaway.id,
            endsAt: giveaway.endsAt.toISOString(),
            now: new Date(now).toISOString(),
          });
          // End immediately and wait for it to complete before continuing
          await this.endGiveaway(giveaway.id, guildId);
          expiredCount++;
        } else {
          this.scheduleGiveawayEnd(giveaway, guildId);
          this.startSmartCountdown(giveaway);
          recoveredCount++;
        }
      }

      logger.info('Active giveaways recovered', {
        total: activeGiveaways.length,
        recovered: recoveredCount,
        expired: expiredCount,
      });
    } catch (error) {
      logError('Failed to recover active giveaways', error as Error);
    }
  }

  /**
   * Cancel a giveaway
   */
  async cancelGiveaway(giveawayId: string): Promise<void> {
    try {
      // Update status
      await this.giveawayRepository.updateStatus(giveawayId, GiveawayStatus.CANCELLED);

      // Remove scheduled timeout
      const timeout = this.activeGiveaways.get(giveawayId);
      if (timeout) {
        clearTimeout(timeout);
        this.activeGiveaways.delete(giveawayId);
      }

      // Stop countdown
      this.stopSmartCountdown(giveawayId);

      // Get giveaway
      const giveaway = await this.giveawayRepository.get(giveawayId);
      if (giveaway) {
        // Update message
        await this.updateGiveawayMessageCancelled(giveaway);
      }

      logger.info('Giveaway cancelled', { giveawayId });
    } catch (error) {
      logError('Failed to cancel giveaway', error as Error, { giveawayId });
      throw error;
    }
  }

  /**
   * Get all active giveaways for a guild
   */
  async getActiveGiveaways(guildId: string): Promise<Giveaway[]> {
    try {
      const allActive = await this.giveawayRepository.getActive();
      // Filter by guild (giveaways don't store guildId, so we need to check via Discord)
      // For now, return all active giveaways
      return allActive;
    } catch (error) {
      logError('Failed to get active giveaways', error as Error, { guildId });
      throw error;
    }
  }

  /**
   * Reroll a specific winner from a giveaway
   */
  async rerollWinner(giveawayId: string, oldWinnerId: string, guildId: string): Promise<void> {
    try {
      // If confirmation system is available, use it
      if (this.confirmationSystem) {
        await this.confirmationSystem.manualReroll(giveawayId, oldWinnerId, guildId);
        return;
      }

      // Fallback to original reroll logic
      // Get giveaway from database
      const giveaway = await this.giveawayRepository.get(giveawayId);

      if (!giveaway) {
        throw new Error('Giveaway not found');
      }

      if (giveaway.status !== GiveawayStatus.ENDED) {
        throw new Error('Can only reroll winners from ended giveaways');
      }

      if (!giveaway.winners || !giveaway.winners.includes(oldWinnerId)) {
        throw new Error('User is not a winner of this giveaway');
      }

      // Get all entries excluding current winners
      const allEntries = await this.giveawayRepository.getEntries(giveawayId);
      const availableEntries = allEntries
        .map(e => e.userId)
        .filter(userId => !giveaway.winners?.includes(userId));

      logger.debug('Reroll winner - entry analysis', {
        giveawayId,
        totalEntries: allEntries.length,
        currentWinners: giveaway.winners?.length || 0,
        availableForReroll: availableEntries.length,
        oldWinnerId,
      });

      if (availableEntries.length === 0) {
        throw new Error(
          `No remaining entries available for reroll. Total entries: ${allEntries.length}, Current winners: ${giveaway.winners?.length || 0}. All participants have already won.`,
        );
      }

      // Select new winner using CSPRNG
      const newWinners = this.selectWinners(availableEntries, 1);
      const newWinnerId = newWinners[0];

      // Update winners array (replace old with new)
      const updatedWinners = giveaway.winners
        .map(id => id === oldWinnerId ? newWinnerId : id)
        .filter((id): id is string => id !== null);
      await this.giveawayRepository.updateWinners(giveawayId, updatedWinners);

      // Send DM to disqualified user (fallback reroll without confirmation system)
      try {
        const disqualifiedMember = await this.discordClient.getMember(guildId, oldWinnerId);
        if (disqualifiedMember) {
          const disqualifyEmbed = new EmbedBuilder()
            .setTitle('❌ Disqualified - Rerolled by Moderator')
            .setDescription(
              `<@${oldWinnerId}> Your win for **${giveaway.title}** has been rerolled by a moderator.\n\n` +
              '**Reason:** Manually rerolled by server staff.\n\n' +
              '**Result:** Your win has been given to another participant.\n\n' +
              'Better luck next time!',
            )
            .setColor(0xff0000)
            .setTimestamp();

          await disqualifiedMember.send({ embeds: [disqualifyEmbed] });
          logger.info('Disqualification DM sent to rerolled winner', { 
            giveawayId, 
            oldWinnerId,
            newWinnerId 
          });
        }
      } catch (error) {
        logger.debug('Failed to send DM to disqualified winner', {
          winnerId: oldWinnerId,
          error: (error as Error).message,
        });
      }

      // Send DM to new winner with condition
      try {
        const member = await this.discordClient.getMember(guildId, newWinnerId);
        if (member) {
          let dmMessage = `<@${newWinnerId}> 🎉 You Won!\n\nCongratulations! You won the giveaway: **${giveaway.title}**`;

          if (giveaway.condition) {
            dmMessage += `\n\n**Next Steps:**\n${giveaway.condition}`;
          } else {
            dmMessage += '\n\nCheck the giveaway channel for more details!';
          }

          await member.send(dmMessage);
        }
      } catch (error) {
        logger.debug('Failed to send DM to new winner', {
          winnerId: newWinnerId,
          error: (error as Error).message,
        });
      }

      // Announce reroll in channel
      const embed = new EmbedBuilder()
        .setTitle(`🔄 ${giveaway.title} - Winner Rerolled`)
        .setDescription(
          '🎲 A winner has been rerolled!\n\n' +
          `<@${oldWinnerId}> did not respond in time.\n\n` +
          `**New Winner:** <@${newWinnerId}>\n\n` +
          '🎊 Congratulations to the new winner!',
        )
        .setColor(0xffa500)
        .setTimestamp()
        .setFooter({ text: '🎁 Winner rerolled by moderators' });

      try {
        const member = await this.discordClient.getMember(guildId, newWinnerId);
        if (member) {
          // Use @username format for better Discord auto-detection
          embed.addFields({
            name: 'Reroll Command',
            value: `\`gw.reroll ${giveawayId} @${member.user.username}\``,
            inline: false,
          });
        } else {
          // Fallback to user ID if member not found
          embed.addFields({
            name: 'Reroll Command',
            value: `\`gw.reroll ${giveawayId} <@${newWinnerId}>\``,
            inline: false,
          });
        }
      } catch {
        // Fallback to user ID if fetch fails
        embed.addFields({
          name: 'Reroll Command',
          value: `\`gw.reroll ${giveawayId} <@${newWinnerId}>\``,
          inline: false,
        });
      }

      if (giveaway.hostedBy) {
        embed.addFields({
          name: '🎤 Hosted by',
          value: `<@${giveaway.hostedBy}>`,
          inline: false,
        });
      }

      await this.discordClient.sendMessage(giveaway.channelId, {
        content: `<@${newWinnerId}>`,
        embeds: [embed],
      });

      // Update giveaway message
      await this.updateGiveawayMessageEnded(giveaway, updatedWinners);

      logger.info('Giveaway winner rerolled', {
        giveawayId,
        oldWinnerId,
        newWinnerId,
      });
    } catch (error) {
      logError('Failed to reroll winner', error as Error, {
        giveawayId,
        oldWinnerId,
      });
      throw error;
    }
  }

  /**
   * Update giveaway message when cancelled
   */
  private async updateGiveawayMessageCancelled(giveaway: Giveaway): Promise<void> {
    try {
      // Fetch the message
      const message = await this.discordClient.getMessage(giveaway.channelId, giveaway.messageId);

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.title} - Cancelled`)
        .setDescription('❌ This giveaway has been cancelled.')
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: '🎁 Giveaway cancelled by moderators' });

      if (giveaway.hostedBy) {
        embed.addFields({
          name: '🎤 Hosted by',
          value: `<@${giveaway.hostedBy}>`,
          inline: false,
        });
      }

      await message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      logger.debug('Failed to update cancelled giveaway message', {
        giveawayId: giveaway.id,
        error: (error as Error).message,
      });
    }
  }
}
