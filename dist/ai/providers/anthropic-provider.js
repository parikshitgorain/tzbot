/**
 * @file anthropic-provider.ts
 * @description Anthropic Claude API provider implementation
 * @module ai/providers
 */
import { logError } from '../../core/logger/logger.js';
export class AnthropicProvider {
    apiKey;
    modelName;
    baseUrl;
    constructor(apiKey, modelName = 'claude-3-haiku-20240307') {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.baseUrl = 'https://api.anthropic.com/v1';
    }
    async generateResponse(messages, maxTokens = 500) {
        try {
            // Convert messages format for Anthropic
            const systemMessage = messages.find((m) => m.role === 'system');
            const conversationMessages = messages
                .filter((m) => m.role !== 'system')
                .map((m) => ({
                role: m.role,
                content: m.content,
            }));
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.modelName,
                    max_tokens: maxTokens,
                    system: systemMessage?.content,
                    messages: conversationMessages,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await response.json();
            return {
                content: data.content[0]?.text || '',
                tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
                model: data.model,
            };
        }
        catch (error) {
            logError('Anthropic API request failed', error);
            throw error;
        }
    }
    isAvailable() {
        return !!this.apiKey;
    }
    getProviderName() {
        return 'Anthropic';
    }
}
//# sourceMappingURL=anthropic-provider.js.map