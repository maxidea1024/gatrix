import { apiClient } from './api';

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
   * 링크 미리보기 데이터를 가져옵니다
   */
  async getPreview(url: string): Promise<LinkPreviewData | null> {
    // 캐시에서 확인
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    // 이미 요청 중인지 확인
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url)!;
    }

    // 새로운 요청 생성
    const request = this.fetchPreview(url);
    this.pendingRequests.set(url, request);

    try {
      const result = await request;
      
      // 성공한 경우 캐시에 저장
      if (result) {
        this.cache.set(url, result);
      }
      
      return result;
    } finally {
      // 요청 완료 후 pending 목록에서 제거
      this.pendingRequests.delete(url);
    }
  }

  /**
   * 실제 API 호출을 수행합니다
   */
  private async fetchPreview(url: string): Promise<LinkPreviewData | null> {
    try {
      const response = await apiClient.post<LinkPreviewResponse>('/link-preview', {
        url
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
   * 캐시를 지웁니다
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 특정 URL의 캐시를 제거합니다
   */
  removeCacheEntry(url: string): void {
    this.cache.delete(url);
  }

  /**
   * 캐시 크기를 반환합니다
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * URL이 링크 미리보기를 지원하는지 확인합니다
   */
  isPreviewableUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // HTTP/HTTPS만 지원
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }

      // 이미지 파일은 제외
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
      const pathname = parsedUrl.pathname.toLowerCase();
      if (imageExtensions.some(ext => pathname.endsWith(ext))) {
        return false;
      }

      // 동영상 파일은 제외
      const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv'];
      if (videoExtensions.some(ext => pathname.endsWith(ext))) {
        return false;
      }

      // 문서 파일은 제외
      const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
      if (docExtensions.some(ext => pathname.endsWith(ext))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 텍스트에서 URL을 추출합니다
   */
  extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches.filter(url => this.isPreviewableUrl(url)) : [];
  }

  /**
   * 여러 URL의 미리보기를 동시에 가져옵니다
   */
  async getMultiplePreviews(urls: string[]): Promise<Map<string, LinkPreviewData | null>> {
    const results = new Map<string, LinkPreviewData | null>();
    
    // 미리보기 가능한 URL만 필터링
    const previewableUrls = urls.filter(url => this.isPreviewableUrl(url));
    
    // 동시에 모든 미리보기 요청
    const promises = previewableUrls.map(async (url) => {
      const preview = await this.getPreview(url);
      results.set(url, preview);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * 발행 시간을 상대적 시간으로 변환합니다
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
