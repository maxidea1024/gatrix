import axios from 'axios';
import * as cheerio from 'cheerio';

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  author?: string;
  readingTime?: string;
  publishedTime?: string;
  type?: 'website' | 'article' | 'video' | 'image';
  favicon?: string;
}

export class LinkPreviewService {
  private static readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  private static readonly TIMEOUT = 10000; // 10초

  static async extractPreview(url: string): Promise<LinkPreview | null> {
    try {
      // URL 유효성 검사
      const urlObj = new URL(url);
      
      // 특별 처리가 필요한 사이트들
      if (this.isYouTubeUrl(url)) {
        return this.extractYouTubePreview(url);
      }
      
      if (this.isGitHubUrl(url)) {
        return this.extractGitHubPreview(url);
      }

      // 일반 웹페이지 크롤링
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: this.TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });

      const $ = cheerio.load(response.data);
      
      return {
        url,
        title: this.extractTitle($),
        description: this.extractDescription($),
        image: this.extractImage($, url),
        siteName: this.extractSiteName($, url),
        author: this.extractAuthor($),
        publishedTime: this.extractPublishedTime($),
        readingTime: this.estimateReadingTime($),
        type: this.extractType($),
        favicon: this.extractFavicon($, url),
      };

    } catch (error) {
      console.error('링크 미리보기 추출 실패:', error);
      
      // 기본 정보라도 반환
      try {
        const urlObj = new URL(url);
        return {
          url,
          title: this.extractTitleFromUrl(url),
          siteName: urlObj.hostname.replace('www.', ''),
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
          type: 'website'
        };
      } catch {
        return null;
      }
    }
  }

  private static extractTitle($: cheerio.CheerioAPI): string | undefined {
    // Open Graph 제목
    let title = $('meta[property="og:title"]').attr('content');
    if (title) return title.trim();

    // Twitter Card 제목
    title = $('meta[name="twitter:title"]').attr('content');
    if (title) return title.trim();

    // HTML title 태그
    title = $('title').text();
    if (title) return title.trim();

    // h1 태그
    title = $('h1').first().text();
    if (title) return title.trim();

    return undefined;
  }

  private static extractDescription($: cheerio.CheerioAPI): string | undefined {
    // Open Graph 설명
    let description = $('meta[property="og:description"]').attr('content');
    if (description) return description.trim();

    // Twitter Card 설명
    description = $('meta[name="twitter:description"]').attr('content');
    if (description) return description.trim();

    // Meta description
    description = $('meta[name="description"]').attr('content');
    if (description) return description.trim();

    // 첫 번째 p 태그
    description = $('p').first().text();
    if (description && description.length > 50) {
      return description.trim().substring(0, 200) + '...';
    }

    return undefined;
  }

  private static extractImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    // Open Graph 이미지
    let image = $('meta[property="og:image"]').attr('content');
    if (image) return this.resolveUrl(image, baseUrl);

    // Twitter Card 이미지
    image = $('meta[name="twitter:image"]').attr('content');
    if (image) return this.resolveUrl(image, baseUrl);

    // 첫 번째 큰 이미지 찾기
    const images = $('img').toArray();
    for (const img of images) {
      const src = $(img).attr('src');
      const width = parseInt($(img).attr('width') || '0');
      const height = parseInt($(img).attr('height') || '0');
      
      if (src && (width >= 200 || height >= 200 || (!width && !height))) {
        return this.resolveUrl(src, baseUrl);
      }
    }

    return undefined;
  }

  private static extractSiteName($: cheerio.CheerioAPI, url: string): string | undefined {
    // Open Graph 사이트명
    let siteName = $('meta[property="og:site_name"]').attr('content');
    if (siteName) return siteName.trim();

    // Twitter Card 사이트
    siteName = $('meta[name="twitter:site"]').attr('content');
    if (siteName) return siteName.replace('@', '').trim();

    // URL에서 추출
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return undefined;
    }
  }

  private static extractAuthor($: cheerio.CheerioAPI): string | undefined {
    // Open Graph 작성자
    let author = $('meta[property="article:author"]').attr('content');
    if (author) return author.trim();

    // Twitter Card 작성자
    author = $('meta[name="twitter:creator"]').attr('content');
    if (author) return author.replace('@', '').trim();

    // Meta author
    author = $('meta[name="author"]').attr('content');
    if (author) return author.trim();

    // JSON-LD 구조화 데이터
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        if (data.author && typeof data.author === 'string') {
          return data.author;
        }
        if (data.author && data.author.name) {
          return data.author.name;
        }
      } catch {}
    }

    return undefined;
  }

  private static extractPublishedTime($: cheerio.CheerioAPI): string | undefined {
    // Open Graph 발행시간
    let publishedTime = $('meta[property="article:published_time"]').attr('content');
    if (publishedTime) return new Date(publishedTime).toLocaleDateString('ko-KR');

    // Meta 발행시간
    publishedTime = $('meta[name="publish_date"]').attr('content');
    if (publishedTime) return new Date(publishedTime).toLocaleDateString('ko-KR');

    // time 태그
    const timeElement = $('time[datetime]').first();
    if (timeElement.length) {
      const datetime = timeElement.attr('datetime');
      if (datetime) return new Date(datetime).toLocaleDateString('ko-KR');
    }

    return undefined;
  }

  private static estimateReadingTime($: cheerio.CheerioAPI): string | undefined {
    // 본문 텍스트 추출
    const content = $('article, .content, .post-content, .entry-content, main, .main').text() || $('body').text();
    
    if (!content) return undefined;

    // 단어 수 계산 (한국어 고려)
    const words = content.trim().split(/\s+/).length;
    const koreanChars = (content.match(/[가-힣]/g) || []).length;
    
    // 읽기 속도: 영어 200단어/분, 한국어 300자/분
    const englishReadingTime = words / 200;
    const koreanReadingTime = koreanChars / 300;
    
    const totalMinutes = Math.max(englishReadingTime, koreanReadingTime);
    
    if (totalMinutes < 1) return '1분';
    if (totalMinutes < 5) return `${Math.ceil(totalMinutes)}분`;
    if (totalMinutes < 10) return `${Math.ceil(totalMinutes / 5) * 5}분`;
    
    return `${Math.ceil(totalMinutes / 5) * 5}분`;
  }

  private static extractType($: cheerio.CheerioAPI): 'website' | 'article' | 'video' | 'image' {
    // Open Graph 타입
    const ogType = $('meta[property="og:type"]').attr('content');
    if (ogType) {
      if (ogType.includes('article')) return 'article';
      if (ogType.includes('video')) return 'video';
      if (ogType.includes('image')) return 'image';
    }

    // 구조화 데이터에서 타입 추출
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        if (data['@type'] === 'Article' || data['@type'] === 'BlogPosting') {
          return 'article';
        }
        if (data['@type'] === 'VideoObject') {
          return 'video';
        }
      } catch {}
    }

    // article 태그가 있으면 아티클
    if ($('article').length > 0) return 'article';

    return 'website';
  }

  private static extractFavicon($: cheerio.CheerioAPI, url: string): string | undefined {
    // 다양한 파비콘 링크 찾기
    const faviconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]'
    ];

    for (const selector of faviconSelectors) {
      const href = $(selector).attr('href');
      if (href) {
        return this.resolveUrl(href, url);
      }
    }

    // 기본 파비콘 경로
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
    } catch {
      return undefined;
    }
  }

  private static resolveUrl(relativeUrl: string, baseUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  private static extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // 파일명이 있는 경우
      const filename = pathname.split('/').pop();
      if (filename && filename.includes('.')) {
        return filename;
      }
      
      // 경로에서 제목 추출
      const pathParts = pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1].replace(/-|_/g, ' ');
      }
      
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  private static isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
  }

  private static isGitHubUrl(url: string): boolean {
    return /github\.com/.test(url);
  }

  private static extractYouTubePreview(url: string): LinkPreview {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1];
    
    return {
      url,
      title: 'YouTube 동영상',
      description: 'YouTube에서 공유된 동영상입니다.',
      image: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : undefined,
      siteName: 'YouTube',
      type: 'video',
      readingTime: '동영상',
      favicon: 'https://www.youtube.com/favicon.ico'
    };
  }

  private static extractGitHubPreview(url: string): LinkPreview {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    
    if (match) {
      const [, owner, repo] = match;
      return {
        url,
        title: `${owner}/${repo}`,
        description: 'GitHub에서 호스팅되는 오픈소스 프로젝트입니다.',
        image: `https://opengraph.githubassets.com/1/${owner}/${repo}`,
        siteName: 'GitHub',
        author: owner,
        type: 'website',
        readingTime: '코드 저장소',
        favicon: 'https://github.com/favicon.ico'
      };
    }

    return {
      url,
      title: 'GitHub Repository',
      description: 'GitHub 저장소입니다.',
      siteName: 'GitHub',
      type: 'website',
      favicon: 'https://github.com/favicon.ico'
    };
  }
}
