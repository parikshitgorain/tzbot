/**
 * @file groq-provider.ts
 * @description Groq cloud AI provider implementation
 * @module ai/providers
 */
import { IAIProvider, AIMessage, AIResponse } from '../ai-provider.interface.js';
export declare class GroqProvider implements IAIProvider {
    private apiKey;
    private modelName;
    private baseUrl;
    constructor(apiKey: string, modelName?: string);
    generateResponse(messages: AIMessage[], maxTokens?: number): Promise<AIResponse>;
    isAvailable(): Promise<boolean>;
    getProviderName(): string;
}
//# sourceMappingURL=groq-provider.d.ts.map