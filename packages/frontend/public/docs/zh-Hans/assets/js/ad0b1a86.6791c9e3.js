'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [6674],
  {
    1693(e, n, i) {
      (i.r(n),
        i.d(n, {
          assets: () => l,
          contentTitle: () => d,
          default: () => h,
          frontMatter: () => c,
          metadata: () => t,
          toc: () => o,
        }));
      const t = JSON.parse(
        '{"id":"guide/service-notices","title":"Service Notices","description":"Overview","source":"@site/docs/guide/service-notices.md","sourceDirName":"guide","slug":"/guide/service-notices","permalink":"/docs/zh-Hans/guide/service-notices","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/guide/service-notices.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1,"sidebar_label":"Service Notices"},"sidebar":"tutorialSidebar","previous":{"title":"Environments","permalink":"/docs/zh-Hans/features/environments"},"next":{"title":"Popup Notices","permalink":"/docs/zh-Hans/guide/popup-notices"}}'
      );
      var s = i(4848),
        r = i(8453);
      const c = { sidebar_position: 1, sidebar_label: 'Service Notices' },
        d = 'Service Notices',
        l = {},
        o = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'Creating a Notice', id: 'creating-a-notice', level: 2 },
          { value: 'Notice Categories', id: 'notice-categories', level: 2 },
          { value: 'API Access', id: 'api-access', level: 2 },
        ];
      function a(e) {
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
          ...(0, r.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.header, {
              children: (0, s.jsx)(n.h1, { id: 'service-notices', children: 'Service Notices' }),
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Create and manage service notices for your game.' }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                (0, s.jsx)(n.strong, { children: 'Navigation:' }),
                ' Game Operations \u2192 Service Notices',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsx)(n.li, { children: 'Create and edit service announcements' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Schedule start and end times' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Categorize notices' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Rich text editor support' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Multi-language support' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'creating-a-notice', children: 'Creating a Notice' }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, s.jsx)(n.strong, { children: 'Game Operations' }),
                    ' > ',
                    (0, s.jsx)(n.strong, { children: 'Service Notices' }),
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: ['Click ', (0, s.jsx)(n.strong, { children: 'Add Notice' }), ' button'],
                }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Fill in the form:' }),
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
                        (0, s.jsx)(n.td, { children: 'Enabled' }),
                        (0, s.jsx)(n.td, { children: 'Switch' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Toggle notice visibility' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Multi-language' }),
                        (0, s.jsx)(n.td, { children: 'Option' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Enable multi-language content' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Start Date' }),
                        (0, s.jsx)(n.td, { children: 'DateTime Picker' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'When notice becomes visible' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'End Date' }),
                        (0, s.jsx)(n.td, { children: 'DateTime Picker' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'When notice expires' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Category' }),
                        (0, s.jsx)(n.td, { children: 'Select' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, {
                          children: 'Notice type (Announcement, Maintenance, Event, etc.)',
                        }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Title' }),
                        (0, s.jsx)(n.td, { children: 'Text' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Notice title' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Sub Title' }),
                        (0, s.jsx)(n.td, { children: 'Text' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Short title for list display' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Content' }),
                        (0, s.jsx)(n.td, { children: 'Rich Text' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Notice body content' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Description' }),
                        (0, s.jsx)(n.td, { children: 'Textarea' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Internal admin notes' }),
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
            (0, s.jsx)(n.h2, { id: 'notice-categories', children: 'Notice Categories' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'Announcement' }),
                    ' - General announcements',
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'Maintenance' }),
                    ' - Server maintenance notices',
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [(0, s.jsx)(n.strong, { children: 'Event' }), ' - In-game events'],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'Update' }),
                    ' - Game updates and patches',
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    (0, s.jsx)(n.strong, { children: 'Emergency' }),
                    ' - Urgent notifications',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'api-access', children: 'API Access' }),
            '\n',
            (0, s.jsx)(n.p, { children: 'Notices can be fetched via the Edge API:' }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'GET /api/v1/notices\n',
              }),
            }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                'See ',
                (0, s.jsx)(n.a, { href: '../api/client-api', children: 'Client API' }),
                ' for details.',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, r.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(a, { ...e }) }) : a(e);
      }
    },
    8453(e, n, i) {
      i.d(n, { R: () => c, x: () => d });
      var t = i(6540);
      const s = {},
        r = t.createContext(s);
      function c(e) {
        const n = t.useContext(r);
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
            : c(e.components)),
          t.createElement(r.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
