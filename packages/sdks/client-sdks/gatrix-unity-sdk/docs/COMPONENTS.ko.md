# Gatrix Unity SDK — Zero-Code 컴포넌트 레퍼런스

> **Zero-Code 컴포넌트**는 C# 코드 없이 Unity 씬 속성을 Gatrix 피처 플래그에 직접 연결하는 컴포넌트들입니다.  
> 컴포넌트를 부착하고 플래그 이름을 입력한 다음 인스펙터에서 값을 설정하면 됩니다.

---

## 플래그 Value 타입 (Flag Value Types)

Gatrix 피처 플래그는 서버에서 **Variant** 단위로 값을 전달합니다.  
각 컴포넌트는 `flag.Variant.Value`를 읽어 처리합니다.  
대시보드에서 플래그를 설정할 때 어떤 타입의 값을 써야 하는지 아래 표를 참고하세요.

| Gatrix Value Type | 설명 | 예시 값 |
|---|---|---|
| `boolean` | `true` / `false` | `true` |
| `string` | 문자열 | `"moon"`, `"#FF4444"`, `"Enter text..."` |
| `number` | 정수 또는 실수 | `3.5`, `10`, `0.17` |
| `json` | JSON 객체 | `{"x": 0, "y": 1, "z": 0}` |

> **색상 값**은 `string` 타입에 HTML 색상 코드(`#RRGGBB`)로 입력합니다.  
> **float 값**은 `number` 타입으로 입력합니다.  
> **Variant 이름**(예: `"moon"`, `"hard"`)은 컴포넌트의 Variant Map에서 매핑되어 사용됩니다.

---

## 목차

- [Core](#core)
- [2D](#2d)
- [AI](#ai)
- [Audio](#audio)
- [Camera](#camera)
- [Debug](#debug)
- [Environment](#environment)
- [Lighting](#lighting)
- [Logic](#logic)
- [Navigation](#navigation)
- [Physics](#physics)
- [Post FX](#post-fx)
- [Rendering](#rendering)
- [Time](#time)
- [UI](#ui)

---

## Core

### `GatrixFlagComponentBase`

모든 Gatrix 플래그 바인딩 컴포넌트의 **추상 기반 클래스**입니다.  
직접 사용하지 않으며, 아래 모든 컴포넌트가 이 클래스를 상속합니다.

**공통 인스펙터 필드:**

| 필드 | 설명 |
|---|---|
| `Flag Name` | 바인딩할 Gatrix 플래그 이름 (대소문자 구분) |
| `Use (Realtime)` | ON = 실시간 갱신, OFF = 동기화 모드 갱신 |

> **구독 식별자** 형식: `컴포넌트타입:오브젝트이름(#instanceId)`  
> 같은 이름의 게임오브젝트가 여러 개 있어도 `instanceID`로 구별됩니다.

---

## 2D

### `GatrixFlagRigidbody2D`

`Rigidbody2D`의 물리 속성을 피처 플래그로 제어합니다.

**지원 모드 및 플래그 값 타입:**

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleSimulated` | `true`/`false` (플래그 enabled 상태) | `boolean` |
| `GravityScale` | `0.17`, `1.0`, `2.5` 등 | `number` |
| `Mass` | `1.0`, `5.0` 등 | `number` |
| `LinearDrag` | `0.0` ~ 무한 | `number` |
| `AngularDrag` | `0.0` ~ 무한 | `number` |
| `BodyType` | Variant Map에서 매핑 (0=Dynamic, 1=Kinematic, 2=Static) | Variant Map |

**활용 시나리오:**
- **중력 A/B 테스트** — `moon` 배리언트에서 `gravityScale = 0.17`로 설정 → 점프 높이 체감 차이 측정
- **컷씬 물리 비활성화** — `ToggleSimulated = false`로 컷씬 중 오브젝트 고정, 파괴 없이
- **게임 난이도** — `hard` 배리언트에서 Mass를 크게 설정해 조작감 둔화

---

### `GatrixFlagSortingOrder`

`Renderer`의 소팅 레이어와 오더를 피처 플래그로 변경합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `OrderInLayer` | 정수 (`0`, `5`, `10`) | `number` 또는 Variant Map |
| `SortingLayerName` | 레이어 이름 (`"Foreground"`) | `string` 또는 Variant Map |

**활용 시나리오:**
- **배지 레이어** — "추천" 배지가 캐릭터 위/아래 중 어느 쪽이 더 눈에 잘 띄는지 A/B 테스트
- **스토리 연출** — NPC의 sortingOrder를 높여 전경으로 끌어올리는 연출

---

### `GatrixFlagTilemap`

`Tilemap` 색상, 불투명도, 렌더러 활성 여부를 플래그로 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleRenderer` | 플래그 enabled 상태 | `boolean` |
| `Color` | HTML 색상 코드 (`#D4ECFF`) 또는 Variant Map | `string` |
| `Opacity` | `0.0` ~ `1.0` | `number` |

**활용 시나리오:**
- **숨겨진 구역 공개** — Opacity를 0 → 1로 서서히 전환해 비밀 맵 공개
- **계절 테마** — `winter` 배리언트: 타일맵 색상을 흰색 계열로, `summer`: 초록색으로

---

### `GatrixFlagPhysicsMaterial2D`

`Collider2D`의 마찰력/탄성 또는 `PhysicsMaterial2D`를 교체합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `SwapMaterial` | Variant Map으로 에셋 매핑 | Variant Map |
| `Friction` | `0.0` (미끄러움) ~ `1.0` (거침) | `number` |
| `Bounciness` | `0.0` (반발 없음) ~ `1.0` (완전 탄성) | `number` |

**활용 시나리오:**
- **얼음 지형 테스트** — `friction = 0.05`(미끄) vs `0.4`(기본) — 클리어 시간 차이 비교
- **바운시 플랫폼** — `bounciness = 0.9` 배리언트로 충돌감 테스트

---

### `GatrixFlagJoint2D`

`Joint2D`의 활성화 여부와 파단 한계값을 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled 상태 | `boolean` |
| `BreakForce` | 파단 힘 (`50`, `500`, `Infinity`) | `number` |
| `BreakTorque` | 파단 토크 | `number` |

**활용 시나리오:**
- **파괴 가능 다리** — 파단 기능은 플래그로 켤 때만 활성화 (콘텐츠 실험)
- **난이도** — `extreme` 배리언트: breakForce = 50, `easy`: Infinity

---

### `GatrixFlagEffector2D`

`AreaEffector2D` / `PointEffector2D`의 활성화 여부와 힘 크기를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled 상태 | `boolean` |
| `ForceMagnitude` | 힘의 크기 (`5`, `25` 등) | `number` |

**활용 시나리오:**
- **바람 세기 A/B** — `strong` 배리언트: force = 25 vs `mild`: force = 8 — 좌절감 측정
- **폭풍 이벤트** — 라이브 이벤트 중 강한 반발장 활성화

---

## AI

### `GatrixFlagNavMeshObstacle`

`NavMeshObstacle`의 활성, 반지름, 높이를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled 상태 | `boolean` |
| `Radius` | 장애물 반지름 (`0.5`, `2.0`) | `number` |
| `Height` | 장애물 높이 | `number` |

**활용 시나리오:**
- **라이브 바리케이드** — 플래그 one-click으로 경로 차단 — 우회 경로 이용률 측정
- **접근성** — 쉬운 난이도 배리언트에서 radius를 줄여 AI 회피 공간 확보

---

### `GatrixFlagAIAnimator`

AI용 `Animator` 파라미터를 플래그 상태 및 배리언트에 따라 설정합니다.

| 파라미터 타입 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `Bool` | `true` / `false` | `boolean` |
| `Int` | 정수 (`0`, `1`, `2`) | `number` |
| `Float` | 실수 (`0.0` ~ `1.0`) | `number` |
| `Trigger` | 플래그 ON 시 실행 | `boolean` |

**활용 시나리오:**
- **AI 행동 전환** — `AIMode` 파라미터: `patrol=0`, `chase=1`, `retreat=2` 배리언트로 대시보드에서 전환
- **보스 페이즈** — `EnterPhase2` 트리거를 플래그 활성화 시 실행

---

### `GatrixFlagDetectionRange`

AI의 감지 반경과 시야각을 피처 플래그로 설정합니다.

| 속성 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `DetectionRange` | 반경 (`5.0`, `20.0`, `30.0`) | `number` |
| `DetectionAngle` | 반각 (°) (`60`, `90`, `180`) | `number` |

- 다른 AI 스크립트에서 `GetComponent<GatrixFlagDetectionRange>().CanDetect(target)` 호출 가능
- Scene 뷰에서 Gizmo로 범위 시각화 제공

**활용 시나리오:**
- **스텔스 밸런스** — `hard` 배리언트: range=25, angle=120 / `easy`: range=5, angle=60
- **보스 페이즈** — `super-alert` 플래그 → range=30, angle=180 (360도에 가까운 감지)

---

## Audio

### `GatrixFlagAudio`

`AudioSource`의 클립 교체 및 재생을 플래그로 제어합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| 클립 교체 | Variant Map에서 AudioClip 에셋 매핑 | Variant Map |
| 재생/정지 | 플래그 enabled 상태 | `boolean` |

**활용 시나리오:**
- 배리언트별 배경음악 교체 (에너지 수준 A/B)
- 기능 해금 시 효과음 재생

---

### `GatrixFlagAudioMixer`

`AudioMixer`의 노출된 파라미터 값(볼륨 dB, 리버브 등)을 플래그로 제어합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enabled 값 | dB 값 (`0`, `-10`, `-80`) | `number` |
| Disabled 값 | dB 값 | `number` |
| Variant Map | 배리언트명 → dB 값 | Variant Map |

> `-80` = 거의 무음, `0` = Unity 기준 음량, `+20` = 증폭 (AudioMixer 허용 범위 내)

**활용 시나리오:**
- **볼륨 A/B** — BGM을 `-10dB`로 낮춰 집중력 향상 여부 측정
- **온보딩 조용 모드** — 튜토리얼 플래그 활성 중 비주요 버스 음소거

---

### `GatrixFlagAudioSource`

`AudioSource`의 볼륨, 피치, 공간 블렌드, 우선순위를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `Mute` | 플래그 enabled 반전 | `boolean` |
| `Volume` | `0.0` ~ `1.0` | `number` |
| `Pitch` | `0.5` ~ `3.0` (1.0 = 기본) | `number` |
| `SpatialBlend` | `0.0` (2D) ~ `1.0` (3D) | `number` |
| `Priority` | `0` (최고) ~ `256` (최저) | `number` |

**활용 시나리오:**
- **피치 테스트** — `high` 배리언트: pitch=1.3 vs `normal`: pitch=1.0
- **3D 오디오 실험** — spatialBlend 0→1 전환으로 몰입감 비교

---

## Camera

### `GatrixFlagCamera`

`Camera`의 FOV, 배경색, 클리핑 거리, 뎁스를 제어합니다 (부드러운 전환 지원).

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `FieldOfView` | `45` ~ `120` (도) | `number` |
| `BackgroundColor` | HTML 색상 코드 (`#1A1A2E`) | `string` |
| `NearClipPlane` | `0.01` ~ `10.0` | `number` |
| `FarClipPlane` | `100` ~ `5000` | `number` |
| `Depth` | 정수 (`-1`, `0`, `1`) | `number` |

**활용 시나리오:**
- **FOV A/B** — `60`(영화적) vs `90`(광각) — 멀미 보고 건수 비교
- **모바일 최적화** — farClipPlane을 줄여 렌더링 비용 절감 실험

---

## Debug

### `GatrixFlagLogger`

플래그 상태 변경 시 Unity 콘솔에 로그를 출력합니다.

| 설정 | 설명 |
|---|---|
| Log Level | `Info`, `Warning`, `Error` |
| Prefix | 콘솔 필터용 접두사 (예: `[MyGame]`) |
| Log Value | 배리언트 Value도 출력할지 여부 |
| Log Reason | 평가 이유 출력 (`evaluated`, `override`, `bootstrap`) |

**출력 예시:**
```
[Gatrix] Flag 'hero-power' Changed: Enabled=True, Variant=powered, Value=200, Reason=evaluated
```

**활용 시나리오:**
- 코드 없이 플래그 동작 즉시 검증 (개발 중)
- QA 세션 중 임시 부착 → 테스트 후 제거

---

## Environment

### `GatrixFlagFog`

전역 `RenderSettings` 안개(enabled, density, color)를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleFog` | 플래그 enabled 상태 | `boolean` |
| `Density` | `0.001` ~ `0.1` (Exponential) | `number` |
| `Color` | HTML 색상 코드 (`#C8BEAA`) | `string` |

**활용 시나리오:**
- **공포 게임 Atmosphere A/B** — density=0.08(짙은 안개) vs 0.01 — 몰입감/불쾌감 비교
- **라이브 날씨 이벤트** — 짙은 안개 이벤트를 플래그 하나로 ON/OFF

---

### `GatrixFlagAmbientLight`

전역 `RenderSettings.ambientLight` 색상을 제어합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enabled Color | HTML 색상 코드 | `string` |
| Disabled Color | HTML 색상 코드 | `string` |
| Variant Map | 배리언트명 → Color | Variant Map |

> 色상 코드 형식: `#RRGGBB` 또는 `#RRGGBBAA`

**활용 시나리오:**
- **분위기 A/B** — 따뜻한 앰비언트(`#FFF4E0`) vs 차가운(`#D0E8FF`) — 사용자 선호도 측정
- **보스 아레나** — 짙은 빨간 앰비언트를 보스 페이즈에 플래그로 즉시 적용

---

### `GatrixFlagSkybox`

`RenderSettings.skybox` 재질을 교체합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enabled Skybox | Variant Map에서 Material 에셋 매핑 | Variant Map |

**활용 시나리오:**
- **시즌 이벤트** — 핼러윈 스카이박스를 플래그로 교체, 이벤트 종료 후 즉시 복원
- **마케팅 트레일러** — 특수 스카이박스를 코드 변경 없이 적용

---

### `GatrixFlagWindZone`

`WindZone`의 풍력과 난류를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled 상태 | `boolean` |
| `WindMain` | `0.0` ~ `10.0` | `number` |
| `WindTurbulence` | `0.0` ~ `5.0` | `number` |
| `Preset` | Variant Map에서 windMain+turbulence 쌍 매핑 | Variant Map |

**활용 시나리오:**
- **폭풍 이벤트** — `storm` 배리언트: windMain=5, turbulence=2
- **저사양 최적화** — 저사양 세그먼트에서 WindZone 비활성화로 성능 개선

---

## Lighting

### `GatrixFlagLight`

`Light`의 활성화, 강도, 색상, 범위를 제어합니다 (부드러운 전환 지원).

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled 상태 | `boolean` |
| `Intensity` | `0.0` ~ `8.0` | `number` |
| `Color` | HTML 색상 코드 (`#FF9040`) | `string` |
| `Range` | `1.0` ~ `100.0` | `number` |

**활용 시나리오:**
- **스포트라이트 연출** — intensity 0→5 부드럽게 전환해 등장 연출
- **색상 A/B** — 따뜻한 횃불(#FF6020) vs 차가운 형광(#40C0FF) 조명 선호도 비교
- **신규 유저 가이드** — range를 늘려 안내 조명을 멀리서도 보이게

---

## Logic

### `GatrixFlagToggle`

`GameObject.activeSelf`를 하나 이상의 오브젝트에 대해 토글합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enable Targets | 플래그 ON 시 active=true | `boolean` |
| Disable Targets | 플래그 ON 시 active=false (역방향) | `boolean` |

**활용 시나리오:**
- 프리미엄 UI 뱃지 표시/숨김
- 계절 장식 전역 활성화
- 튜토리얼 힌트 배리언트별 표시

---

### `GatrixFlagBehaviourEnabled`

`MonoBehaviour.enabled`를 제어합니다. `GameObject` 전체를 끄는 것이 아니라 **특정 컴포넌트만** 켜고 끕니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enable Targets | 플래그 ON 시 enabled=true | `boolean` |
| Disable Targets | 플래그 ON 시 enabled=false (역방향) | `boolean` |

**活활용 시나리오:**
- **AI 시스템 전환** — `AdvancedBT.enabled = true`, `SimpleFSM.enabled = false` 동시에
- **권한 기반 기능 제한** — 무료 유저에게 `PremiumShopUI` 컴포넌트 비활성화
- **충돌 방지** — 새 기능 활성화 시 레거시 컴포넌트 자동 비활성화

---

### `GatrixFlagEvent`

플래그 ON/OFF 시 인스펙터에서 구성한 `UnityEvent`를 실행합니다.

**활용 시나리오:**
- 기존 인스펙터 콜백 연결 — 코드 없이
- 애니메이션, UI 갱신, 효과음 등 트리거

---

### `GatrixFlagSceneRedirect`

플래그가 활성화될 때 지정된 씬으로 이동합니다.

**활용 시나리오:**
- 완전히 새로 디자인된 레벨 A/B 테스트
- 킬 스위치로 유지보수 화면 전환
- 베타 콘텐츠를 특정 세그먼트에만 공개

---

### `GatrixVariantSwitch`

현재 배리언트 이름에 따라 다른 자식 GameObject를 활성화합니다.

**활용 시나리오:**
- UI 레이아웃 교체 (대조군/실험군)
- 3D 모델 배리언트 스왑
- 버킷별 카메라 앵글 전환

---

### `GatrixEventListener`

SDK 수준 이벤트(ready, error, flag change)를 구독해 Unity Event를 실행합니다.

**활용 시나리오:**
- SDK 오류 시 연결 끊김 화면 표시
- 초기화 중 로딩 인디케이터 표시

---

## Navigation

### `GatrixFlagNavMeshAgent`

`NavMeshAgent`의 속도, 반지름, 정지 거리, 각속도를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled | `boolean` |
| `Speed` | `1.0` ~ `20.0` | `number` |
| `Radius` | `0.1` ~ `5.0` | `number` |
| `StoppingDistance` | `0.0` ~ `10.0` | `number` |
| `AngularSpeed` | `60` ~ `720` (도/초) | `number` |

**활용 시나리오:**
- **난이도** — `hard` speed=8, `easy` speed=3 — 대시보드에서 즉시 변경
- **군중 밀도 실험** — radius 축소로 더 촘촘한 군집 이동 테스트

---

## Physics

### `GatrixFlagRigidbody`

`Rigidbody`의 질량, 드래그, 각속도 드래그를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `Mass` | `0.1` ~ `1000` | `number` |
| `Drag` | `0.0` ~ `10.0` | `number` |
| `AngularDrag` | `0.0` ~ `10.0` | `number` |

---

### `GatrixFlagGravity`

전역 `Physics.gravity` 배율을 제어합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Scale Multiplier | `0.17`(달), `1.0`(기본), `1.5` | `number` |
| Variant Map | 배리언트명 → 배율 | Variant Map |

**활용 시나리오:**
- **달 이벤트** — `moon` 배리언트: scale=0.17 한정 이벤트
- **플랫포머 조정** — `1.5`(빠른 낙하) vs `0.8`(둥실) 느낌 비교

---

### `GatrixFlagCollider`

`Collider` 또는 `Collider2D`의 enabled 상태를 토글합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Toggle Enabled | 플래그 enabled 상태 | `boolean` |

---

## Post FX

### `GatrixFlagPostProcessVolume`

Post Processing Volume 가중치를 리플렉션으로 제어합니다 (URP, HDRP, Legacy PP 지원).

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enabled Weight | `0.0` ~ `1.0` | `number` |
| Disabled Weight | `0.0` ~ `1.0` | `number` |
| Variant Map | 배리언트명 → weight | Variant Map |

> `0.0` = 효과 없음, `1.0` = 최대 효과

**활용 시나리오:**
- **품질 A/B** — 블룸+뎁스오브필드 weight=1.0 vs 0.5 — 배터리/시각 품질 교환 측정
- **공포 분위기** — 비네트 weight를 `horror-mode` 플래그와 함께 점진적으로 증가
- **성능 게이팅** — 저사양 세그먼트에서 weight=0으로 후처리 완전 비활성화

---

## Rendering

### `GatrixFlagMaterial`

`Renderer`의 머티리얼을 교체하거나 속성을 변경합니다.

**활용 시나리오:**
- 시즌 이벤트용 특별 머티리얼 교체
- 메탈릭 vs 매트 표면 A/B 테스트

---

### `GatrixFlagShaderProperty`

`Material` 인스턴스의 셰이더 프로퍼티를 개별적으로 설정합니다.

| 타입 | 사용되는 값 | Gatrix Value Type | 셰이더 예시 |
|---|---|---|---|
| `Float` | `0.0` ~ `1.0` | `number` | `_Metallic`, `_Smoothness`, `_Wetness` |
| `Color` | `#RRGGBB` | `string` | `_EmissionColor`, `_BaseColor` |
| `Int` | 정수 | `number` | `_Mode` |
| `Keyword` | 플래그 enabled 상태 | `boolean` | `EMISSION`, `USE_PARALLAX` |

**활용 시나리오:**
- **이미시브 게이팅** — `EMISSION` 키워드 ON + `_EmissionColor = #FFFF00` — 아이템 글로우 A/B
- **우천 효과** — `_Wetness = 1.0` — `rain-event` 플래그로 모든 머티리얼 동시에 젖은 효과
- **고사양 셰이더 기능** — `USE_PARALLAX` 키워드를 고사양 세그먼트에만 활성화

---

### `GatrixFlagQualitySettings`

Unity `QualitySettings`를 피처 플래그로 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `QualityLevel` | 인덱스 정수 (`0`~`5`+) | `number` 또는 Variant Map |
| `ShadowDistance` | 미터 (`40`, `100`, `150`) | `number` |
| `LodBias` | `0.5` ~ `3.0` | `number` |
| `AnisotropicFiltering` | 플래그 enabled 상태 | `boolean` |
| `PixelLightCount` | `1` ~ `8` | `number` |
| `SoftParticles` | 플래그 enabled 상태 | `boolean` |
| `RealtimeReflectionProbes` | 플래그 enabled 상태 | `boolean` |

> Quality Level 인덱스는 **Project Settings → Quality** 의 순서와 일치합니다.

**활용 시나리오:**
- **디바이스 등급별 품질** — 고사양: level=5, 중사양: level=2 → 세그먼트 플래그로 자동 적용
- **배터리 절약** — shadowDistance 150→40, 리얼타임 반사 비활성화 — 배터리 소모 측정
- **LOD 실험** — lodBias=2.0(고해상도) vs 1.0(기본) — 시각 품질 인식 차이 연구

---

### `GatrixFlagTrailRenderer`

`TrailRenderer`의 활성화, 지속 시간, 너비, 색상을 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled | `boolean` |
| `Time` | `0.1` ~ `5.0` (초) | `number` |
| `StartWidth` | `0.01` ~ `1.0` | `number` |
| `StartColor` | `#RRGGBB` | `string` |

**활용 시나리오:**
- **프리미엄 트레일** — 유료 유저에게만 특별 색상 트레일 제공
- **지속 시간 A/B** — `2.0`초(극적) vs `0.5`초(절제) — 만족도 측정

---

### `GatrixFlagLineRenderer`

`LineRenderer`의 활성화, 너비, 색상을 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled | `boolean` |
| `StartWidth` | `0.01` ~ `1.0` | `number` |
| `StartColor` / `EndColor` | `#RRGGBB` | `string` |

**활용 시나리오:**
- **경로 시각화** — 조준 보조 배리언트에서만 궤도 선 표시
- **접근성 라인 두께** — 두꺼운(0.2) vs 얇은(0.05) 라인 가독성 비교

---

### `GatrixFlagGlobalShader`

`Shader.SetGlobalFloat/Color/Int/Vector` 전역 셰이더 프로퍼티를 설정합니다.  
**해당 프로퍼티를 사용하는 모든 머티리얼에 즉시 반영됩니다.**

| 타입 | 사용되는 값 | Gatrix Value Type | 전역 프로퍼티 예시 |
|---|---|---|---|
| `Float` | `0.0` ~ `1.0` | `number` | `_GlobalWetness`, `_TimeOfDay` |
| `Color` | `#RRGGBB` | `string` | `_FogColor`, `_GlobalTint` |
| `Int` | `0` / `1` | `number` | `_EnableFeature` |
| `Vector` | `(x, y, z, w)` | — (인스펙터에서 직접 설정) | `_WindDirection` |

**활용 시나리오:**
- **씬 전체 우천** — `_GlobalWetness = 1.0` → 모든 드라이버/도로/캐릭터 머티리얼이 동시에 젖음
- **시간대 드라이버** — `_TimeOfDay`: `morning=0.25`, `noon=0.5`, `night=0.9` — 하늘/지형 셰이더 동기화
- **전역 안개 색상** — `_FogColor` = 대기 이벤트 색상
- **저사양 성능** — `_EnableFeature = 0`으로 고비용 셰이더 패스 일괄 비활성화

---

### `GatrixFlagSpriteRenderer`

`SpriteRenderer`의 스프라이트, 색상, 활성화를 제어합니다.

**활용 시나리오:**
- 배리언트별 캐릭터 스킨 교체
- 상태효과 틴트 (독=초록, 화상=빨강) 플래그로 제어

---

### `GatrixFlagRendererToggle`

`Renderer`의 enabled 상태를 토글합니다.

**활용 시나리오:**
- 미니멀 UI 실험에서 3D 장식 모델 숨기기
- 성능 실험에서 장식 메시 표시/숨김

---

### `GatrixFlagParticles`

`ParticleSystem` 재생을 제어합니다.

**활용 시나리오:**
- 이벤트 성공 시 폭죽 파티클 활성화
- 앰비언트 파티클 성능 영향 A/B 측정

---

### `GatrixFlagTransform`

`Transform`의 로컬 위치, 회전, 스케일을 배리언트에 따라 설정합니다.

**활용 시나리오:**
- UI 요소 위치 A/B 테스트
- 기능 뱃지 강조 스케일 실험

---

## Time

### `GatrixFlagTimeScale`

`Time.timeScale`을 플래그로 제어합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enabled Value | `0.3`(슬로우), `1.0`(기본), `1.5`(빠름) | `number` |
| Variant Map | 배리언트명 → timeScale 값 | Variant Map |

**활용 시나리오:**
- **불릿 타임** — `timeScale = 0.3`, 프리미엄 유저만 활성화
- **속도 A/B** — `1.5`(빠른 진행) vs `1.0`(기본) — 세션 길이 차이 측정
- **모달 표시 중 일시정지** — `timeScale = 0`

---

### `GatrixFlagFrameRate`

`Application.targetFrameRate`를 플래그로 제어합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enabled FPS | `30`, `60`, `120`, `-1`(무제한) | `number` |
| Variant Map | 배리언트명 → FPS 값 | Variant Map |

**활용 시나리오:**
- **배터리 A/B** — 30fps 코호트 vs 60fps 코호트 — 배터리 소모, 이탈률 비교
- **디바이스 등급** — 저사양 세그먼트: `targetFrameRate = 30`
- **녹화 모드** — `-1`(무제한)으로 스크린샷/영상 품질 극대화

---

## UI

### `GatrixFlagValue`

`TextMeshProUGUI` 또는 `Text`에 플래그 배리언트 값을 바인딩합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Variant Value | 표시할 문자열 | `string` (또는 `number` → 자동 변환) |

**활용 시나리오:**
- 빌드 없이 서버에서 프로모션 문구 교체
- 버튼 레이블/헤드라인 카피 A/B
- 디버그용 배리언트명 또는 평가 이유 표시

---

### `GatrixFlagColor`

`Graphic` 또는 `Renderer` 컴포넌트를 플래그 상태/배리언트에 따라 틴팅합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Enabled Color | HTML 색상 코드 | `string` |
| Variant Map | 배리언트명 → Color | Variant Map |

---

### `GatrixFlagImage`

UI `Image` 스프라이트 또는 fill amount를 교체합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Sprite 교체 | Variant Map에서 Sprite 에셋 매핑 | Variant Map |
| Fill Amount | `0.0` ~ `1.0` | `number` |

---

### `GatrixFlagCanvas`

`Canvas`의 활성화 여부와 소팅 오더를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled | `boolean` |
| `SortingOrder` | 정수 | `number` |

---

### `GatrixFlagSlider`

`Slider`의 값과 상호작용 가능 여부를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `SetValue` | `0.0` ~ `1.0` | `number` |
| `ToggleInteractable` | 플래그 enabled | `boolean` |

---

### `GatrixFlagButtonInteractable`

`Button.interactable` 상태를 토글합니다.

| 설정 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| Toggle | 플래그 enabled 상태 | `boolean` |

**활용 시나리오:**
- 프리미엄 액션("캐릭터 잠금 해제") 엔타이틀먼트 플래그로 게이팅
- 시스템 점검 중 제출 버튼 비활성화

---

### `GatrixFlagInputField`

`InputField` 플레이스홀더 텍스트, 글자 수 제한, 상호작용 여부를 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleInteractable` | 플래그 enabled | `boolean` |
| `PlaceholderText` | 표시할 문자열 | `string` |
| `CharacterLimit` | 최대 글자 수 (`100`, `280`) | `number` |

> 플레이스홀더 텍스트는 `string` 타입 배리언트 값으로 직접 입력 가능합니다.

**활용 시나리오:**
- **카피 A/B** — `"영웅을 검색하세요..."` vs `"무엇을 찾고 계신가요?"` — 검색 사용률 측정
- **글자 수 실험** — 100자 vs 280자 제한 — 리뷰 품질 비교
- **비회원 게이팅** — 미로그인 유저 인풋 비활성화

---

### `GatrixFlagScrollRect`

`ScrollRect`의 활성화, 스크롤 감도, 관성, 축 잠금을 제어합니다.

| 모드 | 사용되는 값 | Gatrix Value Type |
|---|---|---|
| `ToggleEnabled` | 플래그 enabled | `boolean` |
| `ScrollSensitivity` | `1.0` ~ `50.0` | `number` |
| `ToggleInertia` | 플래그 enabled | `boolean` |
| `ToggleHorizontal` | 플래그 enabled | `boolean` |
| `ToggleVertical` | 플래그 enabled | `boolean` |

**활용 시나리오:**
- **감도 A/B** — `15`(빠름) vs `5`(정밀) — 스크롤 오류 빈도 측정
- **관성 실험** — 관성 ON vs OFF — 페이지 기반 리스트에서 오버슈트 불만 비교
- **축 잠금** — 튜토리얼 스크롤 뷰에서 수평 스크롤 비활성화 — 코드 수정 없이

---

*Gatrix Unity SDK — Zero-Code 컴포넌트 레퍼런스 (한국어)*
