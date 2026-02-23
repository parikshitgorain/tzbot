/**
 * @file client.ts
 * @description Discord client wrapper with connection management and operations
 * @module core/discord
 */
import { Client, Message, EmbedBuilder, GuildMember, Guild, ClientEvents } from 'discord.js';
/**
 * Message content that can be sent to Discord
 */
export interface MessageContent {
    content?: string;
    embeds?: EmbedBuilder[];
    files?: Array<{
        attachment: string | Buffer;
        name: string;
    }>;
}
/**
 * Discord event types
 */
export type DiscordEvent = keyof ClientEvents;
/**
 * Event handler function type
 */
export type EventHandler<K extends DiscordEvent = DiscordEvent> = (...args: ClientEvents[K]) => void | Promise<void>;
/**
 * Discord client interface for bot operations
 */
export interface IDiscordClient {
    connect(token: string): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    on<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
    once<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
    off<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
    sendMessage(channelId: string, content: MessageContent): Promise<Message>;
    deleteMessage(channelId: string, messageId: string): Promise<void>;
    sendDirectMessage(userId: string, content: MessageContent): Promise<Message>;
    getMessage(channelId: string, messageId: string): Promise<Message>;
    banUser(guildId: string, userId: string, reason: string): Promise<void>;
    kickUser(guildId: string, userId: string, reason: string): Promise<void>;
    timeoutUser(guildId: string, userId: string, duration: number, reason: string): Promise<void>;
    addRole(guildId: string, userId: string, roleId: string): Promise<void>;
    removeRole(guildId: string, userId: string, roleId: string): Promise<void>;
    getGuild(guildId: string): Guild | undefined;
    getMember(guildId: string, userId: string): Promise<GuildMember | null>;
}
/**
 * Discord client wrapper implementation
 */
export declare class DiscordClient implements IDiscordClient {
    client: Client;
    private connected;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    constructor();
    /**
     * Set up internal event handlers for connection management
     */
    private setupInternalEventHandlers;
    /**
     * Connect to Discord with auto-reconnect
     */
    connect(token: string): Promise<void>;
    /**
     * Disconnect from Discord
     */
    disconnect(): Promise<void>;
    /**
     * Check if client is connected
     */
    isConnected(): boolean;
    /**
     * Subscribe to Discord events
     */
    on<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
    /**
     * Subscribe to Discord events (one-time)
     */
    once<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
    /**
     * Unsubscribe from Discord events
     */
    off<K extends DiscordEvent>(event: K, handler: EventHandler<K>): void;
    /**
     * Send a message to a channel
     */
    sendMessage(channelId: string, content: MessageContent): Promise<Message>;
    /**
     * Delete a message from a channel
     */
    deleteMessage(channelId: string, messageId: string): Promise<void>;
    /**
     * Get a message from a channel
     */
    getMessage(channelId: string, messageId: string): Promise<Message>;
    /**
     * Send a direct message to a user
     */
    sendDirectMessage(userId: string, content: MessageContent): Promise<Message>;
    /**
     * Ban a user from a guild
     */
    banUser(guildId: string, userId: string, reason: string): Promise<void>;
    /**
     * Kick a user from a guild
     */
    kickUser(guildId: string, userId: string, reason: string): Promise<void>;
    /**
     * Timeout a user in a guild
     */
    timeoutUser(guildId: string, userId: string, duration: number, reason: string): Promise<void>;
    /**
     * Add a role to a user
     */
    addRole(guildId: string, userId: string, roleId: string): Promise<void>;
    /**
     * Remove a role from a user
     */
    removeRole(guildId: string, userId: string, roleId: string): Promise<void>;
    /**
     * Get a guild by ID
     */
    getGuild(guildId: string): Guild | undefined;
    /**
     * Get a guild member by ID
     */
    getMember(guildId: string, userId: string): Promise<GuildMember | null>;
}
//# sourceMappingURL=client.d.ts.map