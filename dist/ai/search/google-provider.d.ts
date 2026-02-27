/**
 * @file google-provider.ts
 * @description Google Custom Search API provider (requires API key)
 * @module ai/search
 */
import { ISearchProvider, SearchResult } from './search-provider.interface.js';
export declare class GoogleSearchProvider implements ISearchProvider {
    private apiKey;
    private searchEngineId;
    private baseUrl;
    constructor(apiKey: string, searchEngineId: string);
    search(query: string, maxResults?: number): Promise<SearchResult[]>;
    isAvailable(): boolean;
    getProviderName(): string;
}
//# sourceMappingURL=google-provider.d.ts.map