# Gatrix Docker Swarm 배포

Docker Swarm을 사용한 프로덕션 배포 구성입니다.

## 주요 기능

- **롤링 업데이트**: 무중단 배포 및 실패 시 자동 롤백
- **서비스 스케일링**: 트래픽에 따른 서비스 확장/축소
- **롤백**: 이전 버전으로 즉시 복원
- **헬스 체크**: 자동 컨테이너 상태 모니터링
- **시크릿 관리**: 민감한 데이터 보안 저장
- **로드 밸런싱**: 내장 서비스 메시 및 부하 분산

## 사전 요구사항

- Docker 20.10+
- Docker Swarm 초기화
- Tencent Cloud Registry 접근 권한

## 빠른 시작

### 1. Swarm 클러스터 초기화

```bash
# 매니저 노드에서 실행
docker swarm init

# 워커 노드 추가 (선택사항)
docker swarm join-token worker
# 생성된 명령어를 워커 노드에서 실행
```

### 2. 환경 구성

```bash
cd deploy
cp .env.example .env
# 프로덕션 값으로 수정
vim .env
```

### 3. 초기 배포

```bash
# 시크릿 생성과 함께 배포
./deploy.sh --init --version 1.0.0
```

## 스크립트 참조

| 스크립트 | 설명 |
|----------|------|
| `deploy.sh` | 전체 스택 배포 또는 업데이트 |
| `update.sh` | 특정 서비스 롤링 업데이트 |
| `rollback.sh` | 이전 버전으로 롤백 |
| `scale.sh` | 서비스 스케일 조정 |
| `status.sh` | 스택 및 서비스 상태 확인 |

## 배포 워크플로우

### 신규 배포

```bash
./deploy.sh --init --version 1.0.0
```

### 롤링 업데이트

```bash
# 모든 서비스를 새 버전으로 업데이트
./update.sh --version 1.1.0 --all

# 특정 서비스만 업데이트
./update.sh --version 1.1.0 --service backend
```

### 롤백

```bash
# 특정 서비스 롤백
./rollback.sh --service backend

# 모든 서비스 롤백
./rollback.sh --all
```

### 스케일링

```bash
# 특정 서비스 스케일 조정
./scale.sh --service backend --replicas 4

# 프리셋 사용
./scale.sh --preset minimal    # 각 서비스 1개 레플리카
./scale.sh --preset standard   # 주요 서비스 2개 레플리카
./scale.sh --preset high       # 고트래픽용 4개 이상 레플리카

# 현재 스케일 상태 확인
./scale.sh --status
```

### 상태 모니터링

```bash
# 전체 상태 확인
./status.sh

# 서비스 목록 확인
./status.sh --services

# 실행 중인 태스크 확인
./status.sh --tasks

# 헬스 상태 확인
./status.sh --health

# 로그 스트리밍
./status.sh --logs backend
```

## 스케일링 프리셋

| 프리셋 | backend | frontend | event-lens | chat-server | edge |
|--------|---------|----------|------------|-------------|------|
| minimal | 1 | 1 | 1 | 1 | 1 |
| standard | 2 | 2 | 1 | 2 | 2 |
| high | 4 | 4 | 2 | 4 | 4 |

## 업데이트 설정

기본 롤링 업데이트 설정:
- `parallelism: 1` - 한 번에 하나의 컨테이너 업데이트
- `delay: 10s` - 업데이트 간 대기 시간
- `failure_action: rollback` - 실패 시 자동 롤백
- `monitor: 30s` - 업데이트 후 모니터링 기간
- `order: start-first` - 기존 컨테이너 중지 전 새 컨테이너 시작

## 시크릿 관리

`--init` 배포 시 생성되는 시크릿:

| 시크릿 | 설명 |
|--------|------|
| `db_root_password` | MySQL root 비밀번호 |
| `db_password` | 애플리케이션 DB 비밀번호 |
| `jwt_secret` | JWT 서명 키 |
| `jwt_refresh_secret` | JWT 리프레시 토큰 키 |
| `session_secret` | 세션 암호화 키 |
| `api_secret` | 내부 API 인증 |
| `edge_api_token` | Edge 서버 API 토큰 |
| `grafana_password` | Grafana 관리자 비밀번호 |

시크릿 업데이트:
```bash
# 기존 시크릿 삭제 (사용 중인 서비스 먼저 제거 필요)
docker secret rm jwt_secret

# 새 시크릿 생성
echo -n "new-secret-value" | docker secret create jwt_secret -

# 관련 서비스 재배포
./deploy.sh --version 1.0.0
```

## 네트워크 아키텍처

- `gatrix-internal`: 내부 오버레이 네트워크 (격리됨)
- `gatrix-public`: 외부 접근용 오버레이 네트워크

## 문제 해결

### 서비스 로그 확인
```bash
docker service logs gatrix_backend --follow --tail 100
```

### 태스크 상태 확인
```bash
docker service ps gatrix_backend --no-trunc
```

### 서비스 강제 업데이트
```bash
docker service update --force gatrix_backend
```

### 스택 제거
```bash
docker stack rm gatrix
```

