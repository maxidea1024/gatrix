"""
Script to compress README.ko.md by replacing long sections with summary+link blocks.
Run from the gatrix-unity-sdk root directory.
"""
import re


def replace_section(text, start_header, replacement_block):
    escaped = re.escape(start_header)
    pattern = escaped + r'.*?(?=\n---\n\n## |\n## (?!#)|\Z)'
    rx = re.compile(pattern, re.DOTALL)
    if rx.search(text):
        return rx.sub(replacement_block.rstrip(), text, count=1)
    return text


with open('README.ko.md', encoding='utf-8') as f:
    content = f.read()

# Fix image paths
content = content.replace('doc/images/', 'docs/images/')

# ─── 1. 평가 모델 섹션 → 요약 + 링크 ───────────────────────────────────────
eval_replacement = '''## 🏗️ 평가 모델: 원격 평가 전용

Gatrix는 **원격 평가** 방식만을 사용합니다 — 타게팅 규칙과 롤아웃 로직은 절대 서버 밖으로 나가지 않습니다.

1. SDK가 **컨텍스트**(userId, env, properties)를 서버로 전송
2. 서버가 모든 규칙을 평가하고 **최종 플래그 값만** 반환
3. SDK가 결과를 캐시하고 동기적으로 제공

| | 원격 평가 (Gatrix) | 로컬 평가 |
|---|---|---|
| **보안** | ✅ 규칙이 서버 밖으로 나가지 않음 | ⚠️ 클라이언트에 규칙 노출 |
| **일관성** | ✅ 모든 SDK에서 동일한 결과 | ⚠️ 각 SDK가 규칙을 재구현해야 함 |
| **페이로드** | ✅ 소규모 (최종 값만) | ⚠️ 대규모 (전체 규칙 세트) |
| **오프라인** | ⚠️ 초기 페치 필요 (이후 캐시) | ✅ 첫 다운로드 이후 가능 |

> 🌐 **오프라인 & 가용성:** SDK는 서버에 연결할 수 없을 때 항상 로컬 캐시에서 값을 제공합니다. fallbackValue로 네트워크 문제로 인한 게임 중단은 절대 발생하지 않습니다.

> 📖 전체 상세 내용 — 값 리졸루션 흐름, 예약 배리언트 이름(`$missing`, `$env-default-enabled` ...), `fallbackValue` 설계 이유:  
> **[docs/EVALUATION_MODEL.ko.md](docs/EVALUATION_MODEL.ko.md)**'''

content = replace_section(content, '## 🏗️ 평가 모델: 원격 평가 전용', eval_replacement)

# ─── 2. 플래그 값 리졸루션 섹션 → 제거 (EVALUATION_MODEL.ko.md에 포함) ───
content = replace_section(content, '## 🔍 플래그 값 리졸루션 흐름', '')

# ─── 3. Watch 섹션 → 요약 + 링크 ────────────────────────────────────────
watch_replacement = '''## 👁️ 변경 감지 (Watch)

Gatrix는 두 가지 Watch 방식을 제공합니다:

| 메서드 | 콜백 발생 시점 |
|---|---|
| `WatchRealtimeFlag` | 서버 페치 후 즉시 |
| `WatchSyncedFlag` | `SyncFlagsAsync()` 호출 시 (`ExplicitSyncMode = true`일 때) |

```csharp
var features = GatrixBehaviour.Client.Features;

// 리얼타임 — 변경 즉시 발생 (디버그 UI, 비게임플레이용)
features.WatchRealtimeFlagWithInitialState("dark-mode", proxy =>
{
    ApplyTheme(proxy.Enabled ? "dark" : "light");
});

// 동기화 — SyncFlagsAsync() 호출 시 발생 (게임플레이 안전)
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringVariation("normal"));
});

// 안전한 시점에 적용 (로딩 화면, 라운드 사이)
await features.SyncFlagsAsync();
```

> 📖 전체 Watch API 레퍼런스 — `FlagProxy` 속성, API 표, Watch 그룹, `forceRealtime`, 실전 동기화 시나리오:  
> **[docs/WATCH_API.ko.md](docs/WATCH_API.ko.md)**'''

content = replace_section(content, '## 👁️ 변경 감지 (Watch)', watch_replacement)

# ─── 4. 제로 코드 컴포넌트 → COMPONENTS.ko.md 링크로 대체 ─────────────────
components_replacement = '''## 🧩 제로 코드 컴포넌트 (Zero-Code Components)

C# 코드 없이 Unity 씬 속성을 피처 플래그에 바인딩합니다.

추가 방법: **우클릭 → Gatrix → UI / Logic / Debug / Visual / Audio / Rendering / AI / Environment...**

![Context Menu - Gatrix Components](docs/images/context-menu-gatrix-ui.png)

**제공 컴포넌트 카테고리:**

| 카테고리 | 컴포넌트 |
|---|---|
| **Logic** | `GatrixFlagToggle`, `GatrixFlagEvent`, `GatrixEventListener`, `GatrixVariantSwitch`, `GatrixFlagSceneRedirect`, `GatrixFlagBehaviourEnabled` |
| **UI** | `GatrixFlagValue`, `GatrixFlagImage`, `GatrixFlagColor`, `GatrixFlagCanvas`, `GatrixFlagSlider`, `GatrixFlagButtonInteractable`, `GatrixFlagInputField`, `GatrixFlagScrollRect` |
| **Rendering** | `GatrixFlagMaterial`, `GatrixFlagTransform`, `GatrixFlagSpriteRenderer`, `GatrixFlagRendererToggle`, `GatrixFlagParticles`, `GatrixFlagQualitySettings`, `GatrixFlagShaderProperty`, `GatrixFlagTrailRenderer`, `GatrixFlagLineRenderer`, `GatrixFlagGlobalShader` |
| **Audio** | `GatrixFlagAudio`, `GatrixFlagAnimator`, `GatrixFlagAudioMixer`, `GatrixFlagAudioSource` |
| **Camera** | `GatrixFlagCamera` |
| **Lighting** | `GatrixFlagLight` |
| **Environment** | `GatrixFlagFog`, `GatrixFlagAmbientLight`, `GatrixFlagSkybox`, `GatrixFlagWindZone` |
| **Physics** | `GatrixFlagRigidbody`, `GatrixFlagGravity`, `GatrixFlagCollider` |
| **2D** | `GatrixFlagRigidbody2D`, `GatrixFlagSortingOrder`, `GatrixFlagTilemap`, `GatrixFlagPhysicsMaterial2D`, `GatrixFlagJoint2D`, `GatrixFlagEffector2D` |
| **AI** | `GatrixFlagNavMeshAgent`, `GatrixFlagNavMeshObstacle`, `GatrixFlagAIAnimator`, `GatrixFlagDetectionRange` |
| **Time** | `GatrixFlagTimeScale`, `GatrixFlagFrameRate` |
| **Post FX** | `GatrixFlagPostProcessVolume` |
| **Debug** | `GatrixFlagLogger` |

> 📖 컴포넌트 상세 레퍼런스 — 플래그 값 타입, 각 모드별 설명, 활용 시나리오:  
> **[docs/COMPONENTS.ko.md](docs/COMPONENTS.ko.md)**'''

content = replace_section(content, '## 🧩 제로 코드 컴포넌트', watch_replacement)

# Fix the 제로코드 section (different header)
content = replace_section(content, '## 🧩 제로 코드 컴포넌트 (Zero-Code Components)', components_replacement)

with open('README.ko.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("README.ko.md compressed successfully.")
print(f"Final size: {len(content)} chars")
