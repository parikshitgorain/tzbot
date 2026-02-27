/**
 * @file duckduckgo-provider.ts
 * @description DuckDuckGo search provider (free, no API key needed)
 * @module ai/search
 */

import { ISearchProvider, SearchResult } from './search-provider.interface.js';
import { logger, logError } from '@/core/logger/logger.js';

interface DuckDuckGoResponse {
  AbstractText?: string;
  Heading?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
  }>;
}

export class DuckDuckGoProvider implements ISearchProvider {
  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      // Use DuckDuckGo Instant Answer API (free, no key needed)
      const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status}`);
      }

       

      const data = await response.json() as DuckDuckGoResponse;
      const results: SearchResult[] = [];

      // Get instant answer if available
      if (data.AbstractText) {
        results.push({
          title: data.Heading || 'DuckDuckGo Instant Answer',
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.AbstractText,
          source: data.AbstractSource || 'DuckDuckGo',
        });
      }

      // Get related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              url: topic.FirstURL,
              snippet: topic.Text,
              source: 'DuckDuckGo',
            });
          }
        }
      }

      logger.debug('DuckDuckGo search completed', {
        query,
        resultsCount: results.length,
      });

      return results.slice(0, maxResults);
    } catch (error) {
      logError('DuckDuckGo search failed', error as Error, { query });
      return [];
    }
  }

  isAvailable(): boolean {
    return true; // Always available, no API key needed
  }

  getProviderName(): string {
    return 'DuckDuckGo';
  }
}
