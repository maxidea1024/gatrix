# gatrix-flag-code-refs

**엔터프라이즈급 다국어 피처 플래그 정적 분석 및 거버넌스 플랫폼**

> 코드베이스에서 피처 플래그 참조를 스캔하고, 서버 정의 플래그와 대조 검증하며, 오용을 감지하고, 풍부한 리포트를 생성하는 강력한 CLI 도구입니다. 대규모 모노레포와 CI/CD 파이프라인에 최적화되어 있습니다.

---

## 목차

- [주요 기능](#주요-기능)
- [아키텍처](#아키텍처)
- [설치](#설치)
- [빠른 시작](#빠른-시작)
- [CLI 옵션](#cli-옵션)
- [설정 파일](#설정-파일)
- [언어 티어](#언어-티어)
- [감지 모드](#감지-모드)
- [신뢰도 점수](#신뢰도-점수)
- [검증 규칙](#검증-규칙)
- [리포터](#리포터)
- [CI/CD 통합](#cicd-통합)
- [Git 통합](#git-통합)
- [커스텀 확장자 매핑](#커스텀-확장자-매핑)
- [SDK 패키지 설정](#sdk-패키지-설정)
- [무시 파일](#무시-파일)
- [플래그 별칭](#플래그-별칭)
- [방어적 제한](#방어적-제한)
- [프로젝트 구조](#프로젝트-구조)
- [개발](#개발)
- [라이선스](#라이선스)

---

## 주요 기능

- **15개 언어 지원** -- TypeScript, JavaScript, Dart, Java, Kotlin, C#, Go, Swift, Rust, Python, Ruby, PHP, C, C++, Lua
- **3-티어 언어 분류** -- 언어별 분석 깊이에 따른 신뢰도 등급
- **신뢰도 점수** -- import 추적, 리시버 검증, 패턴 매칭 기반 0-100 점수
- **감지 모드** -- Strict, Balanced, Aggressive 모드로 오탐율 제어
- **검증 엔진** -- 미정의 플래그, 타입 불일치, 아카이브된 플래그, 오타 가능성 등 감지
- **리포트** -- Console, JSON, HTML, SARIF 출력 형식
- **딥 링크** -- 정확한 코드 위치 링크 자동 생성 (GitHub, GitLab, Bitbucket -- 셀프 호스팅 포함)
- **CI/CD 대응** -- 심각도, 티어, 신뢰도 기반 exit code 설정
- **증분 스캔** -- Git diff 기반 파일 탐색으로 빠른 CI 실행
- **파일 해시 캐싱** -- 변경되지 않은 파일 건너뛰기
- **플러그인 아키텍처** -- 확장 가능한 스캐너 레지스트리
- **주석 인식** -- 주석 내 플래그 참조 자동 무시
- **백엔드 업로드** -- Gatrix 백엔드 API로 스캔 결과 전송
- **React/Vue/Svelte 훅** -- `useFlag`, `useVariant`, `useBoolVariation` 등 기본 지원
- **정의 없이 실행** -- `--definitions` 없이도 모든 플래그 참조 탐색 가능
- **플래그 별칭** -- 네이밍 컨벤션 별칭 자동 생성 (camelCase, PascalCase, snake_case, UPPER_SNAKE_CASE) + 리터럴 별칭 매핑
- **방어적 제한** -- 파일 수, 참조 수, 줄 길이에 대한 설정 가능한 상한선
- **바이너리 파일 감지** -- null 바이트 휴리스틱으로 바이너리 파일 자동 건너뛰기
- **줄 잘라내기** -- 축소(minified)된/긴 줄 자동 잘라내기 (기본 500자)
- **짧은 플래그 키 필터** -- 최소 길이 미만 키 제외 (기본 3글자)로 오탐 감소
- **드라이 런 모드** -- `--dry-run`으로 백엔드 전송 없이 스캔만 실행
- **무시 파일** -- `.gatrixignore` / `.ignore` 지원

---

## 아키텍처

```
+---------------+    +----------------+    +-----------------+
|   CLI 진입점   |--->| 설정 로더       |--->| 스캐너 엔진      |
|  (commander)  |    | (병합/계층화)    |    | (오케스트레이터)   |
+---------------+    +----------------+    +--------+--------+
                                                    |
                   +--------------------------------+-----------------------------+
                   |                                |                             |
            +------v------+                  +------v------+               +------v------+
            |   스캐너     |                  |  검증        |               |   리포터     |
            |  레지스트리   |                  |   엔진       |               |   엔진      |
            |             |                  |             |               |             |
            | TS/JS  (T1) |                  | 미정의 플래그  |               | Console     |
            | Dart   (T1) |                  | 타입 불일치   |               | JSON        |
            | Java   (T1) |                  | 아카이브드    |               | HTML        |
            | Kotlin (T1) |                  | 오타 체크    |               | SARIF       |
            | C#     (T1) |                  | 동적 플래그   |               | Backend     |
            | Go     (T1) |                  +-------------+               +-------------+
            | Swift  (T1) |
            | Rust   (T1) |
            | Python (T2) |
            | Ruby   (T2) |
            | PHP    (T2) |
            | C      (T2) |
            | C++    (T2) |
            | Lua    (T3) |
            +-------------+
```

---

## 설치

```bash
# 클론 및 설치
git clone https://github.com/maxidea1024/gatrix.git
cd gatrix/tools
yarn install
yarn build

# 또는 글로벌 설치
npm install -g gatrix-flag-code-refs
```

### 요구사항

- **Node.js** >= 18.0.0
- **Git** (메타데이터, blame, 증분 스캔용)

---

## 빠른 시작

### 1. 플래그 정의 파일 생성 (선택사항)

```json
{
  "flags": {
    "new_shop_ui": { "type": "bool", "archived": false },
    "discount_rate": { "type": "number", "archived": false },
    "welcome_message": { "type": "string", "archived": false },
    "legacy_checkout": { "type": "bool", "archived": true }
  }
}
```

### 2. 스캔 실행

```bash
# 기본 스캔 (정의 없이 -- 모든 플래그 참조 탐색)
gatrix-flag-code-refs --root ./src --detection-mode aggressive

# 플래그 검증 포함 스캔
gatrix-flag-code-refs --definitions ./flags.json --root ./src

# CI 모드 + JSON 출력
gatrix-flag-code-refs --definitions ./flags.json --ci --report console,json --output report.json

# 드라이 런 (백엔드 전송 없이)
gatrix-flag-code-refs --definitions ./flags.json --root ./src --dry-run
```

### 3. 결과 확인

리포트에는 각 참조에 대한 상세 분석이 포함됩니다:
- 플래그 이름과 위치
- 신뢰도 점수와 감지 전략
- 검증 이슈와 수정 제안
- 코드 직접 링크

---

## CLI 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `[root]` | 스캔 루트 디렉토리 (위치 인수) | `.` |
| `--definitions <path>` | 플래그 정의 JSON 파일 경로 (선택) | -- |
| `--include <patterns...>` | 포함할 글로브 패턴 | `**/*` |
| `--exclude <patterns...>` | 제외할 글로브 패턴 | `node_modules, dist, ...` |
| `--extensions <exts>` | 쉼표 구분 파일 확장자 | 모든 지원 확장자 |
| `--languages <langs>` | 쉼표 구분 언어 필터 | 모든 언어 |
| `--since <ref>` | 증분 스캔용 Git ref | -- |
| `--include-context` | 주변 코드 컨텍스트 포함 | `false` |
| `--context-lines <n>` | 컨텍스트 줄 수 | `3` |
| `--include-blame` | git blame 정보 포함 | `false` |
| `--parallel <n>` | 병렬 워커 수 | `4` |
| `--cache` | 파일 해시 캐싱 활성화 | `false` |
| `--report <formats>` | 리포트 형식: `console,json,html,sarif` | `console` |
| `--output <path>` | 리포트 출력 파일 경로 | 자동 생성 |
| `--ci` | CI 모드 활성화 (exit codes) | `false` |
| `--fail-on-warning` | CI 모드에서 경고시 실패 | `false` |
| `--strict-dynamic` | 동적 플래그 사용을 에러로 처리 | `false` |
| `--detection-mode <mode>` | `strict`, `balanced`, `aggressive` | `balanced` |
| `--report-backend` | Gatrix 백엔드에 리포트 업로드 | `false` |
| `--backend-url <url>` | Gatrix 백엔드 URL | -- |
| `--api-key <key>` | Gatrix API 키 | -- |
| `--allow-global-lua-detection` | 글로벌 Lua 함수 호출 허용 | `false` |
| `--dry-run` | 백엔드 전송 없이 스캔만 실행 | `false` |
| `--min-flag-key-length <n>` | 최소 플래그 키 길이 (미만은 제외) | `3` |

---

## 설정 파일

프로젝트 루트에 `.gatrix-flag-code-refs.json` 파일을 생성합니다:

```json
{
  "definitions": "./flags.json",
  "include": ["src/**/*"],
  "exclude": ["**/test/**", "**/vendor/**"],
  "extensions": [".ts", ".tsx", ".lua"],
  "detectionMode": "balanced",
  "minFlagKeyLength": 3,
  "sdkPackages": ["@gatrix/sdk", "@mycompany/feature-flags"],
  "allowedReceivers": ["gatrix", "featureClient", "myClient"],
  "extensionMappings": {
    ".mm": "cpp",
    ".hxx": "cpp"
  },
  "delimiters": {
    "disableDefaults": false,
    "additional": []
  },
  "aliases": {
    "types": ["camelCase", "pascalCase", "snakeCase", "upperSnakeCase"],
    "literals": {
      "my-flag": ["MY_FLAG_CONST", "myFlagAlias"]
    }
  },
  "limits": {
    "maxFileCount": 10000,
    "maxReferenceCount": 25000,
    "maxLineCharCount": 500
  },
  "ci": true,
  "report": ["console", "json", "sarif"],
  "outputPath": "./reports/flag-scan.json",
  "languageOverrides": {
    "lua": {
      "sdkModules": ["gatrix", "my_feature_lib"],
      "allowGlobalCalls": false
    }
  }
}
```

**우선순위**: CLI 옵션 > 설정 파일 > 기본값

---

## 언어 티어

분석 깊이에 따라 3개 티어로 분류됩니다:

| 티어 | 언어 | Import 추적 | 타입 추적 | CI 동작 |
|------|------|------------|----------|---------|
| **Tier 1** | TypeScript, JavaScript, Dart, Java, Kotlin, C#, Go, Swift, Rust | O | O | 에러 -> exit(1) |
| **Tier 2** | Python, Ruby, PHP, C, C++ | 부분 | X | 에러 -> exit(1) |
| **Tier 3** | Lua | 부분 (require) | X | `--fail-on-warning` 시에만 exit(1) |

### Tier 1 -- 전체 분석
- ES 모듈 import 추적 (`import ... from`)
- CommonJS require 추적 (`const x = require(...)`)
- Go import 블록 파싱
- Rust `use` / `extern crate` 감지
- Swift `import` 감지
- 구조분해 import 해석
- const 별칭 해석 (예: `const FLAG = 'my_flag'`)
- 타입 안전 리시버 검증

### Tier 2 -- 중간 분석
- Python `import` / `from ... import` 감지
- Ruby `require` / `require_relative` 감지
- PHP `use` 네임스페이스 및 `require_once` 감지
- C/C++ `#include` 및 `using namespace` 감지

### Tier 3 -- 패턴 기반 (가드레일 포함)
- Lua `require()` 모듈 추적
- `.` 및 `:` 연산자를 통한 리시버 검증
- 글로벌 호출 필터링 (기본 비활성화)

---

## 감지 모드

| 모드 | 설명 | 오탐율 | 사용 시점 |
|------|------|-------|----------|
| `strict` | SDK import **AND** 유효한 리시버 필요 | 매우 낮음 | 프로덕션 CI 게이트 |
| `balanced` | SDK import **OR** 유효한 리시버 필요 | 낮음 | 기본값, 일반 개발 |
| `aggressive` | 함수명 패턴만으로 매칭 | 높음 | 탐색적 스캔, 미지의 SDK |

---

## 신뢰도 점수

각 감지된 플래그 참조는 신뢰도 점수 (0-100)를 받습니다:

| 요소 | 점수 | 설명 |
|------|------|------|
| SDK import 확인 | +50 | 알려진 SDK 패키지의 `import` / `require` / `#include` |
| 허용 리시버 목록 매칭 | +30 | 예: `gatrix.boolVariation()` |
| 리시버 존재 (미등록) | +10 | 리시버가 있지만 허용 목록에 없음 |
| 함수명 패턴 매칭 | +20 | 모든 매칭의 기본 점수 |
| 리터럴 문자열 인수 | +10 | 플래그 이름이 정적 문자열 |
| 동적 플래그 참조 | -20 | 변수 또는 계산된 플래그 이름 |
| 리시버 없음 (Tier 3) | -30 | Lua에서의 글로벌 함수 호출 |

**필터링**: Tier 3 참조 중 신뢰도 30 미만은 자동 제거됩니다.

---

## 검증 규칙

`--definitions`가 제공되면 다음 검증 규칙이 적용됩니다:

| 코드 | 심각도 | 설명 |
|------|--------|------|
| `UNDEFINED_FLAG` | Error | 정의에서 플래그를 찾을 수 없음 |
| `TYPE_MISMATCH` | Error | 접근자 타입 != 정의된 플래그 타입 |
| `ARCHIVED_FLAG_USAGE` | Warning | 아카이브/비활성화된 플래그 사용 |
| `DYNAMIC_FLAG_USAGE` | Warning | 비정적 플래그 이름, 검증 불가 |
| `POSSIBLE_TYPO` | Warning | 유사한 플래그 이름 발견 (레벤슈타인 거리 <= 2) |
| `STRICT_ACCESS_ON_WRONG_TYPE` | Error | 잘못된 타입의 `*OrThrow` 접근자 |
| `VARIANT_ACCESS_ON_TYPED_FLAG` | Warning | 타입이 지정된 플래그에 제네릭 접근자 사용 |
| `WATCH_ON_NON_EXISTENT_FLAG` | Error | 미정의 플래그에 대한 옵저버 |
| `UNUSED_FLAG` | Info | 정의되었지만 참조가 없는 플래그 |

`--definitions` 없이도 모든 플래그 참조를 탐색하지만 정의 기반 검증은 건너뜁니다.

---

## 리포터

### Console (`--report console`)
컬러 코드가 적용된 터미널 출력:
- 심각도별 색상 구분
- 신뢰도 분포 차트
- 티어 분포 분석
- 코드 딥 링크

### JSON (`--report json`)
전체 메타데이터, 사용처, 요약이 포함된 구조화된 JSON 리포트.

### HTML (`--report html`)
다크 테마 HTML 리포트:
- 신뢰도 바
- 배지 기반 심각도 표시
- 필터링 가능한 이슈 목록
- 레포지토리 딥 링크

### SARIF (`--report sarif`)
SARIF 2.1.0 형식으로 다음과 연동:
- GitHub Code Scanning
- Azure DevOps
- 기타 SARIF 호환 도구

---

## CI/CD 통합

### GitHub Actions

```yaml
- name: 피처 플래그 참조 스캔
  run: |
    npx gatrix-flag-code-refs \
      --definitions ./flags.json \
      --ci \
      --detection-mode balanced \
      --report console,sarif \
      --output flag-scan.sarif

- name: SARIF 업로드
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: flag-scan.sarif
```

### GitLab CI

```yaml
flag-scan:
  script:
    - npx gatrix-flag-code-refs
        --definitions ./flags.json
        --ci
        --report console,json
        --output flag-report.json
  artifacts:
    reports:
      codequality: flag-report.json
```

### 증분 스캔

```bash
# main 브랜치 이후 변경된 파일만 스캔
gatrix-flag-code-refs --definitions ./flags.json --since origin/main --ci
```

### Exit Code

| 코드 | 의미 |
|------|------|
| `0` | 이슈 없음 (또는 CI 모드가 아님) |
| `1` | 검증 에러 감지됨 |
| `2` | 치명적 에러 (설정, 파싱 등) |

---

## Git 통합

Git 작업은 **simple-git** SDK를 사용합니다 (raw shell 명령이 아님):

- **메타데이터**: 레포지토리 이름, 브랜치, 커밋 해시, 리모트 URL, git 루트
- **증분 스캔**: `--since <ref>`로 diff 기반 파일 탐색
- **Blame**: `git blame --porcelain`을 통한 줄 단위 저자 정보
- **딥 링크**: 리모트 URL에서 자동 생성, 지원:
  - GitHub.com / GitHub Enterprise
  - GitLab.com / 셀프 호스팅 GitLab CE/EE
  - Bitbucket Cloud / Bitbucket Server
  - Gitea 및 기타 셀프 호스팅 플랫폼 (GitLab URL 패턴으로 폴백)
  - 커스텀 포트 (예: `http://host:30080/group/repo`)
  - HTTP/HTTPS 스킴 보존

---

## 커스텀 확장자 매핑

일반적이지 않은 파일 확장자를 지원 언어로 매핑:

```json
{
  "extensionMappings": {
    ".mm": "cpp",
    ".hxx": "cpp",
    ".mjs": "javascript",
    ".cts": "typescript",
    ".pyw": "python"
  }
}
```

기본 확장자 매핑:

| 언어 | 확장자 |
|------|--------|
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx` |
| Dart | `.dart` |
| Lua | `.lua` |
| C | `.c`, `.h` |
| C++ | `.cpp`, `.cxx`, `.cc`, `.hpp`, `.hh` |
| C# | `.cs` |
| Java | `.java` |
| Kotlin | `.kt`, `.kts` |
| Go | `.go` |
| Swift | `.swift` |
| Rust | `.rs` |
| Python | `.py` |
| Ruby | `.rb` |
| PHP | `.php` |

---

## SDK 패키지 설정

import 문에서 찾을 SDK 패키지를 지정합니다:

```json
{
  "sdkPackages": [
    "@gatrix/sdk",
    "@gatrix/client",
    "@gatrix/react",
    "@gatrix/vue",
    "@gatrix/svelte",
    "@mycompany/feature-flags"
  ],
  "allowedReceivers": [
    "gatrix",
    "flagClient",
    "featureClient",
    "features",
    "client",
    "sdk"
  ]
}
```

### 기본 함수 패턴

다음 함수/메서드 패턴을 기본으로 인식합니다:

**Core Access**: `isEnabled`, `getVariant`, `getFlag`, `watchFlag`, `watchFlagWithInitialState`

**Typed Variation**: `variation`, `boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation`

**Variation Details**: `boolVariationDetails`, `stringVariationDetails`, `numberVariationDetails`, `jsonVariationDetails`

**Strict**: `boolVariationOrThrow`, `stringVariationOrThrow`, `numberVariationOrThrow`, `jsonVariationOrThrow`

**React/Vue Hooks**: `useFlag`, `useFlagProxy`, `useVariant`, `useBoolVariation`, `useStringVariation`, `useNumberVariation`, `useJsonVariation`

**Svelte Stores**: `flag`, `flagState`, `variant`

---

## 무시 파일

프로젝트 루트에 `.gatrixignore` 또는 `.ignore` 파일을 생성합니다:

```
# 생성된 코드 제외
generated/
*.generated.ts

# 벤더 의존성 제외
vendor/
third_party/

# 축소된 파일 제외
*.min.js
*.min.css
```

패턴은 .gitignore 문법을 따릅니다.

---

## 플래그 별칭

플래그 키에 대한 네이밍 컨벤션 별칭이 자동 생성됩니다:

| 플래그 키 | camelCase | PascalCase | snake_case | UPPER_SNAKE_CASE |
|----------|-----------|------------|------------|------------------|
| `my-flag-name` | `myFlagName` | `MyFlagName` | `my_flag_name` | `MY_FLAG_NAME` |
| `new_shop_ui` | `newShopUi` | `NewShopUi` | `new_shop_ui` | `NEW_SHOP_UI` |

개발자가 `MY_FLAG_NAME`을 코드에서 사용하지만 플래그가 `my-flag-name`으로 정의된 경우에도 참조가 올바르게 매칭됩니다.

`.gatrix-flag-code-refs.json`에서 설정:

```json
{
  "aliases": {
    "types": ["camelCase", "pascalCase", "snakeCase", "upperSnakeCase", "kebabCase", "dotCase"],
    "literals": {
      "my-flag": ["FEATURE_X", "flagX"]
    }
  }
}
```

---

## 방어적 제한

대규모 레포지토리에서 과도한 리소스 사용을 방지하기 위해 방어적 제한이 적용됩니다:

| 제한 | 기본값 | 설명 |
|------|--------|------|
| `maxFileCount` | 10000 | 스캔할 최대 파일 수 |
| `maxReferenceCount` | 25000 | 총 코드 참조 최대 수 |
| `maxLineCharCount` | 500 | 줄당 최대 문자 수 (초과시 잘라냄) |

`.gatrix-flag-code-refs.json`에서 설정:

```json
{
  "limits": {
    "maxFileCount": 20000,
    "maxReferenceCount": 50000,
    "maxLineCharCount": 1000
  }
}
```

---

## 프로젝트 구조

```
src/
  cli.ts                      # CLI 진입점 (commander)
  types.ts                    # 핵심 TypeScript 인터페이스
  utils.ts                    # 공유 유틸리티 함수
  config/
    defaults.ts               # 기본 설정값
    loader.ts                 # 설정 파일 + CLI 병합 로직
    index.ts
  scanners/
    regexScanner.ts           # 신뢰도 점수 기반 스캐너
    typescriptScanner.ts      # TS/JS Tier 1 스캐너
    languageScanners.ts       # 기타 언어 스캐너
    registry.ts               # 플러그인 기반 스캐너 레지스트리
    index.ts
  validators/
    validatorEngine.ts        # 검증 규칙 엔진
    index.ts
  git/
    diff.ts                   # Git diff (simple-git)
    blame.ts                  # Git blame (simple-git)
    metadata.ts               # 레포지토리 메타데이터 (simple-git)
    linkGenerator.ts          # 딥 링크 생성
    index.ts
  reporters/
    consoleReporter.ts        # 터미널 출력
    jsonReporter.ts           # JSON 리포트
    htmlReporter.ts           # HTML 리포트
    sarifReporter.ts          # SARIF 2.1.0 리포트
    index.ts
  core/
    scannerEngine.ts          # 메인 오케스트레이터
    reporterEngine.ts         # 리포트 라우팅 + CI exit codes
    index.ts
  cache/
    scanCache.ts              # 파일 해시 캐싱
    index.ts
  backend/
    client.ts                 # 백엔드 API 업로드
    index.ts
```

---

## 개발

```bash
# 의존성 설치
yarn install

# 빌드
yarn build

# 코드 포맷 (Prettier, 작은따옴표, 2칸 들여쓰기)
yarn format

# 포맷 검사
yarn format:check

# 로컬 실행
node dist/cli.js --root ./src --detection-mode aggressive
```

---

## 라이선스

MIT
