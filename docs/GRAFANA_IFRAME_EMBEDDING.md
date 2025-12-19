# Grafana iframe 임베딩 설정 가이드

## 문제

Grafana 11 버전부터 CSRF(Cross-Site Request Forgery) 보호가 강화되어, 프록시를 통해 Grafana에 접근할 때 "origin not allowed" 에러가 발생할 수 있습니다.

### 증상
- Grafana 로그인 시 "Login failed - origin not allowed" 에러
- iframe 내에서 Grafana 대시보드 임베딩 실패
- Grafana API 호출 시 403 Forbidden 에러

## 원인

브라우저에서 `http://localhost:43000`으로 접속하지만, 프록시를 통해 Grafana(`http://localhost:44000`)로 요청이 전달될 때:
1. 브라우저가 보낸 `Origin: http://localhost:43000` 헤더가 그대로 전달됨
2. Grafana는 이 Origin이 신뢰할 수 있는 origin 목록에 없으면 CSRF 공격으로 판단하여 거부
3. Grafana 11에서는 `GF_SECURITY_CSRF_TRUSTED_ORIGINS: "*"` (와일드카드)가 작동하지 않음

## 해결 방법

### 1. Grafana 환경 변수 설정

Docker Compose 파일에서 Grafana 서비스에 다음 환경 변수를 설정:

```yaml
environment:
  # iframe 임베딩 허용
  GF_SECURITY_ALLOW_EMBEDDING: "true"
  
  # CSRF 검사 완화 (개발 환경)
  GF_SECURITY_CSRF_ALWAYS_CHECK: "false"
  
  # 명시적으로 trusted origins 지정 (와일드카드 * 는 작동하지 않음!)
  GF_SECURITY_CSRF_TRUSTED_ORIGINS: "http://localhost:43000,http://localhost:44000,http://127.0.0.1:43000,http://127.0.0.1:44000"
  
  # 쿠키 SameSite 제한 해제
  GF_SECURITY_COOKIE_SAMESITE: "disabled"
  
  # WebSocket 허용
  GF_LIVE_ALLOWED_ORIGINS: "*"
```

### 2. 프록시에서 Origin 헤더 수정

프록시가 Grafana로 요청을 전달할 때, `Origin` 헤더를 Grafana가 기대하는 origin으로 변경해야 합니다.

#### Vite Dev Server (vite.config.ts)

```typescript
'/grafana': {
  target: 'http://localhost:44000',
  changeOrigin: true,
  secure: false,
  ws: true,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      // Origin 헤더를 Grafana의 실제 주소로 설정
      proxyReq.setHeader('Origin', 'http://localhost:44000');
    });
  },
},
```

#### Nginx (nginx.conf)

```nginx
location ^~ /grafana/ {
    set $grafana_upstream http://grafana:3000;
    proxy_pass $grafana_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    proxy_cache_bypass $http_upgrade;
    
    # Origin 헤더를 Grafana upstream 주소로 설정 (CSRF 통과)
    proxy_set_header Origin $grafana_upstream;
}
```

## 주의 사항

1. **익명 로그인 비활성화**: `GF_AUTH_ANONYMOUS_ENABLED: "false"`로 설정하여 보안 유지
2. **프로덕션 환경**: 실제 도메인을 `GF_SECURITY_CSRF_TRUSTED_ORIGINS`에 추가
3. **쿠키 공유**: 같은 브라우저에서 Grafana에 먼저 로그인해야 iframe에서도 인증됨

## 관련 파일

- `docker-compose.dev.yml` - 개발 환경 Grafana 설정
- `docker-compose.yml` - 기본 Grafana 설정
- `docker-compose.prod.yml` - 프로덕션 Grafana 설정
- `packages/frontend/vite.config.ts` - Vite 프록시 설정
- `packages/frontend/nginx.conf` - Nginx 프록시 설정

## 참고

- [Grafana CSRF Protection Documentation](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-csrf/)
- Grafana 11 Release Notes - CSRF 보호 강화
