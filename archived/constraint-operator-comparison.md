# Constraint Operator 비교 분석: Gatrix vs GrowthBook

## 1. 현재 Gatrix 지원 Operators

### String Operators
| Operator | Label | 설명 |
|----------|-------|------|
| `str_eq` | equals | 문자열 동일 비교 |
| `str_neq` | not equals | 문자열 불일치 비교 |
| `str_contains` | contains | 문자열 포함 |
| `str_starts_with` | starts with | 접두사 일치 |
| `str_ends_with` | ends with | 접미사 일치 |
| `str_in` | in list | 목록 내 존재 |
| `str_not_in` | not in list | 목록 내 미존재 |
| `str_regex` | matches regex | 정규식 일치 |

### Number Operators
| Operator | Label |
|----------|-------|
| `num_eq` | = |
| `num_gt` | > |
| `num_gte` | >= |
| `num_lt` | < |
| `num_lte` | <= |
| `num_in` | in list |
| `num_not_in` | not in list |

### Boolean Operators
| Operator | Label |
|----------|-------|
| `bool_is` | is |

### Date Operators
| Operator | Label |
|----------|-------|
| `date_gt` | after |
| `date_gte` | on or after |
| `date_lt` | before |
| `date_lte` | on or before |

### Semver Operators
| Operator | Label |
|----------|-------|
| `semver_eq` | = |
| `semver_gt` | > |
| `semver_gte` | >= |
| `semver_lt` | < |
| `semver_lte` | <= |
| `semver_in` | in list |
| `semver_not_in` | not in list |

### 추가 기능
- **inverted**: 모든 operator에 NOT(반전) 적용 가능
- **caseInsensitive**: 문자열 operator에 대소문자 무시 적용 가능

---

## 2. GrowthBook 지원 Operators

GrowthBook은 MongoDB 쿼리 문법 기반의 JSON 조건식을 사용:

### String Operators
| Operator | Label | 비고 |
|----------|-------|------|
| `$eq` | is equal to | |
| `$ne` | is not equal to | |
| `$in` | is any of | 리스트 포함 |
| `$nin` | is none of | 리스트 미포함 |
| `$regex` | matches regex | |
| `$notRegex` | does not match regex | |
| `$gt` | is greater than | 사전순 비교 |
| `$gte` | is greater than or equal to | |
| `$lt` | is less than | |
| `$lte` | is less than or equal to | |
| `$exists` | is not NULL | 존재 여부 체크 |
| `$notExists` | is NULL | |
| `$ini` | is any of (case insensitive) | |
| `$nini` | is none of (case insensitive) | |
| `$regexi` | matches regex (case insensitive) | |
| `$notRegexi` | does not match regex (case insensitive) | |

### Number Operators
| Operator | Label |
|----------|-------|
| `$eq` | = |
| `$ne` | ≠ |
| `$gt` | > |
| `$gte` | >= |
| `$lt` | < |
| `$lte` | <= |
| `$in` | is any of |
| `$nin` | is none of |
| `$exists` | is not NULL |
| `$notExists` | is NULL |

### Boolean Operators
| Operator | Label |
|----------|-------|
| `$true` | is true |
| `$false` | is false |
| `$exists` | is not NULL |
| `$notExists` | is NULL |

### Array Operators
| Operator | Label | 비고 |
|----------|-------|------|
| `$includes` | includes | 배열 내 포함 |
| `$notIncludes` | does not include | 배열 내 미포함 |
| `$empty` | is empty | 빈 배열 |
| `$notEmpty` | is not empty | 비지 않은 배열 |
| `$exists` | is not NULL | |
| `$notExists` | is NULL | |

### Version (Semver) Operators
| Operator | Label |
|----------|-------|
| `$veq` | = |
| `$vne` | ≠ |
| `$vgt` | > |
| `$vgte` | >= |
| `$vlt` | < |
| `$vlte` | <= |

### Date Format (string with date format)
문자열의 date 포맷일 때 같은 `$gt/$gte/$lt/$lte` 오퍼레이터를 쓰되 label만 "is after/is before" 등으로 변경

### Saved Group / Condition Group
| Operator | Label | 비고 |
|----------|-------|------|
| `$inGroup` | is in the saved group | 저장된 그룹 참조 |
| `$notInGroup` | is not in the saved group | |

### OpenAPI 정의 (Fact Table 관련)
```
"=" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not_in" | "is_null" | "not_null" | "is_true" | "is_false" | "contains" | "not_contains" | "starts_with" | "ends_with" | "sql_expr" | "saved_filter"
```

---

## 3. 비교 및 분석

### Gatrix에 있고 GrowthBook에 없는 것
- ❌ 없음 (Gatrix가 GrowthBook의 subset)

### GrowthBook에 있고 Gatrix에 없는 것

#### 🔴 반드시 추가 필요
| 항목 | 설명 | 우선순위 |
|------|------|---------|
| **`$exists` / `$notExists`** (NULL 체크) | 컨텍스트 값이 존재하는지/NULL인지 체크. 모든 타입에서 사용 가능 | **높음** |
| **`str_not_contains`** | 문자열 미포함 - contains의 반대 | **높음** |
| **`str_not_regex`** | 정규식 불일치 | **중간** |
| **`date_eq`** | 날짜 동일 비교 | **중간** |
| **`num_neq`** | 숫자 불일치 비교 | **높음** |

#### 🟡 고려할만한 추가
| 항목 | 설명 | 우선순위 |
|------|------|---------|
| **Array 타입 지원** | `includes`, `notIncludes`, `empty`, `notEmpty` | 중간-낮음 |
| **Saved Group** | `$inGroup`, `$notInGroup` - Gatrix의 세그먼트 기능과 유사 | 낮음 (세그먼트로 대체) |
| **`semver_neq`** | 시맨틱 버전 불일치 | 낮음 |

### Gatrix의 아키텍처적 차이점 (장점)

1. **inverted 플래그**: GrowthBook은 각 operator별로 별도 case-insensitive variant를 만들어야 하지만 (`$in`→`$ini`, `$nin`→`$nini`), Gatrix는 `inverted: boolean` 하나로 모든 operator의 논리 반전이 가능 → 더 유연
2. **caseInsensitive 플래그**: 마찬가지로 GrowthBook은 별도 operator 필요, Gatrix는 플래그 하나로 해결 → 더 깔끔
3. **타입별 명시적 operator 네이밍**: `str_eq`, `num_eq` 등 타입이 명시적 → 가독성 좋음

---

## 4. 추천 개선사항

### Phase 1: 핵심 누락 operator 추가 (바로 적용)

```typescript
// ConstraintEditor.tsx - OPERATORS_BY_TYPE 수정
string: [
  // 기존
  { value: 'str_eq', label: 'equals' },
  { value: 'str_neq', label: 'not equals' },
  { value: 'str_contains', label: 'contains' },
  { value: 'str_not_contains', label: 'does not contain' },      // 🆕
  { value: 'str_starts_with', label: 'starts with' },
  { value: 'str_ends_with', label: 'ends with' },
  { value: 'str_in', label: 'in list' },
  { value: 'str_not_in', label: 'not in list' },
  { value: 'str_regex', label: 'matches regex' },
  { value: 'str_not_regex', label: 'does not match regex' },     // 🆕
  { value: 'str_exists', label: 'is not null' },                 // 🆕
  { value: 'str_not_exists', label: 'is null' },                 // 🆕
],
number: [
  // 기존
  { value: 'num_eq', label: '=' },
  { value: 'num_neq', label: '≠' },                               // 🆕
  { value: 'num_gt', label: '>' },
  { value: 'num_gte', label: '>=' },
  { value: 'num_lt', label: '<' },
  { value: 'num_lte', label: '<=' },
  { value: 'num_in', label: 'in list' },
  { value: 'num_not_in', label: 'not in list' },
  { value: 'num_exists', label: 'is not null' },                  // 🆕
  { value: 'num_not_exists', label: 'is null' },                  // 🆕
],
boolean: [
  { value: 'bool_is', label: 'is' },
  { value: 'bool_exists', label: 'is not null' },                 // 🆕
  { value: 'bool_not_exists', label: 'is null' },                 // 🆕
],
date: [
  { value: 'date_eq', label: 'equals' },                          // 🆕
  { value: 'date_gt', label: 'after' },
  { value: 'date_gte', label: 'on or after' },
  { value: 'date_lt', label: 'before' },
  { value: 'date_lte', label: 'on or before' },
  { value: 'date_exists', label: 'is not null' },                 // 🆕
  { value: 'date_not_exists', label: 'is null' },                 // 🆕
],
semver: [
  { value: 'semver_eq', label: '=' },
  { value: 'semver_neq', label: '≠' },                            // 🆕
  { value: 'semver_gt', label: '>' },
  { value: 'semver_gte', label: '>=' },
  { value: 'semver_lt', label: '<' },
  { value: 'semver_lte', label: '<=' },
  { value: 'semver_in', label: 'in list' },
  { value: 'semver_not_in', label: 'not in list' },
  { value: 'semver_exists', label: 'is not null' },               // 🆕
  { value: 'semver_not_exists', label: 'is null' },               // 🆕
],
```

### Phase 1 구현 요약 (🆕 = 새로 추가)

#### 새 operator 수: 13개
| 카테고리 | 새 operator | 설명 |
|----------|------------|------|
| string | `str_not_contains`, `str_not_regex` | 부정형 추가 |
| number | `num_neq` | 불일치 비교 |
| date | `date_eq` | 날짜 동일 비교 |
| semver | `semver_neq` | 버전 불일치 비교 |
| 공통(all types) | `*_exists`, `*_not_exists` | NULL 체크 (5개 타입 × 2 = 10개) |

#### 수정 필요 파일
1. **`packages/shared/src/evaluation/FeatureFlagEvaluator.ts`** — evaluateConstraint에 새 operator case 추가
2. **`packages/frontend/src/components/features/ConstraintEditor.tsx`** — OPERATORS_BY_TYPE에 새 operator 추가
3. **`packages/frontend/src/components/features/ConstraintDisplay.tsx`** — 표시 로직 업데이트
4. **`packages/backend/src/routes/admin/features.ts`** — playground evaluator에도 같은 operator 지원 추가
5. **로컬라이징 파일** — `en.ini`, `ko.ini`, `zh.ini`에 operator label 추가

### Phase 2: 미래 확장 (차후)
- Array 타입 컨텍스트 필드 지원
- `str_not_starts_with`, `str_not_ends_with` 추가
- `date_neq` 등 날짜 관련 추가 operator
