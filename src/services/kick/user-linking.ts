/**
 * @file user-linking.ts
 * @description User linking system for connecting Kick and Discord accounts
 * @module services/kick
 *
 * This system allows users to link their Kick and Discord accounts by:
 * 1. User runs /link command on Discord
 * 2. Bot generates unique token and DMs user
 * 3. User types "!verify TOKEN" in Kick chat
 * 4. Bot monitors Kick chat for verification
 * 5. Bot confirms link and assigns roles
 *
 * Requirements: 2.5, 2.6
 */

import crypto from 'crypto';
import { logger } from '../../core/logger/logger.js';
import type { UserRepository } from '../../core/database/repositories/UserRepository.js';
import type { KickChatMessage } from '../pusher/types.js';

/**
 * Linking token with expiration
 */
export interface LinkToken {
  token: string;
  discordId: string;
  expiresAt: Date;
}

/**
 * Linking result
 */
export interface LinkResult {
  success: boolean;
  discordId?: string;
  kickUsername?: string;
  error?: string;
}

/**
 * User linking system interface
 */
export interface IUserLinkingSystem {
  /**
   * Start the linking process for a Discord user
   * Generates a unique token that expires in 10 minutes
   */
  startLinking(discordId: string): Promise<LinkToken>;

  /**
   * Verify a linking token from Kick chat
   * Returns the Discord user ID if valid, null otherwise
   */
  verifyToken(token: string): Promise<string | null>;

  /**
   * Complete the account linking
   * Links the Discord user to the Kick username
   */
  completeLink(discordId: string, kickUsername: string): Promise<void>;

  /**
   * Unlink accounts
   * Removes the Kick username from the Discord user
   */
  unlinkAccounts(discordId: string): Promise<void>;

  /**
   * Check if a Discord user has a linked Kick account
   */
  isLinked(discordId: string): Promise<boolean>;

  /**
   * Get the Kick username for a Discord user
   */
  getKickUsername(discordId: string): Promise<string | null>;

  /**
   * Get the Discord ID for a Kick username
   */
  getDiscordId(kickUsername: string): Promise<string | null>;

  /**
   * Process a Kick chat message looking for verification commands
   * Returns link result if verification was attempted
   */
  processVerificationMessage(message: KickChatMessage): Promise<LinkResult | null>;

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): Promise<void>;
}

/**
 * User linking system implementation
 */
export class UserLinkingSystem implements IUserLinkingSystem {
  private pendingLinks: Map<string, LinkToken> = new Map();
  private readonly TOKEN_LENGTH = 8;
  private readonly TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
  private readonly VERIFY_COMMAND_PREFIX = '!verify';

  constructor(private userRepository: UserRepository) {
    // Start cleanup interval (every 5 minutes)
    setInterval(() => {
      this.cleanupExpiredTokens().catch((error) => {
        logger.error('Failed to cleanup expired tokens', { error });
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Generate a cryptographically secure random token
   */
  private generateToken(): string {
    // Generate random bytes and convert to alphanumeric string
    const bytes = crypto.randomBytes(this.TOKEN_LENGTH);
    return bytes
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, this.TOKEN_LENGTH)
      .toUpperCase();
  }

  /**
   * Start the linking process
   */
  async startLinking(discordId: string): Promise<LinkToken> {
    // Check if user already has a pending link
    const existingToken = Array.from(this.pendingLinks.values()).find(
      (link) => link.discordId === discordId,
    );

    if (existingToken && existingToken.expiresAt > new Date()) {
      logger.debug('User already has pending link token', {
        discordId,
        token: existingToken.token,
      });
      return existingToken;
    }

    // Generate new token
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MS);

    const linkToken: LinkToken = {
      token,
      discordId,
      expiresAt,
    };

    this.pendingLinks.set(token, linkToken);

    logger.info('Generated linking token', {
      discordId,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    return linkToken;
  }

  /**
   * Verify a linking token
   */
  async verifyToken(token: string): Promise<string | null> {
    const linkToken = this.pendingLinks.get(token.toUpperCase());

    if (!linkToken) {
      logger.debug('Token not found', { token });
      return null;
    }

    if (linkToken.expiresAt < new Date()) {
      logger.debug('Token expired', {
        token,
        expiresAt: linkToken.expiresAt.toISOString(),
      });
      this.pendingLinks.delete(token.toUpperCase());
      return null;
    }

    return linkToken.discordId;
  }

  /**
   * Complete the account linking
   */
  async completeLink(discordId: string, kickUsername: string): Promise<void> {
    try {
      // Check if Kick username is already linked to another Discord account
      const existingUser = await this.userRepository.getByKickUsername(kickUsername);

      if (existingUser && existingUser.discordId !== discordId) {
        throw new Error(
          `Kick username ${kickUsername} is already linked to another Discord account`,
        );
      }

      // Link the accounts
      await this.userRepository.linkKickUsername(discordId, kickUsername);

      // Remove any pending tokens for this Discord user
      for (const [token, linkToken] of this.pendingLinks.entries()) {
        if (linkToken.discordId === discordId) {
          this.pendingLinks.delete(token);
        }
      }

      logger.info('Account linking completed', {
        discordId,
        kickUsername,
      });
    } catch (error) {
      logger.error('Failed to complete account linking', {
        error,
        discordId,
        kickUsername,
      });
      throw error;
    }
  }

  /**
   * Unlink accounts
   */
  async unlinkAccounts(discordId: string): Promise<void> {
    try {
      await this.userRepository.unlinkKickUsername(discordId);

      logger.info('Account unlinking completed', { discordId });
    } catch (error) {
      logger.error('Failed to unlink accounts', {
        error,
        discordId,
      });
      throw error;
    }
  }

  /**
   * Check if a Discord user has a linked Kick account
   */
  async isLinked(discordId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.get(discordId);
      return user !== null && user.kickUsername !== null && user.kickUsername !== undefined;
    } catch (error) {
      logger.error('Failed to check link status', {
        error,
        discordId,
      });
      return false;
    }
  }

  /**
   * Get the Kick username for a Discord user
   */
  async getKickUsername(discordId: string): Promise<string | null> {
    try {
      const user = await this.userRepository.get(discordId);
      return user?.kickUsername || null;
    } catch (error) {
      logger.error('Failed to get Kick username', {
        error,
        discordId,
      });
      return null;
    }
  }

  /**
   * Get the Discord ID for a Kick username
   */
  async getDiscordId(kickUsername: string): Promise<string | null> {
    try {
      const user = await this.userRepository.getByKickUsername(kickUsername);
      return user?.discordId || null;
    } catch (error) {
      logger.error('Failed to get Discord ID', {
        error,
        kickUsername,
      });
      return null;
    }
  }

  /**
   * Process a Kick chat message looking for verification commands
   */
  async processVerificationMessage(
    message: KickChatMessage,
  ): Promise<LinkResult | null> {
    // Check if message is a verification command
    const content = message.content.trim();
    if (!content.startsWith(this.VERIFY_COMMAND_PREFIX)) {
      return null;
    }

    // Extract token from command
    const parts = content.split(/\s+/);
    if (parts.length !== 2) {
      logger.debug('Invalid verification command format', {
        username: message.username,
        content,
      });
      return {
        success: false,
        error: 'Invalid command format. Use: !verify TOKEN',
      };
    }

    const token = parts[1];

    // Verify token
    const discordId = await this.verifyToken(token);

    if (!discordId) {
      logger.debug('Invalid or expired token', {
        username: message.username,
        token,
      });
      return {
        success: false,
        error: 'Invalid or expired token. Please request a new link from Discord.',
      };
    }

    // Complete the link
    try {
      await this.completeLink(discordId, message.username);

      logger.info('Account linking verified via Kick chat', {
        discordId,
        kickUsername: message.username,
        token,
      });

      return {
        success: true,
        discordId,
        kickUsername: message.username,
      };
    } catch (error) {
      logger.error('Failed to complete link after verification', {
        error,
        discordId,
        kickUsername: message.username,
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to complete account linking',
      };
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [token, linkToken] of this.pendingLinks.entries()) {
      if (linkToken.expiresAt < now) {
        this.pendingLinks.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up expired linking tokens', {
        count: cleanedCount,
      });
    }
  }
}
