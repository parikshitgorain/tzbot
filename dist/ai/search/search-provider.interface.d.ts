/**
 * @file search-provider.interface.ts
 * @description Search provider interface for web search
 * @module ai/search
 */
export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    source?: string;
}
export interface ISearchProvider {
    /**
     * Search the web for information
     */
    search(query: string, maxResults?: number): Promise<SearchResult[]>;
    /**
     * Check if the provider is available
     */
    isAvailable(): boolean;
    /**
     * Get the provider name
     */
    getProviderName(): string;
}
//# sourceMappingURL=search-provider.interface.d.ts.map