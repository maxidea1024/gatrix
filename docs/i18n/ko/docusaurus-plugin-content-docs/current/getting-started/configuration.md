---
sidebar_position: 3
---

# 설정 가이드

Gatrix의 각종 설정 방법을 안내합니다.

## 환경 변수

### 데이터베이스 설정

| 변수               | 설명                | 기본값              |
| ------------------ | ------------------- | ------------------- |
| `DB_HOST`          | MySQL 호스트        | localhost           |
| `DB_PORT`          | MySQL 포트          | 43306               |
| `DB_NAME`          | 데이터베이스 이름   | gatrix              |
| `DB_USER`          | MySQL 사용자        | gatrix_user         |
| `DB_PASSWORD`      | MySQL 비밀번호      | gatrix_password     |
| `DB_ROOT_PASSWORD` | MySQL 루트 비밀번호 | gatrix_rootpassword |

### Redis 설정

| 변수             | 설명           | 기본값    |
| ---------------- | -------------- | --------- |
| `REDIS_HOST`     | Redis 호스트   | localhost |
| `REDIS_PORT`     | Redis 포트     | 46379     |
| `REDIS_PASSWORD` | Redis 비밀번호 | (없음)    |
| `REDIS_DB`       | Redis DB 번호  | 0         |

### 서비스 포트

| 변수              | 설명             | 기본값 |
| ----------------- | ---------------- | ------ |
| `BACKEND_PORT`    | Backend API 포트 | 45000  |
| `FRONTEND_PORT`   | Frontend 포트    | 43000  |
| `EDGE_PORT`       | Edge 서버 포트   | 3400   |
| `CHAT_PORT`       | Chat 서버 포트   | 45100  |
| `EVENT_LENS_PORT` | Event Lens 포트  | 45200  |
| `GRAFANA_PORT`    | Grafana 포트     | 44000  |
| `PROMETHEUS_PORT` | Prometheus 포트  | 49090  |

### 보안 설정

| 변수                 | 설명                 | 기본값                            |
| -------------------- | -------------------- | --------------------------------- |
| `JWT_SECRET`         | JWT 서명 키          | dev-jwt-secret                    |
| `JWT_REFRESH_SECRET` | JWT 리프레시 토큰 키 | dev-refresh-secret                |
| `SESSION_SECRET`     | 세션 암호화 키       | dev-session-secret                |
| `API_TOKEN`          | 내부 API 토큰        | gatrix-unsecured-server-api-token |

### 관리자 계정

| 변수             | 설명            | 기본값           |
| ---------------- | --------------- | ---------------- |
| `ADMIN_EMAIL`    | 관리자 이메일   | admin@gatrix.com |
| `ADMIN_PASSWORD` | 관리자 비밀번호 | admin123         |
| `ADMIN_NAME`     | 관리자 이름     | Administrator    |

### OAuth 설정 (선택)

| 변수                   | 설명                       |
| ---------------------- | -------------------------- |
| `GITHUB_CLIENT_ID`     | GitHub OAuth Client ID     |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `GOOGLE_CLIENT_ID`     | Google OAuth Client ID     |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |

### 로깅 설정

| 변수                  | 설명           | 기본값                            |
| --------------------- | -------------- | --------------------------------- |
| `LOG_LEVEL`           | 로그 레벨      | debug                             |
| `LOG_FORMAT`          | 로그 형식      | json                              |
| `GATRIX_LOKI_ENABLED` | Loki 연동 여부 | true                              |
| `GATRIX_LOKI_URL`     | Loki Push URL  | http://loki:3100/loki/api/v1/push |

## 환경(Environment)

Gatrix는 여러 환경을 지원합니다. 환경별로 피처 플래그를 독립적으로 관리할 수 있습니다.

### 기본 환경

- **development** - 개발 환경
- **staging** - 스테이징 환경
- **production** - 프로덕션 환경

### 환경 추가

대시보드의 **Settings > Environments** 메뉴에서 새 환경을 추가할 수 있습니다.

## 언어 설정

대시보드 및 API 응답에서 여러 언어를 지원합니다:

| 변수                    | 설명                 | 기본값 |
| ----------------------- | -------------------- | ------ |
| `DEFAULT_LANGUAGE`      | 기본 언어            | ko     |
| `VITE_DEFAULT_LANGUAGE` | 프론트엔드 기본 언어 | ko     |

지원 언어:

- `ko` - 한국어
- `en` - 영어
- `zh` - 중국어 간체

## 서비스 디스커버리

게임 서버 연동을 위한 서비스 디스커버리 설정:

| 변수                              | 설명            | 기본값           |
| --------------------------------- | --------------- | ---------------- |
| `SERVICE_DISCOVERY_MODE`          | 디스커버리 모드 | etcd             |
| `ETCD_HOSTS`                      | etcd 호스트     | http://etcd:2379 |
| `SERVICE_DISCOVERY_HEARTBEAT_TTL` | 하트비트 TTL    | 30               |
