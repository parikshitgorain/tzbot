/**
 * @file searxng-provider.ts
 * @description SearXNG meta-search provider (free, privacy-focused)
 * @module ai/search
 */
import { logger, logError } from '../../core/logger/logger.js';
export class SearXNGProvider {
    instanceUrl;
    constructor(instanceUrl = 'https://searx.be') {
        this.instanceUrl = instanceUrl;
    }
    async search(query, maxResults = 5) {
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
            const data = await response.json();
            const results = [];
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
        }
        catch (error) {
            logError('SearXNG search failed', error, { query });
            return [];
        }
    }
    isAvailable() {
        return true;
    }
    getProviderName() {
        return 'SearXNG';
    }
}
//# sourceMappingURL=searxng-provider.js.map