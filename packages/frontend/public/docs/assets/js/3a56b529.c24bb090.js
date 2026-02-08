'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [7442],
  {
    4672(e, n, i) {
      (i.r(n),
        i.d(n, {
          assets: () => o,
          contentTitle: () => l,
          default: () => h,
          frontMatter: () => d,
          metadata: () => r,
          toc: () => c,
        }));
      const r = JSON.parse(
        '{"id":"admin/client-versions","title":"Client Versions","description":"Overview","source":"@site/docs/admin/client-versions.md","sourceDirName":"admin","slug":"/admin/client-versions","permalink":"/docs/admin/client-versions","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/admin/client-versions.md","tags":[],"version":"current","sidebarPosition":4,"frontMatter":{"sidebar_position":4,"sidebar_label":"Client Versions"},"sidebar":"tutorialSidebar","previous":{"title":"Game Worlds","permalink":"/docs/admin/game-worlds"},"next":{"title":"Users","permalink":"/docs/admin/users"}}'
      );
      var s = i(4848),
        t = i(8453);
      const d = { sidebar_position: 4, sidebar_label: 'Client Versions' },
        l = 'Client Versions',
        o = {},
        c = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'Version Configuration', id: 'version-configuration', level: 2 },
          { value: 'Adding a Version', id: 'adding-a-version', level: 2 },
          { value: 'API Check', id: 'api-check', level: 2 },
        ];
      function a(e) {
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
              children: (0, s.jsx)(n.h1, { id: 'client-versions', children: 'Client Versions' }),
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Manage game client versions and update requirements.' }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                (0, s.jsx)(n.strong, { children: 'Navigation:' }),
                ' System Management \u2192 Client Versions',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsx)(n.li, { children: 'Define minimum required version' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Force update prompts' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Platform-specific versions (iOS, Android, PC)' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Update URL configuration' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'version-configuration', children: 'Version Configuration' }),
            '\n',
            (0, s.jsxs)(n.table, {
              children: [
                (0, s.jsx)(n.thead, {
                  children: (0, s.jsxs)(n.tr, {
                    children: [
                      (0, s.jsx)(n.th, { children: 'Field' }),
                      (0, s.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, s.jsxs)(n.tbody, {
                  children: [
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.strong, { children: 'Platform' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'iOS, Android, Windows, Mac' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.strong, { children: 'Minimum Version' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Oldest allowed version' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.strong, { children: 'Latest Version' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Current version' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.strong, { children: 'Force Update' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Require update if below minimum' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, {
                          children: (0, s.jsx)(n.strong, { children: 'Update URL' }),
                        }),
                        (0, s.jsx)(n.td, { children: 'Store or download link' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'adding-a-version', children: 'Adding a Version' }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, s.jsx)(n.strong, { children: 'System Management' }),
                    ' > ',
                    (0, s.jsx)(n.strong, { children: 'Client Versions' }),
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Click ',
                    (0, s.jsx)(n.strong, { children: 'Add Version' }),
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
                        (0, s.jsx)(n.td, { children: 'Platform' }),
                        (0, s.jsx)(n.td, { children: 'Select' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Target platform' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Version' }),
                        (0, s.jsx)(n.td, { children: 'Text' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Version string (e.g., 1.2.3)' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Min Version' }),
                        (0, s.jsx)(n.td, { children: 'Text' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Minimum required version' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Force Update' }),
                        (0, s.jsx)(n.td, { children: 'Switch' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Force update prompt' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Update URL' }),
                        (0, s.jsx)(n.td, { children: 'Text' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Download/store link' }),
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
                  children: ['Click ', (0, s.jsx)(n.strong, { children: 'Save' })],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'api-check', children: 'API Check' }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Clients check version on startup:' }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'GET /api/v1/client-version?platform=android&version=1.2.0\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Response:' }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\r\n  "needsUpdate": true,\r\n  "forceUpdate": false,\r\n  "latestVersion": "1.3.0",\r\n  "updateUrl": "https://play.google.com/store/apps/..."\r\n}\n',
              }),
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, t.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(a, { ...e }) }) : a(e);
      }
    },
    8453(e, n, i) {
      i.d(n, { R: () => d, x: () => l });
      var r = i(6540);
      const s = {},
        t = r.createContext(s);
      function d(e) {
        const n = r.useContext(t);
        return r.useMemo(
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
            : d(e.components)),
          r.createElement(t.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
