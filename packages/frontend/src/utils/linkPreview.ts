import { LinkPreview } from '../types/chat';
import { apiService } from '../services/api';

// URL 정규식 패턴
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

// 캐시 저장소 (메모리 캐시)
const previewCache = new Map<string, { data: LinkPreview; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1시간

// URL에서 미리보기 데이터를 추출하는 함수 (백엔드 API 사용)
export const extractLinkPreview = async (url: string): Promise<LinkPreview | null> => {
  try {
    // 캐시 확인
    const cached = previewCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // 백엔드 API 호출
    const response = await apiService.post<{
      success: boolean;
      data: LinkPreview;
    }>('/link-preview', {
      url,
    });

    if (response.success && response.data) {
      // 캐시에 저장
      previewCache.set(url, {
        data: response.data,
        timestamp: Date.now(),
      });

      return response.data;
    }

    // API 실패 시 클라이언트 사이드 폴백
    return extractLinkPreviewFallback(url);
  } catch (error) {
    console.error('백엔드 링크 미리보기 API 실패, 폴백 사용:', error);

    // 백엔드 API 실패 시 클라이언트 사이드 폴백
    return extractLinkPreviewFallback(url);
  }
};

// 클라이언트 사이드 폴백 함수 (기존 로직)
const extractLinkPreviewFallback = async (url: string): Promise<LinkPreview | null> => {
  try {
    // 기본 링크 미리보기 객체
    const linkPreview: LinkPreview = {
      url,
      title: extractTitleFromUrl(url),
      description: '',
      siteName: extractSiteNameFromUrl(url),
    };

    // YouTube 링크 처리
    if (isYouTubeUrl(url)) {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        linkPreview.title = 'YouTube 동영상';
        linkPreview.image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        linkPreview.siteName = 'YouTube';
        linkPreview.description = 'YouTube에서 공유된 동영상입니다.';
        linkPreview.author = 'YouTube';
        linkPreview.readingTime = '동영상';
        linkPreview.type = 'video';
        linkPreview.favicon = 'https://www.youtube.com/favicon.ico';
      }
    }

    // GitHub 링크 처리
    else if (isGitHubUrl(url)) {
      const repoInfo = extractGitHubRepoInfo(url);
      if (repoInfo) {
        linkPreview.siteName = 'GitHub';
        linkPreview.title = `${repoInfo.owner}/${repoInfo.repo}`;
        linkPreview.description = 'GitHub에서 호스팅되는 오픈소스 프로젝트입니다.';
        linkPreview.author = repoInfo.owner;
        linkPreview.readingTime = '코드 저장소';
        linkPreview.type = 'website';
        linkPreview.image = `https://opengraph.githubassets.com/1/${repoInfo.owner}/${repoInfo.repo}`;
        linkPreview.favicon = 'https://github.com/favicon.ico';
      }
    }

    // 기본 처리
    else {
      const domain = extractSiteNameFromUrl(url);
      linkPreview.description = `${domain}의 웹페이지입니다.`;
      linkPreview.type = 'website';
      linkPreview.favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }

    return linkPreview;
  } catch (error) {
    console.error('폴백 링크 미리보기 실패:', error);
    return null;
  }
};

// 메시지에서 URL 찾기
export const extractUrlsFromMessage = (message: string): string[] => {
  const matches = message.match(URL_REGEX);
  return matches || [];
};

// 여러 URL 일괄 처리
export const extractMultipleLinkPreviews = async (urls: string[]): Promise<LinkPreview[]> => {
  if (urls.length === 0) return [];

  try {
    // 캐시된 결과 확인
    const cachedResults: LinkPreview[] = [];
    const uncachedUrls: string[] = [];

    urls.forEach((url) => {
      const cached = previewCache.get(url);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        cachedResults.push(cached.data);
      } else {
        uncachedUrls.push(url);
      }
    });

    // 캐시되지 않은 URL들만 API 호출
    if (uncachedUrls.length > 0) {
      const response = await apiService.post<{
        success: boolean;
        data: Array<{
          url: string;
          success: boolean;
          data: LinkPreview | null;
        }>;
      }>('/link-preview/batch', {
        urls: uncachedUrls,
      });

      if (response.success && response.data) {
        response.data.forEach((result) => {
          if (result.success && result.data) {
            // 캐시에 저장
            previewCache.set(result.url, {
              data: result.data,
              timestamp: Date.now(),
            });
            cachedResults.push(result.data);
          }
        });
      }
    }

    return cachedResults;
  } catch (error) {
    console.error('일괄 링크 미리보기 실패:', error);

    // 폴백: 개별적으로 처리
    const results = await Promise.allSettled(urls.map((url) => extractLinkPreviewFallback(url)));

    return results
      .filter(
        (result): result is PromiseFulfilledResult<LinkPreview> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map((result) => result.value);
  }
};

// URL에서 제목 추출 (간단한 버전)
const extractTitleFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // 파일명이 있는 경우
    const filename = pathname.split('/').pop();
    if (filename && filename.includes('.')) {
      return filename;
    }

    // 경로에서 제목 추출
    const pathParts = pathname.split('/').filter((part) => part.length > 0);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].replace(/-|_/g, ' ');
    }

    return urlObj.hostname;
  } catch {
    return url;
  }
};

// URL에서 사이트명 추출
const extractSiteNameFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
};

// YouTube URL 확인
const isYouTubeUrl = (url: string): boolean => {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
};

// YouTube 비디오 ID 추출
const extractYouTubeVideoId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
  );
  return match ? match[1] : null;
};

// GitHub URL 확인
const isGitHubUrl = (url: string): boolean => {
  return /github\.com/.test(url);
};

// GitHub 저장소 정보 추출 (개선됨)
const extractGitHubRepoInfo = (url: string): { owner: string; repo: string } | null => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''), // .git 확장자 제거
    };
  }
  return null;
};

// GitHub 저장소명 추출 (하위 호환성을 위해 유지)
const extractGitHubRepoName = (url: string): string => {
  const repoInfo = extractGitHubRepoInfo(url);
  return repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : 'GitHub Repository';
};

// Twitter URL 확인
const isTwitterUrl = (url: string): boolean => {
  return /(?:twitter\.com|x\.com)/.test(url);
};

// 이미지 URL 확인
export const isImageUrl = (url: string): boolean => {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
};

// 비디오 URL 확인
export const isVideoUrl = (url: string): boolean => {
  return /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(url);
};
