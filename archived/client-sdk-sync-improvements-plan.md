# Client SDK Sync 개선 구현 계획

## 개요

Client SDK의 Explicit Sync Mode 관련 3가지 기능을 추가하고, 모든 SDK에 일관되게 반영합니다.

## 변경 사항 요약

### 1. `FLAGS_PENDING_SYNC` 이벤트 추가
- `pendingSync`가 `false → true`로 전환될 때 `flags.pending_sync` 이벤트를 emit
- 사용자가 폴링 없이 sync 가능 여부를 알 수 있게 함

### 2. `setExplicitSyncMode(enabled)` 런타임 변경 함수
- 앱 실행 중에 explicitSyncMode를 on/off 전환 가능
- **켤 때** (`false → true`): `synchronizedFlags = realtimeFlags` 복사, `pendingSync = false`
- **끌 때** (`true → false`): `synchronizedFlags = realtimeFlags` 복사, `pendingSync = false`

### 3. `realtime` 파라미터 추가
- `isEnabled`, `getVariant`, `*Variation`, `*VariationDetails`, `*VariationOrThrow` 등 모든 플래그 접근 함수에 마지막 파라미터로 `realtime: boolean = false` 추가
- `realtime: true`이면 `explicitSyncMode` 여부와 관계없이 항상 `realtimeFlags`에서 값 반환
- `selectFlags()` → `selectFlags(realtime: boolean = false)` 변경

## 대상 SDK (7개)

| SDK | 언어 | 핵심 파일 |
|-----|------|-----------|
| gatrix-js-client-sdk | TypeScript | `FeaturesClient.ts`, `events.ts`, `types.ts` |
| gatrix-flutter-sdk | Dart | `features_client.dart`, `events.dart` |
| gatrix-unity-sdk | C# | `FeaturesClient.cs`, `GatrixEvents.cs`, `IFeaturesClient.cs` |
| gatrix-unreal-sdk | C++ | `GatrixFeaturesClient.h/.cpp` |
| gatrix-cocos2dx-sdk | C++ | `GatrixFeaturesClient.h/.cpp` |
| gatrix-python-sdk | Python | `features_client.py`, `events.py` |
| gatrix-godot-sdk | GDScript | `gatrix_features_client.gd` |

## 작업 순서

### Phase 1: JS SDK (기준 구현)
가장 핵심이자 참조 구현인 JS SDK를 먼저 완성합니다.

#### Task 1-1: events.ts에 `FLAGS_PENDING_SYNC` 이벤트 상수 추가
- `FLAGS_PENDING_SYNC: 'flags.pending_sync'` 추가

#### Task 1-2: `selectFlags(realtime)` 수정
- `private selectFlags(realtime: boolean = false)` 시그니처 변경
- `realtime === true`이면 무조건 `this.realtimeFlags` 반환
- 기존 로직: `explicitSyncMode ? synchronizedFlags : realtimeFlags`

#### Task 1-3: `lookupFlag(flagName, realtime)` 수정
- `realtime` 파라미터를 `selectFlags`에 전달

#### Task 1-4: 모든 `*Internal` 메서드에 `realtime` 파라미터 추가
- `isEnabledInternal(flagName, realtime = false)`
- `getVariantInternal(flagName, realtime = false)`
- `variationInternal(flagName, missingValue, realtime = false)`
- `boolVariationInternal(flagName, missingValue, realtime = false)`
- `stringVariationInternal(flagName, missingValue, realtime = false)`
- `numberVariationInternal(flagName, missingValue, realtime = false)`
- `jsonVariationInternal(flagName, missingValue, realtime = false)`
- `*VariationDetailsInternal` 전부
- `*VariationOrThrowInternal` 전부
- 각 메서드 내에서 `this.lookupFlag(flagName, realtime)` 호출

#### Task 1-5: 모든 Public 메서드에 `realtime` 파라미터 전달
- `isEnabled(flagName, realtime = false)` → `isEnabledInternal(flagName, realtime)`
- `getAllFlags(realtime = false)` → `selectFlags(realtime)`
- `hasFlag(flagName, realtime = false)` → `selectFlags(realtime)`
- 나머지 모든 variation 메서드도 동일

#### Task 1-6: `setFlags`에서 `FLAGS_PENDING_SYNC` 이벤트 emit
- `pendingSync`가 `false`에서 `true`로 변할 때만 emit
- ```ts
  const wasPending = this.pendingSync;
  this.pendingSync = true;
  if (!wasPending) {
    this.emitter.emit(EVENTS.FLAGS_PENDING_SYNC);
  }
  ```

#### Task 1-7: `setExplicitSyncMode(enabled)` 함수 추가
- `public setExplicitSyncMode(enabled: boolean): void`
- mode 변경 시 `synchronizedFlags = new Map(realtimeFlags)`, `pendingSync = false`
- `this.featuresConfig.explicitSyncMode = enabled`

#### Task 1-8: VariationProvider 인터페이스 업데이트 (types.ts)
- 모든 Internal 메서드 시그니처에 `realtime?: boolean` 추가

#### Task 1-9: FlagProxy 클래스 업데이트
- FlagProxy는 VariationProvider를 통해 delegation하므로, 내부적으로는 변경 불필요
- FlagProxy 자체의 variation 메서드에도 `realtime` 파라미터를 추가할지 판단 필요
  → FlagProxy는 이미 특정 flag에 바인딩되어 있고, watchFlag 콜백에서 사용되므로 realtime 파라미터는 불필요. FlagProxy는 그대로 유지.

#### Task 1-10: 빌드 및 lint 확인

### Phase 2: Flutter SDK
- `events.dart`에 `flagsPendingSync` 이벤트 추가
- `_activeFlags` getter → `_selectFlags(bool realtime = false)` 메서드로 변경
- 모든 `*Internal` 메서드에 `{bool realtime = false}` named parameter 추가
- 모든 public 메서드에 `{bool realtime = false}` 전달
- `setExplicitSyncMode(bool enabled)` 추가
- `fetchFlags`에서 `pendingSync` 전환 시 이벤트 emit

### Phase 3: Unity SDK
- `GatrixEvents.cs`에 `FlagsPendingSync` 이벤트 추가
- `SelectFlags(bool realtime = false)` 수정
- 모든 `*Internal` 메서드에 `bool realtime = false` 파라미터 추가
- `SetExplicitSyncMode(bool enabled)` 추가
- `IFeaturesClient.cs` 인터페이스도 동시 업데이트
- `SetFlags`에서 pendingSync 전환 시 이벤트 emit

### Phase 4: Unreal SDK
- 이벤트 상수에 `FlagsPendingSync` 추가
- `SelectFlags(bool bRealtime = false)` 수정
- 모든 variation 메서드에 `bool bRealtime = false` 파라미터 추가 (헤더 + 소스)
- `SetExplicitSyncMode(bool bEnabled)` 추가
- pendingSync 전환 이벤트 emit

### Phase 5: Cocos2d-x SDK
- 이벤트 상수 추가
- `selectFlags(bool realtime = false)` 수정
- 모든 variation 함수에 `bool realtime = false` 추가 (헤더 + 소스)
- `setExplicitSyncMode(bool enabled)` 추가
- pendingSync 이벤트 emit

### Phase 6: Python SDK
- `events.py`에 `FLAGS_PENDING_SYNC` 추가
- Python SDK는 `_flags` / `_pending_flags` 구조가 다름. `_flags`, `_realtime_flags` 분리 필요
  - 현재: `_flags` (active), `_pending_flags` (pending) → explicit sync 시 `_pending_flags`에 저장 후 `sync_flags`에서 `_apply_flags`
  - 변경: `_realtime_flags`와 `_synchronized_flags` 패턴으로 통일하거나, `_get_flag`에 `realtime` 파라미터 추가
  - 기존 `_pending_flags` 구조를 유지하면서 `realtime` 지원 추가:
    - `_get_flag(flagName, realtime=False)` → `realtime=True`이면 `_pending_flags or _flags`에서 검색
- `set_explicit_sync_mode(enabled)` 추가
- 모든 `*_internal` 메서드에 `realtime=False` 파라미터 추가
- pendingSync 이벤트 emit

### Phase 7: Godot SDK
- 이벤트 시그널 추가
- `_select_flags(realtime: bool = false)` 메서드 추가
- 모든 variation 함수에 `realtime: bool = false` 추가
- `set_explicit_sync_mode(enabled: bool)` 추가
- pendingSync 이벤트 emit

## 주의사항

1. **FlagProxy는 변경 최소화** — FlagProxy는 이미 특정 flag 인스턴스에 바인딩되어 있으므로, `realtime` 파라미터는 FeaturesClient의 public 메서드와 internal 메서드에서만 처리
2. **하위 호환성** — 모든 `realtime` 파라미터는 `false`가 기본값이므로 기존 코드에 영향 없음
3. **pendingSync 이벤트는 중복 emit 방지** — `false → true` 전환 시에만 emit
4. **Python SDK 구조 차이** — Python SDK는 `_flags`/`_pending_flags` 구조가 다르므로 별도 처리 필요
5. **각 SDK 빌드 확인** — JS SDK는 `yarn build`, Flutter는 `dart analyze`, Unity/Unreal/Cocos2d-x는 빌드 스크립트 확인
