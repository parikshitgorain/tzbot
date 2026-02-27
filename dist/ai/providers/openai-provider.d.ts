/**
 * @file openai-provider.ts
 * @description OpenAI API provider implementation
 * @module ai/providers
 */
import { IAIProvider, AIMessage, AIResponse } from '../ai-provider.interface.js';
export declare class OpenAIProvider implements IAIProvider {
    private apiKey;
    private modelName;
    private baseUrl;
    constructor(apiKey: string, modelName?: string);
    generateResponse(messages: AIMessage[], maxTokens?: number): Promise<AIResponse>;
    isAvailable(): boolean;
    getProviderName(): string;
}
//# sourceMappingURL=openai-provider.d.ts.map