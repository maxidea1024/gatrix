---
sidebar_position: 3
---

# Server SDK API 문서

백엔드 서비스와 서버 애플리케이션을 위한 서버 측 API 엔드포인트입니다.

## 특징

- **API 토큰 인증**: 안전한 서버 간 통신
- **고성능**: 서버 측 사용에 최적화
- **Rate Limiting**: 서버 애플리케이션에 적합한 제한

## 인증

모든 Server SDK 엔드포인트는 API 토큰 인증이 필요합니다:

```
Headers:
X-API-Token: your-server-api-token
X-Application-Name: your-application-name
```

## API 엔드포인트

### 1. 인증 테스트

```
GET /api/v1/server/test
```

서버 SDK 인증을 테스트합니다.

#### 응답

```json
{
  "success": true,
  "message": "SDK authentication successful",
  "data": {
    "tokenId": "token-id",
    "tokenName": "token-name",
    "tokenType": "server",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. 서버 템플릿 조회

```
GET /api/v1/server/templates
```

서버 측 사용을 위한 원격 설정 템플릿을 조회합니다.

#### 응답

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": 1,
        "key": "feature_flag",
        "name": "기능 플래그",
        "type": "boolean",
        "defaultValue": false,
        "description": "기능 활성화/비활성화"
      }
    ],
    "etag": "abc123",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. 메트릭 제출

```
POST /api/v1/server/metrics
```

서버 애플리케이션에서 사용 메트릭을 제출합니다.

#### 요청 본문

```json
{
  "metrics": [
    {
      "configKey": "feature_flag",
      "value": true,
      "timestamp": "2024-01-01T00:00:00.000Z",
      "metadata": {
        "server_id": "server-001",
        "environment": "production"
      }
    }
  ]
}
```

#### 응답

```json
{
  "success": true,
  "message": "메트릭이 성공적으로 제출되었습니다",
  "data": {
    "processed": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 오류 응답

모든 엔드포인트는 표준화된 오류 응답을 반환합니다:

```json
{
  "success": false,
  "error": {
    "message": "오류 설명",
    "code": "ERROR_CODE"
  }
}
```

### 일반적인 오류 코드

- `INVALID_API_TOKEN`: 유효하지 않거나 누락된 API 토큰
- `INSUFFICIENT_PERMISSIONS`: 토큰에 필요한 권한이 없음
- `RATE_LIMIT_EXCEEDED`: 요청이 너무 많음
- `ENVIRONMENT_NOT_FOUND`: 환경을 찾을 수 없음
- `VALIDATION_ERROR`: 요청 검증 실패

## 사용 예제

### Node.js 예제

```javascript
const axios = require('axios');

const serverSDK = {
  baseURL: 'https://api.example.com/api/v1/server',
  apiKey: 'your-server-api-token',
  appName: 'your-app-name',

  async getTemplates() {
    try {
      const response = await axios.get(`${this.baseURL}/templates`, {
        headers: {
          'X-API-Token': this.apiKey,
          'X-Application-Name': this.appName,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('템플릿 조회 오류:', error.response?.data);
      throw error;
    }
  },

  async submitMetrics(metrics) {
    try {
      const response = await axios.post(`${this.baseURL}/metrics`, 
        { metrics },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'X-Application-Name': this.appName,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('메트릭 제출 오류:', error.response?.data);
      throw error;
    }
  }
};

// 사용법
async function main() {
  try {
    const templates = await serverSDK.getTemplates();
    console.log('템플릿:', templates);

    await serverSDK.submitMetrics([
      {
        configKey: 'feature_flag',
        value: true,
        timestamp: new Date().toISOString(),
        metadata: { server_id: 'server-001' }
      }
    ]);
  } catch (error) {
    console.error('SDK 오류:', error);
  }
}
```

## Rate Limits

- **템플릿**: 분당 1000회 요청
- **메트릭**: 분당 10000회 요청  
- **테스트**: 분당 100회 요청

## 모범 사례

1. **템플릿 캐싱**: ETag를 사용하여 템플릿 응답을 캐시하세요
2. **메트릭 배치**: 성능 향상을 위해 메트릭을 배치로 제출하세요
3. **오류 처리**: 지수 백오프를 사용한 적절한 재시도 로직을 구현하세요
4. **토큰 보안**: API 토큰을 안전하게 저장하고 정기적으로 교체하세요
5. **모니터링**: API 사용량과 응답 시간을 모니터링하세요
