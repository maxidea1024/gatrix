---
description: How to properly add localization keys
---

# Localization Key Addition Workflow

## 파일 위치 및 형식

- 경로: `packages/frontend/src/locales/`
- 파일: `ko.ini`, `en.ini`, `zh.ini`
- 형식: **INI** (플랫 key=value), **JSON이 아님**
- i18next 설정: `keySeparator: false`, `nsSeparator: false` → 키에 `.`이 포함되어도 분리하지 않음
- 로딩: `I18nContext.tsx`에서 `import koTranslations from '@/locales/ko.ini'`

## 키 형식 예시

```ini
;=== 섹션 주석 ===
argus.settings.issueTrackers=이슈 트래커
argus.feedback.createIssue=이슈 생성
common.add=추가
```

- 키는 `모듈.섹션.이름` 형태의 플랫 문자열
- 주석은 `;` 로 시작
- 섹션 구분은 `;=== 섹션명 ===` 주석으로 표기

## Rules

1. **ko.ini가 기준(master)**: 항상 ko.ini를 먼저 수정하고, 동일한 키를 en.ini, zh.ini에도 추가
2. **중복 키 금지**: 키 추가 전 반드시 기존 키 존재 여부 확인
3. **동기화 필수**: 3개 파일에 동일한 키가 유지되어야 함

## Adding New Keys

1. **ko.ini에 먼저 추가**
   - 적절한 섹션(주석 그룹)에 키 추가
   - 중복 여부 확인:
     ```powershell
     Select-String -Path "packages/frontend/src/locales/ko.ini" -Pattern "키이름"
     ```

2. **en.ini에 동일한 키 추가**
   - 영문 번역 추가
   - ko.ini와 동일한 위치(라인 순서)에 추가

3. **zh.ini에 동일한 키 추가**
   - 중문 번역 추가
   - ko.ini와 동일한 위치에 추가

## Validation

```powershell
# 로컬라이징 파일 동기화 검증
node archived/compare-locales.js
```

모든 파일이 동일한 키 수를 가져야 함:

```
ko.ini: N keys
en.ini: N keys
zh.ini: N keys
```

## Sync Script (if needed)

```powershell
# 불일치 발생시 ko.ini 기준으로 동기화
node archived/sync-locales.js
```

> [!CAUTION]
> sync-locales.js 실행 시 누락된 키에 [EN]/[ZH] 접두사가 붙음. 반드시 적절히 번역해야 함.

## 코드에서 사용

```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();

// fallback 포함
t('argus.settings.issueTrackers', 'Issue Trackers')

// 보간(interpolation)
t('argus.feedback.issueCreatedExternal', 'Issue created: {{key}}', { key: 'PROJ-123' })
```

## fallback 은 영어로만

```
const localizedText = _t('key', 'hello');
```

---

## ⚠️ 인코딩 안전 규칙 (CRITICAL — 반드시 준수)

### 문제

`.ini` 파일은 **UTF-8 without BOM** 인코딩이다. 터미널 명령어(`Add-Content`, `echo >>`, `Out-File` 등)로 한글/중문을 직접 쓰면 **인코딩이 깨진다**.

PowerShell의 `Add-Content`는 기본적으로 **시스템 코드페이지(CP949/EUC-KR)**로 쓰기 때문에 UTF-8 파일에 한글이 깨진다. `-Encoding UTF8` 옵션을 붙여도 **UTF-8 BOM**이 추가되어 기존 파일과 충돌할 수 있다.

### 규칙

1. **절대 `Add-Content`, `Out-File`, `echo >>`, `Set-Content`로 ini 파일에 비ASCII 문자를 쓰지 마라**
2. **반드시 `write_to_file` 또는 `replace_file_content` 도구(에디터 API)를 사용해서 파일을 수정하라**
3. 터미널 명령어는 **검증(grep, diff, 키 개수 확인)에만** 사용하라

### ❌ 금지 패턴

```powershell
# 금지: PowerShell로 한글/중문 직접 쓰기
Add-Content -Path "ko.ini" -Value "dsl.field.level=레벨"
Add-Content -Path "zh.ini" -Value "dsl.field.level=级别"

# 금지: -Encoding UTF8 써도 BOM 문제 발생
Add-Content -Path "ko.ini" -Value "key=값" -Encoding UTF8

# 금지: heredoc으로 한글 쓰기
Add-Content -Path "ko.ini" -Value @"
dsl.field.level=레벨
"@
```

### ✅ 올바른 패턴

```
# 에디터 API(write_to_file, replace_file_content)로 파일 수정
# 이 도구들은 항상 UTF-8 without BOM으로 저장함

# 터미널은 검증에만 사용:
Select-String -Path "ko.ini" -Pattern "dsl.field"
node archived/compare-locales.js
```

### 인코딩 깨짐 확인 방법

```powershell
# 깨진 문자 탐지 (replacement character U+FFFD 또는 ? 패턴)
[System.IO.File]::ReadAllText("packages/frontend/src/locales/ko.ini") | Select-String -Pattern "[\uFFFD]|[?]{2,}"
```

### 깨진 파일 복구

깨졌으면 해당 섹션을 `write_to_file` (Overwrite=false) 또는 `replace_file_content`로 다시 작성한다. 절대 터미널로 복구하지 마라.
