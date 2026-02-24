/**
 * @file client.ts
 * @description Discord client wrapper with connection management and operations
 * @module core/discord
 */

import {
  Client,
  GatewayIntentBits,
  Message,
  EmbedBuilder,
  TextChannel,
  GuildMember,
  Guild,
  Partials,
  ClientEvents,
  ActionRowBuilder,
  ButtonBuilder,
} from 'discord.js';
import { logger, logError } from '@/core/logger/logger.js';
import { verifyPermissionsOnStartup } from './permissions.js';

/**
 * Message content that can be sent to Discord
 */
export interface MessageContent {
  content?: string;
  embeds?: EmbedBuilder[];
  files?: Array<{ attachment: string | Buffer; name: string }>;
  components?: ActionRowBuilder<ButtonBuilder>[];
}

/**
 * Discord event types
 */
export type DiscordEvent = keyof ClientEvents;

/**
 * Event handler function type
 */
export type EventHandler<K extends DiscordEvent = DiscordEvent> = (
  ...args: ClientEvents[K]
) => void | Promise<void>;

/**
 * Discord client interface for bot operations
 */
export interface IDiscordClient {
  // Connection management
  connect(token: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Event subscription
  on<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
  once<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
  off<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;

  // Message operations
  sendMessage(channelId: string, content: MessageContent): Promise<Message>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
  sendDirectMessage(userId: string, content: MessageContent): Promise<Message>;
  getMessage(channelId: string, messageId: string): Promise<Message>;

  // Moderation operations
  banUser(guildId: string, userId: string, reason: string): Promise<void>;
  kickUser(guildId: string, userId: string, reason: string): Promise<void>;
  timeoutUser(
    guildId: string,
    userId: string,
    duration: number,
    reason: string
  ): Promise<void>;

  // Role operations
  addRole(guildId: string, userId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, userId: string, roleId: string): Promise<void>;

  // Utility methods
  getGuild(guildId: string): Guild | undefined;
  getMember(guildId: string, userId: string): Promise<GuildMember | null>;
}

/**
 * Discord client wrapper implementation
 */
export class DiscordClient implements IDiscordClient {
  public client: Client;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds

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
  private setupInternalEventHandlers(): void {
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
        } catch (error) {
          logError('Failed to verify permissions', error as Error, {
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
  async connect(token: string): Promise<void> {
    try {
      logger.info('Connecting to Discord...');
      await this.client.login(token);
      logger.info('Discord login successful');
    } catch (error) {
      logError('Failed to connect to Discord', error as Error);

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

      throw new Error(
        `Failed to connect to Discord after ${this.maxReconnectAttempts} attempts`,
      );
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Discord...');
    this.connected = false;
    await this.client.destroy();
    logger.info('Discord client disconnected');
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected && this.client.isReady();
  }

  /**
   * Subscribe to Discord events
   */
  on<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void {
    this.client.on(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Subscribe to Discord events (one-time)
   */
  once<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void {
    this.client.once(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Unsubscribe from Discord events
   */
  off<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void {
    this.client.off(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, content: MessageContent): Promise<Message> {
    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`);
      }

      const message = await (channel as TextChannel).send({
        content: content.content,
        embeds: content.embeds,
        files: content.files,
        components: content.components,
      });

      logger.debug('Message sent', {
        channelId,
        messageId: message.id,
        hasContent: !!content.content,
        embedCount: content.embeds?.length || 0,
        fileCount: content.files?.length || 0,
      });

      return message;
    } catch (error) {
      logError('Failed to send message', error as Error, { channelId });
      throw error;
    }
  }

  /**
   * Delete a message from a channel
   */
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`);
      }

      const message = await (channel as TextChannel).messages.fetch(messageId);
      await message.delete();

      logger.debug('Message deleted', { channelId, messageId });
    } catch (error) {
      logError('Failed to delete message', error as Error, {
        channelId,
        messageId,
      });
      throw error;
    }
  }

  /**
   * Get a message from a channel
   */
  async getMessage(channelId: string, messageId: string): Promise<Message> {
    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`);
      }

      const message = await (channel as TextChannel).messages.fetch(messageId);

      logger.debug('Message fetched', { channelId, messageId });
      return message;
    } catch (error) {
      logError('Failed to fetch message', error as Error, {
        channelId,
        messageId,
      });
      throw error;
    }
  }

  /**
   * Send a direct message to a user
   */
  async sendDirectMessage(userId: string, content: MessageContent): Promise<Message> {
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
    } catch (error) {
      logError('Failed to send direct message', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Ban a user from a guild
   */
  async banUser(guildId: string, userId: string, reason: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      await guild.members.ban(userId, { reason });

      logger.info('User banned', {
        guildId,
        userId,
        reason,
      });
    } catch (error) {
      logError('Failed to ban user', error as Error, {
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
  async kickUser(guildId: string, userId: string, reason: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      await member.kick(reason);

      logger.info('User kicked', {
        guildId,
        userId,
        reason,
      });
    } catch (error) {
      logError('Failed to kick user', error as Error, {
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
  async timeoutUser(
    guildId: string,
    userId: string,
    duration: number,
    reason: string,
  ): Promise<void> {
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
    } catch (error) {
      logError('Failed to timeout user', error as Error, {
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
  async addRole(guildId: string, userId: string, roleId: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      await member.roles.add(roleId);

      logger.info('Role added to user', {
        guildId,
        userId,
        roleId,
      });
    } catch (error) {
      logError('Failed to add role', error as Error, {
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
  async removeRole(guildId: string, userId: string, roleId: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      await member.roles.remove(roleId);

      logger.info('Role removed from user', {
        guildId,
        userId,
        roleId,
      });
    } catch (error) {
      logError('Failed to remove role', error as Error, {
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
  getGuild(guildId: string): Guild | undefined {
    return this.client.guilds.cache.get(guildId);
  }

  /**
   * Get a guild member by ID
   */
  async getMember(guildId: string, userId: string): Promise<GuildMember | null> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      return member;
    } catch (error) {
      logger.debug('Failed to fetch member', {
        guildId,
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }
}
