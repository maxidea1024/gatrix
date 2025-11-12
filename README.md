# Gatrix - Online Game Platform Management System

A comprehensive online game platform management system built with TypeScript, React, MUI, and Express.js. Gatrix provides robust user management, authentication, and administrative features for online gaming platforms, enabling efficient management and operation of multiplayer online games.

## Features

### Core Platform Features
- 🎮 **Game Platform Management**: Comprehensive platform for online game management
- 🌍 **Game World Management**: Multi-world support with individual configurations
- 📱 **Client Version Management**: Version control and distribution management
- 🔧 **Maintenance Mode**: System-wide maintenance control with custom messages
- 🏷️ **Tagging System**: Flexible tagging for content organization
- 📝 **Message Templates**: Multi-language message template management
- 🛡️ **IP Whitelisting**: Advanced IP access control and management
- 💬 **Real-time Chat**: High-performance chat server with Socket.IO and Redis clustering

### Authentication & Security
- 🔐 **Multi-Auth Support**: Password, Google OAuth, GitHub OAuth with JWT & refresh tokens
- 👥 **User Management**: Admin approval system for new registrations with role-based access
- 🛡️ **Security**: Rate limiting, request deduplication, CORS protection
- 📊 **Audit Logging**: Comprehensive audit trails for all administrative actions

### Job Management & Automation
- ⚙️ **Job Scheduler**: Advanced job scheduling with cron-like syntax
- 📧 **Email Jobs**: Automated email sending with templates
- 🌐 **HTTP Request Jobs**: Automated HTTP requests and API calls
- 🖥️ **SSH Command Jobs**: Remote server command execution
- 📝 **Log Message Jobs**: Structured logging and message handling
- 📊 **Queue Monitoring**: Real-time job queue monitoring with Bull Board

### Real-time Communication
- 💬 **Chat Server**: High-performance real-time messaging with Socket.IO
- 🔄 **Message Broadcasting**: Optimized batch processing for 100,000+ messages/second
- 📡 **WebSocket Management**: Efficient connection handling with Redis clustering
- 🏷️ **Channel Management**: Multi-channel support with user presence tracking
- 📊 **Performance Monitoring**: Real-time metrics with Prometheus and Grafana
- 🔒 **Secure Messaging**: JWT authentication and rate limiting

### User Interface & Experience
- 🎨 **Theme Support**: Dark, Light, and Auto themes with system preference detection
- 🌍 **Internationalization**: English, Korean, Chinese (Simplified) with i18next
- 📱 **Responsive Design**: Mobile-first design with collapsible sidebar
- 📅 **Calendar Integration**: FullCalendar for scheduling and event management
- 🔄 **Real-time Updates**: Live data synchronization with SWR

### Technical Infrastructure
- 🚀 **Modern Stack**: TypeScript, React 18, MUI v5, SWR, Express.js
- 💾 **Database**: MySQL with comprehensive migration system and g_ table prefix
- 🔄 **Caching**: Redis for sessions, response caching, and rate limiting with BullMQ
- 📝 **Logging**: Winston logger with rotation and audit trails
- 📊 **API Documentation**: Swagger/OpenAPI documentation
- 🧪 **Testing**: Comprehensive test suite with Jest, Vitest, and Cypress
- 🐳 **Docker Support**: Full containerization with docker-compose
- 🚀 **CI/CD**: GitHub Actions for automated testing and deployment

## Tech Stack

### Frontend
- React 18 with TypeScript
- Material-UI (MUI) v5 with custom theming
- SWR for data fetching and caching
- React Router v7 for routing
- React Hook Form with Yup validation
- i18next for internationalization (ko/en/zh)
- Vite for build tooling and HMR
- Vitest for unit testing
- Notistack & React Toastify for notifications
- FullCalendar for scheduling and calendar views
- Monaco Editor for code editing
- Chart.js with React Chart.js 2 for data visualization
- DnD Kit for drag and drop functionality
- MUI X Date Pickers for advanced date/time selection

### Backend
- Express.js with TypeScript
- MySQL2 for database with connection pooling
- Redis for caching, sessions, and rate limiting
- BullMQ for job queue management and processing
- Bull Board for queue monitoring and management
- Passport.js for multi-provider authentication
- Winston for structured logging with daily rotation
- JWT with refresh token support
- Joi for request validation
- Swagger for API documentation
- Jest for unit testing
- express-rate-limit for API protection
- SSH2 for remote server command execution
- Nodemailer & SendGrid for email services
- Cron-parser for job scheduling

### Chat Server
- Socket.IO for real-time WebSocket communication
- Redis Adapter for multi-instance synchronization
- BullMQ for message queue processing
- Prometheus for performance metrics
- Winston for structured logging
- JWT for authentication
- Rate limiting for DDoS protection
- MessagePack for efficient serialization
- LRU Cache for message optimization

### DevOps & Tools
- Docker & docker-compose for containerization
- GitHub Actions for CI/CD
- Cypress for E2E testing
- ESLint & Prettier for code quality
- Yarn workspaces for monorepo management

## Project Structure

```
gatrix/
├── packages/
│   ├── backend/          # Express.js API server
│   │   ├── src/
│   │   │   ├── controllers/    # Request handlers
│   │   │   │   ├── AdminController.ts
│   │   │   │   ├── ClientController.ts
│   │   │   │   ├── GameWorldController.ts
│   │   │   │   ├── ClientVersionController.ts
│   │   │   │   ├── IpWhitelistController.ts
│   │   │   │   ├── MaintenanceController.ts
│   │   │   │   ├── MessageTemplateController.ts
│   │   │   │   ├── TagController.ts
│   │   │   │   ├── VarsController.ts
│   │   │   │   ├── jobController.ts
│   │   │   │   ├── jobExecutionController.ts
│   │   │   │   └── jobTypeController.ts
│   │   │   ├── middleware/      # Auth, validation, rate limiting
│   │   │   ├── routes/          # API route definitions
│   │   │   ├── services/        # Business logic
│   │   │   │   ├── jobs/        # Job implementations
│   │   │   │   │   ├── HttpRequestJob.ts
│   │   │   │   │   ├── MailSendJob.ts
│   │   │   │   │   ├── SshCommandJob.ts
│   │   │   │   │   ├── LogMessageJob.ts
│   │   │   │   │   └── JobFactory.ts
│   │   │   │   ├── CacheService.ts
│   │   │   │   ├── QueueService.ts
│   │   │   │   ├── PubSubService.ts
│   │   │   │   └── TagService.ts
│   │   │   ├── database/        # DB connection & migrations
│   │   │   ├── models/          # Data models
│   │   │   │   ├── Job.ts
│   │   │   │   ├── JobExecution.ts
│   │   │   │   ├── JobType.ts
│   │   │   │   ├── MessageTemplate.ts
│   │   │   │   ├── Tag.ts
│   │   │   │   ├── IpWhitelist.ts
│   │   │   │   └── Vars.ts
│   │   │   ├── config/          # App configuration
│   │   │   │   └── bullboard.ts # Queue monitoring
│   │   │   ├── constants/       # Cache keys & constants
│   │   │   ├── utils/           # Helper functions
│   │   │   └── types/           # TypeScript definitions
│   │   └── package.json
│   ├── frontend/         # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── admin/       # Admin-specific components
│   │   │   │   ├── jobs/        # Job management components
│   │   │   │   └── common/      # Shared components
│   │   │   ├── pages/
│   │   │   │   ├── admin/       # Admin pages
│   │   │   │   │   ├── JobsPage.tsx
│   │   │   │   │   ├── SchedulerPage.tsx
│   │   │   │   │   ├── QueueMonitorPage.tsx
│   │   │   │   │   ├── MaintenancePage.tsx
│   │   │   │   │   └── MessageTemplatesPage.tsx
│   │   │   │   ├── settings/    # Settings pages
│   │   │   │   └── common/      # Common pages
│   │   │   ├── services/        # API services
│   │   │   │   ├── jobService.ts
│   │   │   │   ├── maintenanceService.ts
│   │   │   │   ├── messageTemplateService.ts
│   │   │   │   ├── tagService.ts
│   │   │   │   └── timeService.ts
│   │   │   ├── types/           # TypeScript definitions
│   │   │   ├── contexts/        # React contexts
│   │   │   ├── locales/         # i18n translations
│   │   │   └── utils/           # Helper functions
│   │   └── package.json
│   ├── chat-server/      # Real-time chat server
│   │   ├── src/
│   │   │   ├── controllers/     # Chat controllers
│   │   │   ├── services/        # Chat services
│   │   │   ├── models/          # Chat data models
│   │   │   ├── middleware/      # Chat middleware
│   │   │   ├── routes/          # Chat API routes
│   │   │   ├── websocket/       # Socket.IO handlers
│   │   │   ├── database/        # Chat DB migrations
│   │   │   └── utils/           # Helper functions
│   │   └── package.json
│   └── sdks/             # Client SDKs
│       └── nodejs/       # Node.js SDK
├── scripts/              # Utility scripts
│   ├── translation scripts     # i18n management
│   ├── setup.sh               # Environment setup
│   └── deploy.sh              # Deployment script
├── docker/               # Docker configurations
├── docs/                 # Documentation site (Docusaurus)
└── package.json          # Root package.json
```

## Getting Started

### Prerequisites

- **Node.js 20+** (Required for latest dependencies)
- **MySQL 8.0+**
- **Redis 7.0+**
- **ClickHouse 24+** (for Event Lens analytics)
- **Yarn 1.22+** (Package manager)
- **Docker & Docker Compose** (for containerized development)

### Installation

1. Clone the repository

2. **Auto-generate `.env` file** (Recommended):

   **Basic Setup (Development):**
   ```powershell
   # Windows
   .\setup-env.ps1 -HostAddress localhost -Environment development

   # Linux/Mac
   ./setup-env.sh localhost development
   ```

   **With Custom Language (optional, default: ko):**
   ```powershell
   # Windows - English
   .\setup-env.ps1 -HostAddress localhost -Environment development -DefaultLanguage en

   # Linux/Mac - Chinese
   ./setup-env.sh localhost development zh
   ```

   **With Custom Admin Password (optional, default: admin123):**
   ```powershell
   # Windows
   .\setup-env.ps1 -HostAddress localhost -Environment development -AdminPassword "MySecurePassword123"

   # Linux/Mac
   ./setup-env.sh localhost development ko --admin-password "MySecurePassword123"
   ```

   **For Production:**
   ```powershell
   # Windows
   .\setup-env.ps1 -HostAddress example.com -Environment production

   # Linux/Mac
   ./setup-env.sh example.com production
   ```

   **Force Overwrite Existing .env File:**
   ```powershell
   # Windows
   .\setup-env.ps1 -HostAddress localhost -Environment development -Force

   # Linux/Mac
   ./setup-env.sh localhost development --force
   ```

   **Complete Example with All Options:**
   ```powershell
   # Windows
   .\setup-env.ps1 -HostAddress example.com -Environment production -DefaultLanguage en -AdminPassword "SecurePass123" -Force

   # Linux/Mac
   ./setup-env.sh example.com production en --admin-password "SecurePass123" --force
   ```

   The script will:
   - Check if `.env` file already exists (will not overwrite without -Force flag)
   - Generate secure JWT_SECRET (32 chars), SESSION_SECRET (20 chars), and JWT_REFRESH_SECRET (32 chars)
   - Configure database and Redis hosts for Docker environment
   - Set appropriate CORS and logging settings based on environment
   - Set default language (default: Korean - ko, en, zh supported)
   - Set admin password (default: admin123)
   - Backup existing `.env` file if present (when using -Force flag)

3. **Manual setup** (Alternative):
   ```bash
   cp .env.example .env
   ```
   Then update the `.env` file with your configuration

4. Install dependencies:
   ```bash
   yarn install
   ```

### Database Setup

1. Create a MySQL database
2. Run migrations:
   ```bash
   yarn migrate
   ```
3. Seed initial data:
   ```bash
   yarn seed
   ```

### Development

#### Using Docker (Recommended)

Start all services with Docker Compose:
```bash
# Development environment with hot reload
yarn docker:dev

# View logs
yarn docker:dev:logs

# Stop services
yarn docker:dev:down
```

#### Local Development

Start all services locally:
```bash
yarn dev
```

Or start them separately:
```bash
yarn dev:backend
yarn dev:frontend
yarn dev:chat-server
yarn dev:event-lens
yarn dev:event-lens:worker
```

### Building for Production

```bash
yarn build
```

### Queue Monitoring

Access the Bull Board queue monitoring interface at:
```
http://localhost:55000/admin/queues
```
(Backend internal port 5000 + 50000 offset = 55000)

This provides real-time monitoring of:
- Job queues status and statistics
- Active, waiting, completed, and failed jobs
- Job execution history and logs
- Queue performance metrics

### Development Tools (Docker Dev Environment)

When running with `yarn docker:dev`, additional tools are available:

- **Adminer** (Database Management): http://localhost:58080
- **Redis Commander** (Redis Management): http://localhost:58081
- **Frontend**: http://localhost:53000
- **Backend API**: http://localhost:55000
- **Chat Server**: http://localhost:53001
- **Event Lens**: http://localhost:53002

(All ports use internal port + 50000 offset)

## Key Features

### Job Management System

The platform includes a comprehensive job management system with the following capabilities:

#### Job Types
- **Mail Send Jobs**: Automated email sending with template support
- **HTTP Request Jobs**: Execute HTTP requests to external APIs
- **SSH Command Jobs**: Run commands on remote servers via SSH
- **Log Message Jobs**: Structured logging and message handling

#### Job Scheduling
- Cron-like scheduling syntax for recurring jobs
- One-time job execution
- Job retry mechanisms with exponential backoff
- Timeout handling and error recovery

#### Queue Management
- BullMQ-based job queue system
- Real-time queue monitoring with Bull Board
- Job prioritization and delay options
- Distributed job processing

### Message Template System

Multi-language message template management:
- Support for Korean, English, and Chinese
- Template categorization (maintenance, general, notification)
- Dynamic variable substitution
- Template versioning and history

### IP Whitelisting

Advanced IP access control:
- CIDR notation support
- IP range management
- Automatic IP validation
- Access logging and monitoring

### Maintenance Mode

System-wide maintenance control:
- Scheduled maintenance windows
- Custom maintenance messages
- User notification system
- Graceful service degradation

### Tagging System

Flexible content organization:
- Multi-entity tagging support
- Tag-based filtering and search
- Tag assignment management
- Tag usage analytics

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key configurations include:

#### Database Configuration
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gatrix
DB_USER=your_username
DB_PASSWORD=your_password
```

#### Redis Configuration
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

#### Job Queue Configuration
```env
QUEUE_REDIS_HOST=localhost
QUEUE_REDIS_PORT=6379
QUEUE_REDIS_PASSWORD=your_queue_redis_password
```

#### Email Configuration
```env
SENDGRID_API_KEY=your_sendgrid_api_key
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

#### SSH Configuration (for SSH jobs)
```env
SSH_DEFAULT_HOST=your_server_host
SSH_DEFAULT_PORT=22
SSH_DEFAULT_USER=your_ssh_user
SSH_PRIVATE_KEY_PATH=/path/to/private/key
```

### OAuth Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:5000/auth/google/callback`

#### GitHub OAuth
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:5000/auth/github/callback`

## Default Admin Account

The system creates a default admin account on first run:
- Email: Configurable via ADMIN_EMAIL environment variable (default: admin@gatrix.com)
- Password: Configurable via ADMIN_PASSWORD environment variable (default: admin123)
- Name: Configurable via ADMIN_NAME environment variable (default: Administrator)

**Important**: Always set these environment variables and change the default credentials in production!

## Available Scripts

### Development Scripts
```bash
# Start all services in development mode
yarn dev

# Start individual services
yarn dev:backend
yarn dev:frontend
yarn dev:chat-server
yarn dev:event-lens
yarn dev:event-lens:worker

# Build for production
yarn build

# Build individual services
yarn build:backend
yarn build:frontend
yarn build:chat-server
yarn build:event-lens

# Run tests
yarn test
yarn test:backend
yarn test:frontend
yarn test:e2e

# Linting
yarn lint
yarn lint:fix

# Type checking
yarn typecheck
```

### Database Management
```bash
# Run database migrations
yarn migrate
yarn migrate:up
yarn migrate:status
yarn migrate:rollback

# Database seeding
yarn seed
yarn seed:run
yarn seed:clear
yarn seed:reset

# Complete setup (install + migrate + seed)
yarn setup

# Reset database (clear + rollback + migrate + seed)
yarn reset

# Reset database completely
yarn db:reset
```

### Docker Operations
```bash
# Production Docker setup
yarn docker:up
yarn docker:down
yarn docker:logs
yarn docker:build

# Development Docker setup (Recommended)
yarn docker:dev
yarn docker:dev:down
yarn docker:dev:logs
yarn docker:dev:build
```

### Deployment
```bash
# Deploy to different environments
yarn deploy              # Production
yarn deploy:dev          # Development
yarn deploy:staging      # Staging
```

### Code Quality
```bash
# Linting
yarn lint
yarn lint:fix

# Type checking
yarn typecheck

# Clean build artifacts
yarn clean
```

## Docker Support

The project includes comprehensive Docker support with separate configurations for development and production, using **Yarn Workspaces** for monorepo management.

### Development Environment (Recommended)

```bash
# Start development environment with hot reload
yarn docker:dev

# View logs for all services
yarn docker:dev:logs

# View logs for specific service
docker compose -f docker-compose.dev.yml logs -f backend-dev
docker compose -f docker-compose.dev.yml logs -f event-lens-dev

# Stop development environment
yarn docker:dev:down

# Rebuild specific service
docker compose -f docker-compose.dev.yml build --no-cache backend-dev
```

### Production Environment

```bash
# Start production environment
yarn docker:up

# View logs
yarn docker:logs

# Stop production environment
yarn docker:down

# Rebuild all services
yarn docker:build
```

### Docker Services

The Docker setup includes:

**Infrastructure Services:**
- **MySQL 8.0**: Database with persistent storage
- **Redis 7**: Caching, sessions, and job queues
- **ClickHouse 24**: Analytics data storage (Event Lens)

**Application Services:**
- **Backend**: Express.js API server (Node 20)
- **Frontend**: React web application (Node 20)
- **Event Lens**: Analytics server and worker (Node 20)
- **Chat Server**: Real-time messaging with Socket.IO (Node 20)

**Development Tools (dev environment only):**
- **Adminer**: Database management UI
- **Redis Commander**: Redis management UI

**Production Only:**
- **Nginx**: Reverse proxy and load balancer

### Key Features

- ✅ **Hot Reload**: Development environment supports live code updates
- ✅ **Persistent Storage**: Data volumes for MySQL, Redis, and ClickHouse
- ✅ **Health Checks**: All services include health monitoring
- ✅ **Yarn Workspaces**: Unified dependency management
- ✅ **Node 20**: All services use Node.js 20 for latest features

### Service Ports

**Port Offset Strategy**: To avoid port conflicts, the application uses a +50000 offset for all external ports (both development and production environments).

| Service | Internal Port | External Port | Description | Environment |
|---------|---------------|---------------|-------------|-------------|
| MySQL | 3306 | 53306 | Database | Both |
| Redis | 6379 | 56379 | Cache & Queue | Both |
| Backend | 5000 | 55000 | API Server | Both |
| Frontend | 3000 | 53000 | Web UI | Both |
| Chat Server | 3001 | 53001 | WebSocket Server | Both |
| Event Lens | 3002 | 53002 | Analytics API | Both |
| ClickHouse | 8123, 9000 | 58123, 59000 | Analytics DB | Both |
| Adminer | 8080 | 58080 | DB Management | Dev only |
| Redis Commander | 8081 | 58081 | Redis Management | Dev only |
| Metrics (Chat) | 9090 | 59090 | Prometheus Metrics | Both |
| Debug (Backend) | 9229 | 59229 | Node.js Debugger | Dev only |

**Notes:**
- **Internal Port**: Port used inside Docker containers (always the same)
- **External Port**: Port exposed on your local machine or server (internal port + 50000)
- **Formula**: External Port = Internal Port + 50000
- **Examples**:
  - Frontend: `http://localhost:53000` (internal 3000 + 50000)
  - Backend API: `http://localhost:55000` (internal 5000 + 50000)
  - MySQL: `localhost:53306` (internal 3306 + 50000)
  - Redis: `localhost:56379` (internal 6379 + 50000)

## Documentation

### API Documentation

Once the backend is running, you can access the Swagger API documentation at:
```
http://localhost:55000/api-docs
```
(Backend internal port 5000 + 50000 offset = 55000)

The API includes endpoints for:
- User authentication and management
- Game world management
- Client version control
- Job management and scheduling
- Message template management
- IP whitelist management
- Maintenance mode control
- Tag management
- Audit logging
- Real-time chat integration

### Comprehensive Documentation

Gatrix includes a comprehensive documentation site built with Docusaurus, supporting multiple languages:

```bash
# Start documentation site
npm run docs:start

# Build documentation for production
npm run docs:build

# Serve built documentation
npm run docs:serve
```

The documentation site will be available at:
```
http://localhost:3000
```

#### Supported Languages

- **English** (default): Complete documentation
- **Korean (한국어)**: Full translation available
- **Chinese Simplified (简体中文)**: Full translation available

#### Documentation Sections

- **Getting Started**: Quick setup and installation guide
- **API Reference**: Detailed API endpoint documentation
- **Backend**: Cache system and internal architecture
- **Features**: Comprehensive feature guides
  - Job Management System
  - Game World Management
  - Message Templates
  - IP Whitelisting
  - Maintenance Mode
  - Tagging System

## License

Gatrix is proprietary software owned and maintained by the Gatrix Team. All rights reserved.

For licensing inquiries, please contact the Gatrix Team.
