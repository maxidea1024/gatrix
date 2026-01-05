# Gatrix 게임 서비스 대시보드
## 관리자 사용자 매뉴얼

**버전:** 1.0  
**최종 업데이트:** 2026년 1월 2일

---

## 목차 (Table of Contents)

### 1. 시작하기
- **[소개 (Introduction)](01-introduction.md)**
  - Gatrix 개요 및 시스템 요구사항
- **[대시보드 개요 (Dashboard Overview)](02-dashboard.md)**
  - 메인 대시보드 (`/dashboard`) 구성

### 2. 게임 운영 관리 (Game Management)
게임 서비스 운영에 필요한 콘텐츠를 관리합니다.
- **[공지사항 관리 (Service Notices)](07-service-notices.md)**
  - 경로: `/game/service-notices`
  - 권한: `service-notices.manage`
- **[인게임 팝업 관리 (Popup Notices)](08-popup-notices.md)**
  - 경로: `/game/ingame-popup-notices`
  - 권한: `ingame-popup-notices.manage`
- **[쿠폰 관리 (Coupon Management)](09-coupons.md)**
  - 경로: `/game/coupons`
  - 권한: `coupons.manage`
- **[설문조사 관리 (Survey Management)](10-surveys.md)**
  - 경로: `/game/surveys`
  - 권한: `surveys.manage`
- **[상점 상품 관리 (Store Products)](11-store-products.md)**
  - 경로: `/game/store-products`
  - 권한: `store-products.manage`
- **[배너 관리 (Banner Management)](12-banners.md)**
  - 경로: `/game/banners`
  - 권한: `banners.manage`
- **[기획 데이터 관리 (Planning Data)](13-planning-data.md)**
  - 경로: `/game/planning-data`
  - 권한: `planning-data.manage`

### 3. 클라이언트 및 서버 관리 (Client & Server)
게임 서버와 클라이언트 버전을 제어합니다.
- **[클라이언트 버전 관리 (Client Versions)](04-client-versions.md)**
  - 경로: `/admin/client-versions`
  - 권한: `client-versions.manage`
- **[게임 월드 관리 (Game Worlds)](05-game-worlds.md)**
  - 경로: `/admin/game-worlds`
  - 권한: `game-worlds.manage`
- **[점검 관리 (Maintenance)](06-maintenance.md)**
  - 경로: `/admin/maintenance`
  - 권한: `maintenance.manage`
- **[서버 생명주기 (Server Lifecycle)](15-server-management.md)**
  - 경로: `/admin/server-lifecycle` (실제 메뉴명 확인 필요)
  - 권한: `servers.view`
- **[리모트 컨피그 (Remote Config)](14-remote-config.md)**
  - 경로: `/admin/remote-config`
  - 권한: `remote-config.manage`

### 4. 사용자 및 권한 (Users & Permissions)
- **[사용자 관리 (User Management)](03-user-management.md)**
  - 경로: `/admin/users`
  - 권한: `users.manage`
- **[API 토큰 관리 (API Tokens)](17-api-tokens.md)**
  - 경로: `/admin/api-tokens`
  - 권한: `security.manage`

### 5. 모니터링 및 로그 (Monitoring)
- **[감사 로그 및 모니터링 (Audit & Monitoring)](16-monitoring.md)**
  - 경로: `/admin/audit-logs`, `/monitoring/logs`
  - 권한: `audit-logs.view`, `monitoring.view`

### 6. 시스템 설정 (Settings)
- **[시스템 설정 (System Settings)](18-settings.md)**
  - 태그 관리 (`/settings/tags`)
  - 환경 관리 (`/settings/environments`)
  - KV 설정 (`/settings/kv`)
  - 권한: `system-settings.manage`, `tags.manage`

---

## 권한 참조 (Permissions Reference)

| 카테고리 | 기능 | 관리 권한 (Manage) | 조회 권한 (View) |
|---|---|---|---|
| **Game** | 공지사항 | `service-notices.manage` | `service-notices.view` |
| | 쿠폰 | `coupons.manage` | `coupons.view` |
| | 상점 | `store-products.manage` | `store-products.view` |
| **Admin** | 사용자 | `users.manage` | `users.view` |
| | 점검 | `maintenance.manage` | `maintenance.view` |
| | 리모트 컨피그 | `remote-config.manage` | `remote-config.view` |

---

© 2026 Gatrix. All rights reserved.
