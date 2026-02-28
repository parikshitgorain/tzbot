/**
 * @file ollama-provider.ts
 * @description Ollama local AI provider implementation
 * @module ai/providers
 */
import { logger, logError } from '../../core/logger/logger.js';
export class OllamaProvider {
    baseUrl;
    modelName;
    constructor(baseUrl = 'http://localhost:11434', modelName = 'llama3.2:1b') {
        this.baseUrl = baseUrl;
        this.modelName = modelName;
    }
    async generateResponse(messages, maxTokens = 500) {
        try {
            // Convert messages to Ollama format
            const systemMessage = messages.find((m) => m.role === 'system');
            const conversationMessages = messages.filter((m) => m.role !== 'system');
            // Build prompt for Ollama
            let prompt = '';
            if (systemMessage) {
                prompt += `${systemMessage.content}\n\n`;
            }
            for (const msg of conversationMessages) {
                if (msg.role === 'user') {
                    prompt += `User: ${msg.content}\n`;
                }
                else if (msg.role === 'assistant') {
                    prompt += `Assistant: ${msg.content}\n`;
                }
            }
            prompt += 'Assistant: ';
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt,
                    stream: false,
                    options: {
                        num_predict: maxTokens,
                        temperature: 0.7,
                        top_p: 0.9,
                        num_ctx: 1024, // Reduce context window for faster responses
                        num_thread: 2, // Use 2 CPU threads
                    },
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Ollama API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            return {
                content: data.response || '',
                model: data.model,
            };
        }
        catch (error) {
            logError('Ollama API request failed', error);
            throw error;
        }
    }
    async isAvailable() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
            });
            if (!response.ok) {
                return false;
            }
            // Check if the model exists
            const data = await response.json();
            const models = data.models || [];
            const modelExists = models.some((m) => m.name === this.modelName);
            if (!modelExists) {
                logger.warn(`Model ${this.modelName} not found. Attempting to pull...`);
                await this.pullModel();
            }
            return true;
        }
        catch (error) {
            logger.debug('Ollama is not available', { error: error.message });
            return false;
        }
    }
    /**
     * Pull (download) a model from Ollama
     */
    async pullModel() {
        try {
            logger.info(`Pulling model ${this.modelName}...`);
            const response = await fetch(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: this.modelName,
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.status}`);
            }
            // Stream the response to track progress
            const reader = response.body?.getReader();
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    // Parse progress updates
                    const text = new TextDecoder().decode(value);
                    const lines = text.split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        try {
                            const progress = JSON.parse(line);
                            if (progress.status) {
                                logger.info(`Model pull progress: ${progress.status}`);
                            }
                        }
                        catch {
                            // Ignore parse errors
                        }
                    }
                }
            }
            logger.info(`Model ${this.modelName} pulled successfully`);
        }
        catch (error) {
            logError('Failed to pull model', error);
            throw error;
        }
    }
    getProviderName() {
        return 'Ollama';
    }
}
//# sourceMappingURL=ollama-provider.js.map