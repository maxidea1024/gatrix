# Gatrix Edge Server (Rust)

Gatrix Edge Server — Rust로 구현된 고성능 캐싱 프록시입니다. **단일 정적 바이너리**로 컴파일되며 런타임 의존성이 없습니다. 모든 Gatrix 백엔드 데이터를 로컬 메모리에 캐싱하고, 매 요청마다 백엔드를 호출하지 않고 클라이언트/서버 SDK 요청을 처리합니다.

## 특징

- 🦀 **단일 바이너리** — 런타임 의존성 없음, ~15MB Docker 이미지
- 🚀 **로컬 캐싱** — 모든 Gatrix 데이터 (게임 월드, 피처 플래그, 공지사항 등) 메모리 캐싱
- 🔄 **실시간 동기화** — Redis PubSub 이벤트 기반 캐시 갱신 또는 폴링
- 🌍 **멀티 환경** — 모든 환경을 동시에 캐싱
- 🏳️ **피처 플래그** — 백엔드 왕복 없이 로컬 평가
- 🔌 **SDK 호환 API** — 클라이언트/서버 SDK의 직접 백엔드 호출 대체
- 🩺 **헬스 체크** — `/health` 엔드포인트 내장
- ⚡ **CLI 오버라이드** — 모든 설정을 명령줄 인자로 재정의 가능

## 요구사항

- Rust >= 1.75 (빌드용)
- Redis (선택사항, 이벤트 기반 캐시 동기화용)
- Gatrix 백엔드 실행 및 접근 가능

## 빠른 시작

### 소스에서 빌드

```bash
cd packages/edge-rust
cargo run
```

### CLI 인자 사용

```bash
cargo run -- --port 3400 --gatrix-url http://localhost:5000 --api-token my-token
```

### Docker 사용

```bash
# 모노레포 루트에서 빌드
docker build -f packages/edge-rust/Dockerfile -t gatrix-edge-rust .

# 실행
docker run -p 3400:3400 -p 3410:3410 \
  -e GATRIX_URL=http://backend:5000 \
  -e EDGE_BYPASS_TOKEN=your-bypass-token \
  gatrix-edge-rust
```

### 사전 빌드된 바이너리

단일 `gatrix-edge-rust` 바이너리를 아무 Linux 서버에 복사하여 실행:

```bash
./gatrix-edge-rust --gatrix-url http://backend:5000 --api-token your-token
```

## 설정

환경변수 또는 CLI 인자로 설정합니다. CLI 인자가 우선 적용됩니다.

| CLI 인자                   | 환경변수                            | 기본값                      | 설명                          |
| -------------------------- | ---------------------------------- | -------------------------- | ----------------------------- |
| `--port`                   | `EDGE_PORT`                        | `3400`                     | 메인 API 포트                  |
| `--gatrix-url`             | `GATRIX_URL`                       | `http://localhost:5000`    | Gatrix 백엔드 URL              |
| `--api-token`              | `EDGE_BYPASS_TOKEN`                | `gatrix-infra-server-token`| 바이패스 API 토큰               |
| `--app-name`               | `EDGE_APPLICATION_NAME`            | `edge-rust-server`         | 애플리케이션 이름                |
| `--service`                | `EDGE_SERVICE`                     | `edge-rust`                | 서비스 라벨                     |
| `--group`                  | `EDGE_GROUP`                       | `gatrix`                   | 그룹 라벨                      |
| `--redis-host`             | `EDGE_REDIS_HOST` / `REDIS_HOST`   | `localhost`                | Redis 호스트                   |
| `--redis-port`             | `EDGE_REDIS_PORT` / `REDIS_PORT`   | `6379`                     | Redis 포트                     |
| `--redis-password`         | `EDGE_REDIS_PASSWORD`              | —                          | Redis 비밀번호 (선택사항)         |
| `--redis-db`               | `EDGE_REDIS_DB` / `REDIS_DB`       | `0`                        | Redis 데이터베이스 번호           |
| `--sync-method`            | `EDGE_SYNC_METHOD`                 | `polling`                  | `polling` / `event` / `manual` |
| `--polling-interval-ms`    | `EDGE_CACHE_POLLING_INTERVAL_MS`   | `30000`                    | 폴링 주기 (밀리초)               |
| `--log-level`              | `EDGE_LOG_LEVEL`                   | `info`                     | 로그 레벨                       |

### 캐시 동기화 방식

| 방식      | Redis 필요 | 설명                                        |
| --------- | --------- | ------------------------------------------ |
| `polling` | ❌        | 주기적으로 캐시 갱신                            |
| `event`   | ✅        | Redis PubSub으로 즉시 갱신 (권장)               |
| `manual`  | ❌        | 자동 갱신 없음                                 |

## 포트

| 포트   | 용도                                        |
| ------ | ------------------------------------------ |
| `3400` | 클라이언트 SDK API, 서버 SDK API, 헬스 체크     |
| `3410` | 내부 API (캐시 관리, 통계)                     |

## API 엔드포인트

### 클라이언트 SDK (포트 3400)

- `GET /api/v1/client/test` — 인증 테스트
- `GET /api/v1/client/client-version` — 클라이언트 버전 조회
- `GET /api/v1/client/client-versions` — 전체 클라이언트 버전
- `GET /api/v1/client/game-worlds` — 게임 월드
- `GET /api/v1/client/banners` — 전체 배너
- `GET /api/v1/client/banners/{bannerId}` — 개별 배너
- `GET /api/v1/client/service-notices` — 서비스 공지

### 서버 SDK (포트 3400)

- `GET /api/v1/server/features` — 피처 플래그 + 세그먼트
- `GET /api/v1/server/segments` — 세그먼트
- `POST /api/v1/server/features/metrics` — 서버 메트릭스
- `POST /api/v1/server/features/unknown` — 알 수 없는 플래그 보고
- `GET|POST /api/v1/server/features/eval` — 피처 평가

### 헬스 체크 (포트 3400)

- `GET /health` — 헬스 체크
- `GET /health/ready` — 준비 상태 확인
- `GET /health/live` — 생존 확인

### 내부 API (포트 3410)

- `GET /internal/health` — 상세 헬스
- `GET /internal/cache/summary` — 캐시 요약
- `POST /internal/cache/refresh` — 캐시 강제 갱신

## 개발

```bash
# 빌드
cargo build

# 디버그 로깅으로 실행
RUST_LOG=debug cargo run

# clippy 린트
cargo clippy

# 릴리스 바이너리 빌드
cargo build --release
```

## docker-compose 예제

```yaml
services:
  edge-rust:
    build:
      context: ../..   # 모노레포 루트
      dockerfile: packages/edge-rust/Dockerfile
    ports:
      - "3400:3400"
      - "3410:3410"
    environment:
      - GATRIX_URL=http://backend:5000
      - EDGE_BYPASS_TOKEN=gatrix-edge-internal-bypass-token
      - EDGE_SYNC_METHOD=event
      - REDIS_HOST=redis
    depends_on:
      - backend
      - redis
```
