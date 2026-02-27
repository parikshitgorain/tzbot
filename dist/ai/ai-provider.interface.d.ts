/**
 * @file ai-provider.interface.ts
 * @description AI provider interface for different AI services
 * @module ai
 */
export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface AIResponse {
    content: string;
    tokensUsed?: number;
    model?: string;
}
export interface IAIProvider {
    /**
     * Generate a response from the AI model
     */
    generateResponse(messages: AIMessage[], maxTokens?: number): Promise<AIResponse>;
    /**
     * Check if the provider is available and configured
     */
    isAvailable(): boolean | Promise<boolean>;
    /**
     * Get the provider name
     */
    getProviderName(): string;
}
//# sourceMappingURL=ai-provider.interface.d.ts.map