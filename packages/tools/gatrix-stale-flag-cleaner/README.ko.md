# gatrix-stale-flag-cleaner

Gatrix 프로젝트에서 **오래된(stale) 피처 플래그**를 탐지하고, 코드베이스 내 해당 플래그의 참조를 검색하여 안전하게 정리할 수 있도록 도와주는 CLI 도구입니다.

---

## 사전 요구사항

- **Node.js** >= 18
- **Yarn**
- Gatrix 백엔드 인스턴스 및 서버 API 키

---

## 설치

```bash
# 패키지 디렉터리에서
yarn install
yarn build

# 직접 실행
node dist/cli.js --help

# 링크 후 bin alias 사용
yarn link
gatrix-stale-flag-cleaner --help
```

---

## 커맨드

### `fetch` — 백엔드에서 stale 플래그 조회

Gatrix 백엔드를 쿼리하여 정리 후보 플래그를 출력합니다. 다음 기준으로 판별합니다:

- **Archived** 플래그 (항상 stale)
- `--stale-days` 이상 **100% 켜진** 플래그
- `--stale-days` 이상 **0% 꺼진** 플래그
- 환경 데이터 없이 `--stale-days` 이상 된 **비활성** 플래그

```bash
gatrix-stale-flag-cleaner fetch \
  --backend-url https://your-gatrix.com \
  --api-key YOUR_SERVER_KEY \
  --stale-days 30

# 파일로 저장 (report --input 에서 재사용 가능)
gatrix-stale-flag-cleaner fetch \
  --backend-url https://your-gatrix.com \
  --api-key YOUR_SERVER_KEY \
  --output stale-flags.json
```

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--backend-url` | Gatrix 백엔드 URL | *(필수)* |
| `--api-key` | 서버 API 키 | *(필수)* |
| `--stale-days` | Stale 판별 기준 일수 | `30` |
| `--output` | 결과를 JSON 파일로 저장 | stdout |
| `--json` | JSON 형식으로 출력 | false |

---

### `scan` — 코드베이스에서 특정 플래그 참조 검색

플래그 키의 다양한 네이밍 컨벤션 변형(원본, camelCase, PascalCase, snake\_case, SCREAMING\_SNAKE\_CASE, kebab-case)을 포함하여 소스 파일 전체를 검색합니다.

```bash
gatrix-stale-flag-cleaner scan \
  --flag my-old-feature \
  --root ./src

# JSON 출력
gatrix-stale-flag-cleaner scan \
  --flag my-old-feature \
  --root ./src \
  --json
```

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--flag` | 검색할 피처 플래그 키 | *(필수)* |
| `--root` | 검색 루트 디렉터리 | `.` |
| `--include` | 포함할 Glob 패턴 | 주요 소스 파일 확장자 |
| `--exclude` | 제외할 Glob 패턴 | `node_modules`, `dist` 등 |
| `--output` | 결과를 JSON 파일로 저장 | stdout |
| `--json` | JSON 형식으로 출력 | false |

---

### `report` — stale 플래그 + 코드 참조 통합 리포트

stale 플래그를 가져오고(또는 `--input` 파일 사용) 코드베이스를 단일 패스로 스캔합니다.
어떤 플래그가 대시보드에서 바로 삭제 가능한지, 어떤 플래그가 코드 정리가 필요한지 정리된 리포트를 제공합니다.

```bash
# 백엔드 직접 사용
gatrix-stale-flag-cleaner report \
  --backend-url https://your-gatrix.com \
  --api-key YOUR_SERVER_KEY \
  --root ./src

# 미리 가져온 파일 사용
gatrix-stale-flag-cleaner report \
  --input stale-flags.json \
  --root ./src

# JSON 리포트 저장
gatrix-stale-flag-cleaner report \
  --input stale-flags.json \
  --root ./src \
  --output report.json
```

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--backend-url` | Gatrix 백엔드 URL | — |
| `--api-key` | 서버 API 키 | — |
| `--input` | JSON 파일에서 stale 플래그 읽기 | — |
| `--stale-days` | Stale 판별 기준 일수 | `30` |
| `--root` | 검색 루트 디렉터리 | `.` |
| `--include` | 포함할 Glob 패턴 | 주요 소스 파일 확장자 |
| `--exclude` | 제외할 Glob 패턴 | `node_modules`, `dist` 등 |
| `--output` | JSON 리포트를 파일로 저장 | stdout |
| `--json` | 전체 리포트를 JSON으로 출력 | false |

> `--input` **또는** `--backend-url` + `--api-key` 중 하나는 반드시 제공해야 합니다.

---

## 입력 JSON 형식

`--input` 파일(및 `fetch --output` 결과)은 다음 스키마를 사용합니다:

```json
[
  {
    "key": "old-checkout-flow",
    "keepBranch": "enabled",
    "reason": "100% rollout for 45 days",
    "lastModified": "2025-12-01T00:00:00.000Z"
  },
  {
    "key": "legacy-payment-modal",
    "keepBranch": "disabled",
    "reason": "Flag is archived"
  }
]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `key` | string | 피처 플래그 키 |
| `keepBranch` | `"enabled"` \| `"disabled"` | 제거 시 유지할 코드 경로 |
| `reason` | string | 사람이 읽기 좋은 stale 이유 (선택) |
| `lastModified` | string | ISO 타임스탬프 (선택) |

---

## 개발

```bash
# 의존성 설치
yarn install

# 빌드
yarn build

# 개발 모드 실행 (ts-node)
yarn dev fetch --help

# 린트
yarn lint

# 린트 자동 수정
yarn lint:fix

# 코드 포맷
yarn format

# 포맷 검사
yarn format:check
```

> **코드 스타일**: 이 프로젝트는 ESLint(TypeScript-ESLint)와 Prettier를 사용합니다.
> 커밋 전에 반드시 `yarn lint`와 `yarn format:check`를 통과해야 합니다.

---

## 동작 방식

1. **Fetch** — Gatrix 백엔드의 `GET /api/v1/server/features/definitions`를 호출하여 `archived` 상태, 롤아웃 퍼센트, 마지막 수정일 기준으로 stale 플래그를 분류합니다.
2. **Scan** — `fast-glob`으로 소스 파일을 열거하고, 각 줄에서 플래그 키의 네이밍 컨벤션 변형들을 검색합니다.
3. **Report** — 두 단계를 결합하여 플래그를 분류합니다:
   - **코드 참조 없음** → Gatrix 대시보드에서 바로 삭제 가능
   - **코드 참조 있음** → 코드 정리 후 삭제 필요

---

## 라이선스

MIT
