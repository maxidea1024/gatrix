'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [7924],
  {
    5287(e, n, r) {
      (r.r(n),
        r.d(n, {
          assets: () => c,
          contentTitle: () => l,
          default: () => h,
          frontMatter: () => d,
          metadata: () => t,
          toc: () => a,
        }));
      const t = JSON.parse(
        '{"id":"getting-started/installation","title":"Installation Guide","description":"Detailed instructions for installing Gatrix.","source":"@site/docs/getting-started/installation.md","sourceDirName":"getting-started","slug":"/getting-started/installation","permalink":"/docs/zh-Hans/getting-started/installation","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/getting-started/installation.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2},"sidebar":"tutorialSidebar","previous":{"title":"Quick Start","permalink":"/docs/zh-Hans/getting-started/quick-start"},"next":{"title":"Configuration Guide","permalink":"/docs/zh-Hans/getting-started/configuration"}}'
      );
      var i = r(4848),
        s = r(8453);
      const d = { sidebar_position: 2 },
        l = 'Installation Guide',
        c = {},
        a = [
          { value: 'Development Environment Setup', id: 'development-environment-setup', level: 2 },
          { value: '1. Prerequisites', id: '1-prerequisites', level: 3 },
          { value: '2. Clone Repository', id: '2-clone-repository', level: 3 },
          { value: '3. Install Dependencies', id: '3-install-dependencies', level: 3 },
          {
            value: '4. Configure Environment Variables',
            id: '4-configure-environment-variables',
            level: 3,
          },
          { value: '5. Start Infrastructure', id: '5-start-infrastructure', level: 3 },
          { value: '6. Run Database Migrations', id: '6-run-database-migrations', level: 3 },
          { value: '7. Start Development Server', id: '7-start-development-server', level: 3 },
          { value: 'Full Docker Environment', id: 'full-docker-environment', level: 2 },
          { value: 'Included Services', id: 'included-services', level: 3 },
          { value: 'Production Deployment', id: 'production-deployment', level: 2 },
        ];
      function o(e) {
        const n = {
          a: 'a',
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          header: 'header',
          li: 'li',
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
          ...(0, s.R)(),
          ...e.components,
        };
        return (0, i.jsxs)(i.Fragment, {
          children: [
            (0, i.jsx)(n.header, {
              children: (0, i.jsx)(n.h1, {
                id: 'installation-guide',
                children: 'Installation Guide',
              }),
            }),
            '\n',
            (0, i.jsx)(n.p, { children: 'Detailed instructions for installing Gatrix.' }),
            '\n',
            (0, i.jsx)(n.h2, {
              id: 'development-environment-setup',
              children: 'Development Environment Setup',
            }),
            '\n',
            (0, i.jsx)(n.h3, { id: '1-prerequisites', children: '1. Prerequisites' }),
            '\n',
            (0, i.jsxs)(n.ul, {
              children: [
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.strong, { children: 'Node.js 22+' }),
                    ' - Install LTS version from ',
                    (0, i.jsx)(n.a, { href: 'https://nodejs.org/', children: 'nodejs.org' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.strong, { children: 'Yarn 1.22+' }),
                    ' - ',
                    (0, i.jsx)(n.code, { children: 'npm install -g yarn' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.strong, { children: 'Docker Desktop' }),
                    ' - Install from ',
                    (0, i.jsx)(n.a, { href: 'https://docker.com/', children: 'docker.com' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [(0, i.jsx)(n.strong, { children: 'Git' }), ' - Version control'],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(n.h3, { id: '2-clone-repository', children: '2. Clone Repository' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children: 'git clone https://github.com/your-org/gatrix.git\r\ncd gatrix\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, { id: '3-install-dependencies', children: '3. Install Dependencies' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children: 'yarn install\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '4-configure-environment-variables',
              children: '4. Configure Environment Variables',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children: '# Copy environment file\r\ncp .env.example .env.local\n',
              }),
            }),
            '\n',
            (0, i.jsxs)(n.p, {
              children: [
                'Edit ',
                (0, i.jsx)(n.code, { children: '.env.local' }),
                ' to configure settings:',
              ],
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-env',
                children:
                  '# Database (keep defaults when using Docker infrastructure)\r\nDB_HOST=localhost\r\nDB_PORT=43306\r\nDB_NAME=gatrix\r\nDB_USER=gatrix_user\r\nDB_PASSWORD=gatrix_password\r\n\r\n# Redis\r\nREDIS_HOST=localhost\r\nREDIS_PORT=46379\r\n\r\n# JWT Secrets (must change in production!)\r\nJWT_SECRET=your-jwt-secret\r\nJWT_REFRESH_SECRET=your-refresh-secret\r\n\r\n# Admin Account\r\nADMIN_EMAIL=admin@gatrix.com\r\nADMIN_PASSWORD=admin123\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, { id: '5-start-infrastructure', children: '5. Start Infrastructure' }),
            '\n',
            (0, i.jsx)(n.p, {
              children: (0, i.jsx)(n.strong, {
                children: 'Option A: Docker infrastructure only (recommended)',
              }),
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children: 'yarn infra:up\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children: (0, i.jsx)(n.strong, { children: 'Option B: Full Docker environment' }),
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children: 'docker compose -f docker-compose.dev.yml up -d\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '6-run-database-migrations',
              children: '6. Run Database Migrations',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children: 'yarn migrate\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '7-start-development-server',
              children: '7. Start Development Server',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children:
                  '# Basic services (Backend + Frontend + Edge)\r\nyarn dev\r\n\r\n# All services included\r\nyarn dev:all\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h2, {
              id: 'full-docker-environment',
              children: 'Full Docker Environment',
            }),
            '\n',
            (0, i.jsx)(n.p, { children: 'To run all services in Docker:' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children: 'docker compose -f docker-compose.dev.yml up -d\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, { id: 'included-services', children: 'Included Services' }),
            '\n',
            (0, i.jsxs)(n.table, {
              children: [
                (0, i.jsx)(n.thead, {
                  children: (0, i.jsxs)(n.tr, {
                    children: [
                      (0, i.jsx)(n.th, { children: 'Service' }),
                      (0, i.jsx)(n.th, { children: 'Container' }),
                      (0, i.jsx)(n.th, { children: 'Port' }),
                    ],
                  }),
                }),
                (0, i.jsxs)(n.tbody, {
                  children: [
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'MySQL' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-mysql-dev' }),
                        (0, i.jsx)(n.td, { children: '43306' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Redis' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-redis-dev' }),
                        (0, i.jsx)(n.td, { children: '46379' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'etcd' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-etcd-dev' }),
                        (0, i.jsx)(n.td, { children: '(internal)' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'ClickHouse' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-clickhouse-dev' }),
                        (0, i.jsx)(n.td, { children: '48123, 49000' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Backend' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-backend-dev' }),
                        (0, i.jsx)(n.td, { children: '45000' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Frontend' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-frontend-dev' }),
                        (0, i.jsx)(n.td, { children: '43000' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Edge' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-edge-dev' }),
                        (0, i.jsx)(n.td, { children: '3400' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Chat Server' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-chat-server-dev' }),
                        (0, i.jsx)(n.td, { children: '45100' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Event Lens' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-event-lens-dev' }),
                        (0, i.jsx)(n.td, { children: '45200' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Loki' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-loki-dev' }),
                        (0, i.jsx)(n.td, { children: '43100' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Prometheus' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-prometheus-dev' }),
                        (0, i.jsx)(n.td, { children: '49090' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, { children: 'Grafana' }),
                        (0, i.jsx)(n.td, { children: 'gatrix-grafana-dev' }),
                        (0, i.jsx)(n.td, { children: '44000' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: 'production-deployment', children: 'Production Deployment' }),
            '\n',
            (0, i.jsx)(n.p, { children: 'For production, build Docker images:' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-bash',
                children:
                  '# Build\r\nyarn build\r\n\r\n# Build Docker images\r\ndocker build -t gatrix-backend -f packages/backend/Dockerfile .\r\ndocker build -t gatrix-frontend -f packages/frontend/Dockerfile .\r\ndocker build -t gatrix-edge -f packages/edge/Dockerfile .\r\ndocker build -t gatrix-chat-server -f packages/chat-server/Dockerfile .\r\ndocker build -t gatrix-event-lens -f packages/event-lens/Dockerfile .\n',
              }),
            }),
            '\n',
            (0, i.jsxs)(n.p, {
              children: [
                'For detailed deployment instructions, see ',
                (0, i.jsx)(n.a, {
                  href: '../deployment/docker',
                  children: 'Docker Deployment Guide',
                }),
                '.',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, s.R)(), ...e.components };
        return n ? (0, i.jsx)(n, { ...e, children: (0, i.jsx)(o, { ...e }) }) : o(e);
      }
    },
    8453(e, n, r) {
      r.d(n, { R: () => d, x: () => l });
      var t = r(6540);
      const i = {},
        s = t.createContext(i);
      function d(e) {
        const n = t.useContext(s);
        return t.useMemo(
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
              ? e.components(i)
              : e.components || i
            : d(e.components)),
          t.createElement(s.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
