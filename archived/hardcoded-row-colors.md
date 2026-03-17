# 하드코딩된 교차 행 색상 문제

## 문제 설명
다크모드에서 테이블 교차 행(zebra stripe) 색상이 하드코딩되어 있어 테마와 충돌하는 문제.
`ThemeContext.tsx`에서 글로벌 `MuiTableRow` 스타일(`stripeBg`)을 설정했지만, 개별 페이지에서 하드코딩된 색상으로 덮어쓰고 있었음.

### 증상
- 다크모드에서 교차 행 하나가 너무 검게 보임 (회색 `#1e2125` vs 네이비 배경 `#1a1d36`)
- 테마 전환 시 흰색으로 번쩍이는 현상

### 수정 방법
- 하드코딩된 `#1e2125` / `#f8f9fa` / `#282c31` / `#eef1f5` 등을 제거
- `ThemeContext.tsx`의 글로벌 스타일(MuiTableRow의 `colors.stripeBg`)에 위임
- 또는 테마 토큰 `theme.palette.action.hover` 사용

## 모두 수정 완료 ✅
- [x] `ThemeContext.tsx` - MuiTableBody의 하드코딩 odd-row + hover 제거
- [x] `SignalEndpointsPage.tsx` - nth-of-type(4n+1/4n+3) 하드코딩 제거
- [x] `ActionSetsPage.tsx` - nth-of-type(4n+1/4n+3) 하드코딩 제거
- [x] `PlanningDataHistoryPage.tsx` - inline bgcolor, nth-of-type(even/odd), diff table stripe 제거
- [x] `PlanningDataUpload.tsx` - diff table `tbody tr:nth-of-type(odd)` 제거
- [x] `AuditLogsPage.tsx` - inline `& > td` bgcolor, nth-of-type(odd) 제거
- [x] `FeatureFlagAuditLogs.tsx` - inline bgcolor, nth-of-type(odd) 제거
- [x] `ChangeRequestDetailDrawer.tsx` - nth-of-type(odd) 제거
