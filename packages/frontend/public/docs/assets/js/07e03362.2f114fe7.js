'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [8613],
  {
    6006(e, n, i) {
      (i.r(n),
        i.d(n, {
          assets: () => d,
          contentTitle: () => r,
          default: () => h,
          frontMatter: () => l,
          metadata: () => t,
          toc: () => c,
        }));
      const t = JSON.parse(
        '{"id":"guide/planning-data","title":"Planning Data","description":"Overview","source":"@site/docs/guide/planning-data.md","sourceDirName":"guide","slug":"/guide/planning-data","permalink":"/docs/guide/planning-data","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/guide/planning-data.md","tags":[],"version":"current","sidebarPosition":7,"frontMatter":{"sidebar_position":7,"sidebar_label":"Planning Data"},"sidebar":"tutorialSidebar","previous":{"title":"Banners","permalink":"/docs/guide/banners"},"next":{"title":"Maintenance","permalink":"/docs/admin/maintenance"}}'
      );
      var s = i(4848),
        a = i(8453);
      const l = { sidebar_position: 7, sidebar_label: 'Planning Data' },
        r = 'Planning Data',
        d = {},
        c = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'Use Cases', id: 'use-cases', level: 2 },
          { value: 'Creating Planning Data', id: 'creating-planning-data', level: 2 },
          { value: 'Example', id: 'example', level: 2 },
          { value: 'API Access', id: 'api-access', level: 2 },
        ];
      function o(e) {
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
          ...(0, a.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.header, {
              children: (0, s.jsx)(n.h1, { id: 'planning-data', children: 'Planning Data' }),
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, s.jsx)(n.p, {
              children: 'Manage game balance and configuration data (game planning data).',
            }),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [
                (0, s.jsx)(n.strong, { children: 'Navigation:' }),
                ' Game Operations \u2192 Planning Data',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsx)(n.li, { children: 'Store JSON configuration data' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Version control for configs' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Environment-specific values' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Instant updates without deployment' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'use-cases', children: 'Use Cases' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsx)(n.li, { children: 'Game balance parameters' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Level requirements' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Item drop rates' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Event configurations' }),
                '\n',
                (0, s.jsx)(n.li, { children: 'Seasonal settings' }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'creating-planning-data', children: 'Creating Planning Data' }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsxs)(n.li, {
                  children: [
                    'Navigate to ',
                    (0, s.jsx)(n.strong, { children: 'Game Operations' }),
                    ' > ',
                    (0, s.jsx)(n.strong, { children: 'Planning Data' }),
                  ],
                }),
                '\n',
                (0, s.jsxs)(n.li, {
                  children: ['Click ', (0, s.jsx)(n.strong, { children: 'Add Data' }), ' button'],
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
                        (0, s.jsx)(n.td, { children: 'Key' }),
                        (0, s.jsx)(n.td, { children: 'Text' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Unique data key' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Name' }),
                        (0, s.jsx)(n.td, { children: 'Text' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Display name' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Description' }),
                        (0, s.jsx)(n.td, { children: 'Textarea' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Admin notes' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Data' }),
                        (0, s.jsx)(n.td, { children: 'JSON Editor' }),
                        (0, s.jsx)(n.td, { children: 'Required' }),
                        (0, s.jsx)(n.td, { children: 'Configuration data' }),
                      ],
                    }),
                    (0, s.jsxs)(n.tr, {
                      children: [
                        (0, s.jsx)(n.td, { children: 'Environment' }),
                        (0, s.jsx)(n.td, { children: 'Select' }),
                        (0, s.jsx)(n.td, { children: '-' }),
                        (0, s.jsx)(n.td, { children: 'Target environment' }),
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
            (0, s.jsx)(n.h2, { id: 'example', children: 'Example' }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "key": "level_requirements",\n  "data": {\n    "levels": [\n      { "level": 1, "exp": 0 },\n      { "level": 2, "exp": 100 },\n      { "level": 3, "exp": 300 },\n      { "level": 4, "exp": 600 },\n      { "level": 5, "exp": 1000 }\n    ]\n  }\n}\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: 'api-access', children: 'API Access' }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children: 'GET /api/v1/planning-data/:key\n',
              }),
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, a.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(o, { ...e }) }) : o(e);
      }
    },
    8453(e, n, i) {
      i.d(n, { R: () => l, x: () => r });
      var t = i(6540);
      const s = {},
        a = t.createContext(s);
      function l(e) {
        const n = t.useContext(a);
        return t.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function r(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(s)
              : e.components || s
            : l(e.components)),
          t.createElement(a.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
