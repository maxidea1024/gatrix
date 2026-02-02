export type TokenType = "client" | "server" | "edge" | "all";

export interface ApiAccessToken {
  id: string; // ULID (26 characters)
  tokenName: string;
  description?: string;
  tokenHash: string;
  tokenValue?: string; // Original token value for copying (only in list response)
  tokenType: TokenType;
  allowAllEnvironments: boolean;
  environments?: string[]; // Environment names
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
  allowAllEnvironments?: boolean;
  environments?: string[];
  expiresAt?: string;
}

export interface UpdateTokenRequest {
  tokenName?: string;
  description?: string;
  allowAllEnvironments?: boolean;
  environments?: string[];
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

// 토큰 생성 시 사용하는 별도 타입
export interface TokenCreationResponse {
  token: ApiAccessToken;
  plainToken: string;
}

export interface GetTokensRequest {
  page?: number;
  limit?: number;
  tokenType?: TokenType;
  environment?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface GetTokensResponse {
  data: ApiAccessToken[];
  total: number;
  page: number;
  limit: number;
}
