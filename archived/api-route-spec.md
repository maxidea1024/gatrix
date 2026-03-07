# Backend API Route Spec

Base: `/api/v1/admin`

## 프로젝트 스코프 라우트 (Project-Scoped)

경로 패턴: `/admin/orgs/:orgId/projects/:projectId/...`

| Route | 설명 |
|-------|------|
| `/features` | Feature Flags |
| `/tags` | Tags |
| `/environments` | Environments |
| `/unknown-flags` | Unknown Flags |
| `/release-flows` | Release Flows |
| `/change-requests` | Change Requests |
| `/impact-metrics` | Impact Metrics |

## 글로벌 라우트 (Non-scoped)

경로 패턴: `/admin/...`

| Route | 설명 |
|-------|------|
| `/notifications` | SSE Notifications (auth 미적용) |
| `/services` | Service Discovery (auth 미적용) |
| `/users/me/environments` | 내 환경 접근 (admin 불필요) |
| `/rbac` | RBAC 관리 |
| `/` (adminRoutes) | Dashboard, Stats |
| `/users` | User Management |
| `/whitelist` | Account Whitelist |
| `/ip-whitelist` | IP Whitelist |
| `/api-tokens` | API Tokens |
| `/client-versions` | Client Versions |
| `/audit-logs` | Audit Logs |
| `/message-templates` | Message Templates |
| `/translation` | Translation |
| `/vars` | Vars/KV |
| `/game-worlds` | Game Worlds |
| `/jobs` | Jobs/Scheduler |
| `/maintenance` | Maintenance |
| `/invitations` | Invitations |
| `/crash-events` | Crash Events |
| `/console` | Console |
| `/surveys` | Surveys |
| `/reward-templates` | Reward Templates |
| `/store-products` | Store Products |
| `/service-notices` | Service Notices |
| `/ingame-popup-notices` | Ingame Popup Notices |
| `/monitoring/alerts` | Monitoring Alerts |
| `/planning-data` | Planning Data |
| `/coupon-settings` | Coupon Settings |
| `/data-management` | Data Management |
| `/banners` | Banners |
| `/cms/cash-shop` | CMS Cash Shop |
| `/server-lifecycle` | Server Lifecycle |
| `/integrations` | Integrations |
| `/service-accounts` | Service Accounts |
| `/signal-endpoints` | Signal Endpoints |
| `/actions` | Action Sets |
| `/queue-monitor` | Queue Monitor |
