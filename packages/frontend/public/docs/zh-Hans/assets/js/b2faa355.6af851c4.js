'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [8866],
  {
    5684(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => a,
          contentTitle: () => d,
          default: () => h,
          frontMatter: () => o,
          metadata: () => r,
          toc: () => l,
        }));
      const r = JSON.parse(
        '{"id":"integrations/webhook","title":"Webhook Integration","description":"Send Gatrix events to custom HTTP endpoints.","source":"@site/docs/integrations/webhook.md","sourceDirName":"integrations","slug":"/integrations/webhook","permalink":"/docs/zh-Hans/integrations/webhook","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/integrations/webhook.md","tags":[],"version":"current","sidebarPosition":4,"frontMatter":{"sidebar_position":4,"sidebar_label":"Webhook"},"sidebar":"tutorialSidebar","previous":{"title":"Microsoft Teams","permalink":"/docs/zh-Hans/integrations/teams"},"next":{"title":"New Relic","permalink":"/docs/zh-Hans/integrations/new-relic"}}'
      );
      var i = t(4848),
        s = t(8453);
      const o = { sidebar_position: 4, sidebar_label: 'Webhook' },
        d = 'Webhook Integration',
        a = {},
        l = [
          { value: 'Setup', id: 'setup', level: 2 },
          { value: 'Authentication', id: 'authentication', level: 2 },
          { value: 'Payload Format', id: 'payload-format', level: 2 },
          { value: 'Events', id: 'events', level: 2 },
          { value: 'Retry Policy', id: 'retry-policy', level: 2 },
        ];
      function c(e) {
        const n = {
          code: 'code',
          h1: 'h1',
          h2: 'h2',
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
          ...(0, s.R)(),
          ...e.components,
        };
        return (0, i.jsxs)(i.Fragment, {
          children: [
            (0, i.jsx)(n.header, {
              children: (0, i.jsx)(n.h1, {
                id: 'webhook-integration',
                children: 'Webhook Integration',
              }),
            }),
            '\n',
            (0, i.jsx)(n.p, { children: 'Send Gatrix events to custom HTTP endpoints.' }),
            '\n',
            (0, i.jsx)(n.h2, { id: 'setup', children: 'Setup' }),
            '\n',
            (0, i.jsxs)(n.ol, {
              children: [
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, i.jsx)(n.strong, { children: 'Settings' }),
                    ' > ',
                    (0, i.jsx)(n.strong, { children: 'Integrations' }),
                    ' > ',
                    (0, i.jsx)(n.strong, { children: 'Webhook' }),
                  ],
                }),
                '\n',
                (0, i.jsx)(n.li, { children: 'Enter your webhook URL' }),
                '\n',
                (0, i.jsx)(n.li, { children: 'Select events to send' }),
                '\n',
                (0, i.jsx)(n.li, { children: 'Configure authentication (optional)' }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: ['Click ', (0, i.jsx)(n.strong, { children: 'Save' })],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: 'authentication', children: 'Authentication' }),
            '\n',
            (0, i.jsx)(n.p, { children: 'Webhooks support:' }),
            '\n',
            (0, i.jsxs)(n.ul, {
              children: [
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [(0, i.jsx)(n.strong, { children: 'None' }), ' - No authentication'],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.strong, { children: 'Basic Auth' }),
                    ' - Username and password',
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.strong, { children: 'Bearer Token' }),
                    ' - Authorization header with token',
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.strong, { children: 'Custom Header' }),
                    ' - Custom header name and value',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: 'payload-format', children: 'Payload Format' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\r\n  "event": "feature_flag.updated",\r\n  "timestamp": "2024-01-15T10:30:00Z",\r\n  "data": {\r\n    "flagKey": "new_feature",\r\n    "oldValue": false,\r\n    "newValue": true,\r\n    "environment": "production",\r\n    "changedBy": "admin@example.com"\r\n  }\r\n}\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: 'events', children: 'Events' }),
            '\n',
            (0, i.jsxs)(n.table, {
              children: [
                (0, i.jsx)(n.thead, {
                  children: (0, i.jsxs)(n.tr, {
                    children: [
                      (0, i.jsx)(n.th, { children: 'Event' }),
                      (0, i.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, i.jsxs)(n.tbody, {
                  children: [
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, {
                          children: (0, i.jsx)(n.code, { children: 'feature_flag.created' }),
                        }),
                        (0, i.jsx)(n.td, { children: 'Flag created' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, {
                          children: (0, i.jsx)(n.code, { children: 'feature_flag.updated' }),
                        }),
                        (0, i.jsx)(n.td, { children: 'Flag updated' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, {
                          children: (0, i.jsx)(n.code, { children: 'feature_flag.deleted' }),
                        }),
                        (0, i.jsx)(n.td, { children: 'Flag deleted' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, {
                          children: (0, i.jsx)(n.code, { children: 'maintenance.started' }),
                        }),
                        (0, i.jsx)(n.td, { children: 'Maintenance started' }),
                      ],
                    }),
                    (0, i.jsxs)(n.tr, {
                      children: [
                        (0, i.jsx)(n.td, {
                          children: (0, i.jsx)(n.code, { children: 'maintenance.ended' }),
                        }),
                        (0, i.jsx)(n.td, { children: 'Maintenance ended' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: 'retry-policy', children: 'Retry Policy' }),
            '\n',
            (0, i.jsx)(n.p, {
              children: 'Failed webhooks are retried up to 3 times with exponential backoff.',
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, s.R)(), ...e.components };
        return n ? (0, i.jsx)(n, { ...e, children: (0, i.jsx)(c, { ...e }) }) : c(e);
      }
    },
    8453(e, n, t) {
      t.d(n, { R: () => o, x: () => d });
      var r = t(6540);
      const i = {},
        s = r.createContext(i);
      function o(e) {
        const n = r.useContext(s);
        return r.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function d(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(i)
              : e.components || i
            : o(e.components)),
          r.createElement(s.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
