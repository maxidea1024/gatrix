'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4462],
  {
    8453(e, n, i) {
      i.d(n, { R: () => d, x: () => l });
      var s = i(6540);
      const r = {},
        t = s.createContext(r);
      function d(e) {
        const n = s.useContext(t);
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
              ? e.components(r)
              : e.components || r
            : d(e.components)),
          s.createElement(t.Provider, { value: n }, e.children)
        );
      }
    },
    8777(e, n, i) {
      (i.r(n),
        i.d(n, {
          assets: () => c,
          contentTitle: () => l,
          default: () => h,
          frontMatter: () => d,
          metadata: () => s,
          toc: () => a,
        }));
      const s = JSON.parse(
        '{"id":"guide/banners","title":"Banners","description":"Overview","source":"@site/docs/guide/banners.md","sourceDirName":"guide","slug":"/guide/banners","permalink":"/docs/zh-Hans/guide/banners","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/guide/banners.md","tags":[],"version":"current","sidebarPosition":6,"frontMatter":{"sidebar_position":6,"sidebar_label":"Banners"},"sidebar":"tutorialSidebar","previous":{"title":"Store Products","permalink":"/docs/zh-Hans/guide/store-products"},"next":{"title":"Planning Data","permalink":"/docs/zh-Hans/guide/planning-data"}}'
      );
      var r = i(4848),
        t = i(8453);
      const d = { sidebar_position: 6, sidebar_label: 'Banners' },
        l = 'Banners',
        c = {},
        a = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'Creating a Banner', id: 'creating-a-banner', level: 2 },
          { value: 'Banner Positions', id: 'banner-positions', level: 2 },
          { value: 'Action Types', id: 'action-types', level: 2 },
        ];
      function o(e) {
        const n = {
          h1: 'h1',
          h2: 'h2',
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
          ...(0, t.R)(),
          ...e.components,
        };
        return (0, r.jsxs)(r.Fragment, {
          children: [
            (0, r.jsx)(n.header, {
              children: (0, r.jsx)(n.h1, { id: 'banners', children: 'Banners' }),
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, r.jsx)(n.p, { children: 'Manage promotional banners displayed in the game.' }),
            '\n',
            (0, r.jsxs)(n.p, {
              children: [
                (0, r.jsx)(n.strong, { children: 'Navigation:' }),
                ' Game Operations \u2192 Banners',
              ],
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, r.jsxs)(n.ul, {
              children: [
                '\n',
                (0, r.jsx)(n.li, { children: 'Create image banners' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Set display positions' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Schedule display periods' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Configure click actions' }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Track impressions and clicks' }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: 'creating-a-banner', children: 'Creating a Banner' }),
            '\n',
            (0, r.jsxs)(n.ol, {
              children: [
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, r.jsx)(n.strong, { children: 'Game Operations' }),
                    ' > ',
                    (0, r.jsx)(n.strong, { children: 'Banners' }),
                  ],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: ['Click ', (0, r.jsx)(n.strong, { children: 'Add Banner' }), ' button'],
                }),
                '\n',
                (0, r.jsx)(n.li, { children: 'Configure the banner:' }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsxs)(n.table, {
              children: [
                (0, r.jsx)(n.thead, {
                  children: (0, r.jsxs)(n.tr, {
                    children: [
                      (0, r.jsx)(n.th, { children: 'Field' }),
                      (0, r.jsx)(n.th, { children: 'Type' }),
                      (0, r.jsx)(n.th, { children: 'Required' }),
                      (0, r.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, r.jsxs)(n.tbody, {
                  children: [
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, { children: 'Name' }),
                        (0, r.jsx)(n.td, { children: 'Text' }),
                        (0, r.jsx)(n.td, { children: 'Required' }),
                        (0, r.jsx)(n.td, { children: 'Banner name' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, { children: 'Image' }),
                        (0, r.jsx)(n.td, { children: 'Image Upload' }),
                        (0, r.jsx)(n.td, { children: 'Required' }),
                        (0, r.jsx)(n.td, { children: 'Banner image' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, { children: 'Position' }),
                        (0, r.jsx)(n.td, { children: 'Select' }),
                        (0, r.jsx)(n.td, { children: 'Required' }),
                        (0, r.jsx)(n.td, { children: 'Display position' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, { children: 'Action Type' }),
                        (0, r.jsx)(n.td, { children: 'Select' }),
                        (0, r.jsx)(n.td, { children: '-' }),
                        (0, r.jsx)(n.td, { children: 'What happens on click' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, { children: 'Action URL' }),
                        (0, r.jsx)(n.td, { children: 'Text' }),
                        (0, r.jsx)(n.td, { children: '-' }),
                        (0, r.jsx)(n.td, { children: 'URL or deep link' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, { children: 'Start Date' }),
                        (0, r.jsx)(n.td, { children: 'DateTime' }),
                        (0, r.jsx)(n.td, { children: '-' }),
                        (0, r.jsx)(n.td, { children: 'Start showing' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, { children: 'End Date' }),
                        (0, r.jsx)(n.td, { children: 'DateTime' }),
                        (0, r.jsx)(n.td, { children: '-' }),
                        (0, r.jsx)(n.td, { children: 'Stop showing' }),
                      ],
                    }),
                    (0, r.jsxs)(n.tr, {
                      children: [
                        (0, r.jsx)(n.td, { children: 'Priority' }),
                        (0, r.jsx)(n.td, { children: 'Number' }),
                        (0, r.jsx)(n.td, { children: '-' }),
                        (0, r.jsx)(n.td, { children: 'Display order' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, r.jsxs)(n.ol, {
              start: '4',
              children: [
                '\n',
                (0, r.jsxs)(n.li, {
                  children: ['Click ', (0, r.jsx)(n.strong, { children: 'Create' }), ' to save'],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: 'banner-positions', children: 'Banner Positions' }),
            '\n',
            (0, r.jsxs)(n.ul, {
              children: [
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [(0, r.jsx)(n.strong, { children: 'Main' }), ' - Main screen banner'],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [(0, r.jsx)(n.strong, { children: 'Event' }), ' - Event page banner'],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [(0, r.jsx)(n.strong, { children: 'Store' }), ' - Store page banner'],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [(0, r.jsx)(n.strong, { children: 'Login' }), ' - Login screen banner'],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: 'action-types', children: 'Action Types' }),
            '\n',
            (0, r.jsxs)(n.ul, {
              children: [
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [(0, r.jsx)(n.strong, { children: 'None' }), ' - No action'],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [(0, r.jsx)(n.strong, { children: 'URL' }), ' - Open external URL'],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    (0, r.jsx)(n.strong, { children: 'Deep Link' }),
                    ' - Navigate in-game',
                  ],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [(0, r.jsx)(n.strong, { children: 'Notice' }), ' - Show a notice'],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, t.R)(), ...e.components };
        return n ? (0, r.jsx)(n, { ...e, children: (0, r.jsx)(o, { ...e }) }) : o(e);
      }
    },
  },
]);
