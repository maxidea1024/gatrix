# Gatrix 배포 스크립트

이 디렉토리에는 Gatrix 애플리케이션 스택을 빌드, 배포 및 관리하기 위한 스크립트가 포함되어 있습니다.

모든 스크립트는 PowerShell과 Bash 간의 일관성을 위해 **리눅스 스타일 인자**(예: `-t`, `--tag`)를 지원합니다.

---

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [설정](#설정)
3. [빌드 및 푸시](#빌드-및-푸시)
4. [배포](#배포)
5. [운영](#운영)
6. [레지스트리 스크립트](#레지스트리-스크립트)
7. [문제 해결](#문제-해결)

---

## 사전 요구사항

- **Docker Desktop** (또는 Docker Engine) 설치 및 실행 중
- **Docker Swarm** 초기화 (배포 스크립트용)
- **PowerShell 5+** (Windows) 또는 **Bash** (Linux/macOS)
- Tencent Cloud Registry 접근 권한 (`registry.env`에 인증 정보)

---

## 설정

### `registry.env`

레지스트리 인증 정보 (버전 관리에 커밋하지 마세요):

```bash
REGISTRY_HOST=uwocn.tencentcloudcr.com
REGISTRY_USER=<사용자명>
REGISTRY_PASS=<비밀번호 또는 토큰>
REGISTRY_NAMESPACE=uwocn/uwocn
```

### `.env` / `.env.example`

스택용 환경 변수 (데이터베이스, JWT 시크릿 등). `.env.example`을 `.env`로 복사하고 값을 입력하세요.

---

## 빌드 및 푸시

### `build-and-push.ps1` / `build-and-push.sh`

Docker 이미지를 빌드하고 선택적으로 레지스트리에 푸시합니다.

**옵션:**

| 옵션                   | 설명                              |
| ---------------------- | --------------------------------- |
| `-t, --tag <tag>`      | 이미지 태그 (기본값: `latest`)    |
| `-p, --push`           | 빌드 후 레지스트리에 푸시         |
| `-l, --latest`         | `latest` 태그도 함께 추가 및 푸시 |
| `-s, --service <name>` | 특정 서비스만 빌드 (반복 가능)    |
| `-h, --help`           | 도움말 표시                       |

**사용 가능한 서비스:** `backend`, `frontend`, `edge`, `chat-server`, `event-lens`

**예시:**

```bash
# 모든 서비스 빌드, "latest" 태그
./build-and-push.ps1
./build-and-push.sh

# 특정 버전 태그로 모든 서비스 빌드 및 푸시
./build-and-push.ps1 -t v1.2.0 -p
./build-and-push.sh --tag v1.2.0 --push

# 버전 태그와 함께 latest 태그도 추가
./build-and-push.ps1 -t v1.2.0 -l -p
./build-and-push.sh --tag v1.2.0 --latest --push

# backend만 빌드
./build-and-push.ps1 -s backend
./build-and-push.sh --service backend

# backend와 frontend 빌드 후 푸시
./build-and-push.ps1 -s backend -s frontend -p
./build-and-push.sh --service backend --service frontend --push
```

---

## 배포

### `deploy.ps1` / `deploy.sh`

Docker Swarm에 Gatrix 스택을 배포합니다.

**옵션:**

| 옵션                      | 설명                              |
| ------------------------- | --------------------------------- |
| `-v, --version <version>` | 배포할 버전 (기본값: `latest`)    |
| `-e, --env-file <file>`   | 환경 파일 경로 (기본값: `.env`)   |
| `-n, --stack <name>`      | 스택 이름 (기본값: `gatrix`)      |
| `-i, --init`              | Swarm 초기화 및 시크릿 생성       |
| `-u, --update`            | 롤링 업데이트 수행                |
| `--prune`                 | 배포 후 사용하지 않는 이미지 제거 |
| `-h, --help`              | 도움말 표시                       |

**예시:**

```bash
# 최초 배포 (Swarm 초기화 + 시크릿)
./deploy.ps1 -v v1.0.0 -i
./deploy.sh --version v1.0.0 --init

# 롤링 업데이트로 배포
./deploy.ps1 -v v1.1.0 -u
./deploy.sh --version v1.1.0 --update

# 배포 후 오래된 이미지 정리
./deploy.ps1 -v v1.2.0 --prune
./deploy.sh --version v1.2.0 --prune
```

---

## 운영

### `update.ps1` / `update.sh`

실행 중인 서비스에 롤링 업데이트를 수행합니다.

**옵션:**

| 옵션                      | 설명                              |
| ------------------------- | --------------------------------- |
| `-v, --version <version>` | 대상 버전 (필수)                  |
| `-s, --service <name>`    | 특정 서비스만 업데이트            |
| `-a, --all`               | 모든 애플리케이션 서비스 업데이트 |
| `-f, --force`             | 동일 이미지도 강제 업데이트       |
| `-n, --stack <name>`      | 스택 이름 (기본값: `gatrix`)      |
| `-h, --help`              | 도움말 표시                       |

**예시:**

```bash
# 모든 서비스를 v1.2.0으로 업데이트
./update.ps1 -v v1.2.0 -a
./update.sh --version v1.2.0 --all

# backend만 업데이트
./update.ps1 -v v1.2.0 -s backend
./update.sh --version v1.2.0 --service backend

# 동일 이미지도 강제 재배포
./update.ps1 -v v1.2.0 -s backend -f
./update.sh --version v1.2.0 --service backend --force
```

---

### `rollback.ps1` / `rollback.sh`

서비스를 이전 버전으로 롤백합니다.

**옵션:**

| 옵션                   | 설명                          |
| ---------------------- | ----------------------------- |
| `-s, --service <name>` | 특정 서비스 롤백              |
| `-a, --all`            | 모든 애플리케이션 서비스 롤백 |
| `-n, --stack <name>`   | 스택 이름 (기본값: `gatrix`)  |
| `-h, --help`           | 도움말 표시                   |

**예시:**

```bash
# backend 서비스 롤백
./rollback.ps1 -s backend
./rollback.sh --service backend

# 모든 서비스 롤백
./rollback.ps1 -a
./rollback.sh --all
```

---

### `scale.ps1` / `scale.sh`

서비스 레플리카 수를 조절합니다.

**옵션:**

| 옵션                   | 설명                                       |
| ---------------------- | ------------------------------------------ |
| `-s, --service <name>` | 스케일할 서비스                            |
| `-r, --replicas <n>`   | 레플리카 수                                |
| `--preset <name>`      | 프리셋 사용: `minimal`, `standard`, `high` |
| `--status`             | 현재 스케일 상태 표시                      |
| `-n, --stack <name>`   | 스택 이름 (기본값: `gatrix`)               |
| `-h, --help`           | 도움말 표시                                |

**프리셋:**

- `minimal`: 각 서비스 1개 레플리카
- `standard`: 각 서비스 2개 레플리카 (권장)
- `high`: 각 서비스 4개 레플리카 (고트래픽)

**예시:**

```bash
# backend를 4개 레플리카로 스케일
./scale.ps1 -s backend -r 4
./scale.sh --service backend --replicas 4

# 고트래픽 프리셋 적용
./scale.ps1 --preset high
./scale.sh --preset high

# 현재 상태 확인
./scale.ps1 --status
./scale.sh --status
```

---

### `status.ps1` / `status.sh`

배포된 스택의 상태를 표시합니다.

**옵션:**

| 옵션                   | 설명                         |
| ---------------------- | ---------------------------- |
| `-s, --services`       | 서비스 목록만 표시           |
| `-t, --tasks`          | 실행 중인 태스크만 표시      |
| `-l, --logs <service>` | 서비스 로그 스트리밍         |
| `--health`             | 헬스 체크 상태 표시          |
| `-n, --stack <name>`   | 스택 이름 (기본값: `gatrix`) |
| `-h, --help`           | 도움말 표시                  |

**예시:**

```bash
# 전체 상태 표시
./status.ps1
./status.sh

# 서비스만 표시
./status.ps1 -s
./status.sh --services

# backend 로그 스트리밍
./status.ps1 -l backend
./status.sh --logs backend

# 헬스 상태 표시
./status.ps1 --health
./status.sh --health
```

---

## 레지스트리 스크립트

### `login-registry.ps1` / `login-registry.sh`

`registry.env`의 인증 정보를 사용하여 Tencent Cloud Registry에 로그인합니다.

```bash
./login-registry.ps1
./login-registry.sh
# 출력: Login Succeeded
```

---

### `list-images.ps1` / `list-images.sh`

레지스트리 네임스페이스의 모든 이미지 태그를 나열합니다.

```bash
./list-images.ps1
./list-images.sh
# 출력: Tags found:
#   backend-latest
#   backend-v1.0.0
#   frontend-latest
#   ...
```

리포지토리가 비어있으면:

```
Repository 'uwocn/uwocn' not found or has no images yet.
```

---

## 문제 해결

### "Login Failed" 오류

- `registry.env`에 유효한 인증 정보가 있는지 확인하세요.
- `REGISTRY_HOST`가 올바른지 확인하세요.
- 수동으로 로그인 시도: `docker login uwocn.tencentcloudcr.com`

### 이미지 목록 조회 시 "Repository not found"

- 아직 이미지가 푸시되지 않은 경우 정상입니다.
- 먼저 `./build-and-push.ps1 -p`로 이미지를 푸시하세요.

### "Docker build failed" 빌드 실패

- Docker가 실행 중인지 확인하세요.
- `packages/<service>/Dockerfile` 문법을 확인하세요.
- `docker build`를 직접 실행하여 자세한 오류를 확인하세요.

### Swarm 초기화되지 않음

- `docker swarm init`을 실행하거나 `deploy.ps1`에서 `--init` 플래그를 사용하세요.

---

## 파일 참조

| 파일                     | 용도                       |
| ------------------------ | -------------------------- |
| `build-and-push.ps1/.sh` | Docker 이미지 빌드 및 푸시 |
| `deploy.ps1/.sh`         | Docker Swarm 배포          |
| `update.ps1/.sh`         | 롤링 업데이트              |
| `rollback.ps1/.sh`       | 서비스 롤백                |
| `scale.ps1/.sh`          | 레플리카 스케일            |
| `status.ps1/.sh`         | 스택 상태 표시             |
| `login-registry.ps1/.sh` | 레지스트리 로그인          |
| `list-images.ps1/.sh`    | 레지스트리 이미지 목록     |
| `registry.env`           | 레지스트리 인증 정보       |
| `.env.example`           | 환경 설정 템플릿           |
| `docker-stack.yml`       | Swarm 스택 정의            |
