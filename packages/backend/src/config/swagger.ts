import swaggerJSDoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gatrix API',
      version: '1.0.0',
      description: 'Gatrix - Online Game Platform Management System API',
      contact: {
        name: 'Motif Games',
        email: 'admin@motifgames.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api/v1`,
        description: 'Development server',
      },
      {
        url: 'https://api.gatrix.motifgames.com/api/v1',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3400/api/v1',
        description: 'Edge server (Local)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'gatrix-session',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            displayName: {
              type: 'string',
              description: 'Display name',
            },
            role: {
              type: 'string',
              enum: ['admin', 'user', 'pending'],
              description: 'User role',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether user is active',
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password',
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'username', 'displayName'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password',
            },
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 30,
              description: 'Username',
            },
            displayName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Display name',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            message: {
              type: 'string',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
            accessToken: {
              type: 'string',
              description: 'JWT access token',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            error: {
              type: 'string',
              description: 'Error code or type',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
          },
        },
        Tag: {
          type: 'object',
          description: 'Tag object used to categorize resources',
          properties: {
            id: { type: 'integer', description: 'Tag ID' },
            name: { type: 'string', description: 'Tag name' },
          },
        },
        GameWorld: {
          type: 'object',
          description: 'Game world entity',
          properties: {
            id: { type: 'integer', description: 'Internal numeric ID' },
            worldId: {
              type: 'string',
              description: 'Stable world identifier (unique)',
            },
            name: { type: 'string', description: 'Display name' },
            isVisible: { type: 'boolean', description: 'Visibility flag' },
            isMaintenance: {
              type: 'boolean',
              description: 'Maintenance mode flag',
            },
            displayOrder: {
              type: 'integer',
              description: 'Ordering value (lower first or as defined)',
            },
            description: {
              type: 'string',
              description: 'Optional description',
              nullable: true,
            },
            maintenanceStartDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Maintenance start (MySQL DATETIME formatted string)',
            },
            maintenanceEndDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Maintenance end (MySQL DATETIME formatted string)',
            },
            maintenanceMessage: {
              type: 'string',
              nullable: true,
              description: 'Maintenance message (default locale)',
            },
            supportsMultiLanguage: {
              type: 'boolean',
              description: 'Whether maintenance message supports multiple languages',
            },
            maintenanceLocales: {
              type: 'array',
              description: 'Per-language maintenance messages',
              items: {
                type: 'object',
                properties: {
                  lang: {
                    type: 'string',
                    enum: ['ko', 'en', 'zh'],
                    description: 'Language code',
                  },
                  message: {
                    type: 'string',
                    description: 'Localized maintenance message',
                  },
                },
              },
            },
            customPayload: {
              type: 'object',
              description: 'Custom JSON payload',
              additionalProperties: true,
              nullable: true,
            },
            createdBy: { type: 'integer', description: 'Creator user ID' },
            updatedBy: {
              type: 'integer',
              description: 'Last updater user ID',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
            tags: {
              type: 'array',
              description: 'Associated tags',
              items: { $ref: '#/components/schemas/Tag' },
            },
          },
        },
        ClientVersion: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 101 },
            platform: { type: 'string', example: 'android' },
            clientVersion: { type: 'string', example: '1.2.3' },
            clientStatus: {
              type: 'string',
              enum: [
                'ONLINE',
                'OFFLINE',
                'RECOMMENDED_UPDATE',
                'FORCED_UPDATE',
                'UNDER_REVIEW',
                'BLOCKED_PATCH_ALLOWED',
                'MAINTENANCE',
              ],
              example: 'ONLINE',
            },
            gameServerAddress: {
              type: 'string',
              example: 'https://game.gatrix.io',
            },
            patchAddress: {
              type: 'string',
              example: 'https://patch.gatrix.io',
            },
            guestModeAllowed: { type: 'boolean', example: true },
            externalClickLink: {
              type: 'string',
              nullable: true,
              example: 'https://gatrix.io/news/123',
            },
            maintenanceMessage: {
              type: 'string',
              nullable: true,
              example: 'Server check in progress.',
            },
            maintenanceLocales: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  lang: { type: 'string', example: 'ko' },
                  message: { type: 'string', example: '서버 점검 중입니다.' },
                },
              },
            },
            customPayload: {
              type: 'object',
              example: { featureFlag: true, bannerId: 'abc' },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-12-01T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-12-05T15:30:00Z',
            },
          },
        },
        Banner: {
          type: 'object',
          properties: {
            bannerId: { type: 'string', example: 'banner_xmas_2025' },
            name: { type: 'string', example: 'Christmas Event Banner' },
            description: {
              type: 'string',
              example: 'Main lobby banner for Christmas',
            },
            width: { type: 'integer', example: 1024 },
            height: { type: 'integer', example: 512 },
            playbackSpeed: { type: 'number', example: 1.0 },
            sequences: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sequenceId: { type: 'string', example: 'seq_1' },
                  frames: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        frameId: { type: 'string', example: 'frame_1_1' },
                        imageUrl: {
                          type: 'string',
                          example: 'https://cdn.gatrix.io/frames/1.jpg',
                        },
                        type: { type: 'string', example: 'jpg' },
                        delay: { type: 'integer', example: 200 },
                      },
                    },
                  },
                },
              },
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'archived'],
              example: 'published',
            },
            version: { type: 'integer', example: 5 },
            metadata: {
              type: 'object',
              example: { deepLink: 'app://event/xmas' },
            },
          },
        },
        ServiceNotice: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 42 },
            isActive: { type: 'boolean', example: true },
            category: {
              type: 'string',
              enum: ['maintenance', 'event', 'notice', 'promotion', 'other'],
              example: 'notice',
            },
            platforms: {
              type: 'array',
              items: { type: 'string' },
              example: ['android', 'ios'],
            },
            title: { type: 'string', example: 'Emergency Maintenance' },
            content: {
              type: 'string',
              example: 'We will be performing emergency maintenance tonight.',
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-12T12:00:00Z',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-12T14:00:00Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-12-12T09:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-12-12T09:30:00Z',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Unauthorized - missing or invalid authentication',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                missingToken: {
                  summary: 'Missing bearer token',
                  value: {
                    success: false,
                    message: 'Authentication required: missing token',
                    error: 'UNAUTHORIZED',
                  },
                },
                invalidToken: {
                  summary: 'Invalid/expired token',
                  value: {
                    success: false,
                    message: 'Invalid or expired token',
                    error: 'TOKEN_INVALID',
                  },
                },
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Forbidden - insufficient privileges',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'You do not have permission to perform this action',
                error: 'FORBIDDEN',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Resource not found',
                error: 'NOT_FOUND',
              },
            },
          },
        },
        BadRequestError: {
          description: 'Bad request - validation or input error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                validation: {
                  summary: 'Validation failed',
                  value: {
                    success: false,
                    message: 'Validation failed: field is required',
                    error: 'VALIDATION_ERROR',
                    details: { field: 'email' },
                  },
                },
              },
            },
          },
        },
        TooManyRequestsError: {
          description: 'Too many requests - rate limit exceeded',
          headers: {
            'Retry-After': {
              description: 'Time in seconds to wait before retrying',
              schema: { type: 'integer', example: 60 },
            },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Too many requests',
                error: 'RATE_LIMITED',
              },
            },
          },
        },
      },
      parameters: {
        PageParam: {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number (1-based)',
        },
        LimitParam: {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Items per page',
        },
        SearchParam: {
          in: 'query',
          name: 'search',
          schema: { type: 'string' },
          description: 'Free-text search keyword',
        },
        LangParam: {
          in: 'query',
          name: 'lang',
          schema: { type: 'string', enum: ['ko', 'en', 'zh'] },
          description: 'Preferred language for localized messages',
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints (requires admin role)',
      },
      {
        name: 'Client',
        description: 'Public client endpoints (no authentication required, cached)',
      },
      {
        name: 'GameWorlds',
        description: 'Game world management endpoints',
      },
      {
        name: 'Client Versions',
        description: 'Client version management endpoints',
      },
      {
        name: 'Whitelist',
        description: 'User whitelist management endpoints',
      },
      {
        name: 'Audit Logs',
        description: 'System audit log endpoints',
      },
      {
        name: 'ClientSDK',
        description: 'Client SDK endpoints (require API token and application name headers)',
      },
      {
        name: 'RemoteConfig',
        description: 'Remote configuration evaluation and template endpoints',
      },
      {
        name: 'Monitoring',
        description: 'Operational monitoring endpoints (crash, stats)',
      },
    ],
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/**/*.ts',
    './src/controllers/**/*.ts',
    './src/models/**/*.ts',
    '../edge/src/routes/**/*.ts',
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
