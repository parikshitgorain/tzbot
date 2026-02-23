/**
 * @file command.manager.ts
 * @description Command manager for slash command registration and handling
 * @module managers
 */
import { REST, Routes, PermissionFlagsBits, } from 'discord.js';
import { logger, logError } from '../core/logger/logger.js';
/**
 * Command manager implementation
 */
export class CommandManager {
    config;
    commands = new Map();
    cooldowns = new Map();
    cooldownCleanupInterval = null;
    constructor(_client, config) {
        this.config = config;
        // Start cooldown cleanup interval (every 60 seconds)
        this.startCooldownCleanup();
        logger.info('CommandManager initialized');
    }
    /**
     * Register a single command
     */
    registerCommand(command) {
        if (this.commands.has(command.name)) {
            logger.warn('Command already registered, overwriting', {
                commandName: command.name,
            });
        }
        this.commands.set(command.name, command);
        logger.info('Command registered', {
            name: command.name,
            description: command.description,
            moderatorOnly: command.moderatorOnly || false,
            hasCooldown: !!command.cooldown,
        });
    }
    /**
     * Register multiple commands
     */
    registerCommands(commands) {
        for (const command of commands) {
            this.registerCommand(command);
        }
        logger.info('Multiple commands registered', {
            count: commands.length,
        });
    }
    /**
     * Deploy commands to Discord
     */
    async deployCommands(token, clientId) {
        try {
            logger.info('Deploying commands to Discord...', {
                commandCount: this.commands.size,
                guildId: this.config.guildId,
            });
            const rest = new REST({ version: '10' }).setToken(token);
            // Convert command definitions to JSON
            const commandsJson = [];
            for (const command of this.commands.values()) {
                commandsJson.push(command.builder.toJSON());
            }
            // Deploy commands (guild-specific for faster updates during development)
            if (this.config.guildId) {
                await rest.put(Routes.applicationGuildCommands(clientId, this.config.guildId), { body: commandsJson });
                logger.info('Commands deployed to guild', {
                    guildId: this.config.guildId,
                    commandCount: commandsJson.length,
                });
            }
            else {
                // Deploy globally (takes up to 1 hour to propagate)
                await rest.put(Routes.applicationCommands(clientId), {
                    body: commandsJson,
                });
                logger.info('Commands deployed globally', {
                    commandCount: commandsJson.length,
                });
            }
        }
        catch (error) {
            logError('Failed to deploy commands', error, {
                additionalContext: {
                    commandCount: this.commands.size,
                },
            });
            throw error;
        }
    }
    /**
     * Handle command interaction
     */
    async handleInteraction(interaction) {
        // Only handle chat input commands
        if (!interaction.isChatInputCommand()) {
            return;
        }
        const commandName = interaction.commandName;
        const command = this.commands.get(commandName);
        if (!command) {
            logger.warn('Unknown command received', { commandName });
            await interaction.reply({
                content: 'Unknown command.',
                ephemeral: true,
            });
            return;
        }
        try {
            // Check moderator-only restriction
            if (command.moderatorOnly && !this.isModerator(interaction)) {
                logger.warn('Non-moderator attempted to use moderator command', {
                    commandName,
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });
                await interaction.reply({
                    content: 'This command is only available to moderators.',
                    ephemeral: true,
                });
                return;
            }
            // Validate permissions
            if (command.permissions && command.permissions.length > 0) {
                if (!this.validatePermissions(interaction, command.permissions)) {
                    logger.warn('User lacks required permissions for command', {
                        commandName,
                        userId: interaction.user.id,
                        requiredPermissions: command.permissions.map((p) => p.toString()),
                    });
                    await interaction.reply({
                        content: 'You do not have permission to use this command.',
                        ephemeral: true,
                    });
                    return;
                }
            }
            // Check cooldown
            if (command.cooldown) {
                const onCooldown = this.checkCooldown(commandName, interaction.user.id);
                if (onCooldown) {
                    const cooldownKey = command.cooldown.perUser
                        ? `${commandName}:${interaction.user.id}`
                        : commandName;
                    const entry = this.cooldowns.get(cooldownKey);
                    const remainingSeconds = entry
                        ? Math.ceil((entry.expiresAt - Date.now()) / 1000)
                        : 0;
                    logger.debug('Command on cooldown', {
                        commandName,
                        userId: interaction.user.id,
                        remainingSeconds,
                    });
                    await interaction.reply({
                        content: `This command is on cooldown. Please wait ${remainingSeconds} seconds.`,
                        ephemeral: true,
                    });
                    return;
                }
                // Set cooldown
                this.setCooldown(commandName, interaction.user.id, command.cooldown.duration);
            }
            // Execute command handler
            logger.info('Executing command', {
                commandName,
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: interaction.guildId,
            });
            await command.handler(interaction);
            logger.debug('Command executed successfully', {
                commandName,
                userId: interaction.user.id,
            });
        }
        catch (error) {
            logError('Error executing command', error, {
                additionalContext: {
                    commandName,
                    userId: interaction.user.id,
                },
            });
            // Send error message to user with proper error handling
            try {
                const errorMessage = 'An error occurred while executing this command.';
                if (interaction.replied) {
                    // Already replied, try followUp
                    await interaction.followUp({
                        content: errorMessage,
                        ephemeral: true,
                    });
                }
                else if (interaction.deferred) {
                    // Deferred but not replied, use editReply
                    await interaction.editReply({
                        content: errorMessage,
                    });
                }
                else {
                    // Not replied or deferred, use reply
                    await interaction.reply({
                        content: errorMessage,
                        ephemeral: true,
                    });
                }
            }
            catch (replyError) {
                // If we can't respond (token expired, already acknowledged, etc.), just log it
                logger.error('Failed to send error response to user', {
                    error: replyError,
                    originalError: error,
                    interactionState: {
                        replied: interaction.replied,
                        deferred: interaction.deferred,
                    },
                });
            }
        }
    }
    /**
     * Validate user permissions
     */
    validatePermissions(interaction, requiredPermissions) {
        if (!interaction.guild || !interaction.member) {
            return false;
        }
        // Get member permissions
        const member = interaction.member;
        if (!member || typeof member.permissions === 'string') {
            return false;
        }
        const memberPermissions = member.permissions;
        // Check if user has all required permissions
        for (const permission of requiredPermissions) {
            if (!memberPermissions.has(permission)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Check if user is a moderator
     */
    isModerator(interaction) {
        if (!interaction.guild || !interaction.member) {
            return false;
        }
        const member = interaction.member;
        if (!member || typeof member.permissions === 'string') {
            return false;
        }
        // Check if user has moderator role or admin permissions
        const hasModRole = 'roles' in member &&
            member.roles instanceof Object &&
            'cache' in member.roles &&
            this.config.moderatorRoleId &&
            member.roles.cache.has(this.config.moderatorRoleId);
        const hasAdminPerms = member.permissions.has(PermissionFlagsBits.Administrator);
        return hasModRole || hasAdminPerms;
    }
    /**
     * Check if command is on cooldown for user
     */
    checkCooldown(commandName, userId) {
        const command = this.commands.get(commandName);
        if (!command || !command.cooldown) {
            return false;
        }
        const cooldownKey = command.cooldown.perUser
            ? `${commandName}:${userId}`
            : commandName;
        const entry = this.cooldowns.get(cooldownKey);
        if (!entry) {
            return false;
        }
        // Check if cooldown has expired
        if (Date.now() >= entry.expiresAt) {
            this.cooldowns.delete(cooldownKey);
            return false;
        }
        return true;
    }
    /**
     * Set cooldown for command
     */
    setCooldown(commandName, userId, duration) {
        const command = this.commands.get(commandName);
        if (!command || !command.cooldown) {
            return;
        }
        const cooldownKey = command.cooldown.perUser
            ? `${commandName}:${userId}`
            : commandName;
        const entry = {
            userId: command.cooldown.perUser ? userId : undefined,
            commandName,
            expiresAt: Date.now() + duration,
        };
        this.cooldowns.set(cooldownKey, entry);
        logger.debug('Cooldown set', {
            commandName,
            userId: command.cooldown.perUser ? userId : 'global',
            durationMs: duration,
        });
    }
    /**
     * Clear cooldown for command
     */
    clearCooldown(commandName, userId) {
        if (userId) {
            const cooldownKey = `${commandName}:${userId}`;
            this.cooldowns.delete(cooldownKey);
            logger.debug('User cooldown cleared', { commandName, userId });
        }
        else {
            // Clear all cooldowns for this command
            const keysToDelete = [];
            for (const [key, entry] of this.cooldowns.entries()) {
                if (entry.commandName === commandName) {
                    keysToDelete.push(key);
                }
            }
            for (const key of keysToDelete) {
                this.cooldowns.delete(key);
            }
            logger.debug('Command cooldowns cleared', {
                commandName,
                clearedCount: keysToDelete.length,
            });
        }
    }
    /**
     * Get command by name
     */
    getCommand(name) {
        return this.commands.get(name);
    }
    /**
     * Get all registered commands
     */
    getAllCommands() {
        return Array.from(this.commands.values());
    }
    /**
     * Start cooldown cleanup interval
     */
    startCooldownCleanup() {
        this.cooldownCleanupInterval = setInterval(() => {
            const now = Date.now();
            const keysToDelete = [];
            for (const [key, entry] of this.cooldowns.entries()) {
                if (now >= entry.expiresAt) {
                    keysToDelete.push(key);
                }
            }
            for (const key of keysToDelete) {
                this.cooldowns.delete(key);
            }
            if (keysToDelete.length > 0) {
                logger.debug('Expired cooldowns cleaned up', {
                    count: keysToDelete.length,
                });
            }
        }, 60000); // Run every 60 seconds
        logger.debug('Cooldown cleanup interval started');
    }
    /**
     * Stop cooldown cleanup interval
     */
    stopCooldownCleanup() {
        if (this.cooldownCleanupInterval) {
            clearInterval(this.cooldownCleanupInterval);
            this.cooldownCleanupInterval = null;
            logger.debug('Cooldown cleanup interval stopped');
        }
    }
    /**
     * Cleanup resources
     */
    destroy() {
        this.stopCooldownCleanup();
        this.commands.clear();
        this.cooldowns.clear();
        logger.info('CommandManager destroyed');
    }
}
//# sourceMappingURL=command.manager.js.map