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

export interface CreateInvitationRequest {
  email?: string;
  expirationHours: number;
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
  [InvitationDuration.HOURS_48]: "48시간",
  [InvitationDuration.WEEK]: "1주일",
  [InvitationDuration.MONTH]: "1개월",
};
