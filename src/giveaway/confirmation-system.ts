import { Client, EmbedBuilder, User } from 'discord.js';
import { WinnerStateRepository } from '../core/database/repositories/WinnerStateRepository.js';
import { GiveawayRepository } from '../core/database/repositories/GiveawayRepository.js';
import { TimerManager } from './timer-manager.js';
import { RerollHandler } from './reroll-handler.js';
import { ConfigManager } from './config-manager.js';
import { MessageListener } from './message-listener.js';
import { WinnerStatus, type WinnerRecord } from '../types/models.js';
import { logger } from '../core/logger/logger.js';

/**
 * ConfirmationSystem orchestrates the winner confirmation workflow
 *
 * Coordinates between Timer Manager, Message Listener, State Manager, and Reroll Handler
 * to implement the complete winner confirmation and reroll process.
 */
export class ConfirmationSystem {
  private timerManager: TimerManager;
  private rerollHandler: RerollHandler;
  private messageListener: MessageListener;
  private client: Client | null = null;
  private confirmationLocks: Set<string> = new Set(); // Track ongoing confirmations

  constructor(
    private winnerStateRepo: WinnerStateRepository,
    private giveawayRepo: GiveawayRepository,
    _configManager: ConfigManager, // Kept for backward compatibility but not used
  ) {
    this.rerollHandler = new RerollHandler(giveawayRepo, winnerStateRepo);

    // Initialize timer manager with callbacks
    this.timerManager = new TimerManager({
      onReminder: this.handleReminder.bind(this),
      onExpiry: this.handleExpiry.bind(this),
    });

    // Initialize message listener with confirmation callback
    this.messageListener = new MessageListener(
      winnerStateRepo,
      this.confirmWinner.bind(this),
    );
  }

  /**
   * Initialize the confirmation system with Discord client
   */
  initialize(client: Client): void {
    this.client = client;
    this.messageListener.initialize(client);
    logger.info('ConfirmationSystem initialized');
  }

  /**
   * Start confirmation process for winners
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
   */
  async startConfirmation(giveawayId: string, winners: User[]): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('ConfirmationSystem not initialized with Discord client');
      }

      const giveaway = await this.giveawayRepo.get(giveawayId);
      if (!giveaway) {
        throw new Error(`Giveaway not found: ${giveawayId}`);
      }

      const now = new Date();

      // Create winner records with PENDING status
      for (const winner of winners) {
        await this.winnerStateRepo.createWinner({
          giveawayId,
          userId: winner.id,
          status: WinnerStatus.PENDING,
          selectedAt: now,
          timerStartTime: now,
          timerActive: true,
        });

        // Start timers for each winner
        this.timerManager.startTimers(giveawayId, winner.id, now);
      }

      // Send winner announcement message
      await this.sendWinnerAnnouncement(giveaway.channelId, giveawayId, winners);

      logger.info('Winner confirmation started', {
        giveawayId,
        winnerCount: winners.length,
        winners: winners.map(w => w.id),
      });
    } catch (error) {
      logger.error('Failed to start winner confirmation', { giveawayId, error });
      throw error;
    }
  }

  /**
   * Handle winner confirmation
   * Requirements: 2.2, 2.3, 2.4, 2.5
   */
  async confirmWinner(giveawayId: string, userId: string): Promise<void> {
    const lockKey = `${giveawayId}:${userId}`;
    
    // Check if confirmation is already in progress
    if (this.confirmationLocks.has(lockKey)) {
      logger.debug('Confirmation already in progress, skipping duplicate', { giveawayId, userId });
      return;
    }

    try {
      // Acquire lock
      this.confirmationLocks.add(lockKey);

      // Check current status
      const winner = await this.winnerStateRepo.getWinner(giveawayId, userId);
      if (!winner) {
        logger.warn('Winner record not found for confirmation', { giveawayId, userId });
        return;
      }

      if (winner.status !== WinnerStatus.PENDING) {
        logger.debug('Winner already processed', { giveawayId, userId, status: winner.status });
        return;
      }

      // Update status to CONFIRMED
      await this.winnerStateRepo.updateStatus(giveawayId, userId, WinnerStatus.CONFIRMED);

      // Stop timers
      this.timerManager.stopTimers(giveawayId, userId);

      // Send confirmation notification
      await this.sendConfirmationMessage(giveawayId, userId);

      logger.info('Winner confirmed', { giveawayId, userId });
    } catch (error) {
      logger.error('Failed to confirm winner', { giveawayId, userId, error });
      throw error;
    } finally {
      // Release lock after 5 seconds to prevent rapid duplicate calls
      setTimeout(() => {
        this.confirmationLocks.delete(lockKey);
      }, 5000); // Increased from 1000ms to handle slow operations
    }
  }

  /**
   * Handle reminder callback
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  private async handleReminder(giveawayId: string, userId: string): Promise<void> {
    try {
      // Verify winner is still pending
      const winner = await this.winnerStateRepo.getWinner(giveawayId, userId);
      if (!winner || winner.status !== WinnerStatus.PENDING) {
        logger.debug('Skipping reminder - winner not pending', { giveawayId, userId });
        return;
      }

      // Send reminder message
      await this.sendReminderMessage(giveawayId, userId);

      logger.info('Reminder sent', { giveawayId, userId });
    } catch (error) {
      logger.error('Failed to send reminder', { giveawayId, userId, error });
    }
  }

  /**
   * Handle expiry callback
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
   */
  private async handleExpiry(giveawayId: string, userId: string): Promise<void> {
    try {
      // Verify winner is still pending
      const winner = await this.winnerStateRepo.getWinner(giveawayId, userId);
      if (!winner || winner.status !== WinnerStatus.PENDING) {
        logger.debug('Skipping expiry - winner not pending', { giveawayId, userId });
        return;
      }

      // Update status to REROLLED
      await this.winnerStateRepo.updateStatus(giveawayId, userId, WinnerStatus.REROLLED);

      // Send DM to disqualified user
      if (this.client) {
        try {
          const disqualifiedUser = await this.client.users.fetch(userId);
          const giveaway = await this.giveawayRepo.get(giveawayId);
          
          const disqualifyEmbed = new EmbedBuilder()
            .setTitle('❌ Disqualified - No Response')
            .setDescription(
              `<@${userId}> Unfortunately, you did not respond in time to confirm your win for: **${giveaway?.title || 'the giveaway'}**\n\n` +
              '**Reason:** Failed to send a message in the server within 5 minutes.\n\n' +
              '**Result:** Your win has been rerolled to another participant.\n\n' +
              'Better luck next time!',
            )
            .setColor(0xff0000)
            .setTimestamp();

          await disqualifiedUser.send({ embeds: [disqualifyEmbed] });
          logger.info('Disqualification DM sent to expired winner', { giveawayId, userId });
        } catch (error) {
          logger.warn('Failed to send disqualification DM - user may have DMs disabled', {
            giveawayId,
            userId,
            error: (error as Error).message,
          });
        }
      }

      // Select new winner
      const newWinnerId = await this.rerollHandler.rerollWinner(giveawayId);

      if (!newWinnerId) {
        // No eligible participants remain
        await this.announceGiveawayComplete(giveawayId);
        logger.info('Giveaway complete - no eligible participants', { giveawayId });
        return;
      }

      // Start confirmation for new winner
      const now = new Date();
      await this.winnerStateRepo.createWinner({
        giveawayId,
        userId: newWinnerId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });

      this.timerManager.startTimers(giveawayId, newWinnerId, now);

      // Update giveaway winners array in database (replace old winner with new)
      const giveaway = await this.giveawayRepo.get(giveawayId);
      if (giveaway && giveaway.winners && giveaway.winners.length > 0) {
        const updatedWinners = giveaway.winners
          .map(id => id === userId ? newWinnerId : id)
          .filter((id): id is string => id !== null);
        await this.giveawayRepo.updateWinners(giveawayId, updatedWinners);
        logger.debug('Updated giveaway winners array after expiry', {
          giveawayId,
          oldWinners: giveaway.winners,
          newWinners: updatedWinners,
        });
        
        // Update the ended giveaway message with new winner
        await this.updateEndedGiveawayMessage(giveaway, updatedWinners);
      }

      // Send reroll announcement (automatic - user didn't respond)
      await this.sendRerollAnnouncement(giveawayId, userId, newWinnerId, false);

      logger.info('Winner rerolled', { giveawayId, originalWinner: userId, newWinner: newWinnerId });
    } catch (error) {
      logger.error('Failed to handle expiry', { giveawayId, userId, error });
    }
  }

  /**
   * Get winner state for validation
   */
  async getWinnerState(giveawayId: string, userId: string): Promise<WinnerRecord | null> {
    return await this.winnerStateRepo.getWinner(giveawayId, userId);
  }

  /**
   * Handle manual reroll command
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  async manualReroll(
    giveawayId: string,
    userId: string,
    guildId: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('ConfirmationSystem not initialized');
    }

    // Use a transaction-like approach with rollback capability
    let newWinnerId: string | null = null;
    let winnerCreated = false;
    
    try {
      // Get giveaway to verify it exists
      const giveaway = await this.giveawayRepo.get(giveawayId);
      if (!giveaway) {
        throw new Error('Giveaway not found');
      }

      // Verify winner exists
      const winner = await this.winnerStateRepo.getWinner(giveawayId, userId);
      if (!winner) {
        throw new Error('User is not a winner for this giveaway');
      }

      // Step 1: Update status to REROLLED
      await this.winnerStateRepo.updateStatus(giveawayId, userId, WinnerStatus.REROLLED);

      // Step 2: Stop timers
      this.timerManager.stopTimers(giveawayId, userId);

      // Step 3: Select new winner
      newWinnerId = await this.rerollHandler.rerollWinner(giveawayId);

      if (!newWinnerId) {
        // No eligible participants - announce completion
        await this.announceGiveawayComplete(giveawayId);
        logger.info('Manual reroll complete - no eligible participants', { giveawayId });
        
        // Send DM to disqualified user
        await this.sendDisqualificationDM(userId, giveaway, true);
        return;
      }

      // Step 4: Create new winner record
      const now = new Date();
      await this.winnerStateRepo.createWinner({
        giveawayId,
        userId: newWinnerId,
        status: WinnerStatus.PENDING,
        selectedAt: now,
        timerStartTime: now,
        timerActive: true,
      });
      winnerCreated = true;

      // Step 5: Start timers for new winner
      this.timerManager.startTimers(giveawayId, newWinnerId, now);

      // Step 6: Update giveaway winners array in database
      if (giveaway.winners && giveaway.winners.length > 0) {
        const updatedWinners = giveaway.winners
          .map(id => id === userId ? newWinnerId : id)
          .filter((id): id is string => id !== null);
        await this.giveawayRepo.updateWinners(giveawayId, updatedWinners);
        logger.debug('Updated giveaway winners array', {
          giveawayId,
          oldWinners: giveaway.winners,
          newWinners: updatedWinners,
        });
        
        // Update the ended giveaway message with new winner
        await this.updateEndedGiveawayMessage(giveaway, updatedWinners);
      }

      // Step 7: Send DM to disqualified user
      await this.sendDisqualificationDM(userId, giveaway, true);

      // Step 8: Send reroll announcement
      await this.sendRerollAnnouncement(giveawayId, userId, newWinnerId, true);

      logger.info('Manual reroll completed', {
        giveawayId,
        originalWinner: userId,
        newWinner: newWinnerId,
        guildId,
      });
    } catch (error) {
      logger.error('Failed to execute manual reroll', { giveawayId, userId, guildId, error });
      
      // Rollback: If we created a new winner but failed, try to clean up
      if (newWinnerId && winnerCreated) {
        try {
          await this.winnerStateRepo.updateStatus(giveawayId, newWinnerId, WinnerStatus.REROLLED);
          this.timerManager.stopTimers(giveawayId, newWinnerId);
          logger.info('Rolled back new winner creation', { giveawayId, newWinnerId });
        } catch (rollbackError) {
          logger.error('Failed to rollback new winner', { giveawayId, newWinnerId, rollbackError });
        }
      }
      
      throw error;
    }
  }

  /**
   * Send disqualification DM to a user
   */
  private async sendDisqualificationDM(
    userId: string,
    giveaway: { title: string },
    isManual: boolean,
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const disqualifiedUser = await this.client.users.fetch(userId);
      
      const title = isManual ? '❌ Disqualified - Rerolled by Moderator' : '❌ Disqualified - No Response';
      const reason = isManual 
        ? 'Failed to respond in time or manually rerolled.'
        : 'Failed to send a message in the server within 5 minutes.';
      
      const disqualifyEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(
          `<@${userId}> Your win for **${giveaway.title}** has been rerolled.\n\n` +
          `**Reason:** ${reason}\n\n` +
          '**Result:** Your win has been given to another participant.\n\n' +
          'Better luck next time!',
        )
        .setColor(0xff0000)
        .setTimestamp();

      await disqualifiedUser.send({ embeds: [disqualifyEmbed] });
      logger.info('Disqualification DM sent', { userId, isManual });
    } catch {
      logger.warn('Failed to send disqualification DM - user may have DMs disabled', {
        userId,
      });
    }
  }

  /**
   * Restore active confirmations on system startup
   * Requirements: 9.4, 10.4, 10.5
   */
  async restoreActiveConfirmations(): Promise<void> {
    try {
      const pendingWinners = await this.winnerStateRepo.getAllPendingWinners();

      logger.info('Restoring active confirmations', { count: pendingWinners.length });

      // Filter out winners without timer start time
      const winnersWithTimers = pendingWinners.filter(
        (w): w is typeof w & { timerStartTime: Date } => w.timerStartTime !== null,
      );

      this.timerManager.restoreTimers(winnersWithTimers);

      logger.info('Active confirmations restored', { count: winnersWithTimers.length });
    } catch (error) {
      logger.error('Failed to restore active confirmations', { error });
      throw error;
    }
  }

  /**
   * Send winner announcement message
   * Requirements: 1.4, 1.5, 8.1, 8.5
   */
  private async sendWinnerAnnouncement(
    channelId: string,
    giveawayId: string,
    winners: User[],
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    // Rate limit: 1 second delay before sending announcement
    await new Promise(resolve => setTimeout(resolve, 1000));

    const giveaway = await this.giveawayRepo.get(giveawayId);
    const winnerMentions = winners.map(w => `<@${w.id}>`).join(', ');

    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway Winners Selected!')
      .setDescription(
        `Congratulations ${winnerMentions}!\n\n` +
        '**⏰ IMPORTANT:** You must send any message in this server within the next **5 minutes** to confirm your win!\n\n' +
        '**Failure to respond will result in an automatic reroll.**',
      )
      .setColor(0x00ff00)
      .setTimestamp();

    // Add reroll commands as separate fields (easier to copy on mobile)
    if (winners.length > 0) {
      for (let index = 0; index < winners.length; index++) {
        const winner = winners[index];
        // Use @mention format for reliability - Discord will handle it properly
        embed.addFields({
          name: winners.length > 1 ? `Reroll Command ${index + 1}` : 'Reroll Command',
          value: `\`gw.reroll ${giveawayId} @${winner.username}\``,
          inline: false,
        });
      }
    }

    const channel = await this.client.channels.fetch(channelId);
    if (channel && 'send' in channel) {
      const message = await channel.send({ content: winnerMentions, embeds: [embed] });
      
      // Auto-delete this message after 5 minutes (300000ms)
      setTimeout(async () => {
        try {
          await message.delete();
          logger.info('Auto-deleted winner announcement message', { giveawayId, messageId: message.id });
        } catch (error) {
          logger.debug('Failed to auto-delete winner announcement (may already be deleted)', {
            giveawayId,
            messageId: message.id,
            error: (error as Error).message,
          });
        }
      }, 300000); // 5 minutes
    }

    // Rate limit: 1 second delay before sending DMs
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send DM to each winner with 1 second delay between each
    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      
      // Add delay between DMs (skip for first winner)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`🎉 Congratulations!`)
          .setDescription(
            `<@${winner.id}> You won: **${giveaway?.title || 'a giveaway'}**\n\n` +
            '**⏰ IMPORTANT:** You must send any message in the server within the next **5 minutes** to confirm your win!\n\n' +
            '**Failure to respond will result in an automatic reroll.**' +
            (giveaway?.condition ? `\n\n**Next Steps:**\n${giveaway.condition}` : ''),
          )
          .setColor(0x00ff00)
          .setTimestamp();

        await winner.send({ embeds: [dmEmbed] });
        logger.info('Winner DM sent', { giveawayId, userId: winner.id });
      } catch (error) {
        logger.warn('Failed to send DM to winner - user may have DMs disabled', {
          giveawayId,
          userId: winner.id,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Send confirmation message
   * Requirements: 2.4, 8.2
   */
  private async sendConfirmationMessage(giveawayId: string, userId: string): Promise<void> {
    if (!this.client) {
      return;
    }

    const giveaway = await this.giveawayRepo.get(giveawayId);
    if (!giveaway) {
      return;
    }

    // Rate limit: 1 second delay before sending
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send public confirmation in channel
    const embed = new EmbedBuilder()
      .setTitle('✅ Winner Confirmed!')
      .setDescription(
        `<@${userId}> has confirmed their win!\n\n` +
        '**Next Steps:**\n' +
        (giveaway.condition || 'Check with the giveaway host for prize details.'),
      )
      .setColor(0x00ff00)
      .setTimestamp();

    const channel = await this.client.channels.fetch(giveaway.channelId);
    if (channel && 'send' in channel) {
      const message = await channel.send({ content: `<@${userId}>`, embeds: [embed] });
      
      // Auto-delete this message after 5 minutes (300000ms)
      setTimeout(async () => {
        try {
          await message.delete();
          logger.info('Auto-deleted confirmation message', { giveawayId, userId, messageId: message.id });
        } catch (error) {
          logger.debug('Failed to auto-delete confirmation message (may already be deleted)', {
            giveawayId,
            userId,
            messageId: message.id,
            error: (error as Error).message,
          });
        }
      }, 300000); // 5 minutes
    }

    // Rate limit: 1 second delay before sending DM
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send DM confirmation to winner
    try {
      const user = await this.client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('✅ Win Confirmed!')
        .setDescription(
          `<@${userId}> Your win has been confirmed for: **${giveaway.title}**\n\n` +
          '**Next Steps:**\n' +
          (giveaway.condition || 'Check with the giveaway host for prize details.'),
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
      logger.info('Confirmation DM sent', { giveawayId, userId });
    } catch (error) {
      logger.warn('Failed to send confirmation DM - user may have DMs disabled', {
        giveawayId,
        userId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Send reminder message
   * Requirements: 3.2, 3.3, 8.3
   */
  private async sendReminderMessage(giveawayId: string, userId: string): Promise<void> {
    if (!this.client) {
      return;
    }

    const giveaway = await this.giveawayRepo.get(giveawayId);
    if (!giveaway) {
      return;
    }

    // Rate limit: 1 second delay before sending
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send public reminder in channel
    const embed = new EmbedBuilder()
      .setTitle('⏰ Giveaway Winner Reminder')
      .setDescription(
        `<@${userId}>, you have **3 minutes remaining** to confirm your win!\n\n` +
        'Send any message in this server to confirm.',
      )
      .setColor(0xffa500)
      .setTimestamp();

    const channel = await this.client.channels.fetch(giveaway.channelId);
    if (channel && 'send' in channel) {
      const message = await channel.send({ content: `<@${userId}>`, embeds: [embed] });
      
      // Auto-delete this message after 5 minutes (300000ms)
      setTimeout(async () => {
        try {
          await message.delete();
          logger.info('Auto-deleted reminder message', { giveawayId, userId, messageId: message.id });
        } catch (error) {
          logger.debug('Failed to auto-delete reminder message (may already be deleted)', {
            giveawayId,
            userId,
            messageId: message.id,
            error: (error as Error).message,
          });
        }
      }, 300000); // 5 minutes
    }

    // Rate limit: 1 second delay before sending DM
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send DM reminder to winner
    try {
      const user = await this.client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('⏰ Reminder: Confirm Your Win!')
        .setDescription(
          `<@${userId}> You have **3 minutes remaining** to confirm your win for: **${giveaway.title}**\n\n` +
          '**Action Required:** Send any message in the server to confirm.\n\n' +
          '**Warning:** Failure to respond will result in an automatic reroll.',
        )
        .setColor(0xffa500)
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
      logger.info('Reminder DM sent', { giveawayId, userId });
    } catch (error) {
      logger.warn('Failed to send reminder DM - user may have DMs disabled', {
        giveawayId,
        userId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Send reroll announcement
   * Requirements: 4.6, 8.4
   */
  private async sendRerollAnnouncement(
    giveawayId: string,
    originalUserId: string,
    newWinnerId: string,
    isManual: boolean = false,
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    const giveaway = await this.giveawayRepo.get(giveawayId);
    if (!giveaway) {
      return;
    }

    // Rate limit: 1 second delay before sending
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Different message based on manual vs automatic reroll
    const reasonText = isManual 
      ? `<@${originalUserId}> was manually rerolled by a moderator.`
      : `<@${originalUserId}> did not respond in time.`;

    const embed = new EmbedBuilder()
      .setTitle('🔄 Winner Rerolled')
      .setDescription(
        `${reasonText}\n\n` +
        `**New Winner:** <@${newWinnerId}>\n\n` +
        '**⏰ IMPORTANT:** You must send any message in this server within the next **5 minutes** to confirm your win!\n\n' +
        '**Failure to respond will result in an automatic reroll.**',
      )
      .setColor(0xffa500)
      .setTimestamp();

    try {
      const user = await this.client.users.fetch(newWinnerId);
      // Use @username format for better Discord auto-detection
      embed.addFields({
        name: 'Reroll Command',
        value: `\`gw.reroll ${giveawayId} @${user.username}\``,
        inline: false,
      });
    } catch {
      // Fallback to user ID if username fetch fails
      embed.addFields({
        name: 'Reroll Command',
        value: `\`gw.reroll ${giveawayId} <@${newWinnerId}>\``,
        inline: false,
      });
    }

    const channel = await this.client.channels.fetch(giveaway.channelId);
    if (channel && 'send' in channel) {
      const message = await channel.send({ content: `<@${newWinnerId}>`, embeds: [embed] });
      
      // Auto-delete this message after 5 minutes (300000ms)
      setTimeout(async () => {
        try {
          await message.delete();
          logger.info('Auto-deleted reroll announcement', { giveawayId, newWinnerId, messageId: message.id });
        } catch (error) {
          logger.debug('Failed to auto-delete reroll announcement (may already be deleted)', {
            giveawayId,
            newWinnerId,
            messageId: message.id,
            error: (error as Error).message,
          });
        }
      }, 300000); // 5 minutes
    }

    // Rate limit: 1 second delay before sending DM
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send DM to new winner
    try {
      const newWinner = await this.client.users.fetch(newWinnerId);
      const dmEmbed = new EmbedBuilder()
        .setTitle(`🎉 Congratulations!`)
        .setDescription(
          `<@${newWinnerId}> You won: **${giveaway.title}**\n\n` +
          '**⏰ IMPORTANT:** You must send any message in the server within the next **5 minutes** to confirm your win!\n\n' +
          '**Failure to respond will result in an automatic reroll.**' +
          (giveaway.condition ? `\n\n**Next Steps:**\n${giveaway.condition}` : ''),
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await newWinner.send({ embeds: [dmEmbed] });
      logger.info('Reroll winner DM sent', { giveawayId, userId: newWinnerId });
    } catch (error) {
      logger.warn('Failed to send DM to reroll winner - user may have DMs disabled', {
        giveawayId,
        userId: newWinnerId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Announce giveaway complete (no eligible participants remaining for reroll)
   */
  private async announceGiveawayComplete(giveawayId: string): Promise<void> {
    if (!this.client) {
      return;
    }

    const giveaway = await this.giveawayRepo.get(giveawayId);
    if (!giveaway) {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway Complete')
      .setDescription(
        '✅ **All Winners Selected**\n\n' +
        'All eligible participants have been selected as winners.\n\n' +
        'No more rerolls available.'
      )
      .setColor(0x808080)
      .setTimestamp();

    const channel = await this.client.channels.fetch(giveaway.channelId);
    if (channel && 'send' in channel) {
      await channel.send({ embeds: [embed] });
    }
  }

  /**
   * Update the ended giveaway message with new winners after reroll
   */
  private async updateEndedGiveawayMessage(
    giveaway: { id: string; channelId: string; messageId: string; title: string; description: string; endsAt: Date; hostedBy?: string; winnerCount: number },
    winners: string[],
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(giveaway.channelId);
      if (!channel || !('messages' in channel)) {
        return;
      }

      const message = await channel.messages.fetch(giveaway.messageId);
      const endTimestamp = Math.floor(giveaway.endsAt.getTime() / 1000);

      // Format prize display
      const prizeMatch = giveaway.title.match(/(\d+)\s*(\$|CAD|USD|EUR|GBP)/i);
      let prizeDisplay = `🏆 ${giveaway.title}`;
      
      if (prizeMatch && giveaway.winnerCount > 1) {
        const amount = prizeMatch[1];
        const symbol = prizeMatch[2];
        const total = parseInt(amount) * giveaway.winnerCount;
        prizeDisplay = `💵 ${amount}${symbol} x ${giveaway.winnerCount} (${total}${symbol} total)`;
      } else if (prizeMatch) {
        prizeDisplay = `💵 ${prizeMatch[1]}${prizeMatch[2]}`;
      }

      // Build updated description
      let embedDescription = `${prizeDisplay}\n\n`;
      embedDescription += `${giveaway.description}\n\n`;
      embedDescription += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      embedDescription += `⏰ **Ended:** <t:${endTimestamp}:R>\n`;
      embedDescription += `📅 **End Date:** <t:${endTimestamp}:f>\n`;
      
      if (giveaway.hostedBy) {
        embedDescription += `🎤 **Hosted By:** <@${giveaway.hostedBy}>\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏁 GIVEAWAY ENDED')
        .setDescription(embedDescription)
        .setColor(0x808080) // Gray for ended
        .setTimestamp()
        .setFooter({ text: '🎁 This giveaway has ended' });

      if (winners.length > 0) {
        const winnersList = winners.map((id, index) => `${index + 1}. <@${id}>`).join('\n');
        embed.addFields({
          name: '🏆 Winners',
          value: winnersList,
          inline: false,
        });
      }

      await message.edit({ embeds: [embed], components: [] });
      logger.info('Updated ended giveaway message with new winners', {
        giveawayId: giveaway.id,
        winners,
      });
    } catch (error) {
      logger.warn('Failed to update ended giveaway message', {
        giveawayId: giveaway.id,
        error: (error as Error).message,
      });
    }
  }
}
