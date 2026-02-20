# Gatrix Unity SDK — Zero-Code Components Reference (English)

> These **Zero-Code components** let you bind Unity scene properties directly to Gatrix feature flags **without writing any C# code**. Attach a component, enter a flag name, and configure values in the Inspector.

---

## Table of Contents

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

## Flag Value Types

Every Gatrix component reads `flag.Variant.Value` to determine what to apply.  
When configuring a flag in the Gatrix dashboard, use the following value types:

| Gatrix Type | C# type read | Example values | Common use |
|---|---|---|---|
| `boolean` | `bool` | `true`, `false` | Toggle / enabled state |
| `number` | `float` / `int` | `0.17`, `60`, `3.5` | Gravity, FOV, speed, volume |
| `string` | `string` | `"moon"`, `"#FF4444"`, `"Enter text..."` | Color codes, placeholder text, variant names |
| `json` | `Dictionary<string,object>` | `{"x":0,"y":1}` | Complex presets |

> **Color values** — always use `string` type with an HTML hex code: `#RRGGBB` or `#RRGGBBAA`.  
> **Variant Name matching** — each component's Variant Map compares `flag.Variant.Name` (the variant key, e.g. `"hard"`) to drive the value lookup before falling back to `flag.Variant.Value`.

---

## Common Inspector Fields

All components expose these shared fields:

| Field | Description |
|---|---|
| **Flag Name** | Gatrix flag key (case-sensitive, matches dashboard) |
| **Use Realtime** | `true` = update immediately on server push; `false` = wait for explicit `SyncFlags()` |

> **Subscription identity** format: `ComponentType:ObjectName(#instanceId)`  
> The `instanceId` ensures components on objects with the same name (e.g. multiple `Enemy` prefabs) are tracked independently in SDK watch logs.

---

## Core

### `GatrixFlagComponentBase`

Abstract base class for all Gatrix flag-binding components. Not used directly.

Handles flag subscription/unsubscription lifecycle and calls `OnFlagChanged(FlagProxy)` on every state or variant change.

---

## 2D

### `GatrixFlagRigidbody2D`

Controls a `Rigidbody2D`'s physics properties via a feature flag.

**Modes:** `ToggleSimulated`, `GravityScale`, `Mass`, `LinearDrag`, `AngularDrag`, `BodyType`

**Use Cases & Scenarios:**
- **A/B gravity mechanics** — test a "low gravity" variant (`gravityScale = 0.3`) against default for a platformer. Measure jump height preference without a build.
- **Cutscene freeze** — toggle `simulated = false` during story scenes via a flag to stop physics without destroying objects.
- **Body type gating** — switch between `Dynamic` and `Kinematic` per variant to test a stealth mechanic (kinematic = no physics push).

> **Scenario:** Flag `low-gravity-test` enabled, variant `moon` → `gravityScale = 0.17`. Players float more. Jump height analytics measured per segment.

---

### `GatrixFlagSortingOrder`

Controls `Renderer` sorting layer and order-in-layer.

**Modes:** `OrderInLayer`, `SortingLayerName`

**Use Cases & Scenarios:**
- **Badge depth** — A/B test whether a "Featured" badge renders above or below the character art for visual clarity.
- **Dynamic depth** — bring an NPC to the foreground in a story event by elevating its sorting order when a flag is enabled.
- **Theming** — switch foreground/background layer assignments per variant for different visual themes without rebuilding.

> **Scenario:** Flag `foreground-hero` → hero `sortingOrder = 10`. Disabled → `sortingOrder = 0`.

---

### `GatrixFlagTilemap`

Controls `Tilemap` color, opacity, and renderer enabled state.

**Modes:** `ToggleRenderer`, `Color`, `Opacity` (with optional animate)

**Use Cases & Scenarios:**
- **Reveal mechanic** — fade in a secret map zone from opacity 0 → 1 when a `reveal-hidden-zone` flag is enabled.
- **Seasonal theme** — tint tilemap from green (summer) to white-blue (winter) per variant — global change, no patch.
- **Danger zone** — tint a hazard area red (`Color.red`) when a hazard-mode flag is active.

> **Scenario:** Flag `winter-theme` variant `snow` → tilemap color = `Color(0.85, 0.95, 1.0)`. Flag off → original color.

---

### `GatrixFlagPhysicsMaterial2D`

Swaps `PhysicsMaterial2D` or adjusts friction/bounciness on `Collider2D`.

**Modes:** `SwapMaterial`, `Friction`, `Bounciness`

**Use Cases & Scenarios:**
- **Ice surface** — A/B test friction = 0.05 (slippery) vs. 0.4 (normal) for a winter level. Measure completion rate difference.
- **Bouncy platforms** — enable `bouncy-arena` flag to set bounciness = 0.9 on all arena platforms without rebuilding.
- **Difficulty tuning** — `hard` variant = friction 0.1 (harder to control), `easy` = 0.6 (stable).

---

### `GatrixFlagJoint2D`

Controls `Joint2D` enabled state, break force, and break torque.

**Modes:** `ToggleEnabled`, `BreakForce`, `BreakTorque`

**Use Cases & Scenarios:**
- **Breakable bridges** — enable joint breakability only when a `destructible-bridges` experiment flag is on.
- **Difficulty via break threshold** — `easy` = breakForce 10000 (unbreakable), `extreme` = 50 (snaps easily).
- **Rope gating** — toggle rope physics for a physics-puzzle feature gate.

---

### `GatrixFlagEffector2D`

Controls `AreaEffector2D` / `PointEffector2D` enabled state and force magnitude.

**Modes:** `ToggleEnabled`, `ForceMagnitude`

**Use Cases & Scenarios:**
- **Wind A/B test** — strong wind (force = 25) vs. gentle (force = 5) in a side-scroller. Measure frustration reports.
- **Storm event** — enable a powerful repulsion field during a timed live event.
- **Gravity well** — toggle a point effector attracting collectibles toward the player as a premium feature.

---

## AI

### `GatrixFlagNavMeshObstacle`

Controls `NavMeshObstacle` enabled state, radius, and height.

**Modes:** `ToggleEnabled`, `Radius`, `Height`

**Use Cases & Scenarios:**
- **Dynamic barriers** — enable/disable a blockade obstacle via flag. Measure if the shortcut removal improves level completion time.
- **Event obstacles** — create physical barriers during a live event without a build.
- **Accessibility** — reduce radius in `low-difficulty` variant so AI navigation paths around the player more loosely.

> **Scenario:** Flag `blockade-event` → obstacle enabled + carving on. Players reroute. Analytics captures engagement change.

---

### `GatrixFlagAIAnimator`

Sets `Animator` parameters (bool, int, float, trigger) from flag state and variant.

**ParamTypes:** `Bool`, `Int`, `Float`, `Trigger`

**Use Cases & Scenarios:**
- **AI behavior switching** — set `AIMode` int: variant `patrol = 0`, `chase = 1`, `retreat = 2`. Switch entire AI behavior from dashboard.
- **Alert state A/B** — test aggressive AI state (`chase`) vs. passive — measure whether player retention drops.
- **Cinematic trigger** — fire `EnterCutscene` trigger when a narrative flag is enabled.

---

### `GatrixFlagDetectionRange`

Exposes a configurable AI detection radius and field-of-view angle controlled by feature flags.

**Properties:** `DetectionRange`, `DetectionAngle`, `CanDetect(target)`, Scene Gizmo

**Use Cases & Scenarios:**
- **Stealth balance** — A/B test wide range (20m, 120°) vs. narrow (10m, 60°) detection for player experience balance.
- **Difficulty variants** — `easy` = range 5m, `hard` = 25m, `extreme` = 30m + 180° — all from dashboard.
- **Boss fight mechanic** — enable `super-alert` flag during phase 2 to dramatically increase enemy awareness.

> **Scenario:** Flag `hard-detection` variant `extreme` → range = 30, angle = 180°. AI scripts call `CanDetect(player)` using live values.

---

## Audio

### `GatrixFlagAudio`

Controls `AudioSource` clip selection and playback via flag state.

**Use Cases:**
- Swap background music clip per variant (A/B test soundtrack energy)
- Play a sound effect when a feature unlocks
- Mute voiceover when tutorial flag is disabled

---

### `GatrixFlagAudioMixer`

Sets an `AudioMixer` exposed parameter (volume, reverb send, etc.) via a feature flag with smooth lerp.

**Use Cases & Scenarios:**
- **Volume A/B test** — reduce background music by 10dB (`-10`) to see if puzzle focus improves.
- **Cave acoustics** — increase reverb send for a cave room only when `cave-acoustics` flag is enabled.
- **Onboarding quiet mode** — silence non-essential audio buses while first-run tutorial flag is active.

> **Scenario:** Flag `quiet-bgm` → `MasterBGM = -15dB`. Users in this segment report less distraction.

---

### `GatrixFlagAudioSource`

Controls `AudioSource` volume, pitch, spatial blend, and priority.

**Modes:** `Mute`, `Volume`, `Pitch`, `SpatialBlend`, `Priority`

**Use Cases & Scenarios:**
- **Pitch test** — `pitch = 1.2` (energetic) vs. `pitch = 0.9` (calm) for ambient sounds.
- **3D audio experiment** — switch `spatialBlend: 0` (2D) → `1` (3D) per variant for spatial audio studies.
- **Mute gating** — mute non-critical sound layer during a timed special event flag.

---

## Camera

### `GatrixFlagCamera`

Controls `Camera` FOV, background color, clip planes, and depth via flag with optional lerp animation.

**Modes:** `FieldOfView`, `BackgroundColor`, `NearClipPlane`, `FarClipPlane`, `Depth`

**Use Cases & Scenarios:**
- **FOV A/B test** — compare FOV = 60 (cinematic) vs. FOV = 90 (wide). Measure comfort and motion sickness reports.
- **Atmosphere switch** — background changes from night-sky black to sunset orange per variant for a seasonal event.
- **Mobile performance** — reduce `farClipPlane` for mobile-tier segments without shipping a new build.

---

## Debug

### `GatrixFlagLogger`

Logs flag state, variant name, value, and evaluation reason to the Unity Console.

**Log outputs:** `Enabled`, `Variant`, `Value`, `Reason` (e.g., `evaluated`, `override`, `bootstrap`)

**Use Cases & Scenarios:**
- **Dev verification** — confirm a flag changes correctly during development without writing debug code.
- **QA monitoring** — temporarily add to any GameObject during QA; remove before shipping.
- **Reason tracking** — verify if evaluation comes from server, local cache, manual override, or bootstrap flags.

> **Output example:**  
> `[Gatrix] Flag 'hero-power' Changed: Enabled=True, Variant=powered, Value=200, Reason=evaluated`

---

## Environment

### `GatrixFlagFog`

Controls global `RenderSettings` fog enabled state, density, and color.

**Modes:** `ToggleFog`, `Density`, `Color` (with optional animate)

**Use Cases & Scenarios:**
- **Atmosphere A/B** — heavy fog (density 0.08) vs. clear air — measure immersion vs. frustration in horror game.
- **Live weather event** — enable thick fog during a timed server-side event.
- **Season theming** — `winter` = light mist; `summer` = no fog.

---

### `GatrixFlagAmbientLight`

Controls global `RenderSettings.ambientLight` color via flag with optional lerp.

**Use Cases & Scenarios:**
- **Mood A/B** — warm (`#FFF4E0`) vs. cool (`#D0E8FF`) ambient light — compare user comfort ratings.
- **Boss arena** — darken to deep red ambient during a boss phase via flag, reverting instantly when done.
- **Platform calibration** — adjust ambient brightness for different display brightness targets without a release.

---

### `GatrixFlagSkybox`

Swaps `RenderSettings.skybox` material via flag.

**Use Cases & Scenarios:**
- **Seasonal events** — switch default skybox to dark storm skybox for Halloween, revert with one flag toggle.
- **Time-of-day A/B** — test sunset skybox vs. noon sky for immersion studies.
- **Marketing shoots** — enable a branded/custom skybox for trailers via flag — no code involvement from developers.

---

### `GatrixFlagWindZone`

Controls `WindZone` strength and turbulence.

**Modes:** `ToggleEnabled`, `WindMain`, `WindTurbulence`, `Preset`

**Use Cases & Scenarios:**
- **Storm event** — `storm` variant: windMain = 5, turbulence = 2 during a live event.
- **Season effects** — `autumn` = gentle breeze, `winter` = strong gusts.
- **Performance test** — disable wind for low-end device segments via flag to improve frame rate.

---

## Lighting

### `GatrixFlagLight`

Controls `Light` enabled state, intensity, color, and range via flag with optional smooth lerp.

**Modes:** `ToggleEnabled`, `Intensity`, `Color`, `Range`

**Use Cases & Scenarios:**
- **Narrative reveal** — lerp light from intensity 0 → 5 for a `spotlight-reveal` story beat.
- **Color theme** — A/B test warm (`#FF9040`) vs. cool (`#40A0FF`) torchlight for mood preference.
- **Onboarding guide** — increase range of a guide spotlight for `new-player` variant to help navigation.

---

## Logic

### `GatrixFlagToggle`

Toggles `GameObject.activeSelf` for one or more objects based on flag state.

**Use Cases:**
- Show/hide premium currency badge
- Toggle seasonal decorations
- Enable/disable tutorial hints per variant

---

### `GatrixFlagBehaviourEnabled`

Enables or disables individual `MonoBehaviour` components without affecting the parent `GameObject`.

**Properties:** `EnableTargets` (enabled when flag ON), `DisableTargets` (disabled when flag ON / inverse)

**Use Cases & Scenarios:**
- **AI system swap** — enable `AdvancedBehaviourTree`, disable `SimpleFSM` when flag is on. No code, no build.
- **Feature gating** — disable `PremiumShopUI` component for free-tier users via a segment flag.
- **Conflict prevention** — when enabling `NewPathfinding`, automatically disable `LegacyPathfinding`.

> **Scenario:** Flag `new-ai` → AdvancedBehaviourTree.enabled = true, SimpleFSM.enabled = false.

---

### `GatrixFlagEvent`

Fires Unity Events (`UnityEvent`) when a flag becomes enabled or disabled.

**Use Cases:**
- Connect to existing inspector callbacks without writing code
- Trigger animations, UI updates, or any game logic

---

### `GatrixFlagSceneRedirect`

Loads a different scene when the flag is enabled.

**Use Cases:**
- A/B test a completely redesigned level
- Redirect to maintenance screen via kill-switch flag
- Gate beta content to specific segments

---

### `GatrixVariantSwitch`

Activates different child GameObjects based on the current variant name.

**Use Cases:**
- Swap UI layouts (control vs. treatment)
- Switch 3D model variants
- Enable different camera positions per bucket

---

### `GatrixEventListener`

Subscribes to SDK-level events (ready, error, flag change) and fires Unity Events.

**Use Cases:**
- Show a connection-lost screen on SDK error events
- Display loading indicator during initialization

---

## Navigation

### `GatrixFlagNavMeshAgent`

Controls `NavMeshAgent` speed, radius, stopping distance, and angular speed.

**Modes:** `ToggleEnabled`, `Speed`, `Radius`, `StoppingDistance`, `AngularSpeed`

**Use Cases & Scenarios:**
- **Difficulty scaling** — `hard` speed = 8, `easy` speed = 3 — all from the Gatrix dashboard.
- **Crowd tuning** — reduce radius for dense swarm experiments to allow tighter packing.
- **Role differentiation** — increase stopping distance for archers vs. melee fighters per AI variant.

---

## Physics

### `GatrixFlagRigidbody`

Controls `Rigidbody` mass, drag, and angular drag.

**Use Cases:**
- A/B heavy (mass = 10) vs. light (mass = 1) vehicle feel
- Tune air drag for floating vs. grounded movement experiments

---

### `GatrixFlagGravity`

Controls global `Physics.gravity` scale multiplier with optional smooth transition.

**Use Cases & Scenarios:**
- **Moon event** — `scale = 0.17` for a limited-time zero-gravity event.
- **Platformer tuning** — `1.5` (snappy) vs. `0.8` (floaty) — measure preference through A/B test.

---

### `GatrixFlagCollider`

Toggles `Collider` or `Collider2D` enabled state.

**Use Cases:**
- Remove hitboxes for ghost/invincible mode experiments
- Toggle trigger zones to gate areas behind flags

---

## Post FX

### `GatrixFlagPostProcessVolume`

Controls Post Processing Volume weight via reflection. Supports URP, HDRP, and Legacy PP Stack.

**Properties:** `EnabledWeight`, `DisabledWeight`, variant map, optional smooth lerp

**Use Cases & Scenarios:**
- **Quality A/B** — bloom + depth of field weight = 1.0 vs. 0.5. Measure battery drain vs. visual quality ratings.
- **Horror atmosphere** — gradually increase vignette weight as a `horror-mode` flag activates.
- **Performance gate** — set weight = 0 for low-end device segments. No build required.

---

## Rendering

### `GatrixFlagMaterial`

Swaps materials or updates material properties (color, float) on a `Renderer`.

**Use Cases:**
- Swap to a promotional material for a timed event
- A/B test metallic vs. matte surface finishes

---

### `GatrixFlagShaderProperty`

Sets individual shader properties (float, color, int, keyword enable/disable) on a `Material` instance.

**Types:** `Float`, `Color`, `Int`, `Keyword`

**Use Cases & Scenarios:**
- **Emission gating** — enable `EMISSION` keyword + set `_EmissionColor` to glow for an experiment variant.
- **Wetness pass** — drive `_Wetness` from 0 → 1 during a `rain-event` flag. All materials using the property update.
- **High-end feature** — enable `USE_PARALLAX` keyword only for high-end device segments.

> **Scenario:** Flag `glowing-items` → EnableKeyword("EMISSION") + `_EmissionColor = yellow`. Disabled → keyword off.

---

### `GatrixFlagQualitySettings`

Controls Unity `QualitySettings` including quality level, shadow distance, LOD bias, and more.

**Modes:** `QualityLevel`, `ShadowDistance`, `LodBias`, `AnisotropicFiltering`, `PixelLightCount`, `SoftParticles`, `RealtimeReflectionProbes`

**Use Cases & Scenarios:**
- **Device tier** — quality level 5 for high-end, level 2 for mid-range via segment flags. No build.
- **Battery saver** — reduce shadow distance from 150 → 40 and disable real-time reflections when `battery-saver` flag is on.
- **LOD experiment** — `lodBias = 2.0` (higher detail) vs. `1.0` (default) — measure visual quality perception difference.

> **Scenario:** Flag `hq-mode` → `QualitySettings.SetQualityLevel(5)`. Disabled → level 2. Instant, no patch.

---

### `GatrixFlagTrailRenderer`

Controls `TrailRenderer` enabled state, trail time, start width, and start color.

**Use Cases & Scenarios:**
- **Premium trails** — enable special color trails for paid users via entitlement flag.
- **Duration A/B** — trail time = 2s (dramatic) vs. 0.5s (subtle) — measure which feels more satisfying.
- **Seasonal event** — rainbow trail color during a festival event — one flag toggle.

---

### `GatrixFlagLineRenderer`

Controls `LineRenderer` enabled state, width, and start/end colors.

**Use Cases & Scenarios:**
- **Path visualization** — show trajectory lines only in an experimental "aim assist" variant.
- **Accessibility** — A/B test thicker (0.2) vs. thinner (0.05) UI lines for readability.
- **Debug gate** — enable debug lines only in `dev` or `qa` environment segments.

---

### `GatrixFlagGlobalShader`

Sets global shader properties (`Shader.SetGlobalFloat/Color/Int/Vector`) affecting all materials referencing the property.

**Types:** `Float`, `Color`, `Int`, `Vector`

**Use Cases & Scenarios:**
- **Scene-wide wetness** — `_GlobalWetness = 1.0` across all materials on `rain-event` flag. All puddles, roads appear wet simultaneously.
- **Time of day** — drive `_TimeOfDay` float: `morning = 0.25`, `noon = 0.5`, `night = 0.9`. All sky/terrain shaders respond.
- **Fog tint** — set `_FogColor` globally for atmospheric events without touching individual materials.
- **Feature toggle** — disable an expensive shader pass (`int = 0`) for low-end segments.

---

### `GatrixFlagSpriteRenderer`

Controls `SpriteRenderer` sprite, color, and enabled state.

**Use Cases:**
- Swap character sprites per variant (A/B test skins or designs)
- Apply status effect tints (poison = green, burn = red) via event flags

---

### `GatrixFlagRendererToggle`

Toggles any `Renderer`'s enabled state.

**Use Cases:**
- Hide 3D models for minimal-mode UI A/B tests
- Toggle decorative mesh visibility for performance experiments

---

### `GatrixFlagParticles`

Controls `ParticleSystem` play/stop state via flag.

**Use Cases:**
- Enable confetti burst for a celebration event
- A/B test ambient particles — measure performance impact on mid-range devices

---

### `GatrixFlagTransform`

Controls `Transform` local position, rotation, or scale via flag with variant mapping.

**Use Cases:**
- Reposition a UI element for A/B layout tests
- Scale feature badges based on A/B emphasis variants

---

## Time

### `GatrixFlagTimeScale`

Controls `Time.timeScale` via flag with variant-to-scale mapping.

**Use Cases & Scenarios:**
- **Bullet time** — `timeScale = 0.3` for `bullet-time` feature locked to premium users.
- **Speed A/B** — `1.5` (faster) vs. `1.0` (normal). Measure session length difference.
- **Pause on overlay** — set `timeScale = 0` when a flag-triggered UI modal is shown.

---

### `GatrixFlagFrameRate`

Controls `Application.targetFrameRate` via flag.

**Use Cases & Scenarios:**
- **Battery research** — 30fps cohort vs. 60fps cohort. Measure battery drain, engagement, and crash rate differences.
- **Tier-based cap** — 30fps for low-end device segment, 60fps for high-end via device segment flags.
- **Capture mode** — unlock to `-1` (unlimited) for a screenshot/recording feature flag.

---

## UI

### `GatrixFlagValue`

Binds flag variant value or name to a `TextMeshProUGUI` or legacy `Text`.

**Use Cases:**
- Display server-configured promotional text without a build
- A/B test copy (button labels, headlines, descriptions)
- Show evaluation reason or variant name for debugging

---

### `GatrixFlagColor`

Tints `Graphic` or `Renderer` components based on flag state or variant.

**Use Cases:**
- Gold tint on premium features for one variant
- CTA button color A/B test (blue vs. orange)

---

### `GatrixFlagImage`

Swaps UI `Image` sprite or fill based on flag state and variant.

**Use Cases:**
- A/B test icon designs without a rebuild
- Show promotional banners only when a marketing flag is enabled

---

### `GatrixFlagCanvas`

Controls `Canvas` enabled state and sorting order.

**Use Cases:**
- Toggle entire HUD for a minimal-UI A/B experiment
- Bring a tutorial canvas to the front by adjusting sort order via flag

---

### `GatrixFlagSlider`

Controls `Slider` value and interactable state.

**Use Cases:**
- Pre-fill slider with A/B default values (70% vs. 50% default volume)
- Disable settings slider for restricted user tiers

---

### `GatrixFlagButtonInteractable`

Toggles `Button.interactable` state.

**Use Cases:**
- Gate premium actions ("Unlock Character") behind entitlement flags
- Disable submit buttons during maintenance flag

---

### `GatrixFlagInputField`

Controls `InputField` placeholder text, character limit, and interactable state.

**Modes:** `ToggleInteractable`, `PlaceholderText`, `CharacterLimit`

**Use Cases & Scenarios:**
- **Copy A/B** — test `"Search for heroes..."` vs. `"What are you looking for?"` — measure search usage rate.
- **Limit experiment** — 100-char vs. 280-char input limit for review feature.
- **Guest gating** — disable input for unauthenticated users via permission flag.

> **Scenario:** Flag `search-copy-test` variant `B` → placeholder = "Discover your next adventure". Conversion rate compared per bucket.

---

### `GatrixFlagScrollRect`

Controls `ScrollRect` enabled state, scroll sensitivity, inertia, and axis locking.

**Modes:** `ToggleEnabled`, `ScrollSensitivity`, `ToggleInertia`, `ToggleHorizontal`, `ToggleVertical`

**Use Cases & Scenarios:**
- **Sensitivity A/B** — `scrollSensitivity = 15` (fast) vs. `5` (precise) for inventory UI. Measure scroll error rate.
- **Inertia test** — inertia on vs. off for page-based list UIs. Measure scroll overshoot complaints.
- **Axis gating** — lock horizontal scroll for a tutorial scroll view via flag — no code.

---

*Gatrix Unity SDK — Zero-Code Components Reference (English)*
