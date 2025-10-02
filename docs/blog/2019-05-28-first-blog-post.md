---
slug: welcome-to-gatrix
title: Gatrix에 오신 것을 환영합니다! 게임 플랫폼 관리의 새로운 차원
authors: [gatrix-team]
tags: [gatrix, announcement, features]
---

Gatrix는 온라인 게임 플랫폼 관리를 위한 종합적인 솔루션입니다. UWO(Uncharted Waters Online) 게임 관리를 위해 특별히 설계된 이 플랫폼은 현대적인 웹 기술을 활용하여 강력하고 확장 가능한 게임 관리 시스템을 제공합니다.

<!-- truncate -->

## 🎮 Gatrix란 무엇인가요?

Gatrix는 TypeScript, React, MUI, Express.js로 구축된 현대적인 풀스택 게임 플랫폼 관리 시스템입니다. 이 플랫폼은 게임 운영자들이 게임 서버, 사용자, 콘텐츠를 효율적으로 관리할 수 있도록 설계되었습니다.

### 주요 특징

- **🎮 게임 플랫폼 관리**: 온라인 게임 관리를 위한 종합적인 플랫폼
- **🌍 게임 월드 관리**: 개별 설정이 가능한 다중 월드 지원
- **📱 클라이언트 버전 관리**: 버전 제어 및 배포 관리
- **🔧 유지보수 모드**: 사용자 정의 메시지가 있는 시스템 전체 유지보수 제어
- **🏷️ 태깅 시스템**: 콘텐츠 구성의 유연한 태깅
- **📝 메시지 템플릿**: 다국어 메시지 템플릿 관리
- **🛡️ IP 화이트리스트**: 고급 IP 접근 제어 및 관리
- **💬 실시간 채팅**: Socket.IO와 Redis 클러스터링을 통한 고성능 채팅 서버

## 🚀 빠른 시작

### 1. 시스템 요구사항

- Node.js 18.0 이상
- MySQL 8.0 이상
- Redis 6.0 이상

### 2. 설치

```bash
# 저장소 클론
git clone https://github.com/motifgames/gatrix.git
cd gatrix

# 환경 변수 설정
cp .env.example .env

# 의존성 설치
npm install

# 데이터베이스 설정
npm run migrate
npm run seed

# 개발 서버 시작
npm run dev
```

### 3. 접속

설치가 완료되면 다음 URL로 접속할 수 있습니다:

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:5001
- **채팅 서버**: http://localhost:3001
- **API 문서**: http://localhost:5001/api-docs
- **큐 모니터**: http://localhost:5001/admin/queues

## 🎯 다음 단계

1. **[API 문서 읽기](/docs/api/client-api)**: 클라이언트 API 사용법 알아보기
2. **[캐시 시스템 학습](/docs/backend/cache-keys)**: 성능 최적화를 위한 캐시 시스템 이해
3. **[작업 관리 탐색](/docs/features/job-management)**: 자동화된 작업 스케줄링 설정
4. **[게임 월드 구성](/docs/features/game-worlds)**: 다중 게임 월드 설정

## 🤝 커뮤니티

- **GitHub**: [motifgames/gatrix](https://github.com/motifgames/gatrix)
- **이슈 리포트**: [GitHub Issues](https://github.com/motifgames/gatrix/issues)
- **문서**: [이 사이트](/docs/intro)

Gatrix와 함께 게임 플랫폼 관리의 새로운 차원을 경험해보세요! 🚀
