---
sidebar_position: 1
---

# Gatrix 시작하기

**Gatrix**에 오신 것을 환영합니다. **UWO (Uncharted Waters Online)** 게임 관리를 위해 특별히 제작된 포괄적인 온라인 게임 플랫폼 관리 시스템입니다.

## Gatrix란?

Gatrix는 온라인 게임 플랫폼을 위한 강력한 사용자 관리, 인증 및 관리 기능을 제공하는 현대적인 풀스택 플랫폼입니다. TypeScript, React, MUI, Express.js로 구축되어 게임 플랫폼 운영을 위한 완전한 솔루션을 제공합니다.

### 주요 기능

- 🎮 **게임 플랫폼 관리**: 온라인 게임 관리를 위한 포괄적인 플랫폼
- 🌍 **게임 월드 관리**: 개별 구성이 가능한 다중 월드 지원
- 📱 **클라이언트 버전 관리**: 버전 제어 및 배포 관리
- 🔧 **점검 모드**: 사용자 정의 메시지가 있는 시스템 전체 점검 제어
- 🏷️ **태깅 시스템**: 콘텐츠 구성을 위한 유연한 태깅
- 📝 **메시지 템플릿**: 다국어 메시지 템플릿 관리
- 🛡️ **IP 화이트리스트**: 고급 IP 접근 제어 및 관리
- ⚙️ **작업 스케줄러**: 크론과 유사한 구문을 사용한 고급 작업 스케줄링
- 📊 **큐 모니터링**: Bull Board를 통한 실시간 작업 큐 모니터링

## 사전 요구사항

시작하기 전에 다음이 설치되어 있는지 확인하세요:

- [Node.js](https://nodejs.org/en/download/) 버전 18.0 이상
- [MySQL](https://dev.mysql.com/downloads/) 버전 8.0 이상
- [Redis](https://redis.io/download) 버전 6.0 이상

## 빠른 시작

### 1. 저장소 복제

```bash
git clone https://github.com/motifgames/gatrix.git
cd gatrix
```

### 2. 환경 설정

```bash
# 환경 변수 복사
cp .env.example .env

# 구성에 맞게 .env 파일 업데이트
```

### 3. 의존성 설치

```bash
npm install
```

### 4. 데이터베이스 설정

```bash
# 데이터베이스 마이그레이션 실행
npm run migrate

# 초기 데이터 시드
npm run seed
```

### 5. 개발 서버 시작

```bash
# 프론트엔드와 백엔드 모두 시작
npm run dev
```

애플리케이션은 다음 주소에서 사용할 수 있습니다:
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:5000
- API 문서: http://localhost:5000/api-docs
- 큐 모니터: http://localhost:5000/admin/queues

## 다음 단계

- 📖 [API 문서 읽기](/docs/api/client-api)
- 🔧 [캐시 시스템 알아보기](/docs/backend/cache-keys)
- 🚀 [작업 관리 탐색하기](/docs/features/job-management)
- 🌍 [게임 월드 구성하기](/docs/features/game-worlds)
