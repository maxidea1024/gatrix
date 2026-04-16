# Gatrix AWS ECS Deployment Guide

This directory contains the **AWS ECS (Fargate)** deployment environment.

MySQL uses AWS RDS, Redis uses AWS ElastiCache.  
This folder only includes **application services + monitoring**.

---

## 📋 Differences from deploy-swarm

| Item | deploy-swarm/ (Swarm) | deploy-ecs/ (Here) |
|------|----------------------|-------------------|
| Orchestration | Docker Swarm | AWS ECS Fargate |
| Infrastructure | docker-compose.swarm.yml | CloudFormation (`cfn/`) |
| Container Registry | Tencent Cloud CR | **AWS ECR** |
| Load Balancer | External Cloud LB + Nginx | **AWS ALB** (built-in) |
| Service Discovery | Swarm Overlay DNS | AWS Cloud Map |
| Secret Management | Docker Secrets + .env | **AWS Secrets Manager** |
| Logging | json-file (local) | **CloudWatch Logs** |
| Monitoring | Prometheus + Grafana (Swarm) | CloudWatch Insights + Prometheus/Grafana (ECS) |
| Scaling | `docker service scale` | ECS Auto Scaling + `aws ecs update-service` |
| CI/CD | None (manual) | **GitHub Actions** (`cd-ecs.yml`) |

## 📦 Included Services

- **backend** — Gatrix API server
- **frontend** — Gatrix web frontend (Nginx)
- **edge** — Edge cache server (behind ALB)
- **prometheus** — Metrics collection (ECS Fargate + EFS)
- **grafana** — Monitoring dashboard (ECS Fargate + EFS)

---

## 🔧 Prerequisites

### 1. AWS Account

Create an AWS account if you don't have one: https://aws.amazon.com/

### 2. Install AWS CLI

```bash
# macOS
brew install awscli

# Windows
# Download and run: https://awscli.amazonaws.com/AWSCLIV2.msi

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

Verify installation:
```bash
aws --version
# aws-cli/2.x.x ...
```

### 3. Configure AWS CLI Authentication

```bash
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: ap-northeast-2
# Default output format: json
```

> **Tip for beginners**: AWS Console → IAM → Users → Security credentials → Create access key

### 4. Required IAM Permissions

The IAM user/role running the deployment needs these permissions:

| Service | Required Permissions | Purpose |
|---------|---------------------|---------|
| CloudFormation | `cloudformation:*` | Create/modify/delete infrastructure |
| ECS | `ecs:*` | Service management |
| ECR | `ecr:*` | Push/pull images |
| EC2 | `ec2:*` (VPC-related) | VPC, SG, Subnet creation |
| ELB | `elasticloadbalancing:*` | ALB management |
| IAM | `iam:CreateRole`, `iam:PutRolePolicy`, `iam:PassRole` | ECS role creation |
| CloudWatch | `logs:*` | Log group management |
| Secrets Manager | `secretsmanager:*` | Secret management |
| Service Discovery | `servicediscovery:*` | Cloud Map management |
| EFS | `elasticfilesystem:*` | Monitoring storage |
| Auto Scaling | `application-autoscaling:*` | Service scaling |

> **Quick start**: Use `AdministratorAccess` policy initially, then switch to least-privilege after stabilization.

### 5. Install Docker

Required for building images:
- Windows: https://docs.docker.com/desktop/install/windows-install/
- macOS: https://docs.docker.com/desktop/install/mac-install/
- Linux: https://docs.docker.com/engine/install/

### 6. Install jq (for Bash scripts)

```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq  # Ubuntu/Debian
sudo yum install jq      # Amazon Linux/CentOS
```

---

## 🚀 Quick Start (Step-by-Step)

### Step 1: Configure Environment

```bash
cd deploy-ecs
cp .env.example .env
vi .env  # or: code .env (VS Code)
```

**Must-set values:**
```
AWS_ACCOUNT_ID=123456789012
AWS_REGION=ap-northeast-2

DB_HOST=your-rds-host.amazonaws.com
DB_USER=gatrix_user
DB_PASSWORD=your-secure-password

REDIS_HOST=your-redis.cache.amazonaws.com
REDIS_PASSWORD=your-redis-password

EDGE_REDIS_HOST=your-redis.cache.amazonaws.com
EDGE_REDIS_PASSWORD=your-redis-password
```

> **Find your AWS Account ID**: `aws sts get-caller-identity --query Account --output text`

### Step 2: Generate Security Keys

```bash
# Linux/macOS
./generate-secrets.sh --env

# Windows PowerShell
./generate-secrets.ps1 --env

# Copy the output values to your .env file
```

### Step 3: Store Secrets in AWS Secrets Manager

```bash
./setup-secrets.sh             # Linux/macOS
./setup-secrets.ps1            # Windows PowerShell
```

### Step 4: Build and Push Docker Images to ECR

```bash
# Grant execute permissions (Linux/macOS)
chmod +x *.sh

# Build all services and push to ECR
./build-and-push.sh -t v1.0.0 -l -p   # Linux/macOS
./build-and-push.ps1 -t v1.0.0 -l -p  # Windows
```

### Step 5: First Deployment

```bash
# Deploy full infrastructure + services (~15-20 minutes)
./deploy.sh -v v1.0.0 -i       # Linux/macOS
./deploy.ps1 -v v1.0.0 -i      # Windows
```

This creates, in order: VPC → Security Groups → ALB → ECS Cluster → Cloud Map → Task Definitions → ECS Services → Monitoring.

### Step 6: Health Check

```bash
./health-check.sh              # Linux/macOS
./health-check.ps1             # Windows
```

---

## 🛠️ Operations Guide

### Rolling Update

```bash
./update.sh -v 1.1.0 --all                # All services
./update.sh -v 1.1.0 --service backend     # Specific service
```

### Rollback

```bash
./rollback.sh --service backend            # Rollback to previous revision
./rollback.sh --all                        # Rollback all services
```

### Scaling

```bash
./scale.sh --preset minimal               # backend:1  frontend:1  edge:1
./scale.sh --preset standard              # backend:2  frontend:1  edge:2
./scale.sh --preset high                  # backend:4  frontend:2  edge:8
./scale.sh --service backend --replicas 4 # Individual scaling
./scale.sh --status                       # Current status
```

### Status

```bash
./status.sh                               # Full status
./status.sh --health                      # Health status
./status.sh --logs backend                # CloudWatch logs (live)
```

### Teardown

```bash
./teardown.sh                             # Delete CloudFormation stacks only
./teardown.sh --all                       # Delete everything (stacks + secrets + logs)
./teardown.sh --all -y                    # Delete without confirmation
```

---

## 🔀 GitHub Actions CI/CD

### Setup

1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add these secrets:

| Secret Name | Example | Description |
|-------------|---------|-------------|
| `AWS_ACCOUNT_ID` | `123456789012` | AWS Account ID |
| `AWS_REGION` | `ap-northeast-2` | AWS Region |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | IAM Access Key |
| `AWS_SECRET_ACCESS_KEY` | `wJal...` | IAM Secret Key |
| `ECS_CLUSTER_NAME` | `gatrix-cluster` | ECS Cluster Name |
| `ECS_BACKEND_SERVICE` | `gatrix-backend` | Backend Service Name |
| `ECS_FRONTEND_SERVICE` | `gatrix-frontend` | Frontend Service Name |
| `ECS_EDGE_SERVICE` | `gatrix-edge` | Edge Service Name |

### Auto-Deploy

Push/merge to `release_ecs` branch triggers automatic deployment.

To change the deployment branch, edit `branches` in `.github/workflows/cd-ecs.yml`.

### Manual Deploy

GitHub Actions → CD - ECS Deploy → Run workflow → Select version and services.

---

## 🔍 Architecture

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

## 💰 Cost Estimates

### Monthly cost (Seoul region, minimum configuration)

| Service | Spec | Est. Monthly (USD) |
|---------|------|--------------------|
| ECS Fargate (backend ×2) | 0.5 vCPU, 1GB | ~$30 |
| ECS Fargate (frontend ×2) | 0.25 vCPU, 0.5GB | ~$15 |
| ECS Fargate (edge ×2) | 0.25 vCPU, 0.5GB | ~$15 |
| ECS Fargate (prometheus ×1) | 0.5 vCPU, 1GB | ~$15 |
| ECS Fargate (grafana ×1) | 0.25 vCPU, 0.5GB | ~$8 |
| ALB | Base | ~$16 + LCUs |
| NAT Gateway | 1x | ~$32 + data transfer |
| CloudWatch Logs | Base | ~$5 |
| EFS | Base | ~$1 |
| **Total** | | **~$137/mo + data transfer** |

> **Cost-saving tips:**
> - Use `--preset minimal` for dev/staging
> - NAT Gateway is the largest cost — share with existing VPC if possible
> - Replace Prometheus/Grafana with CloudWatch to save ~$23

---

## 🔧 Troubleshooting

### Service won't start

```bash
# Check ECS service events
aws ecs describe-services --cluster gatrix-cluster --services gatrix-backend --query "services[0].events[:5]"

# Check task failure reason
aws ecs describe-tasks --cluster gatrix-cluster --tasks $(aws ecs list-tasks --cluster gatrix-cluster --service gatrix-backend --query "taskArns[0]" --output text)

# Check CloudWatch logs
./status.sh --logs backend
```

### ECR image pull failure

```bash
# Verify ECR login
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com

# Check image exists
aws ecr describe-images --repository-name gatrix-backend --region ap-northeast-2
```

### CloudFormation stack creation failed

```bash
# Show failure events
aws cloudformation describe-stack-events --stack-name gatrix-vpc --query "StackEvents[?ResourceStatus=='CREATE_FAILED']"
```

---

## 📖 한국어 버전

- [한국어](README.md)
