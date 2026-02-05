---
sidebar_position: 1
---

# Gatrix 소개

**Gatrix**는 온라인 게임 서비스를 위한 통합 관리 시스템입니다.

## 🎯 핵심 기능

### 피처 플래그 (Feature Flags)
코드 배포 없이 기능을 실시간으로 제어합니다.
- 환경별/세그먼트별 점진적 출시
- A/B 테스트 지원
- 즉각적인 롤백

### 게임 운영 도구
- **공지사항** - 인게임 및 외부 공지 관리
- **팝업 공지** - 타겟팅된 인게임 팝업
- **쿠폰** - 보상 쿠폰 생성 및 관리
- **설문조사** - 유저 의견 수집
- **배너** - 홍보 배너 관리
- **상점 상품** - 인앱 상품 관리
- **기획 데이터** - 게임 밸런스 및 설정 데이터

### 시스템 관리
- **점검 관리** - 정기/긴급 점검 스케줄링
- **화이트리스트** - 테스트 계정/IP 관리
- **게임 월드** - 서버 상태 모니터링
- **클라이언트 버전** - 앱 버전 관리

### 외부 연동
Slack, Microsoft Teams, Webhook, New Relic, Lark 등 다양한 서비스 연동 지원

### 모니터링
- **Event Lens** - 이벤트 분석 및 통계
- **Grafana 대시보드** - 실시간 메트릭 모니터링
- **감사 로그** - 모든 변경 이력 추적

## 🏗️ 아키텍처

Gatrix는 모노레포 구조의 마이크로서비스 아키텍처입니다:

| 패키지 | 설명 |
|--------|------|
| `@gatrix/backend` | 메인 API 서버 |
| `@gatrix/frontend` | 관리자 대시보드 (React + MUI) |
| `@gatrix/edge` | 엣지 서버 (캐시/CDN 용도) |
| `@gatrix/chat-server` | 실시간 채팅 서버 |
| `@gatrix/event-lens` | 이벤트 분석 서버 |
| `@gatrix/server-sdk` | 게임 서버용 SDK |
| `@gatrix/shared` | 공유 타입 및 유틸리티 |

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
yarn install

# 2. 인프라 시작 (MySQL, Redis)
yarn infra:up

# 3. 마이그레이션
yarn migrate

# 4. 개발 서버 시작
yarn dev
```

접속: http://localhost:43000

## 🌐 지원 언어

- 🇰🇷 한국어
- 🇺🇸 English
- 🇨🇳 简体中文

## 📚 문서 구조

| 섹션 | 설명 |
|------|------|
| [시작하기](./getting-started/quick-start) | 설치 및 초기 설정 |
| [피처 플래그](./features/feature-flags) | 기능 토글 사용법 |
| [게임 운영](./guide/service-notices) | 운영 도구 가이드 |
| [시스템 관리](./admin/maintenance) | 시스템 관리 가이드 |
| [외부 연동](./integrations/overview) | 연동 설정 가이드 |
| [API 레퍼런스](./api/client-api) | API 문서 |
