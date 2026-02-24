/**
 * @file event.manager.ts
 * @description Event manager for handling and routing Discord events
 * @module managers
 */
import type { IDiscordClient, DiscordEvent, EventHandler } from '../core/discord/client.js';
import type { BotConfig } from '../config/types.js';
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
export declare class EventManager {
    private client;
    private eventQueue;
    private handlers;
    private processing;
    private paused;
    private inflightCount;
    private stats;
    private rateLimitWindow;
    private maxEventsPerWindow;
    private eventCountInWindow;
    private windowStartTime;
    private maxQueueSize;
    private eventIdCounter;
    constructor(client: IDiscordClient, config: BotConfig);
    /**
     * Register an event handler with priority
     * @param event - Discord event type
     * @param handler - Event handler function
     * @param priority - Handler priority (higher = executed first)
     */
    registerHandler<K extends DiscordEvent>(event: K, handler: EventHandler<K>, priority?: number): void;
    /**
     * Start listening to Discord events
     */
    start(): void;
    /**
     * Pause event processing
     */
    pause(): void;
    /**
     * Resume event processing
     */
    resume(): void;
    /**
     * Check if there are in-flight events
     */
    hasInflight(): boolean;
    /**
     * Get event statistics
     */
    getStats(): Map<DiscordEvent, EventStats>;
    /**
     * Clear event queue
     */
    clearQueue(): void;
    /**
     * Setup Discord event listeners
     */
    private setupDiscordEventListeners;
    /**
     * Enqueue an event for processing
     */
    private enqueueEvent;
    /**
     * Get event priority
     */
    private getEventPriority;
    /**
     * Start queue processor
     */
    private startQueueProcessor;
    /**
     * Process event queue
     */
    private processQueue;
    /**
     * Check rate limit
     */
    private checkRateLimit;
    /**
     * Process a single event
     */
    private processEvent;
    /**
     * Increment event statistics
     */
    private incrementStat;
    /**
     * Sleep utility
     */
    private sleep;
}
export {};
//# sourceMappingURL=event.manager.d.ts.map