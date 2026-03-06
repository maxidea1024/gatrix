# RBAC v3 스펙: Role Binding 패턴

> Version: 3.0 | Date: 2026-03-06
> 이전 스펙: `rbac_spec.md`(v1), `rbac_permission_v2.md`(v2)를 대체.
> 핵심 변경: **멤버십 = 접근 게이트, 역할 = 순수 권한 집합, 바인딩 = 스코프별 역할 할당**

---

## 목차

1. [설계 원칙](#1-설계-원칙)
2. [데이터 계층 모델](#2-데이터-계층-모델)
3. [멤버십 (접근 게이트)](#3-멤버십-접근-게이트)
4. [역할 (Role) — 순수 권한 집합](#4-역할-role--순수-권한-집합)
5. [역할 바인딩 (Role Binding)](#5-역할-바인딩-role-binding)
6. [그룹 (Group)](#6-그룹-group)
7. [퍼미션 정의](#7-퍼미션-정의)
8. [권한 계산 엔진](#8-권한-계산-엔진)
9. [기본 역할 프리셋](#9-기본-역할-프리셋)
10. [역할 상속](#10-역할-상속)
11. [키/토큰 체계](#11-키토큰-체계)
12. [DB 스키마 — 테이블 전체 목록](#12-db-스키마--테이블-전체-목록)
13. [마이그레이션 전략](#13-마이그레이션-전략)
14. [API 라우트 설계](#14-api-라우트-설계)
15. [UI 변경점](#15-ui-변경점)
16. [엣지케이스 및 보안](#16-엣지케이스-및-보안)
17. [캐싱 전략](#17-캐싱-전략)

---

## 1. 설계 원칙

### 1.1 v1/v2 대비 핵심 변경

| 항목 | v1/v2 (현재) | v3 (변경) |
|------|-------------|-----------|
| 역할과 범위 | 역할 안에 projectId/environmentId 혼재 | 역할 = 순수 권한, 바인딩 = 범위 |
| 멤버십 역할 | 멤버십과 역할이 독립적 | 멤버십 = 접근 게이트 (필수 조건) |
| 권한 테이블 | 3개 (`_org`, `_project`, `_env`) | 1개 (`g_role_permissions`) |
| 역할 할당 | `g_user_roles` + `g_group_roles` | `g_role_bindings` 통합 |
| 프로젝트별 오버라이드 | 불가 | 바인딩 스코프로 자연스럽게 지원 |
| 환경별 오버라이드 | 불가 | 동일 |
| 테이블 순변화 | — | 5개 삭제, 2개 신규 (순감 3) |

### 1.2 3가지 분리 원칙

```
멤버십 = "어디에 접근할 수 있는가" (게이트)
역할   = "무엇을 할 수 있는가"     (행위)
바인딩 = "어디에서 어떤 역할인가"   (스코프별 할당)
```

### 1.3 세부 원칙

1. **멤버십 없으면 접근 불가**: 역할에 아무리 권한이 있어도 해당 조직/프로젝트의 멤버가 아니면 거부
2. **역할에 범위 정보 없음**: 역할은 `features:read`, `segments:update` 같은 행위만 정의
3. **가장 구체적 바인딩 우선**: env 바인딩 > project 바인딩 > org 바인딩 > system 바인딩
4. **write는 read를 포함하지 않음**: CRUD 각각 독립 (v2에서 확정)
5. **와일드카드 지원**: `*:*`, `users:*`, `*:read`
6. **System Admin 지원**: system 스코프 바인딩으로 전체 시스템 접근

---

## 2. 데이터 계층 모델

### 2.1 4-Level 계층

```
System (전체)
└── Organisation (조직)
    └── Project (프로젝트)
        └── Environment (환경)
```

### 2.2 각 계층 테이블 (기존과 동일)

- `g_organisations` — 최상위 조직 단위
- `g_projects` — 조직 내 프로젝트 (orgId FK)
- `g_environments` — 프로젝트 내 환경 (projectId FK)

> 계층 테이블 스키마는 v1과 동일. 변경 없음.

---

## 3. 멤버십 (접근 게이트)

### 3.1 조직 멤버십

```sql
-- 기존 유지 (변경 없음)
CREATE TABLE g_organisation_members (
  id CHAR(26) PRIMARY KEY,
  orgId CHAR(26) NOT NULL,
  userId CHAR(26) NOT NULL,
  orgRole ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  joinedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invitedBy CHAR(26) NULL,
  UNIQUE KEY uniq_org_user (orgId, userId),
  FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE
);
```

| orgRole | 의미 |
|---------|------|
| `admin` | Org Admin — 해당 조직의 모든 리소스에 전체 권한 |
| `user` | 일반 사용자 — 바인딩된 역할에 따라 권한 결정 |

### 3.2 프로젝트 멤버십

```sql
-- 기존 유지 (변경 없음)
CREATE TABLE g_project_members (
  id CHAR(26) PRIMARY KEY,
  projectId CHAR(26) NOT NULL,
  userId CHAR(26) NOT NULL,
  projectRole ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  joinedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invitedBy CHAR(26) NULL,
  UNIQUE KEY uniq_project_user (projectId, userId),
  FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE
);
```

### 3.3 멤버십의 역할: 접근 게이트

```
✅ 조직 멤버 → 조직 수준 리소스 접근 가능
✅ 프로젝트 멤버 → 해당 프로젝트 및 하위 환경 접근 가능
❌ 멤버가 아니면 → 바인딩/역할과 무관하게 즉시 거부

예외: System Admin (system 바인딩) → 멤버십 체크 우회
예외: Org Admin (orgRole='admin') → 해당 조직 내 모든 프로젝트 접근
```

---

## 4. 역할 (Role) — 순수 권한 집합

### 4.1 역할 정의

```sql
-- 기존 유지 (isSystemDefined 추가됨, v2에서)
CREATE TABLE g_roles (
  id CHAR(26) PRIMARY KEY,
  orgId CHAR(26) NOT NULL,
  roleName VARCHAR(100) NOT NULL,
  description TEXT NULL,
  isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE,
  createdBy CHAR(26) NULL,
  updatedBy CHAR(26) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_role (orgId, roleName),
  FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE
);
```

### 4.2 역할 권한 — 🆕 통합 테이블

```sql
-- 🆕 기존 3개 테이블(g_role_org/project/env_permissions) → 1개로 통합
CREATE TABLE g_role_permissions (
  id CHAR(26) PRIMARY KEY,
  roleId CHAR(26) NOT NULL,
  permission VARCHAR(100) NOT NULL,   -- 'features:read', '*:*', 'users:*' 등
  permCondition TEXT NULL,            -- ABAC 조건 (미래용, null = 무조건 허용)
  UNIQUE KEY uniq_role_perm (roleId, permission),
  FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE
);
```

> [!IMPORTANT]
> **역할에 projectId/environmentId가 없습니다.** 역할은 순수하게 "어떤 행위를 할 수 있는가"만 정의합니다.
> "어디에서"는 바인딩(Section 5)이 결정합니다.

### 4.3 역할 예시

```
역할: "Developer"
└── 권한: features:*, segments:read, client_versions:update, change_requests:create

역할: "Viewer"
└── 권한: *:read

역할: "System Admin"
└── 권한: *:*

역할: "QA Tester"
└── 권한: features:read, client_versions:*, game_worlds:read, maintenance:read
```

---

## 5. 역할 바인딩 (Role Binding)

### 5.1 바인딩 = "누가" + "어떤 역할을" + "어디에서"

```sql
-- 🆕 기존 g_user_roles + g_group_roles 대체
CREATE TABLE g_role_bindings (
  id CHAR(26) PRIMARY KEY,

  -- 누가 (둘 중 하나만 설정)
  userId CHAR(26) NULL,
  groupId CHAR(26) NULL,

  -- 어떤 역할
  roleId CHAR(26) NOT NULL,

  -- 어디에서
  scopeType ENUM('system', 'org', 'project', 'environment') NOT NULL,
  scopeId CHAR(26) NOT NULL,   -- 'SYSTEM' | orgId | projectId | environmentId

  assignedBy CHAR(26) NULL,
  assignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_binding (userId, groupId, roleId, scopeType, scopeId),
  FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
  FOREIGN KEY (groupId) REFERENCES g_groups(id) ON DELETE CASCADE,
  INDEX idx_user_scope (userId, scopeType, scopeId),
  INDEX idx_group_scope (groupId, scopeType, scopeId),
  INDEX idx_role_id (roleId),
  CHECK (userId IS NOT NULL OR groupId IS NOT NULL)
);
```

### 5.2 scopeType 정의

| scopeType | scopeId | 의미 | 우선순위 |
|-----------|---------|------|----------|
| `system` | `'SYSTEM'` (상수) | 전체 시스템 범위 (System Admin) | 가장 낮음 (최상위 fallback) |
| `org` | orgId | 조직 내 모든 프로젝트에 기본 적용 | |
| `project` | projectId | 특정 프로젝트에서 오버라이드 | |
| `environment` | environmentId | 특정 환경에서 오버라이드 | 가장 높음 |

### 5.3 오버라이드 동작

**규칙: 가장 구체적인 바인딩이 이김** (Override)

| 시스템 | 조직 | 프로젝트 | 환경 | 최종 역할 |
|--------|------|----------|------|-----------|
| — | Developer | — | — | Developer |
| — | Developer | Viewer (프로젝트A) | — | A에서 Viewer, 나머지 Developer |
| — | Developer | — | ReadOnly (prod) | prod에서 ReadOnly, 나머지 Developer |
| — | Developer | Viewer (A) | Editor (A/prod) | A의 prod에서 Editor, A 나머지는 Viewer, 다른건 Developer |
| SysAdmin | — | — | — | 전체 시스템 모든 권한 |

### 5.4 바인딩 예시 (DB rows)

```
-- User A의 조직 기본 역할: Developer
INSERT INTO g_role_bindings (userId, roleId, scopeType, scopeId)
VALUES ('userA', 'role_developer', 'org', 'org001');

-- User A의 프로젝트 GameB에서 오버라이드: Viewer
INSERT INTO g_role_bindings (userId, roleId, scopeType, scopeId)
VALUES ('userA', 'role_viewer', 'project', 'proj_gameB');

-- User A의 GameA/production에서 오버라이드: ReadOnly
INSERT INTO g_role_bindings (userId, roleId, scopeType, scopeId)
VALUES ('userA', 'role_readonly', 'environment', 'env_gamea_prod');

-- QA Team 그룹의 조직 기본 역할: QA Tester
INSERT INTO g_role_bindings (groupId, roleId, scopeType, scopeId)
VALUES ('group_qa', 'role_qa_tester', 'org', 'org001');

-- QA Team의 production 환경에서 오버라이드: ReadOnly
INSERT INTO g_role_bindings (groupId, roleId, scopeType, scopeId)
VALUES ('group_qa', 'role_readonly', 'environment', 'env_gamea_prod');
```

---

## 6. 그룹 (Group)

### 6.1 그룹 테이블 (기존 유지)

```sql
-- 변경 없음
CREATE TABLE g_groups (...);               -- 그룹 정의
CREATE TABLE g_group_members (...);        -- 그룹 멤버십
```

### 6.2 그룹-역할 할당 방식 변경

```
v2: g_group_roles (groupId, roleId) → 조직 레벨에서만 할당
v3: g_role_bindings (groupId, roleId, scopeType, scopeId) → 스코프별 할당 가능
```

> `g_group_roles` 테이블은 삭제되고 `g_role_bindings`로 통합됩니다.

---

## 7. 퍼미션 정의

### 7.1 포맷 (v2와 동일)

```
resource:action
```

### 7.2 액션

| 액션 | 설명 |
|------|------|
| `create` | 생성 |
| `read` | 조회 |
| `update` | 수정 |
| `delete` | 삭제 |
| `access` | 접근 (콘솔, 채팅) |
| `approve` | 승인 (CR) |

### 7.3 와일드카드

| 패턴 | 의미 |
|------|------|
| `*:*` | 모든 리소스, 모든 액션 |
| `users:*` | users 전체 액션 |
| `*:read` | 모든 리소스 읽기 |

### 7.4 리소스 목록 (v2와 동일)

> [!CAUTION]
> **퍼미션 문자열 하드코딩 절대 금지.** FE/BE 모두 `@gatrix/shared/permissions`의 상수만 사용.

#### System 리소스

| 리소스 | 액션 | 설명 |
|--------|------|------|
| `organisations` | `create` `read` `update` `delete` | 조직 관리 |
| `system_config` | `read` `update` | 시스템 설정 |
| `system_monitoring` | `read` | 글로벌 모니터링 |

#### Org 리소스

| 리소스 | 액션 |
|--------|------|
| `users` | `create` `read` `update` `delete` |
| `groups` | `create` `read` `update` `delete` |
| `roles` | `create` `read` `update` `delete` |
| `invitations` | `create` `read` `delete` |
| `projects` | `create` `read` `update` `delete` |
| `audit_logs` | `read` |
| `system_settings` | `read` `update` |
| `admin_tokens` | `create` `read` `delete` |
| `ip_whitelist` | `create` `read` `update` `delete` |
| `account_whitelist` | `create` `read` `update` `delete` |
| `integrations` | `read` `update` |
| `translation` | `read` `update` |
| `console` | `access` |
| `chat` | `access` |
| `monitoring` | `read` |
| `open_api` | `read` |
| `scheduler` | `read` `create` `update` `delete` |
| `event_lens` | `read` `update` |
| `crash_events` | `read` |
| `realtime_events` | `read` |

#### Project 리소스

| 리소스 | 액션 |
|--------|------|
| `features` | `create` `read` `update` `delete` |
| `segments` | `create` `read` `update` `delete` |
| `context_fields` | `create` `read` `update` `delete` |
| `release_flows` | `create` `read` `update` `delete` |
| `tags` | `create` `read` `update` `delete` |
| `planning_data` | `create` `read` `update` `delete` |
| `service_accounts` | `create` `read` `update` `delete` |
| `signal_endpoints` | `create` `read` `update` `delete` |
| `actions` | `create` `read` `update` `delete` |
| `data` | `read` `update` |
| `unknown_flags` | `read` |
| `impact_metrics` | `read` `update` |

#### Environment 리소스

| 리소스 | 액션 |
|--------|------|
| `environments` | `read` `update` `delete` |
| `env_features` | `update` |
| `change_requests` | `create` `approve` |
| `env_keys` | `create` `read` `delete` |
| `client_versions` | `create` `read` `update` `delete` |
| `game_worlds` | `create` `read` `update` `delete` |
| `maintenance` | `read` `update` |
| `maintenance_templates` | `create` `read` `update` `delete` |
| `service_notices` | `create` `read` `update` `delete` |
| `banners` | `create` `read` `update` `delete` |
| `coupons` | `create` `read` `update` `delete` |
| `coupon_settings` | `read` `update` |
| `surveys` | `create` `read` `update` `delete` |
| `store_products` | `create` `read` `update` `delete` |
| `reward_templates` | `create` `read` `update` `delete` |
| `ingame_popups` | `create` `read` `update` `delete` |
| `operation_events` | `create` `read` `update` `delete` |
| `servers` | `create` `read` `update` `delete` |
| `message_templates` | `create` `read` `update` `delete` |
| `vars` | `read` `update` |

---

## 8. 권한 계산 엔진

### 8.1 권한 확인 순서

```
hasPermission(userId, scopeType, scopeId, permission) → boolean

1. System Admin 체크
   → system 바인딩에 *:* 있는 역할 보유 시 즉시 허용
   → 멤버십 체크 우회

2. 조직 멤버십 게이트
   → g_organisation_members에 해당 orgId 멤버인지 확인
   → 아니면 즉시 거부

3. Org Admin 체크
   → orgRole = 'admin'이면 즉시 허용 (해당 조직 내 모든 권한)

4. 프로젝트 멤버십 게이트 (scopeType이 project 또는 environment인 경우)
   → g_project_members에 해당 projectId 멤버인지 확인
   → 아니면 즉시 거부

5. 효과적 역할 결정 (Override: 가장 구체적인 바인딩 우선)
   a. environment 바인딩 확인 → 있으면 이 역할 사용
   b. project 바인딩 확인 → 있으면 이 역할 사용
   c. org 바인딩 확인 → 있으면 이 역할 사용
   d. system 바인딩 확인 → fallback

6. 효과적 역할의 g_role_permissions에서 와일드카드 포함 매칭
   → 역할 상속(g_role_inheritance) 반영

최종: 매칭 성공 → 허용, 실패 → 거부
```

### 8.2 의사코드

```typescript
class PermissionService {

  async hasPermission(
    userId: string,
    scopeType: 'system' | 'org' | 'project' | 'env',
    scopeId: string,
    permission: string
  ): Promise<boolean> {

    // 1. System Admin
    if (await this.isSystemAdmin(userId)) return true;

    // 2. Org membership gate
    const orgId = await this.resolveOrgId(scopeType, scopeId);
    if (!await this.isOrgMember(userId, orgId)) return false;

    // 3. Org Admin
    if (await this.isOrgAdmin(userId, orgId)) return true;

    // 4. Project membership gate (for project/env scope)
    if (scopeType === 'project' || scopeType === 'env') {
      const projectId = await this.resolveProjectId(scopeType, scopeId);
      if (!await this.isProjectMember(userId, projectId)) return false;
    }

    // 5. Get effective role (most specific binding wins)
    const roleIds = await this.getEffectiveRoleIds(userId, scopeType, scopeId);
    if (roleIds.length === 0) return false;

    // 6. Check permissions (with inheritance + wildcard matching)
    const allRoleIds = await this.resolveInheritedRoles(roleIds);
    const perms = await this.getRolePermissions(allRoleIds);
    return perms.some(p => matchSingle(p, permission));
  }

  /**
   * Override resolution: most specific binding wins
   * env binding > project binding > org binding > system binding
   */
  private async getEffectiveRoleIds(
    userId: string,
    scopeType: string,
    scopeId: string
  ): Promise<string[]> {

    // Collect bindings from direct + groups
    if (scopeType === 'env') {
      const envBindings = await this.getBindings(userId, 'environment', scopeId);
      if (envBindings.length > 0) return envBindings;

      const projectId = await this.getProjectFromEnv(scopeId);
      const projBindings = await this.getBindings(userId, 'project', projectId);
      if (projBindings.length > 0) return projBindings;
    }

    if (scopeType === 'project') {
      const projBindings = await this.getBindings(userId, 'project', scopeId);
      if (projBindings.length > 0) return projBindings;
    }

    const orgId = await this.resolveOrgId(scopeType, scopeId);
    const orgBindings = await this.getBindings(userId, 'org', orgId);
    if (orgBindings.length > 0) return orgBindings;

    return this.getBindings(userId, 'system', 'SYSTEM');
  }

  /**
   * Get role IDs from both direct user bindings and group bindings
   */
  private async getBindings(
    userId: string,
    scopeType: string,
    scopeId: string
  ): Promise<string[]> {
    // Direct bindings
    const direct = await db('g_role_bindings')
      .where({ userId, scopeType, scopeId })
      .select('roleId');

    // Group bindings
    const groupBindings = await db('g_role_bindings as rb')
      .join('g_group_members as gm', 'rb.groupId', 'gm.groupId')
      .where('gm.userId', userId)
      .where('rb.scopeType', scopeType)
      .where('rb.scopeId', scopeId)
      .select('rb.roleId');

    const ids = new Set([
      ...direct.map(r => r.roleId),
      ...groupBindings.map(r => r.roleId),
    ]);
    return Array.from(ids);
  }
}
```

### 8.3 접근 범위 조회

```typescript
/**
 * 사용자가 접근 가능한 프로젝트 목록
 */
async getAccessibleProjectIds(userId: string, orgId: string): Promise<string[]> {
  // System Admin / Org Admin → all projects
  if (await this.isSystemAdmin(userId)) {
    return this.getAllProjectIds(orgId);
  }
  if (await this.isOrgAdmin(userId, orgId)) {
    return this.getAllProjectIds(orgId);
  }

  // Project members 테이블에서 조회
  const memberProjects = await db('g_project_members')
    .where('userId', userId)
    .join('g_projects', 'g_project_members.projectId', 'g_projects.id')
    .where('g_projects.orgId', orgId)
    .where('g_projects.isActive', true)
    .select('g_projects.id');

  return memberProjects.map(p => p.id);
}

/**
 * 사용자가 접근 가능한 환경 목록
 * 프로젝트 멤버이면 해당 프로젝트의 모든 환경에 접근 가능
 */
async getAccessibleEnvironmentIds(
  userId: string, orgId: string, projectId: string
): Promise<string[]> {
  // System Admin / Org Admin / Project Member → all environments
  if (await this.isSystemAdmin(userId)) {
    return this.getAllEnvironmentIds(projectId);
  }
  if (await this.isOrgAdmin(userId, orgId)) {
    return this.getAllEnvironmentIds(projectId);
  }
  if (await this.isProjectMember(userId, projectId)) {
    return this.getAllEnvironmentIds(projectId);
  }
  return [];
}
```

---

## 9. 기본 역할 프리셋

시스템 초기화 시 자동 생성. `isSystemDefined = TRUE`, 삭제 불가.

| 역할 | 권한 | 용도 |
|------|------|------|
| **System Admin** | `*:*` | 전체 시스템 관리 (system 바인딩 전용) |
| **Org Admin** | `*:*` | 조직 전체 관리 (orgRole='admin'과 동일 효과) |
| **Project Admin** | `*:*` | 프로젝트 전체 접근 (project 바인딩 전용) |
| **Editor** | `features:*`, `segments:*`, `client_versions:*`, `change_requests:create` 등 | 데이터 편집 |
| **Viewer** | `*:read` | 모든 리소스 읽기 전용 |

> 프리셋은 복사하여 커스텀 역할을 만들 수 있도록 UI 제공.

---

## 10. 역할 상속

```sql
-- v2에서 추가됨 (유지)
CREATE TABLE g_role_inheritance (
  id CHAR(26) PRIMARY KEY,
  roleId CHAR(26) NOT NULL,          -- 자식
  parentRoleId CHAR(26) NOT NULL,    -- 부모
  UNIQUE KEY uniq_role_parent (roleId, parentRoleId),
  FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (parentRoleId) REFERENCES g_roles(id) ON DELETE CASCADE
);
```

- 최대 5레벨, 순환 참조 방지
- `Editor` → `Viewer` 상속 시, Editor는 Viewer의 `*:read`를 자동 포함

---

## 11. 키/토큰 체계

### 11.1 Environment Key (SDK용)

```sql
-- 기존 유지 (v1에서 정의)
CREATE TABLE g_environment_keys (...);
```

- 1키 = 1환경
- `gx_client_` / `gx_server_` prefix
- 키 → 환경 → 프로젝트 → 조직 자동 resolve

### 11.2 Admin API Token (관리용)

```sql
-- 기존 유지
-- roleId FK → g_roles, 바인딩 대신 직접 역할 참조 (토큰은 scopeType 없이 역할의 전체 권한 적용)
CREATE TABLE g_admin_api_tokens (...);
```

---

## 12. DB 스키마 — 테이블 전체 목록

### 12.1 테이블 변경 요약

| 테이블 | 상태 | 비고 |
|--------|------|------|
| `g_organisations` | 유지 | — |
| `g_organisation_members` | 유지 | 접근 게이트 역할 강화 |
| `g_projects` | 유지 | — |
| `g_project_members` | 유지 | 접근 게이트 역할 강화 |
| `g_environments` | 유지 | — |
| `g_roles` | 유지 | isSystemDefined 추가(v2) |
| `g_role_permissions` | **신규** | 3개 통합 → 1개 (범위 없음) |
| `g_role_bindings` | **신규** | 스코프별 역할 할당 |
| `g_role_inheritance` | 유지 | v2에서 추가 |
| `g_groups` | 유지 | — |
| `g_group_members` | 유지 | — |
| `g_environment_keys` | 유지 | — |
| `g_admin_api_tokens` | 유지 | — |
| `g_sso_providers` | 유지 | — |
| `g_role_org_permissions` | **삭제** | → g_role_permissions |
| `g_role_project_permissions` | **삭제** | → g_role_permissions + g_role_bindings |
| `g_role_environment_permissions` | **삭제** | → g_role_permissions + g_role_bindings |
| `g_user_roles` | **삭제** | → g_role_bindings |
| `g_group_roles` | **삭제** | → g_role_bindings |

---

## 13. 마이그레이션 전략

### 13.1 데이터 변환

```
1. g_role_org_permissions → g_role_permissions
   roleId=R1, permission='users:read'
   → g_role_permissions: roleId=R1, permission='users:read'

2. g_role_project_permissions → g_role_permissions + g_role_bindings
   roleId=R1, projectId=P1, permission='features:update'
   → g_role_permissions: roleId=R1, permission='features:update' (중복 skip)
   → 기존 g_user_roles에서 R1을 가진 사용자마다:
      g_role_bindings: userId=U, roleId=R1, scopeType=project, scopeId=P1

3. g_role_environment_permissions → g_role_permissions + g_role_bindings
   roleId=R1, environmentId=E1, permission='client_versions:read'
   → g_role_permissions: roleId=R1, permission='client_versions:read' (중복 skip)
   → g_role_bindings: userId=U, roleId=R1, scopeType=environment, scopeId=E1

4. g_user_roles → g_role_bindings
   userId=U, roleId=R1
   → g_role_bindings: userId=U, roleId=R1, scopeType=org, scopeId={user's orgId}

5. g_group_roles → g_role_bindings
   groupId=G, roleId=R1
   → g_role_bindings: groupId=G, roleId=R1, scopeType=org, scopeId={group's orgId}
```

> [!WARNING]
> 현재 구조에서 **하나의 역할이 프로젝트/환경별로 다른 권한 세트**를 가질 수 있었습니다.
> 새 구조에서는 역할에 범위가 없으므로, 마이그레이션 시 **프로젝트별 권한이 다른 역할은 별도의 역할로 분리**해야 합니다.
> 예: 역할 R1이 프로젝트 P1에서 `features:read`이고 P2에서 `features:update`이면 → R1_P1과 R1_P2로 분리.

### 13.2 마이그레이션 순서

| 단계 | 내용 |
|------|------|
| 1 | `g_role_permissions` 테이블 생성 |
| 2 | `g_role_bindings` 테이블 생성 |
| 3 | 기존 데이터 변환 스크립트 실행 |
| 4 | 백엔드 코드 배포 (PermissionService, RoleModel, rbac routes) |
| 5 | 프론트엔드 코드 배포 (역할 편집 UI, 바인딩 관리 UI) |
| 6 | 기존 5개 테이블 삭제 (이전 단계 검증 후) |

---

## 14. API 라우트 설계

### 14.1 바인딩 관리 API (신규)

```
GET    /api/admin/rbac/bindings?userId=X            -- 사용자의 모든 바인딩
GET    /api/admin/rbac/bindings?scopeType=project&scopeId=X  -- 프로젝트의 모든 바인딩
POST   /api/admin/rbac/bindings                      -- 바인딩 추가
DELETE /api/admin/rbac/bindings/:id                   -- 바인딩 삭제
```

### 14.2 역할 API (변경)

```
GET    /api/admin/rbac/roles                         -- 역할 목록
GET    /api/admin/rbac/roles/:id                     -- 역할 상세 (권한 포함)
POST   /api/admin/rbac/roles                         -- 역할 생성
PUT    /api/admin/rbac/roles/:id                     -- 역할 수정
DELETE /api/admin/rbac/roles/:id                     -- 역할 삭제
PUT    /api/admin/rbac/roles/:id/permissions         -- 🆕 역할 권한 설정 (단순화)
```

### 14.3 권한 프리뷰 API

```
GET    /api/admin/rbac/users/:id/effective-permissions  -- 사용자의 실효 권한 (모든 소스 종합)
GET    /api/admin/rbac/preview?userId=X&scopeType=project&scopeId=Y -- 특정 스코프에서의 실효 권한
```

---

## 15. UI 변경점

### 15.1 역할 편집 화면 (변경)

```
[ 역할 편집: Developer ]

권한 설정:
┌──────────────────────────────────────────┐
│ 리소스              │ C │ R │ U │ D │     │
│─────────────────────┼───┼───┼───┼───┼─────│
│ features            │ ✓ │ ✓ │ ✓ │ ✓ │ 전체│
│ segments            │   │ ✓ │   │   │     │
│ client_versions     │   │ ✓ │ ✓ │   │     │
│ change_requests     │ ✓ │   │   │   │     │
└──────────────────────────────────────────┘
(프로젝트/환경 선택 영역 없음 — 순수 권한만)
```

### 15.2 사용자 화면 — 역할 바인딩 탭 (신규)

```
[ 사용자: user@example.com ]

역할 바인딩:
┌──────────────────────────────────────────────────┐
│ 스코프              │ 역할        │ 출처          │
│─────────────────────┼─────────────┼───────────────│
│ 🏢 조직 (기본)      │ Developer   │ 직접          │
│ 📁 Project GameA    │ (기본값)    │ —             │
│ 📁 Project GameB    │ Viewer ✏️   │ 직접 오버라이드│
│   🌍 GameA/prod     │ ReadOnly ✏️ │ 직접 오버라이드│
│   🌍 GameB/dev      │ (기본값)    │ —             │
└──────────────────────────────────────────────────┘
[+ 바인딩 추가]
```

### 15.3 프로젝트 멤버 화면 (변경)

```
[ 프로젝트 GameB > 멤버 ]

┌──────────────────────────────────────────────────┐
│ 사용자              │ 기본 역할   │ 프로젝트 역할 │
│─────────────────────┼─────────────┼───────────────│
│ user@example.com    │ Developer   │ Viewer ✏️     │
│ dev@example.com     │ Developer   │ (기본값)      │
│ qa@example.com      │ QA Tester   │ (기본값, QA팀)│
└──────────────────────────────────────────────────┘
[+ 멤버 추가]
```

---

## 16. 엣지케이스 및 보안

### 16.1 삭제/비활성화 시

| 이벤트 | 처리 |
|--------|------|
| Role 삭제 | CASCADE → g_role_permissions, g_role_bindings 연쇄 삭제 |
| Group 삭제 | CASCADE → g_group_members, g_role_bindings(groupId) 삭제 |
| Project 삭제 | CASCADE → g_project_members, g_role_bindings(scopeType=project, scopeId) 삭제 |
| Environment 삭제 | CASCADE → g_role_bindings(scopeType=environment, scopeId) 삭제 |
| User 비활성화 | 권한 데이터 유지, 로그인만 차단 |

### 16.2 바인딩 삭제 시 주의

```
사용자의 org 바인딩이 삭제되면?
→ project/env 오버라이드가 있어도, 해당 스코프에서의 역할은 유지
→ 상위 fallback이 없으므로 org 레벨 기본 역할이 없어짐
→ UI에서 경고: "조직 기본 역할이 없습니다. 스코프별 바인딩만 적용됩니다."
```

### 16.3 보안 고려사항

| 항목 | 설명 |
|------|------|
| System Admin 남용 | system 바인딩은 Org Admin만 생성 가능하도록 제한 |
| 멤버십 + 역할 동기화 | 프로젝트 멤버 제거 시 관련 바인딩도 함께 삭제 |
| 바인딩 에스컬레이션 | 자신보다 높은 역할의 바인딩 생성 불가 |

---

## 17. 캐싱 전략

| 캐시 키 | TTL | 무효화 조건 |
|---------|-----|-------------|
| `rbac:sys_admin:{userId}` | 5분 | system 바인딩 변경 시 |
| `rbac:org_admin:{userId}:{orgId}` | 5분 | 멤버십 변경 시 |
| `rbac:bindings:{userId}:{scopeType}:{scopeId}` | 5분 | 바인딩 변경 시 |
| `rbac:role_perms:{roleId}` | 10분 | 역할 권한 변경 시 |
| `rbac:proj_member:{userId}:{projectId}` | 5분 | 프로젝트 멤버십 변경 시 |

---

*End of Spec Document*
