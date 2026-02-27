/**
 * @file ai-manager.ts
 * @description AI manager for handling auto-replies and casino-related questions
 * @module ai
 */
import { Message } from 'discord.js';
import { ConfigSchema } from '../config/validator.js';
export declare class AIManager {
    private provider;
    private searchProvider;
    private config;
    private botUserId;
    private conversationHistory;
    private maxHistoryLength;
    private activeConversations;
    private conversationTimeoutMs;
    constructor(config: ConfigSchema, botUserId: string);
    /**
     * Initialize the AI provider (must be called after constructor)
     */
    initialize(): Promise<void>;
    /**
     * Initialize search provider
     */
    private initializeSearchProvider;
    private initializeProvider;
    /**
     * Check if AI should respond to this message
     */
    shouldRespond(message: Message): boolean;
    /**
     * Start or extend a conversation with a user
     */
    private startConversation;
    /**
     * Generate AI response for a message
     */
    generateResponse(message: Message): Promise<string | null>;
    /**
     * Clear conversation history for a channel
     */
    clearHistory(channelId: string): void;
    /**
     * Clear all conversation histories
     */
    clearAllHistories(): void;
    /**
     * Check if AI is enabled and available
     */
    isAvailable(): boolean;
    /**
     * Check if message needs web search
     */
    private needsWebSearch;
    /**
     * Perform web search and format results
     */
    private performWebSearch;
}
//# sourceMappingURL=ai-manager.d.ts.map