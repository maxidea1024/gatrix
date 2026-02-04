# 기획데이터 빌드 및 배포 가이드

## 📋 개요

기획데이터(Planning Data)는 게임의 이벤트, 버프, NPC 스포너 등의 정보를 담고 있습니다.
CMS 폴더의 원본 데이터를 처리하여 언어별 JSON 파일로 변환하고, 이를 서버에 업로드하여 적용합니다.

## 🚀 빌드 프로세스

### 1단계: 기획데이터 빌드

#### CLI 명령어 (권장)

```bash
# 프로젝트 루트에서 실행
yarn workspace @gatrix/backend planning-data:convert
```

#### 또는 직접 실행

```bash
cd packages/backend
node src/contents/cms/adminToolDataBuilder.js --cms-dir cms --output-dir data/planning
```

### 2단계: 생성된 파일 확인

빌드 완료 후 `packages/backend/data/planning/` 디렉토리에 다음 파일들이 생성됩니다:

#### 보상 데이터 (3개)

- `reward-lookup-kr.json` - 한국어 보상 아이템
- `reward-lookup-en.json` - 영어 보상 아이템
- `reward-lookup-zh.json` - 중국어 보상 아이템
- `reward-type-list.json` - 보상 타입 목록

#### UI 목록 데이터 (3개)

- `ui-list-data-kr.json` - 한국어 (국가, 마을, 촌락 등)
- `ui-list-data-en.json` - 영어
- `ui-list-data-zh.json` - 중국어

#### 이벤트 데이터 (15개)

- `hottimebuff-lookup-kr/en/zh.json` - 핫타임 버프
- `eventpage-lookup-kr/en/zh.json` - 이벤트 페이지
- `liveevent-lookup-kr/en/zh.json` - 라이브 이벤트
- `materecruiting-lookup-kr/en/zh.json` - 메이트 모집
- `oceannpcarea-lookup-kr/en/zh.json` - 오션 NPC 스포너

**총 23개 파일 생성**

## 📤 파일 업로드 및 적용

### 1단계: 생성된 파일 확인

```bash
ls -lh packages/backend/data/planning/*.json
```

### 2단계: 파일 업로드

생성된 파일들을 서버의 다음 경로에 업로드합니다:

```
/api/v1/admin/planning-data/upload
```

#### 업로드 방법 (Admin Tool UI)

1. **Admin Tool 접속**
   - http://localhost:3000 (개발 환경)
   - 또는 운영 서버 주소

2. **Planning Data 페이지 이동**
   - 좌측 메뉴에서 "Planning Data" 선택

3. **파일 업로드**
   - "Upload" 버튼 클릭
   - `packages/backend/data/planning/` 폴더의 모든 JSON 파일 선택
   - 업로드 시작

#### 업로드 API (curl)

```bash
# 단일 파일 업로드
curl -X POST http://localhost:3000/api/v1/admin/planning-data/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@packages/backend/data/planning/hottimebuff-lookup-kr.json"

# 여러 파일 한번에 업로드
for file in packages/backend/data/planning/*.json; do
  curl -X POST http://localhost:3000/api/v1/admin/planning-data/upload \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -F "file=@$file"
done
```

### 3단계: 업로드 확인

#### 브라우저에서 확인

1. Planning Data 페이지 새로고침
2. 각 탭(HotTimeBuff, EventPage 등)에서 데이터 확인
3. 언어 변경하여 로컬라이징 확인

#### API로 확인

```bash
# 핫타임 버프 데이터 조회
curl http://localhost:3000/api/v1/admin/planning-data/hottimebuff?lang=kr

# 이벤트 페이지 데이터 조회
curl http://localhost:3000/api/v1/admin/planning-data/eventpage?lang=en
```

## 🔄 전체 워크플로우

```
1. CMS 데이터 수정
   ↓
2. yarn workspace @gatrix/backend planning-data:convert
   ↓
3. packages/backend/data/planning/ 에서 파일 확인
   ↓
4. Admin Tool에서 파일 업로드
   ↓
5. 브라우저에서 데이터 확인
   ↓
6. 완료!
```

## 📊 생성 데이터 통계

| 파일                          | 크기   | 설명                   |
| ----------------------------- | ------ | ---------------------- |
| reward-lookup-\*.json         | ~1.5MB | 보상 아이템 (언어별)   |
| reward-type-list.json         | ~7KB   | 보상 타입 목록         |
| ui-list-data-\*.json          | ~5.3MB | UI 목록 (언어별)       |
| hottimebuff-lookup-\*.json    | ~100KB | 핫타임 버프 (언어별)   |
| eventpage-lookup-\*.json      | ~830KB | 이벤트 페이지 (언어별) |
| liveevent-lookup-\*.json      | ~60KB  | 라이브 이벤트 (언어별) |
| materecruiting-lookup-\*.json | ~2.1MB | 메이트 모집 (언어별)   |
| oceannpcarea-lookup-\*.json   | ~1.7MB | 오션 NPC (언어별)      |

## ⚠️ 주의사항

### loctab.json은 생성되지 않습니다

- `loctab.json`은 빌드 시에만 내부적으로 사용됩니다
- 최종 생성 파일에는 포함되지 않습니다
- 로컬라이징은 각 언어별 파일에 이미 적용되어 있습니다

### 옵션 무시

- 빌드 시 모든 데이터가 항상 생성됩니다
- `--rewards`, `--events` 등의 옵션은 무시됩니다
- 전체 데이터를 한 번에 생성하도록 설계되었습니다

## ❓ 자주 묻는 질문

### Q: 빌드 후 파일이 없으면?

A: 다음을 확인하세요:

- CMS 폴더 경로가 올바른지 확인
- 빌드 로그에서 에러 메시지 확인
- `packages/backend/data/planning/` 디렉토리 존재 확인

### Q: 업로드 후 데이터가 안 보이면?

A: 다음을 시도하세요:

- 브라우저 캐시 삭제 (Ctrl+Shift+R)
- 페이지 새로고침
- 개발자 도구 Network 탭에서 API 응답 확인

### Q: 특정 언어만 업로드하려면?

A: 해당 언어의 파일만 선택하여 업로드하면 됩니다.
예: `hottimebuff-lookup-kr.json`만 업로드

### Q: 빌드 시간이 오래 걸리면?

A: 일반적으로 30초 이내입니다. 더 오래 걸린다면:

- CMS 파일 크기 확인
- 시스템 리소스 확인

## 📚 관련 문서

- **상세 빌더 가이드**: `ADMIN_TOOL_DATA_BUILDER.md`
- **빠른 시작**: `QUICK_START.md`
- **보상 타입 참조**: `REWARD_TYPE_REFERENCE.md`
