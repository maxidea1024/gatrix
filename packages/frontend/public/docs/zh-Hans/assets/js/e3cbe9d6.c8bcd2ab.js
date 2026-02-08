'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [2184],
  {
    8453(e, n, r) {
      r.d(n, { R: () => l, x: () => a });
      var i = r(6540);
      const s = {},
        t = i.createContext(s);
      function l(e) {
        const n = i.useContext(t);
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
            : l(e.components)),
          i.createElement(t.Provider, { value: n }, e.children)
        );
      }
    },
    8958(e, n, r) {
      (r.r(n),
        r.d(n, {
          assets: () => d,
          contentTitle: () => a,
          default: () => h,
          frontMatter: () => l,
          metadata: () => i,
          toc: () => o,
        }));
      const i = JSON.parse(
        '{"id":"admin/game-worlds","title":"Game Worlds","description":"Overview","source":"@site/docs/admin/game-worlds.md","sourceDirName":"admin","slug":"/admin/game-worlds","permalink":"/docs/zh-Hans/admin/game-worlds","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/admin/game-worlds.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3,"sidebar_label":"Game Worlds"},"sidebar":"tutorialSidebar","previous":{"title":"Whitelist","permalink":"/docs/zh-Hans/admin/whitelist"},"next":{"title":"Client Versions","permalink":"/docs/zh-Hans/admin/client-versions"}}'
      );
      var s = r(4848),
        t = r(8453);
      const l = { sidebar_position: 3, sidebar_label: 'Game Worlds' },
        a = 'Game Worlds',
        d = {},
        o = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'World Status', id: 'world-status', level: 2 },
          { value: 'Managing a World', id: 'managing-a-world', level: 2 },
          { value: 'API Integration', id: 'api-integration', level: 2 },
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
          ...(0, t.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.header, {
              children: (0, s.jsx)(n.h1, { id: 'game-worlds', children: 'Game Worlds' }),
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, s.jsx)(n.p, {
              children: 'Monitor and manage game server instances (worlds/channels).',
            }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                (0, s.jsx)(n.strong, { children: 'Navigation:' }),
                ' System Management \u2192 Game Worlds',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsx)(n.li, { children: 'Real-time server status' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Player count monitoring' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Maintenance mode per world' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Server capacity management' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'world-status', children: 'World Status' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Status' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.strong, { children: 'Online' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Server is running normally' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.strong, { children: 'Maintenance' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Server is under maintenance' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.strong, { children: 'Offline' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Server is not running' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: (0, s.jsx)(n.strong, { children: 'Full' }) }),
                        (0, s.jsx)(n.td, { children: 'Server is at capacity' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'managing-a-world', children: 'Managing a World' }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, s.jsx)(n.strong, { children: 'System Management' }),
                    ' > ',
                    (0, s.jsx)(n.strong, { children: 'Game Worlds' }),
                  ],
                }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Click on a world to view details' }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Available actions:',
                    '\n',
                    (0, s.jsxs)(n.ul, {
                      children: [
                        '\n',
                        (0, s.jsx)(n.li, { children: 'Toggle maintenance mode' }),
                        '\n',
                        (0, s.jsx)(n.li, { children: 'Restart server (if integrated)' }),
                        '\n',
                        (0, s.jsx)(n.li, { children: 'View connected players' }),
                        '\n',
                        (0, s.jsx)(n.li, { children: 'Adjust capacity' }),
                        '\n',
                      ],
                    }),
                    '\n',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'api-integration', children: 'API Integration' }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Register and update world status via SDK:' }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "await gatrix.gameWorlds.register({\r\n  worldId: 'world-1',\r\n  name: 'World 1',\r\n  region: 'KR',\r\n  capacity: 1000,\r\n  currentPlayers: 500,\r\n  status: 'online'\r\n});\n",
              }),
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, t.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(c, { ...e }) }) : c(e);
      }
    },
  },
]);
