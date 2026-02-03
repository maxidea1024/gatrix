import express from 'express';
import axios from 'axios';

// 타입은 프런트엔드의 LinkPreview와 호환되도록 정의
interface LinkPreview {
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

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

function getHostname(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function extractMeta(
  html: string,
  name: string,
  attr: 'property' | 'name' = 'property'
): string | undefined {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const m = html.match(re);
  return m ? decodeHTMLEntities(m[1]) : undefined;
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decodeHTMLEntities(m[1]) : undefined;
}

function extractFavicon(html: string, urlStr: string): string | undefined {
  // 우선순위: apple-touch-icon -> icon -> shortcut icon
  const rels = ['apple-touch-icon', 'icon', 'shortcut icon'];
  for (const rel of rels) {
    const re = new RegExp(
      `<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>`,
      'i'
    );
    const m = html.match(re);
    if (m) {
      const href = m[1];
      try {
        const base = new URL(urlStr);
        const abs = new URL(href, base.origin);
        return abs.toString();
      } catch {}
      return href;
    }
  }
  const host = getHostname(urlStr);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : undefined;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function buildPreviewFromHtml(html: string, url: string): LinkPreview {
  const ogTitle = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title', 'name');
  const ogDesc =
    extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description', 'name');
  const ogImage = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image', 'name');
  const ogSite = extractMeta(html, 'og:site_name') || getHostname(url);
  const title = ogTitle || extractTitle(html) || getHostname(url);
  const description = ogDesc;
  const image = ogImage;
  const siteName = ogSite;
  const favicon = extractFavicon(html, url);

  // 유형 추정
  let type: LinkPreview['type'] = 'website';
  const ogType = extractMeta(html, 'og:type');
  if (ogType?.includes('video')) type = 'video';
  else if (ogType?.includes('article')) type = 'article';
  else if (ogType?.includes('image')) type = 'image';

  // YouTube 특화 처리 (썸네일 보장)
  if (/youtu\.be\//.test(url) || /youtube\.com\/(watch\?v=|embed\/)/.test(url)) {
    const idMatch = url.match(/(?:watch\?v=|youtu\.be\/|embed\/)([^&\n?#]+)/);
    const vid = idMatch ? idMatch[1] : undefined;
    if (vid && !image) {
      // 고화질 -> 표준 순으로 시도
      const candidates = [
        `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`,
        `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
      ];
      // 우선 첫 번째를 사용 (프런트에서 onError로 자연 처리)
      return {
        url,
        title: title || 'YouTube 동영상',
        description: description || 'YouTube에서 공유된 동영상입니다.',
        image: candidates[0],
        siteName: 'YouTube',
        type: 'video',
        favicon: 'https://www.youtube.com/favicon.ico',
      };
    }
  }

  return {
    url,
    title,
    description,
    image,
    siteName,
    type,
    favicon,
  };
}

export class LinkPreviewController {
  static async getPreview(req: express.Request, res: express.Response) {
    try {
      const url = (req.body?.url || req.query?.url) as string;
      if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ success: false, error: '유효한 URL이 필요합니다' });
      }

      const response = await axios.get(url, {
        headers: {
          'User-Agent': DEFAULT_UA,
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: 8000,
        maxRedirects: 3,
        // 일부 사이트가 403을 반환하는 경우가 있으므로, 검토 필요
        validateStatus: () => true,
      });

      if (typeof response.data !== 'string') {
        return res.json({
          success: true,
          data: { url, siteName: getHostname(url) } as LinkPreview,
        });
      }

      const html = response.data as string;
      const preview = buildPreviewFromHtml(html, url);
      return res.json({ success: true, data: preview });
    } catch (err: any) {
      return res.status(200).json({
        success: true,
        data: {
          url: req.body?.url || req.query?.url,
          siteName: getHostname(req.body?.url || req.query?.url),
        },
      });
    }
  }

  static async getBatch(req: express.Request, res: express.Response) {
    try {
      const urls = (req.body?.urls as string[]) || [];
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ success: false, error: 'urls 배열이 필요합니다' });
      }

      // 과도한 요청 방지: 최대 10개로 제한
      const limited = urls.slice(0, 10);
      const results = await Promise.all(
        limited.map(async (u) => {
          try {
            const resp = await axios.get(u, {
              headers: {
                'User-Agent': DEFAULT_UA,
                Accept: 'text/html,application/xhtml+xml',
              },
              timeout: 8000,
              maxRedirects: 3,
              validateStatus: () => true,
            });
            const html = typeof resp.data === 'string' ? resp.data : '';
            const data = html
              ? buildPreviewFromHtml(html, u)
              : ({ url: u, siteName: getHostname(u) } as LinkPreview);
            return { url: u, success: true, data };
          } catch (e) {
            return { url: u, success: false, data: null };
          }
        })
      );

      return res.json({ success: true, data: results });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Failed to fetch link previews' });
    }
  }
}

export default LinkPreviewController;
