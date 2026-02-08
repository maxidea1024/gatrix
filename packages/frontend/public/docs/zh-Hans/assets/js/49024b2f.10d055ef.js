'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [6406],
  {
    4404(e, n, r) {
      (r.r(n),
        r.d(n, {
          assets: () => c,
          contentTitle: () => l,
          default: () => o,
          frontMatter: () => i,
          metadata: () => d,
          toc: () => a,
        }));
      const d = JSON.parse(
        '{"id":"getting-started/installation","title":"\u5b89\u88c5\u6307\u5357","description":"\u8be6\u7ec6\u7684 Gatrix \u5b89\u88c5\u8bf4\u660e\u3002","source":"@site/i18n/zh-Hans/docusaurus-plugin-content-docs/current/getting-started/installation.md","sourceDirName":"getting-started","slug":"/getting-started/installation","permalink":"/docs/zh-Hans/getting-started/installation","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/getting-started/installation.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2},"sidebar":"tutorialSidebar","previous":{"title":"\u5feb\u901f\u5165\u95e8","permalink":"/docs/zh-Hans/getting-started/quick-start"},"next":{"title":"\u914d\u7f6e\u6307\u5357","permalink":"/docs/zh-Hans/getting-started/configuration"}}'
      );
      var s = r(4848),
        t = r(8453);
      const i = { sidebar_position: 2 },
        l = '\u5b89\u88c5\u6307\u5357',
        c = {},
        a = [
          {
            value: '\u5f00\u53d1\u73af\u5883\u8bbe\u7f6e',
            id: '\u5f00\u53d1\u73af\u5883\u8bbe\u7f6e',
            level: 2,
          },
          { value: '1. \u5148\u51b3\u6761\u4ef6', id: '1-\u5148\u51b3\u6761\u4ef6', level: 3 },
          { value: '2. \u514b\u9686\u4ed3\u5e93', id: '2-\u514b\u9686\u4ed3\u5e93', level: 3 },
          { value: '3. \u5b89\u88c5\u4f9d\u8d56', id: '3-\u5b89\u88c5\u4f9d\u8d56', level: 3 },
          {
            value: '4. \u914d\u7f6e\u73af\u5883\u53d8\u91cf',
            id: '4-\u914d\u7f6e\u73af\u5883\u53d8\u91cf',
            level: 3,
          },
          {
            value: '5. \u542f\u52a8\u57fa\u7840\u8bbe\u65bd',
            id: '5-\u542f\u52a8\u57fa\u7840\u8bbe\u65bd',
            level: 3,
          },
          {
            value: '6. \u8fd0\u884c\u6570\u636e\u5e93\u8fc1\u79fb',
            id: '6-\u8fd0\u884c\u6570\u636e\u5e93\u8fc1\u79fb',
            level: 3,
          },
          {
            value: '7. \u542f\u52a8\u5f00\u53d1\u670d\u52a1\u5668',
            id: '7-\u542f\u52a8\u5f00\u53d1\u670d\u52a1\u5668',
            level: 3,
          },
          {
            value: '\u5b8c\u6574 Docker \u73af\u5883',
            id: '\u5b8c\u6574-docker-\u73af\u5883',
            level: 2,
          },
          {
            value: '\u5305\u542b\u7684\u670d\u52a1',
            id: '\u5305\u542b\u7684\u670d\u52a1',
            level: 3,
          },
          { value: '\u751f\u4ea7\u90e8\u7f72', id: '\u751f\u4ea7\u90e8\u7f72', level: 2 },
        ];
      function h(e) {
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
          ...(0, t.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.header, {
              children: (0, s.jsx)(n.h1, {
                id: '\u5b89\u88c5\u6307\u5357',
                children: '\u5b89\u88c5\u6307\u5357',
              }),
            }),
            '\n',
            (0, s.jsx)(n.p, {
              children: '\u8be6\u7ec6\u7684 Gatrix \u5b89\u88c5\u8bf4\u660e\u3002',
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '\u5f00\u53d1\u73af\u5883\u8bbe\u7f6e',
              children: '\u5f00\u53d1\u73af\u5883\u8bbe\u7f6e',
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '1-\u5148\u51b3\u6761\u4ef6',
              children: '1. \u5148\u51b3\u6761\u4ef6',
            }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'Node.js 22+' }),
                    ' - \u4ece ',
                    (0, s.jsx)(n.a, { href: 'https://nodejs.org/', children: 'nodejs.org' }),
                    ' \u5b89\u88c5 LTS \u7248\u672c',
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'Yarn 1.22+' }),
                    ' - ',
                    (0, s.jsx)(n.code, { children: 'npm install -g yarn' }),
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'Docker Desktop' }),
                    ' - \u4ece ',
                    (0, s.jsx)(n.a, { href: 'https://docker.com/', children: 'docker.com' }),
                    ' \u5b89\u88c5',
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'Git' }),
                    ' - \u7248\u672c\u63a7\u5236',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '2-\u514b\u9686\u4ed3\u5e93',
              children: '2. \u514b\u9686\u4ed3\u5e93',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'git clone https://github.com/your-org/gatrix.git\r\ncd gatrix\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '3-\u5b89\u88c5\u4f9d\u8d56',
              children: '3. \u5b89\u88c5\u4f9d\u8d56',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'yarn install\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '4-\u914d\u7f6e\u73af\u5883\u53d8\u91cf',
              children: '4. \u914d\u7f6e\u73af\u5883\u53d8\u91cf',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: '# \u590d\u5236\u73af\u5883\u6587\u4ef6\r\ncp .env.example .env.local\n',
              }),
            }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                '\u7f16\u8f91 ',
                (0, s.jsx)(n.code, { children: '.env.local' }),
                ' \u8fdb\u884c\u914d\u7f6e\uff1a',
              ],
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-env',
                children:
                  '# \u6570\u636e\u5e93 (\u4f7f\u7528 Docker \u57fa\u7840\u8bbe\u65bd\u65f6\u4fdd\u6301\u9ed8\u8ba4\u503c)\r\nDB_HOST=localhost\r\nDB_PORT=43306\r\nDB_NAME=gatrix\r\nDB_USER=gatrix_user\r\nDB_PASSWORD=gatrix_password\r\n\r\n# Redis\r\nREDIS_HOST=localhost\r\nREDIS_PORT=46379\r\n\r\n# JWT \u5bc6\u94a5 (\u751f\u4ea7\u73af\u5883\u5fc5\u987b\u66f4\u6539\uff01)\r\nJWT_SECRET=your-jwt-secret\r\nJWT_REFRESH_SECRET=your-refresh-secret\r\n\r\n# \u7ba1\u7406\u5458\u8d26\u6237\r\nADMIN_EMAIL=admin@gatrix.com\r\nADMIN_PASSWORD=admin123\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '5-\u542f\u52a8\u57fa\u7840\u8bbe\u65bd',
              children: '5. \u542f\u52a8\u57fa\u7840\u8bbe\u65bd',
            }),
            '\n',
            (0, s.jsx)(n.p, {
              children: (0, s.jsx)(n.strong, {
                children: '\u9009\u9879 A: \u4ec5 Docker \u57fa\u7840\u8bbe\u65bd (\u63a8\u8350)',
              }),
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'yarn infra:up\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.p, {
              children: (0, s.jsx)(n.strong, {
                children: '\u9009\u9879 B: \u5b8c\u6574 Docker \u73af\u5883',
              }),
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'docker compose -f docker-compose.dev.yml up -d\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '6-\u8fd0\u884c\u6570\u636e\u5e93\u8fc1\u79fb',
              children: '6. \u8fd0\u884c\u6570\u636e\u5e93\u8fc1\u79fb',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'yarn migrate\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '7-\u542f\u52a8\u5f00\u53d1\u670d\u52a1\u5668',
              children: '7. \u542f\u52a8\u5f00\u53d1\u670d\u52a1\u5668',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children:
                  '# \u57fa\u672c\u670d\u52a1 (Backend + Frontend + Edge)\r\nyarn dev\r\n\r\n# \u5305\u542b\u6240\u6709\u670d\u52a1\r\nyarn dev:all\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '\u5b8c\u6574-docker-\u73af\u5883',
              children: '\u5b8c\u6574 Docker \u73af\u5883',
            }),
            '\n',
            (0, s.jsx)(n.p, {
              children: '\u5728 Docker \u4e2d\u8fd0\u884c\u6240\u6709\u670d\u52a1\uff1a',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'docker compose -f docker-compose.dev.yml up -d\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '\u5305\u542b\u7684\u670d\u52a1',
              children: '\u5305\u542b\u7684\u670d\u52a1',
            }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: '\u670d\u52a1' }),
                      (0, s.jsx)(n.th, { children: '\u5bb9\u5668' }),
                      (0, s.jsx)(n.th, { children: '\u7aef\u53e3' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'MySQL' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-mysql-dev' }),
                        (0, s.jsx)(n.td, { children: '43306' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Redis' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-redis-dev' }),
                        (0, s.jsx)(n.td, { children: '46379' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'etcd' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-etcd-dev' }),
                        (0, s.jsx)(n.td, { children: '(\u5185\u90e8)' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'ClickHouse' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-clickhouse-dev' }),
                        (0, s.jsx)(n.td, { children: '48123, 49000' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Backend' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-backend-dev' }),
                        (0, s.jsx)(n.td, { children: '45000' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Frontend' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-frontend-dev' }),
                        (0, s.jsx)(n.td, { children: '43000' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Edge' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-edge-dev' }),
                        (0, s.jsx)(n.td, { children: '3400' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Chat Server' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-chat-server-dev' }),
                        (0, s.jsx)(n.td, { children: '45100' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Event Lens' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-event-lens-dev' }),
                        (0, s.jsx)(n.td, { children: '45200' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Loki' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-loki-dev' }),
                        (0, s.jsx)(n.td, { children: '43100' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Prometheus' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-prometheus-dev' }),
                        (0, s.jsx)(n.td, { children: '49090' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Grafana' }),
                        (0, s.jsx)(n.td, { children: 'gatrix-grafana-dev' }),
                        (0, s.jsx)(n.td, { children: '44000' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '\u751f\u4ea7\u90e8\u7f72',
              children: '\u751f\u4ea7\u90e8\u7f72',
            }),
            '\n',
            (0, s.jsx)(n.p, {
              children:
                '\u751f\u4ea7\u73af\u5883\u9700\u8981\u6784\u5efa Docker \u955c\u50cf\uff1a',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children:
                  '# \u6784\u5efa\r\nyarn build\r\n\r\n# \u6784\u5efa Docker \u955c\u50cf\r\ndocker build -t gatrix-backend -f packages/backend/Dockerfile .\r\ndocker build -t gatrix-frontend -f packages/frontend/Dockerfile .\r\ndocker build -t gatrix-edge -f packages/edge/Dockerfile .\r\ndocker build -t gatrix-chat-server -f packages/chat-server/Dockerfile .\r\ndocker build -t gatrix-event-lens -f packages/event-lens/Dockerfile .\n',
              }),
            }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                '\u8be6\u7ec6\u90e8\u7f72\u8bf4\u660e\u8bf7\u53c2\u9605 ',
                (0, s.jsx)(n.a, {
                  href: '../deployment/docker',
                  children: 'Docker \u90e8\u7f72\u6307\u5357',
                }),
                '\u3002',
              ],
            }),
          ],
        });
      }
      function o(e = {}) {
        const { wrapper: n } = { ...(0, t.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(h, { ...e }) }) : h(e);
      }
    },
    8453(e, n, r) {
      r.d(n, { R: () => i, x: () => l });
      var d = r(6540);
      const s = {},
        t = d.createContext(s);
      function i(e) {
        const n = d.useContext(t);
        return d.useMemo(
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
            : i(e.components)),
          d.createElement(t.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
