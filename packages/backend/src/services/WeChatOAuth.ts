import axios from 'axios';
import { logger } from '../utils/logger';
import config from '../config';

export interface WeChatProfile {
  openid: string;
  nickname: string;
  headimgurl: string;
  sex: number;
  province: string;
  city: string;
  country: string;
}

export interface WeChatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
}

export class WeChatOAuthService {
  private static readonly BASE_URL = 'https://api.weixin.qq.com/sns';
  private static readonly AUTH_URL = 'https://open.weixin.qq.com/connect/qrconnect';

  /**
   * WeChat OAuth 인증 URL 생성
   */
  static getAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      appid: config.oauth.wechat.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'snsapi_login',
      state: state || 'wechat_oauth',
    });

    return `${this.AUTH_URL}?${params.toString()}#wechat_redirect`;
  }

  /**
   * Authorization Code로 Access Token 획득
   */
  static async getAccessToken(code: string): Promise<WeChatTokenResponse> {
    try {
      const params = new URLSearchParams({
        appid: config.oauth.wechat.clientId,
        secret: config.oauth.wechat.clientSecret,
        code,
        grant_type: 'authorization_code',
      });

      const response = await axios.get(`${this.BASE_URL}/oauth2/access_token?${params.toString()}`);
      
      if (response.data.errcode) {
        throw new Error(`WeChat OAuth Error: ${response.data.errmsg}`);
      }

      return response.data;
    } catch (error) {
      logger.error('WeChat OAuth token exchange failed:', error);
      throw error;
    }
  }

  /**
   * Access Token으로 사용자 정보 획득
   */
  static async getUserInfo(accessToken: string, openid: string): Promise<WeChatProfile> {
    try {
      const params = new URLSearchParams({
        access_token: accessToken,
        openid,
        lang: 'zh_CN',
      });

      const response = await axios.get(`${this.BASE_URL}/userinfo?${params.toString()}`);
      
      if (response.data.errcode) {
        throw new Error(`WeChat User Info Error: ${response.data.errmsg}`);
      }

      return response.data;
    } catch (error) {
      logger.error('WeChat user info fetch failed:', error);
      throw error;
    }
  }

  /**
   * 전체 OAuth 플로우 처리
   */
  static async handleOAuthCallback(code: string): Promise<WeChatProfile> {
    const tokenData = await this.getAccessToken(code);
    const userInfo = await this.getUserInfo(tokenData.access_token, tokenData.openid);
    return userInfo;
  }
}
