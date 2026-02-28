/**
 * @file groq-provider.ts
 * @description Groq cloud AI provider implementation
 * @module ai/providers
 */
import { logger, logError } from '../../core/logger/logger.js';
export class GroqProvider {
    apiKey;
    modelName;
    baseUrl = 'https://api.groq.com/openai/v1';
    constructor(apiKey, modelName = 'llama-3.1-8b-instant') {
        this.apiKey = apiKey;
        this.modelName = modelName;
    }
    async generateResponse(messages, maxTokens = 150) {
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                    })),
                    max_tokens: maxTokens,
                    temperature: 0.7,
                    top_p: 0.9,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Groq API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            return {
                content: data.choices[0]?.message?.content || '',
                model: data.model,
                tokensUsed: data.usage?.total_tokens,
            };
        }
        catch (error) {
            logError('Groq API request failed', error);
            throw error;
        }
    }
    async isAvailable() {
        try {
            // Test API key with a minimal request
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
            });
            return response.ok;
        }
        catch (error) {
            logger.debug('Groq is not available', { error: error.message });
            return false;
        }
    }
    getProviderName() {
        return 'Groq';
    }
}
//# sourceMappingURL=groq-provider.js.map