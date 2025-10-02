import { z } from 'zod';

// Event Type
export const eventSchema = z.object({
  type: z.enum(['track', 'identify', 'increment', 'decrement']),
  payload: z.object({
    name: z.string().optional(),
    profileId: z.string().optional(),
    properties: z.record(z.any()).optional(),
    deviceId: z.string().optional(),
    sessionId: z.string().optional(),
    timestamp: z.string().optional(),
  }),
});

export type EventPayload = z.infer<typeof eventSchema>;

// Event Model
export interface Event {
  id?: string;
  projectId: string;
  name: string;
  deviceId: string;
  profileId?: string | null;
  sessionId: string;
  createdAt: string;
  timestamp: string;
  
  // Geo
  country?: string | null;
  city?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  
  // Device
  os?: string | null;
  osVersion?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  device?: string | null;
  brand?: string | null;
  model?: string | null;
  
  // Page
  path?: string | null;
  origin?: string | null;
  referrer?: string | null;
  referrerName?: string | null;
  referrerType?: string | null;
  
  // UTM
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  
  // Custom
  properties?: string;
  
  // Session metrics
  duration?: number | null;
  screenViews?: number | null;
  
  // Raw data
  ip?: string;
  userAgent?: string;
}

// Profile Model
export interface Profile {
  id: string;
  projectId: string;
  profileId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatar?: string | null;
  properties?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
}

// Session Model
export interface Session {
  sessionId: string;
  projectId: string;
  deviceId: string;
  profileId?: string | null;
  startTime: string;
  endTime: string;
  duration: number;
  screenViews: number;
  isBounce: boolean;
  country?: string | null;
  city?: string | null;
  browser?: string | null;
  os?: string | null;
  referrer?: string | null;
  createdAt: string;
}

// Analytics Client
export interface AnalyticsClient {
  id: string;
  name: string;
  type: 'write' | 'read' | 'root';
  projectId: string;
  secret: string;
  cors?: string[];
  createdAt: string;
}

// Analytics Project
export interface AnalyticsProject {
  id: string;
  name: string;
  domain: string;
  userId: number;
  settings?: any;
  createdAt: string;
}

// Metrics
export interface Metrics {
  uniqueVisitors: number;
  totalSessions: number;
  totalScreenViews: number;
  avgSessionDuration: number;
  bounceRate: number;
}

// Time Series Data
export interface TimeSeriesData {
  date: string;
  uniqueVisitors: number;
  totalSessions: number;
  totalEvents: number;
}

// Top Pages
export interface TopPage {
  path: string;
  views: number;
  uniqueVisitors: number;
}

// Funnel Step
export interface FunnelStep {
  name: string;
  count: number;
  conversion: number;
}

// Retention Data
export interface RetentionData {
  cohortDate: string;
  periodNumber: number;
  retainedUsers: number;
  cohortSize: number;
  retentionRate: number;
}

export default {
  eventSchema,
};

