'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [279],
  {
    2776(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => l,
          contentTitle: () => o,
          default: () => h,
          frontMatter: () => d,
          metadata: () => i,
          toc: () => a,
        }));
      const i = JSON.parse(
        '{"id":"integrations/overview","title":"Integrations Overview","description":"Connect Gatrix with external services.","source":"@site/docs/integrations/overview.md","sourceDirName":"integrations","slug":"/integrations/overview","permalink":"/docs/integrations/overview","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/integrations/overview.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1,"sidebar_label":"Overview"},"sidebar":"tutorialSidebar","previous":{"title":"Users","permalink":"/docs/admin/users"},"next":{"title":"Slack","permalink":"/docs/integrations/slack"}}'
      );
      var r = t(4848),
        s = t(8453);
      const d = { sidebar_position: 1, sidebar_label: 'Overview' },
        o = 'Integrations Overview',
        l = {},
        a = [
          { value: 'Available Integrations', id: 'available-integrations', level: 2 },
          { value: 'Integration Types', id: 'integration-types', level: 2 },
          { value: 'Notification Integrations', id: 'notification-integrations', level: 3 },
          { value: 'Monitoring Integrations', id: 'monitoring-integrations', level: 3 },
          { value: 'Setting Up Integrations', id: 'setting-up-integrations', level: 2 },
          { value: 'Events', id: 'events', level: 2 },
        ];
      function c(e) {
        const n = {
          a: 'a',
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          header: 'header',
          li: 'li',
          ol: 'ol',
          p: 'p',
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
        return (0, r.jsxs)(r.Fragment, {
          children: [
            (0, r.jsx)(n.header, {
              children: (0, r.jsx)(n.h1, {
                id: 'integrations-overview',
                children: 'Integrations Overview',
              }),
            }),
            '\n',
            (0, r.jsx)(n.p, { children: 'Connect Gatrix with external services.' }),
            '\n',
            (0, r.jsx)(n.h2, { id: 'available-integrations', children: 'Available Integrations' }),
            '\n',
            (0, r.jsxs)(n.table, {
              children: [
                (0, r.jsx)(n.thead, {
                  children: (0, r.jsxs)(n.tr, {
                    children: [
                      (0, r.jsx)(n.th, { children: 'Integration' }),
                      (0, r.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, r.jsxs)(n.tbody, {
                  children: [
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.a, { href: './slack', children: 'Slack' }),
                        }),
                        (0, r.jsx)(n.td, { children: 'Send notifications to Slack channels' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.a, {
                            href: './teams',
                            children: 'Microsoft Teams',
                          }),
                        }),
                        (0, r.jsx)(n.td, { children: 'Send notifications to Teams channels' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.a, { href: './webhook', children: 'Webhook' }),
                        }),
                        (0, r.jsx)(n.td, { children: 'Custom HTTP webhooks' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.a, { href: './new-relic', children: 'New Relic' }),
                        }),
                        (0, r.jsx)(n.td, { children: 'APM and monitoring' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: 'integration-types', children: 'Integration Types' }),
            '\n',
            (0, r.jsx)(n.h3, {
              id: 'notification-integrations',
              children: 'Notification Integrations',
            }),
            '\n',
            (0, r.jsx)(n.p, {
              children: 'Receive alerts and notifications when events occur in Gatrix:',
            }),
            '\n',
            (0, r.jsxs)(n.ul, {
              children: [
                '\n',
                (0, r.jsx)(n.li, { children: 'Feature flag changes' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Maintenance updates' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Error alerts' }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(n.h3, {
              id: 'monitoring-integrations',
              children: 'Monitoring Integrations',
            }),
            '\n',
            (0, r.jsx)(n.p, { children: 'Export metrics and traces to monitoring platforms.' }),
            '\n',
            (0, r.jsx)(n.h2, {
              id: 'setting-up-integrations',
              children: 'Setting Up Integrations',
            }),
            '\n',
            (0, r.jsxs)(n.ol, {
              children: [
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, r.jsx)(n.strong, { children: 'Settings' }),
                    ' > ',
                    (0, r.jsx)(n.strong, { children: 'Integrations' }),
                  ],
                }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Click on the desired integration' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Follow the setup instructions' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Test the connection' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Save configuration' }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: 'events', children: 'Events' }),
            '\n',
            (0, r.jsx)(n.p, { children: 'Integrations can be triggered by:' }),
            '\n',
            (0, r.jsxs)(n.table, {
              children: [
                (0, r.jsx)(n.thead, {
                  children: (0, r.jsxs)(n.tr, {
                    children: [
                      (0, r.jsx)(n.th, { children: 'Event' }),
                      (0, r.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, r.jsxs)(n.tbody, {
                  children: [
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.code, { children: 'feature_flag.created' }),
                        }),
                        (0, r.jsx)(n.td, { children: 'New flag created' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.code, { children: 'feature_flag.updated' }),
                        }),
                        (0, r.jsx)(n.td, { children: 'Flag value changed' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.code, { children: 'feature_flag.deleted' }),
                        }),
                        (0, r.jsx)(n.td, { children: 'Flag deleted' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.code, { children: 'maintenance.started' }),
                        }),
                        (0, r.jsx)(n.td, { children: 'Maintenance began' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, {
                          children: (0, r.jsx)(n.code, { children: 'maintenance.ended' }),
                        }),
                        (0, r.jsx)(n.td, { children: 'Maintenance completed' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, s.R)(), ...e.components };
        return n ? (0, r.jsx)(n, { ...e, children: (0, r.jsx)(c, { ...e }) }) : c(e);
      }
    },
    8453(e, n, t) {
      t.d(n, { R: () => d, x: () => o });
      var i = t(6540);
      const r = {},
        s = i.createContext(r);
      function d(e) {
        const n = i.useContext(s);
        return i.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function o(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(r)
              : e.components || r
            : d(e.components)),
          i.createElement(s.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
