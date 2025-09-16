export type TokenType = 'client' | 'server';

export interface ApiAccessToken {
  id: number;
  tokenName: string;
  description?: string;
  tokenHash: string;
  tokenType: TokenType;
  environmentId?: number;
  expiresAt?: string;
  lastUsedAt?: string;
  createdBy: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  environment?: {
    id: number;
    environmentName: string;
  };
  creator?: {
    name: string;
    email: string;
  };
  updater?: {
    id: number;
    username: string;
    email: string;
  };
}

export interface CreateTokenRequest {
  tokenName: string;
  description?: string;
  tokenType: TokenType;
  environmentId?: number;
  expiresAt?: string;
}

export interface UpdateTokenRequest {
  tokenName?: string;
  description?: string;
  expiresAt?: string;
}

export interface CreateTokenResponse {
  token: ApiAccessToken;
  plainToken: string;
}

export interface GetTokensRequest {
  page?: number;
  limit?: number;
  tokenType?: TokenType;
  environmentId?: number;
}

export interface GetTokensResponse {
  data: ApiAccessToken[];
  total: number;
  page: number;
  limit: number;
}
