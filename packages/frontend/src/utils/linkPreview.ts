import { LinkPreview } from '../types/chat';

// URL 정규식 패턴
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

// URL에서 미리보기 데이터를 추출하는 함수 (개선된 버전)
export const extractLinkPreview = async (url: string): Promise<LinkPreview | null> => {
  try {
    // 기본 링크 미리보기 객체
    const linkPreview: LinkPreview = {
      url,
      title: extractTitleFromUrl(url),
      description: '',
      siteName: extractSiteNameFromUrl(url)
    };

    // YouTube 링크 처리 (개선됨)
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

    // GitHub 링크 처리 (개선됨)
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

    // Twitter/X 링크 처리 (개선됨)
    else if (isTwitterUrl(url)) {
      linkPreview.siteName = 'X (Twitter)';
      linkPreview.title = 'X (Twitter) 게시물';
      linkPreview.description = 'X(구 Twitter)에서 공유된 게시물입니다.';
      linkPreview.readingTime = '1분';
      linkPreview.type = 'article';
      linkPreview.image = 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png';
      linkPreview.favicon = 'https://twitter.com/favicon.ico';
    }

    // 인기 블로그 플랫폼 및 웹사이트 감지
    else {
      const domain = extractSiteNameFromUrl(url);

      if (domain.includes('medium.com')) {
        linkPreview.siteName = 'Medium';
        linkPreview.description = 'Medium에서 공유된 아티클입니다.';
        linkPreview.type = 'article';
        linkPreview.readingTime = '5-10분';
        linkPreview.favicon = 'https://medium.com/favicon.ico';
      } else if (domain.includes('dev.to')) {
        linkPreview.siteName = 'DEV Community';
        linkPreview.description = 'DEV Community에서 공유된 개발 아티클입니다.';
        linkPreview.type = 'article';
        linkPreview.readingTime = '5-8분';
        linkPreview.favicon = 'https://dev.to/favicon.ico';
      } else if (domain.includes('hashnode.com')) {
        linkPreview.siteName = 'Hashnode';
        linkPreview.description = 'Hashnode에서 공유된 기술 블로그 포스트입니다.';
        linkPreview.type = 'article';
        linkPreview.readingTime = '5-10분';
      } else if (domain.includes('tistory.com')) {
        linkPreview.siteName = 'Tistory';
        linkPreview.description = 'Tistory 블로그 포스트입니다.';
        linkPreview.type = 'article';
        linkPreview.readingTime = '3-7분';
      } else if (domain.includes('velog.io')) {
        linkPreview.siteName = 'velog';
        linkPreview.description = 'velog에서 공유된 개발 블로그 포스트입니다.';
        linkPreview.type = 'article';
        linkPreview.readingTime = '5-10분';
      } else if (domain.includes('notion.so') || domain.includes('notion.site')) {
        linkPreview.siteName = 'Notion';
        linkPreview.description = 'Notion에서 공유된 페이지입니다.';
        linkPreview.readingTime = '5-15분';
        linkPreview.favicon = 'https://www.notion.so/favicon.ico';
      } else {
        // 일반 웹사이트
        linkPreview.description = `${domain}의 웹페이지입니다.`;
        linkPreview.type = 'website';
        linkPreview.readingTime = '3-5분';
      }

      // 파비콘 설정 (기본값)
      if (!linkPreview.favicon) {
        linkPreview.favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      }
    }

    return linkPreview;
  } catch (error) {
    console.error('Failed to extract link preview:', error);
    return null;
  }
};

// 메시지에서 URL 찾기
export const extractUrlsFromMessage = (message: string): string[] => {
  const matches = message.match(URL_REGEX);
  return matches || [];
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
    const pathParts = pathname.split('/').filter(part => part.length > 0);
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
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
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
      repo: match[2].replace(/\.git$/, '') // .git 확장자 제거
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
