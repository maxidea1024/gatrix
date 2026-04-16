# Gatrix AWS ECS 배포 가이드

이 디렉토리는 **AWS ECS (Fargate)** 전용 배포 환경입니다.

MySQL은 AWS RDS, Redis는 AWS ElastiCache를 사용하며,  
이 폴더에는 **애플리케이션 서비스 + 모니터링** 만 포함되어 있습니다.

---

## 📋 기존 deploy-swarm과의 차이점

| 항목 | deploy-swarm/ (Swarm) | deploy-ecs/ (여기) |
|------|----------------------|-------------------|
| 오케스트레이션 | Docker Swarm | AWS ECS Fargate |
| 인프라 정의 | docker-compose.swarm.yml | CloudFormation (`cfn/`) |
| 컨테이너 레지스트리 | Tencent Cloud CR | **AWS ECR** |
| 로드밸런서 | Cloud LB (외부) + Nginx (선택) | **AWS ALB** (내장) |
| 서비스 디스커버리 | Swarm Overlay DNS | AWS Cloud Map |
| 시크릿 관리 | Docker Secrets + .env | **AWS Secrets Manager** |
| 로깅 | json-file (로컬) | **CloudWatch Logs** |
| 모니터링 | Prometheus + Grafana (Swarm) | CloudWatch Insights + Prometheus/Grafana (ECS) |
| 스케일링 | `docker service scale` | ECS Auto Scaling + `aws ecs update-service` |
| CI/CD | 없음 (수동) | **GitHub Actions** (`cd-ecs.yml`) |
| Nginx 리버스 프록시 | 선택사항 (NGINX_REPLICAS) | ❌ ALB가 대체 |

## 📦 포함된 서비스

- **backend** — Gatrix API 서버
- **frontend** — Gatrix 웹 프론트엔드 (Nginx)
- **edge** — Edge 캐시 서버 (ALB 뒤에 배치)
- **prometheus** — 메트릭 수집 (ECS Fargate + EFS)
- **grafana** — 모니터링 대시보드 (ECS Fargate + EFS)

---

## 🔧 사전 요구사항

### 1. AWS 계정

AWS 계정이 없다면 먼저 생성하세요: https://aws.amazon.com/

### 2. AWS CLI 설치

```bash
# macOS
brew install awscli

# Windows
# https://awscli.amazonaws.com/AWSCLIV2.msi 다운로드 후 실행

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

설치 확인:
```bash
aws --version
# aws-cli/2.x.x ...
```

### 3. AWS CLI 인증 설정

```bash
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: ap-northeast-2
# Default output format: json
```

> **첫 사용자를 위한 팁**: AWS 콘솔 → IAM → 사용자 → 보안 자격 증명 → 액세스 키 만들기

### 4. 필요한 IAM 권한

배포를 실행하는 IAM 사용자/역할에 다음 권한이 필요합니다:

| 서비스 | 필요 권한 | 용도 |
|--------|-----------|------|
| CloudFormation | `cloudformation:*` | 인프라 생성/수정/삭제 |
| ECS | `ecs:*` | 서비스 관리 |
| ECR | `ecr:*` | 이미지 푸시/풀 |
| EC2 | `ec2:*` (VPC관련) | VPC, SG, 서브넷 생성 |
| ELB | `elasticloadbalancing:*` | ALB 관리 |
| IAM | `iam:CreateRole`, `iam:PutRolePolicy`, `iam:PassRole` | ECS 역할 생성 |
| CloudWatch | `logs:*` | 로그 그룹 관리 |
| Secrets Manager | `secretsmanager:*` | 시크릿 관리 |
| Service Discovery | `servicediscovery:*` | Cloud Map 관리 |
| EFS | `elasticfilesystem:*` | 모니터링 스토리지 |
| Auto Scaling | `application-autoscaling:*` | 서비스 스케일링 |

> **간편 설정**: 처음 시작할 때는 `AdministratorAccess` 정책을 사용하고, 안정화 후 최소 권한으로 전환하세요.

### 5. Docker 설치

이미지 빌드에 필요합니다:
- Windows: https://docs.docker.com/desktop/install/windows-install/
- macOS: https://docs.docker.com/desktop/install/mac-install/
- Linux: https://docs.docker.com/engine/install/

### 6. jq 설치 (Bash 스크립트용)

```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq  # Ubuntu/Debian
sudo yum install jq      # Amazon Linux/CentOS
```

---

## 🚀 빠른 시작 (Step-by-Step)

### 1단계: 환경 설정

```bash
cd deploy-ecs

# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일을 편집
vi .env  # 또는 code .env (VS Code)
```

**반드시 설정해야 하는 항목:**
```
AWS_ACCOUNT_ID=123456789012        # ← 본인의 AWS 계정 ID
AWS_REGION=ap-northeast-2           # ← 서울 리전

DB_HOST=your-rds-host.amazonaws.com # ← RDS MySQL 엔드포인트
DB_USER=gatrix_user                 # ← DB 사용자
DB_PASSWORD=your-secure-password    # ← DB 비밀번호

REDIS_HOST=your-redis.cache.amazonaws.com  # ← ElastiCache 엔드포인트
REDIS_PASSWORD=your-redis-password

EDGE_REDIS_HOST=your-redis.cache.amazonaws.com  # ← 위와 동일
EDGE_REDIS_PASSWORD=your-redis-password
```

> **AWS 계정 ID 확인 방법**: `aws sts get-caller-identity --query Account --output text`

### 2단계: 보안 키 생성

```bash
# 보안 키 자동 생성 (화면에 출력)
./generate-secrets.sh --env   # Linux/macOS
./generate-secrets.ps1 --env  # Windows PowerShell

# 출력된 값을 .env에 복사해서 붙여넣기
```

### 3단계: AWS Secrets Manager에 시크릿 저장

```bash
./setup-secrets.sh             # Linux/macOS
./setup-secrets.ps1            # Windows PowerShell
```

이 스크립트는 `.env`의 `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`을 AWS Secrets Manager에 저장합니다.

### 4단계: Docker 이미지 빌드 및 ECR 푸시

```bash
# 스크립트 실행 권한 부여 (Linux/macOS)
chmod +x *.sh

# 모든 서비스 빌드 및 ECR 푸시
./build-and-push.sh -t v1.0.0 -l -p   # Linux/macOS
./build-and-push.ps1 -t v1.0.0 -l -p  # Windows

# 특정 서비스만 빌드
./build-and-push.sh -s backend -t v1.0.0 -p
```

### 5단계: 첫 배포

```bash
# 전체 인프라 + 서비스 배포 (약 15~20분 소요)
./deploy.sh -v v1.0.0 -i       # Linux/macOS
./deploy.ps1 -v v1.0.0 -i      # Windows

# 이 명령은 다음을 순서대로 생성합니다:
# 1. VPC (네트워크)
# 2. Security Groups (방화벽)
# 3. ALB (로드밸런서)
# 4. ECS Cluster
# 5. Service Discovery (Cloud Map)
# 6. Task Definitions (컨테이너 정의)
# 7. ECS Services (컨테이너 실행)
# 8. Monitoring (Prometheus + Grafana)
```

### 6단계: 헬스 체크

```bash
./health-check.sh              # Linux/macOS
./health-check.ps1             # Windows
```

배포가 성공하면 ALB DNS 주소가 출력됩니다:
```
Access your services via ALB:
  - Frontend (Admin UI): http://gatrix-alb-xxxxxxxx.ap-northeast-2.elb.amazonaws.com/
  - Backend API:         http://gatrix-alb-xxxxxxxx.ap-northeast-2.elb.amazonaws.com/api/v1/
  - Grafana:             http://gatrix-alb-xxxxxxxx.ap-northeast-2.elb.amazonaws.com/grafana/
```

---

## 📁 디렉토리 구조

```
deploy-ecs/
├── README.md                        # 한국어 문서
├── README.en.md                     # 영어 문서
├── .env.example                     # 환경 변수 예시
├── .gitignore                       # Git 제외 규칙
├── cfn/                             # CloudFormation 템플릿
│   ├── 00-vpc.yml                   # VPC, 서브넷 (NAT Gateway 제거됨, VPC Endpoint 사용)
│   ├── 01-security-groups.yml       # 보안 그룹
│   ├── 02-alb.yml                   # ALB + Target Groups + Listener Rules
│   ├── 03-ecs-cluster.yml           # ECS Cluster + IAM Roles + Log Groups
│   ├── 04-service-discovery.yml     # Cloud Map (gatrix.local)
│   ├── 05-task-definitions.yml      # Task Definitions (backend/frontend/edge)
│   ├── 06-ecs-services.yml          # ECS Services + Auto Scaling
│   └── 07-monitoring.yml            # Prometheus + Grafana (EFS 사용)
├── config/                          # 설정 파일
│   ├── prometheus.yml               # Prometheus 수집 설정
│   └── grafana/provisioning/        # Grafana 설정
├── deploy.ps1 / .sh                 # 배포 스크립트
├── update.ps1 / .sh                 # 롤링 업데이트
├── rollback.ps1 / .sh               # 롤백
├── scale.ps1 / .sh                  # 스케일링
├── status.ps1 / .sh                 # 상태 확인
├── health-check.ps1 / .sh           # 헬스 체크
├── teardown.ps1 / .sh               # 전체 환경 삭제
├── build-and-push.ps1 / .sh         # ECR 빌드 & 푸시 (개발용)
├── login-registry.ps1 / .sh         # ECR 로그인
├── generate-secrets.ps1 / .sh       # 보안 키 생성
└── setup-secrets.ps1 / .sh          # AWS Secrets Manager 설정
```

---

## 🛠️ 운영 가이드

### 롤링 업데이트

```bash
./update.sh -v 1.1.0 --all                # 모든 서비스
./update.sh -v 1.1.0 --service backend     # 특정 서비스만

# PowerShell:
./update.ps1 -v 1.1.0 -a
```

### 롤백

```bash
./rollback.sh --service backend            # 이전 task definition으로 롤백
./rollback.sh --all                        # 모든 서비스 롤백
```

### 스케일링

```bash
./scale.sh --preset minimal               # backend:1  frontend:1  edge:1
./scale.sh --preset standard              # backend:2  frontend:1  edge:2
./scale.sh --preset high                  # backend:4  frontend:2  edge:8
./scale.sh --service backend --replicas 4 # 개별 스케일링
./scale.sh --status                       # 현재 상태 확인
```

### 상태 확인

```bash
./status.sh                               # 전체 상태
./status.sh --health                      # 헬스 상태
./status.sh --logs backend                # CloudWatch 로그 (실시간)
```

### 환경 삭제 (Teardown)

```bash
./teardown.sh                             # CloudFormation 스택만 삭제
./teardown.sh --all                       # 스택 + Secrets + Log Groups 전부 삭제
./teardown.sh --all -y                    # 확인 없이 삭제
```

---

## 🔀 GitHub Actions CI/CD

### 설정 방법

1. GitHub 리포지토리 → Settings → Secrets and variables → Actions
2. 다음 Secrets를 추가:

| Secret 이름 | 값 예시 | 설명 |
|-------------|---------|------|
| `AWS_ACCOUNT_ID` | `123456789012` | AWS 계정 ID |
| `AWS_REGION` | `ap-northeast-2` | AWS 리전 |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | IAM Access Key |
| `AWS_SECRET_ACCESS_KEY` | `wJal...` | IAM Secret Key |
| `ECS_CLUSTER_NAME` | `gatrix-cluster` | ECS 클러스터 이름 |
| `ECS_BACKEND_SERVICE` | `gatrix-backend` | Backend 서비스 이름 |
| `ECS_FRONTEND_SERVICE` | `gatrix-frontend` | Frontend 서비스 이름 |
| `ECS_EDGE_SERVICE` | `gatrix-edge` | Edge 서비스 이름 |

### 자동 배포 트리거

`release_ecs` 브랜치에 push/merge하면 자동으로 배포됩니다.

배포 브랜치를 변경하려면 `.github/workflows/cd-ecs.yml`의 `branches` 항목을 수정하세요.

### 수동 배포

GitHub Actions → CD - ECS Deploy → Run workflow → 버전과 서비스 선택

---

## 🔍 서비스 아키텍처

```
                     ┌──────────────┐
                     │   Internet   │
                     └──────┬───────┘
                            │
                   ┌────────┴────────┐
                   │    AWS ALB      │
                   │  (Listener)     │
                   └────────┬────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │ /api/*           │ /edge/*           │ /*
  ┌──────┴───────┐   ┌──────┴───────┐   ┌──────┴───────┐
  │   Backend    │   │    Edge      │   │  Frontend    │
  │  (Fargate)   │   │  (Fargate)   │   │  (Fargate)   │
  │   :5000      │   │   :3400      │   │    :80       │
  └──────┬───────┘   └──────────────┘   └──────────────┘
         │
  ┌──────┴──────────────────┐
  │                         │
  ┌─────────────┐    ┌─────────────┐
  │  AWS RDS    │    │ ElastiCache │
  │  (MySQL)    │    │  (Redis)    │
  └─────────────┘    └─────────────┘

  ┌─────────────┐    ┌─────────────┐
  │ Prometheus  │───→│   Grafana   │
  │ (Fargate)   │    │ (Fargate)   │
  │ + EFS       │    │ + EFS       │
  └─────────────┘    └─────────────┘

  ┌─────────────────────────────┐
  │ AWS Cloud Map (gatrix.local)│
  │ backend.gatrix.local        │
  │ edge.gatrix.local           │
  │ prometheus.gatrix.local     │
  └─────────────────────────────┘
```

---

## 💰 비용 고려사항

### 월간 예상 비용 (서울 리전, 최소 구성)

| 서비스 | 스펙 | 월 예상 비용 (USD) |
|--------|------|--------------------|
| ECS Fargate | Backend + Edge + Frontend + Monitoring (4 태스크) | ~$55 |
| ALB | HTTPS 로드밸런서 + SSL 인증서 | ~$22 |
| VPC Endpoints | ECR, CloudWatch Logs, S3 (Gateway) | ~$22 |
| RDS MySQL | db.t4g.micro, 20GB | ~$15 |
| ElastiCache Redis | cache.t4g.micro, 1노드 | ~$12 |
| 기타 | CloudWatch Logs, Cloud Map, Route53 | ~$4 |
| S3 + CloudFront | 유저 트래픽에 비례 (변동) | ~$2+ |
| **합계** | | **~$132/월** |

> **비용 절감 팁:**
> - 개발/스테이징에서는 `--preset minimal`로 스케일 다운
> - Prometheus/Grafana를 CloudWatch로 대체하면 ~$20 절약
> - Savings Plans (1년 약정) 적용 시 Fargate ~20-30% 절감

---

## ⚠️ 주의사항

### 보안
1. **`.env`를 Git에 커밋하지 마세요** — 실제 비밀번호가 포함됩니다.
2. **AWS 시크릿 키를 코드에 하드코딩하지 마세요** — GitHub Secrets 또는 IAM 역할 사용.
3. **Secrets Manager의 시크릿은 CloudFormation에서 참조합니다** — `.env`를 변경해도 자동 반영 안 됨. `setup-secrets.ps1 -f`로 업데이트 필요.

### 네트워크
4. **VPC 내 RDS/ElastiCache**: ECS 태스크와 같은 VPC에 있어야 합니다. 다른 VPC의 경우 VPC Peering 필요.
5. **게임 서버 Redis 접근**: Redis Pub/Sub 통신을 위해 게임 서버에서 ElastiCache에 접근 가능해야 합니다.
6. **NAT Gateway 제거됨 (2026-04-16)**: 비용 절감을 위해 NAT Gateway를 제거하고 VPC Endpoint(ECR, S3, CloudWatch Logs)로 대체했습니다. Fargate 태스크가 VPC Endpoint로 커버되지 않는 외부 API에 접속해야 하는 경우 NAT Gateway를 다시 추가해야 합니다:
   ```bash
   # NAT Gateway 복원 방법
   # 1. Elastic IP 할당
   aws ec2 allocate-address --domain vpc --region ap-northeast-2
   # 2. NAT Gateway 생성 (Public 서브넷에)
   aws ec2 create-nat-gateway --subnet-id <public-subnet-id> --allocation-id <eip-alloc-id> --region ap-northeast-2
   # 3. Private 라우트 테이블에 0.0.0.0/0 -> NAT Gateway 경로 추가
   aws ec2 create-route --route-table-id <private-rt-id> --destination-cidr-block 0.0.0.0/0 --nat-gateway-id <nat-gw-id> --region ap-northeast-2
   ```

### 배포
7. **CloudFormation 스택은 순서가 중요합니다**: `00-vpc` → `01-sg` → `02-alb` → ... 순서로 생성해야 합니다. `deploy.sh`가 이를 자동으로 처리합니다.
8. **Task Definition은 immutable입니다**: 업데이트할 때마다 새 revision이 생성됩니다. 롤백은 이전 revision으로 돌아가는 것입니다.

### 비용
9. **teardown.sh는 모든 리소스를 삭제합니다**: VPC, ALB, 서비스 모두 삭제됩니다. 데이터는 RDS/ElastiCache에 보존됩니다.
10. **VPC Endpoint 비용**: Interface Endpoint는 개당 ~$7.30/월. S3 Gateway Endpoint는 무료입니다.

---

## 🔧 트러블슈팅

### 서비스가 시작되지 않을 때

```bash
# ECS 서비스 이벤트 확인
aws ecs describe-services --cluster gatrix-cluster --services gatrix-backend --query "services[0].events[:5]"

# 태스크 실패 사유 확인
aws ecs describe-tasks --cluster gatrix-cluster --tasks $(aws ecs list-tasks --cluster gatrix-cluster --service gatrix-backend --query "taskArns[0]" --output text)

# CloudWatch 로그 확인
./status.sh --logs backend
```

### ECR 이미지 풀 실패

```bash
# ECR 로그인 확인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 존재 확인
aws ecr describe-images --repository-name gatrix-backend --region ap-northeast-2
```

### CloudFormation 스택 생성 실패

```bash
# 실패 이벤트 확인
aws cloudformation describe-stack-events --stack-name gatrix-vpc --query "StackEvents[?ResourceStatus=='CREATE_FAILED']"
```

---

## 📖 English Version

- [English](README.en.md)
