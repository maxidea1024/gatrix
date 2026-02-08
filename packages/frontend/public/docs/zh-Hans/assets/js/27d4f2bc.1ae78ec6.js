'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [1543],
  {
    782(e, n, i) {
      (i.r(n),
        i.d(n, {
          assets: () => c,
          contentTitle: () => l,
          default: () => h,
          frontMatter: () => t,
          metadata: () => s,
          toc: () => o,
        }));
      const s = JSON.parse(
        '{"id":"deployment/edge-server","title":"Edge Server Guide","description":"The Edge server is a high-availability client-facing API gateway that caches Gatrix backend data and serves it to game clients and servers with low latency.","source":"@site/docs/deployment/edge-server.md","sourceDirName":"deployment","slug":"/deployment/edge-server","permalink":"/docs/zh-Hans/deployment/edge-server","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/deployment/edge-server.md","tags":[],"version":"current","sidebarPosition":51,"frontMatter":{"slug":"/deployment/edge-server","title":"Edge Server Guide","sidebar_position":51},"sidebar":"tutorialSidebar","previous":{"title":"Docker Deployment Guide","permalink":"/docs/zh-Hans/deployment/docker"}}'
      );
      var d = i(4848),
        r = i(8453);
      const t = {
          slug: '/deployment/edge-server',
          title: 'Edge Server Guide',
          sidebar_position: 51,
        },
        l = 'Edge Server Guide',
        c = {},
        o = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Polling Mode', id: 'polling-mode', level: 3 },
          { value: 'API Endpoints', id: 'api-endpoints', level: 2 },
          { value: 'Health Checks', id: 'health-checks', level: 3 },
          { value: 'Client APIs', id: 'client-apis', level: 3 },
          { value: 'Internal APIs (Separate Port)', id: 'internal-apis-separate-port', level: 3 },
          { value: 'Health Check Response Example', id: 'health-check-response-example', level: 2 },
          {
            value: 'Internal Cache Status Response Example',
            id: 'internal-cache-status-response-example',
            level: 2,
          },
          { value: 'Docker Compose Configuration', id: 'docker-compose-configuration', level: 2 },
          { value: 'Production', id: 'production', level: 3 },
          { value: 'Development', id: 'development', level: 3 },
          { value: 'Troubleshooting', id: 'troubleshooting', level: 2 },
          { value: 'Cache Not Updating', id: 'cache-not-updating', level: 3 },
          { value: 'Environment Data Missing', id: 'environment-data-missing', level: 3 },
        ];
      function a(e) {
        const n = {
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          header: 'header',
          li: 'li',
          ol: 'ol',
          p: 'p',
          pre: 'pre',
          strong: 'strong',
          table: 'table',
          tbody: 'tbody',
          td: 'td',
          th: 'th',
          thead: 'thead',
          tr: 'tr',
          ul: 'ul',
          ...(0, r.R)(),
          ...e.components,
        };
        return (0, d.jsxs)(d.Fragment, {
          children: [
            (0, d.jsx)(n.header, {
              children: (0, d.jsx)(n.h1, {
                id: 'edge-server-guide',
                children: 'Edge Server Guide',
              }),
            }),
            '\n',
            (0, d.jsx)(n.p, {
              children:
                'The Edge server is a high-availability client-facing API gateway that caches Gatrix backend data and serves it to game clients and servers with low latency.',
            }),
            '\n',
            (0, d.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, d.jsx)(n.pre, {
              children: (0, d.jsx)(n.code, {
                children:
                  '?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??    ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??    ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd????  Game Client   ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd\u2502   Edge Server   ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd\u2502    Backend      ???\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??    ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??    ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??                               ??                       ??                               ??                       ??                        ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??         ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??                        ??   Cache    ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??   Redis    ??                        ?? (In-Memory)?? PubSub  ??  PubSub    ??                        ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??         ?\ufffd\ufffd??\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd?\ufffd??```\n\n## Key Features\n\n- **Multi-Environment Support**: Cache data for all environments with `EDGE_ENVIRONMENTS=*`\n- **Real-time Sync**: Redis PubSub for instant cache updates (`CACHE_SYNC_METHOD=event`)\n- **Token Mirroring**: All API tokens are cached locally for fast validation\n- **Environment-specific Filtering**: Each API filters data by the requested environment\n- **Health Endpoints**: `/health` and `/health/cache` for monitoring\n\n## Configuration\n\n### Environment Variables\n\n| Variable | Default | Description |\n|----------|---------|-------------|\n| `EDGE_PORT` | `3400` | Edge server port |\n| `EDGE_METRICS_PORT` | `9400` | Prometheus metrics port (internal) |\n| `EDGE_BYPASS_TOKEN` | `gatrix-edge-internal-bypass-token` | Bypass token for internal APIs |\n| `EDGE_APPLICATION_NAME` | `edge-server` | Application name |\n| `EDGE_ENVIRONMENTS` | `*` | Target environments (`*` for all, or comma-separated IDs) |\n| `GATRIX_URL` | `http://localhost:5000` | Backend API URL |\n| `CACHE_SYNC_METHOD` | `event` | Sync method: `event`, `polling`, or `manual` |\n| `CACHE_POLLING_INTERVAL_MS` | `60000` | Polling interval (only for `polling` mode) |\n| `LOG_LEVEL` | `info` | Log level |\n\n### Redis Configuration\n\n| Variable | Default | Description |\n|----------|---------|-------------|\n| `REDIS_HOST` | `localhost` | Redis host |\n| `REDIS_PORT` | `6379` | Redis port |\n| `REDIS_PASSWORD` | (empty) | Redis password |\n| `REDIS_DB` | `0` | Redis database |\n\n## Cache Sync Methods\n\n### Event Mode (Recommended)\n\n```yaml\nCACHE_SYNC_METHOD: event\n',
              }),
            }),
            '\n',
            (0, d.jsxs)(n.ul, {
              children: [
                '\n',
                (0, d.jsx)(n.li, { children: 'Uses Redis PubSub for real-time synchronization' }),
                '\n',
                (0, d.jsx)(n.li, {
                  children: 'Cache is updated immediately when backend publishes events',
                }),
                '\n',
                (0, d.jsx)(n.li, { children: 'No periodic polling overhead' }),
                '\n',
                (0, d.jsx)(n.li, { children: 'Recommended for production' }),
                '\n',
              ],
            }),
            '\n',
            (0, d.jsx)(n.p, { children: (0, d.jsx)(n.strong, { children: 'Supported Events:' }) }),
            '\n',
            (0, d.jsxs)(n.ul, {
              children: [
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    (0, d.jsx)(n.code, { children: 'environment.created' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'environment.deleted' }),
                  ],
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    (0, d.jsx)(n.code, { children: 'game_world.created' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'game_world.updated' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'game_world.deleted' }),
                  ],
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    (0, d.jsx)(n.code, { children: 'popup_notice.created' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'popup_notice.updated' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'popup_notice.deleted' }),
                  ],
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    (0, d.jsx)(n.code, { children: 'survey.created' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'survey.updated' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'survey.deleted' }),
                  ],
                }),
                '\n',
                (0, d.jsx)(n.li, {
                  children: (0, d.jsx)(n.code, { children: 'whitelist.updated' }),
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    (0, d.jsx)(n.code, { children: 'api_token.created' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'api_token.updated' }),
                    ' / ',
                    (0, d.jsx)(n.code, { children: 'api_token.deleted' }),
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, d.jsx)(n.h3, { id: 'polling-mode', children: 'Polling Mode' }),
            '\n',
            (0, d.jsx)(n.pre, {
              children: (0, d.jsx)(n.code, {
                className: 'language-yaml',
                children: 'CACHE_SYNC_METHOD: polling\nCACHE_POLLING_INTERVAL_MS: 60000\n',
              }),
            }),
            '\n',
            (0, d.jsxs)(n.ul, {
              children: [
                '\n',
                (0, d.jsx)(n.li, { children: 'Periodically fetches data from backend' }),
                '\n',
                (0, d.jsx)(n.li, {
                  children: 'No Redis dependency for sync (still needed for token mirroring)',
                }),
                '\n',
                (0, d.jsx)(n.li, { children: 'Higher latency for updates' }),
                '\n',
              ],
            }),
            '\n',
            (0, d.jsx)(n.h2, { id: 'api-endpoints', children: 'API Endpoints' }),
            '\n',
            (0, d.jsx)(n.h3, { id: 'health-checks', children: 'Health Checks' }),
            '\n',
            (0, d.jsxs)(n.table, {
              children: [
                (0, d.jsx)(n.thead, {
                  children: (0, d.jsxs)(n.tr, {
                    children: [
                      (0, d.jsx)(n.th, { children: 'Endpoint' }),
                      (0, d.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, d.jsxs)(n.tbody, {
                  children: [
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, {
                          children: (0, d.jsx)(n.code, { children: 'GET /health' }),
                        }),
                        (0, d.jsx)(n.td, { children: 'Basic health check' }),
                      ],
                    }),
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, {
                          children: (0, d.jsx)(n.code, { children: 'GET /health/ready' }),
                        }),
                        (0, d.jsx)(n.td, { children: 'Readiness check' }),
                      ],
                    }),
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, {
                          children: (0, d.jsx)(n.code, { children: 'GET /health/live' }),
                        }),
                        (0, d.jsx)(n.td, { children: 'Liveness check' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, d.jsx)(n.h3, { id: 'client-apis', children: 'Client APIs' }),
            '\n',
            (0, d.jsx)(n.p, { children: 'All client APIs require authentication headers:' }),
            '\n',
            (0, d.jsxs)(n.ul, {
              children: [
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [(0, d.jsx)(n.code, { children: 'X-API-Token' }), ': API access token'],
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    (0, d.jsx)(n.code, { children: 'X-Application-Name' }),
                    ': Application name',
                  ],
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    (0, d.jsx)(n.code, { children: 'X-Environment' }),
                    ": Environment ID (optional, uses token's default)",
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, d.jsxs)(n.table, {
              children: [
                (0, d.jsx)(n.thead, {
                  children: (0, d.jsxs)(n.tr, {
                    children: [
                      (0, d.jsx)(n.th, { children: 'Endpoint' }),
                      (0, d.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, d.jsxs)(n.tbody, {
                  children: [
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, {
                          children: (0, d.jsx)(n.code, { children: 'GET /api/v1/client/versions' }),
                        }),
                        (0, d.jsx)(n.td, { children: 'Client versions' }),
                      ],
                    }),
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, {
                          children: (0, d.jsx)(n.code, { children: 'GET /api/v1/client/banners' }),
                        }),
                        (0, d.jsx)(n.td, { children: 'Banners' }),
                      ],
                    }),
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, {
                          children: (0, d.jsx)(n.code, { children: 'GET /api/v1/client/notices' }),
                        }),
                        (0, d.jsx)(n.td, { children: 'Service notices' }),
                      ],
                    }),
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, {
                          children: (0, d.jsx)(n.code, {
                            children: 'GET /api/v1/client/game-worlds',
                          }),
                        }),
                        (0, d.jsx)(n.td, { children: 'Game worlds' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, d.jsx)(n.h3, {
              id: 'internal-apis-separate-port',
              children: 'Internal APIs (Separate Port)',
            }),
            '\n',
            (0, d.jsxs)(n.p, {
              children: [
                '?\ufffd\ufe0f ',
                (0, d.jsx)(n.strong, { children: 'Security Note' }),
                ': Internal APIs run on a ',
                (0, d.jsx)(n.strong, { children: 'separate port' }),
                ' (main port + 10) for security isolation. These endpoints should NOT be exposed to the public internet.',
              ],
            }),
            '\n',
            (0, d.jsxs)(n.table, {
              children: [
                (0, d.jsx)(n.thead, {
                  children: (0, d.jsxs)(n.tr, {
                    children: [
                      (0, d.jsx)(n.th, { children: 'Port' }),
                      (0, d.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, d.jsxs)(n.tbody, {
                  children: [
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, { children: (0, d.jsx)(n.code, { children: '3400' }) }),
                        (0, d.jsx)(n.td, { children: 'Main Edge server (public-facing)' }),
                      ],
                    }),
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, { children: (0, d.jsx)(n.code, { children: '3410' }) }),
                        (0, d.jsx)(n.td, { children: 'Internal server (operations only)' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, d.jsxs)(n.table, {
              children: [
                (0, d.jsx)(n.thead, {
                  children: (0, d.jsxs)(n.tr, {
                    children: [
                      (0, d.jsx)(n.th, { children: 'Endpoint' }),
                      (0, d.jsx)(n.th, { children: 'Method' }),
                      (0, d.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, d.jsxs)(n.tbody, {
                  children: [
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, { children: (0, d.jsx)(n.code, { children: '/cache' }) }),
                        (0, d.jsx)(n.td, { children: 'GET' }),
                        (0, d.jsx)(n.td, {
                          children:
                            'Detailed cache status with per-environment counts and last refresh time',
                        }),
                      ],
                    }),
                    (0, d.jsxs)(n.tr, {
                      children: [
                        (0, d.jsx)(n.td, {
                          children: (0, d.jsx)(n.code, { children: '/cache/refresh' }),
                        }),
                        (0, d.jsx)(n.td, { children: 'POST' }),
                        (0, d.jsx)(n.td, {
                          children: 'Force refresh all caches and return updated status',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, d.jsx)(n.p, {
              children: (0, d.jsx)(n.strong, { children: 'Example: Check cache status' }),
            }),
            '\n',
            (0, d.jsx)(n.pre, {
              children: (0, d.jsx)(n.code, {
                className: 'language-bash',
                children: 'curl http://localhost:3410/cache\n',
              }),
            }),
            '\n',
            (0, d.jsx)(n.p, {
              children: (0, d.jsx)(n.strong, { children: 'Example: Force cache refresh' }),
            }),
            '\n',
            (0, d.jsx)(n.pre, {
              children: (0, d.jsx)(n.code, {
                className: 'language-bash',
                children: 'curl -X POST http://localhost:3410/cache/refresh\n',
              }),
            }),
            '\n',
            (0, d.jsx)(n.h2, {
              id: 'health-check-response-example',
              children: 'Health Check Response Example',
            }),
            '\n',
            (0, d.jsx)(n.pre, {
              children: (0, d.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "status": "ready",\n  "timestamp": "2025-12-11T15:28:49.211Z",\n  "summary": {\n    "clientVersions": {\n      "development": 5,\n      "qa": 3,\n      "production": 2\n    },\n    "gameWorlds": {\n      "development": 3,\n      "qa": 1,\n      "production": 0\n    },\n    "storeProducts": {\n      "development": 2,\n      "qa": 0,\n      "production": 0\n    }\n  }\n}\n',
              }),
            }),
            '\n',
            (0, d.jsx)(n.h2, {
              id: 'internal-cache-status-response-example',
              children: 'Internal Cache Status Response Example',
            }),
            '\n',
            (0, d.jsx)(n.pre, {
              children: (0, d.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "status": "ready",\n  "timestamp": "2025-12-19T15:20:00.000Z",\n  "lastRefreshedAt": "2025-12-19T15:15:00.000Z",\n  "summary": {\n    "clientVersions": { "development": 5, "qa": 3 },\n    "gameWorlds": { "development": 3 },\n    "storeProducts": { "development": 2 }\n  },\n  "detail": { ... }\n}\n',
              }),
            }),
            '\n',
            (0, d.jsx)(n.h2, {
              id: 'docker-compose-configuration',
              children: 'Docker Compose Configuration',
            }),
            '\n',
            (0, d.jsx)(n.h3, { id: 'production', children: 'Production' }),
            '\n',
            (0, d.jsx)(n.pre, {
              children: (0, d.jsx)(n.code, {
                className: 'language-yaml',
                children:
                  'edge:\n  environment:\n    NODE_ENV: production\n    GATRIX_URL: http://backend:5000\n    EDGE_BYPASS_TOKEN: ${EDGE_BYPASS_TOKEN:-gatrix-edge-internal-bypass-token}\n    EDGE_ENVIRONMENTS: ${EDGE_ENVIRONMENTS:-*}\n    CACHE_SYNC_METHOD: ${EDGE_CACHE_SYNC_METHOD:-event}\n    REDIS_HOST: redis\n    REDIS_PORT: 6379\n',
              }),
            }),
            '\n',
            (0, d.jsx)(n.h3, { id: 'development', children: 'Development' }),
            '\n',
            (0, d.jsx)(n.pre, {
              children: (0, d.jsx)(n.code, {
                className: 'language-yaml',
                children:
                  'edge-dev:\n  environment:\n    NODE_ENV: development\n    LOG_LEVEL: debug\n    GATRIX_URL: http://backend-dev:5000\n    EDGE_BYPASS_TOKEN: ${EDGE_BYPASS_TOKEN:-gatrix-edge-internal-bypass-token}\n    EDGE_ENVIRONMENTS: ${EDGE_ENVIRONMENTS:-*}\n    CACHE_SYNC_METHOD: ${EDGE_CACHE_SYNC_METHOD:-event}\n    REDIS_HOST: redis\n    REDIS_PORT: 6379\n',
              }),
            }),
            '\n',
            (0, d.jsx)(n.h2, { id: 'troubleshooting', children: 'Troubleshooting' }),
            '\n',
            (0, d.jsx)(n.h3, { id: 'cache-not-updating', children: 'Cache Not Updating' }),
            '\n',
            (0, d.jsxs)(n.ol, {
              children: [
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    'Check Redis connection: ',
                    (0, d.jsx)(n.code, { children: 'docker logs gatrix-redis-dev' }),
                  ],
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    'Verify ',
                    (0, d.jsx)(n.code, { children: 'CACHE_SYNC_METHOD=event' }),
                    ' is set',
                  ],
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    'Check backend is publishing events to ',
                    (0, d.jsx)(n.code, { children: 'gatrix-sdk-events' }),
                    ' channel',
                  ],
                }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    'Review Edge logs: ',
                    (0, d.jsx)(n.code, { children: 'docker logs gatrix-edge-dev' }),
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, d.jsx)(n.h3, {
              id: 'environment-data-missing',
              children: 'Environment Data Missing',
            }),
            '\n',
            (0, d.jsxs)(n.ol, {
              children: [
                '\n',
                (0, d.jsx)(n.li, { children: 'Verify environment exists in backend' }),
                '\n',
                (0, d.jsxs)(n.li, {
                  children: [
                    'Check ',
                    (0, d.jsx)(n.code, { children: 'EDGE_ENVIRONMENTS' }),
                    ' setting (',
                    (0, d.jsx)(n.code, { children: '*' }),
                    ' for all)',
                  ],
                }),
                '\n',
                (0, d.jsx)(n.li, { children: 'Confirm API token has access to the environment' }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, r.R)(), ...e.components };
        return n ? (0, d.jsx)(n, { ...e, children: (0, d.jsx)(a, { ...e }) }) : a(e);
      }
    },
    8453(e, n, i) {
      i.d(n, { R: () => t, x: () => l });
      var s = i(6540);
      const d = {},
        r = s.createContext(d);
      function t(e) {
        const n = s.useContext(r);
        return s.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function l(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(d)
              : e.components || d
            : t(e.components)),
          s.createElement(r.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
