---
sidebar_position: 2
sidebar_label: Slack
---

# Slack 集成

发送 Gatrix 通知到 Slack。

## 设置指南

### 1. 创建 Slack 应用

1. 前往 [api.slack.com/apps](https://api.slack.com/apps)。
2. 点击 **Create New App**。
3. 选择 **From scratch**。
4. 输入应用名称并选择工作区。

### 2. 配置 Incoming Webhooks

1. 在 Slack 应用设置中，前往 **Incoming Webhooks**。
2. 将 **Activate Incoming Webhooks** 设置为 On。
3. 点击 **Add New Webhook to Workspace**。
4. 选择要接收通知的频道。
5. 复制生成的 Webhook URL。

### 3. 在 Gatrix 中注册

1. 前往 **设置** > **外部集成** > **Slack**。
2. 粘贴 Webhook URL。
3. 配置要接收通知的事件。
4. 点击 **保存**。

## 通知事件

| 事件 | 说明 |
|-------|-------------|
| 功能开关变更 | 创建/更新/删除开关时通知 |
| 维护状态 | 维护开始/结束时通知 |
| 系统错误 | 发生系统错误时通知 |

## 测试

点击 **发送测试消息** 验证集成是否正常工作。
