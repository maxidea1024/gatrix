# Gatrix - 간편 설치 가이드

몇 분 안에 Gatrix를 실행하세요!

## 사전 요구사항

시작하기 전에 다음 항목이 설치되어 있는지 확인하세요:

- **Docker** 및 **Docker Compose**
- **Node.js** (v22 LTS 이상)
- **Yarn** (v1.22 이상)

### Docker 설치

#### Ubuntu/Debian

```bash
# 패키지 매니저 업데이트
sudo apt-get update

# Docker 설치
sudo apt-get install -y docker.io

# Docker Compose 설치
sudo apt-get install -y docker-compose

# 현재 사용자를 docker 그룹에 추가 (선택사항, sudo 없이 실행하기 위함)
sudo usermod -aG docker $USER

# 그룹 변경사항 적용
newgrp docker

# 설치 확인
docker --version
docker-compose --version
```

#### Windows

1. **Windows용 Docker Desktop 다운로드:**
   - https://www.docker.com/products/docker-desktop 방문
   - "Download for Windows" 클릭

2. **Docker Desktop 설치:**
   - 설치 프로그램 실행
   - 설치 마법사 따라하기
   - 요청 시 컴퓨터 재시작

3. **설치 확인:**
   - PowerShell을 열고 실행:
   ```powershell
   docker --version
   docker-compose --version
   ```

4. **WSL 2 활성화 (아직 활성화되지 않은 경우):**
   - Docker Desktop이 WSL 2 활성화를 요청합니다
   - 화면의 지시사항을 따르세요
   - WSL 2 활성화 후 Docker Desktop 재시작

## 빠른 시작

### 환경 선택

**개발 환경** (로컬 개발용):
- `docker-compose.dev.yml` 사용
- 핫 리로드 및 디버깅 도구 포함
- 개발 및 테스트에 적합

**프로덕션 환경** (배포용):
- `docker-compose.yml` 사용
- 성능 및 보안 최적화
- 프로덕션 배포에 적합

### 1단계: 설정 파일 생성

설정 스크립트를 실행하여 보안 암호화 키가 포함된 `.env` 파일을 자동으로 생성합니다.

**개발 환경 (Linux/Mac):**
```bash
./setup-env.sh localhost development
```

**개발 환경 (Windows PowerShell):**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development
```

**프로덕션 환경 (Linux/Mac):**
```bash
# 영어 (기본값)
./setup-env.sh example.com production

# 중국어 (중국 배포용)
./setup-env.sh example.cn production zh
```

**프로덕션 환경 (Windows PowerShell):**
```powershell
# 영어 (기본값)
.\setup-env.ps1 -HostAddress example.com -Environment production

# 중국어 (중국 배포용)
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh
```

**사용자 정의 옵션:**

**관리자 비밀번호 지정 (Linux/Mac):**
```bash
./setup-env.sh localhost development ko --admin-password "MySecurePassword123"
```

**관리자 비밀번호 지정 (Windows PowerShell):**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -AdminPassword "MySecurePassword123"
```

**프로토콜 지정 (Linux/Mac):**
```bash
# 개발 환경에서 HTTPS 사용
./setup-env.sh localhost development ko --protocol https

# 프로덕션 환경에서 HTTP 사용 (테스트용)
./setup-env.sh example.com production en --protocol http

# 중국 배포용 중국어 설정
./setup-env.sh example.cn production zh --protocol http
```

**프로토콜 지정 (Windows PowerShell):**
```powershell
# 개발 환경에서 HTTPS 사용
.\setup-env.ps1 -HostAddress localhost -Environment development -Protocol https

# 프로덕션 환경에서 HTTP 사용 (테스트용)
.\setup-env.ps1 -HostAddress example.com -Environment production -Protocol http

# 중국 배포용 중국어 설정
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh -Protocol http
```

**Service Discovery 모드 지정 (Linux/Mac):**
```bash
# Redis 모드 사용
./setup-env.sh localhost development ko --service-discovery-mode redis

# etcd 모드 사용 (기본값)
./setup-env.sh localhost development ko --service-discovery-mode etcd
```

**Service Discovery 모드 지정 (Windows PowerShell):**
```powershell
# Redis 모드 사용
.\setup-env.ps1 -HostAddress localhost -Environment development -ServiceDiscoveryMode redis

# etcd 모드 사용 (기본값)
.\setup-env.ps1 -HostAddress localhost -Environment development -ServiceDiscoveryMode etcd
```

**데이터 루트 경로 지정 (Linux/Mac):**
```bash
# 모든 Docker 볼륨 데이터를 /data/gatrix에 저장
./setup-env.sh example.com production en --data-root /data/gatrix

# 개발용 사용자 정의 경로
./setup-env.sh localhost development ko --data-root ./my-data
```

**데이터 루트 경로 지정 (Windows PowerShell):**
```powershell
# 모든 Docker 볼륨 데이터를 /data/gatrix에 저장
.\setup-env.ps1 -HostAddress example.com -Environment production -DataRoot /data/gatrix

# 개발용 사용자 정의 경로
.\setup-env.ps1 -HostAddress localhost -Environment development -DataRoot ./my-data
```

스크립트는 다음을 수행합니다:
- 보안 암호화 키 자동 생성
- Docker용 데이터베이스 및 Redis 설정
- 기본 언어 설정 (한국어 `ko`, 영어 `en`, 중국어 `zh`)
- 관리자 비밀번호 설정 (기본값: admin123, 또는 사용자 지정)
- 프로토콜 설정 (기본값: 개발 환경은 http, 프로덕션은 https)
- Service Discovery 모드 설정 (기본값: etcd, 옵션: redis)
- 데이터 루트 경로 설정 (기본값: 개발 환경은 ./data, 프로덕션은 /data/gatrix)
- `.env` 파일이 이미 존재하면 백업 생성
- 환경에 따라 올바른 docker-compose 파일 자동 선택

**지원 언어:**
- `ko` - 한국어 - 개발 환경 기본값
- `en` - English (영어) - 프로덕션 환경 기본값
- `zh` - 中文 (중국어) - 중국 배포용

### 2단계: Docker 환경 빌드

**개발 환경:**
```bash
docker-compose -f docker-compose.dev.yml build
```

**프로덕션 환경:**
```bash
docker-compose -f docker-compose.yml build
```

### 3단계: 서비스 시작

**개발 환경:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**프로덕션 환경:**
```bash
docker-compose -f docker-compose.yml up -d
```

모든 서비스가 준비될 때까지 기다립니다 (보통 30-60초).

### 4단계: 설치 확인

**개발 환경:**
```bash
docker-compose -f docker-compose.dev.yml ps
```

**프로덕션 환경:**
```bash
docker-compose -f docker-compose.yml ps
```

모든 컨테이너의 상태가 "Up"으로 표시되어야 합니다.

### 5단계: 애플리케이션 접속

브라우저를 열고 다음 주소로 이동하세요:

**개발 환경:**
```
http://localhost:53000
```

**프로덕션 (HTTPS - 기본값):**
```
https://example.com
```

**프로덕션 (HTTP - --protocol http로 설정한 경우):**
```
http://example.com
```

(`example.com`을 실제 도메인으로 변경하세요)

**중요:** 프로덕션 환경에서는 표준 포트(HTTP: 80, HTTPS: 443)를 사용하므로 URL에 포트 번호가 포함되지 않습니다. 클라우드 로드 밸런서가 443 → 53000으로 포워딩합니다.

## 기본 인증 정보

- **관리자 이메일:** admin@gatrix.com
- **관리자 비밀번호:** admin123 (프로덕션에서는 반드시 변경하세요!)

## 다음 단계

1. **클라우드 로드 밸런서 설정** (프로덕션 환경):

   프로덕션 환경에서는 클라우드 로드 밸런서를 통해 HTTPS를 처리하고 내부 포트로 포워딩해야 합니다.

   **포트 포워딩 설정:**
   ```
   외부 HTTPS 443 → 내부 53000 (Frontend + Bull Board)
   외부 HTTPS 443/grafana → 내부 54000 (Grafana)
   ```

   **중요:**
   - Grafana만 별도 포트(54000) 포워딩 필요
   - Bull Board는 Frontend(53000)와 동일 포트 사용 - 별도 포워딩 불필요

   **텐센트 클라우드 CLB 예시:**
   - 리스너: HTTPS:443 (SSL 인증서 연결)
   - 전달 규칙 1: URL = `/grafana*` → 백엔드 서버: CVM:54000 (Grafana 전용)
   - 전달 규칙 2: URL = `/*` → 백엔드 서버: CVM:53000 (Frontend + Bull Board)
   - X-Forwarded-For: 활성화
   - 참고: `/bull-board` 경로는 규칙 2로 처리됨 (별도 규칙 불필요)

   **AWS Application Load Balancer 예시:**
   - Listener: HTTPS:443 (SSL 인증서 연결)
   - Rule 1: Path = `/grafana*` → Target Group: EC2:54000 (Grafana 전용)
   - Rule 2: Path = `/*` → Target Group: EC2:53000 (Frontend + Bull Board)
   - 참고: `/bull-board` 경로는 Rule 2로 처리됨 (별도 규칙 불필요)

   **Nginx Reverse Proxy 예시:**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name example.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       # Grafana (별도 포트 포워딩)
       location /grafana/ {
           proxy_pass http://localhost:54000/;
           proxy_set_header X-Forwarded-Proto https;
       }

       # Frontend + Bull Board (동일 포트)
       # /bull-board 경로는 Frontend Nginx에서 처리됨
       location / {
           proxy_pass http://localhost:53000;
           proxy_set_header X-Forwarded-Proto https;
       }
   }
   ```

2. **Grafana URL 설정** (개발 환경):
   - `.env` 파일 편집
   - `VITE_GRAFANA_URL`을 Grafana 서버 주소에 맞게 업데이트
   - 개발 환경 기본값: `http://localhost:54000`
   - 프로덕션 환경: `https://example.com/grafana` (자동 설정됨)
   - 서비스 재시작:

   **개발 환경:**
   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend-dev
   ```

   **프로덕션 환경:**
   ```bash
   docker-compose -f docker-compose.yml restart frontend
   ```

3. **채팅 서버 URL 설정** (선택사항):
   - `.env` 파일 편집
   - 채팅 서버가 다른 도메인에 있는 경우 `VITE_CHAT_SERVER_URL` 업데이트
   - 채팅 서버가 비표준 포트를 사용하는 경우 `VITE_CHAT_SERVER_PORT` 업데이트 (기본값: 55100)
   - 서비스 재시작:

   **개발 환경:**
   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend-dev
   ```

   **프로덕션 환경:**
   ```bash
   docker-compose -f docker-compose.yml restart frontend
   ```

4. **OAuth 인증 정보 업데이트** (선택사항):
   - `.env` 파일 편집
   - Google 및 GitHub OAuth 인증 정보 추가
   - 서비스 재시작:

   **개발 환경:**
   ```bash
   docker-compose -f docker-compose.dev.yml restart
   ```

   **프로덕션 환경:**
   ```bash
   docker-compose -f docker-compose.yml restart
   ```

5. **로그 확인**:

   **개발 환경:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f backend
   ```

   **프로덕션 환경:**
   ```bash
   docker-compose -f docker-compose.yml logs -f backend
   ```

6. **서비스 중지**:

   **개발 환경:**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

   **프로덕션 환경:**
   ```bash
   docker-compose -f docker-compose.yml down
   ```

## 문제 해결

### 포트가 이미 사용 중

"port already in use" 오류가 발생하면:
- 해당 포트를 사용하는 서비스를 중지하거나
- docker-compose 파일에서 포트를 수정하세요:
  - 개발 환경: `docker-compose.dev.yml`
  - 프로덕션 환경: `docker-compose.yml`

### 서비스가 시작되지 않음

로그를 확인하세요:

**개발 환경:**
```bash
docker-compose -f docker-compose.dev.yml logs
```

**프로덕션 환경:**
```bash
docker-compose -f docker-compose.yml logs
```


### Docker 데몬이 실행되지 않음

Docker가 실행 중인지 확인하세요:

**Linux:**
```bash
sudo systemctl start docker
```

**Windows:**
- Docker Desktop 애플리케이션 열기
- 완전히 시작될 때까지 대기

### Grafana 대시보드 iframe 임베딩 문제

다음 오류가 표시되는 경우: `Refused to display 'http://localhost:54000/' in a frame because it set 'X-Frame-Options' to 'deny'`

이는 Grafana의 보안 설정이 iframe 임베딩을 방지할 때 발생합니다. 해결 방법:

1. **docker-compose.dev.yml 업데이트** - Grafana 서비스에 다음 환경 변수 추가:
   ```yaml
   environment:
     GF_SECURITY_ALLOW_EMBEDDING: "true"
     GF_SECURITY_COOKIE_SAMESITE: "Lax"
   ```

2. **Docker 컨테이너 재시작:**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **브라우저 새로고침** 후 **관리자 패널 > 모니터링 > Grafana 대시보드**로 이동

이제 Grafana 대시보드가 iframe 내에서 정상적으로 로드됩니다.

### 도움이 필요하신가요?

더 자세한 정보와 고급 설정 옵션은 메인 [README.md](README.md)를 참조하세요.

## Jenkins 설정 (CI/CD 파이프라인)

자동화된 빌드 및 배포를 위해 제공된 설정 스크립트로 Jenkins를 설정할 수 있습니다.

### Jenkins 사전 요구사항

- Jenkins 서버 설치 및 실행 중
- Jenkins에 Git 플러그인 설치
- Jenkins 에이전트/서버에 Node.js 22 LTS 설치
- Jenkins 에이전트/서버에 Docker 설치 (Docker 빌드용)

### Jenkins 설정 스크립트 사용

프로젝트의 `scripts/` 디렉토리에 Jenkins 설정 스크립트가 포함되어 있습니다:

**Linux/Mac:**
```bash
./scripts/setup.sh
```

**Windows PowerShell:**
```powershell
.\scripts\setup.ps1
```

이 스크립트는 다음을 수행합니다:
- Node.js 22 LTS 설치 확인
- 필요한 의존성 설치
- 환경 변수 설정
- 데이터베이스 연결 설정
- 애플리케이션 초기화

### Jenkins 파이프라인 설정

1. **Jenkins에서 새 Pipeline 작업 생성**
2. **Git 저장소 설정:**
   - Repository URL: Git 저장소 URL
   - Branch: `main` (또는 기본 브랜치)

3. **파이프라인 스크립트:**
   ```groovy
   pipeline {
     agent any

     environment {
       // 프로덕션 호스트 주소 설정
       HOST_ADDRESS = 'example.com'
       ENVIRONMENT = 'production'
       PROTOCOL = 'http' // 또는 보안 연결을 위해 'https'
       DEFAULT_LANGUAGE = 'en' // ko, en, 또는 zh
       ADMIN_PASSWORD = credentials('gatrix-admin-password') // Jenkins credentials에 저장
     }

     stages {
       stage('Generate Configuration') {
         steps {
           sh '''
             # 프로덕션 설정으로 .env 파일 생성
             ./setup-env.sh ${HOST_ADDRESS} ${ENVIRONMENT} ${DEFAULT_LANGUAGE} \
               --admin-password "${ADMIN_PASSWORD}" \
               --protocol ${PROTOCOL} \
               --force \
               --nobackup
           '''
         }
       }

       stage('Setup Dependencies') {
         steps {
           sh './scripts/setup.sh'
         }
       }

       stage('Build') {
         steps {
           sh 'yarn build'
         }
       }

       stage('Test') {
         steps {
           sh 'yarn test'
         }
       }

       stage('Deploy') {
         steps {
           sh 'docker-compose -f docker-compose.yml up -d --build'
         }
       }
     }

     post {
       success {
         echo 'Deployment successful!'
       }
       failure {
         echo 'Deployment failed!'
       }
     }
   }
   ```

4. **Jenkins Credentials 설정:**
   - Jenkins > Credentials > System > Global credentials로 이동
   - 새 "Secret text" credential 추가:
     - ID: `gatrix-admin-password`
     - Secret: 관리자 비밀번호
     - Description: Gatrix Admin Password

5. **웹훅 설정** (선택사항):
   - GitHub/GitLab 웹훅을 설정하여 푸시 시 자동으로 빌드 트리거


### Jenkins 중요 사항

- **환경 변수:** 파이프라인 스크립트에서 다음을 설정하세요:
  - `HOST_ADDRESS`: 프로덕션 도메인 (예: `example.com`)
  - `ENVIRONMENT`: `development` 또는 `production`
  - `PROTOCOL`: `http` (기본값) 또는 `https` (보안 연결용)
  - `DEFAULT_LANGUAGE`: `ko`, `en`, 또는 `zh`
  - `ADMIN_PASSWORD`: Jenkins credentials에 저장 (4단계 참조)

- **관리자 비밀번호:** 보안을 위해 Jenkins credentials에 관리자 비밀번호 저장
- **Force 플래그:** `--force` 플래그는 각 빌드마다 기존 `.env` 파일을 덮어씁니다
- **NoBackup 플래그:** `--nobackup` 플래그는 CI/CD 환경에서 백업 파일 생성을 방지합니다

### 설정 예시

**프로덕션 HTTP (기본값):**
```groovy
environment {
  HOST_ADDRESS = 'example.com'
  ENVIRONMENT = 'production'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'en'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**프로덕션 HTTPS (보안):**
```groovy
environment {
  HOST_ADDRESS = 'example.com'
  ENVIRONMENT = 'production'
  PROTOCOL = 'https'
  DEFAULT_LANGUAGE = 'en'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**중국 프로덕션 (중국어):**
```groovy
environment {
  HOST_ADDRESS = 'example.cn'
  ENVIRONMENT = 'production'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'zh'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**개발 환경 (한국어):**
```groovy
environment {
  HOST_ADDRESS = 'dev.example.com'
  ENVIRONMENT = 'development'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'ko'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

### Jenkins 설정 문제 해결

- **Node.js를 찾을 수 없음:** Jenkins 에이전트에 Node.js 22 LTS가 설치되어 있는지 확인
- **권한 거부됨:** 스크립트에 실행 권한이 있는지 확인: `chmod +x setup-env.sh scripts/setup.sh`
- **Docker를 사용할 수 없음:** Jenkins 에이전트에 Docker를 설치하거나 Docker-in-Docker 사용
- **.env 파일 문제:** setup-env.sh 오류는 Jenkins 콘솔 출력에서 확인

## 설정 강제 덮어쓰기

`.env` 파일을 재생성해야 하는 경우:

**개발 환경 (Linux/Mac):**
```bash
./setup-env.sh localhost development --force
```

**개발 환경 (Windows PowerShell):**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -Force
```

**프로덕션 환경 (Linux/Mac):**
```bash
./setup-env.sh example.com production --force
```

**프로덕션 환경 (Windows PowerShell):**
```powershell
.\setup-env.ps1 -HostAddress example.com -Environment production -Force
```

**사용자 정의 옵션:**

**관리자 비밀번호 지정 (Linux/Mac):**
```bash
./setup-env.sh localhost development ko --admin-password "NewPassword123" --force
```

**관리자 비밀번호 지정 (Windows PowerShell):**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -AdminPassword "NewPassword123" -Force
```

**프로토콜 지정 (Linux/Mac):**
```bash
# 한국어로 HTTPS
./setup-env.sh localhost development ko --protocol https --force

# 중국어로 HTTP
./setup-env.sh example.cn production zh --protocol http --force
```

**프로토콜 지정 (Windows PowerShell):**
```powershell
# 한국어로 HTTPS
.\setup-env.ps1 -HostAddress localhost -Environment development -Protocol https -Force

# 중국어로 HTTP
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh -Protocol http -Force
```

다음을 수행합니다:
- 기존 `.env` 파일 백업 (`.env.backup.TIMESTAMP`)
- 새 암호화 키 생성
- 새 관리자 비밀번호 설정 (제공된 경우)
- 프로토콜 설정 (제공된 경우)
- 설정 파일 재생성

## 완전 초기화 (처음부터 시작)

애플리케이션을 완전히 초기화하고 새로 시작해야 하는 경우:

### 1단계: 모든 컨테이너 중지 및 제거

**개발 환경:**
```bash
docker-compose -f docker-compose.dev.yml down -v
```

**프로덕션 환경:**
```bash
docker-compose -f docker-compose.yml down -v
```

`-v` 플래그는 모든 볼륨(데이터베이스, 캐시 등)을 제거합니다.

### 2단계: Docker 이미지 제거 (선택사항)

처음부터 모든 것을 다시 빌드하려면:

**개발 환경:**
```bash
docker-compose -f docker-compose.dev.yml down -v --rmi all
```

**프로덕션 환경:**
```bash
docker-compose -f docker-compose.yml down -v --rmi all
```

### 3단계: 설정 파일 삭제

```bash
rm .env
```

또는 먼저 백업:
```bash
mv .env .env.old
```

### 4단계: 새로 시작

처음부터 **빠른 시작** 섹션을 따라하세요:

1. 새 설정 생성:
   ```bash
   # 개발 환경 (한국어)
   ./setup-env.sh localhost development

   # 프로덕션 환경 (영어)
   ./setup-env.sh example.com production

   # 프로덕션 환경 (중국 배포용 중국어)
   ./setup-env.sh example.cn production zh
   ```

2. Docker 환경 빌드:
   ```bash
   # 개발 환경
   docker-compose -f docker-compose.dev.yml build

   # 프로덕션 환경
   docker-compose -f docker-compose.yml build
   ```

3. 서비스 시작:
   ```bash
   # 개발 환경
   docker-compose -f docker-compose.dev.yml up -d

   # 프로덕션 환경
   docker-compose -f docker-compose.yml up -d
   ```

4. 설치 확인:
   ```bash
   # 개발 환경
   docker-compose -f docker-compose.dev.yml ps

   # 프로덕션 환경
   docker-compose -f docker-compose.yml ps
   ```

### 초기화되는 항목

- ✅ 모든 Docker 컨테이너
- ✅ 모든 볼륨 (데이터베이스, Redis 캐시)
- ✅ 모든 Docker 이미지 (`--rmi all` 사용 시)
- ✅ 설정 파일 (`.env`)

### 초기화되지 않는 항목

- ❌ 소스 코드 파일
- ❌ 백업 파일 (`.env.backup.*`)
- ❌ 로컬 git 히스토리

### 경고

**이것은 파괴적인 작업입니다!** 데이터베이스와 캐시의 모든 데이터가 영구적으로 삭제됩니다. 진행하기 전에 중요한 데이터를 백업하세요.

---

**즐거운 코딩 되세요! 🚀**
