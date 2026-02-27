/**
 * @file unsplash-provider.ts
 * @description Unsplash image search provider
 * @module ai/image
 */
import { logger, logError } from '../../core/logger/logger.js';
export class UnsplashProvider {
    accessKey;
    baseUrl = 'https://api.unsplash.com';
    constructor(accessKey) {
        this.accessKey = accessKey;
    }
    /**
     * Search for images on Unsplash
     */
    async searchImages(query, limit = 5) {
        try {
            const url = `${this.baseUrl}/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}&client_id=${this.accessKey}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            if (!data.results || data.results.length === 0) {
                logger.info('No images found on Unsplash', { query });
                return [];
            }
            const images = data.results.map((result) => {
                const img = result;
                return {
                    id: img.id,
                    url: img.urls.regular,
                    thumbnailUrl: img.urls.thumb,
                    description: img.description || img.alt_description || null,
                    photographer: img.user.name,
                    photographerUrl: img.user.links.html,
                    downloadUrl: img.links.download_location,
                };
            });
            logger.info('Images found on Unsplash', {
                query,
                count: images.length,
            });
            return images;
        }
        catch (error) {
            logError('Failed to search Unsplash', error, { query });
            return [];
        }
    }
    /**
     * Trigger download tracking (required by Unsplash API guidelines)
     */
    async trackDownload(downloadUrl) {
        try {
            await fetch(`${downloadUrl}?client_id=${this.accessKey}`);
        }
        catch (error) {
            logError('Failed to track Unsplash download', error);
        }
    }
    /**
     * Get provider name
     */
    getProviderName() {
        return 'Unsplash';
    }
}
//# sourceMappingURL=unsplash-provider.js.map