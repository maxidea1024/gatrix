import api from './api';

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  author?: string;
  publishedTime?: string;
  readingTime?: string;
  favicon?: string;
  type?: string;
}

export interface LinkPreviewResponse {
  success: boolean;
  data?: LinkPreviewData;
  error?: string;
}

class LinkPreviewService {
  private cache = new Map<string, LinkPreviewData>();
  private pendingRequests = new Map<string, Promise<LinkPreviewData | null>>();

  /**
   * Fetch link preview data
   */
  async getPreview(url: string): Promise<LinkPreviewData | null> {
    // Check in cache
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    // Check if already requesting
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url)!;
    }

    // Create new request
    const request = this.fetchPreview(url);
    this.pendingRequests.set(url, request);

    try {
      const result = await request;

      // Save to cache if successful
      if (result) {
        this.cache.set(url, result);
      }

      return result;
    } finally {
      // Remove from pending list after request completes
      this.pendingRequests.delete(url);
    }
  }

  /**
   * Perform actual API call
   */
  private async fetchPreview(url: string): Promise<LinkPreviewData | null> {
    try {
      const response = await api.post<LinkPreviewResponse>('/link-preview', {
        url,
      });

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch link preview:', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove cache for specific URL
   */
  removeCacheEntry(url: string): void {
    this.cache.delete(url);
  }

  /**
   * Return cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Check if URL supports link preview
   */
  isPreviewableUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Support only HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }

      // Exclude image files
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
      const pathname = parsedUrl.pathname.toLowerCase();
      if (imageExtensions.some((ext) => pathname.endsWith(ext))) {
        return false;
      }

      // Exclude video files
      const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv'];
      if (videoExtensions.some((ext) => pathname.endsWith(ext))) {
        return false;
      }

      // Exclude document files
      const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
      if (docExtensions.some((ext) => pathname.endsWith(ext))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract URL from text
   */
  extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches.filter((url) => this.isPreviewableUrl(url)) : [];
  }

  /**
   * Fetch previews for multiple URLs concurrently
   */
  async getMultiplePreviews(urls: string[]): Promise<Map<string, LinkPreviewData | null>> {
    const results = new Map<string, LinkPreviewData | null>();

    // Filter only preview-supported URLs
    const previewableUrls = urls.filter((url) => this.isPreviewableUrl(url));

    // Request all previews concurrently
    const promises = previewableUrls.map(async (url) => {
      const preview = await this.getPreview(url);
      results.set(url, preview);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Convert published time to relative time
   */
  formatPublishedTime(publishedTime: string): string {
    try {
      const date = new Date(publishedTime);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);

      if (diffMinutes < 1) return '방금 전';
      if (diffMinutes < 60) return `${diffMinutes}분 전`;
      if (diffHours < 24) return `${diffHours}시간 전`;
      if (diffDays < 30) return `${diffDays}일 전`;
      if (diffMonths < 12) return `${diffMonths}개월 전`;
      return `${diffYears}년 전`;
    } catch {
      return publishedTime;
    }
  }
}

export const linkPreviewService = new LinkPreviewService();
