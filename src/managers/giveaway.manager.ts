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
  Message,
} from 'discord.js';
import { randomBytes } from 'crypto';
import type { IDiscordClient } from '@/core/discord/client.js';
import type { GiveawayRepository } from '@/core/database/repositories/GiveawayRepository.js';
import type { Giveaway, GiveawayStatus } from '@/types/models.js';
import { logger, logError } from '@/core/logger/logger.js';

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

  constructor(
    private discordClient: IDiscordClient,
    private giveawayRepository: GiveawayRepository
  ) {}

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
        options.requiredRoles
      );

      // Create entry button
      const button = new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveawayId}`)
        .setLabel('🎉 Enter Giveaway')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

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
        title: options.title,
        description: options.description,
        channelId: options.channelId,
        messageId: message.id,
        requiredRoles: options.requiredRoles,
        winnerCount: options.winnerCount,
        entries: [],
        status: 'active',
        endsAt,
        createdAt: now,
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
    guildId: string
  ): Promise<void> {
    try {
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
        giveaway
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
        interaction.user.id
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
   * Validate if a user can enter a giveaway
   * Requirement 9.1: Only allow users with required roles to enter
   */
  private async validateEntry(
    userId: string,
    guildId: string,
    giveaway: Giveaway
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
        member.roles.cache.has(roleId)
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
      await this.giveawayRepository.updateStatus(giveawayId, 'ended');

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
    guildId: string
  ): Promise<void> {
    try {
      const winnerMentions = winners.map((id) => `<@${id}>`).join(', ');

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.title} - Winners!`)
        .setDescription(
          `Congratulations to the winners!\n\n**Winners:** ${winnerMentions}`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await this.discordClient.sendMessage(giveaway.channelId, {
        content: winnerMentions,
        embeds: [embed],
      });

      // Send DM to each winner
      for (const winnerId of winners) {
        try {
          const member = await this.discordClient.getMember(guildId, winnerId);
          if (member) {
            await member.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('🎉 You Won a Giveaway!')
                  .setDescription(
                    `Congratulations! You won the giveaway: **${giveaway.title}**\n\n` +
                      `Check the giveaway channel for more details!`
                  )
                  .setColor(0x00ff00)
                  .setTimestamp(),
              ],
            });
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
        .setTitle(`${giveaway.title} - Ended`)
        .setDescription('This giveaway ended with no entries.')
        .setColor(0xff0000)
        .setTimestamp();

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
    requiredRoles: string[]
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${title}`)
      .setDescription(description)
      .setColor(0x5865f2)
      .addFields(
        { name: 'Winners', value: `${winnerCount}`, inline: true },
        {
          name: 'Ends At',
          value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
          inline: true,
        },
        { name: 'Entries', value: '0', inline: true }
      )
      .setTimestamp();

    if (requiredRoles.length > 0) {
      embed.addFields({
        name: 'Required Roles',
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
    entryCount: number
  ): Promise<void> {
    try {
      const channel = await this.discordClient.sendMessage(giveaway.channelId, {
        content: '',
      });

      const message = await channel.channel.messages.fetch(giveaway.messageId);

      if (message.embeds.length > 0) {
        const embed = EmbedBuilder.from(message.embeds[0]);
        
        // Update entries field
        const fields = embed.data.fields || [];
        const entryFieldIndex = fields.findIndex((f) => f.name === 'Entries');
        
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
    winners: string[]
  ): Promise<void> {
    try {
      const channel = await this.discordClient.sendMessage(giveaway.channelId, {
        content: '',
      });

      const message = await channel.channel.messages.fetch(giveaway.messageId);

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.title} - Ended`)
        .setDescription(giveaway.description)
        .setColor(0x808080)
        .setTimestamp();

      if (winners.length > 0) {
        embed.addFields({
          name: 'Winners',
          value: winners.map((id) => `<@${id}>`).join(', '),
          inline: false,
        });
      } else {
        embed.addFields({
          name: 'Winners',
          value: 'No entries',
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
      await this.giveawayRepository.updateStatus(giveawayId, 'cancelled');

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
   * Update giveaway message when cancelled
   */
  private async updateGiveawayMessageCancelled(giveaway: Giveaway): Promise<void> {
    try {
      const channel = await this.discordClient.sendMessage(giveaway.channelId, {
        content: '',
      });

      const message = await channel.channel.messages.fetch(giveaway.messageId);

      const embed = new EmbedBuilder()
        .setTitle(`${giveaway.title} - Cancelled`)
        .setDescription('This giveaway has been cancelled.')
        .setColor(0xff0000)
        .setTimestamp();

      await message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      logger.debug('Failed to update cancelled giveaway message', {
        giveawayId: giveaway.id,
        error: (error as Error).message,
      });
    }
  }
}
