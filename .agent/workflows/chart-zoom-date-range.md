---
description: Chart zoom to custom date range pattern for Argus pages
---

# Chart Zoom → Custom Date Range Pattern

차트에서 드래그/줌으로 시간 범위를 선택하면 해당 범위의 데이터만 필터링되어야 합니다. 이 패턴은 Argus의 모든 탐색 페이지(로그, 트레이스, 피드백, 메트릭스)에서 일관되게 사용됩니다.

## 핵심 원칙

차트 줌은 반드시 `period: 'custom'` + 별도 `start`/`end` URL 파라미터를 사용합니다.

**❌ 절대 하지 마세요:**
```tsx
// ❌ ISO 문자열을 '|'로 이어붙여 period에 넣기
setUrlState({
  period: `${start.toISOString()}|${end.toISOString()}`,
});
// → 백엔드가 period를 preset으로 파싱 → 인식 실패 → 결과 없음
```

**✅ 올바른 패턴:**
```tsx
// ✅ period='custom' + 별도 start/end 파라미터
setUrlState({
  period: 'custom',
  start: start.toISOString(),
  end: end.toISOString(),
});
```

## 구현 가이드

### 1. URL_PARAMS에 start/end 추가

```tsx
const URL_PARAMS = useMemo(
  () => ({
    period: {
      key: 'period',
      default: '14d',
      storageKey: 'argus-xxx-period',
    },
    start: { key: 'start', default: '' },  // ← 필수
    end: { key: 'end', default: '' },      // ← 필수
    // ... 기타 파라미터
  }),
  []
);
const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);
```

### 2. useEffect: URL → filters 동기화

`period: 'custom'`일 때 `start`/`end`를 파싱하여 custom DateRange로 설정합니다. `start`/`end`가 없으면 기본 preset으로 폴백합니다.

```tsx
// URL state → filters.dateRange 동기화
useEffect(() => {
  setFilters((prev) => {
    if (urlState.period === 'custom') {
      if (urlState.start && urlState.end) {
        return {
          ...prev,
          dateRange: {
            type: 'custom',
            start: new Date(urlState.start),
            end: new Date(urlState.end),
          },
        };
      }
      // start/end 없으면 fallback
      return {
        ...prev,
        dateRange: { type: 'preset', preset: '14d' },
      };
    }
    return {
      ...prev,
      dateRange: { type: 'preset', preset: urlState.period },
    };
  });
}, [urlState.period, urlState.start, urlState.end]);

// 안전장치: period='custom'인데 start/end가 없으면 기본으로 복구
useEffect(() => {
  if (urlState.period === 'custom' && (!urlState.start || !urlState.end)) {
    setUrlState({ period: '14d' });
  }
}, [urlState.period, urlState.start, urlState.end, setUrlState]);
```

### 3. handleFilterChange: DateRangeSelector 변경 처리

preset과 custom 모두 URL에 올바르게 반영합니다.

```tsx
const handleFilterChange = (newFilters: ArgusFilterState) => {
  setFilters(newFilters);
  if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
    setUrlState({
      period: newFilters.dateRange.preset,
      start: '',   // ← custom 해제 시 반드시 비움
      end: '',     // ← custom 해제 시 반드시 비움
    });
  } else if (
    newFilters.dateRange.type === 'custom' &&
    newFilters.dateRange.start &&
    newFilters.dateRange.end
  ) {
    setUrlState({
      period: 'custom',
      start: newFilters.dateRange.start.toISOString(),
      end: newFilters.dateRange.end.toISOString(),
    });
  }
};
```

### 4. handleZoom: 차트 줌 핸들러

줌 핸들러는 ISO 문자열 `start`/`end`를 받아 URL에 설정합니다.

```tsx
const handleZoom = useCallback(
  (start: string, end: string) => {
    setUrlState({ period: 'custom', start, end });
  },
  [setUrlState]
);
```

### 5. 차트의 onZoom 콜백

ArgusVolumeChart의 `onZoom`은 인덱스 기반이므로 버킷 → ISO 변환이 필요합니다.

```tsx
const handleChartZoom = (startIdx: number, endIdx: number) => {
  const si = Math.min(startIdx, endIdx);
  const ei = Math.max(startIdx, endIdx);
  if (sortedBuckets[si] && sortedBuckets[ei]) {
    const startDate = new Date(sortedBuckets[si]);
    let endDate = new Date(sortedBuckets[ei]);
    // 마지막 버킷의 끝 시점까지 포함
    if (sortedBuckets.length > 1) {
      const gap =
        new Date(sortedBuckets[1]).getTime() -
        new Date(sortedBuckets[0]).getTime();
      endDate = new Date(endDate.getTime() + gap);
    } else {
      endDate = new Date(endDate.getTime() + 3600000);
    }
    handleZoom(startDate.toISOString(), endDate.toISOString());
  }
};
```

### 6. API 호출 시 dateRange → API 파라미터 변환

`dateRangeToApiParams` 또는 `argusFilterStateToApiParams`가 자동으로 custom 범위를 `{ period: 'custom', start: ISO, end: ISO }`로 변환합니다.

```tsx
const fetchData = useCallback(async () => {
  const apiParams = argusFilterStateToApiParams(filters);
  // 또는: const apiParams = argusDateRangeToApiParams(filters.dateRange);
  const result = await argusService.getData(projectId, {
    period: apiParams.period || '14d',
    start: apiParams.start,     // custom일 때만 값 있음
    end: apiParams.end,         // custom일 때만 값 있음
    // ... 기타
  });
}, [projectId, filters]);
```

## 참조 구현

| 페이지 | 파일 | 상태 |
|--------|------|------|
| **로그** | `hooks/useArgusLogs.ts` (handleZoom L713) | ✅ 올바른 패턴 |
| **트레이스** | `ArgusTraceExplorerPage.tsx` (handleZoom L733) | ✅ 올바른 패턴 |
| **메트릭스** | `ArgusMetricsExplorerPage.tsx` (handleZoom L268) | ✅ 올바른 패턴 |
| **피드백** | `ArgusFeedbackPage.tsx` (handleChartZoom L819) | ✅ 수정 완료 |

## 체크리스트

새 페이지에 차트 줌을 추가할 때:

- [ ] `URL_PARAMS`에 `start: { key: 'start', default: '' }`, `end: { key: 'end', default: '' }` 추가
- [ ] `useEffect`에서 `urlState.period === 'custom'` 분기 처리
- [ ] `handleFilterChange`에서 preset 전환 시 `start: '', end: ''` 클리어
- [ ] `handleFilterChange`에서 custom 전환 시 `period: 'custom', start, end` 설정
- [ ] `handleZoom`은 `setUrlState({ period: 'custom', start, end })` 사용
- [ ] 차트 `onZoom`에서 인덱스 → ISO 변환 + 마지막 버킷 gap 보정
- [ ] **절대** `period` 하나에 `ISO|ISO` 형식으로 넣지 않기
