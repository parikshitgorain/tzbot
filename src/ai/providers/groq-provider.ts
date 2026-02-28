/**
 * @file groq-provider.ts
 * @description Groq cloud AI provider implementation
 * @module ai/providers
 */

import { IAIProvider, AIMessage, AIResponse } from '../ai-provider.interface.js';
import { logger, logError } from '@/core/logger/logger.js';

interface GroqChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  model: string;
  usage?: {
    total_tokens: number;
  };
}

export class GroqProvider implements IAIProvider {
  private apiKey: string;
  private modelName: string;
  private baseUrl: string = 'https://api.groq.com/openai/v1';

  constructor(apiKey: string, modelName: string = 'llama-3.1-8b-instant') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateResponse(messages: AIMessage[], maxTokens: number = 150): Promise<AIResponse> {
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

      const data = await response.json() as GroqChatCompletionResponse;

      return {
        content: data.choices[0]?.message?.content || '',
        model: data.model,
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      logError('Groq API request failed', error as Error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test API key with a minimal request
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      return response.ok;
    } catch (error) {
      logger.debug('Groq is not available', { error: (error as Error).message });
      return false;
    }
  }

  getProviderName(): string {
    return 'Groq';
  }
}
