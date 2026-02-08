---
sidebar_position: 5
sidebar_label: New Relic
---

# New Relic 集成

将 Gatrix 指标和追踪数据导出到 New Relic。

## 设置指南

### 1. 获取 New Relic License Key

1. 登录 New Relic。
2. 前往 **API Keys** 菜单。
3. 复制 **License Key**。

### 2. 在 Gatrix 中配置

1. 前往 **设置** > **外部集成** > **New Relic**。
2. 输入复制的 License Key。
3. 选择要导出的数据：
   - 指标 (Metrics)
   - 自定义事件
   - 功能开关变更历史
4. 点击 **保存**。

## 导出的数据

### 指标 (Metrics)

- API 响应时间
- 请求数
- 错误率
- 功能开关评估次数

### 自定义事件

- 功能开关变更
- 用户活动
- 系统事件

## 仪表板使用

集成后，您可以在 New Relic 中创建仪表板以可视化：

- 功能开关使用情况
- 发布进度
- 开关变更与系统错误之间的相关性

## 故障排除

如果数据没有出现：

1. 请检查 License Key 是否正确。
2. 检查 Gatrix 内部的连接状态。
3. 请等待约 5 分钟以使初始数据显示。
