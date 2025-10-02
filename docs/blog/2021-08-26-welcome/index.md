---
slug: api-integration-webhooks
title: Gatrix API 통합 및 웹훅 설정 완전 가이드
authors: [gatrix-team]
tags: [gatrix, api, tutorial, tips]
---

Gatrix의 강력한 API 시스템을 활용하여 외부 서비스와의 통합을 구현하고, 실시간 이벤트를 처리하는 웹훅을 설정하는 방법을 알아보겠습니다. 이 가이드를 통해 게임 플랫폼을 더욱 확장 가능하고 유연하게 만들 수 있습니다.

<!-- truncate -->

## 🔌 API 통합 개요

Gatrix는 RESTful API와 WebSocket을 통해 다양한 외부 서비스와의 통합을 지원합니다:

- **REST API**: 표준 HTTP 메서드를 사용한 데이터 교환
- **WebSocket**: 실시간 이벤트 스트리밍
- **Webhook**: 서버 간 비동기 통신
- **SDK**: 다양한 언어를 위한 클라이언트 라이브러리

## 📡 REST API 통합

### 1. 인증 설정

모든 API 요청에는 적절한 인증이 필요합니다:

```javascript
// JWT 토큰을 사용한 인증
const axios = require('axios');

const apiClient = axios.create({
  baseURL: 'https://api.gatrix.com',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});

// API 키를 사용한 인증
const apiKeyClient = axios.create({
  baseURL: 'https://api.gatrix.com',
  headers: {
    'X-API-Key': process.env.GATRIX_API_KEY,
    'Content-Type': 'application/json'
  }
});
```

### 2. 주요 API 엔드포인트

#### 사용자 관리
```javascript
// 사용자 목록 조회
const users = await apiClient.get('/api/v1/users', {
  params: {
    page: 1,
    limit: 50,
    role: 'player'
  }
});

// 사용자 생성
const newUser = await apiClient.post('/api/v1/users', {
  username: 'player123',
  email: 'player@example.com',
  role: 'player'
});

// 사용자 정보 업데이트
const updatedUser = await apiClient.put('/api/v1/users/123', {
  status: 'active',
  lastLoginAt: new Date().toISOString()
});
```

#### 게임 월드 관리
```javascript
// 게임 월드 목록 조회
const worlds = await apiClient.get('/api/v1/game-worlds');

// 게임 월드 생성
const newWorld = await apiClient.post('/api/v1/game-worlds', {
  worldId: 'world_001',
  name: '메인 월드',
  description: '기본 게임 월드',
  visible: true,
  maintenance: false
});

// 게임 월드 상태 변경
const maintenanceMode = await apiClient.put('/api/v1/game-worlds/1/maintenance', {
  enabled: true,
  message: '서버 점검 중입니다. 2시간 후 정상화 예정입니다.'
});
```

## 🔗 WebSocket 통합

### 1. 실시간 이벤트 구독

```javascript
const io = require('socket.io-client');

class GatrixWebSocketClient {
  constructor(serverUrl, token) {
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // 연결 이벤트
    this.socket.on('connect', () => {
      console.log('Gatrix 서버에 연결되었습니다.');
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('연결이 끊어졌습니다:', reason);
    });
    
    // 사용자 이벤트
    this.socket.on('user_registered', (data) => {
      console.log('새 사용자 등록:', data);
      this.handleUserRegistration(data);
    });
    
    this.socket.on('user_login', (data) => {
      console.log('사용자 로그인:', data);
      this.handleUserLogin(data);
    });
    
    // 게임 월드 이벤트
    this.socket.on('world_maintenance_started', (data) => {
      console.log('월드 점검 시작:', data);
      this.handleMaintenanceStart(data);
    });
    
    this.socket.on('world_maintenance_ended', (data) => {
      console.log('월드 점검 종료:', data);
      this.handleMaintenanceEnd(data);
    });
  }
  
  // 이벤트 핸들러들
  handleUserRegistration(data) {
    // 사용자 등록 처리 로직
    this.sendWelcomeEmail(data.user);
    this.updateAnalytics('user_registered', data);
  }
  
  handleUserLogin(data) {
    // 로그인 처리 로직
    this.updateUserActivity(data.userId);
    this.logSecurityEvent('user_login', data);
  }
  
  handleMaintenanceStart(data) {
    // 점검 시작 처리 로직
    this.notifyUsers(data.worldId, 'maintenance_started');
    this.updateWorldStatus(data.worldId, 'maintenance');
  }
  
  handleMaintenanceEnd(data) {
    // 점검 종료 처리 로직
    this.notifyUsers(data.worldId, 'maintenance_ended');
    this.updateWorldStatus(data.worldId, 'active');
  }
}
```

## 🪝 웹훅 설정

### 1. 웹훅 엔드포인트 생성

```javascript
const express = require('express');
const crypto = require('crypto');

class WebhookHandler {
  constructor(secret) {
    this.secret = secret;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(this.verifySignature.bind(this));
  }
  
  // 웹훅 서명 검증
  verifySignature(req, res, next) {
    const signature = req.headers['x-gatrix-signature'];
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
  }
  
  setupRoutes() {
    // 사용자 관련 웹훅
    this.app.post('/webhook/users', (req, res) => {
      const { event, data } = req.body;
      
      switch (event) {
        case 'user.created':
          this.handleUserCreated(data);
          break;
        case 'user.updated':
          this.handleUserUpdated(data);
          break;
        case 'user.deleted':
          this.handleUserDeleted(data);
          break;
        default:
          console.log('알 수 없는 사용자 이벤트:', event);
      }
      
      res.status(200).json({ received: true });
    });
    
    // 게임 월드 관련 웹훅
    this.app.post('/webhook/worlds', (req, res) => {
      const { event, data } = req.body;
      
      switch (event) {
        case 'world.maintenance_started':
          this.handleWorldMaintenanceStarted(data);
          break;
        case 'world.maintenance_ended':
          this.handleWorldMaintenanceEnded(data);
          break;
        default:
          console.log('알 수 없는 월드 이벤트:', event);
      }
      
      res.status(200).json({ received: true });
    });
  }
  
  // 이벤트 핸들러들
  handleUserCreated(data) {
    console.log('새 사용자 생성:', data);
    // 사용자 생성 후처리 로직
  }
  
  handleUserUpdated(data) {
    console.log('사용자 정보 업데이트:', data);
    // 사용자 업데이트 후처리 로직
  }
  
  handleUserDeleted(data) {
    console.log('사용자 삭제:', data);
    // 사용자 삭제 후처리 로직
  }
  
  handleWorldMaintenanceStarted(data) {
    console.log('월드 점검 시작:', data);
    // 점검 시작 후처리 로직
  }
  
  handleWorldMaintenanceEnded(data) {
    console.log('월드 점검 종료:', data);
    // 점검 종료 후처리 로직
  }
  
  start(port = 3000) {
    this.app.listen(port, () => {
      console.log(`웹훅 서버가 포트 ${port}에서 실행 중입니다.`);
    });
  }
}

// 웹훅 서버 시작
const webhookHandler = new WebhookHandler(process.env.WEBHOOK_SECRET);
webhookHandler.start(3000);
```

### 2. Gatrix에서 웹훅 설정

```javascript
// Gatrix에서 웹훅 등록
const webhookConfig = {
  url: 'https://your-service.com/webhook/users',
  events: ['user.created', 'user.updated', 'user.deleted'],
  secret: 'your-webhook-secret',
  active: true
};

// 웹훅 등록 API 호출
const registeredWebhook = await apiClient.post('/api/v1/webhooks', webhookConfig);
```

## 🛠️ SDK 사용

### 1. Node.js SDK

```javascript
const GatrixClient = require('@gatrix/nodejs-sdk');

const client = new GatrixClient({
  apiKey: process.env.GATRIX_API_KEY,
  baseURL: 'https://api.gatrix.com',
  timeout: 5000
});

// 사용자 관리
const users = await client.users.list({ page: 1, limit: 10 });
const user = await client.users.create({
  username: 'player123',
  email: 'player@example.com'
});

// 게임 월드 관리
const worlds = await client.worlds.list();
const world = await client.worlds.create({
  worldId: 'world_001',
  name: '메인 월드'
});

// 클라이언트 버전 관리
const versions = await client.versions.list({
  channel: 'PC',
  subChannel: 'Steam'
});
```

### 2. Python SDK

```python
from gatrix import GatrixClient

client = GatrixClient(
    api_key='your-api-key',
    base_url='https://api.gatrix.com'
)

# 사용자 관리
users = client.users.list(page=1, limit=10)
user = client.users.create(
    username='player123',
    email='player@example.com'
)

# 게임 월드 관리
worlds = client.worlds.list()
world = client.worlds.create(
    world_id='world_001',
    name='메인 월드'
)
```

## 📊 모니터링 및 로깅

### 1. API 호출 모니터링

```javascript
class APIMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }
  
  recordRequest(duration, success) {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // 평균 응답 시간 계산
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime + duration) / 2;
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.successfulRequests / this.metrics.totalRequests
    };
  }
}
```

### 2. 에러 로깅

```javascript
class ErrorLogger {
  constructor() {
    this.errors = [];
  }
  
  logError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context
    };
    
    this.errors.push(errorEntry);
    
    // 외부 로깅 서비스로 전송
    this.sendToExternalLogger(errorEntry);
  }
  
  sendToExternalLogger(errorEntry) {
    // Sentry, LogRocket 등에 전송
    console.error('API 에러:', errorEntry);
  }
}
```

## 🎯 결론

Gatrix의 API 시스템을 활용하면 강력하고 확장 가능한 게임 플랫폼을 구축할 수 있습니다. 이 가이드의 내용을 참고하여:

1. **REST API**로 기본적인 데이터 교환 구현
2. **WebSocket**으로 실시간 이벤트 처리
3. **웹훅**으로 서버 간 비동기 통신
4. **SDK**를 사용한 간편한 통합

이러한 기능들을 조합하여 게임 플랫폼의 기능을 확장하고 사용자 경험을 향상시킬 수 있습니다.

---

**관련 자료**:
- [API 문서](/docs/api/client-api)
- [서버 SDK API](/docs/api/server-sdk-api)
- [GitHub 저장소](https://github.com/motifgames/gatrix)