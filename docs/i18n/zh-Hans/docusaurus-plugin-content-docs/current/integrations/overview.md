---
sidebar_position: 1
sidebar_label: 概述
---

# 外部集成概述

将 Gatrix 连接到各种外部服务。

## 支持的服务

| 服务 | 说明 |
|-------------|-------------|
| [Slack](./slack) | 发送通知到 Slack 频道 |
| [Microsoft Teams](./teams) | 发送通知到 Teams 频道 |
| [Webhook](./webhook) | 发送自定义 HTTP Webhook |
| [New Relic](./new-relic) | 集成 APM 和监控数据 |

## 集成类型

### 通知集成
当 Gatrix 发生事件时接收通知：
- 功能开关变更
- 维护状态更新
- 系统错误报警

### 监控集成
将指标和追踪数据导出到监控平台。

## 如何设置集成

1. 前往 **设置** > **外部集成**。
2. 点击您想要的服务。
3. 按照设置指南操作。
4. 测试连接。
5. 保存配置。

## 关键事件

集成可以由以下事件触发：

| 事件 | 说明 |
|-------|-------------|
| `feature_flag.created` | 创建了新开关 |
| `feature_flag.updated` | 开关值已更改 |
| `feature_flag.deleted` | 开关已删除 |
| `maintenance.started` | 维护已开始 |
| `maintenance.ended` | 维护已完成 |
