---
sidebar_position: 3
sidebar_label: Microsoft Teams
---

# Microsoft Teams 集成

发送 Gatrix 通知到 Microsoft Teams。

## 设置指南

### 1. 在 Teams 中创建 Incoming Webhook

1. 在 Microsoft Teams 中，前往您想要接收通知的频道。
2. 点击 **...** > **连接器 (Connectors)**。
3. 找到 **Incoming Webhook** 并点击 **配置 (Configure)**。
4. 输入名称并可选上传图标。
5. 点击 **创建 (Create)**。
6. 复制生成的 Webhook URL。

### 2. 在 Gatrix 中注册

1. 前往 **设置** > **外部集成** > **Microsoft Teams**。
2. 粘贴 Webhook URL。
3. 配置要接收通知的事件。
4. 点击 **保存**。

## 通知事件

| 事件         | 说明                     |
| ------------ | ------------------------ |
| 功能开关变更 | 创建/更新/删除开关时通知 |
| 维护状态     | 维护开始/结束时通知      |
| 系统错误     | 发生系统错误时通知       |

## 测试

点击 **发送测试消息** 验证集成是否正常工作。
