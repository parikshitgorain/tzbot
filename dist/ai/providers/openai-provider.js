/**
 * @file openai-provider.ts
 * @description OpenAI API provider implementation
 * @module ai/providers
 */
import { logError } from '../../core/logger/logger.js';
export class OpenAIProvider {
    apiKey;
    modelName;
    baseUrl;
    constructor(apiKey, modelName = 'gpt-3.5-turbo') {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.baseUrl = 'https://api.openai.com/v1';
    }
    async generateResponse(messages, maxTokens = 500) {
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages,
                    max_tokens: maxTokens,
                    temperature: 0.7,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            return {
                content: data.choices[0]?.message?.content || '',
                tokensUsed: data.usage?.total_tokens,
                model: data.model,
            };
        }
        catch (error) {
            logError('OpenAI API request failed', error);
            throw error;
        }
    }
    isAvailable() {
        return !!this.apiKey;
    }
    getProviderName() {
        return 'OpenAI';
    }
}
//# sourceMappingURL=openai-provider.js.map