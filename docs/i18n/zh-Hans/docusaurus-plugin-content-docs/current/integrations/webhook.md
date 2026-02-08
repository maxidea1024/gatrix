---
sidebar_position: 4
sidebar_label: Webhook
---

# Webhook 集成

将 Gatrix 事件发送到自定义 HTTP 终点。

## 设置指南

1. 前往 **设置** > **外部集成** > **Webhook**。
2. 输入接收 Webhook 的 URL。
3. 选择要发送的事件。
4. 如果需要，配置身份验证信息（可选）。
5. 点击 **保存**。

## 身份验证支持

Webhook 支持以下验证方式：

- **无** - 无验证
- **Basic Auth** - 用户名和密码
- **Bearer Token** - 令牌方式
- **Custom Header** - 自定义请求头名称和值

## 有效负载格式 (Payload)

```json
{
  "event": "feature_flag.updated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "flagKey": "new_feature",
    "oldValue": false,
    "newValue": true,
    "environment": "production",
    "changedBy": "admin@example.com"
  }
}
```

## 关键事件

| 事件                   | 说明       |
| ---------------------- | ---------- |
| `feature_flag.created` | 已创建开关 |
| `feature_flag.updated` | 已更新开关 |
| `feature_flag.deleted` | 已删除开关 |
| `maintenance.started`  | 维护已开始 |
| `maintenance.ended`    | 维护已结束 |

## 重试策略

失败的 Webhook 请求将根据指数退避策略最多重试 3 次。
