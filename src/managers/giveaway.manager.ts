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

      // Create entry button
      const enterButton = new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveawayId}`)
        .setLabel('🎉 Enter Giveaway')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎁');

      // Create view participants button
      const viewButton = new ButtonBuilder()
        .setCustomId(`giveaway_view_${giveawayId}`)
        .setLabel('👥 View Participants')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton, viewButton);

      // Send giveaway message
      const message = await this.discordClient.sendMessage(options.channelId, {
        embeds: [embed],
      });

      // Add button to message
      await message.edit({
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
    try {
      // Check if this is a view participants button
      if (interaction.customId.startsWith('giveaway_view_')) {
        await this.handleViewParticipants(interaction);
        return;
      }

      // Extract giveaway ID from button custom ID
      const giveawayId = interaction.customId.replace('giveaway_enter_', '');

      // Get giveaway from database
      const giveaway = await this.giveawayRepository.get(giveawayId);

      if (!giveaway) {
        await interaction.reply({
          content: '❌ This giveaway no longer exists.',
          ephemeral: true,
        });
        return;
      }

      // Check if giveaway is still active
      if (giveaway.status !== 'active') {
        await interaction.reply({
          content: '❌ This giveaway has ended.',
          ephemeral: true,
        });
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
        await interaction.reply({
          content: `❌ ${validation.reason}`,
          ephemeral: true,
        });
        return;
      }

      // Check for duplicate entry
      // Requirement 9.6: Prevent duplicate entries
      const hasEntry = await this.giveawayRepository.hasEntry(
        giveawayId,
        interaction.user.id,
      );

      if (hasEntry) {
        await interaction.reply({
          content: '✅ You have already entered this giveaway!',
          ephemeral: true,
        });
        return;
      }

      // Add entry
      // Requirement 9.5: Record entry with user ID and timestamp
      await this.giveawayRepository.addEntry(giveawayId, interaction.user.id);

      // Get updated entry count
      const entries = await this.giveawayRepository.getEntries(giveawayId);

      // Update giveaway message with new entry count
      await this.updateGiveawayMessage(giveaway, entries.length);

      await interaction.reply({
        content: '🎉 You have successfully entered the giveaway! Good luck!',
        ephemeral: true,
      });

      logger.info('Giveaway entry recorded', {
        giveawayId,
        userId: interaction.user.id,
        totalEntries: entries.length,
      });
    } catch (error) {
      logError('Failed to handle giveaway entry', error as Error, {
        userId: interaction.user.id,
        customId: interaction.customId,
      });

      await interaction.reply({
        content: '❌ An error occurred while entering the giveaway. Please try again.',
        ephemeral: true,
      });
    }
  }

  /**
   * Handle view participants button interaction
   * Shows real-time list of participants
   */
  private async handleViewParticipants(interaction: ButtonInteraction): Promise<void> {
    try {
      // Extract giveaway ID from button custom ID
      const giveawayId = interaction.customId.replace('giveaway_view_', '');

      // Get giveaway from database
      const giveaway = await this.giveawayRepository.get(giveawayId);

      if (!giveaway) {
        await interaction.reply({
          content: '❌ This giveaway no longer exists.',
          ephemeral: true,
        });
        return;
      }

      // Get all entries
      const entries = await this.giveawayRepository.getEntries(giveawayId);

      if (entries.length === 0) {
        await interaction.reply({
          content: '📋 No participants yet. Be the first to enter!',
          ephemeral: true,
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

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
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

      await interaction.reply({
        content: '❌ An error occurred while loading participants. Please try again.',
        ephemeral: true,
      });
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

    // Schedule end event
    const timeout = setTimeout(() => {
      void this.endGiveaway(giveaway.id, guildId);
    }, delay);

    this.activeGiveaways.set(giveaway.id, timeout);

    logger.debug('Giveaway end scheduled', {
      giveawayId: giveaway.id,
      endsAt: giveaway.endsAt.toISOString(),
      delayMs: delay,
    });
  }

  /**
   * End a giveaway and select winners
   */
  private async endGiveaway(giveawayId: string, guildId: string): Promise<void> {
    try {
      // Get giveaway from database
      const giveaway = await this.giveawayRepository.get(giveawayId);

      if (!giveaway) {
        logger.warn('Giveaway not found when ending', { giveawayId });
        return;
      }

      if (giveaway.status !== 'active') {
        logger.debug('Giveaway already ended', { giveawayId, status: giveaway.status });
        return;
      }

      // Update status to ended
      await this.giveawayRepository.updateStatus(giveawayId, GiveawayStatus.ENDED);

      // Get all entries
      const entries = await this.giveawayRepository.getEntries(giveawayId);

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
    } catch (error) {
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

    const winners: string[] = [];
    const available = [...userIds]; // Create a copy

    for (let i = 0; i < count && available.length > 0; i++) {
      // Generate cryptographically secure random index
      const randomIndex = this.secureRandomInt(0, available.length);
      winners.push(available[randomIndex]);
      available.splice(randomIndex, 1); // Remove selected winner
    }

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

      // Build announcement description with reroll command
      let description = `🎊 Congratulations to the winners!\n\n**🏆 Winners:** ${winnerMentions}`;

      if (giveaway.hostedBy) {
        description += `\n**🎤 Hosted by:** <@${giveaway.hostedBy}>`;
      }

      if (winners.length > 0) {
        description += `\n\n**Moderators:** To reroll a winner, use:\n\`\`\`\n/giveaway reroll giveaway_id:${giveaway.id} winner: @user\n\`\`\``;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.title} - Winners Announced!`)
        .setDescription(description)
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: '🎁 Congratulations to all winners!' });

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
        .setDescription('❌ This giveaway ended with no entries.')
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: '🎁 Better luck next time!' });

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
   * Create giveaway embed
   */
  private createGiveawayEmbed(
    title: string,
    description: string,
    endsAt: Date,
    winnerCount: number,
    requiredRoles: string[],
    hostedBy?: string,
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${title}`)
      .setDescription(`${description}\n\n✨ Click the button below to enter!`)
      .setColor(0x5865f2)
      .addFields(
        { name: '🏆 Winners', value: `${winnerCount}`, inline: true },
        {
          name: '⏰ Ends',
          value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
          inline: true,
        },
        { name: '👥 Entries', value: '0', inline: true },
      )
      .setTimestamp()
      .setFooter({ text: '🎁 Good luck to all participants!' });

    if (hostedBy) {
      embed.addFields({
        name: '🎤 Hosted by',
        value: `<@${hostedBy}>`,
        inline: false,
      });
    }

    if (requiredRoles.length > 0) {
      embed.addFields({
        name: '🔒 Required Roles',
        value: requiredRoles.map((id) => `<@&${id}>`).join(', '),
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

        // Update entries field
        const fields = embed.data.fields || [];
        const entryFieldIndex = fields.findIndex((f) => f.name === '👥 Entries');

        if (entryFieldIndex !== -1) {
          fields[entryFieldIndex].value = `${entryCount}`;
          embed.setFields(fields);
        }

        await message.edit({ embeds: [embed] });
      }
    } catch (error) {
      logger.debug('Failed to update giveaway message', {
        giveawayId: giveaway.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update giveaway message when ended
   */
  private async updateGiveawayMessageEnded(
    giveaway: Giveaway,
    winners: string[],
  ): Promise<void> {
    try {
      // Fetch the message
      const message = await this.discordClient.getMessage(giveaway.channelId, giveaway.messageId);

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.title} - Ended`)
        .setDescription(giveaway.description)
        .setColor(0x808080)
        .setTimestamp()
        .setFooter({ text: '🎁 Giveaway has ended' });

      if (winners.length > 0) {
        embed.addFields({
          name: '🏆 Winners',
          value: winners.map((id) => `<@${id}>`).join(', '),
          inline: false,
        });
      } else {
        embed.addFields({
          name: '🏆 Winners',
          value: '❌ No entries',
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

      // Remove button
      await message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      logger.debug('Failed to update ended giveaway message', {
        giveawayId: giveaway.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Generate unique giveaway ID
   */
  private generateGiveawayId(): string {
    return randomBytes(16).toString('hex');
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

      for (const giveaway of activeGiveaways) {
        this.scheduleGiveawayEnd(giveaway, guildId);
      }

      logger.info('Active giveaways recovered', {
        count: activeGiveaways.length,
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
      const updatedWinners = giveaway.winners.map(id =>
        id === oldWinnerId ? newWinnerId : id,
      );
      await this.giveawayRepository.updateWinners(giveawayId, updatedWinners);

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
          `**❌ Previous Winner:** <@${oldWinnerId}>\n` +
          `**✅ New Winner:** <@${newWinnerId}>\n\n` +
          '🎊 Congratulations to the new winner!',
        )
        .setColor(0xffa500)
        .setTimestamp()
        .setFooter({ text: '🎁 Winner rerolled by moderators' });

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
