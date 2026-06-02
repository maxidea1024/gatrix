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

## Do not fallback

```tsx
const localizedText = t('localization.key', 'some fallback text');   <-- do not
const localizedText = t('localization.key');
```
