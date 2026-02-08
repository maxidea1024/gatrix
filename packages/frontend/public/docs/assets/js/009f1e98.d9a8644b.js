'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [7715],
  {
    3511(e, n, d) {
      (d.r(n),
        d.d(n, {
          assets: () => c,
          contentTitle: () => l,
          default: () => j,
          frontMatter: () => r,
          metadata: () => i,
          toc: () => h,
        }));
      const i = JSON.parse(
        '{"id":"getting-started/configuration","title":"Configuration Guide","description":"Guide to configuring Gatrix.","source":"@site/docs/getting-started/configuration.md","sourceDirName":"getting-started","slug":"/getting-started/configuration","permalink":"/docs/getting-started/configuration","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/getting-started/configuration.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"tutorialSidebar","previous":{"title":"Installation Guide","permalink":"/docs/getting-started/installation"},"next":{"title":"?\ufffd\ucc98 ?\ufffd\ub798\ufffd?","permalink":"/docs/features/feature-flags"}}'
      );
      var s = d(4848),
        t = d(8453);
      const r = { sidebar_position: 3 },
        l = 'Configuration Guide',
        c = {},
        h = [
          { value: 'Environment Variables', id: 'environment-variables', level: 2 },
          { value: 'Database Settings', id: 'database-settings', level: 3 },
          { value: 'Redis Settings', id: 'redis-settings', level: 3 },
          { value: 'Service Ports', id: 'service-ports', level: 3 },
          { value: 'Security Settings', id: 'security-settings', level: 3 },
          { value: 'Admin Account', id: 'admin-account', level: 3 },
          { value: 'OAuth Settings (Optional)', id: 'oauth-settings-optional', level: 3 },
          { value: 'Logging Settings', id: 'logging-settings', level: 3 },
          { value: 'Environments', id: 'environments', level: 2 },
          { value: 'Default Environments', id: 'default-environments', level: 3 },
          { value: 'Adding Environments', id: 'adding-environments', level: 3 },
          { value: 'Locale Settings', id: 'locale-settings', level: 2 },
          { value: 'Service Discovery', id: 'service-discovery', level: 2 },
        ];
      function x(e) {
        const n = {
          a: 'a',
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          header: 'header',
          li: 'li',
          p: 'p',
          strong: 'strong',
          table: 'table',
          tbody: 'tbody',
          td: 'td',
          th: 'th',
          thead: 'thead',
          tr: 'tr',
          ul: 'ul',
          ...(0, t.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.header, {
              children: (0, s.jsx)(n.h1, {
                id: 'configuration-guide',
                children: 'Configuration Guide',
              }),
            }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Guide to configuring Gatrix.' }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'environment-variables', children: 'Environment Variables' }),
            '\n',
            (0, s.jsx)(n.h3, { id: 'database-settings', children: 'Database Settings' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                      (0, s.jsx)(n.th, { children: 'Default' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: (0, s.jsx)(n.code, { children: 'DB_HOST' }) }),
                        (0, s.jsx)(n.td, { children: 'MySQL host' }),
                        (0, s.jsx)(n.td, { children: 'localhost' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: (0, s.jsx)(n.code, { children: 'DB_PORT' }) }),
                        (0, s.jsx)(n.td, { children: 'MySQL port' }),
                        (0, s.jsx)(n.td, { children: '43306' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: (0, s.jsx)(n.code, { children: 'DB_NAME' }) }),
                        (0, s.jsx)(n.td, { children: 'Database name' }),
                        (0, s.jsx)(n.td, { children: 'gatrix' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: (0, s.jsx)(n.code, { children: 'DB_USER' }) }),
                        (0, s.jsx)(n.td, { children: 'MySQL user' }),
                        (0, s.jsx)(n.td, { children: 'gatrix_user' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'DB_PASSWORD' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'MySQL password' }),
                        (0, s.jsx)(n.td, { children: 'gatrix_password' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'DB_ROOT_PASSWORD' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'MySQL root password' }),
                        (0, s.jsx)(n.td, { children: 'gatrix_rootpassword' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: 'redis-settings', children: 'Redis Settings' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                      (0, s.jsx)(n.th, { children: 'Default' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'REDIS_HOST' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Redis host' }),
                        (0, s.jsx)(n.td, { children: 'localhost' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'REDIS_PORT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Redis port' }),
                        (0, s.jsx)(n.td, { children: '46379' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'REDIS_PASSWORD' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Redis password' }),
                        (0, s.jsx)(n.td, { children: '(none)' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'REDIS_DB' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Redis DB number' }),
                        (0, s.jsx)(n.td, { children: '0' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: 'service-ports', children: 'Service Ports' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                      (0, s.jsx)(n.th, { children: 'Default' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'BACKEND_PORT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Backend API port' }),
                        (0, s.jsx)(n.td, { children: '45000' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'FRONTEND_PORT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Frontend port' }),
                        (0, s.jsx)(n.td, { children: '43000' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'EDGE_PORT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Edge Server port' }),
                        (0, s.jsx)(n.td, { children: '3400' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'CHAT_PORT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Chat Server port' }),
                        (0, s.jsx)(n.td, { children: '45100' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'EVENT_LENS_PORT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Event Lens port' }),
                        (0, s.jsx)(n.td, { children: '45200' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'GRAFANA_PORT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Grafana port' }),
                        (0, s.jsx)(n.td, { children: '44000' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'PROMETHEUS_PORT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Prometheus port' }),
                        (0, s.jsx)(n.td, { children: '49090' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: 'security-settings', children: 'Security Settings' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                      (0, s.jsx)(n.th, { children: 'Default' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'JWT_SECRET' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'JWT signing key' }),
                        (0, s.jsx)(n.td, { children: 'dev-jwt-secret' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'JWT_REFRESH_SECRET' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'JWT refresh token key' }),
                        (0, s.jsx)(n.td, { children: 'dev-refresh-secret' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'SESSION_SECRET' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Session encryption key' }),
                        (0, s.jsx)(n.td, { children: 'dev-session-secret' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'API_TOKEN' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Internal API token' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-unsecured-server-api-token' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: 'admin-account', children: 'Admin Account' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                      (0, s.jsx)(n.th, { children: 'Default' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'ADMIN_EMAIL' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Admin email' }),
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.a, {
                            href: 'mailto:admin@gatrix.com',
                            children: 'admin@gatrix.com',
                          }),
                        }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'ADMIN_PASSWORD' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Admin password' }),
                        (0, s.jsx)(n.td, { children: 'admin123' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'ADMIN_NAME' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Admin name' }),
                        (0, s.jsx)(n.td, { children: 'Administrator' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: 'oauth-settings-optional',
              children: 'OAuth Settings (Optional)',
            }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'GITHUB_CLIENT_ID' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'GitHub OAuth Client ID' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'GITHUB_CLIENT_SECRET' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'GitHub OAuth Client Secret' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'GOOGLE_CLIENT_ID' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Google OAuth Client ID' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'GOOGLE_CLIENT_SECRET' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Google OAuth Client Secret' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: 'logging-settings', children: 'Logging Settings' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                      (0, s.jsx)(n.th, { children: 'Default' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'LOG_LEVEL' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Log level' }),
                        (0, s.jsx)(n.td, { children: 'debug' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'LOG_FORMAT' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Log format' }),
                        (0, s.jsx)(n.td, { children: 'json' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'GATRIX_LOKI_ENABLED' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Loki integration' }),
                        (0, s.jsx)(n.td, { children: 'true' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'GATRIX_LOKI_URL' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Loki Push URL' }),
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.a, {
                            href: 'http://loki:3100/loki/api/v1/push',
                            children: 'http://loki:3100/loki/api/v1/push',
                          }),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'environments', children: 'Environments' }),
            '\n',
            (0, s.jsx)(n.p, {
              children:
                'Gatrix supports multiple environments. Feature flags can be managed independently per environment.',
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: 'default-environments', children: 'Default Environments' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'development' }),
                    ' - Development environment',
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'staging' }),
                    ' - Staging environment',
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'production' }),
                    ' - Production environment',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: 'adding-environments', children: 'Adding Environments' }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                'Add new environments from the ',
                (0, s.jsx)(n.strong, { children: 'Settings > Environments' }),
                ' menu in the dashboard.',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'locale-settings', children: 'Locale Settings' }),
            '\n',
            (0, s.jsx)(n.p, {
              children: 'Dashboard and API responses support multiple languages:',
            }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                      (0, s.jsx)(n.th, { children: 'Default' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'DEFAULT_LANGUAGE' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Default language' }),
                        (0, s.jsx)(n.td, { children: 'ko' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'VITE_DEFAULT_LANGUAGE' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Frontend default language' }),
                        (0, s.jsx)(n.td, { children: 'ko' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Supported languages:' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [(0, s.jsx)(n.code, { children: 'ko' }), ' - Korean'],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [(0, s.jsx)(n.code, { children: 'en' }), ' - English'],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [(0, s.jsx)(n.code, { children: 'zh' }), ' - Simplified Chinese'],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'service-discovery', children: 'Service Discovery' }),
            '\n',
            (0, s.jsx)(n.p, {
              children: 'Service discovery settings for game server integration:',
            }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Variable' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                      (0, s.jsx)(n.th, { children: 'Default' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'SERVICE_DISCOVERY_MODE' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Discovery mode' }),
                        (0, s.jsx)(n.td, { children: 'etcd' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, { children: 'ETCD_HOSTS' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'etcd hosts' }),
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.a, {
                            href: 'http://etcd:2379',
                            children: 'http://etcd:2379',
                          }),
                        }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.code, {
                            children: 'SERVICE_DISCOVERY_HEARTBEAT_TTL',
                          }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Heartbeat TTL' }),
                        (0, s.jsx)(n.td, { children: '30' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      }
      function j(e = {}) {
        const { wrapper: n } = { ...(0, t.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(x, { ...e }) }) : x(e);
      }
    },
    8453(e, n, d) {
      d.d(n, { R: () => r, x: () => l });
      var i = d(6540);
      const s = {},
        t = i.createContext(s);
      function r(e) {
        const n = i.useContext(t);
        return i.useMemo(
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
              ? e.components(s)
              : e.components || s
            : r(e.components)),
          i.createElement(t.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
