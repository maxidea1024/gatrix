# Gatrix Docker Swarm 배포 가이드 (Cloud Infra Edition)

이 디렉토리는 **Docker Swarm 전용** 배포 환경입니다.

MySQL과 Redis는 Cloud 인프라(Tencent Cloud, AWS RDS/ElastiCache 등)를 사용하며,  
이 폴더에는 **애플리케이션 서비스만** 포함되어 있습니다.

---

## 📋 기존 deploy와의 차이점

| 항목 | deploy/ (기존) | deploy-swarm/ (여기) |
|------|---------------|---------------------|
| MySQL | 로컬 컨테이너 | ❌ Cloud 사용 |
| Redis | 로컬 컨테이너 | ❌ Cloud 사용 |
| etcd | 로컬 컨테이너 | ❌ 제거 (Redis로 대체) |
| event-lens | 포함 | ❌ 제거 |
| chat-server | 포함 | ❌ 제거 |
| Service Discovery | etcd 또는 redis | Redis 전용 |
| 설정 파일 | ../docker/ 참조 | ✅ config/ 내장 (self-contained) |

## 📦 포함된 서비스

- **backend** — Gatrix API 서버
- **frontend** — Gatrix 웹 프론트엔드 (Nginx)
- **edge** — Edge 캐시 서버 (Cloud LB 뒤에 배치)
- **nginx** — 리버스 프록시 *(선택사항, 기본 비활성)*
- **prometheus** — 메트릭 수집
- **grafana** — 모니터링 대시보드

---

## 🔧 사전 요구사항

1. **Docker** (20.10 이상) 및 **Docker Swarm** 모드
2. **Cloud MySQL** — 접속 주소, 계정, 비밀번호
3. **Cloud Redis** — 접속 주소, 비밀번호
4. **Docker Registry 접근 권한** (registry.env에 설정됨)

---

## 🚀 빠른 시작

### 1단계: 환경 설정

```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일을 편집하여 Cloud DB/Redis 정보 입력
vi .env
```

**반드시 설정해야 하는 항목:**
```
DB_HOST=your-cloud-mysql-host.com
DB_USER=gatrix_user
DB_PASSWORD=your-secure-password
REDIS_HOST=your-cloud-redis-host.com
REDIS_PASSWORD=your-redis-password
```

### 2단계: 보안 키 생성

```bash
# 모든 보안 키를 자동 생성 후 .env에 복사
./generate-secrets.sh --env
```

### 3단계: registry.env 생성

```bash
# Docker Registry 인증 정보 파일 생성 (패키지에 미포함)
cat > registry.env << EOF
REGISTRY_HOST=uwocn.tencentcloudcr.com
REGISTRY_USER=your-registry-user
REGISTRY_PASS=your-registry-token
REGISTRY_NAMESPACE=uwocn
EOF
```

### 4단계: 첫 배포

```bash
# 스크립트 실행 권한 부여
chmod +x *.sh

# 첫 배포 (Swarm 초기화 + Secrets 생성 + 배포)
./deploy.sh -v 1.0.0 --init
```

PowerShell (Windows):
```powershell
./deploy.ps1 -v 1.0.0 -i
```

### 5단계: 헬스 체크

```bash
# 배포 후 서비스 정상 동작 확인
./health-check.sh
```

---

## 📁 디렉토리 구조

```
deploy-swarm/
├── docker-compose.swarm.yml    # 메인 스택 정의 파일
├── .env.example                # 환경 변수 예시
├── .env                        # 실제 환경 변수 (직접 생성)
├── registry.env                # Docker Registry 인증 정보
├── .gitignore                  # Git 제외 규칙
├── config/                     # 설정 파일 (self-contained)
│   ├── nginx.conf              # Nginx 리버스 프록시 설정
│   ├── prometheus.yml          # Prometheus 수집 설정
│   └── grafana/provisioning/   # Grafana 설정
├── deploy.sh / .ps1            # 배포 스크립트
├── teardown.sh / .ps1          # 스택 제거 스크립트
├── health-check.sh / .ps1      # 헬스 체크 스크립트
├── build-and-push.sh / .ps1    # 이미지 빌드 & 레지스트리 푸시
├── update.sh / .ps1            # 롤링 업데이트
├── rollback.sh / .ps1          # 롤백
├── scale.sh / .ps1             # 스케일링
├── status.sh / .ps1            # 상태 확인
├── list-images.sh / .ps1       # 레지스트리 이미지 목록
├── login-registry.sh / .ps1    # 레지스트리 로그인
├── generate-secrets.sh / .ps1  # 보안 키 생성
├── package.sh / .ps1           # 배포 파일 패키징 (tgz)
├── package-deploy.js           # 배포 파일 패키징 (Node.js)
├── README.md                   # 한국어 문서
├── README.en.md                # 영어 문서
└── README.zh.md                # 중국어 문서
```

---

## 📝 환경 변수 설명

### 필수 항목

| 변수 | 설명 | 예시 |
|------|------|------|
| `DB_HOST` | Cloud MySQL 호스트 | `mysql.cloud.example.com` |
| `DB_PORT` | MySQL 포트 | `3306` |
| `DB_NAME` | 데이터베이스 이름 | `gatrix` |
| `DB_USER` | DB 사용자 | `gatrix_user` |
| `DB_PASSWORD` | DB 비밀번호 | `secure-password` |
| `REDIS_HOST` | Cloud Redis 호스트 | `redis.cloud.example.com` |
| `REDIS_PORT` | Redis 포트 | `6379` |
| `REDIS_PASSWORD` | Redis 비밀번호 | `redis-password` |

### 보안 항목 (운영 환경에서 반드시 변경)

| 변수 | 설명 |
|------|------|
| `JWT_SECRET` | JWT 토큰 서명 키 |
| `JWT_REFRESH_SECRET` | JWT 리프레시 토큰 키 |
| `SESSION_SECRET` | 세션 암호화 키 |
| `EDGE_API_TOKEN` | Edge 서버 API 토큰 |
| `GRAFANA_ADMIN_PASSWORD` | Grafana 관리자 비밀번호 |

### 선택 항목

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `GATRIX_VERSION` | `latest` | 배포할 이미지 태그 |
| `NGINX_REPLICAS` | `0` | Nginx 레플리카 (0=비활성, 1=활성) |
| `HTTP_PORT` | `80` | Nginx HTTP 포트 |
| `HTTPS_PORT` | `443` | Nginx HTTPS 포트 |
| `BACKEND_REPLICAS` | `2` | Backend 레플리카 수 |
| `FRONTEND_REPLICAS` | `2` | Frontend 레플리카 수 |
| `EDGE_REPLICAS` | `2` | Edge 레플리카 수 |
| `GRAFANA_PORT` | `3000` | Grafana 대시보드 포트 |
| `PROMETHEUS_PORT` | `9090` | Prometheus UI 포트 |
| `DEFAULT_LANGUAGE` | `zh` | 기본 언어 |

---

## 🛠️ 운영 가이드

### 이미지 빌드 및 푸시

```bash
./build-and-push.sh -t v1.0.0 -l -p           # 모든 서비스
./build-and-push.sh -s backend -t v1.0.0 -p    # 특정 서비스만
```

### 롤링 업데이트

```bash
./update.sh -v 1.1.0 --all                     # 모든 서비스 업데이트
./update.sh -v 1.1.0 --service backend          # 특정 서비스만
```

### 롤백

```bash
./rollback.sh --service backend                 # 특정 서비스 롤백
./rollback.sh --all                             # 모든 서비스 롤백
```

### 스케일링

```bash
./scale.sh --preset minimal                     # backend:1  frontend:1  edge:1
./scale.sh --preset standard                    # backend:2  frontend:1  edge:2
./scale.sh --preset high                        # backend:4  frontend:2  edge:8
./scale.sh --service backend --replicas 4       # 개별 스케일링
```

### 상태 확인

```bash
./status.sh                                     # 전체 상태
./status.sh --services                          # 서비스 목록
./status.sh --health                            # 헬스 상태
./status.sh --logs backend                      # 서비스 로그
```

### 헬스 체크

```bash
./health-check.sh                               # 전체 헬스 체크 (HTTP 포함)
./health-check.sh --timeout 180                 # 타임아웃 설정
```

### 보안 키 생성

```bash
./generate-secrets.sh --env                     # 모든 .env 보안 키 생성
./generate-secrets.sh                           # 단일 키 생성 (32바이트 base64)
./generate-secrets.sh -l 64 -e hex              # 64바이트 hex 키
./generate-secrets.sh -l 48 -e alphanumeric     # 48자 영숫자 키
```

### 스택 제거 (Teardown)

```bash
./teardown.sh                                   # 스택만 제거
./teardown.sh --all                             # 스택 + 볼륨 + 시크릿 전부 제거
./teardown.sh --all -y                          # 확인 없이 바로 제거
```

### 배포 파일 패키징 (퍼블리셔 전달용)

```bash
./package.sh                                    # gatrix-swarm-YYYYMMDD-HHMMSS.tgz 생성
./package.sh -o /tmp                            # 지정 디렉토리에 생성
```

---

## 📋 .env 관리 가이드

### Docker Swarm의 .env 동작 방식

> **핵심**: Docker Swarm은 `.env`를 **배포 시점에만** 읽습니다 (`docker stack deploy`).  
> `.env`를 편집하는 것만으로는 실행 중인 서비스에 아무런 영향을 주지 않습니다. 반드시 재배포해야 적용됩니다.

```
.env 파일 ──(배포 시점에 읽음)──> docker stack deploy ──> 실행 중인 컨테이너
                                  ↑                        ↑
                           여기서만 읽음              값이 고정됨
```

### 변수 분류

설정은 **3가지 카테고리**로 나뉘며, 각각 변경 절차가 다릅니다:

| 카테고리 | 예시 | 저장 위치 | 변경 방법 |
|----------|------|-----------|-----------|
| **환경 변수** | `DB_HOST`, `REDIS_HOST`, `DEFAULT_LANGUAGE` | `.env` → 컨테이너 env | `.env` 수정 + 재배포 |
| **Docker Secrets** | `JWT_SECRET`, `SESSION_SECRET` | Docker secret 저장소 | Secret 삭제 + 재생성 + 재배포 |
| **배포 전용 변수** | `GATRIX_VERSION`, `BACKEND_REPLICAS` | `.env` → compose 파일 | `.env` 수정 + 재배포 |

### 절차: 환경 변수 변경

`DB_HOST`, `REDIS_HOST`, `DEFAULT_LANGUAGE`, `EDGE_*` 등의 변경:

```bash
# 1. .env 편집
vi .env

# 2. 재배포 (Swarm이 자동으로 롤링 업데이트 수행)
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 3. 변경 적용 확인
docker service inspect gatrix_backend --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep DB_HOST

# 4. 헬스 체크
./health-check.sh
```

**재배포 시 동작:**
- Swarm이 새 설정과 실행 중인 설정을 비교
- 변경된 서비스만 재시작됨
- 롤링 업데이트로 재시작 (replicas > 1이면 무중단)
- 변경 없는 서비스는 재시작하지 않음

### 절차: 보안 키 변경 (JWT, Session 등)

`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `EDGE_API_TOKEN` 변경:

> ⚠️ **주의**: JWT Secret을 변경하면 모든 기존 사용자 세션이 무효화됩니다.  
> 점검 시간에 진행하세요.

> **참고**: 서비스는 보안 값을 **환경 변수** (`.env`에서 설정)로 읽습니다. 
> Docker secret 파일 마운트가 아닙니다. Docker secrets는 `--init` 시 참조/백업 
> 용도로 생성됩니다. 일관성을 위해 `.env`와 Docker secrets **모두** 업데이트하세요.

```bash
# 1. .env에서 새 값으로 업데이트
vi .env    # JWT_SECRET=새-값 변경

# 2. 재배포 (Swarm 롤링 업데이트로 새 env var 적용)
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 3. 확인
./health-check.sh

# 4. (선택) 일관성을 위해 Docker secret도 업데이트
docker stack rm gatrix
sleep 15
docker secret rm jwt_secret
echo -n "새-값" | docker secret create jwt_secret -
./deploy.sh -v latest
```

### 절차: 스케일링 (레플리카 수 변경)

```bash
# 방법 A: .env 수정 후 재배포 (영구 반영)
vi .env    # EDGE_REPLICAS=8 변경
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 방법 B: scale 스크립트 사용 (즉시 반영, .env에는 저장 안됨)
./scale.sh --service edge --replicas 8
```

> **중요**: `scale.sh`로 변경한 값은 **임시**입니다. `.env`를 수정하지 않고 재배포하면,  
> 레플리카 수가 `.env` 값으로 되돌아갑니다. 영구 변경은 반드시 `.env`도 함께 수정하세요.

### 절차: 이미지 버전 변경

```bash
# 1. .env 수정
vi .env    # GATRIX_VERSION=1.2.0 변경

# 2. 재배포
./deploy.sh -v 1.2.0

# 또는 서비스별 업데이트:
./update.sh -v 1.2.0 --all
```

### 흔한 실수

| 실수 | 결과 | 해결 |
|------|------|------|
| `.env` 수정 후 재배포 안함 | 아무것도 바뀌지 않음 | `docker stack deploy ...` 실행 |
| `.env`에서만 `JWT_SECRET` 변경 | Docker Secret은 여전히 이전 값 | Secret 삭제 + 재생성 필요 |
| `scale.sh` 사용 후 `.env` 미수정 | 다음 재배포 시 `.env` 값으로 되돌아감 | 스케일링 후 `.env`도 업데이트 |
| `DB_HOST=your-cloud-...` (플레이스홀더) | `deploy.sh`가 검증 실패로 차단 | 실제 Cloud DB 주소로 교체 |
| 한 매니저 노드에서만 `.env` 수정 | 다른 매니저 노드는 다른 `.env` 사용 가능 | 모든 매니저 노드에 `.env` 동기화 |

### 실행 중인 설정 확인

```bash
# 서비스의 실제 환경 변수 확인:
docker service inspect gatrix_backend --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | python3 -m json.tool

# 연결된 Secret 확인:
docker service inspect gatrix_backend --format '{{json .Spec.TaskTemplate.ContainerSpec.Secrets}}'

# 특정 변수 확인:
docker service inspect gatrix_backend --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep REDIS_HOST
```

### 멀티 노드 Swarm 시 주의사항

Docker Swarm을 여러 매니저/워커 노드로 운영할 때:

1. **`.env`는 `docker stack deploy`를 실행하는 노드에 있어야 함** — 보통 마스터 매니저
2. **`config/` 디렉토리가 접근 가능해야 함** — nginx/prometheus/grafana가 실행되는 노드에 bind-mount됨
3. **Docker Secrets은 자동으로 복제됨** — 모든 Swarm 노드에 걸쳐
4. **이미지 pull은 모든 노드에서 인증 필요** — `--with-registry-auth` 사용 (deploy 스크립트에 포함됨)

### 백업 및 복원

```bash
# 변경 전 .env 백업
cp .env .env.backup.$(date +%Y%m%d-%H%M%S)

# 백업 목록
ls -la .env.backup.*

# 백업에서 복원
cp .env.backup.20260415-103000 .env
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix
```

---

## 🔍 서비스 아키텍처

```
                    ┌──────────────┐
                    │   Internet   │
                    └──────┬───────┘
                           │
                  ┌────────┴────────┐
                  │   Cloud LB      │  (Tencent CLB / AWS ALB)
                  └────────┬────────┘
                           │
         ┌─────────────────┼──────────────────┐
         │                 │                  │
 ┌───────┴──────┐  ┌──────┴──────┐  ┌────────┴───────┐
 │   Edge ×N    │  │  Frontend   │  │   Backend      │
 │  :3400       │  │  :43000     │  │   :45000       │
 │ (Game SDK)   │  │ (Admin UI)  │  │  (Admin API)   │
 └──────────────┘  └─────────────┘  └────────┬───────┘
                                             │
                   ┌─────────────────────────┘
                   │
         ┌─────────┴────────┐
         │                  │
   ┌─────┴─────┐    ┌──────┴──────┐
   │Cloud MySQL│    │ Cloud Redis │
   │ (External)│    │ (External)  │
   └───────────┘    └─────────────┘

   ┌────────────┐     ┌────────────┐
   │ Prometheus │────→│  Grafana   │
   │  :9090     │     │   :3000    │
   └────────────┘     └────────────┘

   ┌─────────────────────────────────────┐
   │ Nginx (optional, NGINX_REPLICAS=1)  │
   │ Dev/staging unified gateway :80     │
   └─────────────────────────────────────┘
```

---

## ⚠️ 주의사항

1. **`.env` 파일을 Git에 커밋하지 마세요** — 실제 비밀번호가 포함되어 있습니다.
2. **`registry.env`를 Git에 커밋하지 마세요** — 레지스트리 인증 토큰이 포함되어 있습니다.
3. **보안 키는 환경 변수입니다**: 서비스는 `JWT_SECRET`, `SESSION_SECRET` 등을 `.env`에서 읽습니다 (Docker secret 파일 마운트가 아닙니다). 변경하려면 `.env`를 수정하고 재배포하세요:
   ```bash
   # .env 수정 후:
   docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix
   ```
4. **Cloud DB/Redis 방화벽**: Docker Swarm 노드의 IP에서 Cloud DB/Redis에 접근할 수 있도록 보안 그룹/방화벽을 설정하세요.
5. **Redis Pub/Sub 접근**: Gatrix는 Redis Pub/Sub을 통해 게임 서버와 실시간으로 통신합니다 (Feature Flag 변경, 설정 동기화 등). Cloud Redis는 **Gatrix 서비스뿐만 아니라 게임 서버에서도 접근 가능해야** 합니다. 게임 서버가 별도 네트워크에 있는 경우, Cloud Redis의 보안 그룹에 게임 서버 IP도 허용해야 합니다.

---

## 📖 다른 언어

- [English](README.en.md)
- [中文](README.zh.md)
