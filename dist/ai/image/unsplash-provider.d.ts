/**
 * @file unsplash-provider.ts
 * @description Unsplash image search provider
 * @module ai/image
 */
export interface UnsplashImage {
    id: string;
    url: string;
    thumbnailUrl: string;
    description: string | null;
    photographer: string;
    photographerUrl: string;
    downloadUrl: string;
}
export declare class UnsplashProvider {
    private accessKey;
    private baseUrl;
    constructor(accessKey: string);
    /**
     * Search for images on Unsplash
     */
    searchImages(query: string, limit?: number): Promise<UnsplashImage[]>;
    /**
     * Trigger download tracking (required by Unsplash API guidelines)
     */
    trackDownload(downloadUrl: string): Promise<void>;
    /**
     * Get provider name
     */
    getProviderName(): string;
}
//# sourceMappingURL=unsplash-provider.d.ts.map