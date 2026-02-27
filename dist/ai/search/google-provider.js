/**
 * @file google-provider.ts
 * @description Google Custom Search API provider (requires API key)
 * @module ai/search
 */
import { logger, logError } from '../../core/logger/logger.js';
export class GoogleSearchProvider {
    apiKey;
    searchEngineId;
    baseUrl = 'https://www.googleapis.com/customsearch/v1';
    constructor(apiKey, searchEngineId) {
        this.apiKey = apiKey;
        this.searchEngineId = searchEngineId;
    }
    async search(query, maxResults = 5) {
        try {
            const searchUrl = `${this.baseUrl}?key=${this.apiKey}&cx=${this.searchEngineId}&q=${encodeURIComponent(query)}&num=${maxResults}`;
            const response = await fetch(searchUrl);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Google Search API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            const results = [];
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
        }
        catch (error) {
            logError('Google search failed', error, { query });
            return [];
        }
    }
    isAvailable() {
        return !!this.apiKey && !!this.searchEngineId;
    }
    getProviderName() {
        return 'Google';
    }
}
//# sourceMappingURL=google-provider.js.map