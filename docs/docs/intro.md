---
sidebar_position: 1
---

# Getting Started with Gatrix

Welcome to **Gatrix**, a comprehensive online game platform management system built specifically for **UWO (Uncharted Waters Online)** game management.

## What is Gatrix?

Gatrix is a modern, full-stack platform that provides robust user management, authentication, and administrative features for online gaming platforms. Built with TypeScript, React, MUI, and Express.js, it offers a complete solution for game platform operations.

### Key Features

- 🎮 **Game Platform Management**: Comprehensive platform for online game management
- 🌍 **Game World Management**: Multi-world support with individual configurations
- 📱 **Client Version Management**: Version control and distribution management
- 🔧 **Maintenance Mode**: System-wide maintenance control with custom messages
- 🏷️ **Tagging System**: Flexible tagging for content organization
- 📝 **Message Templates**: Multi-language message template management
- 🛡️ **IP Whitelisting**: Advanced IP access control and management
- ⚙️ **Job Scheduler**: Advanced job scheduling with cron-like syntax
- 📊 **Queue Monitoring**: Real-time job queue monitoring with Bull Board

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/en/download/) version 18.0 or above
- [MySQL](https://dev.mysql.com/downloads/) version 8.0 or above
- [Redis](https://redis.io/download) version 6.0 or above

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/motifgames/gatrix.git
cd gatrix
```

### 2. Environment Setup

```bash
# Copy environment variables
cp .env.example .env

# Update the .env file with your configuration
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Database Setup

```bash
# Run database migrations
npm run migrate

# Seed initial data
npm run seed
```

### 5. Start Development Server

```bash
# Start both frontend and backend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- API Documentation: http://localhost:5001/api-docs
- Queue Monitor: http://localhost:5001/admin/queues

## Next Steps

- 📖 [Read the API Documentation](./api/client-api.md)
- 🔧 [Learn about the Cache System](./backend/cache-keys.md)
- 🚀 [Explore Job Management](./features/job-management.md)
- 🌍 [Configure Game Worlds](./features/game-worlds.md)
