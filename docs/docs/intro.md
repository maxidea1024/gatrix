---
sidebar_position: 1
---

# Introduction to Gatrix

**Gatrix** is a comprehensive management system for online game services.

## 🎯 Core Features

### Feature Flags
Control features in real-time without code deployment.
- Gradual rollout by environment/segment
- A/B testing support
- Instant rollback

### Game Operations Tools
- **Notices** - In-game and external notice management
- **Popup Notices** - Targeted in-game popups
- **Coupons** - Reward coupon creation and management
- **Surveys** - User feedback collection
- **Banners** - Promotional banner management
- **Store Products** - In-app product management
- **Planning Data** - Game balance and configuration data

### System Management
- **Maintenance** - Scheduled/emergency maintenance
- **Whitelist** - Test account/IP management
- **Game Worlds** - Server status monitoring
- **Client Versions** - App version management

### Integrations
Support for Slack, Microsoft Teams, Webhook, New Relic, Lark, and more

### Monitoring
- **Event Lens** - Event analytics and statistics
- **Grafana Dashboard** - Real-time metrics monitoring
- **Audit Logs** - Complete change history tracking

## 🏗️ Architecture

Gatrix is a microservices architecture in a monorepo structure:

| Package | Description |
|---------|-------------|
| `@gatrix/backend` | Main API server |
| `@gatrix/frontend` | Admin dashboard (React + MUI) |
| `@gatrix/edge` | Edge server (cache/CDN) |
| `@gatrix/chat-server` | Real-time chat server |
| `@gatrix/event-lens` | Event analytics server |
| `@gatrix/server-sdk` | Game server SDK |
| `@gatrix/shared` | Shared types and utilities |

## 🚀 Quick Start

```bash
# 1. Install dependencies
yarn install

# 2. Start infrastructure (MySQL, Redis)
yarn infra:up

# 3. Run migrations
yarn migrate

# 4. Start development server
yarn dev
```

Access: http://localhost:43000

## 🌐 Supported Languages

- 🇰🇷 한국어
- 🇺🇸 English
- 🇨🇳 简体中文

## 📚 Documentation Structure

| Section | Description |
|---------|-------------|
| [Getting Started](./getting-started/quick-start) | Installation and initial setup |
| [Feature Flags](./features/feature-flags) | Feature toggle usage |
| [Game Operations](./guide/service-notices) | Operations tool guides |
| [System Management](./admin/maintenance) | System management guide |
| [Integrations](./integrations/overview) | Integration setup guide |
| [API Reference](./api/client-api) | API documentation |
