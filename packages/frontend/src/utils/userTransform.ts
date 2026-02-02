import { User } from "@/types";

// Transform user data from API (snake_case) to frontend (camelCase)
export function transformUser(apiUser: any): User & {
  avatarUrl?: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
} {
  return {
    ...apiUser,
    avatarUrl: apiUser.avatar_url,
    emailVerified: apiUser.email_verified,
    lastLoginAt: apiUser.last_login_at,
    createdAt: apiUser.created_at,
  };
}

// Transform user data from frontend (camelCase) to API (snake_case)
export function transformUserForApi(user: any): any {
  const apiUser = { ...user };

  if (user.avatar_url !== undefined) {
    apiUser.avatar_url = user.avatar_url;
    delete apiUser.avatarUrl;
  }

  if (user.email_verified !== undefined) {
    apiUser.email_verified = user.email_verified;
    delete apiUser.emailVerified;
  }

  if (user.last_login_at !== undefined) {
    apiUser.last_login_at = user.last_login_at;
    delete apiUser.lastLoginAt;
  }

  if (user.created_at !== undefined) {
    apiUser.created_at = user.created_at;
    delete apiUser.createdAt;
  }

  return apiUser;
}
