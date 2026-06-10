# Lazy Loading 원칙

이 프로젝트는 **Lazy Loading을 기본 원칙**으로 합니다.

## 핵심 원칙

- 데이터를 미리 한꺼번에 가져오지 않는다.
- **필요한 시점에, 필요한 데이터만** API에서 가져온다.
- 목록(List)에서는 최소한의 요약 정보만 표시하고, 상세(Detail)는 사용자가 선택했을 때 별도 API로 가져온다.

## 적용 패턴

### 1. 목록 → 상세 패턴

목록 API에서 가져온 데이터를 상세보기에 그대로 사용하지 않는다. 상세보기는 별도의 Detail API를 호출한다.

```
❌ 잘못된 패턴 (동기적 접근)
- 목록 API 호출 → logs[] 배열에 전체 데이터 저장
- 사용자가 로그 클릭 → logs[index]에서 직접 꺼내서 사이드 패널에 표시

✅ 올바른 패턴 (Lazy Loading)
- 목록 API 호출 → logs[] 배열에 요약 데이터만 저장
- 사용자가 로그 클릭 → Detail API 호출 → 로딩 상태 표시 → 상세 데이터 표시
```

### 2. 탭/패널 패턴

탭이나 패널이 여러 개인 경우, 보이지 않는 탭의 데이터를 미리 가져오지 않는다.

```
❌ 페이지 로드 시 모든 탭 데이터를 한 번에 fetch
✅ 사용자가 탭을 클릭했을 때 해당 탭의 데이터를 fetch
```

### 3. 무한 스크롤 / 페이지네이션

전체 데이터를 한 번에 가져오지 않고, 스크롤이나 페이지 전환 시 다음 데이터를 가져온다.

---

## 구현 가이드 (프론트엔드)

### Step 1: 서비스 메서드에 AbortSignal 지원

상세 API 호출은 반드시 `AbortSignal`을 지원해야 한다. 로딩 중 다른 항목을 선택하면 이전 요청을 취소해야 한다.

```tsx
// argusService.ts
async getLogDetail(
  projectId: number | string,
  logId: string,
  signal?: AbortSignal
): Promise<ArgusLogEntry | null> {
  try {
    const response = await argusApi.get(
      `${ARGUS_BASE}/${projectId}/logs/detail/${logId}`,
      { signal }
    );
    return response.data?.data || response.data || null;
  } catch {
    return null;
  }
}
```

### Step 2: Hook에서 AbortController + Race Condition Guard

`useEffect` 안에서 `AbortController`로 이전 요청을 취소하고, `useRef`로 현재 기대하는 ID를 추적하여 race condition을 방지한다.

```tsx
// ✅ 올바른 패턴
const [selectedLog, setSelectedLog] = useState<ArgusLogEntry | null>(null);
const [selectedLogLoading, setSelectedLogLoading] = useState(false);
const expectedLogIdRef = useRef<string | null>(null);

useEffect(() => {
  const logId = urlState.log;
  expectedLogIdRef.current = logId || null;

  if (!logId) {
    setSelectedLog(null);
    setSelectedLogLoading(false);
    return;
  }

  // 이전 데이터를 즉시 제거하여 stale data flash 방지
  setSelectedLog(null);
  setSelectedLogLoading(true);

  const abortController = new AbortController();

  argusService
    .getLogDetail(projectId, logId, abortController.signal)
    .then((detail) => {
      // 아직 이 logId가 기대되는 항목인지 확인 (race condition guard)
      if (expectedLogIdRef.current === logId) {
        setSelectedLog(detail);
        setSelectedLogLoading(false);
      }
    })
    .catch(() => {
      if (expectedLogIdRef.current === logId) {
        setSelectedLogLoading(false);
      }
    });

  return () => {
    abortController.abort();
  };
}, [urlState.log, projectId]);
```

**⚠️ 필수 체크리스트:**
- `AbortController` — cleanup에서 이전 요청 abort
- `expectedIdRef` — resolve 시점에 여전히 기대하는 ID인지 확인
- `setSelectedLog(null)` — 새 로딩 시작 시 이전 데이터 즉시 제거
- `.catch()` — abort된 요청의 에러 핸들링

### Step 3: PageContentLoader로 로딩 UI 표시

`PageContentLoader`를 사용하여 로딩 상태를 표시한다. **스켈레톤은 사용하지 않는다** — 기본 LottieLoader 스피너만 사용.

```tsx
// ✅ 올바른 패턴 — PageContentLoader + null guard
<PageContentLoader loading={loading} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
  {data && (
    <>
      {/* data에 의존하는 모든 JSX */}
      <Header data={data} />
      <Content data={data} />
    </>
  )}
</PageContentLoader>
```

**⚠️ 중요: null guard 필수!**

`PageContentLoader`가 `loading=true`여도 React는 children JSX를 **평가(evaluate)** 한다. `data`가 `null`인 상태에서 `data.property`에 접근하면 런타임 크래시가 발생한다.

```tsx
// ❌ 크래시 발생!
<PageContentLoader loading={loading}>
  <Header title={data.title} />  // data가 null이면 TypeError!
</PageContentLoader>

// ✅ null guard 필수
<PageContentLoader loading={loading}>
  {data && <Header title={data.title} />}
</PageContentLoader>
```

### Step 4: 빈 상태와 로딩 상태 분기

컴포넌트 상단에서 `!data && !loading` 조건으로 빈 상태(empty state)를 먼저 분기한다.

```tsx
// loading=false, data=null → 선택 안 된 상태
if (!data && !loading) {
  return <EmptyPlaceholder message="Select an item to view details" />;
}

// loading=true → PageContentLoader가 스피너 표시
// loading=false, data 있음 → 콘텐츠 표시
return (
  <PageContentLoader loading={loading}>
    {data && <DetailView data={data} />}
  </PageContentLoader>
);
```

---

## 백엔드 가이드라인

- 목록 API는 표시에 필요한 최소한의 필드만 반환한다.
- 상세 API (`GET /:projectId/resource/:id`)를 별도로 제공한다.
- 상세 API는 관련된 모든 필드와 중첩 데이터를 포함한다.

---

## 실제 적용 사례

### 로그 이벤트 상세 패널 (LogSidePanel)

| 파일 | 역할 |
|------|------|
| `packages/argus/src/routes/logs.ts` | `GET /:projectId/logs/detail/:logId` 백엔드 엔드포인트 |
| `packages/frontend/src/services/argusService.ts` | `getLogDetail(projectId, logId, signal?)` 서비스 메서드 |
| `packages/frontend/src/pages/argus/hooks/useArgusLogs.ts` | AbortController + expectedLogIdRef로 lazy loading |
| `packages/frontend/src/pages/argus/components/LogSidePanel.tsx` | `loading` prop + PageContentLoader + `{log && ...}` guard |
| `packages/frontend/src/pages/argus/components/LogSidePanel/types.ts` | `loading?: boolean` prop 정의 |
