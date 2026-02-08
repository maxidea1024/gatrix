# Gatrix Chat Server

고성능 스케일링 가능한 실시간 채팅 서버입니다. 100만 동시 사용자를 수용할 수 있도록 설계되었습니다.

## 🚀 주요 기능

### 📡 실시간 통신

- **Socket.IO 기반** WebSocket 서버
- **Redis Adapter**를 통한 다중 인스턴스 동기화
- **JWT 인증** 및 **Rate Limiting**
- **타이핑 인디케이터** 및 **사용자 상태**

### ⚡ 고성능 아키텍처

- **클러스터링**: CPU 코어 수만큼 워커 프로세스 생성
- **수평 확장**: 무제한 서버 인스턴스 추가 가능
- **로드 밸런싱**: HAProxy를 통한 Sticky Session 지원
- **Redis 클러스터**: 고가용성 캐싱 및 세션 관리

### 🔄 메시지 브로드캐스팅 최적화

- **배치 처리**: 1000개씩 메시지 배치 전송
- **압축**: MessagePack + gzip으로 대역폭 70% 절약
- **캐싱**: LRU 캐시로 중복 메시지 처리 최적화
- **샤딩**: 채널별 샤딩으로 부하 분산

### 🗄️ 데이터베이스 최적화

- **파티셔닝**: 시간/해시 기반 테이블 파티셔닝
- **인덱싱**: 쿼리 성능 최적화 인덱스
- **연결 풀링**: 효율적인 데이터베이스 연결 관리
- **마이그레이션**: Knex.js 기반 스키마 관리

### 📊 모니터링 및 메트릭

- **Prometheus**: 실시간 성능 지표 수집
- **Grafana**: 시각화 대시보드
- **헬스 체크**: 서버 상태 모니터링
- **로깅**: 구조화된 로그 시스템

## 🏗️ 아키텍처

```
[Load Balancer (HAProxy)]
         │
    ┌────┴────┐
    │ Sticky  │
    │ Session │
    └────┬────┘
         │
    ┌────┴────────────────────┐
    │                         │
[Chat-Server-1]         [Chat-Server-N]
    │                         │
    └─────┬───────────────────┘
          │
    [Redis Cluster]
    [MySQL Cluster]
```

## 📈 성능 지표

- **동시 연결**: 인스턴스당 10,000 연결
- **메시지 처리량**: 100,000+ 메시지/초
- **브로드캐스트 지연**: < 10ms
- **메모리 사용량**: 인스턴스당 1GB 제한
- **확장성**: 100만 동시 사용자 지원

## 🛠️ 기술 스택

- **Runtime**: Node.js 18+ with TypeScript
- **WebSocket**: Socket.IO with Redis Adapter
- **Database**: MySQL 8.0 with Knex.js ORM
- **Cache**: Redis 7.0 with Clustering
- **Load Balancer**: HAProxy 2.8
- **Monitoring**: Prometheus + Grafana
- **Containerization**: Docker + Docker Compose

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd packages/chat-server

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 설정 값 입력

# 의존성 설치
npm install
```

### 2. 개발 환경 실행

> **Note**: Docker Compose v2+ 사용 시 `docker compose` 명령어를 사용하세요 (하이픈 없음).

```bash
# 개발 서버 시작 (로컬)
npm run dev

# 또는 Docker Compose로 전체 스택 실행 (프로덕션)
docker compose up -d

# 개발 환경 (hot reload)
docker compose -f docker-compose.dev.yml up -d chat-server-dev
```

### 3. 프로덕션 배포

```bash
# 배포 스크립트 실행
chmod +x scripts/deploy.sh
./scripts/deploy.sh deploy
```

## 📝 API 문서

### REST API 엔드포인트

#### 채널 관리

- `GET /api/v1/channels` - 사용자 채널 목록
- `POST /api/v1/channels` - 채널 생성
- `GET /api/v1/channels/:id` - 채널 정보 조회
- `PUT /api/v1/channels/:id` - 채널 정보 수정
- `DELETE /api/v1/channels/:id` - 채널 삭제

#### 메시지 관리

- `GET /api/v1/messages/channel/:channelId` - 채널 메시지 목록
- `POST /api/v1/messages` - 메시지 전송
- `GET /api/v1/messages/:id` - 메시지 조회
- `PUT /api/v1/messages/:id` - 메시지 수정
- `DELETE /api/v1/messages/:id` - 메시지 삭제

### WebSocket 이벤트

#### 클라이언트 → 서버

- `join_channel` - 채널 참여
- `leave_channel` - 채널 나가기
- `send_message` - 메시지 전송
- `typing_start` - 타이핑 시작
- `typing_stop` - 타이핑 중지

#### 서버 → 클라이언트

- `message` - 새 메시지
- `user_joined` - 사용자 참여
- `user_left` - 사용자 나감
- `typing` - 타이핑 상태
- `presence_update` - 사용자 상태 변경

## 🔧 설정

### 환경 변수

```bash
# 서버 설정
NODE_ENV=production
PORT=5100
HOST=0.0.0.0

# 데이터베이스
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gatrix_chat
DB_USER=chat_user
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Gatrix 연동
GATRIX_API_URL=http://localhost:3000
GATRIX_API_SECRET=shared_secret

# 성능 튜닝
CLUSTER_ENABLED=true
WS_MAX_CONNECTIONS=10000
BROADCAST_BATCH_SIZE=1000
```

### 클러스터링 설정

```typescript
// 자동 클러스터링 (CPU 코어 수만큼)
CLUSTER_WORKERS = 0;

// 수동 클러스터링
CLUSTER_WORKERS = 4;
```

## 📊 모니터링

### Prometheus 메트릭

- `chat_messages_total` - 총 메시지 수
- `chat_connections_active` - 활성 연결 수
- `chat_channels_active` - 활성 채널 수
- `chat_broadcast_latency` - 브로드캐스트 지연시간

### Grafana 대시보드

- **실시간 연결 상태**
- **메시지 처리량**
- **서버 리소스 사용량**
- **에러율 및 응답시간**

접속: http://localhost:3000 (admin/admin)

## 🔒 보안

### 인증 및 권한

- JWT 토큰 기반 인증
- Gatrix 메인 서버와 토큰 검증 연동
- Rate Limiting으로 DDoS 방지

### 데이터 보호

- HTTPS/WSS 암호화 통신
- 입력 데이터 검증 및 새니타이징
- SQL Injection 방지

## 🧪 테스트

```bash
# 단위 테스트
npm test

# 통합 테스트
npm run test:integration

# 성능 테스트
npm run test:performance

# 커버리지 확인
npm run test:coverage
```

## 📦 배포

### Docker 배포

```bash
# 이미지 빌드
docker build -t gatrix-chat-server .

# 컨테이너 실행
docker run -d \
  --name chat-server \
  -p 3001:3001 \
  -e NODE_ENV=production \
  gatrix-chat-server
```

### Docker Compose 배포

```bash
# 전체 스택 배포
docker compose up -d

# 스케일링
docker compose up -d --scale chat-server=5

# 로그 확인
docker compose logs -f chat-server

# 서비스 재시작
docker compose restart chat-server
```

### 프로덕션 배포

```bash
# 자동 배포 스크립트
./scripts/deploy.sh deploy

# 헬스 체크
./scripts/deploy.sh health

# 로그 확인
./scripts/deploy.sh logs
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 지원

- **이슈 리포트**: GitHub Issues
- **문서**: [Wiki](https://github.com/your-repo/wiki)
- **이메일**: support@gatrix.com

---

**Gatrix Chat Server** - 차세대 고성능 실시간 채팅 플랫폼 🚀
