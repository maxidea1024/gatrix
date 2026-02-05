---
sidebar_position: 3
---

# 环境管理

Gatrix 通过环境（Environments）支持多阶段的发布工作流。

## 默认环境

系统通常预设以下环境：
- **Development**: 开发和内部测试
- **Staging**: 预发布和 QA 测试
- **Production**: 对真实玩家开放的生产环境

## 环境隔离

每个环境的功能开关值是完全隔离的。这意味着您可以在生产环境中关闭某个功能，而在开发环境中开启它进行测试。

## 秘钥管理

每个环境都有自己唯一的 **Server SDK API Key** 和 **Client API Key**。请确保在对应的服务器或客户端应用中使用正确的秘钥。
