/**
 * @file event.manager.ts
 * @description Event manager for handling and routing Discord events
 * @module managers
 */

import type { IDiscordClient, DiscordEvent, EventHandler } from '@/core/discord/client.js';
import { logger, logError } from '@/core/logger/logger.js';
import type { BotConfig } from '@/config/types.js';

/**
 * Event queue item
 */
interface QueuedEvent {
  id: string;
  type: DiscordEvent;
  args: unknown[];
  timestamp: Date;
  priority: number;
}

/**
 * Event handler registration
 */
interface EventHandlerRegistration {
  event: DiscordEvent;
  handler: EventHandler;
  priority: number;
}

/**
 * Event processing statistics
 */
interface EventStats {
  processed: number;
  queued: number;
  dropped: number;
  lastProcessedAt?: Date;
}

/**
 * Event manager for handling Discord events with queuing and rate limiting
 */
export class EventManager {
  private client: IDiscordClient;
  private eventQueue: QueuedEvent[] = [];
  private handlers: Map<DiscordEvent, EventHandlerRegistration[]> = new Map();
  private processing: boolean = false;
  private paused: boolean = false;
  private inflightCount: number = 0;
  private stats: Map<DiscordEvent, EventStats> = new Map();
  private rateLimitWindow: number = 1000; // 1 second
  private maxEventsPerWindow: number;
  private eventCountInWindow: number = 0;
  private windowStartTime: number = Date.now();
  private maxQueueSize: number = 10000;
  private eventIdCounter: number = 0;

  constructor(client: IDiscordClient, config: BotConfig) {
    this.client = client;
    this.maxEventsPerWindow = config.maxMessagesPerSecond || 100;

    logger.info('EventManager initialized', {
      maxEventsPerWindow: this.maxEventsPerWindow,
      maxQueueSize: this.maxQueueSize,
    });
  }

  /**
   * Register an event handler with priority
   * @param event - Discord event type
   * @param handler - Event handler function
   * @param priority - Handler priority (higher = executed first)
   */
  registerHandler<K extends DiscordEvent>(
    event: K,
    handler: EventHandler<K>,
    priority: number = 0
  ): void {
    const registration: EventHandlerRegistration = {
      event,
      handler: handler as EventHandler,
      priority,
    };

    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }

    const handlers = this.handlers.get(event)!;
    handlers.push(registration);

    // Sort by priority (descending)
    handlers.sort((a, b) => b.priority - a.priority);

    logger.debug('Event handler registered', {
      event,
      priority,
      totalHandlers: handlers.length,
    });
  }

  /**
   * Start listening to Discord events
   */
  start(): void {
    logger.info('Starting EventManager...');

    // Register Discord event listeners
    this.setupDiscordEventListeners();

    // Start processing queue
    this.startQueueProcessor();

    logger.info('EventManager started');
  }

  /**
   * Pause event processing
   */
  pause(): void {
    this.paused = true;
    logger.info('EventManager paused');
  }

  /**
   * Resume event processing
   */
  resume(): void {
    this.paused = false;
    logger.info('EventManager resumed');

    // Restart queue processor
    if (!this.processing) {
      this.processing = true;
      this.processQueue();
    }
  }

  /**
   * Check if there are in-flight events
   */
  hasInflight(): boolean {
    return this.inflightCount > 0 || this.eventQueue.length > 0;
  }

  /**
   * Get event statistics
   */
  getStats(): Map<DiscordEvent, EventStats> {
    return new Map(this.stats);
  }

  /**
   * Clear event queue
   */
  clearQueue(): void {
    const queueSize = this.eventQueue.length;
    this.eventQueue = [];
    logger.info('Event queue cleared', { clearedEvents: queueSize });
  }

  /**
   * Setup Discord event listeners
   */
  private setupDiscordEventListeners(): void {
    // Listen to all registered events
    for (const [event] of this.handlers) {
      this.client.on(event, (...args: unknown[]) => {
        this.enqueueEvent(event, args);
      });
    }

    logger.debug('Discord event listeners setup', {
      events: Array.from(this.handlers.keys()),
    });
  }

  /**
   * Enqueue an event for processing
   */
  private enqueueEvent(type: DiscordEvent, args: unknown[]): void {
    // Check if paused
    if (this.paused) {
      logger.debug('Event dropped (paused)', { type });
      this.incrementStat(type, 'dropped');
      return;
    }

    // Check queue size limit
    if (this.eventQueue.length >= this.maxQueueSize) {
      logger.warn('Event queue full, dropping event', {
        type,
        queueSize: this.eventQueue.length,
        maxQueueSize: this.maxQueueSize,
      });
      this.incrementStat(type, 'dropped');
      return;
    }

    // Determine priority based on event type
    const priority = this.getEventPriority(type);

    // Create queued event
    const queuedEvent: QueuedEvent = {
      id: `${Date.now()}-${this.eventIdCounter++}`,
      type,
      args,
      timestamp: new Date(),
      priority,
    };

    // Add to queue
    this.eventQueue.push(queuedEvent);
    this.incrementStat(type, 'queued');

    // Sort queue by priority (descending)
    this.eventQueue.sort((a, b) => b.priority - a.priority);

    logger.debug('Event enqueued', {
      type,
      priority,
      queueSize: this.eventQueue.length,
    });
  }

  /**
   * Get event priority
   */
  private getEventPriority(type: DiscordEvent): number {
    // Higher priority for critical events
    const priorityMap: Partial<Record<DiscordEvent, number>> = {
      ready: 100,
      error: 90,
      shardError: 90,
      messageCreate: 50,
      messageDelete: 50,
      guildMemberAdd: 40,
      guildMemberRemove: 40,
      interactionCreate: 60,
    };

    return priorityMap[type] ?? 0;
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.processQueue();
  }

  /**
   * Process event queue
   */
  private async processQueue(): Promise<void> {
    while (this.processing && !this.paused) {
      // Check if queue is empty
      if (this.eventQueue.length === 0) {
        await this.sleep(10); // Wait 10ms before checking again
        continue;
      }

      // Check rate limit
      if (!this.checkRateLimit()) {
        await this.sleep(10); // Wait 10ms before checking again
        continue;
      }

      // Get next event
      const event = this.eventQueue.shift();
      if (!event) {
        continue;
      }

      // Process event
      await this.processEvent(event);
    }

    this.processing = false;
    logger.debug('Queue processor stopped');
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const elapsed = now - this.windowStartTime;

    // Reset window if elapsed
    if (elapsed >= this.rateLimitWindow) {
      this.windowStartTime = now;
      this.eventCountInWindow = 0;
    }

    // Check if under limit
    if (this.eventCountInWindow >= this.maxEventsPerWindow) {
      return false;
    }

    return true;
  }

  /**
   * Process a single event
   */
  private async processEvent(event: QueuedEvent): Promise<void> {
    this.inflightCount++;
    this.eventCountInWindow++;

    try {
      const handlers = this.handlers.get(event.type);
      if (!handlers || handlers.length === 0) {
        logger.debug('No handlers for event', { type: event.type });
        return;
      }

      // Execute all handlers for this event
      for (const registration of handlers) {
        try {
          await registration.handler(...(event.args as Parameters<EventHandler>));
        } catch (error) {
          logError(`Error in event handler for ${String(event.type)}`, error as Error, {
            eventId: event.id,
            eventType: String(event.type),
            priority: registration.priority,
          });
        }
      }

      this.incrementStat(event.type, 'processed');

      logger.debug('Event processed', {
        id: event.id,
        type: String(event.type),
        handlersExecuted: handlers.length,
        queueSize: this.eventQueue.length,
      });
    } catch (error) {
      logError('Error processing event', error as Error, {
        eventId: event.id,
        eventType: event.type,
      });
    } finally {
      this.inflightCount--;
    }
  }

  /**
   * Increment event statistics
   */
  private incrementStat(
    event: DiscordEvent,
    type: 'processed' | 'queued' | 'dropped'
  ): void {
    if (!this.stats.has(event)) {
      this.stats.set(event, {
        processed: 0,
        queued: 0,
        dropped: 0,
      });
    }

    const stats = this.stats.get(event)!;
    stats[type]++;

    if (type === 'processed') {
      stats.lastProcessedAt = new Date();
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
