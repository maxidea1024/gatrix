# Facet → Filter 통합 체크리스트

새 탐색기 페이지를 만들거나, 기존 페이지에서 **패싯 클릭 → 검색 필터 반영이 안 될 때** 이 워크플로우를 따른다.

## 증상

- 사이드바 패싯 클릭 시 pill은 생기지만 결과가 안 바뀜
- Discovered facet 값 추천이 안 나옴
- pill 편집 시 필드 목록이 비어있음
- 볼륨 차트에 필터가 반영 안 됨

## 데이터 흐름 (정상 동작)

```
[Sidebar Facet Click]
  → handleFacetFilter → dslEditorRef.upsertFieldChip(key, values)
  → AQL 직렬화: "server.region:eu-west-1"
  → API 호출: ?search=server.region:eu-west-1
  → Backend: QueryParser(SCHEMA).parse(search) → AST → SQL
  → ClickHouse: mapContains(tags, 'server.region') AND tags['server.region'] = 'eu-west-1'
```

## 체크포인트 (순서대로 확인)

### 1. 백엔드: QueryParser 사용 여부

**파일**: `packages/argus/src/routes/<domain>.ts`

❌ 잘못된 패턴 (단순 ILIKE):
```typescript
if (search)
  conditions.push({ field: 'description', op: 'ILIKE', value: `%${search}%` });
```

✅ 올바른 패턴 (QueryParser):
```typescript
import { QueryParser } from '../utils/queryParser';
import { getBucketingConfig } from '../utils/timeBucket';
import { SPANS_SCHEMA } from '../utils/tableSchemas'; // 해당 도메인 스키마

// ...
const bucket = getBucketingConfig(period, start, end);
const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

const conditions: string[] = [
  'project_id = {projectId:String}',
  timeCond,
];
const params: Record<string, string> = {
  projectId: String(projectId),
  fillStart: String(bucket.queryParams.fillStart),
  fillEnd: String(bucket.queryParams.fillEnd),
};

if (search && typeof search === 'string' && search.trim()) {
  const parser = new QueryParser(SPANS_SCHEMA);
  const ast = parser.parse(search);
  if (ast) {
    const { where } = parser.generateSQL(ast, params);
    if (where) conditions.push(`(${where})`);
  }
}

const result = await optic.rawQuery({ query: sql, params });
```

**핵심**: `optic.query()` 대신 `optic.rawQuery()`를 사용해야 `QueryParser`의 `mapColumns` fallback이 작동함.

**주의**: 해당 라우터의 **모든 엔드포인트** (목록, 샘플, 볼륨 등)를 동일하게 변환해야 함. 하나라도 빠지면 볼륨 차트만 필터 안 되는 등의 부분 장애 발생.

### 2. 백엔드: 테이블 스키마 등록

**파일**: `packages/argus/src/utils/tableSchemas.ts`

새 테이블이면 스키마를 추가한다. **`mapColumns`가 핵심** — 이게 없으면 discovered facet 키를 인식 못함.

```typescript
export const MY_SCHEMA: TableSchema = {
  columns: {
    // 모든 top-level 컬럼 나열
    my_col: 'string',
    duration: 'number',
  },
  mapColumns: [
    { name: 'tags', valueType: 'String' },    // ← 이게 있어야 Map fallback 작동
    { name: 'data', valueType: 'String' },
  ],
  aliases: { /* 선택적 */ },
};
```

### 3. 프론트엔드: AQL 에디터 필드 등록

**파일**: `packages/frontend/src/components/argus/query-aql/fields.ts`

#### 3-1. `ALL_QUERY_FIELDS`에 도메인 전용 필드 추가

```typescript
// ── Span fields ──
{
  key: 'op',
  label: 'aql.field.op',
  type: 'string',
  category: 'trace',
  operators: ['=', '!='],
  searchable: true,
  description: 'aql.field.op.desc',
},
```

#### 3-2. `DOMAIN_CONFIG`의 `pickFields`에 해당 필드 포함

```typescript
export const TRACES_CONFIG: DomainConfig = {
  name: 'traces',
  fields: pickFields([
    'op',           // ← 빠지면 에디터에서 필드 안 보임
    'description',
    'status',
    // ...
  ]),
};
```

### 4. 프론트엔드: `initialFacets` 전달

**파일**: 해당 페이지 컴포넌트 (e.g. `ArgusTraceExplorerPage.tsx`)

`QueryAQLEditor`에 `initialFacets`를 전달해야 에디터가 discovered facet 키를 인식하고, 값 추천과 pill 편집 시 필드 목록에 표시함.

```tsx
// tags state에서 mappedFacets 구성
const mappedFacets = useMemo(() => {
  const result: Record<string, { value: string; count: number }[]> = {};
  // 고정 facet
  if (tags.op?.length) {
    result.op = tags.op.map((v) => ({ value: v.value, count: Number(v.count) || 0 }));
  }
  // discovered facet
  for (const df of discoveredFacets) {
    if (!result[df.key]) {
      result[df.key] = df.values;
    }
  }
  return result;
}, [tags, discoveredFacets]);

// 에디터에 전달
<QueryAQLEditor
  config={TRACES_CONFIG}
  fetchFieldValues={fetchFieldValues}
  initialFacets={mappedFacets}        // ← 이거 빠지면 discovered 필드 추천 안됨
/>
```

### 5. 프론트엔드: `fetchFieldValues` 확장

discovered 태그 키에 대해 값을 반환하도록 fallback 추가:

```typescript
const fetchFieldValues = useCallback(
  async (fieldKey: string): Promise<string[]> => {
    // 고정 필드
    if (fieldKey === 'op' && tags.op) return tags.op.map((x) => x.value);
    // ...

    // Discovered tags — pre-fetched 데이터에서 반환
    if (tags.discovered?.[fieldKey]) {
      return tags.discovered[fieldKey].map((v: any) => v.value);
    }

    return [];
  },
  [projectId, currentPeriod, tags]
);
```

### 6. 프론트엔드: discovered facet key에 접두사 불필요

`QueryParser`의 Map column fallback이 `server.region` 같은 미지의 키를 자동으로 `tags['server.region']`으로 변환하므로, **`tags.` 접두사를 붙이지 않는다.**

```typescript
// ❌
key: `tags.${key}`,

// ✅  
key,
```

## 참조 구현 (정상 작동하는 코드)

| 항목 | 로그 페이지 (참조) | 위치 |
|---|---|---|
| 라우터 | `packages/argus/src/routes/logs.ts` | L73-80 (browse), L141-148 (volume) |
| 스키마 | `packages/argus/src/utils/tableSchemas.ts` | `LOGS_SCHEMA` |
| 필드 설정 | `packages/frontend/src/components/argus/query-aql/fields.ts` | `LOGS_CONFIG` |
| initialFacets | `packages/frontend/src/pages/argus/hooks/useArgusLogs.ts` | `mappedFacets` memo |
| fetchFieldValues | `packages/frontend/src/pages/argus/hooks/useArgusLogs.ts` | L339-354 |
| 페이지 | `packages/frontend/src/pages/argus/ArgusLogsPage.tsx` | L412-413 |

## 빠른 진단

```
문제: 필터 결과 없음
→ 백엔드 로그에서 실행된 SQL 확인
→ `description ILIKE` 보이면 → 체크포인트 1 (QueryParser 미사용)
→ `mapContains` 보이면 → 프론트 문제 (잘못된 key 전달)

문제: 추천값 안 나옴
→ initialFacets 전달 여부 확인 → 체크포인트 4
→ fetchFieldValues에서 discovered fallback 확인 → 체크포인트 5

문제: 필드 목록 안 나옴 (pill 편집 시)
→ DOMAIN_CONFIG에 필드 등록 확인 → 체크포인트 3
→ initialFacets 전달 확인 → 체크포인트 4
```
