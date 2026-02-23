/**
 * @file command.manager.ts
 * @description Command manager for slash command registration and handling
 * @module managers
 */
import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import type { IDiscordClient } from '../core/discord/client.js';
import type { BotConfig } from '../config/types.js';
/**
 * Command handler function type
 */
export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;
/**
 * Command cooldown configuration
 */
export interface CommandCooldown {
    duration: number;
    perUser: boolean;
}
/**
 * Command definition
 */
export interface CommandDefinition {
    name: string;
    description: string;
    builder: SlashCommandBuilder;
    handler: CommandHandler;
    permissions?: bigint[];
    cooldown?: CommandCooldown;
    moderatorOnly?: boolean;
}
/**
 * Command manager interface
 */
export interface ICommandManager {
    registerCommand(command: CommandDefinition): void;
    registerCommands(commands: CommandDefinition[]): void;
    deployCommands(token: string, clientId: string): Promise<void>;
    handleInteraction(interaction: CommandInteraction): Promise<void>;
    validatePermissions(interaction: CommandInteraction, requiredPermissions: bigint[]): boolean;
    checkCooldown(commandName: string, userId: string): boolean;
    setCooldown(commandName: string, userId: string, duration: number): void;
    clearCooldown(commandName: string, userId?: string): void;
    getCommand(name: string): CommandDefinition | undefined;
    getAllCommands(): CommandDefinition[];
}
/**
 * Command manager implementation
 */
export declare class CommandManager implements ICommandManager {
    private config;
    private commands;
    private cooldowns;
    private cooldownCleanupInterval;
    constructor(_client: IDiscordClient, config: BotConfig);
    /**
     * Register a single command
     */
    registerCommand(command: CommandDefinition): void;
    /**
     * Register multiple commands
     */
    registerCommands(commands: CommandDefinition[]): void;
    /**
     * Deploy commands to Discord
     */
    deployCommands(token: string, clientId: string): Promise<void>;
    /**
     * Handle command interaction
     */
    handleInteraction(interaction: CommandInteraction): Promise<void>;
    /**
     * Validate user permissions
     */
    validatePermissions(interaction: CommandInteraction, requiredPermissions: bigint[]): boolean;
    /**
     * Check if user is a moderator
     */
    private isModerator;
    /**
     * Check if command is on cooldown for user
     */
    checkCooldown(commandName: string, userId: string): boolean;
    /**
     * Set cooldown for command
     */
    setCooldown(commandName: string, userId: string, duration: number): void;
    /**
     * Clear cooldown for command
     */
    clearCooldown(commandName: string, userId?: string): void;
    /**
     * Get command by name
     */
    getCommand(name: string): CommandDefinition | undefined;
    /**
     * Get all registered commands
     */
    getAllCommands(): CommandDefinition[];
    /**
     * Start cooldown cleanup interval
     */
    private startCooldownCleanup;
    /**
     * Stop cooldown cleanup interval
     */
    stopCooldownCleanup(): void;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
//# sourceMappingURL=command.manager.d.ts.map