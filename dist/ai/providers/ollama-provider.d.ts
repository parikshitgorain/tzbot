/**
 * @file ollama-provider.ts
 * @description Ollama local AI provider implementation
 * @module ai/providers
 */
import { IAIProvider, AIMessage, AIResponse } from '../ai-provider.interface.js';
export declare class OllamaProvider implements IAIProvider {
    private baseUrl;
    private modelName;
    constructor(baseUrl?: string, modelName?: string);
    generateResponse(messages: AIMessage[], maxTokens?: number): Promise<AIResponse>;
    isAvailable(): Promise<boolean>;
    /**
     * Pull (download) a model from Ollama
     */
    private pullModel;
    getProviderName(): string;
}
//# sourceMappingURL=ollama-provider.d.ts.map