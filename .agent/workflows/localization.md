---
description: How to properly add localization keys
---
# Localization Key Addition Workflow

## Rules
1. **ko.json이 기준(master)**: 항상 ko.json을 먼저 수정하고, 동일한 키를 en.json, zh.json에도 추가
2. **중복 키 금지**: 로컬라이징 키 추가 전 반드시 기존 키가 있는지 확인
3. **동기화 필수**: 3개 파일에 동일한 키 구조가 유지되어야 함

## Adding New Keys

1. **ko.json에 먼저 추가**
   - 적절한 섹션에 키 추가
   - 중복 여부 확인: `Select-String -Path ko.json -Pattern '"keyName"'`

2. **en.json에 동일한 키 추가**
   - 영문 번역 추가
   - 동일한 JSON 경로에 추가

3. **zh.json에 동일한 키 추가**
   - 중문 번역 추가
   - 동일한 JSON 경로에 추가

## Validation

// turbo
```powershell
# 로컬라이징 파일 동기화 검증
node archived/compare-locales.js
```

모든 파일이 동일한 키 수를 가져야 함:
```
ko.json: N keys
en.json: N keys  
zh.json: N keys
```

## Sync Script (if needed)

// turbo
```powershell
# 불일치 발생시 ko.json 기준으로 동기화
node archived/sync-locales.js
```

> [!CAUTION]
> sync-locales.js 실행 시 누락된 키에 [EN]/[ZH] 접두사가 붙음. 반드시 적절히 번역해야 함.
