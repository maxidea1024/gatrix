# 프로덕션 배포 체크리스트

## ✅ 완료된 작업

### 1. localhost 하드코딩 제거 및 수정

- [x] `docker-compose.yml` - CORS_ORIGIN 수정 (localhost → frontend:80)
- [x] `docker-compose.yml` - VITE_API_URL 수정 (localhost → /api/v1)
- [x] `docker-compose.yml` - 모든 healthcheck localhost → 127.0.0.1로 변경
- [x] `packages/backend/src/config/index.ts` - 기본값 수정 (환경에 따라 동적 설정)
- [x] `packages/chat-server/src/config/index.ts` - CORS 기본값 수정
- [x] `packages/frontend/docker-entrypoint.sh` - API_URL 기본값 수정 (→ /api/v1)
- [x] `packages/backend/src/index.ts` - 로그 메시지 수정 (localhost → 127.0.0.1)

### 2. Docker 빌드 검증

- [x] 모든 서비스 Docker 빌드 성공
  - ✔ gatrix-backend
  - ✔ gatrix-frontend
  - ✔ gatrix-chat-server
  - ✔ gatrix-event-lens
  - ✔ gatrix-event-lens-worker

### 3. 프로덕션 환경 설정 파일 생성

- [x] `.env.production.example` 생성 - 프로덕션 환경 변수 템플릿

---

## 📋 배포 전 필수 체크사항

### 환경 변수 설정

```bash
# 1. 프로덕션 환경 파일 생성
cp .env.production.example .env

# 2. 다음 항목들을 반드시 수정하세요:
```

**필수 수정 항목:**

- `DB_PASSWORD` - 강력한 비밀번호로 변경
- `REDIS_PASSWORD` - 필요시 설정
- `JWT_SECRET` - 최소 32자 이상의 무작위 문자열
- `JWT_REFRESH_SECRET` - 최소 32자 이상의 무작위 문자열
- `SESSION_SECRET` - 최소 32자 이상의 무작위 문자열
- `CORS_ORIGIN` - 실제 도메인으로 변경 (예: https://yourdomain.com)
- `FRONTEND_URL` - 실제 도메인으로 변경
- `VITE_API_URL` - 실제 도메인으로 변경 (예: https://yourdomain.com/api/v1)
- `ADMIN_EMAIL` - 실제 관리자 이메일
- `ADMIN_PASSWORD` - 강력한 비밀번호로 변경
- `GATRIX_API_SECRET` - 강력한 공유 비밀번호로 변경

**OAuth 설정 (필요시):**

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

---

## 🚀 배포 단계

### 1. 데이터베이스 마이그레이션

```bash
# Docker 컨테이너 시작
docker-compose up -d mysql redis

# 마이그레이션 실행 (필요시)
docker-compose exec backend node dist/scripts/setup-database.js
```

### 2. 전체 스택 시작

```bash
# 모든 서비스 시작
docker-compose up -d

# 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

### 3. 헬스체크 확인

```bash
# Backend 헬스체크
curl http://localhost:5000/health

# Frontend 접근 확인
curl http://localhost:80/health

# Chat Server 헬스체크
curl http://localhost:3001/health

# Event Lens 헬스체크
curl http://localhost:3002/health
```

### 4. Frontend 접근 테스트

```bash
# 브라우저에서 접근
http://localhost/

# 또는 실제 도메인
https://yourdomain.com/
```

---

## 🔍 주요 변경사항 요약

### Docker Compose 설정

- **CORS_ORIGIN**: `http://localhost:3000` → `http://frontend:80` (프로덕션)
- **VITE_API_URL**: `http://localhost:5000/api/v1` → `/api/v1` (상대 경로)
- **Healthcheck**: `localhost` → `127.0.0.1` (컨테이너 내부 접근)

### Backend 설정

- 환경 변수에 따라 동적으로 기본값 설정
- 프로덕션 환경에서는 `http://frontend:80` 사용
- 개발 환경에서는 `http://localhost:3000` 사용

### Frontend 설정

- API URL을 상대 경로(`/api/v1`)로 설정
- Nginx가 `/api` 요청을 backend로 프록시

---

## ⚠️ 주의사항

1. **환경 변수 보안**
   - `.env` 파일을 버전 관리에 포함하지 마세요
   - 프로덕션 서버에서만 실제 비밀번호 설정

2. **데이터베이스**
   - 마이그레이션 전에 백업 수행
   - 초기 관리자 계정 생성 확인

3. **SSL/TLS**
   - 프로덕션에서는 HTTPS 필수
   - `docker/nginx/ssl/` 디렉토리에 인증서 배치

4. **로그 모니터링**
   - 배포 후 로그 확인
   - 에러 발생 시 즉시 대응

---

## 📝 배포 후 확인사항

- [ ] Frontend 페이지 로드 확인
- [ ] API 요청 정상 작동 확인
- [ ] 데이터베이스 연결 확인
- [ ] Redis 캐시 작동 확인
- [ ] Chat Server 연결 확인
- [ ] Event Lens 데이터 수집 확인
- [ ] 로그 에러 없음 확인
- [ ] 헬스체크 모두 정상 확인
