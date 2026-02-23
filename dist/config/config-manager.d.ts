/**
 * @file config-manager.ts
 * @description Configuration hot-reload manager
 * @module config
 *
 * Implements Property 52: Configuration Hot-Reload
 * Validates: Requirements 12.4
 */
import { EventEmitter } from 'events';
import type { BotConfig } from './types.js';
export interface ConfigChangeEvent {
    oldConfig: BotConfig;
    newConfig: BotConfig;
    changedKeys: string[];
    timestamp: Date;
}
export interface ConfigManagerOptions {
    configPath?: string;
    debounceMs?: number;
    notifyAdmins?: (event: ConfigChangeEvent) => Promise<void>;
}
/**
 * Configuration manager with hot-reload support
 *
 * Features:
 * - Watches .env file for changes
 * - Validates new configuration before applying
 * - Emits events on configuration changes
 * - Notifies administrators of changes
 * - Debounces rapid file changes
 */
export declare class ConfigManager extends EventEmitter {
    private currentConfig;
    private watcher;
    private debounceTimer;
    private readonly configPath;
    private readonly debounceMs;
    private readonly notifyAdmins?;
    private isReloading;
    constructor(initialConfig: BotConfig, options?: ConfigManagerOptions);
    /**
     * Get current configuration
     */
    getConfig(): BotConfig;
    /**
     * Start watching configuration file for changes
     */
    startWatching(): void;
    /**
     * Stop watching configuration file
     */
    stopWatching(): void;
    /**
     * Handle file change with debouncing
     */
    private handleFileChange;
    /**
     * Reload configuration from file
     */
    reloadConfig(): Promise<void>;
    /**
     * Build config object from environment variables
     */
    private buildConfigFromEnv;
    /**
     * Parse channel mapping from environment variable
     * Format: "channelId1:redirectId1,channelId2:redirectId2"
     */
    private parseChannelMapping;
    /**
     * Detect changes between old and new configuration
     */
    private detectChanges;
    /**
     * Manually trigger a configuration reload
     */
    triggerReload(): Promise<void>;
}
//# sourceMappingURL=config-manager.d.ts.map