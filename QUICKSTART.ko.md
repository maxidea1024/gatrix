# Gatrix Lite 배포 가이드

Docker Compose를 사용한 간편 배포 패키지입니다.

---

## 목차

1. [최초 설정](#최초-설정)
2. [새 버전으로 업데이트](#새-버전으로-업데이트)
3. [전체 초기화](#전체-초기화)
4. [일반 작업](#일반-작업)
5. [문제 해결](#문제-해결)

---

## 최초 설정

### 1단계: 환경 파일 생성

환경 설정 예시 파일을 복사합니다:

```bash
cp .env.example .env
```

또는 설정 스크립트를 사용합니다:

```bash
# Linux/macOS
./setup-env.sh

# Windows
./setup-env.ps1
```

### 2단계: 환경 변수 설정

`.env` 파일을 편집하여 필수 값을 설정합니다:

```bash
# 선호하는 편집기로 열기
vim .env
# 또는
nano .env
```

**필수 설정:**
- `JWT_SECRET` - JWT 서명용 비밀 키 (랜덤 문자열 사용)
- `JWT_REFRESH_SECRET` - 리프레시 토큰용 비밀 키
- `DB_PASSWORD` - 데이터베이스 비밀번호 (로컬 DB 사용 시)

### 3단계: 서비스 시작

```bash
# Linux/macOS
./update-lite.sh -t v0.0.1

# Windows
./update-lite.ps1 -t v0.0.1
```

### 4단계: 서비스 확인

```bash
docker compose -f docker-compose.lite.yml ps
```

모든 서비스가 "running" 상태여야 합니다.

---

## 새 버전으로 업데이트

새 버전이 출시되면:

```bash
# Linux/macOS
./update-lite.sh -t v0.0.2

# Windows
./update-lite.ps1 -t v0.0.2
```

이 명령은:
1. 실행 중인 서비스 중지
2. 지정된 태그의 새 이미지 풀
3. 새 버전으로 서비스 시작

---

## 전체 초기화

> ⚠️ **위험: 데이터 손실 경고** ⚠️
>
> `-v` 플래그는 다음을 포함한 **모든 데이터를 영구 삭제**합니다:
> - 데이터베이스 내용 (사용자, 설정, 모든 레코드)
> - 업로드된 파일 및 미디어
> - 캐시 및 세션 데이터
> - 기타 모든 저장된 데이터
>
> **이 작업은 되돌릴 수 없습니다!** 진행하기 전에 백업이 있는지 확인하세요.

완전히 새로 시작해야 할 때만 사용합니다:

```bash
# Linux/macOS
./update-lite.sh -t v0.0.1 -v

# Windows
./update-lite.ps1 -t v0.0.1 -v
```

**사용해야 할 때:**
- 초기 개발 환경 설정
- 새로운 데이터가 필요한 주요 스키마 변경 후
- 개발팀의 명시적 지시가 있을 때

**사용하지 말아야 할 때:**
- 일반 버전 업데이트 (`-v` 플래그를 생략하세요)
- 실제 데이터가 있는 운영 환경
- 확실하지 않을 때

---

## 일반 작업

### 서비스 상태 확인

```bash
docker compose -f docker-compose.lite.yml ps
```

### 로그 보기

```bash
# 모든 서비스
docker compose -f docker-compose.lite.yml logs -f

# 특정 서비스 (예: backend)
docker compose -f docker-compose.lite.yml logs -f backend

# 마지막 100줄
docker compose -f docker-compose.lite.yml logs --tail 100 backend
```

### 서비스 중지

```bash
docker compose -f docker-compose.lite.yml down
```

### 단일 서비스 재시작

```bash
docker compose -f docker-compose.lite.yml restart backend
```

### 서비스 셸 접속

```bash
docker compose -f docker-compose.lite.yml exec backend sh
```

---

## 문제 해결

### 문제: 스크립트 실행 시 "Permission denied"

**원인:** 스크립트에 실행 권한이 없습니다.

**해결:**
```bash
chmod +x update-lite.sh setup-env.sh
```

---

### 문제: "Cannot connect to Docker daemon"

**원인:** Docker가 실행 중이 아니거나 sudo가 필요합니다.

**해결:**
```bash
# Docker 상태 확인
sudo systemctl status docker

# Docker 시작
sudo systemctl start docker

# 또는 sudo로 실행
sudo ./update-lite.sh -t v0.0.1
```

---

### 문제: 서비스가 시작되지 않음 (포트가 이미 사용 중)

**원인:** 다른 애플리케이션이 같은 포트를 사용 중입니다.

**해결:**
1. 사용 중인 포트 확인:
   ```bash
   docker compose -f docker-compose.lite.yml ps
   ```

2. 충돌하는 애플리케이션을 중지하거나 `.env`에서 포트 변경:
   ```env
   FRONTEND_PORT=3001  # 기본값 3000에서 변경
   ```

---

### 문제: 데이터베이스 연결 실패

**원인:** 데이터베이스 컨테이너가 준비되지 않았거나 자격 증명이 잘못되었습니다.

**해결:**
1. 데이터베이스가 실행 중인지 확인:
   ```bash
   docker compose -f docker-compose.lite.yml ps mysql
   ```

2. 데이터베이스 로그 확인:
   ```bash
   docker compose -f docker-compose.lite.yml logs mysql
   ```

3. `.env`에 올바른 데이터베이스 설정이 있는지 확인하세요.

---

### 문제: 풀 시 "Image not found"

**원인:** 잘못된 태그이거나 레지스트리에 로그인하지 않았습니다.

**해결:**
1. 레지스트리에 태그가 있는지 확인
2. 필요한 경우 레지스트리에 로그인:
   ```bash
   docker login uwocn.tencentcloudcr.com
   ```

---

### 문제: 디스크 공간 부족

**원인:** Docker 이미지/볼륨이 디스크 공간을 차지하고 있습니다.

**해결:**
```bash
# 사용하지 않는 Docker 리소스 제거
docker system prune -a

# 디스크 사용량 확인
docker system df
```

---

### 문제: 서비스는 시작되지만 애플리케이션이 작동하지 않음

**원인:** 환경 변수가 누락되었거나 잘못되었습니다.

**해결:**
1. 오류 메시지가 있는지 로그 확인:
   ```bash
   docker compose -f docker-compose.lite.yml logs backend
   ```

2. `.env`에 모든 필수 환경 변수가 설정되어 있는지 확인

3. 수정 후 서비스 재시작:
   ```bash
   docker compose -f docker-compose.lite.yml down
   docker compose -f docker-compose.lite.yml up -d
   ```

---

## 파일 구조

```
gatrix/
├── .env                      # 환경 설정 (생성 필요)
├── .env.example              # 환경 설정 예시
├── docker-compose.lite.yml   # Docker Compose 설정
├── update-lite.sh            # 업데이트 스크립트 (Linux/macOS)
├── update-lite.ps1           # 업데이트 스크립트 (Windows)
├── setup-env.sh              # 설정 스크립트 (Linux/macOS)
├── setup-env.ps1             # 설정 스크립트 (Windows)
├── QUICKSTART.md             # 이 파일 (영문)
├── QUICKSTART.ko.md          # 이 파일 (한글)
└── deploy/                   # 운영 배포 스크립트
```

---

## `deploy/` 폴더 정보

`deploy/` 폴더에는 **Docker Swarm**을 사용한 **대규모 운영 배포용 고급 스크립트**가 포함되어 있습니다.

> 💡 **참고:** 간단한 단일 서버 배포의 경우 `update-lite.sh`와 `docker-compose.lite.yml`만 필요합니다. `deploy/` 폴더는 운영 인프라를 관리하는 DevOps 팀을 위한 것입니다.

### Docker Swarm 스크립트 사용 시기

| 시나리오 | 사용 도구 |
|----------|-----------|
| 개발 / 테스트 | `update-lite.sh` (이 가이드) |
| 단일 운영 서버 | `update-lite.sh` (이 가이드) |
| 다중 노드 클러스터 | `deploy/` 스크립트 (Docker Swarm) |
| 고가용성 필요 | `deploy/` 스크립트 (Docker Swarm) |
| 자동 스케일링 필요 | `deploy/` 스크립트 (Docker Swarm) |

### Docker Swarm 기능 (deploy/ 폴더)

- **롤링 업데이트** - 무중단 배포
- **자동 롤백** - 배포 실패 시 자동 복구
- **서비스 스케일링** - 여러 노드에 걸쳐 확장
- **로드 밸런싱** - 기본 제공
- **시크릿 관리** - 민감한 데이터 보안
- **헬스 체크** - 자동 복구

### deploy/ 스크립트

| 스크립트 | 용도 |
|----------|------|
| `build-and-push.sh/.ps1` | Docker 이미지 빌드 및 레지스트리 푸시 |
| `deploy.sh/.ps1` | Docker Swarm에 스택 배포 |
| `update.sh/.ps1` | 롤링 업데이트 |
| `rollback.sh/.ps1` | 이전 버전으로 롤백 |
| `scale.sh/.ps1` | 서비스 레플리카 조정 |
| `status.sh/.ps1` | 스택 및 서비스 상태 확인 |

자세한 Docker Swarm 배포 지침은 `deploy/README.ko.md`를 참조하세요.

---

## 도움 받기

여기서 다루지 않은 문제가 발생하면:

1. 서비스 로그 확인: `docker compose -f docker-compose.lite.yml logs`
2. `.env` 설정 확인
3. `-v` 플래그로 초기화 시도 (주의: 데이터 삭제됨)
4. 개발팀에 문의
