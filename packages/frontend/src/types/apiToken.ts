export type TokenType = 'client' | 'server' | 'edge';

export interface ApiAccessToken {
  id: string; // ULID (26 characters)
  projectId?: string;
  tokenName: string;
  description?: string;
  tokenHash: string;
  tokenValue?: string; // Original token value for copying (only in list response)
  tokenType: TokenType;
  environmentId?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount?: number;
  createdBy: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;

  // Relations
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
  environmentId?: string;
  expiresAt?: string;
  projectId?: string;
}

export interface UpdateTokenRequest {
  tokenName?: string;
  description?: string;
  environmentId?: string;
  expiresAt?: string;
}

export interface CreateTokenResponse {
  success: boolean;
  data: {
    id: string; // ULID
    tokenName: string;
    tokenType: string;
    tokenValue: string; // 백엔드에서 반환하는 실제 필드명
    expiresAt?: string;
    updatedAt: string;
  };
}

// 토큰 Create 시 Used하는 별도 Type
export interface TokenCreationResponse {
  token: ApiAccessToken;
  plainToken: string;
}

export interface GetTokensRequest {
  page?: number;
  limit?: number;
  tokenType?: TokenType;
  environmentId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  projectId?: string;
}

export interface GetTokensResponse {
  data: ApiAccessToken[];
  total: number;
  page: number;
  limit: number;
}
