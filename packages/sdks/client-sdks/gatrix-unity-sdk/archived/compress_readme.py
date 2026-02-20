"""
Script to compress README.md by replacing long sections with summary+link blocks.
Run from the gatrix-unity-sdk root directory.
"""
import re

# ───────────────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────────────

def replace_between(text, start_pattern, end_pattern, replacement, flags=re.DOTALL):
    """Replace content between start_pattern (inclusive) and end_pattern (exclusive)."""
    rx = re.compile(start_pattern + r'.*?' + end_pattern, flags)
    return rx.sub(replacement + '\n\n' + end_pattern.replace(r'\n', '\n').replace('(.*?)', ''), text, count=1)


def replace_section(text, start_header, replacement_block):
    """
    Replace from start_header up to (but not including) the next same-level '## ' header or EOF.
    Also handles '---\n\n##' pattern as delimiter.
    """
    # Escape special regex chars in the start_header
    escaped = re.escape(start_header)
    # Match from start_header to the next ## at the same level (or end)
    pattern = escaped + r'.*?(?=\n---\n\n## |\n## (?!#)|\Z)'
    rx = re.compile(pattern, re.DOTALL)
    if rx.search(text):
        return rx.sub(replacement_block.rstrip(), text, count=1)
    return text


# ───────────────────────────────────────────────────────────────────────────
# Load
# ───────────────────────────────────────────────────────────────────────────

with open('README.md', encoding='utf-8') as f:
    content = f.read()

# ───────────────────────────────────────────────────────────────────────────
# 1. Evaluation Model section → short summary + link
# ───────────────────────────────────────────────────────────────────────────
eval_replacement = '''## 🏗️ Evaluation Model: Remote Evaluation Only

Gatrix uses **remote evaluation** exclusively — targeting rules and rollout logic never leave the server.

1. SDK sends **context** (userId, env, properties) to the server
2. Server evaluates all rules and returns **final flag values only**
3. SDK caches results and serves them synchronously

| | Remote (Gatrix) | Local Evaluation |
|---|---|---|
| **Security** | ✅ Rules never leave server | ⚠️ Rules exposed to client |
| **Consistency** | ✅ Same result on all SDKs | ⚠️ SDK must re-implement rules |
| **Payload** | ✅ Small (final values only) | ⚠️ Large (full rule set) |
| **Offline** | ⚠️ Needs initial fetch (then cached) | ✅ Works after first download |

> 🌐 **Offline & Availability:** The SDK always serves from local cache if the server is unreachable. Fallback values ensure the game never crashes due to connectivity issues.

> 📖 Full details — value resolution flow, reserved variant names (`$missing`, `$env-default-enabled`, …), and `fallbackValue` rationale:  
> **[docs/EVALUATION_MODEL.md](docs/EVALUATION_MODEL.md)**'''

content = replace_section(content, '## 🏗️ Evaluation Model: Remote Evaluation Only', eval_replacement)

# ───────────────────────────────────────────────────────────────────────────
# 2. Flag Value Resolution Flow → remove entirely (it's in EVALUATION_MODEL.md)
# ───────────────────────────────────────────────────────────────────────────
# This section is already covered by EVALUATION_MODEL.md
content = replace_section(content, '## 🔍 Flag Value Resolution Flow', '')

# ───────────────────────────────────────────────────────────────────────────
# 3. Watch API — keep intro + code examples, replace long detail with link
# ───────────────────────────────────────────────────────────────────────────
watch_replacement = '''## 👁️ Watching for Changes

Gatrix provides two families of watch methods:

| Method family | When callback fires |
|---|---|
| `WatchRealtimeFlag` | Immediately on every server fetch |
| `WatchSyncedFlag` | Only after `SyncFlagsAsync()` (when `ExplicitSyncMode = true`) |

```csharp
var features = GatrixBehaviour.Client.Features;

// Realtime — fires on every change (good for debug UI, non-gameplay props)
features.WatchRealtimeFlagWithInitialState("dark-mode", proxy =>
{
    ApplyTheme(proxy.Enabled ? "dark" : "light");
});

// Synced — fires only when YOU call SyncFlagsAsync (safe for gameplay)
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringVariation("normal"));
});

// Apply at a safe moment (loading screen, between rounds)
await features.SyncFlagsAsync();
```

> 📖 Full Watch API reference — `FlagProxy` properties, `FlagProxy` API table, Watch Groups, `forceRealtime`, and real-world sync scenarios:  
> **[docs/WATCH_API.md](docs/WATCH_API.md)**'''

content = replace_section(content, '## 👁️ Watching for Changes', watch_replacement)

# ───────────────────────────────────────────────────────────────────────────
# 4. Zero-Code Components — replace individual component docs with link
# ───────────────────────────────────────────────────────────────────────────
components_replacement = '''## 🧩 Zero-Code Components

Drop these `MonoBehaviour` components onto any GameObject — no scripting required.

Add via: **Right-click → Gatrix → UI / Logic / Debug / Visual / Audio / Rendering / AI / Environment...**

![Context Menu - Gatrix Components](docs/images/context-menu-gatrix-ui.png)

**Available component categories:**

| Category | Components |
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

> 📖 Detailed component reference — flag value types, all modes, use cases & A/B test scenarios:  
> **[docs/COMPONENTS.md](docs/COMPONENTS.md)**'''

content = replace_section(content, '## 🧩 Zero-Code Components', components_replacement)

# ───────────────────────────────────────────────────────────────────────────
# Save
# ───────────────────────────────────────────────────────────────────────────
with open('README.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("README.md compressed successfully.")
print(f"Final size: {len(content)} chars")
