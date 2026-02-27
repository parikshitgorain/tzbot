/**
 * @file unsplash-provider.ts
 * @description Unsplash image search provider
 * @module ai/image
 */

import { logger, logError } from '@/core/logger/logger.js';

export interface UnsplashImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  description: string | null;
  photographer: string;
  photographerUrl: string;
  downloadUrl: string;
}

export class UnsplashProvider {
  private accessKey: string;
  private baseUrl = 'https://api.unsplash.com';

  constructor(accessKey: string) {
    this.accessKey = accessKey;
  }

  /**
   * Search for images on Unsplash
   */
  async searchImages(query: string, limit: number = 5): Promise<UnsplashImage[]> {
    try {
      const url = `${this.baseUrl}/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}&client_id=${this.accessKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { results?: unknown[] };

      if (!data.results || data.results.length === 0) {
        logger.info('No images found on Unsplash', { query });
        return [];
      }

      const images: UnsplashImage[] = data.results.map((result: unknown) => {
        const img = result as {
          id: string;
          urls: { regular: string; thumb: string };
          description?: string;
          alt_description?: string;
          user: { name: string; links: { html: string } };
          links: { html: string; download_location: string };
        };
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
    } catch (error) {
      logError('Failed to search Unsplash', error as Error, { query });
      return [];
    }
  }

  /**
   * Trigger download tracking (required by Unsplash API guidelines)
   */
  async trackDownload(downloadUrl: string): Promise<void> {
    try {
      await fetch(`${downloadUrl}?client_id=${this.accessKey}`);
    } catch (error) {
      logError('Failed to track Unsplash download', error as Error);
    }
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'Unsplash';
  }
}
