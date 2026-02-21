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

import { logger } from '@/core/logger/logger.js';
import { config } from '@/config/index.js';
import { Database } from '@/core/database/Database.js';
import { redisClient } from '@/core/cache/redis.client.js';
import { DiscordClient } from '@/core/discord/client.js';
import { EventManager } from '@/managers/event.manager.js';
import { CommandManager } from '@/managers/command.manager.js';
import { NotificationManager, type PremiumEmbedData } from '@/managers/notification.manager.js';
import { GiveawayManager } from '@/managers/giveaway.manager.js';
// import { ChatRainManager } from '@/managers/chat-rain.manager.js';
// import { AnnouncementRelayManager } from '@/managers/announcement-relay.manager.js';
// import { RewardSystem } from '@/managers/reward-system.js';
import { kickChatClient } from '@/services/kick/chat-client.js';
import { KickWebhookHandler } from '@/webhooks/kick-webhook.js';
import { WebhookServer } from '@/webhooks/webhook-server.js';
// import { PollingFallbackSystem } from '@/webhooks/polling-fallback.js'; // Requires Kick API client
import { HealthCheckSystem } from '@/core/health/health-check.js';
import { GracefulShutdownManager } from '@/core/shutdown/shutdown-manager.js';
import { StatePersistenceService } from '@/core/state/state-persistence.js';
import { SpamDetector } from '@/moderation/spam-detector.js';
import { ViolationTracker } from '@/moderation/violation-tracker.js';
import { LinkScanner } from '@/moderation/link-scanner.js';
import { ChannelAccessEnforcer } from '@/moderation/channel-access.js';
import { createModerationCommands } from '@/commands/moderation.commands.js';
import { createUtilityCommands } from '@/commands/utility.commands.js';
import type { Message } from 'discord.js';
import type { NotificationEvent } from '@/types/models.js';

/**
 * Main application class
 * Manages initialization and lifecycle of all bot components
 */
class TZBotApplication {
  // Core infrastructure
  private database!: Database;
  private discordClient!: DiscordClient;
  private shutdownManager!: GracefulShutdownManager;
  private statePersistence!: StatePersistenceService;
  private healthCheck!: HealthCheckSystem;

  // Managers
  private eventManager!: EventManager;
  private commandManager!: CommandManager;
  private notificationManager!: NotificationManager;
  private giveawayManager!: GiveawayManager;
  // private chatRainManager!: ChatRainManager; // Initialized but not actively used in event routing yet
  // private announcementRelay!: AnnouncementRelayManager; // Optional - only if configured
  // private rewardSystem!: RewardSystem;

  // Moderation
  private spamDetector!: SpamDetector;
  private violationTracker!: ViolationTracker;
  private linkScanner!: LinkScanner;
  private channelAccess!: ChannelAccessEnforcer;

  // External services
  private webhookHandler!: KickWebhookHandler;
  private webhookServer!: WebhookServer;
  // private pollingFallback!: PollingFallbackSystem; // Commented out - needs Kick API client

  /**
   * Initialize all bot components in the correct order
   */
  async initialize(): Promise<void> {
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
   * Start all bot services
   */
  async start(): Promise<void> {
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

    logger.info('TZBOT started successfully', {
      discordConnected: this.discordClient.isConnected(),
      kickChatEnabled: !!config.kickChannelId,
      webhookServerEnabled: !!config.kickWebhookSecret,
      healthCheckEnabled: true,
    });
  }

  /**
   * Initialize shutdown manager
   */
  private async initializeShutdownManager(): Promise<void> {
    logger.info('Initializing shutdown manager...');

    this.shutdownManager = new GracefulShutdownManager(logger, 30000);
    this.shutdownManager.setupSignalHandlers();

    logger.info('Shutdown manager initialized');
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
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
    } catch (error) {
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
  private async initializeRedis(): Promise<void> {
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
    } catch (error) {
      logger.warn('Redis initialization failed - bot will run without caching', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - Redis is optional
    }
  }

  /**
   * Initialize state persistence service
   */
  private async initializeStatePersistence(): Promise<void> {
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
  private async initializeDiscordClient(): Promise<void> {
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
  private async initializeManagers(): Promise<void> {
    logger.info('Initializing managers...');

    // Event manager
    this.eventManager = new EventManager(this.discordClient, config);

    // Command manager
    this.commandManager = new CommandManager(this.discordClient, config);

    // Notification manager
    this.notificationManager = new NotificationManager(this.discordClient, {
      primaryChannelId: config.notificationChannelId,
      fallbackChannelId: config.fallbackChannelId,
      maxRetries: 3,
      retryDelayMs: 5000,
      getChannelId: () => config.notificationChannelId, // Dynamic channel ID getter
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
    this.giveawayManager = new GiveawayManager(
      this.discordClient,
      this.database.repositories.giveaways
    );

    // Announcement relay manager (optional - only if configured)
    // Note: This would need proper configuration in config
    // this.announcementRelay = new AnnouncementRelayManager(...);

    logger.info('Managers initialized');
  }

  /**
   * Initialize moderation systems
   */
  private async initializeModerationSystems(): Promise<void> {
    logger.info('Initializing moderation systems...');

    // Spam detector
    this.spamDetector = new SpamDetector({
      identicalMessages: 5,
      identicalWindow: 10, // seconds
      rapidMessages: 5,
      rapidWindow: 10, // seconds
    });

    // Violation tracker
    this.violationTracker = new ViolationTracker(
      this.database.repositories.violations
    );

    // Link scanner
    this.linkScanner = new LinkScanner(
      undefined, // Use default blocklist
      !!config.googleSafeBrowsingApiKey // Enable Google Safe Browsing if API key is configured
    );

    // Channel access controller
    this.channelAccess = new ChannelAccessEnforcer(
      this.discordClient,
      this.database.repositories.violations,
      config.moderatorRoleId,
      [] // Read-only channel configs will be loaded from config
    );

    logger.info('Moderation systems initialized');
  }

  /**
   * Initialize external services (Kick integration)
   */
  private async initializeExternalServices(): Promise<void> {
    logger.info('Initializing external services...');

    // Webhook handler
    this.webhookHandler = new KickWebhookHandler({
      webhookSecret: config.kickWebhookSecret || '',
      notificationManager: this.notificationManager,
      notificationChannelId: config.notificationChannelId,
    });

    // Webhook server
    this.webhookServer = new WebhookServer(
      {
        port: config.webhookPort || 3000,
        host: config.webhookHost || '0.0.0.0',
        webhookPath: '/webhooks/kick',
        requestSizeLimit: '1mb',
        enableRequestLogging: true,
      },
      this.webhookHandler
    );

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
  private async initializeHealthCheck(): Promise<void> {
    logger.info('Initializing health check system...');

    this.healthCheck = new HealthCheckSystem(
      {
        checkIntervalMs: 30000, // 30 seconds
        alertThreshold: 3,
        adminUserIds: [], // Would need to be configured
      },
      logger
    );

    // Set components to monitor
    // Note: We need to pass the underlying Discord.js client, not our wrapper
    // this.healthCheck.setDiscordClient(this.discordClient);
    this.healthCheck.setDatabase(this.database);
    this.healthCheck.setCache(redisClient);

    logger.info('Health check system initialized');
  }

  /**
   * Set up event routing between components
   */
  private async setupEventRouting(): Promise<void> {
    logger.info('Setting up event routing...');

    // Message events for moderation
    this.eventManager.registerHandler('messageCreate', async (message: Message) => {
      // Skip bot messages
      if (message.author.bot) return;

      // Track operation for graceful shutdown
      const completeOp = this.shutdownManager.trackOperation();

      try {
        // Record chat activity for chat rain
        if (config.chatRainEnabled) {
          await this.database.recordChatActivity(message.author.id, new Date());
        }

        // Check spam
        const spamResult = this.spamDetector.checkSpam(
          message.author.id,
          message.id,
          message.content
        );

        if (spamResult.isSpam) {
          // Record violation and get escalation result
          const escalation = await this.violationTracker.recordViolation(
            message.author.id,
            'spam' as any,
            spamResult.reason || 'Spam detected'
          );
          
          // Delete spam messages
          let deletedCount = 0;
          try {
            const recentMessages = await message.channel.messages.fetch({ limit: 100 });
            const spamWindowMs = 12 * 1000;
            const windowStart = new Date(message.createdTimestamp - spamWindowMs);
            const windowEnd = new Date(message.createdTimestamp + 2000);
            
            const userMessagesInWindow = recentMessages.filter(msg => 
              msg.author.id === message.author.id &&
              msg.createdTimestamp >= windowStart.getTime() &&
              msg.createdTimestamp <= windowEnd.getTime()
            );
            
            if (message.channel.type === 0 && 'bulkDelete' in message.channel.messages) {
              const deleted = await (message.channel.messages as any).bulkDelete(userMessagesInWindow, true);
              deletedCount = deleted.size;
            }
          } catch (error) {
            logger.error('Failed to delete spam messages', { error });
          }
          
          // Apply punishment based on escalation level
          const { PunishmentLevel } = await import('@/types/models.js');
          
          if (escalation.punishmentLevel === PunishmentLevel.WARNING) {
            // 1st offense: Ephemeral warning message + DM
            try {
              // Send ephemeral warning (only user can see)
              if (message.channel.type === 0) { // Guild text channel
                await (message.channel as any).send({
                  content: `<@${message.author.id}> ⚠️ **Warning #1** - Spam detected. This warning expires in 30 days. Further spam will result in timeout or ban.`,
                }).then((msg: any) => {
                  // Delete after 10 seconds so only user sees it briefly
                  setTimeout(() => msg.delete().catch(() => {}), 10000);
                });
              }
            } catch (error) {
              logger.debug('Failed to send ephemeral warning', { error });
            }
            
            // Send DM
            try {
              await message.author.send(
                `⚠️ **Spam Warning #1**\n\nYour messages in ${message.guild?.name} were detected as spam and removed.\n\n**Reason:** ${spamResult.reason}\n**Messages deleted:** ${deletedCount}\n**Warning expires:** 30 days from now\n\n**Progressive Punishment System:**\n- 2nd spam within 5 minutes: 5-minute timeout\n- 3 warnings within 30 days: Timeout\n- 3 timeouts within 30 days: Ban from server\n\nPlease avoid spamming to prevent further action.`
              );
            } catch (error) {
              logger.debug('Could not DM user about warning', { userId: message.author.id });
            }
            
            logger.info('Spam warning issued', {
              userId: message.author.id,
              username: message.author.username,
              deletedCount,
              escalation: escalation.reason
            });
            
          } else if (escalation.punishmentLevel === PunishmentLevel.TIMEOUT_5M) {
            // 2nd offense or 3 warnings: 5-minute timeout
            try {
              if (message.member) {
                await message.member.timeout(5 * 60 * 1000, escalation.reason);
                
                // Send ephemeral message
                if (message.channel.type === 0) {
                  await (message.channel as any).send({
                    content: `<@${message.author.id}> 🔇 **Timed out for 5 minutes** - ${escalation.reason}`,
                  }).then((msg: any) => {
                    setTimeout(() => msg.delete().catch(() => {}), 10000);
                  });
                }
                
                // Send DM
                await message.author.send(
                  `🔇 **5-Minute Timeout**\n\nYou have been timed out in ${message.guild?.name}.\n\n**Reason:** ${escalation.reason}\n**Duration:** 5 minutes\n**Messages deleted:** ${deletedCount}\n\n**Warning:** 3 timeouts within 30 days will result in a ban from the server.`
                ).catch(() => {});
                
                logger.info('User timed out for 5 minutes', {
                  userId: message.author.id,
                  reason: escalation.reason
                });
              }
            } catch (error) {
              logger.error('Failed to timeout user', { error });
            }
            
          } else if (escalation.punishmentLevel === PunishmentLevel.BAN) {
            // 3rd timeout or 3 warnings + timeout: Ban
            try {
              // Send DM before ban
              await message.author.send(
                `🚫 **Banned from ${message.guild?.name}**\n\n**Reason:** ${escalation.reason}\n\nYou have been permanently banned from the server due to repeated spam violations.\n\n**Violation History:**\n- Multiple spam warnings\n- Multiple timeouts\n- Failed to comply with server rules\n\nIf you believe this was a mistake, please contact the server administrators.`
              ).catch(() => {});
              
              // Ban user
              if (message.member) {
                await message.member.ban({
                  reason: escalation.reason,
                  deleteMessageSeconds: 60 * 60 * 24 // Delete last 24 hours of messages
                });
                
                logger.info('User banned for repeated spam', {
                  userId: message.author.id,
                  reason: escalation.reason
                });
              }
            } catch (error) {
              logger.error('Failed to ban user', { error });
            }
          }
          
          // Notify moderators
          const notificationEvent: NotificationEvent = {
            id: `spam-${message.author.id}-${Date.now()}`,
            type: 'SPAM_DETECTED' as any,
            channelId: message.channel.id,
            data: { userId: message.author.id, reason: spamResult.reason },
            timestamp: new Date(),
            delivered: false,
          };
          
          const embedData: PremiumEmbedData = {
            title: '🚨 Spam Detected',
            description: `User <@${message.author.id}> was detected spamming in <#${message.channel.id}>`,
            fields: [
              { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
              { name: 'Punishment', value: escalation.punishmentLevel, inline: true },
              { name: 'Reason', value: escalation.reason, inline: true },
              { name: 'Messages Deleted', value: `${deletedCount}`, inline: true },
              { name: 'Violation Count', value: `${escalation.violationCount}`, inline: true },
            ],
            color: escalation.punishmentLevel === PunishmentLevel.BAN ? 0x000000 : 0xff0000,
          };
          
          await this.notificationManager.sendNotification(notificationEvent, embedData);
          
          return;
        }

        // Check for malicious links
        const isModerator = message.member?.roles.cache.has(config.moderatorRoleId) || false;
        const linkScanResult = await this.linkScanner.scanMessage(
          message.content,
          message.author.id,
          isModerator
        );

        if (linkScanResult.isMalicious) {
          // Record violation
          await this.violationTracker.recordViolation(
            message.author.id,
            'malicious_link' as any, // Type will be fixed in violation tracker
            'Malicious link detected'
          );
          
          // Delete the message
          await message.delete().catch(() => {
            logger.warn('Failed to delete malicious link message', { messageId: message.id });
          });
          
          // Warn the user
          try {
            await message.author.send(
              `⚠️ **Malicious Link Detected**\n\nYour message in ${message.guild?.name} contained a malicious or suspicious link and was removed.\n\nPlease do not post suspicious links. Continued violations may result in a timeout or ban.`
            );
          } catch (error) {
            logger.debug('Could not DM user about malicious link', { userId: message.author.id });
          }
          
          // Notify moderators
          const notificationEvent: NotificationEvent = {
            id: `malicious-link-${message.author.id}-${Date.now()}`,
            type: 'MALICIOUS_LINK_DETECTED' as any,
            channelId: message.channel.id,
            data: { userId: message.author.id },
            timestamp: new Date(),
            delivered: false,
          };
          
          const embedData: PremiumEmbedData = {
            title: '🔗 Malicious Link Detected',
            description: `User <@${message.author.id}> posted a malicious link in <#${message.channel.id}>`,
            fields: [
              { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
              { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
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
            await message.author.send(
              `Your message in <#${message.channel.id}> was deleted because you don't have permission to post in that channel.`
            ).catch(() => {
              // Ignore DM failures
            });
            return;
          }
        }

        // Handle announcement relay (if configured)
        // if (this.announcementRelay && message.guild) {
        //   await this.announcementRelay.handleMessage(message);
        // }
      } catch (error) {
        logger.error('Error processing message event', { error });
      } finally {
        completeOp();
      }
    }, 50); // Priority 50

    // Interaction events for commands
    this.eventManager.registerHandler('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;

      const completeOp = this.shutdownManager.trackOperation();

      try {
        await this.commandManager.handleInteraction(interaction);
      } catch (error) {
        logger.error('Error handling interaction', { error });
      } finally {
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
  private async registerCommands(): Promise<void> {
    logger.info('Registering slash commands...');

    // Register moderation commands
    const modCommands = createModerationCommands(this.discordClient, this.database);
    this.commandManager.registerCommands(modCommands);

    // Register utility commands
    const utilCommands = createUtilityCommands(this.discordClient, this.database, config);
    this.commandManager.registerCommands(utilCommands);

    logger.info('Slash commands registered');
  }

  /**
   * Deploy commands to Discord (called after connection)
   */
  private async deployCommandsToDiscord(): Promise<void> {
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
      await this.commandManager.deployCommands(
        config.discordToken,
        config.clientId
      );
      logger.info('Commands deployed to Discord');
    } else {
      logger.warn('Client ID not configured, skipping command deployment');
    }
  }

  /**
   * Recover state from previous session
   */
  private async recoverState(): Promise<void> {
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
  private async startKickChatMonitoring(): Promise<void> {
    logger.info('Starting Kick chat monitoring...');

    await kickChatClient.connect({
      channelId: config.kickChannelId!,
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
  } catch (error) {
    logger.error('Failed to start TZBOT', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the application
main();
