# Argus Symbolicator — Fork & Adapt 스펙

> **원본**: [getsentry/symbolicator](https://github.com/getsentry/symbolicator) (Rust)  
> **방식**: Sentry Symbolicator 소스를 **그대로 클론**한 뒤 `sentry` → `argus`로 리네이밍  
> **위치**: `packages/argus-symbolicator`  
> **작성일**: 2026-06-06

---

## 1. 접근 방식

**처음부터 새로 만드는 것이 아님.** Sentry Symbolicator의 소스 코드를 최대한 그대로 사용한다.

### 1.1 작업 범위

| 단계 | 작업 | 설명 |
|------|------|------|
| **1** | **소스 복사** | `getsentry/symbolicator` 소스를 `packages/argus-symbolicator`로 복사 |
| **2** | **리네이밍** | 패키지명/크레이트명에서 `sentry` → `argus` 교체 |
| **3** | **설정 어댑터** | Argus 환경에 맞는 기본 설정값 조정 |
| **4** | **빌드 확인** | `cargo build` 통과 확인 |
| **5** | **Docker 통합** | Argus docker-compose에 서비스 추가 |
| **6** | **파이프라인 연동** | ErrorWorker에서 HTTP 호출로 연동 |

### 1.2 변경하지 않는 것

- 코어 심볼리케이션 로직 (그대로)
- API 엔드포인트 구조 (그대로)
- 캐싱 시스템 (그대로)
- 다운로드 서비스 (그대로)
- 타입 정의 (그대로)

### 1.3 변경하는 것

| 대상 | 변경 내용 |
|------|----------|
| `Cargo.toml` 크레이트 이름 | `symbolicator` → `argus-symbolicator` |
| Sentry SDK 연동 코드 | Sentry 자체 에러 리포팅 → 비활성화 또는 Argus 연동 |
| 기본 설정 | 포트, 캐시 디렉토리 등 Argus 환경에 맞게 조정 |
| Docker 관련 | Argus 인프라에 맞는 Dockerfile, compose 설정 |
| README | Argus 프로젝트 컨텍스트에 맞게 수정 |

---

## 2. 디렉토리 구조 (원본 그대로)

원본 `getsentry/symbolicator` 구조를 그대로 유지:

```
packages/argus-symbolicator/
├── Cargo.toml                    # workspace root (크레이트 이름만 변경)
├── Cargo.lock
├── Dockerfile
├── README.md
├── crates/
│   ├── symbolicator/             # 메인 서버 바이너리
│   ├── symbolicator-service/     # 공유 서비스 (캐시, 다운로드)
│   ├── symbolicator-native/      # 네이티브 심볼리케이션
│   ├── symbolicator-js/          # JS 소스맵
│   ├── symbolicator-proguard/    # JVM/ProGuard
│   ├── symbolicator-crash/       # 자체 크래시 보고
│   └── ...
└── tests/
```

> 내부 디렉토리/모듈 이름은 굳이 바꾸지 않아도 됨. 
> Cargo workspace의 `[package] name`만 `argus-*`로 변경.

---

## 3. 리네이밍 범위

### 3.1 필수 변경

```toml
# Cargo.toml (workspace root)
[workspace.package]
name = "argus-symbolicator"  # was: symbolicator

# crates/symbolicator/Cargo.toml
[package]
name = "argus-symbolicator"  # was: symbolicator

# 기타 crates도 동일 패턴
# symbolicator-service → argus-symbolicator-service
# symbolicator-native → argus-symbolicator-native
# ...
```

### 3.2 의존성 참조 업데이트

각 crate의 `Cargo.toml`에서 workspace 내부 의존성 이름 변경:
```toml
# Before
symbolicator-service = { path = "../symbolicator-service" }
# After
argus-symbolicator-service = { path = "../symbolicator-service" }
```

### 3.3 바이너리 이름

```toml
[[bin]]
name = "argus-symbolicator"  # was: symbolicator
```

---

## 4. Argus 통합 포인트

### 4.1 ErrorWorker 연동

```typescript
// packages/argus-worker/src/workers/error-worker.ts
// HTTP로 argus-symbolicator 호출
const result = await axios.post('http://argus-symbolicator:3021/symbolicate-js', {
  // Sentry Symbolicator API와 100% 동일한 포맷
});
```

### 4.2 Docker Compose 추가

```yaml
# docker-compose.dev.yml
argus-symbolicator:
  build:
    context: ./packages/argus-symbolicator
    dockerfile: Dockerfile
  ports:
    - "3021:3021"
  volumes:
    - symbolicator-cache:/data/cache
  environment:
    - ARGUS_SYMBOLICATOR_BIND=0.0.0.0:3021
```

### 4.3 소스맵 연동

기존 Argus의 소스맵 업로드(`sourcemaps.ts`)와 연동:
- Symbolicator의 `sentry` 소스 타입을 활용하여 Argus API에서 소스맵 조회
- 또는 공유 파일시스템/S3 경로를 `filesystem` 소스 타입으로 직접 접근

---

## 5. 제거 대상

원본에서 Argus에 불필요한 부분:

| 대상 | 사유 |
|------|------|
| `symbolicator-crash` | Sentry 자체 크래시 보고용 (Argus에선 불필요) |
| `symbolicli` | CLI 도구 (나중에 필요하면 추가) |
| `symsorter` | 디버그 파일 정렬 도구 (나중에) |
| `wasm-split` | WASM 빌드 ID 도구 (나중에) |
| `process-event` | 이벤트 처리 유틸리티 (나중에) |
| Sentry SDK 의존성 | 자체 에러 리포팅 → 로깅으로 대체 |
