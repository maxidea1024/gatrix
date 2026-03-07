# RBAC Scope별 리소스 매핑 스펙

## Scope Hierarchy (Ring 0 방식)

```
system(0) > org(1) > project(2) > env(3)
```

낮은 숫자 = 높은 권한.  
`getEffectiveRoleIds`는 scope 체인을 타고 올라가므로, project 권한 체크 시 org/system 바인딩도 확인됨.

---

## System Scope (Level 0)

전체 시스템 관리. Super Admin만 보유.

| Resource | Permissions | 설명 |
|---|---|---|
| `organisations` | read, create, update, delete | 조직 관리 |
| `system_config` | read, update | 시스템 설정 |
| `system_monitoring` | read | 시스템 모니터링 |

---

## Org Scope (Level 1)

조직 내 공통 리소스.

| Resource | Permissions | 설명 |
|---|---|---|
| `users` | read, create, update, delete | 사용자 관리 |
| `groups` | read, create, update, delete | 사용자 그룹 |
| `roles` | read, create, update, delete | 역할 관리 |
| `invitations` | read, create, update, delete | 초대 관리 |
| `projects` | read, create, update, delete | 프로젝트 관리 |
| `audit_logs` | read | 감사 로그 조회 |
| `system_settings` | read, update | 조직 설정 |
| `integrations` | read, create, update, delete | 외부 연동 |
| `translation` | read, update | 번역 관리 |
| `console` | access | 콘솔 접근 |
| `chat` | access | 채팅 접근 |
| `monitoring` | read | 모니터링 조회 |
| `open_api` | read | OpenAPI 조회 |
| `scheduler` | read, create, update, delete | 스케줄러 관리 |
| `event_lens` | read, update | 이벤트 렌즈 |
| `realtime_events` | read | 실시간 이벤트 |

---

## Project Scope (Level 2)

프로젝트 내 리소스. `/orgs/:orgId/projects/:projectId/...` 경로.

| Resource | Permissions | 설명 |
|---|---|---|
| `features` | read, create, update, delete | 피처 플래그 |
| `segments` | read, create, update, delete | 세그먼트 |
| `context_fields` | read, create, update, delete | 컨텍스트 필드 |
| `release_flows` | read, create, update, delete | 릴리즈 플로우 |
| `tags` | read, create, update, delete | 태그 |
| `service_accounts` | read, create, update, delete | 서비스 계정 |
| `signal_endpoints` | read, create, update, delete | 시그널 엔드포인트 |
| `actions` | read, create, update, delete | 액션 세트 |
| `data` | read, create, update, delete | 데이터 관리 |
| `unknown_flags` | read | 미확인 플래그 |
| `impact_metrics` | read, create, update, delete | 임팩트 메트릭 |
| `crash_events` | read | 크래시 이벤트 |
| `environments` | read, create, update, delete | 환경 관리 |

---

## Env Scope (Level 3)

환경별 리소스. 환경 컨텍스트(`X-Environment-Id` 헤더) 기반.

| Resource | Permissions | 설명 |
|---|---|---|
| `env_features` | read, update | 환경별 피처 플래그 설정 |
| `change_requests` | create, approve | 변경 요청 |
| `env_keys` | create | 환경 키 |
| `client_versions` | read, create, update, delete | 클라이언트 버전 |
| `game_worlds` | read, create, update, delete | 게임 월드 |
| `maintenance` | read, create, update, delete | 점검 관리 |
| `maintenance_templates` | read, create, update, delete | 점검 템플릿 |
| `message_templates` | read, create, update, delete | 메시지 템플릿 |
| `service_notices` | read, create, update, delete | 서비스 공지 |
| `banners` | read, create, update, delete | 배너 |
| `coupons` | read, create, update, delete | 쿠폰 |
| `coupon_settings` | read, update | 쿠폰 설정 |
| `surveys` | read, create, update, delete | 설문조사 |
| `store_products` | read, create, update, delete | 스토어 상품 |
| `reward_templates` | read, create, update, delete | 보상 템플릿 |
| `ingame_popups` | read, create, update, delete | 인게임 팝업 |
| `operation_events` | read, create, update, delete | 운영 이벤트 |
| `servers` | read, update | 서버 관리 |
| `vars` | read, create, update, delete | 변수 관리 |
| `planning_data` | read, create, update, delete | 기획 데이터 |
| `ip_whitelist` | read, create, update, delete | IP 화이트리스트 |
| `account_whitelist` | read, create, update, delete | 계정 화이트리스트 |
| `platform_defaults` | read, update | 플랫폼 기본값 |

---

## Permission Format

```
{resource}:{action}
```

예시: `features:read`, `users:update`, `vars:delete`

### Wildcard

`*:*` — 모든 권한 (system scope에서만 할당 가능)

---

## Middleware Mapping

| Scope | Middleware | 사용 위치 |
|---|---|---|
| Org | `requireOrgPermission(perms)` | 조직 레벨 API (flat routes) |
| Project | `requireProjectPermission(perms)` | 프로젝트 레벨 API (`projectRouter`) |
| Env | `requireEnvPermission(perms)` | 환경 레벨 API (X-Environment-Id 필요) |

`requireEnvPermission`은 환경 ID가 없으면 project → org 순으로 fallback.

---

## Route → Scope 매핑 요약

### Org Level (flat routes)
`/users`, `/audit-logs`, `/translation`, `/jobs`, `/invitations`,
`/crash-events`, `/console`, `/monitoring/alerts`, `/integrations`, `/queue-monitor`

### Project Level (projectRouter)
`/features`, `/tags`, `/environments`, `/unknown-flags`, `/release-flows`,
`/data-management`, `/service-accounts`, `/api-tokens`, `/signal-endpoints`,
`/actions`, `/impact-metrics/*`

### Env Level (projectRouter + X-Environment-Id)
`/client-versions`, `/game-worlds`, `/maintenance`, `/message-templates`,
`/vars`, `/service-notices`, `/ingame-popup-notices`, `/surveys`,
`/reward-templates`, `/store-products`, `/banners`, `/coupon-settings`,
`/cms/cash-shop`, `/server-lifecycle`, `/platform-defaults`, `/change-requests`,
`/planning-data`, `/whitelist`, `/ip-whitelist`
