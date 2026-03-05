# RBAC 퍼미션 시스템 리팩토링 스펙

## 1. 현재 시스템 문제점

| 문제                       | 상세                                           |
| -------------------------- | ---------------------------------------------- |
| FE/BE 퍼미션 값 불일치     | BE: `org.users.read` / FE: `users.view`        |
| CRUD 미분리                | `write` 하나로 create+update+delete 묶음       |
| 호환 코드 비대             | BE에 flat `PERMISSIONS` alias 별도 존재        |
| 메뉴 권한 3방식 혼재       | `adminOnly` + shorthand + `requiredPermission` |
| 와일드카드 미지원          | `users:*`, `*:read` 불가                       |
| 슈퍼어드민 이메일 하드코딩 | `SUPER_ADMIN_EMAIL = 'admin@gatrix.com'`       |
| 새 인스턴스 자동 접근 불가 | 환경 추가 시 기존 역할에 자동 적용 안 됨       |

---

## 2. 퍼미션 포맷

```
resource:action
```

> [!CAUTION]
> **퍼미션 문자열 하드코딩 절대 금지.** FE/BE 모두 반드시 `shared`에 정의된 상수만 사용.
> ```typescript
> // ❌ 금지
> requirePermission('users:read')
>
> // ✅ 필수
> import { P } from '@gatrix/shared/permissions';
> requirePermission(P.USERS_READ)
> ```

> [!IMPORTANT]
> **퍼미션 UI 표시 시 반드시 로컬라이징 (ko, zh, en).** 리소스명, 액션명, 카테고리명 모두 `t()` 사용.
> ```
> permissions.resource.users       → "사용자" / "Users" / "用户"
> permissions.action.create        → "생성" / "Create" / "创建"
> permissions.category.workspace   → "워크스페이스" / "Workspace" / "工作区"
> ```

### 2.1 액션 (CRUD + 특수)

| 액션      | 설명              |
| --------- | ----------------- |
| `create`  | 생성              |
| `read`    | 조회              |
| `update`  | 수정              |
| `delete`  | 삭제              |
| `access`  | 접근 (콘솔, 채팅) |
| `approve` | 승인 (CR)         |

> `write` 사용 안 함 — "수정만 가능하고 생성 불가" 표현 가능.

### 2.2 와일드카드

| 패턴      | 의미                   |
| --------- | ---------------------- |
| `*:*`     | 모든 리소스, 모든 액션 |
| `users:*` | users 전체 액션        |
| `*:read`  | 모든 리소스 읽기       |

---

## 3. Scope 계층

4개 scope: **system > org > project > env**

### 3.1 System 레벨

조직 위의 시스템 전체 범위. 멀티 조직 환경에서의 글로벌 관리.

| 리소스              | 액션                              | 설명            |
| ------------------- | --------------------------------- | --------------- |
| `organisations`     | `create` `read` `update` `delete` | 조직 관리       |
| `system_config`     | `read` `update`                   | 시스템 설정     |
| `system_monitoring` | `read`                            | 글로벌 모니터링 |

### 3.2 Org 레벨

| 리소스              | 액션                              |
| ------------------- | --------------------------------- |
| `users`             | `create` `read` `update` `delete` |
| `groups`            | `create` `read` `update` `delete` |
| `roles`             | `create` `read` `update` `delete` |
| `invitations`       | `create` `read` `delete`          |
| `projects`          | `create` `read` `update` `delete` |
| `audit_logs`        | `read`                            |
| `system_settings`   | `read` `update`                   |
| `admin_tokens`      | `create` `read` `delete`          |
| `ip_whitelist`      | `create` `read` `update` `delete` |
| `account_whitelist` | `create` `read` `update` `delete` |
| `integrations`      | `read` `update`                   |
| `translation`       | `read` `update`                   |
| `console`           | `access`                          |
| `chat`              | `access`                          |
| `monitoring`        | `read`                            |
| `open_api`          | `read`                            |
| `scheduler`         | `read` `create` `update` `delete` |
| `event_lens`        | `read` `update`                   |
| `crash_events`      | `read`                            |
| `realtime_events`   | `read`                            |

### 3.3 Project 레벨

| 리소스             | 액션                              |
| ------------------ | --------------------------------- |
| `features`         | `create` `read` `update` `delete` |
| `segments`         | `create` `read` `update` `delete` |
| `context_fields`   | `create` `read` `update` `delete` |
| `release_flows`    | `create` `read` `update` `delete` |
| `tags`             | `create` `read` `update` `delete` |
| `planning_data`    | `create` `read` `update` `delete` |
| `service_accounts` | `create` `read` `update` `delete` |
| `signal_endpoints` | `create` `read` `update` `delete` |
| `actions`          | `create` `read` `update` `delete` |
| `data`             | `read` `update`                   |
| `unknown_flags`    | `read`                            |
| `impact_metrics`   | `read` `update`                   |

### 3.4 Env 레벨

| 리소스                  | 액션                              |
| ----------------------- | --------------------------------- |
| `environments`          | `read` `update` `delete`          |
| `env_features`          | `update`                          |
| `change_requests`       | `create` `approve`                |
| `env_keys`              | `create` `read` `delete`          |
| `client_versions`       | `create` `read` `update` `delete` |
| `game_worlds`           | `create` `read` `update` `delete` |
| `maintenance`           | `read` `update`                   |
| `maintenance_templates` | `create` `read` `update` `delete` |
| `service_notices`       | `create` `read` `update` `delete` |
| `banners`               | `create` `read` `update` `delete` |
| `coupons`               | `create` `read` `update` `delete` |
| `coupon_settings`       | `read` `update`                   |
| `surveys`               | `create` `read` `update` `delete` |
| `store_products`        | `create` `read` `update` `delete` |
| `reward_templates`      | `create` `read` `update` `delete` |
| `ingame_popups`         | `create` `read` `update` `delete` |
| `operation_events`      | `create` `read` `update` `delete` |
| `servers`               | `create` `read` `update` `delete` |
| `message_templates`     | `create` `read` `update` `delete` |
| `vars`                  | `read` `update`                   |

---

## 4. 인스턴스 와일드카드

프로젝트/환경 ID에 `*` → 새로 추가되는 인스턴스에 자동 적용.

| DB 값                                    | 효과                                |
| ---------------------------------------- | ----------------------------------- |
| `projectId='*'`, `features:read`         | 모든 프로젝트 피처 읽기 (신규 포함) |
| `projectId='ABC'`, `features:update`     | ABC만                               |
| `environmentId='*'`, `client_versions:*` | 모든 환경의 클라이언트 버전 전체    |

---

## 5. 역할 상속

역할이 다른 역할을 상속. `Editor` → `Viewer` 상속 시 `Viewer` 퍼미션 자동 포함.

```sql
CREATE TABLE g_role_inheritance (
  id CHAR(26) PRIMARY KEY,
  roleId CHAR(26) NOT NULL,        -- 자식
  parentRoleId CHAR(26) NOT NULL,   -- 부모
  UNIQUE KEY uniq_role_parent (roleId, parentRoleId)
);
```

최대 5레벨, 순환 참조 방지.

---

## 6. ABAC 조건 (선택적, 1단계에선 컬럼만)

퍼미션 테이블에 `permCondition TEXT NULL` 추가. JEXL 표현식으로 런타임 컨텍스트 평가.

- `null` = 무조건 허용
- 평가 실패 → 거부 (fail-closed)
- 1단계: 컬럼 추가만, 평가 로직은 추후

---

## 7. 슈퍼어드민

`admin@gatrix.com` 하드코딩 제거 → `orgRole = 'admin'`이면 `*:*` 취급.
`isSuperAdmin()`, `SUPER_ADMIN_EMAIL` 코드 제거.

---

## 8. 퍼미션 프리뷰 UI

### 8.1 역할 기준 프리뷰

역할 편집 화면에서 "이 역할이 부여하는 실제 퍼미션" 확인:

```
┌─────────────────────────────────────────────┐
│ 역할: Editor                                │
│ 상속: Viewer                                │
├─────────────────────────────────────────────┤
│ 리소스           │ C │ R │ U │ D │ 출처      │
│──────────────────┼───┼───┼───┼───┼──────────│
│ features         │   │ ✓ │ ✓ │   │ 직접     │
│ segments         │   │ ✓ │   │   │ Viewer   │
│ tags             │   │ ✓ │   │   │ Viewer   │
└─────────────────────────────────────────────┘
```

- **직접**: 이 역할에 직접 부여된 퍼미션
- **상속**: 부모 역할에서 온 퍼미션 (역할명 표시, readonly)

### 8.2 사용자 기준 프리뷰

사용자 편집 화면에서 "이 사용자에게 실제 적용되는 모든 퍼미션" 종합 확인:

```
┌─────────────────────────────────────────────────────┐
│ 사용자: user@example.com                            │
│ Org Role: user                                      │
│ 역할: Editor (직접), QA (qa-team 그룹)               │
├─────────────────────────────────────────────────────┤
│ 리소스           │ C │ R │ U │ D │ 출처              │
│──────────────────┼───┼───┼───┼───┼──────────────────│
│ features         │   │ ✓ │ ✓ │   │ Editor (직접)    │
│ segments         │   │ ✓ │   │   │ Viewer→Editor    │
│ client_versions  │ ✓ │ ✓ │ ✓ │ ✓ │ QA (qa-team)     │
└─────────────────────────────────────────────────────┘
```

출처 유형:
- **직접**: 사용자에게 직접 할당된 역할
- **그룹**: 그룹 소속으로 부여된 역할 (그룹명 표시)
- **상속**: 역할의 부모 역할에서 온 것 (체인 표시)

> 이 컴포넌트는 **재사용 가능**하도록 만들어 역할 편집, 사용자 편집, 그룹 편집 화면 모두에서 사용.

---

## 9. 권한 체크 우선순위

```
1. Org Admin (orgRole='admin') → 모든 퍼미션
2. 역할 수집 (직접 + 그룹 + 상속)
3. 인스턴스 와일드카드 (projectId='*')
4. 특정 인스턴스 퍼미션
5. 퍼미션 와일드카드 (features:*, *:read)
6. ABAC 조건 평가 (있을 경우)
```

> `write → read` 폴백 제거. UI에서 `resource:*` 선택 시 CRUD 전체 자동 부여 UX.

---

## 10. 기본 역할 프리셋

시스템 초기화 시 자동 생성되는 기본 역할. 삭제 불가 (`isSystemDefined` 플래그).

| 역할              | Scope       | 퍼미션                                                      | 상속   | 설명                                    |
| ----------------- | ----------- | ----------------------------------------------------------- | ------ | --------------------------------------- |
| **System Admin**  | system      | `*:*`                                                       | —      | 시스템 전체 관리                        |
| **Org Admin**     | org         | `*:*`                                                       | —      | 조직 전체 관리 (orgRole='admin'과 동일) |
| **Project Admin** | project     | `*:*`                                                       | —      | 프로젝트 + 하위 환경 전체               |
| **Editor**        | project+env | `features:*`, `segments:*`, `client_versions:*` 등 CUD 중심 | Viewer | 데이터 편집 가능                        |
| **Viewer**        | project+env | `*:read`                                                    | —      | 모든 리소스 읽기 전용                   |

> 프리셋은 참고용 기본값이며, 관리자가 복제하여 커스텀 역할을 만들 수 있도록 "복사하여 새 역할 만들기" UI 제공.

DB 시드에서 `g_roles`에 `isSystemDefined = TRUE`로 INSERT. 마이그레이션에 포함.

---

## 11. shared 패키지

```
packages/shared/src/permissions/
├── index.ts           # re-export
├── constants.ts       # RESOURCES, ACTIONS, RESOURCE_SCOPES, RESOURCE_ACTIONS
├── types.ts           # Permission 타입
├── matcher.ts         # 와일드카드 매칭
└── categories.ts      # UI 카테고리
```

---

## 12. DB 마이그레이션

기존 값 변환:
- `org.users.read` → `users:read`
- `org.users.write` → `users:create` + `users:update` + `users:delete` (3 row)
- `isAdmin=true` → `*:*`

신규 테이블: `g_role_inheritance`
컬럼 추가: `permCondition TEXT NULL` (3개 퍼미션 테이블)

---

## 13. 변경 범위 요약

| 영역                     | 변경                                           |
| ------------------------ | ---------------------------------------------- |
| `packages/shared`        | 퍼미션 정의 + 매처 신규                        |
| Backend types            | shared re-export로 교체                        |
| `PermissionService`      | isSuperAdmin 제거, 와일드카드 매칭, 상속 탐색  |
| `requireAdmin.ts`        | 삭제                                           |
| 라우트                   | `resource:action` 형태로 교체                  |
| Frontend types           | 삭제, shared 사용                              |
| `AuthContext`            | isAdmin → orgRole, hasPermission → shared 매처 |
| `navigation.tsx`         | adminOnly 제거, requiredPermission 통일        |
| `ProtectedRoute`         | requiredRoles 제거, 퍼미션 기반                |
| 역할/사용자/그룹 편집 UI | 퍼미션 프리뷰 컴포넌트                         |

---

## 14. 작업 순서

| 단계 | 내용                                                 |
| ---- | ---------------------------------------------------- |
| 1    | shared 퍼미션 정의 + 와일드카드 매처                 |
| 2    | DB 마이그레이션 (값 변환 + 상속 테이블 + ABAC 컬럼)  |
| 3    | 백엔드 (PermissionService, 미들웨어, 라우트)         |
| 4    | 프론트엔드 (AuthContext, navigation, ProtectedRoute) |
| 5    | 퍼미션 프리뷰 컴포넌트 + 역할/사용자/그룹 편집 UI    |
| 6    | 빌드 + 브라우저 검증                                 |
