'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [3252],
  {
    8453(e, n, r) {
      r.d(n, { R: () => i, x: () => a });
      var s = r(6540);
      const t = {},
        l = s.createContext(t);
      function i(e) {
        const n = s.useContext(l);
        return s.useMemo(
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
              ? e.components(t)
              : e.components || t
            : i(e.components)),
          s.createElement(l.Provider, { value: n }, e.children)
        );
      }
    },
    8563(e, n, r) {
      (r.r(n),
        r.d(n, {
          assets: () => d,
          contentTitle: () => a,
          default: () => u,
          frontMatter: () => i,
          metadata: () => s,
          toc: () => c,
        }));
      const s = JSON.parse(
        '{"id":"features/feature-flags","title":"Feature Flags","description":"Deploy features safely using feature flags.","source":"@site/docs/features/feature-flags.md","sourceDirName":"features","slug":"/features/feature-flags","permalink":"/docs/zh-Hans/features/feature-flags","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/features/feature-flags.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1,"sidebar_label":"Feature Flags"},"sidebar":"tutorialSidebar","previous":{"title":"\u914d\u7f6e\u6307\u5357","permalink":"/docs/zh-Hans/getting-started/configuration"},"next":{"title":"Segments","permalink":"/docs/zh-Hans/features/segments"}}'
      );
      var t = r(4848),
        l = r(8453);
      const i = { sidebar_position: 1, sidebar_label: 'Feature Flags' },
        a = 'Feature Flags',
        d = {},
        c = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Key Features', id: 'key-features', level: 2 },
          { value: 'Creating a Feature Flag', id: 'creating-a-feature-flag', level: 2 },
          { value: 'Flag Types', id: 'flag-types', level: 2 },
          { value: 'Boolean', id: 'boolean', level: 3 },
          { value: 'String', id: 'string', level: 3 },
          { value: 'Number', id: 'number', level: 3 },
          { value: 'JSON', id: 'json', level: 3 },
          { value: 'SDK Usage', id: 'sdk-usage', level: 2 },
        ];
      function o(e) {
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
          pre: 'pre',
          strong: 'strong',
          table: 'table',
          tbody: 'tbody',
          td: 'td',
          th: 'th',
          thead: 'thead',
          tr: 'tr',
          ul: 'ul',
          ...(0, l.R)(),
          ...e.components,
        };
        return (0, t.jsxs)(t.Fragment, {
          children: [
            (0, t.jsx)(n.header, {
              children: (0, t.jsx)(n.h1, { id: 'feature-flags', children: 'Feature Flags' }),
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Deploy features safely using feature flags.' }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, t.jsx)(n.p, {
              children: 'Feature Flags allow you to turn features on/off without code deployment.',
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'key-features', children: 'Key Features' }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Real-time toggling' }),
                    ' - Enable/disable features instantly',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Environment targeting' }),
                    ' - Different values per environment',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Segment targeting' }),
                    ' - Target specific user groups',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Gradual rollout' }),
                    ' - Roll out features progressively',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: 'creating-a-feature-flag',
              children: 'Creating a Feature Flag',
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: ['Navigate to ', (0, t.jsx)(n.strong, { children: 'Feature Flags' })],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    'Click ',
                    (0, t.jsx)(n.strong, { children: 'Create Flag' }),
                    ' button',
                  ],
                }),
                '\n',
                (0, t.jsx)(n.li, { children: 'Configure:' }),
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
                        (0, t.jsx)(n.td, { children: 'Key' }),
                        (0, t.jsx)(n.td, { children: 'Text' }),
                        (0, t.jsx)(n.td, { children: 'Required' }),
                        (0, t.jsxs)(n.td, {
                          children: [
                            'Unique identifier (e.g., ',
                            (0, t.jsx)(n.code, { children: 'new_checkout' }),
                            ')',
                          ],
                        }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Name' }),
                        (0, t.jsx)(n.td, { children: 'Text' }),
                        (0, t.jsx)(n.td, { children: 'Required' }),
                        (0, t.jsx)(n.td, { children: 'Display name' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Description' }),
                        (0, t.jsx)(n.td, { children: 'Textarea' }),
                        (0, t.jsx)(n.td, { children: '-' }),
                        (0, t.jsx)(n.td, { children: 'Purpose description' }),
                      ],
                    }),
                    (0, t.jsxs)(n.tr, {
                      children: [
                        (0, t.jsx)(n.td, { children: 'Type' }),
                        (0, t.jsx)(n.td, { children: 'Select' }),
                        (0, t.jsx)(n.td, { children: 'Required' }),
                        (0, t.jsx)(n.td, { children: 'Boolean, String, Number, or JSON' }),
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
                  children: ['Click ', (0, t.jsx)(n.strong, { children: 'Create' })],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'flag-types', children: 'Flag Types' }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'boolean', children: 'Boolean' }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Simple on/off toggle.' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children: '{ "key": "dark_mode", "value": true }\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'string', children: 'String' }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Return a string value.' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children: '{ "key": "welcome_text", "value": "Hello!" }\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'number', children: 'Number' }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Return a numeric value.' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children: '{ "key": "max_items", "value": 100 }\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'json', children: 'JSON' }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Return complex configuration.' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{ "key": "feature_config", "value": { "enabled": true, "limit": 10 } }\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'sdk-usage', children: 'SDK Usage' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "const isEnabled = await gatrix.featureFlags.getBoolValue('dark_mode');\r\nconst config = await gatrix.featureFlags.getJsonValue('feature_config');\n",
              }),
            }),
            '\n',
            (0, t.jsxs)(n.p, {
              children: [
                'See ',
                (0, t.jsx)(n.a, { href: '../api/server-sdk-api', children: 'Server SDK API' }),
                ' for more details.',
              ],
            }),
          ],
        });
      }
      function u(e = {}) {
        const { wrapper: n } = { ...(0, l.R)(), ...e.components };
        return n ? (0, t.jsx)(n, { ...e, children: (0, t.jsx)(o, { ...e }) }) : o(e);
      }
    },
  },
]);
