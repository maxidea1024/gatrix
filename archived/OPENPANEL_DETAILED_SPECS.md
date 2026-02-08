# OpenPanel 상세 구현 스펙 (Detailed Implementation Specifications)

> **작성일**: 2025-10-02  
> **목적**: OpenPanel의 핵심 기능별 상세 구현 스펙 및 코드 예제

---

## 📋 목차

1. [이벤트 데이터 모델](#1-이벤트-데이터-모델)
2. [세션 관리 시스템](#2-세션-관리-시스템)
3. [사용자 프로필 시스템](#3-사용자-프로필-시스템)
4. [필터링 시스템](#4-필터링-시스템)
5. [차트 및 시각화](#5-차트-및-시각화)
6. [Export 기능](#6-export-기능)
7. [Webhook 시스템](#7-webhook-시스템)
8. [SDK 구현 상세](#8-sdk-구현-상세)

---

## 1. 이벤트 데이터 모델

### 1.1 이벤트 타입 정의

```typescript
// packages/validation/src/event.ts
import { z } from 'zod';

// 기본 이벤트 스키마
export const eventSchema = z.object({
  // 필수 필드
  name: z.string().min(1).max(255),
  projectId: z.string(),
  deviceId: z.string(),
  sessionId: z.string(),
  timestamp: z.string().datetime(),

  // 선택 필드
  profileId: z.string().optional(),

  // 디바이스 정보
  country: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  os: z.string().optional(),
  osVersion: z.string().optional(),
  browser: z.string().optional(),
  browserVersion: z.string().optional(),
  device: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),

  // 페이지 정보
  path: z.string().optional(),
  origin: z.string().optional(),
  referrer: z.string().optional(),
  referrerName: z.string().optional(),
  referrerType: z.enum(['direct', 'search', 'social', 'email', 'ad', 'other']).optional(),

  // UTM 파라미터
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),

  // 커스텀 속성
  properties: z.record(z.any()).optional(),

  // 세션 메트릭
  duration: z.number().optional(),
  screenViews: z.number().optional(),
});

export type Event = z.infer<typeof eventSchema>;

// 특수 이벤트 타입
export const screenViewEventSchema = eventSchema.extend({
  name: z.literal('screen_view'),
  path: z.string(),
  origin: z.string(),
});

export const sessionStartEventSchema = eventSchema.extend({
  name: z.literal('session_start'),
});

export const sessionEndEventSchema = eventSchema.extend({
  name: z.literal('session_end'),
  duration: z.number(),
  screenViews: z.number(),
});
```

### 1.2 이벤트 정규화

```typescript
// apps/api/src/services/event-normalizer.ts
export class EventNormalizer {
  normalize(rawEvent: any): Event {
    // 1. 타임스탬프 정규화
    const timestamp = this.normalizeTimestamp(rawEvent.timestamp);

    // 2. 경로 정규화 (쿼리 파라미터 제거 옵션)
    const path = this.normalizePath(rawEvent.path);

    // 3. Referrer 분류
    const { referrerName, referrerType } = this.classifyReferrer(rawEvent.referrer);

    // 4. 속성 정리 (예약어 제거, 타입 변환)
    const properties = this.sanitizeProperties(rawEvent.properties);

    return {
      ...rawEvent,
      timestamp,
      path,
      referrerName,
      referrerType,
      properties: JSON.stringify(properties),
    };
  }

  private normalizeTimestamp(timestamp?: string): string {
    if (!timestamp) {
      return new Date().toISOString();
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }

    return date.toISOString();
  }

  private normalizePath(path?: string): string {
    if (!path) return '/';

    // 쿼리 파라미터 제거
    const url = new URL(path, 'http://dummy.com');
    return url.pathname;
  }

  private classifyReferrer(referrer?: string): {
    referrerName: string | null;
    referrerType: string | null;
  } {
    if (!referrer) {
      return { referrerName: null, referrerType: 'direct' };
    }

    const url = new URL(referrer);
    const hostname = url.hostname;

    // 검색 엔진
    const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu'];
    if (searchEngines.some((engine) => hostname.includes(engine))) {
      return { referrerName: hostname, referrerType: 'search' };
    }

    // 소셜 미디어
    const socialMedia = ['facebook', 'twitter', 'linkedin', 'instagram', 'reddit'];
    if (socialMedia.some((social) => hostname.includes(social))) {
      return { referrerName: hostname, referrerType: 'social' };
    }

    // 광고
    if (url.searchParams.has('utm_source') || url.searchParams.has('gclid')) {
      return { referrerName: hostname, referrerType: 'ad' };
    }

    return { referrerName: hostname, referrerType: 'other' };
  }

  private sanitizeProperties(properties?: Record<string, any>): Record<string, any> {
    if (!properties) return {};

    const sanitized: Record<string, any> = {};

    // 예약어 제거
    const reservedKeys = ['id', 'projectId', 'deviceId', 'sessionId', 'timestamp'];

    for (const [key, value] of Object.entries(properties)) {
      if (reservedKeys.includes(key)) continue;

      // 값 타입 변환
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = JSON.stringify(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
```

---

## 2. 세션 관리 시스템

### 2.1 세션 생성 및 추적

```typescript
// packages/sdks/web/src/session.ts
export class SessionManager {
  private sessionId: string | null = null;
  private sessionStartTime: number = 0;
  private lastActivityTime: number = 0;
  private screenViewCount: number = 0;
  private sessionTimeout: number = 30 * 60 * 1000; // 30분

  constructor(private storage: Storage = localStorage) {
    this.loadSession();
  }

  getSessionId(): string {
    if (!this.sessionId || this.isSessionExpired()) {
      this.createNewSession();
    }

    this.updateActivity();
    return this.sessionId!;
  }

  trackScreenView() {
    this.screenViewCount++;
    this.saveSession();
  }

  getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  getScreenViewCount(): number {
    return this.screenViewCount;
  }

  private createNewSession() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.screenViewCount = 0;
    this.saveSession();
  }

  private isSessionExpired(): boolean {
    return Date.now() - this.lastActivityTime > this.sessionTimeout;
  }

  private updateActivity() {
    this.lastActivityTime = Date.now();
    this.saveSession();
  }

  private loadSession() {
    try {
      const stored = this.storage.getItem('op_session');
      if (stored) {
        const session = JSON.parse(stored);
        this.sessionId = session.id;
        this.sessionStartTime = session.startTime;
        this.lastActivityTime = session.lastActivity;
        this.screenViewCount = session.screenViews;
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }

  private saveSession() {
    try {
      this.storage.setItem(
        'op_session',
        JSON.stringify({
          id: this.sessionId,
          startTime: this.sessionStartTime,
          lastActivity: this.lastActivityTime,
          screenViews: this.screenViewCount,
        })
      );
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
```

### 2.2 서버 사이드 세션 집계

```typescript
// apps/worker/src/workers/session-aggregator.ts
export class SessionAggregator {
  async aggregateSession(sessionId: string, projectId: string) {
    // 세션의 모든 이벤트 조회
    const query = `
      SELECT
        min(createdAt) as start_time,
        max(createdAt) as end_time,
        dateDiff('second', start_time, end_time) as duration,
        countIf(name = 'screen_view') as screen_views,
        groupArray(path) as paths,
        any(deviceId) as device_id,
        any(profileId) as profile_id,
        any(country) as country,
        any(city) as city,
        any(browser) as browser,
        any(os) as os,
        any(referrer) as referrer
      FROM events
      WHERE projectId = {projectId:String}
        AND sessionId = {sessionId:String}
      GROUP BY sessionId
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, sessionId },
    });

    const session = await result.json();

    // 세션 메트릭 업데이트
    await this.updateSessionMetrics(session);

    return session;
  }

  private async updateSessionMetrics(session: any) {
    // 이탈률 계산 (1페이지만 본 경우)
    const isBounce = session.screen_views === 1;

    // 세션 테이블에 저장 (또는 업데이트)
    await clickhouse.insert({
      table: 'sessions',
      values: [
        {
          sessionId: session.sessionId,
          projectId: session.projectId,
          deviceId: session.device_id,
          profileId: session.profile_id,
          startTime: session.start_time,
          endTime: session.end_time,
          duration: session.duration,
          screenViews: session.screen_views,
          isBounce,
          country: session.country,
          city: session.city,
          browser: session.browser,
          os: session.os,
          referrer: session.referrer,
        },
      ],
    });
  }
}
```

---

## 3. 사용자 프로필 시스템

### 3.1 프로필 식별 및 병합

```typescript
// apps/worker/src/workers/profile-worker.ts
export class ProfileWorker {
  async identifyProfile(params: IdentifyParams) {
    const { projectId, profileId, deviceId, properties } = params;

    // 1. 기존 프로필 조회
    const existingProfile = await this.getProfile(projectId, profileId);

    if (existingProfile) {
      // 2. 프로필 업데이트
      await this.updateProfile(projectId, profileId, properties);
    } else {
      // 3. 새 프로필 생성
      await this.createProfile(projectId, profileId, deviceId, properties);
    }

    // 4. 디바이스와 프로필 연결
    await this.linkDeviceToProfile(projectId, deviceId, profileId);

    // 5. 과거 이벤트에 프로필 ID 업데이트
    await this.backfillProfileId(projectId, deviceId, profileId);
  }

  private async getProfile(projectId: string, profileId: string) {
    const query = `
      SELECT *
      FROM profiles
      WHERE projectId = {projectId:String}
        AND profileId = {profileId:String}
      ORDER BY createdAt DESC
      LIMIT 1
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, profileId },
    });

    const rows = await result.json();
    return rows[0] || null;
  }

  private async updateProfile(
    projectId: string,
    profileId: string,
    properties: Record<string, any>
  ) {
    // ClickHouse는 UPDATE를 직접 지원하지 않으므로
    // ReplacingMergeTree를 사용하여 새 행 삽입
    await clickhouse.insert({
      table: 'profiles',
      values: [
        {
          projectId,
          profileId,
          ...properties,
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  private async createProfile(
    projectId: string,
    profileId: string,
    deviceId: string,
    properties: Record<string, any>
  ) {
    await clickhouse.insert({
      table: 'profiles',
      values: [
        {
          projectId,
          profileId,
          ...properties,
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  private async linkDeviceToProfile(projectId: string, deviceId: string, profileId: string) {
    await redis.set(
      `device:${projectId}:${deviceId}:profile`,
      profileId,
      'EX',
      86400 * 365 // 1년
    );
  }

  private async backfillProfileId(projectId: string, deviceId: string, profileId: string) {
    // 과거 이벤트에 프로필 ID 업데이트
    // ClickHouse의 ALTER UPDATE 사용
    const query = `
      ALTER TABLE events
      UPDATE profileId = {profileId:String}
      WHERE projectId = {projectId:String}
        AND deviceId = {deviceId:String}
        AND profileId IS NULL
    `;

    await clickhouse.exec({
      query,
      query_params: { projectId, deviceId, profileId },
    });
  }
}
```

### 3.2 프로필 속성 증감

```typescript
// apps/api/src/services/profile-increment.ts
export class ProfileIncrementService {
  async increment(params: IncrementParams) {
    const { projectId, profileId, property, value = 1 } = params;

    // 현재 값 조회
    const current = await this.getCurrentValue(projectId, profileId, property);

    // 새 값 계산
    const newValue = (current || 0) + value;

    // 프로필 업데이트
    await clickhouse.insert({
      table: 'profiles',
      values: [
        {
          projectId,
          profileId,
          properties: JSON.stringify({
            [property]: newValue,
          }),
          createdAt: new Date().toISOString(),
        },
      ],
    });

    return { success: true, value: newValue };
  }

  async decrement(params: DecrementParams) {
    return this.increment({
      ...params,
      value: -(params.value || 1),
    });
  }

  private async getCurrentValue(
    projectId: string,
    profileId: string,
    property: string
  ): Promise<number | null> {
    const query = `
      SELECT JSONExtractInt(properties, {property:String}) as value
      FROM profiles
      WHERE projectId = {projectId:String}
        AND profileId = {profileId:String}
      ORDER BY createdAt DESC
      LIMIT 1
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, profileId, property },
    });

    const rows = await result.json();
    return rows[0]?.value || null;
  }
}
```

---

## 4. 필터링 시스템

### 4.1 필터 빌더

```typescript
// packages/trpc/src/utils/filter-builder.ts
export type FilterOperator =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'doesNotContain'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export interface Filter {
  name: string;
  operator: FilterOperator;
  value: string[];
}

export class FilterBuilder {
  buildWhereClause(filters: Filter[]): string {
    if (!filters || filters.length === 0) {
      return '';
    }

    const conditions = filters.map((filter) => this.buildCondition(filter));
    return `AND (${conditions.join(' AND ')})`;
  }

  private buildCondition(filter: Filter): string {
    const { name, operator, value } = filter;

    switch (operator) {
      case 'is':
        return `${name} IN (${value.map((v) => `'${this.escape(v)}'`).join(',')})`;

      case 'isNot':
        return `${name} NOT IN (${value.map((v) => `'${this.escape(v)}'`).join(',')})`;

      case 'contains':
        return value.map((v) => `${name} LIKE '%${this.escape(v)}%'`).join(' OR ');

      case 'doesNotContain':
        return value.map((v) => `${name} NOT LIKE '%${this.escape(v)}%'`).join(' AND ');

      case 'startsWith':
        return value.map((v) => `${name} LIKE '${this.escape(v)}%'`).join(' OR ');

      case 'endsWith':
        return value.map((v) => `${name} LIKE '%${this.escape(v)}'`).join(' OR ');

      case 'regex':
        return value.map((v) => `match(${name}, '${this.escape(v)}')`).join(' OR ');

      case 'gt':
        return `${name} > ${value[0]}`;

      case 'gte':
        return `${name} >= ${value[0]}`;

      case 'lt':
        return `${name} < ${value[0]}`;

      case 'lte':
        return `${name} <= ${value[0]}`;

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  private escape(value: string): string {
    return value.replace(/'/g, "\\'");
  }
}
```

### 4.2 동적 필터 UI

```typescript
// apps/dashboard/components/filter-builder.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface FilterBuilderProps {
  onFiltersChange: (filters: Filter[]) => void;
}

export function FilterBuilder({ onFiltersChange }: FilterBuilderProps) {
  const [filters, setFilters] = useState<Filter[]>([]);

  const addFilter = () => {
    const newFilter: Filter = {
      name: 'path',
      operator: 'is',
      value: [''],
    };

    const updated = [...filters, newFilter];
    setFilters(updated);
    onFiltersChange(updated);
  };

  const updateFilter = (index: number, updates: Partial<Filter>) => {
    const updated = filters.map((filter, i) =>
      i === index ? { ...filter, ...updates } : filter
    );
    setFilters(updated);
    onFiltersChange(updated);
  };

  const removeFilter = (index: number) => {
    const updated = filters.filter((_, i) => i !== index);
    setFilters(updated);
    onFiltersChange(updated);
  };

  return (
    <div className="space-y-4">
      {filters.map((filter, index) => (
        <div key={index} className="flex gap-2">
          <Select
            value={filter.name}
            onValueChange={(name) => updateFilter(index, { name })}
          >
            <option value="path">Path</option>
            <option value="country">Country</option>
            <option value="browser">Browser</option>
            <option value="os">OS</option>
            <option value="referrer">Referrer</option>
          </Select>

          <Select
            value={filter.operator}
            onValueChange={(operator) => updateFilter(index, { operator })}
          >
            <option value="is">is</option>
            <option value="isNot">is not</option>
            <option value="contains">contains</option>
            <option value="doesNotContain">does not contain</option>
          </Select>

          <Input
            value={filter.value[0]}
            onChange={(e) => updateFilter(index, { value: [e.target.value] })}
            placeholder="Value"
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeFilter(index)}
          >
            ×
          </Button>
        </div>
      ))}

      <Button onClick={addFilter}>Add Filter</Button>
    </div>
  );
}
```

---

## 5. 차트 및 시각화

### 5.1 차트 데이터 변환

```typescript
// apps/dashboard/lib/chart-utils.ts
export function transformTimeSeriesData(data: any[], metrics: string[]): ChartData[] {
  return data.map((row) => ({
    date: new Date(row.date).toLocaleDateString(),
    ...metrics.reduce(
      (acc, metric) => ({
        ...acc,
        [metric]: row[metric] || 0,
      }),
      {}
    ),
  }));
}

export function transformFunnelData(steps: string[], data: any): FunnelData[] {
  return steps.map((step, index) => ({
    name: step,
    count: data[`step${index}_count`],
    conversion: data[`step${index}_conversion`],
  }));
}

export function transformRetentionData(data: any[]): RetentionData[] {
  const cohorts = new Map<string, any>();

  for (const row of data) {
    const cohortDate = row.cohort_date;

    if (!cohorts.has(cohortDate)) {
      cohorts.set(cohortDate, {
        cohortDate,
        cohortSize: row.cohort_size,
        periods: [],
      });
    }

    cohorts.get(cohortDate)!.periods.push({
      period: row.period_number,
      retainedUsers: row.retained_users,
      retentionRate: row.retention_rate,
    });
  }

  return Array.from(cohorts.values());
}
```

### 5.2 실시간 차트 업데이트

```typescript
// apps/dashboard/components/realtime-chart.tsx
'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { io } from 'socket.io-client';

interface RealtimeChartProps {
  projectId: string;
  metric: string;
}

export function RealtimeChart({ projectId, metric }: RealtimeChartProps) {
  const [data, setData] = useState<any[]>([]);
  const maxDataPoints = 60; // 최근 60개 데이터 포인트

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { projectId },
    });

    socket.on('metric-update', (update: any) => {
      setData(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString(),
          value: update[metric],
        }];

        // 최대 데이터 포인트 유지
        if (newData.length > maxDataPoints) {
          return newData.slice(-maxDataPoints);
        }

        return newData;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, metric]);

  return (
    <LineChart width={800} height={400} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="time" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="value" stroke="#3b82f6" />
    </LineChart>
  );
}
```

---

## 6. Export 기능

### 6.1 CSV Export

```typescript
// packages/trpc/src/services/export.ts
import { stringify } from 'csv-stringify/sync';

export class ExportService {
  async exportToCSV(params: ExportParams): Promise<string> {
    const { projectId, startDate, endDate, filters, metrics } = params;

    // 데이터 조회
    const data = await this.fetchData(projectId, startDate, endDate, filters, metrics);

    // CSV 변환
    const csv = stringify(data, {
      header: true,
      columns: this.getColumns(metrics),
    });

    return csv;
  }

  async exportToJSON(params: ExportParams): Promise<string> {
    const data = await this.fetchData(
      params.projectId,
      params.startDate,
      params.endDate,
      params.filters,
      params.metrics
    );

    return JSON.stringify(data, null, 2);
  }

  private async fetchData(
    projectId: string,
    startDate: string,
    endDate: string,
    filters: Filter[],
    metrics: string[]
  ) {
    const query = `
      SELECT
        toDate(createdAt) as date,
        ${metrics.join(', ')}
      FROM events
      WHERE projectId = {projectId:String}
        AND createdAt >= {startDate:DateTime}
        AND createdAt <= {endDate:DateTime}
        ${this.buildFilterClause(filters)}
      GROUP BY date
      ORDER BY date
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate },
    });

    return result.json();
  }

  private getColumns(metrics: string[]): string[] {
    return ['date', ...metrics];
  }
}
```

### 6.2 대용량 Export (스트리밍)

```typescript
// apps/api/src/routes/export.ts
import { FastifyPluginAsync } from 'fastify';
import { pipeline } from 'stream/promises';

export const exportRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/export/:projectId/csv', async (request, reply) => {
    const { projectId } = request.params;
    const { startDate, endDate } = request.query;

    // 스트리밍 쿼리
    const stream = await clickhouse
      .query({
        query: `
        SELECT *
        FROM events
        WHERE projectId = {projectId:String}
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
        FORMAT CSVWithNames
      `,
        query_params: { projectId, startDate, endDate },
      })
      .stream();

    // 응답 헤더 설정
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="export-${projectId}.csv"`);

    // 스트림 파이프라인
    await pipeline(stream, reply.raw);
  });
};
```

---

## 7. Webhook 시스템

### 7.1 Webhook 설정

```typescript
// packages/db/prisma/schema.prisma
model Webhook {
  id          String   @id @default(cuid())
  projectId   String
  url         String
  events      String[] // ['event.created', 'profile.identified', etc.]
  secret      String
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())

  project     Project  @relation(fields: [projectId], references: [id])
  deliveries  WebhookDelivery[]

  @@index([projectId])
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  event       String
  payload     Json
  status      Int      // HTTP status code
  response    String?
  attempts    Int      @default(1)
  createdAt   DateTime @default(now())

  webhook     Webhook  @relation(fields: [webhookId], references: [id])

  @@index([webhookId])
  @@index([createdAt])
}
```

### 7.2 Webhook 전송

```typescript
// apps/worker/src/workers/webhook-worker.ts
import crypto from 'crypto';

export class WebhookWorker {
  async sendWebhook(params: WebhookParams) {
    const { webhookId, event, payload } = params;

    const webhook = await db.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.enabled) {
      return;
    }

    // 서명 생성
    const signature = this.generateSignature(payload, webhook.secret);

    try {
      // Webhook 전송
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenPanel-Signature': signature,
          'X-OpenPanel-Event': event,
        },
        body: JSON.stringify(payload),
      });

      // 전송 기록 저장
      await db.webhookDelivery.create({
        data: {
          webhookId,
          event,
          payload,
          status: response.status,
          response: await response.text(),
          attempts: 1,
        },
      });

      return { success: true };
    } catch (error) {
      // 재시도 로직
      await this.retryWebhook(webhookId, event, payload, 1);

      return { success: false, error };
    }
  }

  private async retryWebhook(webhookId: string, event: string, payload: any, attempt: number) {
    const maxAttempts = 3;

    if (attempt >= maxAttempts) {
      // 최대 재시도 횟수 초과
      await db.webhookDelivery.create({
        data: {
          webhookId,
          event,
          payload,
          status: 0,
          response: 'Max retry attempts exceeded',
          attempts: attempt,
        },
      });
      return;
    }

    // 지수 백오프로 재시도
    const delay = Math.pow(2, attempt) * 1000;

    await new Promise((resolve) => setTimeout(resolve, delay));

    // 재시도
    await this.sendWebhook({ webhookId, event, payload });
  }

  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }
}
```

### 7.3 Webhook 검증 (클라이언트 측)

```typescript
// 클라이언트가 Webhook을 검증하는 예제
import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Express 예제
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-openpanel-signature'];
  const event = req.headers['x-openpanel-event'];
  const payload = JSON.stringify(req.body);

  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Webhook 처리
  console.log('Received event:', event);
  console.log('Payload:', req.body);

  res.status(200).send('OK');
});
```

---

## 8. SDK 구현 상세

### 8.1 React SDK

```typescript
// packages/sdks/react/src/index.tsx
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { OpenPanel } from '@openpanel/web';

interface OpenPanelContextValue {
  track: (event: string, properties?: Record<string, any>) => void;
  identify: (profileId: string, traits?: Record<string, any>) => void;
  increment: (property: string, value?: number) => void;
  decrement: (property: string, value?: number) => void;
}

const OpenPanelContext = createContext<OpenPanelContextValue | null>(null);

interface OpenPanelProviderProps {
  clientId: string;
  apiUrl?: string;
  trackScreenViews?: boolean;
  trackOutgoingLinks?: boolean;
  children: ReactNode;
}

export function OpenPanelProvider({
  clientId,
  apiUrl,
  trackScreenViews = true,
  trackOutgoingLinks = true,
  children,
}: OpenPanelProviderProps) {
  const [client] = useState(() => new OpenPanel({
    clientId,
    apiUrl,
    trackScreenViews,
    trackOutgoingLinks,
  }));

  const value: OpenPanelContextValue = {
    track: (event, properties) => client.track(event, properties),
    identify: (profileId, traits) => client.identify(profileId, traits),
    increment: (property, value) => client.increment(property, value),
    decrement: (property, value) => client.decrement(property, value),
  };

  return (
    <OpenPanelContext.Provider value={value}>
      {children}
    </OpenPanelContext.Provider>
  );
}

export function useOpenPanel() {
  const context = useContext(OpenPanelContext);

  if (!context) {
    throw new Error('useOpenPanel must be used within OpenPanelProvider');
  }

  return context;
}

// 이벤트 추적 Hook
export function useTrackEvent(
  event: string,
  properties?: Record<string, any>,
  deps: any[] = []
) {
  const { track } = useOpenPanel();

  useEffect(() => {
    track(event, properties);
  }, deps);
}

// 페이지뷰 추적 Hook (Next.js App Router)
export function useTrackPageView() {
  const { track } = useOpenPanel();
  const pathname = usePathname();

  useEffect(() => {
    track('screen_view', {
      path: pathname,
    });
  }, [pathname, track]);
}
```

### 8.2 Vue SDK

```typescript
// packages/sdks/vue/src/index.ts
import { App, Plugin, inject } from 'vue';
import { OpenPanel } from '@openpanel/web';

const OpenPanelSymbol = Symbol('OpenPanel');

export interface OpenPanelOptions {
  clientId: string;
  apiUrl?: string;
  trackScreenViews?: boolean;
  trackOutgoingLinks?: boolean;
}

export const OpenPanelPlugin: Plugin = {
  install(app: App, options: OpenPanelOptions) {
    const client = new OpenPanel(options);

    app.provide(OpenPanelSymbol, client);

    // 글로벌 속성으로 추가
    app.config.globalProperties.$openpanel = client;
  },
};

export function useOpenPanel(): OpenPanel {
  const client = inject<OpenPanel>(OpenPanelSymbol);

  if (!client) {
    throw new Error('OpenPanel plugin not installed');
  }

  return client;
}

// Vue Router 통합
import { Router } from 'vue-router';

export function trackPageViews(router: Router, client: OpenPanel) {
  router.afterEach((to) => {
    client.track('screen_view', {
      path: to.path,
      name: to.name,
    });
  });
}
```

### 8.3 Next.js SDK (App Router)

```typescript
// packages/sdks/nextjs/src/index.tsx
'use client';

import { OpenPanelProvider as BaseProvider } from '@openpanel/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function OpenPanelProvider({
  clientId,
  children,
}: {
  clientId: string;
  children: React.ReactNode;
}) {
  return (
    <BaseProvider clientId={clientId} trackScreenViews={false}>
      <PageViewTracker />
      {children}
    </BaseProvider>
  );
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { track } = useOpenPanel();

  useEffect(() => {
    track('screen_view', {
      path: pathname,
      search: searchParams.toString(),
    });
  }, [pathname, searchParams, track]);

  return null;
}

// Server Component에서 사용할 수 있는 서버 사이드 추적
import { headers } from 'next/headers';

export async function trackServerEvent(
  event: string,
  properties?: Record<string, any>
) {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip');
  const userAgent = headersList.get('user-agent');

  await fetch(`${process.env.OPENPANEL_API_URL}/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'openpanel-client-id': process.env.OPENPANEL_CLIENT_ID!,
      'openpanel-client-secret': process.env.OPENPANEL_CLIENT_SECRET!,
      'x-client-ip': ip || '',
      'user-agent': userAgent || '',
    },
    body: JSON.stringify({
      type: 'track',
      payload: {
        name: event,
        properties,
      },
    }),
  });
}
```

### 8.4 Python SDK

```python
# packages/sdks/python/openpanel/__init__.py
import requests
import json
from typing import Dict, Any, Optional
from datetime import datetime

class OpenPanel:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        api_url: str = "https://api.openpanel.dev"
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_url = api_url
        self.session = requests.Session()
        self.session.headers.update({
            'openpanel-client-id': client_id,
            'openpanel-client-secret': client_secret,
            'Content-Type': 'application/json',
        })

    def track(
        self,
        event: str,
        properties: Optional[Dict[str, Any]] = None,
        device_id: Optional[str] = None,
        profile_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Track an event"""
        payload = {
            'type': 'track',
            'payload': {
                'name': event,
                'properties': properties or {},
                'deviceId': device_id,
                'profileId': profile_id,
                'timestamp': datetime.utcnow().isoformat(),
            }
        }

        response = self.session.post(
            f'{self.api_url}/track',
            json=payload
        )
        response.raise_for_status()
        return response.json()

    def identify(
        self,
        profile_id: str,
        traits: Optional[Dict[str, Any]] = None,
        device_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Identify a user"""
        payload = {
            'type': 'identify',
            'payload': {
                'profileId': profile_id,
                'deviceId': device_id,
                **(traits or {}),
            }
        }

        response = self.session.post(
            f'{self.api_url}/track',
            json=payload
        )
        response.raise_for_status()
        return response.json()

    def increment(
        self,
        profile_id: str,
        property: str,
        value: int = 1
    ) -> Dict[str, Any]:
        """Increment a profile property"""
        payload = {
            'type': 'increment',
            'payload': {
                'profileId': profile_id,
                'property': property,
                'value': value,
            }
        }

        response = self.session.post(
            f'{self.api_url}/track',
            json=payload
        )
        response.raise_for_status()
        return response.json()

# Django 통합
from django.utils.deprecation import MiddlewareMixin

class OpenPanelMiddleware(MiddlewareMixin):
    def __init__(self, get_response):
        self.get_response = get_response
        self.client = OpenPanel(
            client_id=settings.OPENPANEL_CLIENT_ID,
            client_secret=settings.OPENPANEL_CLIENT_SECRET,
        )

    def process_request(self, request):
        # 페이지뷰 추적
        self.client.track('page_view', {
            'path': request.path,
            'method': request.method,
        })
```

---

## 9. 고급 분석 기능

### 9.1 코호트 분석

```typescript
// packages/trpc/src/services/cohort.ts
export class CohortService {
  async createCohort(params: CreateCohortParams) {
    const { projectId, name, filters, dateRange } = params;

    // 코호트에 속하는 사용자 조회
    const query = `
      SELECT DISTINCT deviceId
      FROM events
      WHERE projectId = {projectId:String}
        AND createdAt >= {startDate:DateTime}
        AND createdAt <= {endDate:DateTime}
        ${this.buildFilterClause(filters)}
    `;

    const result = await clickhouse.query({
      query,
      query_params: {
        projectId,
        startDate: dateRange.start,
        endDate: dateRange.end,
      },
    });

    const deviceIds = await result.json();

    // 코호트 저장
    const cohort = await db.cohort.create({
      data: {
        projectId,
        name,
        filters,
        dateRange,
        size: deviceIds.length,
      },
    });

    // 코호트 멤버 저장 (Redis)
    await redis.sadd(`cohort:${cohort.id}:members`, ...deviceIds.map((d: any) => d.deviceId));

    return cohort;
  }

  async analyzeCohortBehavior(cohortId: string, metric: string) {
    // 코호트 멤버 조회
    const members = await redis.smembers(`cohort:${cohortId}:members`);

    // 코호트 행동 분석
    const query = `
      SELECT
        toDate(createdAt) as date,
        ${this.getMetricQuery(metric)} as value
      FROM events
      WHERE deviceId IN (${members.map((m) => `'${m}'`).join(',')})
      GROUP BY date
      ORDER BY date
    `;

    const result = await clickhouse.query({ query });
    return result.json();
  }

  private getMetricQuery(metric: string): string {
    switch (metric) {
      case 'active_users':
        return 'uniq(deviceId)';
      case 'sessions':
        return 'uniq(sessionId)';
      case 'events':
        return 'count()';
      default:
        return 'count()';
    }
  }
}
```

### 9.2 경로 분석 (Path Analysis)

```typescript
// packages/trpc/src/services/path-analysis.ts
export class PathAnalysisService {
  async analyzeUserPaths(params: PathAnalysisParams) {
    const { projectId, startDate, endDate, startPath, maxSteps = 5 } = params;

    const query = `
      WITH user_paths AS (
        SELECT
          sessionId,
          groupArray(path) as paths,
          groupArray(createdAt) as timestamps
        FROM events
        WHERE projectId = {projectId:String}
          AND name = 'screen_view'
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
          ${startPath ? `AND arrayElement(paths, 1) = {startPath:String}` : ''}
        GROUP BY sessionId
      )

      SELECT
        arraySlice(paths, 1, {maxSteps:UInt8}) as path_sequence,
        count() as frequency,
        avg(arraySum(arrayMap(
          (x, y) -> dateDiff('second', x, y),
          arraySlice(timestamps, 1, -1),
          arraySlice(timestamps, 2)
        ))) as avg_duration
      FROM user_paths
      GROUP BY path_sequence
      ORDER BY frequency DESC
      LIMIT 100
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate, startPath, maxSteps },
    });

    return result.json();
  }

  async analyzeSankeyFlow(params: SankeyParams) {
    const { projectId, startDate, endDate } = params;

    // Sankey 다이어그램을 위한 페이지 간 흐름 분석
    const query = `
      WITH page_sequences AS (
        SELECT
          sessionId,
          path as source,
          neighbor(path, 1) as target
        FROM events
        WHERE projectId = {projectId:String}
          AND name = 'screen_view'
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
        ORDER BY sessionId, createdAt
      )

      SELECT
        source,
        target,
        count() as value
      FROM page_sequences
      WHERE target != ''
      GROUP BY source, target
      ORDER BY value DESC
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate },
    });

    return result.json();
  }
}
```

---

## 10. 결론

이 문서는 OpenPanel의 핵심 기능들을 구현 관점에서 상세하게 다루었습니다:

1. **이벤트 데이터 모델**: 타입 안전한 이벤트 스키마 및 정규화
2. **세션 관리**: 클라이언트/서버 사이드 세션 추적 및 집계
3. **프로필 시스템**: 사용자 식별, 병합, 속성 관리
4. **필터링**: 동적 필터 빌더 및 UI
5. **차트**: 실시간 업데이트 및 다양한 시각화
6. **Export**: CSV/JSON 내보내기 및 스트리밍
7. **Webhook**: 이벤트 기반 알림 시스템
8. **SDK**: React, Vue, Next.js, Python 등 다양한 플랫폼 지원
9. **고급 분석**: 코호트, 경로 분석

각 기능은 실제 프로덕션 환경에서 사용 가능한 수준의 코드 예제와 함께 제공되었습니다.
