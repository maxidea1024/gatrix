# 하드코딩된 교차 행 색상 문제

## 문제 설명
다크모드에서 테이블 교차 행(zebra stripe) 색상이 하드코딩되어 있어 테마와 충돌하는 문제.
`ThemeContext.tsx`에서 글로벌 `MuiTableRow` 스타일(`stripeBg`)을 설정했지만, 개별 페이지에서 하드코딩된 색상으로 덮어쓰고 있음.

### 증상
- 다크모드에서 교차 행 하나가 너무 검게 보임 (회색 `#1e2125` vs 네이비 배경 `#1a1d36`)
- 테마 전환 시 흰색으로 번쩍이는 현상

### 수정 방법
- 하드코딩된 `#1e2125` / `#f8f9fa` / `#282c31` / `#eef1f5` 등을 제거
- `ThemeContext.tsx`의 글로벌 스타일(MuiTableRow의 `colors.stripeBg`)에 위임
- 또는 테마 토큰 `theme.palette.action.hover` 사용

## 수정 완료
- [x] `ThemeContext.tsx` - MuiTableBody의 하드코딩 odd-row + hover 제거

## 수정 필요한 파일

### 1. `SignalEndpointsPage.tsx` (line 582-587)
```
'& .MuiTableRow-root:nth-of-type(4n+1)': {
  backgroundColor: theme.palette.mode === 'dark' ? '#1e2125' : '#f8f9fa',
}
'& .MuiTableRow-root:nth-of-type(4n+3)': { ... }
```

### 2. `ActionSetsPage.tsx` (line 737-742)
```
'& .MuiTableRow-root:nth-of-type(4n+1)': {
  backgroundColor: theme.palette.mode === 'dark' ? '#1e2125' : '#f8f9fa',
}
'& .MuiTableRow-root:nth-of-type(4n+3)': { ... }
```

### 3. `PlanningDataHistoryPage.tsx` (line 437, 647, 756, 911, 1037)
- 여러 곳에서 nth-of-type(even/odd) 패턴 사용
- 확인 후 테마 토큰으로 교체 필요

### 4. `PlanningDataUpload.tsx` (line 883, 990, 1079)
- `& tbody tr:nth-of-type(odd)` 패턴 사용
- 확인 후 테마 토큰으로 교체 필요

### 5. `AuditLogsPage.tsx` (line 1250)
- `&:nth-of-type(odd)` 패턴 사용

### 6. `FeatureFlagAuditLogs.tsx` (line 825)
- `&:nth-of-type(odd)` 패턴 사용

### 7. `ChangeRequestDetailDrawer.tsx` (line 1755)
- `&:nth-of-type(odd)` 패턴 사용
