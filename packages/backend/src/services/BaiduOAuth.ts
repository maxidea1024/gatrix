import axios from 'axios';
import logger from '../config/logger';
import config from '../config';

export interface BaiduProfile {
  userid: string;
  username: string;
  realname: string;
  portrait: string;
  userdetail: string;
  birthday: string;
  marriage: string;
  sex: string;
  blood: string;
  constellation: string;
  education: string;
  trade: string;
  job: string;
}

export interface BaiduTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  session_key: string;
  session_secret: string;
}

export class BaiduOAuthService {
  private static readonly BASE_URL = 'https://openapi.baidu.com';
  private static readonly AUTH_URL = 'https://openapi.baidu.com/oauth/2.0/authorize';

  /**
   * Baidu OAuth 인증 URL 생성
   */
  static getAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: config.oauth.baidu.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'basic',
      state: state || 'baidu_oauth',
    });

    return `${this.AUTH_URL}?${params.toString()}`;
  }

  /**
   * Authorization Code로 Access Token 획득
   */
  static async getAccessToken(code: string, redirectUri: string): Promise<BaiduTokenResponse> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.oauth.baidu.clientId,
        client_secret: config.oauth.baidu.clientSecret,
        redirect_uri: redirectUri,
      });

      const response = await axios.post(`${this.BASE_URL}/oauth/2.0/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      if (response.data.error) {
        throw new Error(`Baidu OAuth Error: ${response.data.error_description}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Baidu OAuth token exchange failed:', error);
      throw error;
    }
  }

  /**
   * Access Token으로 사용자 정보 획득
   */
  static async getUserInfo(accessToken: string): Promise<BaiduProfile> {
    try {
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      const response = await axios.get(`${this.BASE_URL}/rest/2.0/passport/users/getInfo?${params.toString()}`);
      
      if (response.data.error) {
        throw new Error(`Baidu User Info Error: ${response.data.error_description}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Baidu user info fetch failed:', error);
      throw error;
    }
  }

  /**
   * 전체 OAuth 플로우 처리
   */
  static async handleOAuthCallback(code: string, redirectUri: string): Promise<BaiduProfile> {
    const tokenData = await this.getAccessToken(code, redirectUri);
    const userInfo = await this.getUserInfo(tokenData.access_token);
    return userInfo;
  }
}
