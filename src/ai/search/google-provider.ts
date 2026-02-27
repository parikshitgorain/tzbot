/**
 * @file google-provider.ts
 * @description Google Custom Search API provider (requires API key)
 * @module ai/search
 */

import { ISearchProvider, SearchResult } from './search-provider.interface.js';
import { logger, logError } from '@/core/logger/logger.js';

interface GoogleSearchResponse {
  items?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
}

export class GoogleSearchProvider implements ISearchProvider {
  private apiKey: string;
  private searchEngineId: string;
  private baseUrl: string = 'https://www.googleapis.com/customsearch/v1';

  constructor(apiKey: string, searchEngineId: string) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      const searchUrl = `${this.baseUrl}?key=${this.apiKey}&cx=${this.searchEngineId}&q=${encodeURIComponent(query)}&num=${maxResults}`;

      const response = await fetch(searchUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Google Search API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

       

      const data = await response.json() as GoogleSearchResponse;
      const results: SearchResult[] = [];

      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          results.push({
            title: item.title || 'No title',
            url: item.link || '',
            snippet: item.snippet || '',
            source: 'Google',
          });
        }
      }

      logger.debug('Google search completed', {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      logError('Google search failed', error as Error, { query });
      return [];
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey && !!this.searchEngineId;
  }

  getProviderName(): string {
    return 'Google';
  }
}
