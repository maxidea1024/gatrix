# Known Issues & Fixes

## [2026-02-23] parseJsonField Double-Parsing Bug (FIXED)

### Symptom
Feature flag의 `valueType`이 `"string"`인데도 API 응답의 `variant.value`가 숫자나 boolean으로 반환됨.

- `valueType: "string"`, value `55555` → 응답: `55555` (number) ❌ → 수정 후: `"55555"` (string) ✅
- `valueType: "string"`, value `true` → 응답: `true` (boolean) ❌ → 수정 후: `"true"` (string) ✅
- `valueType: "string"`, value `pppp` → 응답: `"pppp"` (string) ✅ (우연히 정상 동작)

Backend와 Edge 양쪽 모두에서 발생.

### Root Cause
`parseJsonField()` 함수가 mysql2 드라이버가 이미 자동 파싱한 JSON 컬럼 값을 또다시 `JSON.parse()`하여 이중 파싱(double-parsing) 발생.

**흐름:**
```
DB JSON 컬럼에 "55555" (문자열) 저장
  ↓ mysql2 자동파싱 (JSON column → native JS)
JS string "55555"
  ↓ parseJsonField() → JSON.parse("55555")  ← 이중 파싱!
JS number 55555  ← 타입 변환 버그!
```

- `"55555"` → `JSON.parse("55555")` → `55555` (number) ← 버그
- `"true"` → `JSON.parse("true")` → `true` (boolean) ← 버그
- `"pppp"` → `JSON.parse("pppp")` → throws → catch에서 원래값 반환 ← 우연히 정상

### Fix
1. **`parseJsonField`** (FeatureFlag.ts, ReleaseFlow.ts): JSON.parse는 `{...}` 또는 `[...]` 형태의 문자열에만 시도. 나머지는 mysql2가 이미 파싱했으므로 그대로 반환.
2. **`getFallbackValue`** (FeatureFlagEvaluator.ts, features.ts): 방어적으로 `valueType`에 맞게 타입 강제 변환 추가.
3. **Edge `performEvaluation`**: string 타입도 명시적으로 `String()` 변환 추가.

### Affected Files
- `packages/backend/src/models/FeatureFlag.ts`
- `packages/backend/src/models/ReleaseFlow.ts`
- `packages/shared/src/evaluation/FeatureFlagEvaluator.ts`
- `packages/backend/src/routes/admin/features.ts`
- `packages/edge/src/routes/client.ts`

### Lesson Learned
- MySQL JSON 컬럼은 mysql2가 자동 파싱하므로 `JSON.parse`를 추가로 호출하면 안 됨.
- `JSON.parse("55555")`는 에러 없이 숫자 55555를 반환하므로 문제를 발견하기 어려움.
- 일반 문자열(`"pppp"`)은 `JSON.parse` 실패 → catch에서 원래값 반환되어 우연히 정상 동작하므로 버그가 드러나지 않음.
- 값이 숫자/boolean처럼 보이는 문자열일 때만 문제가 발생하여 재현이 어려웠음.
