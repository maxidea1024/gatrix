---
sidebar_position: 1
sidebar_label: 功能标志
---

# 功能标志

利用功能标志实现安全部署，支持实时切换、环境定向、分段发布和多平台 SDK。

## 概述

Gatrix 功能标志允许您无需代码部署即可控制功能的可用性。标志以**全局**方式定义，可以拥有**按环境**设置（启用/禁用、值覆盖）。评估在**服务器端**执行 — 客户端 SDK 发送上下文，接收预评估结果，并在本地缓存以实现零延迟读取。

### 核心功能

- **实时切换** — 即时在所有连接的客户端上启用/禁用功能
- **环境定向** — 按环境启用/禁用及值覆盖 (development, staging, production)
- **分段定向** — 基于上下文约束的可复用用户组
- **策略发布** — 通过百分比、分段约束和粘性进行渐进式发布
- **多平台 SDK** — JavaScript/TypeScript、Unity (C#)、Unreal Engine (C++)、Cocos2d-x (C++)、Flutter (Dart)、Godot (GDScript)、Python
- **曝光追踪** — 监控标志访问以进行分析
- **显式同步模式** — 缓冲标志变更并在受控同步点应用（对游戏至关重要）
- **代码引用** — 通过静态分析追踪代码库中的标志使用情况

## 架构

### 评估模型

```
┌────────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Client SDK       │─context─▶   Edge API       │─eval──▶ │  Evaluator   │
│   (cache + poll)   │◀─result─│   (or Backend)   │◀───────│  (shared)    │
└────────────────────┘         └──────────────────┘         └──────────────┘
```

1. 客户端 SDK 将**上下文** (userId, sessionId, properties) 发送到 Edge API
2. 服务器使用**策略**、**约束**和**分段**评估所有标志
3. 预评估结果返回给客户端
4. 客户端在本地缓存结果以实现零延迟读取
5. SDK 定期轮询（默认：30秒）获取更新

### 核心设计原则

- **标志是全局的** — 标志只定义一次，不按环境定义
- **环境控制激活** — 每个环境有自己的 `isEnabled`、`enabledValue`、`disabledValue` 覆盖
- **策略按环境配置** — 定向规则按环境配置
- **变体按环境配置** — A/B 测试分配可以在不同环境间有所不同
- **分段是全局的** — 可在所有标志和环境中复用
- **`isArchived` 仅用于管理** — 归档的标志仍正常评估；归档是 UI/治理概念

## 创建功能标志

1. 在管理控制台导航到 **Feature Flags**
2. 点击 **Create Flag**
3. 配置标志：

| 字段                  | 类型     | 必填 | 说明                                              |
| --------------------- | -------- | ---- | ------------------------------------------------- |
| 键 (`flagName`)       | 文本     | ✅   | 唯一标识符（例如：`new-checkout-flow`）            |
| 显示名称               | 文本     | ✅   | 人类可读的显示名称                                  |
| 说明                   | 文本域   | —    | 用途和上下文描述                                    |
| 标志类型 (`flagType`)  | 选择     | ✅   | 用途分类（见下文）                                  |
| 值类型 (`valueType`)   | 选择     | ✅   | `boolean`, `string`, `number`, `json`              |
| 启用值                 | 动态     | ✅   | 标志评估为启用时返回的值                             |
| 禁用值                 | 动态     | ✅   | 标志评估为禁用时返回的值                             |
| 曝光数据               | 开关     | —    | 为此标志启用曝光追踪                                 |
| 过期天数               | 数字     | —    | 超过此天数后标志被视为过期                            |
| 标签                   | 标签     | —    | 分类标签                                            |

4. 点击 **Create**

:::tip 标志键命名
使用 **kebab-case** 命名标志键：`dark-mode`、`new-checkout-flow`、`max-retry-count`。
标志键区分大小写。在代码中使用字符串字面量以兼容静态分析。
:::

### 标志类型（用途）

标志类型描述标志的**用途**，而非数据类型：

| 标志类型        | 说明                                    |
| -------------- | --------------------------------------- |
| `release`      | 控制功能向用户的发布                      |
| `experiment`   | A/B 测试和实验                           |
| `operational`  | 运营控制（速率限制、断路器）               |
| `killSwitch`   | 紧急禁用功能的开关                        |
| `permission`   | 基于用户属性的访问控制                    |
| `remoteConfig` | 远程配置值（游戏平衡、UI 设置等）          |

### 值类型

| 值类型     | 说明           | 默认回退  | 示例                                      |
| ---------- | -------------- | --------- | ----------------------------------------- |
| `boolean`  | 真/假切换       | `false`   | `true`                                     |
| `string`   | 文本值          | `""`      | `"dark-theme"`                             |
| `number`   | 数值           | `0`       | `100`                                      |
| `json`     | 复杂对象        | `{}`      | `{ "limit": 10, "theme": "modern" }`      |

## 按环境设置

每个标志可以在不同环境中有不同的设置：

| 设置             | 说明                                |
| ---------------- | ----------------------------------- |
| `isEnabled`      | 此环境中标志是否激活                  |
| `enabledValue`   | 覆盖全局启用值（可选）                |
| `disabledValue`  | 覆盖全局禁用值（可选）                |
| `strategies`     | 此环境特定的定向规则                  |
| `variants`       | 此环境特定的变体分配                  |

### 示例：按环境设置

```
Flag: "new-checkout-flow" (boolean)
├── Global: enabledValue=true, disabledValue=false
├── development: isEnabled=true  (无策略 → 始终启用)
├── staging:     isEnabled=true  (策略: userId IN ["tester-1", "tester-2"])
└── production:  isEnabled=true  (策略: rollout 10%, stickiness=userId)
```

## 策略

策略是**按环境**的定向规则，决定哪些用户接收启用值。策略按 `sortOrder` 评估。

### 策略评估流程

```
标志 isEnabled?
  ├─ NO  → 返回 disabledValue (reason: "disabled")
  └─ YES → 存在活跃策略?
       ├─ NO  → 返回 enabledValue (reason: "default")
       └─ YES → 对每个策略（按 sortOrder）：
            1. 检查分段约束（全部必须通过）
            2. 检查策略约束（全部必须通过）
            3. 检查发布百分比
            └─ 全部通过 → 返回 enabledValue (reason: "strategy_match")
       └─ 无策略匹配 → 返回 disabledValue (reason: "default")
```

### 策略参数

| 参数         | 类型   | 说明                                                            |
| ------------ | ------ | --------------------------------------------------------------- |
| `rollout`    | number | 接收启用值的用户百分比（0–100）                                   |
| `stickiness` | string | 一致性分桶的上下文字段（`userId`、`sessionId`、`random` 或自定义）  |
| `groupId`    | string | 发布分桶的组标识符（默认：标志名称）                               |

### 发布分桶

发布使用 **MurmurHash v3** 进行确定性分桶：

```
seed = "{groupId}:{stickinessValue}"
hash = murmurhash_v3(seed)
percentage = (hash % 10000) / 100   // 0.00 ~ 99.99
```

这确保：
- 同一用户对同一标志始终获得相同结果
- 用户间均匀分布
- 增加发布百分比时不会重新分桶现有用户

## 约束

约束是策略匹配必须满足的条件。策略内所有约束使用 **AND** 逻辑（全部必须通过）。

### 约束结构

```typescript
interface Constraint {
  contextName: string;       // 要检查的上下文字段（例如："userId"、"country"）
  operator: ConstraintOperator;
  value?: string;           // 单值运算符用
  values?: string[];        // 多值运算符用（IN 等）
  caseInsensitive?: boolean; // 字符串比较大小写敏感性
  inverted?: boolean;       // 反转结果
}
```

### 按类型分类的运算符

#### 字符串运算符

| 运算符            | 说明            | 值类型 | 示例                                 |
| ----------------- | --------------- | ------ | ------------------------------------ |
| `str_eq`          | 等于            | 单值   | `country str_eq "KR"`               |
| `str_contains`    | 包含子字符串     | 单值   | `email str_contains "@company.com"`  |
| `str_starts_with` | 以前缀开头       | 单值   | `userId str_starts_with "test_"`     |
| `str_ends_with`   | 以后缀结尾       | 单值   | `email str_ends_with ".kr"`          |
| `str_in`          | 在列表中         | 多值   | `country str_in ["KR", "JP", "US"]` |
| `str_regex`       | 匹配正则表达式   | 单值   | `email str_regex "^admin@.*"`        |

#### 数字运算符

| 运算符     | 说明        | 值类型 | 示例                      |
| ---------- | ----------- | ------ | ------------------------- |
| `num_eq`   | 等于        | 单值   | `level num_eq 10`         |
| `num_gt`   | 大于        | 单值   | `level num_gt 50`         |
| `num_gte`  | 大于等于     | 单值   | `level num_gte 50`        |
| `num_lt`   | 小于        | 单值   | `age num_lt 18`           |
| `num_lte`  | 小于等于     | 单值   | `age num_lte 18`          |
| `num_in`   | 在列表中     | 多值   | `level num_in [1, 5, 10]` |

#### 布尔运算符

| 运算符    | 说明        | 值类型 | 示例                     |
| --------- | ----------- | ------ | ------------------------ |
| `bool_is` | 是真/假     | 单值   | `isPremium bool_is true` |

#### 日期运算符

| 运算符     | 说明        | 值类型 | 示例                                 |
| ---------- | ----------- | ------ | ------------------------------------ |
| `date_eq`  | 等于        | 单值   | `registerDate date_eq "2025-01-01"`  |
| `date_gt`  | 在之后       | 单值   | `registerDate date_gt "2025-01-01"`  |
| `date_gte` | 在之后(含)   | 单值   | `registerDate date_gte "2025-01-01"` |
| `date_lt`  | 在之前       | 单值   | `registerDate date_lt "2025-06-01"`  |
| `date_lte` | 在之前(含)   | 单值   | `registerDate date_lte "2025-06-01"` |

#### Semver 运算符

| 运算符       | 说明        | 值类型 | 示例                                       |
| ------------ | ----------- | ------ | ------------------------------------------ |
| `semver_eq`  | 等于        | 单值   | `appVersion semver_eq "2.0.0"`             |
| `semver_gt`  | 大于        | 单值   | `appVersion semver_gt "1.5.0"`             |
| `semver_gte` | 大于等于     | 单值   | `appVersion semver_gte "1.5.0"`            |
| `semver_lt`  | 小于        | 单值   | `appVersion semver_lt "3.0.0"`             |
| `semver_lte` | 小于等于     | 单值   | `appVersion semver_lte "3.0.0"`            |
| `semver_in`  | 在列表中     | 多值   | `appVersion semver_in ["2.0.0", "2.1.0"]`  |

#### 通用运算符（类型无关）

| 运算符       | 说明        | 值类型 | 示例                |
| ------------ | ----------- | ------ | ------------------- |
| `exists`     | 有值        | 无     | `userId exists`     |
| `not_exists` | 无值        | 无     | `userId not_exists` |

#### 数组运算符

| 运算符      | 说明                    | 值类型 | 示例                              |
| ----------- | ----------------------- | ------ | --------------------------------- |
| `arr_any`   | 包含任一目标值           | 多值   | `tags arr_any ["vip", "beta"]`    |
| `arr_all`   | 包含所有目标值           | 多值   | `tags arr_all ["vip", "premium"]` |
| `arr_empty` | 数组为空或不存在         | 无     | `tags arr_empty`                  |

### `inverted` 标志

每个约束都支持 `inverted` 布尔值。为 `true` 时，约束结果被反转：

```
str_eq + inverted:true  → 不等于 (≠)
str_in + inverted:true  → 不在列表中
exists + inverted:true  → 不存在
```

## 分段

分段是**全局**的可复用约束集合。可以被任何环境中的任何策略引用。

### 分段结构

```typescript
interface FeatureSegment {
  name: string;
  constraints: Constraint[];  // 全部必须通过（AND 逻辑）
  isActive: boolean;          // 仅 UI 显示，不用于评估
}
```

:::warning `isActive` 仅用于 UI
分段的 `isActive` 字段仅控制**管理 UI 中的可见性**。它**不**影响评估。即使非活跃分段在被策略引用时也会正常评估。
:::

### 创建分段

1. 导航到 **Feature Flags** > **Segments**
2. 点击 **Create Segment**
3. 定义约束（例如：`country str_in ["KR", "JP"]` AND `isPremium bool_is true`）
4. 保存

### 在策略中使用分段

策略可以引用分段。评估时，分段约束在策略约束**之前**检查：

```
策略评估顺序：
1. 分段约束（所有引用的分段必须通过）
2. 策略约束（全部必须通过）
3. 发布百分比检查
```

## 上下文

上下文代表当前用户/会话，驱动所有定向规则。

### 评估上下文结构

```typescript
interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  appName?: string;
  appVersion?: string;
  remoteAddress?: string;
  environment?: string;
  currentTime?: Date;
  properties?: Record<string, string | number | boolean | string[]>;
}
```

### 内置上下文字段

| 字段            | 类型   | 说明                                    |
| --------------- | ------ | --------------------------------------- |
| `userId`        | string | 唯一用户标识符 — 主要粘性键              |
| `sessionId`     | string | 会话标识符 — 未提供时自动生成             |
| `appName`       | string | SDK 配置中的应用名称                     |
| `appVersion`    | string | 应用版本（支持 semver 比较）              |
| `remoteAddress` | string | 客户端 IP 地址（评估时由服务器提供）       |

### 自定义上下文字段 (Properties)

自定义属性支持四种类型：

| 类型      | 说明           | 示例运算符                                          |
| --------- | -------------- | --------------------------------------------------- |
| `string`  | 文本值          | `str_eq`, `str_contains`, `str_in`, `str_regex`     |
| `number`  | 数值           | `num_eq`, `num_gt`, `num_lt`, `num_in`              |
| `boolean` | 真/假值         | `bool_is`                                           |
| `array`   | 字符串列表      | `arr_any`, `arr_all`, `arr_empty`                   |

### 预定义自定义字段

Gatrix 提供常用的上下文字段：

| 键                | 类型    | 说明                          |
| ----------------- | ------- | ----------------------------- |
| `userLevel`       | number  | 游戏中用户当前等级             |
| `country`         | string  | 国家代码 (ISO 3166-1 alpha-2) |
| `platform`        | string  | 设备平台 (ios, android, web, windows, mac, linux) |
| `language`        | string  | 首选语言 (ko, en, ja, zh, ...) |
| `isPremium`       | boolean | 高级订阅状态                   |
| `registrationDate`| number  | 注册后天数                     |
| `lastLoginDate`   | number  | 上次登录后天数                  |
| `totalPurchases`  | number  | 总购买金额 (USD)               |
| `gameMode`        | string  | 当前游戏模式                   |
| `tags`            | array   | 分配给用户的自定义标签          |

## 变体

变体通过加权分配实现 **A/B 测试**。变体按**环境**定义。

### 变体结构

```typescript
interface FeatureVariant {
  variantName: string;     // 标志内唯一标识符
  weight: number;          // 分配权重 (0–100)
  value?: any;             // 变体特定值
  valueType: ValueType;    // 与标志的 valueType 相同
  weightLock?: boolean;    // 重新分配时锁定此变体权重
}
```

### 变体选择

当标志有变体时，根据用户上下文选择一个：

```
percentage = murmurhash_v3("{flagName}-variant:{stickinessValue}") % 10000 / 100

累积权重检查：
  Variant A (weight: 50) → 0–50%
  Variant B (weight: 30) → 50–80%
  Variant C (weight: 20) → 80–100%
```

### 保留变体名称

| 名称        | 含义                        |
| ----------- | --------------------------- |
| `$default`  | 默认变体（未定义变体时）      |
| `$disabled` | 标志已禁用                   |
| `$missing`  | 缓存中不存在标志              |
| `$config`   | 标志使用配置值                |

## SDK 使用

### 可用客户端 SDK

| SDK                       | 语言          | 包名                              |
| ------------------------- | ------------- | --------------------------------- |
| **JavaScript/TypeScript** | JS/TS         | `@gatrix/js-client-sdk`           |
| **React**                 | JS/TS         | `@gatrix/react-sdk`               |
| **Vue**                   | JS/TS         | `@gatrix/vue-sdk`                 |
| **Svelte**                | JS/TS         | `@gatrix/svelte-sdk`              |
| **Unity**                 | C#            | `gatrix-unity-client-sdk`         |
| **Unreal Engine**         | C++           | `gatrix-unreal-client-sdk`        |
| **Cocos2d-x**             | C++           | `gatrix-cocos2dx-client-sdk`      |
| **Flutter**               | Dart          | `gatrix-flutter-client-sdk`       |
| **Godot**                 | GDScript      | `gatrix-godot-client-sdk`         |
| **Python**                | Python        | `gatrix-python-client-sdk`        |

### SDK 生命周期

所有客户端 SDK 遵循相同的生命周期模式：

```
Constructor → init() → start() → [polling loop] → stop()
                │          │
                │          └─ 首次获取 → "flags.ready" 事件
                └─ 从缓存/引导加载 → "flags.init" 事件
```

### 初始化

```typescript
import { GatrixClient } from '@gatrix/js-client-sdk';

const client = new GatrixClient({
  // 必填
  apiUrl: 'https://edge.your-api.com/api/v1',
  apiToken: 'your-client-api-token',
  appName: 'my-app',
  environment: 'production',

  // 可选
  refreshInterval: 30,        // 轮询间隔（秒，默认：30）
  explicitSyncMode: false,    // 缓冲变更直到 syncFlags()（默认：false）
  disableRefresh: false,      // 禁用自动轮询（默认：false）
  offlineMode: false,         // 无网络请求（默认：false）
  disableMetrics: false,      // 禁用指标收集（默认：false）

  // 初始上下文
  context: {
    userId: 'user-123',
    properties: {
      country: 'KR',
      level: 42,
      isPremium: true,
    },
  },
});

await client.start();
```

### 标志访问方法

#### 基本访问

```typescript
const features = client.features;

// 检查标志是否启用（返回 flag.enabled，非变体值）
const isEnabled = features.isEnabled('dark-mode');

// 检查缓存中是否存在标志
const exists = features.hasFlag('dark-mode');

// 获取所有标志
const allFlags = features.getAllFlags();
```

#### 类型化变体（需要回退值）

所有 variation 方法**必须**提供回退值。这确保即使在故障期间也能收到有效值。

```typescript
// 布尔值（来自 variant.value，非 flag.enabled）
const darkMode = features.boolVariation('dark-mode', false);

// 字符串值
const theme = features.stringVariation('theme-name', 'light');

// 数字值（仅 JS/TS SDK — 见下文说明）
const maxItems = features.numberVariation('max-items', 10);

// JSON 值
const config = features.jsonVariation('feature-config', { enabled: false });
```

:::warning `isEnabled()` 与 `boolVariation()`
这两者有**完全不同**的用途：
- **`isEnabled('flag')`** → 返回标志是否**已开启** (`flag.enabled`)
- **`boolVariation('flag', false)`** → 返回变体的**布尔值** (`variant.value`)

对于没有变体的简单布尔标志，它们可能返回相同结果，但语义不同。
:::

:::important 非 JS SDK 的数字类型
JavaScript/TypeScript SDK 提供 `numberVariation()`。

**所有其他 SDK** 使用类型特定的函数：
- `intVariation(flagName, fallbackValue)` — 返回整数
- `floatVariation(flagName, fallbackValue)` — 返回浮点数

| SDK        | 整数函数              | 浮点函数               |
| ---------- | -------------------- | ---------------------- |
| Unity (C#) | `IntVariation()`     | `FloatVariation()`     |
| Unreal     | `IntVariation()`     | `FloatVariation()`     |
| Cocos2d-x  | `intVariation()`     | `floatVariation()`     |
| Flutter    | `intVariation()`     | `doubleVariation()`    |
| Godot      | `int_variation()`    | `float_variation()`    |
| Python     | `int_variation()`    | `float_variation()`    |
:::

#### FlagProxy

`getFlag()` 方法返回 `FlagProxy` — 包含所有 variation 方法的便捷包装器：

```typescript
const flag = features.getFlag('dark-mode');

flag.exists;                    // boolean: 标志是否存在
flag.enabled;                   // boolean: 标志是否启用
flag.name;                      // string: 标志名称
flag.variant;                   // Variant: 永不为 null（使用 $missing 哨兵）
flag.boolVariation(false);      // 内部委托给 FeaturesClient
```

### 上下文管理

```typescript
// 获取当前上下文
const ctx = features.getContext();

// 更新整个上下文（触发重新获取）
await features.updateContext({
  userId: 'user-456',
  properties: { country: 'JP' },
});

// 更新单个上下文字段（触发重新获取）
await features.setContextField('level', 42);

// 移除上下文字段（触发重新获取）
await features.removeContextField('tempFlag');
```

:::caution 上下文更新性能
每次 `updateContext()` / `setContextField()` / `removeContextField()` 调用都会触发**网络请求**以重新评估标志。避免将频繁变化的值放入上下文。

**适合上下文：** userId、country、plan、platform、appVersion
**避免放入上下文：** 时间戳、动画帧、计数器、快速变化的游戏状态
:::

### Watch 模式（响应式更新）

订阅单个标志变更以实现响应式 UI 更新：

```typescript
// 监视标志变更（仅在变更时触发）
const unwatch = features.watchFlag('dark-mode', (flag) => {
  console.log('Dark mode changed:', flag.boolVariation(false));
});

// 带初始状态监视（立即以当前值触发，然后在变更时触发）
const unwatch = features.watchFlagWithInitialState('dark-mode', (flag) => {
  applyTheme(flag.boolVariation(false) ? 'dark' : 'light');
});

// 停止监视
unwatch();
```

### 显式同步模式

对于标志变更不能中断当前游戏循环或会话的**游戏和实时应用程序**至关重要。

```typescript
const client = new GatrixClient({
  // ...config
  explicitSyncMode: true,
});

// 标志在后台获取但不会应用直到 syncFlags()
client.on('flags.pending_sync', () => {
  showNotification('有新设置可用！');
});

// 在安全时机应用变更（场景切换、大厅、加载画面）
await features.syncFlags();
```

#### 工作原理

| 存储                | 说明                                    |
| ------------------- | --------------------------------------- |
| `realtimeFlags`     | 服务器最新标志（始终最新）                |
| `synchronizedFlags` | 应用读取的标志（通过 syncFlags 更新）     |

- 默认从 `synchronizedFlags` 读取
- 使用 `forceRealtime: true` 从 `realtimeFlags` 读取（用于调试 UI）

### 事件

| 事件                     | 说明                                | 载荷                             |
| ------------------------ | ----------------------------------- | -------------------------------- |
| `flags.init`             | SDK 从存储/引导初始化                | —                                |
| `flags.ready`            | 首次获取成功完成                     | —                                |
| `flags.fetch_start`      | 开始获取                            | `{ etag }`                       |
| `flags.fetch_success`    | 获取成功                            | —                                |
| `flags.fetch_error`      | 获取失败                            | `{ status?, error? }`            |
| `flags.fetch_end`        | 获取完成（成功或错误）               | —                                |
| `flags.change`           | 服务器标志变更                       | `{ flags }`                      |
| `flags.{name}.change`    | 单个标志变更                         | `(newFlag, oldFlag, changeType)` |
| `flags.removed`          | 服务器标志移除                       | `string[]`（标志名称）            |
| `flags.pending_sync`     | 有待同步（显式同步模式）              | —                                |
| `flags.impression`       | 标志被访问（曝光追踪启用时）          | `ImpressionEvent`                |
| `flags.error`            | 通用 SDK 错误                       | `{ type, error }`                |
| `flags.recovered`        | 从错误状态恢复                       | —                                |
| `flags.metrics.sent`     | 指标发送成功                         | `{ count }`                      |

### 轮询和错误恢复

| 场景                     | 行为                                                           |
| ------------------------ | -------------------------------------------------------------- |
| 成功获取                  | `refreshInterval` 秒后安排下次获取                              |
| 可重试错误                | 指数退避：`min(initialBackoffMs * 2^(n-1), maxBackoffMs)`       |
| 不可重试 (401, 403)      | 轮询停止。手动调用 `fetchFlags()` 恢复。                        |
| 错误后恢复                | `consecutiveFailures` 重置，正常轮询恢复                        |

## 平台示例

### Unity (C#)

```csharp
var config = new GatrixClientConfig {
    ApiUrl = "https://edge.your-api.com/api/v1",
    ApiToken = "your-token",
    AppName = "my-game",
    Environment = "production",
    ExplicitSyncMode = true, // 推荐用于游戏
};

var client = new GatrixClient(config);
await client.Start();

int maxRetries = client.Features.IntVariation("max-retries", 3);
float gameSpeed = client.Features.FloatVariation("game-speed", 1.0f);
bool darkMode = client.Features.BoolVariation("dark-mode", false);
```

### Unreal Engine (C++)

```cpp
FGatrixClientConfig Config;
Config.ApiUrl = TEXT("https://edge.your-api.com/api/v1");
Config.ApiToken = TEXT("your-token");
Config.AppName = TEXT("my-game");
Config.Environment = TEXT("production");
Config.bExplicitSyncMode = true;

TSharedPtr<FGatrixClient> Client = MakeShared<FGatrixClient>(Config);
Client->Start();

bool bDarkMode = Client->GetFeatures()->BoolVariation("dark-mode", false);
int32 MaxRetries = Client->GetFeatures()->IntVariation("max-retries", 3);
float GameSpeed = Client->GetFeatures()->FloatVariation("game-speed", 1.0f);
```

### Flutter (Dart)

```dart
final client = GatrixClient(GatrixClientConfig(
  apiUrl: 'https://edge.your-api.com/api/v1',
  apiToken: 'your-token',
  appName: 'my-app',
  environment: 'production',
));

await client.start();

bool darkMode = client.features.boolVariation('dark-mode', false);
int maxItems = client.features.intVariation('max-items', 10);
double speed = client.features.doubleVariation('game-speed', 1.0);
```

### Godot (GDScript)

```gdscript
var config = GatrixClientConfig.new()
config.api_url = "https://edge.your-api.com/api/v1"
config.api_token = "your-token"
config.app_name = "my-game"
config.environment = "production"
config.explicit_sync_mode = true

var client = GatrixClient.new(config)
client.start()

var dark_mode = client.features.bool_variation("dark-mode", false)
var max_retries = client.features.int_variation("max-retries", 3)
var game_speed = client.features.float_variation("game-speed", 1.0)
```

### Python

```python
from gatrix import GatrixClient, GatrixClientConfig, GatrixContext

config = GatrixClientConfig(
    api_url="https://edge.your-api.com/api/v1",
    api_token="your-token",
    app_name="my-app",
    environment="production",
    context=GatrixContext(
        user_id="user-123",
        properties={"country": "KR", "level": 42},
    ),
)

client = GatrixClient(config)
await client.start()

dark_mode = client.features.bool_variation("dark-mode", False)
max_items = client.features.int_variation("max-items", 10)
speed = client.features.float_variation("game-speed", 1.0)
```

## 最佳实践

### 标志设计

1. **使用 kebab-case** — 一致且对静态分析友好
2. **选择正确的标志类型** — 功能发布用 `release`，紧急开关用 `killSwitch`，调优值用 `remoteConfig`
3. **设置有意义的禁用值** — 标志关闭时用户应看到合理的默认值
4. **使用 `staleAfterDays`** — 设置过期阈值以识别应移除的标志
5. **为标志添加标签** — 使用标签进行分类和过滤

### SDK 使用

1. **始终提供回退值** — 确保网络故障时的恢复能力
2. **使用 `boolVariation` 而非 `isEnabled`** — 获取实际变体值，而非仅启用状态
3. **游戏使用显式同步模式** — 防止帧/会话中标志变更干扰
4. **保持上下文最小化** — 避免将频繁变化的值放入上下文
5. **`start()` 调用一次，`stop()` 调用一次** — SDK 生命周期应与应用生命周期匹配
6. **响应式 UI 使用 `watchFlag`** — 不要手动轮询
7. **渲染前处理 `flags.ready`** — 防止未加载标志导致的闪烁

### 性能

1. **标志读取在内存中** — `isEnabled`、`*Variation` 在热路径中安全（游戏循环、渲染函数）
2. **上下文更新触发网络** — 如果由用户输入驱动则进行防抖
3. **批量标志监视器** — 使用 `WatchFlagGroup` 进行更清洁的生命周期管理
4. **使用引导实现即时加载** — 消除首次获取前的加载间隙

## 参见

- [分段](./segments) — 可复用用户组定向
- [环境](./environments) — 按环境配置管理
- [客户端 SDK](../sdks/client-side) — 平台特定 SDK 文档
- [游戏引擎 SDK](../sdks/game-engines) — Unity、Unreal、Godot、Cocos2d-x
