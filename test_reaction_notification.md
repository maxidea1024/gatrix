# 메시지 리액션 알림 테스트 가이드

## 구현된 기능

### 1. WebSocket 실시간 업데이트
- 메시지에 리액션 추가/제거 시 채널의 모든 사용자에게 실시간 업데이트
- 이벤트 타입: `message_reaction_updated`

### 2. 알림 시스템
- 메시지 작성자에게 리액션 알림 전송 (자신의 메시지 제외)
- Gatrix 메인 서버의 SSE 알림 시스템 활용

## 테스트 방법

### 1. 기본 리액션 기능 테스트
```bash
# 1. 채팅 서버 실행
cd packages/chat-server
npm run dev

# 2. 백엔드 서버 실행
cd packages/backend
npm run dev

# 3. 프론트엔드 실행
cd packages/frontend
npm run dev
```

### 2. 리액션 API 테스트
```bash
# 메시지에 리액션 추가
curl -X POST http://localhost:3001/api/v1/messages/1/reactions \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d '{"emoji": "👍"}'

# 리액션 제거
curl -X DELETE http://localhost:3001/api/v1/messages/1/reactions/👍 \
  -H "x-user-id: 2"
```

### 3. WebSocket 이벤트 확인
브라우저 개발자 도구에서 다음 로그 확인:
- `🔍 Message reaction updated:` - 리액션 업데이트 이벤트 수신
- `Reaction update broadcasted to channel` - 서버에서 브로드캐스트 전송

### 4. 알림 테스트
1. 사용자 A가 메시지 작성
2. 사용자 B가 해당 메시지에 리액션 추가
3. 사용자 A에게 알림 전송 확인

## 주요 변경사항

### 백엔드 (Chat Server)
1. `MessageReactionController.ts`
   - WebSocket 브로드캐스트 활성화
   - 리액션 알림 기능 추가

### 프론트엔드
1. `chatWebSocketService.ts`
   - `message_reaction_updated` 이벤트 리스너 추가

2. `ChatContext.tsx`
   - `UPDATE_MESSAGE_REACTIONS` 액션 추가
   - 리액션 업데이트 이벤트 처리

3. `types/chat.ts`
   - `message_reaction_updated` 이벤트 타입 추가

## 문제 해결

### 이전 문제점
- WebSocket 브로드캐스트가 주석 처리되어 실시간 업데이트 불가
- 알림 기능 미구현

### 해결 방법
- BroadcastService 싱글톤 인스턴스 활용
- GatrixApiService를 통한 알림 전송
- 프론트엔드에서 리액션 업데이트 이벤트 처리

## 추가 개선 사항

1. **리액션 애니메이션**: 리액션 추가/제거 시 UI 애니메이션
2. **리액션 통계**: 인기 있는 리액션 통계
3. **커스텀 이모지**: 사용자 정의 이모지 지원
4. **리액션 히스토리**: 리액션 변경 이력 추적
