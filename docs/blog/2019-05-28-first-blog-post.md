---
slug: welcome-to-gatrix
title: Welcome to Gatrix - A New Dimension of Game Platform Management
authors: [gatrix-team]
tags: [gatrix, announcement, features]
---

Gatrix is an integrated management system for online game services. We provide a powerful and scalable game management platform using modern technologies.

<!-- truncate -->

## 🚀 What is Gatrix?

Gatrix is a modern tech stack game platform management system built with TypeScript, React, MUI, and Express.js. This platform is designed to help game operators efficiently manage game servers, users, and content.

### Key Features

- **Integrated Game Platform Management**: Comprehensive platform for online game management
- **Game World Management**: Individual configuration for multiple worlds/shards
- **Client Version Control**: Version control and deployment management
- **Maintenance Mode**: Maintenance control with custom user messages
- **Flexible Tagging System**: Flexible tagging for content configuration
- **Message Templates**: Multi-language message template management
- **IP Whitelist**: Advanced IP access control and management
- **Real-time Chat**: High-performance chat server using Socket.IO and Redis clustering

## 🛠️ Quick Start

### 1. Requirements

- Node.js 22.0 or higher
- Docker & Docker Compose
- Yarn 1.22 or higher

### 2. Installation

```bash
# Clone repository
git clone https://github.com/your-org/gatrix.git
cd gatrix

# Setup environment variables
cp .env.example .env.local

# Install dependencies
yarn install

# Start infrastructure (MySQL, Redis)
yarn infra:up

# Run database migrations
yarn migrate

# Start development server
yarn dev
```

### 3. Access

Once the installation is complete, you can access the following URLs:

- **Frontend**: http://localhost:43000
- **Backend API**: http://localhost:45000
- **Edge Server**: http://localhost:3400
- **Chat Server**: http://localhost:45100
- **Event Lens**: http://localhost:45200
- **Grafana**: http://localhost:44000

## 🎯 Next Steps

1. **[API Documentation](../../api/client-api)**: Learn how to use the client API
2. **[Feature Flags](../../features/feature-flags)**: Understand feature control and testing
3. **[Job Management](../../features/job-management)**: Configure automated job scheduling
4. **[Game Worlds](../../features/game-worlds)**: Setup multiple game worlds

## 🤝 Community

- **GitHub**: [your-org/gatrix](https://github.com/your-org/gatrix)
- **Documentation**: [This site](../../intro)

Experience a new dimension of game platform management with Gatrix! 🎮
