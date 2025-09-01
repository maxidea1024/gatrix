# Gatrix - Online Game Platform Management System

A comprehensive online game platform management system built with TypeScript, React, MUI, and Express.js. Gatrix provides robust user management, authentication, and administrative features for online gaming platforms, specifically designed for UWO (Uncharted Waters Online) game management.

## Features

### Core Platform Features
- 🎮 **Game Platform Management**: Comprehensive platform for online game management
- 🌍 **Game World Management**: Multi-world support with individual configurations
- 📱 **Client Version Management**: Version control and distribution management
- 🔧 **Maintenance Mode**: System-wide maintenance control with custom messages
- 🏷️ **Tagging System**: Flexible tagging for content organization
- 📝 **Message Templates**: Multi-language message template management
- 🛡️ **IP Whitelisting**: Advanced IP access control and management

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
│   └── frontend/         # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── admin/       # Admin-specific components
│       │   │   ├── jobs/        # Job management components
│       │   │   └── common/      # Shared components
│       │   ├── pages/
│       │   │   ├── admin/       # Admin pages
│       │   │   │   ├── JobsPage.tsx
│       │   │   │   ├── SchedulerPage.tsx
│       │   │   │   ├── QueueMonitorPage.tsx
│       │   │   │   ├── MaintenancePage.tsx
│       │   │   │   └── MessageTemplatesPage.tsx
│       │   │   ├── settings/    # Settings pages
│       │   │   └── common/      # Common pages
│       │   ├── services/        # API services
│       │   │   ├── jobService.ts
│       │   │   ├── maintenanceService.ts
│       │   │   ├── messageTemplateService.ts
│       │   │   ├── tagService.ts
│       │   │   └── timeService.ts
│       │   ├── types/           # TypeScript definitions
│       │   ├── contexts/        # React contexts
│       │   ├── locales/         # i18n translations
│       │   └── utils/           # Helper functions
│       └── package.json
├── scripts/              # Utility scripts
│   ├── translation scripts     # i18n management
│   ├── setup.sh               # Environment setup
│   └── deploy.sh              # Deployment script
├── docker/               # Docker configurations
└── package.json          # Root package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Redis 6.0+

### Installation

1. Clone the repository
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
3. Update the `.env` file with your configuration
4. Install dependencies:
   ```bash
   npm install
   ```

### Database Setup

1. Create a MySQL database
2. Run migrations:
   ```bash
   npm run migrate
   ```
3. Seed initial data:
   ```bash
   npm run seed
   ```

### Development

Start both frontend and backend in development mode:
```bash
npm run dev
```

Or start them separately:
```bash
npm run dev:backend
npm run dev:frontend
```

### Building for Production

```bash
npm run build
```

### Queue Monitoring

Access the Bull Board queue monitoring interface at:
```
http://localhost:5001/admin/queues
```

This provides real-time monitoring of:
- Job queues status and statistics
- Active, waiting, completed, and failed jobs
- Job execution history and logs
- Queue performance metrics

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
- Email: Configurable via ADMIN_EMAIL environment variable (default: admin@example.com)
- Password: Configurable via ADMIN_PASSWORD environment variable (default: admin123)
- Name: Configurable via ADMIN_NAME environment variable (default: Administrator)

**Important**: Always set these environment variables and change the default credentials in production!

## Available Scripts

### Development Scripts
```bash
# Start both frontend and backend in development mode
npm run dev

# Start individual services
npm run dev:backend
npm run dev:frontend

# Build for production
npm run build

# Run tests
npm run test
npm run test:backend
npm run test:frontend
npm run test:e2e
```

### Database Management
```bash
# Run database migrations
npm run migrate
npm run migrate:up
npm run migrate:status
npm run migrate:rollback

# Database seeding
npm run seed
npm run seed:run
npm run seed:clear
npm run seed:reset

# Complete setup (install + migrate + seed)
npm run setup

# Reset database (clear + rollback + migrate + seed)
npm run reset

# Reset database completely
npm run db:reset
```

### Translation Management
```bash
# Check translation completeness
npm run check-translations

# Various translation utility scripts
node scripts/add-missing-keys.js
node scripts/complete-ko-translations.js
node scripts/complete-zh-translations.js
node scripts/fix-translations.js
node scripts/rebuild-locales.js
```

### Docker Operations
```bash
# Production Docker setup
npm run docker:up
npm run docker:down
npm run docker:logs
npm run docker:build

# Development Docker setup
npm run docker:dev
npm run docker:dev:down
npm run docker:dev:logs
npm run docker:dev:build
```

### Deployment
```bash
# Deploy to different environments
npm run deploy              # Production
npm run deploy:dev          # Development
npm run deploy:staging      # Staging
```

### Code Quality
```bash
# Linting
npm run lint
npm run lint:fix

# Type checking
npm run typecheck

# Clean build artifacts
npm run clean
```

## Docker Support

The project includes comprehensive Docker support with separate configurations for development and production:

### Development Environment
```bash
# Start development environment with hot reload
npm run docker:dev

# View logs
npm run docker:dev:logs

# Stop development environment
npm run docker:dev:down
```

### Production Environment
```bash
# Start production environment
npm run docker:up

# View logs
npm run docker:logs

# Stop production environment
npm run docker:down
```

The Docker setup includes:
- MySQL database with persistent storage
- Redis for caching and job queues
- Backend API server
- Frontend web server
- Nginx reverse proxy (production)
- Volume mounts for development

## Documentation

### API Documentation

Once the backend is running, you can access the Swagger API documentation at:
```
http://localhost:5001/api-docs
```

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

#### Writing Translations

To add or update translations:

```bash
# Generate translation files
npm run docs:write-translations

# Edit translation files in:
# docs/i18n/ko/docusaurus-plugin-content-docs/current/
# docs/i18n/zh-Hans/docusaurus-plugin-content-docs/current/
```

## License

MIT License
