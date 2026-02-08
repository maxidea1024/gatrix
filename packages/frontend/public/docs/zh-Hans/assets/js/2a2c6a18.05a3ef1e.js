'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [2057],
  {
    7376(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => c,
          contentTitle: () => a,
          default: () => h,
          frontMatter: () => r,
          metadata: () => i,
          toc: () => d,
        }));
      const i = JSON.parse(
        '{"id":"integrations/teams","title":"Microsoft Teams Integration","description":"Send Gatrix notifications to Microsoft Teams.","source":"@site/docs/integrations/teams.md","sourceDirName":"integrations","slug":"/integrations/teams","permalink":"/docs/zh-Hans/integrations/teams","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/integrations/teams.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3,"sidebar_label":"Microsoft Teams"},"sidebar":"tutorialSidebar","previous":{"title":"Slack","permalink":"/docs/zh-Hans/integrations/slack"},"next":{"title":"Webhook","permalink":"/docs/zh-Hans/integrations/webhook"}}'
      );
      var s = t(4848),
        o = t(8453);
      const r = { sidebar_position: 3, sidebar_label: 'Microsoft Teams' },
        a = 'Microsoft Teams Integration',
        c = {},
        d = [
          { value: 'Setup', id: 'setup', level: 2 },
          {
            value: '1. Create an Incoming Webhook in Teams',
            id: '1-create-an-incoming-webhook-in-teams',
            level: 3,
          },
          { value: '2. Add to Gatrix', id: '2-add-to-gatrix', level: 3 },
          { value: 'Notification Events', id: 'notification-events', level: 2 },
          { value: 'Test', id: 'test', level: 2 },
        ];
      function l(e) {
        const n = {
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
          ...(0, o.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.header, {
              children: (0, s.jsx)(n.h1, {
                id: 'microsoft-teams-integration',
                children: 'Microsoft Teams Integration',
              }),
            }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Send Gatrix notifications to Microsoft Teams.' }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'setup', children: 'Setup' }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '1-create-an-incoming-webhook-in-teams',
              children: '1. Create an Incoming Webhook in Teams',
            }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsx)(n.li, {
                  children: 'In Microsoft Teams, go to the channel where you want notifications',
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Click ',
                    (0, s.jsx)(n.strong, { children: '...' }),
                    ' > ',
                    (0, s.jsx)(n.strong, { children: 'Connectors' }),
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Find ',
                    (0, s.jsx)(n.strong, { children: 'Incoming Webhook' }),
                    ' and click ',
                    (0, s.jsx)(n.strong, { children: 'Configure' }),
                  ],
                }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Enter a name and optional icon' }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: ['Click ', (0, s.jsx)(n.strong, { children: 'Create' })],
                }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Copy the webhook URL' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: '2-add-to-gatrix', children: '2. Add to Gatrix' }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, s.jsx)(n.strong, { children: 'Settings' }),
                    ' > ',
                    (0, s.jsx)(n.strong, { children: 'Integrations' }),
                    ' > ',
                    (0, s.jsx)(n.strong, { children: 'Microsoft Teams' }),
                  ],
                }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Paste the webhook URL' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Configure which events to send' }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: ['Click ', (0, s.jsx)(n.strong, { children: 'Save' })],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'notification-events', children: 'Notification Events' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Event' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Feature flag changes' }),
                        (0, s.jsx)(n.td, {
                          children: 'Notified when flags are created/updated/deleted',
                        }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Maintenance' }),
                        (0, s.jsx)(n.td, { children: 'Notified when maintenance starts/ends' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Errors' }),
                        (0, s.jsx)(n.td, { children: 'Notified on system errors' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'test', children: 'Test' }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                'Click ',
                (0, s.jsx)(n.strong, { children: 'Send Test Message' }),
                ' to verify the integration works.',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, o.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(l, { ...e }) }) : l(e);
      }
    },
    8453(e, n, t) {
      t.d(n, { R: () => r, x: () => a });
      var i = t(6540);
      const s = {},
        o = i.createContext(s);
      function r(e) {
        const n = i.useContext(o);
        return i.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function a(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(s)
              : e.components || s
            : r(e.components)),
          i.createElement(o.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
