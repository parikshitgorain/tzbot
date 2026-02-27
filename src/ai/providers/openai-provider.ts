/**
 * @file openai-provider.ts
 * @description OpenAI API provider implementation
 * @module ai/providers
 */

import { IAIProvider, AIMessage, AIResponse } from '../ai-provider.interface.js';
import { logError } from '@/core/logger/logger.js';

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
  model: string;
}

export class OpenAIProvider implements IAIProvider {
  private apiKey: string;
  private modelName: string;
  private baseUrl: string;

  constructor(apiKey: string, modelName: string = 'gpt-3.5-turbo') {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async generateResponse(messages: AIMessage[], maxTokens: number = 500): Promise<AIResponse> {
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

       

      const data = await response.json() as OpenAIResponse;

      return {
        content: data.choices[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens,
        model: data.model,
      };
    } catch (error) {
      logError('OpenAI API request failed', error as Error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return 'OpenAI';
  }
}
