/**
 * @file xai-provider.ts
 * @description xAI (X.AI) Grok provider implementation
 * @module ai/providers
 */

import { IAIProvider, AIMessage, AIResponse } from '../ai-provider.interface.js';
import { logger, logError } from '@/core/logger/logger.js';

export class XAIProvider implements IAIProvider {
  private apiKey: string;
  private modelName: string;
  private baseUrl: string = 'https://api.x.ai/v1';

  constructor(apiKey: string, modelName: string = 'grok-beta') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateResponse(messages: AIMessage[], maxTokens: number = 500): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          max_tokens: maxTokens,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`xAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as {
        choices: Array<{
          message: {
            content: string;
          };
        }>;
        model: string;
        usage?: {
          total_tokens: number;
        };
      };

      return {
        content: data.choices[0]?.message?.content || '',
        model: data.model,
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      logError('xAI API request failed', error as Error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple check - try to list models
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      logger.debug('xAI is not available', { error: (error as Error).message });
      return false;
    }
  }

  getProviderName(): string {
    return 'xAI';
  }
}
