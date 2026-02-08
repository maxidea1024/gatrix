'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [789],
  {
    4552(e, n, i) {
      (i.r(n),
        i.d(n, {
          assets: () => c,
          contentTitle: () => d,
          default: () => o,
          frontMatter: () => r,
          metadata: () => t,
          toc: () => l,
        }));
      const t = JSON.parse(
        '{"id":"admin/maintenance","title":"Maintenance Management","description":"Overview","source":"@site/docs/admin/maintenance.md","sourceDirName":"admin","slug":"/admin/maintenance","permalink":"/docs/ko/admin/maintenance","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/admin/maintenance.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1,"sidebar_label":"Maintenance"},"sidebar":"tutorialSidebar","previous":{"title":"Planning Data","permalink":"/docs/ko/guide/planning-data"},"next":{"title":"Whitelist","permalink":"/docs/ko/admin/whitelist"}}'
      );
      var s = i(4848),
        a = i(8453);
      const r = { sidebar_position: 1, sidebar_label: 'Maintenance' },
        d = 'Maintenance Management',
        c = {},
        l = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'Creating a Maintenance Window', id: 'creating-a-maintenance-window', level: 2 },
          { value: 'Emergency Maintenance', id: 'emergency-maintenance', level: 2 },
          { value: 'Whitelist Bypass', id: 'whitelist-bypass', level: 2 },
          { value: 'API Status', id: 'api-status', level: 2 },
        ];
      function h(e) {
        const n = {
          a: 'a',
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
          ...(0, a.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.header, {
              children: (0, s.jsx)(n.h1, {
                id: 'maintenance-management',
                children: 'Maintenance Management',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Schedule and manage server maintenance windows.' }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                (0, s.jsx)(n.strong, { children: 'Navigation:' }),
                ' System Management \u2192 Maintenance',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsx)(n.li, { children: 'Schedule regular maintenance' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Emergency maintenance mode' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Whitelist bypass for testers' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Customizable maintenance messages' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: 'creating-a-maintenance-window',
              children: 'Creating a Maintenance Window',
            }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, s.jsx)(n.strong, { children: 'System Management' }),
                    ' > ',
                    (0, s.jsx)(n.strong, { children: 'Maintenance' }),
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Click ',
                    (0, s.jsx)(n.strong, { children: 'Schedule Maintenance' }),
                    ' button',
                  ],
                }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Configure:' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Field' }),
                      (0, s.jsx)(n.th, { children: 'Type' }),
                      (0, s.jsx)(n.th, { children: 'Required' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Title' }),
                        (0, s.jsx)(n.td, { children: 'Text' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Maintenance title' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Description' }),
                        (0, s.jsx)(n.td, { children: 'Textarea' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Description' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Start Time' }),
                        (0, s.jsx)(n.td, { children: 'DateTime' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Maintenance start' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'End Time' }),
                        (0, s.jsx)(n.td, { children: 'DateTime' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Expected end' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Message' }),
                        (0, s.jsx)(n.td, { children: 'Rich Text' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'User-facing message' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Emergency' }),
                        (0, s.jsx)(n.td, { children: 'Switch' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Mark as emergency' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsxs)(n.ol, {
              start: '4',
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: ['Click ', (0, s.jsx)(n.strong, { children: 'Create' }), ' to save'],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'emergency-maintenance', children: 'Emergency Maintenance' }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                'For urgent issues, use ',
                (0, s.jsx)(n.strong, { children: 'Emergency Maintenance' }),
                ' to immediately block all access:',
              ],
            }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Click ',
                    (0, s.jsx)(n.strong, { children: 'Emergency Maintenance' }),
                    ' button',
                  ],
                }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Confirm the action' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'All non-whitelisted users will be blocked' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'whitelist-bypass', children: 'Whitelist Bypass' }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                'Whitelisted accounts and IPs can access the game during maintenance. See ',
                (0, s.jsx)(n.a, { href: './whitelist', children: 'Whitelist' }),
                '.',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'api-status', children: 'API Status' }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Check maintenance status:' }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'GET /api/v1/status\n',
              }),
            }),
          ],
        });
      }
      function o(e = {}) {
        const { wrapper: n } = { ...(0, a.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(h, { ...e }) }) : h(e);
      }
    },
    8453(e, n, i) {
      i.d(n, { R: () => r, x: () => d });
      var t = i(6540);
      const s = {},
        a = t.createContext(s);
      function r(e) {
        const n = t.useContext(a);
        return t.useMemo(
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
              ? e.components(s)
              : e.components || s
            : r(e.components)),
          t.createElement(a.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
