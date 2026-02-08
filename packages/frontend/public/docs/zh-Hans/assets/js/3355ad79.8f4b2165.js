'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [6596],
  {
    5393(e, n, i) {
      (i.r(n),
        i.d(n, {
          assets: () => c,
          contentTitle: () => l,
          default: () => p,
          frontMatter: () => d,
          metadata: () => s,
          toc: () => o,
        }));
      const s = JSON.parse(
        '{"id":"guide/popup-notices","title":"Popup Notices","description":"Overview","source":"@site/docs/guide/popup-notices.md","sourceDirName":"guide","slug":"/guide/popup-notices","permalink":"/docs/zh-Hans/guide/popup-notices","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/guide/popup-notices.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2,"sidebar_label":"Popup Notices"},"sidebar":"tutorialSidebar","previous":{"title":"Service Notices","permalink":"/docs/zh-Hans/guide/service-notices"},"next":{"title":"Coupons","permalink":"/docs/zh-Hans/guide/coupons"}}'
      );
      var t = i(4848),
        r = i(8453);
      const d = { sidebar_position: 2, sidebar_label: 'Popup Notices' },
        l = 'Popup Notices',
        c = {},
        o = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'Creating a Popup Notice', id: 'creating-a-popup-notice', level: 2 },
          { value: 'Display Frequency Options', id: 'display-frequency-options', level: 2 },
          { value: 'Targeting', id: 'targeting', level: 2 },
        ];
      function h(e) {
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
          ...(0, r.R)(),
          ...e.components,
        };
        return (0, t.jsxs)(t.Fragment, {
          children: [
            (0, t.jsx)(n.header, {
              children: (0, t.jsx)(n.h1, { id: 'popup-notices', children: 'Popup Notices' }),
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, t.jsx)(n.p, {
              children:
                'Create in-game popup notices that appear when players log in or during gameplay.',
            }),
            '\n',
            (0, t.jsxs)(n.p, {
              children: [
                (0, t.jsx)(n.strong, { children: 'Navigation:' }),
                ' Game Operations \u2192 Popup Notices',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsx)(n.li, { children: 'Display popups on game login' }),
                '\n',
                (0, t.jsx)(n.li, { children: 'Target specific user segments' }),
                '\n',
                (0, t.jsx)(n.li, { children: 'Schedule display periods' }),
                '\n',
                (0, t.jsx)(n.li, { children: 'Support images and rich content' }),
                '\n',
                (0, t.jsx)(n.li, { children: 'Track view counts' }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: 'creating-a-popup-notice',
              children: 'Creating a Popup Notice',
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, t.jsx)(n.strong, { children: 'Game Operations' }),
                    ' > ',
                    (0, t.jsx)(n.strong, { children: 'Popup Notices' }),
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: ['Click ', (0, t.jsx)(n.strong, { children: 'Add Popup' }), ' button'],
                }),
                '\n',
                (0, t.jsx)(n.li, { children: 'Configure the popup:' }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsxs)(n.table, {
              children: [
                (0, t.jsx)(n.thead, {
                  children: (0, t.jsxs)(n.tr, {
                    children: [
                      (0, t.jsx)(n.th, { children: 'Field' }),
                      (0, t.jsx)(n.th, { children: 'Type' }),
                      (0, t.jsx)(n.th, { children: 'Required' }),
                      (0, t.jsx)(n.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, t.jsxs)(n.tbody, {
                  children: [
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Enabled' }),
                        (0, t.jsx)(n.td, { children: 'Switch' }),
                        (0, t.jsx)(n.td, { children: '-' }),
                        (0, t.jsx)(n.td, { children: 'Toggle popup visibility' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Title' }),
                        (0, t.jsx)(n.td, { children: 'Text' }),
                        (0, t.jsx)(n.td, { children: 'Required' }),
                        (0, t.jsx)(n.td, { children: 'Popup title' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Content' }),
                        (0, t.jsx)(n.td, { children: 'Rich Text' }),
                        (0, t.jsx)(n.td, { children: 'Required' }),
                        (0, t.jsx)(n.td, { children: 'Popup body content' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Image' }),
                        (0, t.jsx)(n.td, { children: 'Image Upload' }),
                        (0, t.jsx)(n.td, { children: '-' }),
                        (0, t.jsx)(n.td, { children: 'Optional popup image' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Start Date' }),
                        (0, t.jsx)(n.td, { children: 'DateTime' }),
                        (0, t.jsx)(n.td, { children: '-' }),
                        (0, t.jsx)(n.td, { children: 'When popup starts showing' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'End Date' }),
                        (0, t.jsx)(n.td, { children: 'DateTime' }),
                        (0, t.jsx)(n.td, { children: '-' }),
                        (0, t.jsx)(n.td, { children: 'When popup stops showing' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Display Frequency' }),
                        (0, t.jsx)(n.td, { children: 'Select' }),
                        (0, t.jsx)(n.td, { children: '-' }),
                        (0, t.jsx)(n.td, { children: 'Once, Daily, Every login' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Target Segment' }),
                        (0, t.jsx)(n.td, { children: 'Select' }),
                        (0, t.jsx)(n.td, { children: '-' }),
                        (0, t.jsx)(n.td, { children: 'Specific user segment' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              start: '4',
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: ['Click ', (0, t.jsx)(n.strong, { children: 'Create' }), ' to save'],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: 'display-frequency-options',
              children: 'Display Frequency Options',
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Once' }),
                    ' - Show only once per user',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [(0, t.jsx)(n.strong, { children: 'Daily' }), ' - Show once per day'],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Every Login' }),
                    ' - Show on every game login',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'targeting', children: 'Targeting' }),
            '\n',
            (0, t.jsx)(n.p, { children: 'You can target popups to specific user segments:' }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsx)(n.li, { children: 'New users' }),
                '\n',
                (0, t.jsx)(n.li, { children: 'Returning users' }),
                '\n',
                (0, t.jsx)(n.li, { children: 'VIP users' }),
                '\n',
                (0, t.jsx)(n.li, { children: 'Specific regions/countries' }),
                '\n',
              ],
            }),
          ],
        });
      }
      function p(e = {}) {
        const { wrapper: n } = { ...(0, r.R)(), ...e.components };
        return n ? (0, t.jsx)(n, { ...e, children: (0, t.jsx)(h, { ...e }) }) : h(e);
      }
    },
    8453(e, n, i) {
      i.d(n, { R: () => d, x: () => l });
      var s = i(6540);
      const t = {},
        r = s.createContext(t);
      function d(e) {
        const n = s.useContext(r);
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
              ? e.components(t)
              : e.components || t
            : d(e.components)),
          s.createElement(r.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
