/**
 * @file searxng-provider.ts
 * @description SearXNG meta-search provider (free, privacy-focused)
 * @module ai/search
 */

import { ISearchProvider, SearchResult } from './search-provider.interface.js';
import { logger, logError } from '@/core/logger/logger.js';

interface SearXNGResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    engine?: string;
  }>;
}

export class SearXNGProvider implements ISearchProvider {
  private instanceUrl: string;

  constructor(instanceUrl: string = 'https://searx.be') {
    this.instanceUrl = instanceUrl;
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      const searchUrl = `${this.instanceUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`SearXNG API error: ${response.status}`);
      }

       

      const data = await response.json() as SearXNGResponse;
      const results: SearchResult[] = [];

      if (data.results && Array.isArray(data.results)) {
        for (const result of data.results.slice(0, maxResults)) {
          results.push({
            title: result.title || 'No title',
            url: result.url || '',
            snippet: result.content || result.title || '',
            source: result.engine || 'SearXNG',
          });
        }
      }

      logger.debug('SearXNG search completed', {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      logError('SearXNG search failed', error as Error, { query });
      return [];
    }
  }

  isAvailable(): boolean {
    return true;
  }

  getProviderName(): string {
    return 'SearXNG';
  }
}
