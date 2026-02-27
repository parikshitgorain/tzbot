/**
 * @file searxng-provider.ts
 * @description SearXNG meta-search provider (free, privacy-focused)
 * @module ai/search
 */
import { ISearchProvider, SearchResult } from './search-provider.interface.js';
export declare class SearXNGProvider implements ISearchProvider {
    private instanceUrl;
    constructor(instanceUrl?: string);
    search(query: string, maxResults?: number): Promise<SearchResult[]>;
    isAvailable(): boolean;
    getProviderName(): string;
}
//# sourceMappingURL=searxng-provider.d.ts.map