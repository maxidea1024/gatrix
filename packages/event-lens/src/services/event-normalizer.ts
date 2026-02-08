import UAParser from 'ua-parser-js';
import { Event } from '../types';
import logger from '../utils/logger';

export class EventNormalizer {
  normalize(rawEvent: any): Event {
    try {
      // 1. User-Agent 파싱
      const ua = new UAParser(rawEvent.userAgent);
      const browser = ua.getBrowser();
      const os = ua.getOS();
      const device = ua.getDevice();

      // 2. 타임스탬프 정규화
      const timestamp = rawEvent.timestamp
        ? new Date(rawEvent.timestamp).toISOString()
        : new Date().toISOString();

      const createdAt = new Date().toISOString();

      // 3. 경로 정규화
      const path = this.normalizePath(rawEvent.path);

      // 4. Referrer 분류
      const { referrerName, referrerType } = this.classifyReferrer(rawEvent.referrer);

      // 5. UTM 파라미터 추출
      const utmParams = this.extractUTMParams(rawEvent.path);

      return {
        ...rawEvent,
        timestamp,
        createdAt,
        path,
        browser: browser.name || null,
        browserVersion: browser.version || null,
        os: os.name || null,
        osVersion: os.version || null,
        device: this.getDeviceType(device.type),
        brand: device.vendor || null,
        model: device.model || null,
        referrerName,
        referrerType,
        ...utmParams,
        properties: JSON.stringify(rawEvent.properties || {}),
      };
    } catch (error) {
      logger.error('Failed to normalize event', { error, rawEvent });
      throw error;
    }
  }

  private normalizePath(path?: string): string {
    if (!path) return '/';

    try {
      const url = new URL(path, 'http://dummy.com');
      return url.pathname;
    } catch {
      return path;
    }
  }

  private classifyReferrer(referrer?: string): {
    referrerName: string | null;
    referrerType: string | null;
  } {
    if (!referrer) {
      return { referrerName: null, referrerType: 'direct' };
    }

    try {
      const url = new URL(referrer);
      const hostname = url.hostname;

      // 검색 엔진
      const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'naver', 'daum'];
      if (searchEngines.some((engine) => hostname.includes(engine))) {
        return { referrerName: hostname, referrerType: 'search' };
      }

      // 소셜 미디어
      const socialMedia = ['facebook', 'twitter', 'linkedin', 'instagram', 'reddit', 'youtube'];
      if (socialMedia.some((social) => hostname.includes(social))) {
        return { referrerName: hostname, referrerType: 'social' };
      }

      // 광고
      if (
        url.searchParams.has('utm_source') ||
        url.searchParams.has('gclid') ||
        url.searchParams.has('fbclid')
      ) {
        return { referrerName: hostname, referrerType: 'ad' };
      }

      return { referrerName: hostname, referrerType: 'other' };
    } catch {
      return { referrerName: null, referrerType: 'other' };
    }
  }

  private getDeviceType(type?: string): string {
    if (!type) return 'desktop';
    if (type === 'mobile') return 'mobile';
    if (type === 'tablet') return 'tablet';
    return 'desktop';
  }

  private extractUTMParams(path?: string): {
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
  } {
    if (!path) return {};

    try {
      const url = new URL(path, 'http://dummy.com');
      return {
        utmSource: url.searchParams.get('utm_source') || null,
        utmMedium: url.searchParams.get('utm_medium') || null,
        utmCampaign: url.searchParams.get('utm_campaign') || null,
        utmTerm: url.searchParams.get('utm_term') || null,
        utmContent: url.searchParams.get('utm_content') || null,
      };
    } catch {
      return {};
    }
  }
}

export default EventNormalizer;
