'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4029],
  {
    442(e, s, t) {
      (t.r(s),
        t.d(s, {
          assets: () => a,
          contentTitle: () => l,
          default: () => h,
          frontMatter: () => d,
          metadata: () => n,
          toc: () => c,
        }));
      const n = JSON.parse(
        '{"id":"features/segments","title":"Segments","description":"Target feature flags to specific user groups.","source":"@site/docs/features/segments.md","sourceDirName":"features","slug":"/features/segments","permalink":"/docs/zh-Hans/features/segments","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/features/segments.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2,"sidebar_label":"Segments"},"sidebar":"tutorialSidebar","previous":{"title":"Feature Flags","permalink":"/docs/zh-Hans/features/feature-flags"},"next":{"title":"Environments","permalink":"/docs/zh-Hans/features/environments"}}'
      );
      var r = t(4848),
        i = t(8453);
      const d = { sidebar_position: 2, sidebar_label: 'Segments' },
        l = 'Segments',
        a = {},
        c = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Creating a Segment', id: 'creating-a-segment', level: 2 },
          { value: 'Rule Operators', id: 'rule-operators', level: 2 },
          { value: 'Example: Beta Testers', id: 'example-beta-testers', level: 2 },
          { value: 'Applying to Feature Flags', id: 'applying-to-feature-flags', level: 2 },
        ];
      function o(e) {
        const s = {
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
          ...(0, i.R)(),
          ...e.components,
        };
        return (0, r.jsxs)(r.Fragment, {
          children: [
            (0, r.jsx)(s.header, {
              children: (0, r.jsx)(s.h1, { id: 'segments', children: 'Segments' }),
            }),
            '\n',
            (0, r.jsx)(s.p, { children: 'Target feature flags to specific user groups.' }),
            '\n',
            (0, r.jsx)(s.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, r.jsx)(s.p, {
              children: 'Segments allow you to define user groups based on context properties.',
            }),
            '\n',
            (0, r.jsx)(s.h2, { id: 'creating-a-segment', children: 'Creating a Segment' }),
            '\n',
            (0, r.jsxs)(s.ol, {
              children: [
                '\n',
                (0, r.jsxs)(s.li, {
                  children: [
                    'Navigate to ',
                    (0, r.jsx)(s.strong, { children: 'Feature Flags' }),
                    ' > ',
                    (0, r.jsx)(s.strong, { children: 'Segments' }),
                  ],
                }),
                '\n',
                (0, r.jsxs)(s.li, {
                  children: ['Click ', (0, r.jsx)(s.strong, { children: 'Create Segment' })],
                }),
                '\n',
                (0, r.jsx)(s.li, { children: 'Define rules' }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(s.h2, { id: 'rule-operators', children: 'Rule Operators' }),
            '\n',
            (0, r.jsxs)(s.table, {
              children: [
                (0, r.jsx)(s.thead, {
                  children: (0, r.jsxs)(s.tr, {
                    children: [
                      (0, r.jsx)(s.th, { children: 'Operator' }),
                      (0, r.jsx)(s.th, { children: 'Description' }),
                      (0, r.jsx)(s.th, { children: 'Example' }),
                    ],
                  }),
                }),
                (0, r.jsxs)(s.tbody, {
                  children: [
                    (0, r.jsxs)(s.tr, {
                      children: [
                        (0, r.jsx)(s.td, { children: (0, r.jsx)(s.code, { children: 'equals' }) }),
                        (0, r.jsx)(s.td, { children: 'Exact match' }),
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'country equals "KR"' }),
                        }),
                      ],
                    }),
                    (0, r.jsxs)(s.tr, {
                      children: [
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'notEquals' }),
                        }),
                        (0, r.jsx)(s.td, { children: 'Does not match' }),
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'status notEquals "banned"' }),
                        }),
                      ],
                    }),
                    (0, r.jsxs)(s.tr, {
                      children: [
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'contains' }),
                        }),
                        (0, r.jsx)(s.td, { children: 'Contains substring' }),
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, {
                            children: 'email contains "@company.com"',
                          }),
                        }),
                      ],
                    }),
                    (0, r.jsxs)(s.tr, {
                      children: [
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'startsWith' }),
                        }),
                        (0, r.jsx)(s.td, { children: 'Starts with' }),
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'userId startsWith "test_"' }),
                        }),
                      ],
                    }),
                    (0, r.jsxs)(s.tr, {
                      children: [
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'endsWith' }),
                        }),
                        (0, r.jsx)(s.td, { children: 'Ends with' }),
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'email endsWith ".kr"' }),
                        }),
                      ],
                    }),
                    (0, r.jsxs)(s.tr, {
                      children: [
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'greaterThan' }),
                        }),
                        (0, r.jsx)(s.td, { children: 'Greater than' }),
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'level greaterThan 10' }),
                        }),
                      ],
                    }),
                    (0, r.jsxs)(s.tr, {
                      children: [
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'lessThan' }),
                        }),
                        (0, r.jsx)(s.td, { children: 'Less than' }),
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'age lessThan 18' }),
                        }),
                      ],
                    }),
                    (0, r.jsxs)(s.tr, {
                      children: [
                        (0, r.jsx)(s.td, { children: (0, r.jsx)(s.code, { children: 'in' }) }),
                        (0, r.jsx)(s.td, { children: 'In list' }),
                        (0, r.jsx)(s.td, {
                          children: (0, r.jsx)(s.code, { children: 'country in ["KR", "JP"]' }),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, r.jsx)(s.h2, { id: 'example-beta-testers', children: 'Example: Beta Testers' }),
            '\n',
            (0, r.jsx)(s.pre, {
              children: (0, r.jsx)(s.code, {
                className: 'language-json',
                children:
                  '{\r\n  "name": "Beta Testers",\r\n  "rules": [\r\n    { "field": "userType", "operator": "equals", "value": "beta" }\r\n  ]\r\n}\n',
              }),
            }),
            '\n',
            (0, r.jsx)(s.h2, {
              id: 'applying-to-feature-flags',
              children: 'Applying to Feature Flags',
            }),
            '\n',
            (0, r.jsxs)(s.ol, {
              children: [
                '\n',
                (0, r.jsx)(s.li, { children: 'Edit a feature flag' }),
                '\n',
                (0, r.jsx)(s.li, { children: 'Add an override rule' }),
                '\n',
                (0, r.jsx)(s.li, { children: 'Select a segment' }),
                '\n',
                (0, r.jsx)(s.li, { children: 'Set the value for that segment' }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(s.p, { children: 'Segments are evaluated in priority order.' }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: s } = { ...(0, i.R)(), ...e.components };
        return s ? (0, r.jsx)(s, { ...e, children: (0, r.jsx)(o, { ...e }) }) : o(e);
      }
    },
    8453(e, s, t) {
      t.d(s, { R: () => d, x: () => l });
      var n = t(6540);
      const r = {},
        i = n.createContext(r);
      function d(e) {
        const s = n.useContext(i);
        return n.useMemo(
          function () {
            return 'function' == typeof e ? e(s) : { ...s, ...e };
          },
          [s, e]
        );
      }
      function l(e) {
        let s;
        return (
          (s = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(r)
              : e.components || r
            : d(e.components)),
          n.createElement(i.Provider, { value: s }, e.children)
        );
      }
    },
  },
]);
