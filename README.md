# Gate - Online Game Platform Management System

A comprehensive online game platform management system built with TypeScript, React, MUI, and Express.js. Gate provides robust user management, authentication, and administrative features for online gaming platforms.

## Features

- 🎮 **Game Platform Management**: Comprehensive platform for online game management
- 🔐 **Multi-Auth Support**: Password, Google OAuth, GitHub OAuth with JWT & refresh tokens
- 👥 **User Management**: Admin approval system for new registrations with role-based access
- 🎨 **Theme Support**: Dark, Light, and Auto themes with system preference detection
- 🌍 **Internationalization**: English, Korean, Chinese (Simplified) with i18next
- 📱 **Responsive Design**: Mobile-first design with collapsible sidebar
- 🚀 **Modern Stack**: TypeScript, React 18, MUI v5, SWR, Express.js
- 💾 **Database**: MySQL with comprehensive migration system and g_ table prefix
- 🔄 **Caching**: Redis for sessions, response caching, and rate limiting
- 📝 **Logging**: Winston logger with rotation and audit trails
- 🛡️ **Security**: Rate limiting, request deduplication, CORS protection
- 📊 **API Documentation**: Swagger/OpenAPI documentation
- 🧪 **Testing**: Comprehensive test suite with Jest, Vitest, and Cypress
- 🐳 **Docker Support**: Full containerization with docker-compose
- 🚀 **CI/CD**: GitHub Actions for automated testing and deployment

## Tech Stack

### Frontend
- React 18 with TypeScript
- Material-UI (MUI) v5 with custom theming
- SWR for data fetching and caching
- React Router v6 for routing
- React Hook Form with Yup validation
- i18next for internationalization (ko/en/zh)
- Vite for build tooling and HMR
- Vitest for unit testing
- Notistack for notifications

### Backend
- Express.js with TypeScript
- MySQL2 for database with connection pooling
- Redis for caching, sessions, and rate limiting
- Passport.js for multi-provider authentication
- Winston for structured logging
- JWT with refresh token support
- Joi for request validation
- Swagger for API documentation
- Jest for unit testing
- express-rate-limit for API protection

### DevOps & Tools
- Docker & docker-compose for containerization
- GitHub Actions for CI/CD
- Cypress for E2E testing
- ESLint & Prettier for code quality
- Yarn workspaces for monorepo management

## Project Structure

```
gate/
├── packages/
│   ├── backend/          # Express.js API server
│   │   ├── src/
│   │   │   ├── controllers/    # Request handlers
│   │   │   ├── middleware/     # Auth, validation, rate limiting
│   │   │   ├── routes/         # API route definitions
│   │   │   ├── services/       # Business logic
│   │   │   ├── database/       # DB connection & migrations
│   │   │   ├── models/         # Data models
│   │   │   ├── utils/          # Helper functions
│   │   │   ├── config/         # App configuration
│   │   │   └── test/           # Test utilities
│   │   │   ├── config/
│   │   │   └── types/
│   │   └── package.json
│   └── frontend/         # React frontend
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── utils/
│       │   ├── types/
│       │   ├── services/
│       │   ├── contexts/
│       │   └── locales/
│       └── package.json
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

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

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
- Email: admin@example.com (configurable via ADMIN_EMAIL)
- Password: admin123 (configurable via ADMIN_PASSWORD)

**Important**: Change the default credentials in production!

## License

MIT License
