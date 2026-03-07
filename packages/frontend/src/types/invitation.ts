export interface Invitation {
  id: string;
  token: string;
  email?: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
  usedAt?: string;
  usedBy?: string;
}

// ─── Auto-Join Types ─────────────────────────

export interface AutoJoinRoleBinding {
  roleId: string;
  scopeType: 'org' | 'project';
  scopeId: string;
}

export interface AutoJoinMembership {
  orgId: string;
  projectIds: string[];
  roleBindings: AutoJoinRoleBinding[];
}

export interface AutoJoinConfig {
  memberships: AutoJoinMembership[];
}

// Resolved names returned by the validate API for display on invitation acceptance page
export interface AutoJoinInfoProject {
  projectId: string;
  projectName: string;
  projectDisplayName: string;
}

export interface AutoJoinInfoMembership {
  orgId: string;
  orgName: string;
  orgDisplayName: string;
  projects: AutoJoinInfoProject[];
}

export interface AutoJoinInfo {
  memberships: AutoJoinInfoMembership[];
}

// ─── Request/Response Types ─────────────────────────

export interface CreateInvitationRequest {
  email?: string;
  expirationHours: number;
  autoJoinConfig?: AutoJoinConfig;
}

export interface InvitationResponse {
  invitation: Invitation;
  inviteUrl: string;
}

export enum InvitationDuration {
  HOURS_48 = 48,
  WEEK = 168, // 7 * 24
  MONTH = 720, // 30 * 24
}

export const InvitationDurationLabels = {
  [InvitationDuration.HOURS_48]: '48시간',
  [InvitationDuration.WEEK]: '1주일',
  [InvitationDuration.MONTH]: '1개월',
};
