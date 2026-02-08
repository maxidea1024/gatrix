# Gatrix React SDK 구현 계획

## 개요

`gatrix-js-client-sdk`를 래핑하여 React에서 사용할 수 있는 hooks 및 Context를 제공하는 SDK를 제작합니다.

**참고 자료:**

- `ref/unleash-react-sdk` - Unleash React SDK 구조
- `client-sdks/gatrix-js-client-sdk` - 기존 JavaScript SDK
- `client-sdks/CLIENT_SDK_SPEC.md` - SDK 스펙 문서

## 프로젝트 구조

```
client-sdks/gatrix-react-sdk/
├── src/
│   ├── index.ts                  # 메인 export
│   ├── GatrixContext.ts          # React Context 정의
│   ├── GatrixProvider.tsx        # Provider 컴포넌트
│   ├── useGatrixClient.ts        # GatrixClient 인스턴스 접근
│   ├── useGatrixContext.ts       # Context 접근 hook (내부용)
│   ├── useFlagsStatus.ts         # flagsReady, flagsError 상태
│   ├── useUpdateContext.ts       # context 업데이트 함수
│   ├── useFlag.ts                # isEnabled 반환 hook
│   ├── useFlags.ts               # 모든 플래그 반환
│   ├── useVariant.ts             # variant 정보 반환
│   ├── useBoolVariation.ts       # boolean variation hook
│   ├── useStringVariation.ts     # string variation hook
│   ├── useNumberVariation.ts     # number variation hook
│   └── useJsonVariation.ts       # JSON variation hook
├── package.json
├── tsconfig.json
├── vite.config.js                # 빌드 설정
├── README.md
└── examples/
    └── dashboard/                # React 대시보드 예제 (Vite + Rebass)
        ├── src/
        │   ├── App.tsx
        │   ├── main.tsx
        │   └── components/
        │       ├── FlagCard.tsx
        │       └── Dashboard.tsx
        ├── index.html
        ├── package.json
        └── vite.config.js
```

## Task 1: React SDK 프로젝트 초기화 및 기본 설정

### 목표

- 프로젝트 폴더 생성
- package.json 설정 (React, TypeScript, Vite)
- tsconfig.json 설정
- vite.config.js 빌드 설정

### 상세 작업

1. `gatrix-react-sdk` 폴더 생성
2. package.json 작성
   - peerDependencies: react, @gatrix/js-client-sdk
   - devDependencies: typescript, vite, vite-plugin-dts
   - scripts: build, test
3. tsconfig.json 작성
4. vite.config.js 작성 (library mode)

---

## Task 2: Context 및 Provider 구현

### 목표

- GatrixContext 정의
- GatrixProvider 컴포넌트 구현

### 상세 작업

#### GatrixContext.ts

```typescript
export interface IGatrixContextValue {
  client: GatrixClient;
  features: FeaturesClient;
  flagsReady: boolean;
  flagsError: any;
  on: GatrixClient['on'];
  off: GatrixClient['off'];
  isEnabled: FeaturesClient['isEnabled'];
  getVariant: FeaturesClient['getVariant'];
  updateContext: FeaturesClient['updateContext'];
}
```

#### GatrixProvider.tsx

- config prop으로 GatrixClientConfig 받기
- 또는 gatrixClient prop으로 이미 생성된 인스턴스 받기
- startClient, stopClient 옵션 제공
- events.READY, events.ERROR, events.RECOVERED 이벤트 처리
- cleanup 시 client.stop() 호출

---

## Task 3: Core Hooks 구현

### useGatrixClient

```typescript
const useGatrixClient = (): GatrixClient => {
  const { client } = useGatrixContext();
  return client;
};
```

### useFlagsStatus

```typescript
const useFlagsStatus = (): { flagsReady: boolean; flagsError: any } => {
  const { flagsReady, flagsError } = useGatrixContext();
  return { flagsReady, flagsError };
};
```

### useUpdateContext

```typescript
const useUpdateContext = () => {
  const { updateContext } = useGatrixContext();
  return updateContext;
};
```

---

## Task 4: Flag Access Hooks 구현

### useFlag(flagName: string): boolean

- isEnabled 결과 반환
- 'update', 'ready' 이벤트 구독하여 자동 업데이트
- useRef로 현재 값 추적하여 불필요한 렌더링 방지

### useFlags(): EvaluatedFlag[]

- getAllFlags() 결과 반환
- 'update' 이벤트 구독하여 자동 업데이트

### useVariant(flagName: string): Variant

- getVariant 결과 반환
- variant 변경 감지 로직 구현

---

## Task 5: Variation Hooks 구현

### useBoolVariation(flagName: string, defaultValue: boolean): boolean

```typescript
const useBoolVariation = (flagName: string, defaultValue: boolean): boolean => {
  const { features, client } = useGatrixContext();
  const [value, setValue] = useState(() => features.boolVariation(flagName, defaultValue));

  useEffect(() => {
    const handler = () => setValue(features.boolVariation(flagName, defaultValue));
    client.on('update', handler);
    client.on('ready', handler);
    return () => {
      client.off('update', handler);
      client.off('ready', handler);
    };
  }, [client, flagName, defaultValue]);

  return value;
};
```

### useStringVariation, useNumberVariation, useJsonVariation

- 동일한 패턴으로 구현

---

## Task 6: 빌드 및 Export 설정

### index.ts exports

```typescript
// Re-export from js-client-sdk
export type {
  GatrixClientConfig,
  GatrixContext,
  EvaluatedFlag,
  Variant,
} from '@gatrix/js-client-sdk';
export {
  GatrixClient,
  InMemoryStorageProvider,
  LocalStorageProvider,
  EVENTS,
} from '@gatrix/js-client-sdk';

// React specific
export { GatrixContext as GatrixFlagContext } from './GatrixContext';
export { GatrixProvider } from './GatrixProvider';
export { useGatrixClient } from './useGatrixClient';
export { useFlagsStatus } from './useFlagsStatus';
export { useUpdateContext } from './useUpdateContext';
export { useFlag } from './useFlag';
export { useFlags } from './useFlags';
export { useVariant } from './useVariant';
export { useBoolVariation } from './useBoolVariation';
export { useStringVariation } from './useStringVariation';
export { useNumberVariation } from './useNumberVariation';
export { useJsonVariation } from './useJsonVariation';

export default GatrixProvider;
```

---

## Task 7: React Dashboard 예제 구현

### 목표

- gatrix-js-client-sdk의 dashboard.ts를 React 버전으로 포팅
- Rebass 사용하여 UI 스타일링

### 구조

```
examples/dashboard/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Dashboard.tsx    # 메인 대시보드
│   │   ├── FlagCard.tsx     # 개별 플래그 카드
│   │   ├── StatusBadge.tsx  # 상태 뱃지
│   │   └── StatsPanel.tsx   # 통계 패널
│   └── theme.ts             # Rebass 테마
├── index.html
├── package.json
└── vite.config.js
```

### 주요 기능

- 실시간 플래그 목록 표시
- 플래그 on/off 상태 표시
- variant 정보 표시
- 연결 상태 표시
- 자동 새로고침

---

## 구현 순서

1. **Task 1**: 프로젝트 초기화 (package.json, tsconfig.json, vite.config.js)
2. **Task 2**: Context/Provider 구현
3. **Task 3**: Core hooks 구현
4. **Task 4**: Flag access hooks 구현
5. **Task 5**: Variation hooks 구현
6. **Task 6**: 빌드 및 export 설정
7. **Task 7**: React Dashboard 예제

---

## 예상 파일 목록

### SDK 파일

1. `package.json`
2. `tsconfig.json`
3. `vite.config.js`
4. `src/index.ts`
5. `src/GatrixContext.ts`
6. `src/GatrixProvider.tsx`
7. `src/useGatrixContext.ts`
8. `src/useGatrixClient.ts`
9. `src/useFlagsStatus.ts`
10. `src/useUpdateContext.ts`
11. `src/useFlag.ts`
12. `src/useFlags.ts`
13. `src/useVariant.ts`
14. `src/useBoolVariation.ts`
15. `src/useStringVariation.ts`
16. `src/useNumberVariation.ts`
17. `src/useJsonVariation.ts`
18. `README.md`

### 예제 파일

19. `examples/dashboard/package.json`
20. `examples/dashboard/vite.config.js`
21. `examples/dashboard/index.html`
22. `examples/dashboard/src/main.tsx`
23. `examples/dashboard/src/App.tsx`
24. `examples/dashboard/src/theme.ts`
25. `examples/dashboard/src/components/Dashboard.tsx`
26. `examples/dashboard/src/components/FlagCard.tsx`
27. `examples/dashboard/src/components/StatusBadge.tsx`
28. `examples/dashboard/src/components/StatsPanel.tsx`

---

## 기술 스택

### React SDK

- TypeScript
- React 18+
- Vite (빌드)
- vite-plugin-dts (타입 생성)

### Dashboard 예제

- Vite
- React
- Rebass (UI 컴포넌트)
- Emotion (스타일링 - Rebass 의존성)

---

## 주의사항

1. **peerDependencies**: React와 gatrix-js-client-sdk는 peerDependencies로 설정
2. **네이밍 일관성**: Gatrix 네이밍 사용 (Unleash 대신)
3. **이벤트 구독**: update, ready 이벤트 모두 구독
4. **Cleanup**: useEffect cleanup에서 이벤트 리스너 해제
5. **기본값 필수**: Variation hooks에서 defaultValue 필수

---

## 승인 요청

위 계획을 검토해주시고, 승인 또는 수정 사항이 있으시면 말씀해주세요.
