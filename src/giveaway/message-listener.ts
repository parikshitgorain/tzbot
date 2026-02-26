import { Client, Message } from 'discord.js';
import { WinnerStateRepository } from '../core/database/repositories/WinnerStateRepository.js';
import { logger } from '../core/logger/logger.js';

/**
 * Message Listener for Giveaway Winner Confirmation
 *
 * Monitors Discord message events to detect when pending winners send messages,
 * triggering the confirmation process. Uses an in-memory cache for performance.
 */
export class MessageListener {
  private client: Client | null = null;
  private winnerStateRepo: WinnerStateRepository;
  private pendingWinnersCache: Map<string, Set<string>>; // guildId -> Set<userId>
  private confirmationCallback: (giveawayId: string, userId: string) => Promise<void>;
  private userConfirmationAttempts: Map<string, number> = new Map(); // userId -> attempt count
  private readonly MAX_CONFIRMATION_ATTEMPTS = 3;

  constructor(
    winnerStateRepo: WinnerStateRepository,
    confirmationCallback: (giveawayId: string, userId: string) => Promise<void>,
  ) {
    this.winnerStateRepo = winnerStateRepo;
    this.confirmationCallback = confirmationCallback;
    this.pendingWinnersCache = new Map();
  }

  /**
   * Initialize message event listener
   */
  initialize(client: Client): void {
    this.client = client;

    // Register messageCreate event handler
    this.client.on('messageCreate', async (message: Message) => {
      await this.handleMessage(message);
    });

    logger.info('MessageListener initialized');
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: Message): Promise<void> {
    try {
      // Ignore bot messages
      if (message.author.bot) {
        return;
      }

      // Ignore messages without guild context
      if (!message.guildId) {
        return;
      }

      const userId = message.author.id;
      const guildId = message.guildId;

      // Check if user is a pending winner
      const isPending = await this.isPendingWinner(guildId, userId);
      if (!isPending) {
        return;
      }

      // Rate limiting: Check if user has exceeded confirmation attempts
      const attemptKey = `${guildId}:${userId}`;
      const attempts = this.userConfirmationAttempts.get(attemptKey) || 0;
      
      if (attempts >= this.MAX_CONFIRMATION_ATTEMPTS) {
        logger.debug('User exceeded confirmation attempts, ignoring', { userId, attempts });
        return;
      }

      // Increment attempt counter
      this.userConfirmationAttempts.set(attemptKey, attempts + 1);
      
      // Clear attempt counter after 10 seconds
      setTimeout(() => {
        this.userConfirmationAttempts.delete(attemptKey);
      }, 10000);

      // Get all giveaways where user is pending
      const giveawayIds = await this.getPendingGiveaways(guildId, userId);

      // Trigger confirmation for each giveaway
      for (const giveawayId of giveawayIds) {
        logger.info(`Winner confirmation detected: giveaway=${giveawayId}, user=${userId}`);
        await this.confirmationCallback(giveawayId, userId);

        // Invalidate cache for this user
        this.invalidateCache(guildId, userId);
      }
    } catch (error) {
      logger.error('Error handling message for winner confirmation', { error });
    }
  }

  /**
   * Check if user is a pending winner (with caching)
   */
  async isPendingWinner(guildId: string, userId: string): Promise<boolean> {
    // Check cache first
    const cachedWinners = this.pendingWinnersCache.get(guildId);
    if (cachedWinners) {
      return cachedWinners.has(userId);
    }

    // Cache miss - query database
    const giveawayIds = await this.getPendingGiveaways(guildId, userId);
    return giveawayIds.length > 0;
  }

  /**
   * Get all giveaways where user is a pending winner
   */
  async getPendingGiveaways(guildId: string, userId: string): Promise<string[]> {
    try {
      const pendingWinners = await this.winnerStateRepo.getPendingWinnersByUser(guildId, userId);
      return pendingWinners.map(w => w.giveawayId);
    } catch (error) {
      logger.error('Error getting pending giveaways', { guildId, userId, error });
      return [];
    }
  }

  /**
   * Refresh cache for a guild
   */
  async refreshCache(guildId: string): Promise<void> {
    try {
      const allPending = await this.winnerStateRepo.getAllPendingWinners();
      const guildPending = allPending.filter(_w => {
        // We need to get guild from giveaway - for now, we'll rebuild cache on demand
        return true;
      });

      const userIds = new Set(guildPending.map(w => w.userId));
      this.pendingWinnersCache.set(guildId, userIds);
    } catch (error) {
      logger.error('Error refreshing pending winners cache', { guildId, error });
    }
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidateCache(guildId: string, userId: string): void {
    const cachedWinners = this.pendingWinnersCache.get(guildId);
    if (cachedWinners) {
      cachedWinners.delete(userId);
    }
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.pendingWinnersCache.clear();
  }
}
