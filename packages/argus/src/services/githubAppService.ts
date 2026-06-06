import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import db from '../config/knex';

export class GithubAppService {
  private static async getAppCredentials(): Promise<{ app_id: string; private_key: string } | null> {
    const rows = await db('g_argus_global_integrations')
      .select('credentials')
      .where({ provider: 'github', is_active: 1 })
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials;
  }

  static async generateAppJwt(): Promise<string> {
    const creds = await this.getAppCredentials();
    if (!creds || !creds.app_id || !creds.private_key) {
      throw new Error('GitHub App credentials not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds in the past to allow for clock drift
      exp: now + (10 * 60), // Expires in 10 minutes
      iss: creds.app_id
    };

    return jwt.sign(payload, creds.private_key, { algorithm: 'RS256' });
  }

  static async getInstallationToken(installationId: string): Promise<string> {
    const token = await this.generateAppJwt();
    const response = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      null,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );
    return response.data.token;
  }

  static async getAccessibleRepositories(installationId: string) {
    const token = await this.getInstallationToken(installationId);
    const response = await axios.get('https://api.github.com/installation/repositories', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
    return response.data.repositories;
  }
}
