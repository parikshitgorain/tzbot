/**
 * @file index.ts
 * @description Main application entry point - wires all components together
 * @module index
 *
 * Task 19.1: Wire all components together
 * - Create main application entry point
 * - Initialize all managers in correct order
 * - Set up event routing between components
 * - Start Discord client
 * - Start Kick chat client
 * - Start webhook server
 * - Start health check system
 *
 * Requirements: All
 */
import { logger, logError } from './core/logger/logger.js';
import { config } from './config/index.js';
import { Database } from './core/database/Database.js';
import { redisClient } from './core/cache/redis.client.js';
import { DiscordClient } from './core/discord/client.js';
import { EventManager } from './managers/event.manager.js';
import { CommandManager } from './managers/command.manager.js';
import { NotificationManager } from './managers/notification.manager.js';
import { GiveawayManager } from './managers/giveaway.manager.js';
// import { ChatRainManager } from './managers/chat-rain.manager.js';
import { AnnouncementRelayManager } from './managers/announcement-relay.manager.js';
// import { RewardSystem } from './managers/reward-system.js';
import { kickChatClient } from './services/kick/chat-client.js';
import { KickWebhookHandler } from './webhooks/kick-webhook.js';
import { WebhookServer } from './webhooks/webhook-server.js';
// import { PollingFallbackSystem } from './webhooks/polling-fallback.js'; // Requires Kick API client
import { HealthCheckSystem } from './core/health/health-check.js';
import { GracefulShutdownManager } from './core/shutdown/shutdown-manager.js';
import { StatePersistenceService } from './core/state/state-persistence.js';
import { SpamDetector } from './moderation/spam-detector.js';
import { LinkScanner } from './moderation/link-scanner.js';
import { ChannelAccessEnforcer } from './moderation/channel-access.js';
import { createModerationCommands } from './commands/moderation.commands.js';
import { createUtilityCommands } from './commands/utility.commands.js';
import { createGiveawayCommands } from './commands/giveaway.commands.js';
import { createAnnouncementCommands } from './commands/announcement.commands.js';
import { EmbedBuilder } from 'discord.js';
import { EventType } from './types/models.js';
/**
 * Main application class
 * Manages initialization and lifecycle of all bot components
 */
class TZBotApplication {
    // Core infrastructure
    database;
    discordClient;
    shutdownManager;
    statePersistence;
    healthCheck;
    // Managers
    eventManager;
    commandManager;
    notificationManager;
    giveawayManager;
    // private chatRainManager!: ChatRainManager; // Initialized but not actively used in event routing yet
    announcementRelay = null; // Optional - only if configured
    // private rewardSystem!: RewardSystem;
    // Moderation
    spamDetector;
    linkScanner;
    channelAccess;
    rateLimiter;
    // External services
    webhookHandler;
    webhookServer;
    // private pollingFallback!: PollingFallbackSystem; // Commented out - needs Kick API client
    // Spam notification batching
    spamNotificationBatch = new Map();
    spamBatchTimer = null;
    SPAM_BATCH_WINDOW_MS = 30000; // 30 seconds
    // Warning cooldown tracking
    warningCooldowns = new Map();
    WARNING_COOLDOWN_MS = 60000; // 1 minute
    // Processing lock to prevent race conditions
    processingOffenses = new Set();
    /**
     * Retry message deletion with exponential backoff
     * Retries with delays: 1s, 2s, 4s, 8s, 16s...
     */
    async deleteMessageWithRetry(message, maxRetries = 5, initialDelayMs = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Check if message still exists and is deletable
                if (!message || !message.deletable) {
                    logger.warn('Message is not deletable or does not exist', {
                        messageId: message?.id,
                        deletable: message?.deletable,
                        attempt,
                    });
                    return false;
                }
                await message.delete();
                logger.debug('Message deleted successfully', {
                    messageId: message.id,
                    attempt,
                });
                return true;
            }
            catch (error) {
                const errorMessage = error.message;
                // Check if message was already deleted
                if (errorMessage.includes('Unknown Message') || errorMessage.includes('10008')) {
                    logger.debug('Message already deleted', {
                        messageId: message?.id,
                        attempt,
                    });
                    return true; // Consider this a success
                }
                // Check if we don't have permission
                if (errorMessage.includes('Missing Permissions') || errorMessage.includes('50013')) {
                    logger.error('Bot lacks permission to delete messages', {
                        messageId: message?.id,
                        error: errorMessage,
                    });
                    return false; // Don't retry if we lack permissions
                }
                logger.warn('Failed to delete message, retrying...', {
                    messageId: message?.id,
                    attempt,
                    maxRetries,
                    error: errorMessage,
                });
                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
                    const delay = initialDelayMs * Math.pow(2, attempt - 1);
                    logger.debug('Waiting before retry', {
                        messageId: message?.id,
                        delayMs: delay,
                        nextAttempt: attempt + 1,
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        logger.error('Failed to delete message after all retries', {
            messageId: message?.id,
            maxRetries,
        });
        return false;
    }
    /**
     * Initialize all bot components in the correct order
     */
    async initialize() {
        logger.info('Initializing TZBOT components...');
        // 1. Initialize shutdown manager first (so we can register cleanup functions)
        await this.initializeShutdownManager();
        // 2. Initialize core infrastructure
        await this.initializeDatabase();
        await this.initializeRedis();
        await this.initializeStatePersistence();
        // 3. Initialize Discord client
        await this.initializeDiscordClient();
        // 4. Initialize managers
        await this.initializeManagers();
        // 5. Initialize moderation systems
        await this.initializeModerationSystems();
        // 6. Initialize external services (Kick integration)
        await this.initializeExternalServices();
        // 7. Initialize health check system
        await this.initializeHealthCheck();
        // 8. Set up event routing
        await this.setupEventRouting();
        // 9. Register slash commands
        await this.registerCommands();
        // 10. Recover state from previous session
        await this.recoverState();
        logger.info('All components initialized successfully');
    }
    /**
     * Add spam notification to batch
     * Notifications are collected for 30 seconds, then sent together
     */
    addSpamNotificationToBatch(notification) {
        // Add or update notification for this user
        this.spamNotificationBatch.set(notification.userId, notification);
        // Start batch timer if not already running
        if (!this.spamBatchTimer) {
            this.spamBatchTimer = setTimeout(() => {
                this.flushSpamNotificationBatch();
            }, this.SPAM_BATCH_WINDOW_MS);
            logger.debug('Started spam notification batch timer', {
                windowMs: this.SPAM_BATCH_WINDOW_MS,
            });
        }
    }
    /**
     * Check if user is in warning cooldown period
     */
    isInWarningCooldown(userId) {
        const cooldown = this.warningCooldowns.get(userId);
        if (!cooldown) {
            return false;
        }
        const now = new Date();
        if (now >= cooldown.expiresAt) {
            // Cooldown expired, remove it
            this.warningCooldowns.delete(userId);
            return false;
        }
        return true;
    }
    /**
     * Start warning cooldown for user
     */
    startWarningCooldown(userId) {
        const expiresAt = new Date(Date.now() + this.WARNING_COOLDOWN_MS);
        this.warningCooldowns.set(userId, {
            expiresAt,
            warningIssued: false,
        });
        logger.debug('Started warning cooldown', {
            userId,
            expiresAt,
            durationMs: this.WARNING_COOLDOWN_MS,
        });
    }
    /**
     * Check if warning has been issued during current cooldown
     */
    hasWarningBeenIssued(userId) {
        const cooldown = this.warningCooldowns.get(userId);
        return cooldown?.warningIssued || false;
    }
    /**
     * Mark warning as issued for current cooldown
     */
    markWarningIssued(userId) {
        const cooldown = this.warningCooldowns.get(userId);
        if (cooldown) {
            cooldown.warningIssued = true;
        }
    }
    /**
     * Flush batched spam notifications
     * Sends one notification per user to mod-log channel
     */
    async flushSpamNotificationBatch() {
        // Clear timer
        this.spamBatchTimer = null;
        // Get all batched notifications
        const notifications = Array.from(this.spamNotificationBatch.values());
        if (notifications.length === 0) {
            return;
        }
        logger.info('Flushing spam notification batch', {
            userCount: notifications.length,
        });
        // Send each user's notification separately
        for (const notification of notifications) {
            try {
                const notificationEvent = {
                    id: `spam-${notification.userId}-${notification.timestamp.getTime()}`,
                    type: EventType.SPAM_DETECTED,
                    channelId: notification.channelId,
                    data: { userId: notification.userId, reason: notification.reason },
                    timestamp: notification.timestamp,
                    delivered: false,
                };
                const embedData = {
                    title: '🚨 Spam Detected',
                    description: `User <@${notification.userId}> was detected spamming in <#${notification.channelId}>`,
                    fields: [
                        { name: 'User', value: `${notification.userTag} (${notification.userId})`, inline: true },
                        { name: 'Punishment', value: notification.punishmentType, inline: true },
                        { name: 'Duration', value: notification.duration ? `${notification.duration}h` : 'N/A', inline: true },
                        { name: 'Reason', value: notification.reason, inline: true },
                        { name: 'Messages Deleted', value: `${notification.deletedCount}`, inline: true },
                        { name: 'Offense Count', value: `${notification.offenseCount}`, inline: true },
                    ],
                    color: notification.punishmentType === 'PERMANENT_BAN' ? 0x000000 : 0xff0000,
                };
                await this.notificationManager.sendNotification(notificationEvent, embedData);
                logger.debug('Sent batched spam notification', {
                    userId: notification.userId,
                    username: notification.username,
                });
            }
            catch (error) {
                logger.error('Failed to send batched spam notification', {
                    error,
                    userId: notification.userId,
                });
            }
        }
        // Clear the batch
        this.spamNotificationBatch.clear();
        logger.info('Spam notification batch flushed', {
            sentCount: notifications.length,
        });
    }
    /**
     * Start all bot services
     */
    async start() {
        logger.info('Starting TZBOT services...');
        // 1. Start Discord client
        await this.discordClient.connect(config.discordToken);
        // 2. Deploy commands to Discord
        await this.deployCommandsToDiscord();
        // 3. Start event manager
        this.eventManager.start();
        // 4. Start Kick chat monitoring (if configured)
        if (config.kickChannelId) {
            await this.startKickChatMonitoring();
        }
        // 5. Start webhook server (if configured)
        if (config.kickWebhookSecret) {
            await this.webhookServer.start();
        }
        // 6. Start polling fallback system (if initialized)
        // if (this.pollingFallback) {
        //   this.pollingFallback.start();
        // }
        // 7. Start health check system
        this.healthCheck.startPeriodicChecks();
        // 8. Start state persistence
        this.statePersistence.startAutoPersistence();
        // 9. Send startup notification to Discord notification channel
        await this.sendStartupNotification();
        logger.info('TZBOT started successfully', {
            discordConnected: this.discordClient.isConnected(),
            kickChatEnabled: !!config.kickChannelId,
            webhookServerEnabled: !!config.kickWebhookSecret,
            healthCheckEnabled: true,
        });
    }
    /**
     * Send a startup notification to the Discord notification channel
     * so admins know the bot has come online after a deployment.
     */
    async sendStartupNotification() {
        try {
            const channelId = config.notificationChannelId;
            if (!channelId) {
                logger.warn('Notification channel not configured, skipping startup notification');
                return;
            }
            // Read version from package.json if available
            let version = 'unknown';
            try {
                const { readFileSync } = await import('fs');
                const { fileURLToPath } = await import('url');
                const { dirname, join } = await import('path');
                const __dirname = dirname(fileURLToPath(import.meta.url));
                const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
                version = pkg.version;
            }
            catch {
                // ignore – version display is non-critical
            }
            const embed = new EmbedBuilder()
                .setTitle('🟢 Bot is Online')
                .setDescription('TZBOT has started successfully and is ready to serve.')
                .addFields({ name: 'Version', value: `v${version}`, inline: true }, { name: 'Environment', value: config.nodeEnv ?? 'production', inline: true })
                .setColor(0x57f287)
                .setTimestamp();
            await this.discordClient.sendMessage(channelId, { embeds: [embed] });
            logger.info('Startup notification sent to Discord');
        }
        catch (error) {
            // Non-fatal: log and continue
            logger.warn('Failed to send startup notification', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Initialize shutdown manager
     */
    async initializeShutdownManager() {
        logger.info('Initializing shutdown manager...');
        this.shutdownManager = new GracefulShutdownManager(logger, 30000);
        this.shutdownManager.setupSignalHandlers();
        // Register cleanup for spam notification batch
        this.shutdownManager.registerCleanup('spam-notification-batch', async () => {
            if (this.spamBatchTimer) {
                clearTimeout(this.spamBatchTimer);
                this.spamBatchTimer = null;
            }
            // Flush any pending notifications
            await this.flushSpamNotificationBatch();
        });
        // Register cleanup for warning cooldowns
        this.shutdownManager.registerCleanup('warning-cooldowns', async () => {
            this.warningCooldowns.clear();
            logger.info('Cleared warning cooldowns', {
                count: this.warningCooldowns.size,
            });
        });
        logger.info('Shutdown manager initialized');
    }
    /**
     * Initialize database connection
     */
    async initializeDatabase() {
        logger.info('Initializing database...');
        // Parse DATABASE_URL from environment
        const databaseUrl = config.databaseUrl;
        if (!databaseUrl) {
            throw new Error('DATABASE_URL not configured');
        }
        // Parse PostgreSQL connection string
        const url = new URL(databaseUrl);
        const dbConfig = {
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            database: url.pathname.slice(1), // Remove leading slash
            user: url.username,
            password: url.password,
            max: 20,
            ssl: { rejectUnauthorized: false }, // Required for Neon
        };
        this.database = new Database();
        await this.database.connect(dbConfig);
        // Load configuration from database (overrides .env values)
        try {
            const dbNotificationChannelId = await this.database.getConfig('notificationChannelId');
            if (dbNotificationChannelId && typeof dbNotificationChannelId === 'string') {
                config.notificationChannelId = dbNotificationChannelId;
                logger.info('Loaded notification channel from database', { channelId: dbNotificationChannelId });
            }
            const dbFallbackChannelId = await this.database.getConfig('fallbackChannelId');
            if (dbFallbackChannelId && typeof dbFallbackChannelId === 'string') {
                config.fallbackChannelId = dbFallbackChannelId;
                logger.info('Loaded fallback channel from database', { channelId: dbFallbackChannelId });
            }
        }
        catch (error) {
            logger.warn('Failed to load config from database, using .env values', { error });
        }
        // Register cleanup
        this.shutdownManager.registerCleanup('database', async () => {
            await this.database.disconnect();
        });
        logger.info('Database initialized');
    }
    /**
     * Initialize Redis cache
     */
    async initializeRedis() {
        // Skip Redis if not configured
        if (!config.redisUrl) {
            logger.info('Redis URL not configured - caching disabled');
            return;
        }
        logger.info('Initializing Redis cache...');
        try {
            await redisClient.connect();
            // Test connectivity
            const isConnected = await redisClient.testConnection();
            if (!isConnected) {
                logger.warn('Redis connection test failed - bot will run without caching');
                return;
            }
            // Register cleanup
            this.shutdownManager.registerCleanup('redis', async () => {
                await redisClient.disconnect();
            });
            logger.info('Redis cache initialized');
        }
        catch (error) {
            logger.warn('Redis initialization failed - bot will run without caching', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Don't throw - Redis is optional
        }
    }
    /**
     * Initialize state persistence service
     */
    async initializeStatePersistence() {
        logger.info('Initializing state persistence...');
        this.statePersistence = new StatePersistenceService({
            stateDir: './data/state',
            stateFile: 'bot-state.json',
            persistIntervalMs: 60000, // 60 seconds
            maxBackups: 5,
        });
        await this.statePersistence.initialize();
        // Register cleanup
        this.shutdownManager.registerCleanup('state-persistence', async () => {
            await this.statePersistence.shutdown();
        });
        logger.info('State persistence initialized');
    }
    /**
     * Initialize Discord client
     */
    async initializeDiscordClient() {
        logger.info('Initializing Discord client...');
        this.discordClient = new DiscordClient();
        // Register cleanup
        this.shutdownManager.registerCleanup('discord', async () => {
            await this.discordClient.disconnect();
        });
        logger.info('Discord client initialized');
    }
    /**
     * Initialize managers
     */
    async initializeManagers() {
        logger.info('Initializing managers...');
        // Event manager
        this.eventManager = new EventManager(this.discordClient, config);
        // Command manager
        this.commandManager = new CommandManager(this.discordClient, config);
        // Notification manager
        this.notificationManager = new NotificationManager(this.discordClient, {
            primaryChannelId: config.notificationChannelId || '',
            fallbackChannelId: config.fallbackChannelId,
            maxRetries: 3,
            retryDelayMs: 5000,
            getChannelId: () => config.notificationChannelId || '', // Dynamic channel ID getter
            getFallbackChannelId: () => config.fallbackChannelId, // Dynamic fallback channel ID getter
        });
        // Reward system
        // this.rewardSystem = new RewardSystem(
        //   this.discordClient as any, // Type mismatch - our wrapper vs Discord.js Client
        //   this.database.repositories.chatActivity,
        //   config.guildId
        // );
        // Chat rain manager
        // this.chatRainManager = new ChatRainManager(
        //   this.database.repositories.chatActivity,
        //   this.database.repositories.violations,
        //   this.rewardSystem,
        //   {
        //     minDelayMinutes: 5,
        //     activeWindowMinutes: 10,
        //     minMessages: 3,
        //     cooldownMinutes: 60,
        //     rewardType: 'announcement', // Default reward type
        //     rewardValue: undefined,
        //   }
        // );
        // Giveaway manager
        this.giveawayManager = new GiveawayManager(this.discordClient, this.database.repositories.giveaways);
        // Initialize giveaway confirmation system
        const { ConfirmationSystem } = await import('./giveaway/confirmation-system.js');
        const { ConfigManager } = await import('./giveaway/config-manager.js');
        const { GiveawayConfigRepository } = await import('./core/database/repositories/GiveawayConfigRepository.js');
        const giveawayConfigRepo = new GiveawayConfigRepository(this.database.getPool());
        const configManager = new ConfigManager(giveawayConfigRepo);
        const confirmationSystem = new ConfirmationSystem(this.database.repositories.winnerState, this.database.repositories.giveaways, configManager);
        // Initialize confirmation system with Discord client
        confirmationSystem.initialize(this.discordClient.client);
        // Set confirmation system and config manager on giveaway manager
        this.giveawayManager.setConfirmationSystem(confirmationSystem);
        this.giveawayManager.setConfigManager(configManager);
        // Restore active confirmations on startup
        await confirmationSystem.restoreActiveConfirmations();
        // Announcement relay manager (optional - only if configured)
        try {
            const privateChannelId = await this.database.getConfig('privateAnnouncementChannelId');
            const publicChannelsStr = await this.database.getConfig('publicAnnouncementChannelIds');
            if (privateChannelId && publicChannelsStr) {
                const publicChannelIds = String(publicChannelsStr).split(',').filter((id) => id.length > 0);
                if (publicChannelIds.length > 0) {
                    this.announcementRelay = new AnnouncementRelayManager(this.discordClient, {
                        privateChannelId: String(privateChannelId),
                        publicChannelIds,
                        guildId: config.guildId,
                        moderatorRoleId: config.moderatorRoleId || '',
                    });
                    this.announcementRelay.start();
                    logger.info('Announcement relay initialized and started', {
                        privateChannel: privateChannelId,
                        publicChannelCount: publicChannelIds.length,
                    });
                }
                else {
                    logger.info('Announcement relay not configured - no public channels specified');
                }
            }
            else {
                logger.info('Announcement relay not configured - use /announcement-setup to configure');
            }
        }
        catch (error) {
            logger.error('Failed to initialize announcement relay - will continue without it', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            // Don't throw - announcement relay is optional
        }
        logger.info('Managers initialized');
    }
    /**
     * Initialize moderation systems
     */
    async initializeModerationSystems() {
        logger.info('Initializing moderation systems...');
        // Spam detector
        this.spamDetector = new SpamDetector({
            identicalMessages: 5,
            identicalWindow: 10, // seconds
            rapidMessages: 5,
            rapidWindow: 10, // seconds
        });
        // Link scanner
        this.linkScanner = new LinkScanner(undefined, // Use default blocklist
        !!config.googleSafeBrowsingApiKey);
        // Channel access controller
        this.channelAccess = new ChannelAccessEnforcer(this.discordClient, this.database.repositories.violations, config.moderatorRoleId || '', []);
        // Channel text rate limiter - ALWAYS initialize (even with empty channels)
        // This allows hot-reload to work when channels are added via commands
        const { ChannelTextRateLimiter } = await import('./moderation/rate-limiter/channel-text-rate-limiter.js');
        const { RedisStateStore, InMemoryStateStore } = await import('./moderation/rate-limiter/state-store.js');
        // Create state store (Redis with in-memory fallback)
        const isRedisConnected = await redisClient.testConnection();
        const stateStore = isRedisConnected
            ? new RedisStateStore(redisClient)
            : new InMemoryStateStore();
        // Convert config object to Map (empty if no channels configured)
        const restrictedChannelsMap = config.rateLimiterRestrictedChannels
            ? new Map(Object.entries(config.rateLimiterRestrictedChannels))
            : new Map();
        this.rateLimiter = new ChannelTextRateLimiter();
        await this.rateLimiter.initialize({
            restrictedChannels: restrictedChannelsMap,
            rateLimitWindowMs: config.rateLimiterWindowMs || 60000,
            violationWindowMs: config.rateLimiterViolationWindowMs || 300000,
            warningDeleteDelayMs: config.rateLimiterWarningDeleteDelayMs || 10000,
            cleanupIntervalMs: config.rateLimiterCleanupIntervalMs || 60000,
        }, {
            discordClient: this.discordClient.client,
            stateStore,
            logger,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configManager: null, // Not used in current implementation
        });
        // Register cleanup
        this.shutdownManager.registerCleanup('rate-limiter', async () => {
            await this.rateLimiter.shutdown();
        });
        if (restrictedChannelsMap.size > 0) {
            logger.info('Channel text rate limiter initialized', {
                restrictedChannels: Array.from(restrictedChannelsMap.keys()),
            });
        }
        else {
            logger.info('Channel text rate limiter initialized (no channels configured yet - use /ratelimit-add to add channels)');
        }
        logger.info('Moderation systems initialized');
    }
    /**
     * Initialize external services (Kick integration)
     */
    async initializeExternalServices() {
        logger.info('Initializing external services...');
        // Webhook handler
        this.webhookHandler = new KickWebhookHandler({
            webhookSecret: config.kickWebhookSecret || '',
            notificationManager: this.notificationManager,
            notificationChannelId: config.notificationChannelId || '',
        });
        // Webhook server
        this.webhookServer = new WebhookServer({
            port: config.webhookPort || 3000,
            host: config.webhookHost || '0.0.0.0',
            webhookPath: '/webhooks/kick',
            requestSizeLimit: '1mb',
            enableRequestLogging: true,
        }, this.webhookHandler);
        // Polling fallback system (requires Kick API client which we don't have initialized yet)
        // This would need proper Kick API integration
        // this.pollingFallback = new PollingFallbackSystem({
        //   kickAPIClient: kickAPIClient,
        //   notificationManager: this.notificationManager,
        //   webhookHandler: this.webhookHandler,
        //   channelId: parseInt(config.kickChannelId || '0'),
        //   notificationChannelId: config.notificationChannelId,
        //   pollingIntervalMs: 10000,
        //   enabled: true,
        // });
        // Register cleanup
        this.shutdownManager.registerCleanup('webhook-server', async () => {
            await this.webhookServer.stop();
        });
        this.shutdownManager.registerCleanup('kick-chat', async () => {
            await kickChatClient.disconnect();
        });
        logger.info('External services initialized');
    }
    /**
     * Initialize health check system
     */
    async initializeHealthCheck() {
        logger.info('Initializing health check system...');
        this.healthCheck = new HealthCheckSystem({
            checkIntervalMs: 30000, // 30 seconds
            alertThreshold: 3,
            adminUserIds: [], // Would need to be configured
        }, logger);
        // Set components to monitor
        // Note: We need to pass the underlying Discord.js client, not our wrapper
        // this.healthCheck.setDiscordClient(this.discordClient);
        this.healthCheck.setDatabase(this.database);
        this.healthCheck.setCache(redisClient);
        logger.info('Health check system initialized');
    }
    /**
     * Handle button interactions (giveaway entries)
     */
    async handleButtonInteraction(interaction) {
        try {
            // Check if this is a giveaway-related button
            if (interaction.customId.startsWith('giveaway_enter_')) {
                await this.giveawayManager.handleEntryInteraction(interaction, interaction.guildId || '');
                logger.debug('Giveaway entry button handled', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    customId: interaction.customId,
                });
            }
            else if (interaction.customId.startsWith('giveaway_view_')) {
                // Handle view participants button
                await this.giveawayManager.handleEntryInteraction(interaction, interaction.guildId || '');
                logger.debug('Giveaway view participants button handled', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    customId: interaction.customId,
                });
            }
        }
        catch (error) {
            logError('Failed to handle button interaction', error, {
                userId: interaction.user.id,
                customId: interaction.customId,
            });
            // Send error message to user
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({
                        content: '❌ An error occurred while processing your request. Please try again.',
                        ephemeral: true,
                    });
                }
                else {
                    await interaction.reply({
                        content: '❌ An error occurred while processing your request. Please try again.',
                        ephemeral: true,
                    });
                }
            }
            catch (replyError) {
                logger.error('Failed to send error message to user', { replyError });
            }
        }
    }
    /**
     * Handle giveaway reroll prefix command
     * Format: gw.reroll <message_id> @user
     * Only works for users with ManageEvents permission
     * Silently ignores if user doesn't have permission
     */
    async handleGiveawayRerollCommand(message) {
        try {
            // Check if user has permission (ManageEvents)
            if (!message.member?.permissions.has('ManageEvents')) {
                // Silently ignore - no error message
                return;
            }
            // Parse command: gw.reroll <message_id> @user
            const parts = message.content.trim().split(/\s+/);
            if (parts.length < 3) {
                // Invalid format - silently ignore
                return;
            }
            const messageId = parts[1];
            const userMention = parts[2];
            // Extract user ID from mention
            const userIdMatch = userMention.match(/^<@!?(\d+)>$/);
            if (!userIdMatch) {
                // Invalid user mention - silently ignore
                return;
            }
            const userId = userIdMatch[1];
            // Find giveaway by message ID
            const giveaway = await this.database.repositories.giveaways.getByMessageId(messageId);
            if (!giveaway) {
                // Giveaway not found - silently ignore
                return;
            }
            // Check if user is a winner
            if (!giveaway.winners || !giveaway.winners.includes(userId)) {
                // User is not a winner - silently ignore
                return;
            }
            // Perform reroll using confirmation system
            const confirmationSystem = this.giveawayManager.getConfirmationSystem();
            if (confirmationSystem) {
                await confirmationSystem.manualReroll(giveaway.id, userId, message.author.id);
                logger.info('Giveaway rerolled via prefix command', {
                    giveawayId: giveaway.id,
                    messageId,
                    originalWinner: userId,
                    moderator: message.author.id,
                });
            }
        }
        catch (error) {
            // Silently log error - no user-facing message
            logger.debug('Failed to handle giveaway reroll command', {
                error: error.message,
                userId: message.author.id,
                content: message.content,
            });
        }
    }
    /**
     * Set up event routing between components
     */
    async setupEventRouting() {
        logger.info('Setting up event routing...');
        // Message events for moderation
        this.eventManager.registerHandler('messageCreate', async (message) => {
            // Skip bot messages
            if (message.author.bot) {
                return;
            }
            // Track operation for graceful shutdown
            const completeOp = this.shutdownManager.trackOperation();
            try {
                // Check for giveaway reroll prefix command (gw.reroll)
                if (message.content.startsWith('gw.reroll ')) {
                    await this.handleGiveawayRerollCommand(message);
                    completeOp();
                    return;
                }
                // Check rate limiter first (if configured)
                if (this.rateLimiter) {
                    const allowed = await this.rateLimiter.handleMessage(message);
                    if (!allowed) {
                        // Message was rate limited and handled by rate limiter
                        completeOp();
                        return;
                    }
                }
                // Record chat activity for chat rain
                if (config.chatRainEnabled) {
                    await this.database.recordChatActivity(message.author.id, new Date());
                }
                // Check spam
                const spamResult = this.spamDetector.checkSpam(message.author.id, message.id, message.content);
                if (spamResult.isSpam) {
                    // Check if user is in warning cooldown FIRST (before processing offense)
                    const inCooldown = this.isInWarningCooldown(message.author.id);
                    if (inCooldown) {
                        // User is in cooldown - delete message instantly WITHOUT recording offense
                        // Check if bot has permission to delete messages
                        if (message.guild && message.channel.isTextBased()) {
                            const botMember = message.guild.members.cache.get(message.client.user?.id || '');
                            const hasPermission = botMember?.permissions.has('ManageMessages');
                            if (!hasPermission) {
                                logger.error('Bot lacks ManageMessages permission - cannot delete spam messages', {
                                    guildId: message.guild.id,
                                    channelId: message.channel.id,
                                });
                            }
                        }
                        try {
                            // Delete the spam message immediately
                            const deleted = await this.deleteMessageWithRetry(message, 5, 1000);
                            if (deleted) {
                                logger.debug('Deleted message from user in warning cooldown', {
                                    userId: message.author.id,
                                    username: message.author.username,
                                    messageId: message.id,
                                });
                            }
                            else {
                                logger.warn('Failed to delete message during cooldown - message may not be deletable', {
                                    userId: message.author.id,
                                    username: message.author.username,
                                    messageId: message.id,
                                    deletable: message.deletable,
                                });
                            }
                        }
                        catch (error) {
                            logger.error('Failed to delete message during cooldown after retries', {
                                error,
                                userId: message.author.id,
                                messageId: message.id,
                            });
                        }
                        // Send warning message only if not already issued in this cooldown period
                        if (!this.hasWarningBeenIssued(message.author.id)) {
                            // Get offense information to show in reminder
                            const { getPool } = await import('./core/database/pool.js');
                            const { OffenseRepository } = await import('./core/database/repositories/OffenseRepository.js');
                            const { PunishmentCalculator } = await import('./moderation/punishment-calculator.js');
                            const pool = getPool();
                            const offenseRepo = new OffenseRepository(pool);
                            const punishmentCalc = new PunishmentCalculator();
                            const offenseRecord = await offenseRepo.getOffenseRecord(message.author.id);
                            const currentOffenseCount = offenseRecord?.total_offenses || 0;
                            const nextPunishment = punishmentCalc.calculatePunishment(currentOffenseCount + 1, 0);
                            // Send DM reminder with details (only once)
                            try {
                                await message.author.send(`<@${message.author.id}> ⚠️ **Cooldown Active - Please Stop Spamming!**\n\n` +
                                    'You are in a 1-minute cooldown. Your messages will be automatically deleted.\n\n' +
                                    `**Current Warnings:** ${currentOffenseCount}\n` +
                                    `**Next Offense:** ${nextPunishment.nextPunishment}\n\n` +
                                    'Please wait for the cooldown to expire before sending messages.');
                                logger.debug('Cooldown reminder DM sent', {
                                    userId: message.author.id,
                                    username: message.author.username,
                                    offenseCount: currentOffenseCount,
                                });
                            }
                            catch (error) {
                                logger.warn('Failed to send cooldown reminder DM', {
                                    userId: message.author.id,
                                    error,
                                });
                            }
                            // Send or update reminder in channel (auto-delete after 3 seconds)
                            if (message.channel.isTextBased() && 'send' in message.channel) {
                                try {
                                    const cooldownData = this.warningCooldowns.get(message.author.id);
                                    const reminderText = `<@${message.author.id}> ⚠️ **Cooldown Active**\n` +
                                        `**Warnings:** ${currentOffenseCount} | **Next Offense:** ${nextPunishment.nextPunishment}\n` +
                                        'Your messages will be deleted for 1 minute. Please stop spamming!';
                                    let cooldownReminder;
                                    // Check if we already have a reminder message
                                    if (cooldownData?.reminderMessageId) {
                                        try {
                                            // Try to fetch and update the existing message
                                            cooldownReminder = await message.channel.messages.fetch(cooldownData.reminderMessageId);
                                            await cooldownReminder.edit(reminderText);
                                            logger.debug('Updated existing cooldown reminder', {
                                                userId: message.author.id,
                                                messageId: cooldownData.reminderMessageId,
                                            });
                                        }
                                        catch {
                                            // Message doesn't exist anymore, create a new one
                                            cooldownReminder = await message.channel.send(reminderText);
                                            // Store the new message ID
                                            if (cooldownData) {
                                                cooldownData.reminderMessageId = cooldownReminder.id;
                                            }
                                            logger.debug('Created new cooldown reminder (old one not found)', {
                                                userId: message.author.id,
                                                newMessageId: cooldownReminder.id,
                                            });
                                        }
                                    }
                                    else {
                                        // No existing reminder, create a new one
                                        cooldownReminder = await message.channel.send(reminderText);
                                        // Store the message ID
                                        if (cooldownData) {
                                            cooldownData.reminderMessageId = cooldownReminder.id;
                                        }
                                        logger.debug('Created new cooldown reminder', {
                                            userId: message.author.id,
                                            messageId: cooldownReminder.id,
                                        });
                                    }
                                    // Calculate delete time AFTER message is sent/updated
                                    const deleteTime = Math.floor(Date.now() / 1000) + 3;
                                    // Edit message to add countdown
                                    try {
                                        await cooldownReminder.edit(reminderText + `\n*This message will be deleted <t:${deleteTime}:R>*`);
                                    }
                                    catch (editError) {
                                        logger.debug('Failed to edit cooldown reminder with countdown', { error: editError });
                                    }
                                    // Delete after 3 seconds with retry (only if this is a new message)
                                    if (!cooldownData?.reminderMessageId || cooldownData.reminderMessageId === cooldownReminder.id) {
                                        setTimeout(async () => {
                                            await this.deleteMessageWithRetry(cooldownReminder, 5, 1000);
                                            // Clear the reminder message ID after deletion
                                            const data = this.warningCooldowns.get(message.author.id);
                                            if (data) {
                                                data.reminderMessageId = undefined;
                                            }
                                        }, 3000);
                                    }
                                }
                                catch (error) {
                                    logger.warn('Failed to send/update channel cooldown reminder', {
                                        userId: message.author.id,
                                        error,
                                    });
                                }
                            }
                            this.markWarningIssued(message.author.id);
                            logger.info('Cooldown reminder sent', {
                                userId: message.author.id,
                                username: message.author.username,
                                offenseCount: currentOffenseCount,
                            });
                        }
                        return; // Don't process offense - just delete and warn
                    }
                    // Not in cooldown - process offense normally
                    // Check if we're already processing an offense for this user (prevent race conditions)
                    if (this.processingOffenses.has(message.author.id)) {
                        logger.debug('Already processing offense for user, skipping duplicate', {
                            userId: message.author.id,
                            username: message.author.username,
                        });
                        // Still delete the message
                        try {
                            await message.delete();
                        }
                        catch (error) {
                            logger.error('Failed to delete message during duplicate processing', { error });
                        }
                        return;
                    }
                    // Mark as processing
                    this.processingOffenses.add(message.author.id);
                    try {
                        // Initialize offense management system
                        const { getPool } = await import('./core/database/pool.js');
                        const { OffenseRepository } = await import('./core/database/repositories/OffenseRepository.js');
                        const { OffenseManager } = await import('./moderation/offense-manager.js');
                        const { PunishmentCalculator, PunishmentType } = await import('./moderation/punishment-calculator.js');
                        const pool = getPool();
                        const offenseRepo = new OffenseRepository(pool);
                        const punishmentCalc = new PunishmentCalculator();
                        // Create a custom notification service that doesn't send channel messages
                        // We handle channel notifications manually below
                        const customNotificationService = {
                            sendPunishmentNotification: async () => ({
                                dmSent: false,
                                ephemeralSent: false,
                                modLogSent: false,
                                failures: [],
                            }),
                        };
                        const offenseManager = new OffenseManager(pool, offenseRepo, punishmentCalc, customNotificationService);
                        // Process offense and get punishment
                        const punishment = await offenseManager.processOffense(message.author.id, 'Spam', 'system', // System-detected spam
                        message.channel.id);
                        // Delete spam messages
                        let deletedCount = 0;
                        try {
                            const recentMessages = await message.channel.messages.fetch({ limit: 100 });
                            const spamWindowMs = 10 * 1000;
                            const windowStart = new Date(message.createdTimestamp - spamWindowMs);
                            const windowEnd = new Date(message.createdTimestamp + 2000);
                            const userMessagesInWindow = recentMessages.filter(msg => msg.author.id === message.author.id &&
                                msg.createdTimestamp >= windowStart.getTime() &&
                                msg.createdTimestamp <= windowEnd.getTime());
                            logger.debug('Messages to delete', {
                                userId: message.author.id,
                                totalMessages: userMessagesInWindow.size,
                                windowStart: windowStart.toISOString(),
                                windowEnd: windowEnd.toISOString(),
                            });
                            // Try bulk delete first (only works for messages < 14 days old)
                            if (userMessagesInWindow.size > 0 && message.channel.type === 0) {
                                try {
                                    const deleted = await message.channel.bulkDelete(userMessagesInWindow, true);
                                    deletedCount = deleted.size;
                                    logger.info('Bulk deleted spam messages', {
                                        userId: message.author.id,
                                        deletedCount,
                                    });
                                }
                                catch (bulkError) {
                                    logger.warn('Bulk delete failed, falling back to individual deletes with retry', {
                                        error: bulkError,
                                        messageCount: userMessagesInWindow.size,
                                    });
                                    // Fallback: delete messages individually with retry
                                    for (const msg of userMessagesInWindow.values()) {
                                        const deleted = await this.deleteMessageWithRetry(msg, 5, 1000);
                                        if (deleted) {
                                            deletedCount++;
                                        }
                                    }
                                    logger.info('Individual delete with retry completed', {
                                        userId: message.author.id,
                                        deletedCount,
                                        totalAttempted: userMessagesInWindow.size,
                                    });
                                }
                            }
                        }
                        catch (error) {
                            logger.error('Failed to delete spam messages', { error });
                        }
                        // Get offense count for notification
                        const offenseRecord = await offenseManager.getOffenseHistory(message.author.id);
                        const offenseCount = offenseRecord?.total_offenses || 0;
                        // Apply punishment based on type
                        if (punishment.type === PunishmentType.WARNING) {
                            // Start warning cooldown period
                            this.startWarningCooldown(message.author.id);
                            // Send warning message to user via DM
                            let dmSent = false;
                            try {
                                await message.author.send(`<@${message.author.id}> ⚠️ **Warning: Spam Detected**\n\n` +
                                    'You have been warned for: Spam\n\n' +
                                    `**Offense Count:** ${offenseCount}\n` +
                                    '**Cooldown:** 1 minute - Your messages will be auto-deleted during this time.\n' +
                                    `**Next Offense:** ${punishment.nextPunishment}`);
                                dmSent = true;
                                logger.info('Warning DM sent successfully', {
                                    userId: message.author.id,
                                    username: message.author.username,
                                });
                            }
                            catch (error) {
                                logger.error('Failed to send warning DM - user may have DMs disabled', {
                                    userId: message.author.id,
                                    username: message.author.username,
                                    error: error.message,
                                });
                            }
                            // Send a single warning in channel (auto-delete after 10 seconds)
                            if (message.channel.isTextBased() && 'send' in message.channel) {
                                try {
                                    // Generate tone-based warning message
                                    let warningText;
                                    if (offenseCount === 1) {
                                        // 1st offense - Friendly
                                        warningText = `<@${message.author.id}> 🚫 Slow down!\nPlease avoid sending too many messages at once.\nNext time you'll receive a final warning.`;
                                    }
                                    else if (offenseCount === 2) {
                                        // 2nd offense - Slightly Serious
                                        warningText = `<@${message.author.id}> ⚠️ Stop spamming.\nYou've been warned before. Please slow down your messages.\nNext offense will result in a 1 hour timeout.`;
                                    }
                                    else {
                                        // 3rd+ offense - Strict/Rude (shouldn't happen as 3+ gets timeout, but just in case)
                                        warningText = `<@${message.author.id}> ⛔ Enough. This is spam.\nStop immediately or you will be timed out.\nContinued spam leads to longer timeouts and permanent ban.`;
                                    }
                                    const channelWarning = await message.channel.send(warningText);
                                    // Wait a moment to ensure message is fully sent
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                    // Calculate delete time AFTER message is sent (10 seconds from NOW)
                                    const deleteTime = Math.floor(Date.now() / 1000) + 10;
                                    // Edit message to add countdown
                                    try {
                                        await channelWarning.edit(warningText + `\n*This message will be deleted <t:${deleteTime}:R>*`);
                                    }
                                    catch (editError) {
                                        logger.debug('Failed to edit warning message with countdown', { error: editError });
                                    }
                                    // Delete the warning message after 10 seconds with exponential backoff retry
                                    setTimeout(async () => {
                                        await this.deleteMessageWithRetry(channelWarning, 5, 1000);
                                    }, 10000);
                                    logger.info('Warning sent in channel', {
                                        userId: message.author.id,
                                        username: message.author.username,
                                        dmSent,
                                    });
                                }
                                catch (error) {
                                    logger.warn('Failed to send channel warning', {
                                        userId: message.author.id,
                                        error,
                                    });
                                }
                            }
                            this.markWarningIssued(message.author.id);
                            logger.info('Warning issued with cooldown', {
                                userId: message.author.id,
                                username: message.author.username,
                                deletedCount,
                                offenseCount,
                                reason: 'Spam',
                                dmSent,
                            });
                        }
                        else if (punishment.type === PunishmentType.TIMEOUT && punishment.duration && message.member) {
                            // Apply timeout
                            const durationMs = punishment.duration * 60 * 60 * 1000; // Convert hours to ms
                            let dmSent = false;
                            try {
                                await message.member.timeout(durationMs, 'Spam');
                                // Send DM notification to user
                                try {
                                    await message.author.send(`<@${message.author.id}> ⏱️ **You Have Been Timed Out**\n\n` +
                                        '**Reason:** Spam\n' +
                                        `**Duration:** ${punishment.duration} hour${punishment.duration > 1 ? 's' : ''}\n` +
                                        `**Total Warnings:** ${offenseCount}\n` +
                                        `**Next Offense:** ${punishment.nextPunishment}\n\n` +
                                        'You will not be able to send messages until the timeout expires.');
                                    dmSent = true;
                                    logger.debug('Timeout DM sent', {
                                        userId: message.author.id,
                                        username: message.author.username,
                                        duration: punishment.duration,
                                    });
                                }
                                catch (dmError) {
                                    logger.warn('Failed to send timeout DM', {
                                        userId: message.author.id,
                                        error: dmError,
                                    });
                                }
                                logger.info('User timed out for spam', {
                                    userId: message.author.id,
                                    username: message.author.username,
                                    duration: punishment.duration,
                                    offenseCount,
                                    reason: 'Spam',
                                    dmSent,
                                });
                                // Send public channel notification (auto-delete after 10 seconds)
                                if (message.channel.isTextBased() && 'send' in message.channel) {
                                    try {
                                        const deleteTime = Math.floor(Date.now() / 1000) + 10;
                                        const publicNotification = await message.channel.send(`<@${message.author.id}> ⏱️ **User Timed Out**\n` +
                                            `**Duration:** ${punishment.duration} hour${punishment.duration > 1 ? 's' : ''}\n` +
                                            '**Reason:** Spam\n' +
                                            `*This message will be deleted <t:${deleteTime}:R>*`);
                                        // Delete after 10 seconds
                                        setTimeout(async () => {
                                            await this.deleteMessageWithRetry(publicNotification, 5, 1000);
                                        }, 10000);
                                        logger.debug('Timeout public notification sent', {
                                            userId: message.author.id,
                                            messageId: publicNotification.id,
                                        });
                                    }
                                    catch (notifError) {
                                        logger.warn('Failed to send timeout public notification', {
                                            userId: message.author.id,
                                            error: notifError,
                                        });
                                    }
                                }
                            }
                            catch (error) {
                                logger.error('Failed to timeout user', { error });
                            }
                        }
                        else if (punishment.type === PunishmentType.PERMANENT_BAN && message.member) {
                            // Apply ban
                            let dmSent = false;
                            // Send DM notification BEFORE banning (can't DM after ban)
                            try {
                                await message.author.send(`<@${message.author.id}> 🔨 **You Have Been Permanently Banned**\n\n` +
                                    '**Reason:** Repeated spam violations\n' +
                                    `**Total Warnings:** ${offenseCount}\n\n` +
                                    'You have been permanently banned from this server for continued spam behavior.');
                                dmSent = true;
                                logger.debug('Ban DM sent', {
                                    userId: message.author.id,
                                    username: message.author.username,
                                });
                            }
                            catch (dmError) {
                                logger.warn('Failed to send ban DM', {
                                    userId: message.author.id,
                                    error: dmError,
                                });
                            }
                            try {
                                await message.member.ban({
                                    reason: 'Spam',
                                    deleteMessageSeconds: 60 * 60 * 24, // Delete last 24 hours of messages
                                });
                                logger.info('User banned for repeated spam', {
                                    userId: message.author.id,
                                    username: message.author.username,
                                    offenseCount,
                                    reason: 'Spam',
                                    dmSent,
                                });
                                // Send public channel notification (auto-delete after 10 seconds)
                                if (message.channel.isTextBased() && 'send' in message.channel) {
                                    try {
                                        const deleteTime = Math.floor(Date.now() / 1000) + 10;
                                        const publicNotification = await message.channel.send(`<@${message.author.id}> 🔨 **User Permanently Banned**\n` +
                                            '**Reason:** Repeated spam violations\n' +
                                            `*This message will be deleted <t:${deleteTime}:R>*`);
                                        // Delete after 10 seconds
                                        setTimeout(async () => {
                                            await this.deleteMessageWithRetry(publicNotification, 5, 1000);
                                        }, 10000);
                                        logger.debug('Ban public notification sent', {
                                            userId: message.author.id,
                                            messageId: publicNotification.id,
                                        });
                                    }
                                    catch (notifError) {
                                        logger.warn('Failed to send ban public notification', {
                                            userId: message.author.id,
                                            error: notifError,
                                        });
                                    }
                                }
                            }
                            catch (error) {
                                logger.error('Failed to ban user', { error });
                            }
                        }
                        // Add to batch instead of sending immediately (only for timeout/ban, not warnings)
                        if (punishment.type !== PunishmentType.WARNING) {
                            this.addSpamNotificationToBatch({
                                userId: message.author.id,
                                username: message.author.username,
                                userTag: message.author.tag,
                                channelId: message.channel.id,
                                punishmentType: punishment.type,
                                duration: punishment.duration,
                                reason: 'Spam',
                                deletedCount,
                                offenseCount,
                                timestamp: new Date(),
                            });
                            logger.debug('Added spam notification to batch', {
                                userId: message.author.id,
                                username: message.author.username,
                                batchSize: this.spamNotificationBatch.size,
                            });
                        }
                    }
                    finally {
                        // Remove processing lock
                        this.processingOffenses.delete(message.author.id);
                    }
                    return;
                }
                // Check for malicious links
                const isModerator = message.member?.roles.cache.has(config.moderatorRoleId || '') || false;
                const linkScanResult = await this.linkScanner.scanMessage(message.content, message.author.id, isModerator);
                if (linkScanResult.isMalicious) {
                    // Initialize offense management system
                    const { getPool } = await import('./core/database/pool.js');
                    const { OffenseRepository } = await import('./core/database/repositories/OffenseRepository.js');
                    const { OffenseManager } = await import('./moderation/offense-manager.js');
                    const { PunishmentCalculator, PunishmentType } = await import('./moderation/punishment-calculator.js');
                    const pool = getPool();
                    const offenseRepo = new OffenseRepository(pool);
                    const punishmentCalc = new PunishmentCalculator();
                    // Create a custom notification service that doesn't send channel messages
                    // We handle notifications manually for consistency
                    const customNotificationService = {
                        sendPunishmentNotification: async () => ({
                            dmSent: false,
                            ephemeralSent: false,
                            modLogSent: false,
                            failures: [],
                        }),
                    };
                    const offenseManager = new OffenseManager(pool, offenseRepo, punishmentCalc, customNotificationService);
                    // Process offense and get punishment
                    const punishment = await offenseManager.processOffense(message.author.id, 'Malicious link detected', 'system', // System-detected malicious link
                    message.channel.id);
                    // Delete the message
                    await message.delete().catch(() => {
                        logger.warn('Failed to delete malicious link message', { messageId: message.id });
                    });
                    // Apply punishment based on type
                    if (punishment.type === PunishmentType.TIMEOUT && punishment.duration && message.member) {
                        // Apply timeout
                        const durationMs = punishment.duration * 60 * 60 * 1000; // Convert hours to ms
                        try {
                            await message.member.timeout(durationMs, 'Malicious link detected');
                            logger.info('User timed out for malicious link', {
                                userId: message.author.id,
                                username: message.author.username,
                                duration: punishment.duration,
                            });
                        }
                        catch (error) {
                            logger.error('Failed to timeout user', { error });
                        }
                    }
                    else if (punishment.type === PunishmentType.PERMANENT_BAN && message.member) {
                        // Apply ban
                        try {
                            await message.member.ban({
                                reason: 'Malicious link detected - repeated offenses',
                                deleteMessageSeconds: 60 * 60 * 24, // Delete last 24 hours of messages
                            });
                            logger.info('User banned for repeated malicious links', {
                                userId: message.author.id,
                                username: message.author.username,
                            });
                        }
                        catch (error) {
                            logger.error('Failed to ban user', { error });
                        }
                    }
                    // Get offense count for notification
                    const offenseRecord = await offenseManager.getOffenseHistory(message.author.id);
                    const offenseCount = offenseRecord?.total_offenses || 0;
                    // Notify moderators
                    const notificationEvent = {
                        id: `malicious-link-${message.author.id}-${Date.now()}`,
                        type: EventType.MALICIOUS_LINK_DETECTED,
                        channelId: message.channel.id,
                        data: { userId: message.author.id },
                        timestamp: new Date(),
                        delivered: false,
                    };
                    const embedData = {
                        title: '🔗 Malicious Link Detected',
                        description: `User <@${message.author.id}> posted a malicious link in <#${message.channel.id}>`,
                        fields: [
                            { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                            { name: 'Punishment', value: punishment.type, inline: true },
                            { name: 'Duration', value: punishment.duration ? `${punishment.duration}h` : 'N/A', inline: true },
                            { name: 'Offense Count', value: `${offenseCount}`, inline: true },
                        ],
                        color: 0xff6600,
                    };
                    await this.notificationManager.sendNotification(notificationEvent, embedData);
                    logger.info('Malicious link detected and handled', {
                        userId: message.author.id,
                        username: message.author.username,
                        channelId: message.channel.id,
                    });
                    return;
                }
                // Check channel access
                if (message.guild) {
                    const accessResult = await this.channelAccess.checkAccess(message);
                    if (!accessResult.isAuthorized) {
                        await message.delete();
                        await message.author.send(`<@${message.author.id}> Your message in <#${message.channel.id}> was deleted because you don't have permission to post in that channel.`).catch(() => {
                            // Ignore DM failures
                        });
                        return;
                    }
                }
                // Announcement relay handles its own messageCreate events
                // No need to call it here - it's already listening via discordClient.on('messageCreate')
            }
            catch (error) {
                logger.error('Error processing message event', { error });
            }
            finally {
                completeOp();
            }
        }, 50); // Priority 50
        // Interaction events for commands and buttons
        this.eventManager.registerHandler('interactionCreate', async (interaction) => {
            const completeOp = this.shutdownManager.trackOperation();
            try {
                // Handle slash commands
                if (interaction.isCommand()) {
                    await this.commandManager.handleInteraction(interaction);
                }
                // Handle button interactions (giveaway entries)
                if (interaction.isButton()) {
                    await this.handleButtonInteraction(interaction);
                }
            }
            catch (error) {
                logger.error('Error handling interaction', { error });
            }
            finally {
                completeOp();
            }
        }, 60); // Priority 60
        // Guild member add for welcome messages (if configured)
        this.eventManager.registerHandler('guildMemberAdd', async (member) => {
            logger.info('New member joined', {
                userId: member.id,
                username: member.user.username,
                guildId: member.guild.id,
            });
        }, 30);
        logger.info('Event routing configured');
    }
    /**
     * Register slash commands
     */
    async registerCommands() {
        logger.info('Registering slash commands...');
        // Register moderation commands (pass rate limiter for hot-reload support)
        const modCommands = createModerationCommands(this.discordClient, this.database, this.rateLimiter);
        this.commandManager.registerCommands(modCommands);
        // Register utility commands
        const utilCommands = createUtilityCommands(this.discordClient, this.database, config);
        this.commandManager.registerCommands(utilCommands);
        // Register giveaway commands
        const giveawayCommands = createGiveawayCommands(this.discordClient, this.giveawayManager);
        this.commandManager.registerCommands(giveawayCommands);
        // Register announcement commands
        const announcementCommands = createAnnouncementCommands(this.discordClient, this.database, this.announcementRelay);
        this.commandManager.registerCommands(announcementCommands);
        logger.info('Slash commands registered');
    }
    /**
     * Deploy commands to Discord (called after connection)
     */
    async deployCommandsToDiscord() {
        logger.info('Deploying commands to Discord...');
        // Wait for Discord client to be ready
        let retries = 0;
        while (!this.discordClient.isConnected() && retries < 10) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries++;
        }
        if (!this.discordClient.isConnected()) {
            throw new Error('Discord client not connected after 10 seconds');
        }
        // Deploy commands (requires client ID from config)
        if (config.clientId) {
            await this.commandManager.deployCommands(config.discordToken, config.clientId);
            logger.info('Commands deployed to Discord');
        }
        else {
            logger.warn('Client ID not configured, skipping command deployment');
        }
    }
    /**
     * Recover state from previous session
     */
    async recoverState() {
        logger.info('Recovering state from previous session...');
        const state = await this.statePersistence.recoverState();
        if (!state) {
            logger.info('No previous state found, starting fresh');
            return;
        }
        // Recover chat rain state
        if (state.data.chatRain) {
            logger.info('Recovering chat rain state');
            // Chat rain manager will use the persisted last execution time
        }
        // Recover notification queue
        if (state.data.notificationQueue) {
            logger.info('Recovering notification queue', {
                queueSize: state.data.notificationQueue.length,
            });
            // Notification manager will handle retry automatically
        }
        // Validate and clean notification queue (remove stale/invalid notifications)
        logger.info('Validating and cleaning notification queue');
        this.notificationManager.validateAndCleanQueue();
        logger.info('Notification queue validation complete');
        // Recover active giveaways
        if (state.data.activeGiveaways && config.guildId) {
            logger.info('Recovering active giveaways', {
                count: state.data.activeGiveaways.length,
            });
            await this.giveawayManager.recoverActiveGiveaways(config.guildId);
        }
        logger.info('State recovery complete');
    }
    /**
     * Start Kick chat monitoring
     */
    async startKickChatMonitoring() {
        logger.info('Starting Kick chat monitoring...');
        await kickChatClient.connect({
            channelId: config.kickChannelId,
            onMessage: async (message) => {
                logger.debug('Kick chat message received', {
                    username: message.username,
                    badges: message.badges.map(b => b.type),
                });
            },
            onSubscriberDetected: async (username, months) => {
                logger.info('Subscriber detected in Kick chat', { username, months });
                // Handle role sync here
            },
            onVIPDetected: async (username) => {
                logger.info('VIP detected in Kick chat', { username });
                // Handle role sync here
            },
            onConnectionChange: (state) => {
                logger.info('Kick chat connection state changed', { state });
            },
            onError: (error) => {
                logger.error('Kick chat error', { error });
            },
        });
        logger.info('Kick chat monitoring started');
    }
}
/**
 * Main entry point
 */
async function main() {
    try {
        logger.info('Starting TZBOT Discord Bot...');
        logger.info('Configuration loaded', {
            nodeEnv: config.nodeEnv,
            guildId: config.guildId,
            aiEnabled: config.aiEnabled,
            chatRainEnabled: config.chatRainEnabled,
        });
        // Create and initialize application
        const app = new TZBotApplication();
        await app.initialize();
        // Start all services
        await app.start();
        logger.info('TZBOT is now running!');
    }
    catch (error) {
        logger.error('CRITICAL: Failed to start TZBOT - Bot will exit', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    }
}
// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
    logger.error('UNCAUGHT EXCEPTION - Bot will continue running', {
        error: error.message,
        stack: error.stack,
    });
    // Send critical error notification to Discord webhook
    sendCriticalErrorWebhook('Uncaught Exception', error).catch(err => {
        logger.error('Failed to send critical error webhook', { err });
    });
    // Don't exit - let the bot continue running
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED PROMISE REJECTION - Bot will continue running', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: String(promise),
    });
    // Send critical error notification to Discord webhook
    const error = reason instanceof Error ? reason : new Error(String(reason));
    sendCriticalErrorWebhook('Unhandled Promise Rejection', error).catch(err => {
        logger.error('Failed to send critical error webhook', { err });
    });
    // Don't exit - let the bot continue running
});
/**
 * Send critical error notification to Discord webhook
 * This alerts admins when the bot encounters critical errors
 */
async function sendCriticalErrorWebhook(errorType, error) {
    try {
        const webhookUrl = config.discordWebhookUrl;
        if (!webhookUrl) {
            logger.debug('Discord webhook URL not configured, skipping critical error notification');
            return;
        }
        // Get version
        let version = 'unknown';
        try {
            const { readFileSync } = await import('fs');
            const { fileURLToPath } = await import('url');
            const { dirname, join } = await import('path');
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
            version = pkg.version;
        }
        catch {
            // ignore
        }
        // Get hostname
        const hostname = process.env.HOSTNAME || 'unknown';
        // Truncate error stack if too long
        let errorStack = error.stack || error.message;
        if (errorStack.length > 1000) {
            errorStack = errorStack.substring(0, 1000) + '...\n[truncated]';
        }
        // Escape for JSON
        const escapeJson = (str) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const payload = {
            embeds: [{
                    title: `🔴 Critical Error: ${errorType}`,
                    description: `The bot encountered a critical error but is still running.`,
                    color: 15158332, // Red
                    fields: [
                        { name: 'Service', value: '`tzbot`', inline: true },
                        { name: 'Hostname', value: `\`${hostname}\``, inline: true },
                        { name: 'Version', value: `\`v${version}\``, inline: true },
                        { name: 'Error Type', value: errorType, inline: true },
                        { name: 'Error Message', value: `\`${escapeJson(error.message)}\``, inline: false },
                        { name: 'Stack Trace', value: `\`\`\`\n${escapeJson(errorStack)}\n\`\`\``, inline: false },
                    ],
                    timestamp: new Date().toISOString(),
                }],
        };
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            logger.error('Failed to send critical error webhook', {
                status: response.status,
                statusText: response.statusText,
            });
        }
        else {
            logger.info('Critical error webhook sent successfully', { errorType });
        }
    }
    catch (webhookError) {
        logger.error('Error sending critical error webhook', {
            error: webhookError instanceof Error ? webhookError.message : String(webhookError),
        });
    }
}
// Start the application
main();
//# sourceMappingURL=index.js.map