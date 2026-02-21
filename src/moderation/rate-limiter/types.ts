import { Client } from 'discord.js';
import { logger } from '../../core/logger/logger.js';
import { ConfigManager } from '../../config/config-manager.js';

/**
 * Configuration for the rate limiter system
 */
export interface RateLimiterConfig {
  /** Map of restricted channel IDs to redirect channel IDs */
  restrictedChannels: Map<string, string>;
  
  /** Duration in milliseconds for rate limit window (default: 60000) */
  rateLimitWindowMs: number;
  
  /** Duration in milliseconds for violation window (default: 300000) */
  violationWindowMs: number;
  
  /** Duration in milliseconds before warning message is deleted (default: 10000) */
  warningDeleteDelayMs: number;
  
  /** Interval in milliseconds for cleanup operations (default: 60000) */
  cleanupIntervalMs: number;
}

/**
 * Information about a rate limit violation
 */
export interface RateLimitViolation {
  userId: string;
  channelId: string;
  lastMessageTime: number;
  currentTime: number;
  timeSinceLastMessage: number;
}

/**
 * External dependencies injected into the rate limiter
 */
export interface RateLimiterDependencies {
  discordClient: Client;
  stateStore: StateStore;
  logger: typeof logger;
  configManager: ConfigManager;
}

/**
 * Abstraction over Redis/in-memory storage for rate limiting state
 */
export interface StateStore {
  /** Get last message timestamp for user in channel */
  getLastMessageTime(userId: string, channelId: string): Promise<number | null>;
  
  /** Set last message timestamp for user in channel */
  setLastMessageTime(userId: string, channelId: string, timestamp: number): Promise<void>;
  
  /** Get violation window expiry time for user in channel */
  getViolationExpiry(userId: string, channelId: string): Promise<number | null>;
  
  /** Set violation window expiry time for user in channel */
  setViolationExpiry(userId: string, channelId: string, expiryTime: number): Promise<void>;
  
  /** Remove expired entries */
  removeExpired(currentTime: number): Promise<void>;
  
  /** Get all keys for cleanup operations */
  getAllKeys(): Promise<string[]>;
}
