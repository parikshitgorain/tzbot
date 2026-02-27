/**
 * @file duckduckgo-provider.ts
 * @description DuckDuckGo search provider (free, no API key needed)
 * @module ai/search
 */
import { ISearchProvider, SearchResult } from './search-provider.interface.js';
export declare class DuckDuckGoProvider implements ISearchProvider {
    search(query: string, maxResults?: number): Promise<SearchResult[]>;
    isAvailable(): boolean;
    getProviderName(): string;
}
//# sourceMappingURL=duckduckgo-provider.d.ts.map