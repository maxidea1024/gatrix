'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [9409],
  {
    8453(n, e, s) {
      s.d(e, { R: () => l, x: () => t });
      var d = s(6540);
      const i = {},
        r = d.createContext(i);
      function l(n) {
        const e = d.useContext(r);
        return d.useMemo(
          function () {
            return 'function' == typeof n ? n(e) : { ...e, ...n };
          },
          [e, n]
        );
      }
      function t(n) {
        let e;
        return (
          (e = n.disableParentContext
            ? 'function' == typeof n.components
              ? n.components(i)
              : n.components || i
            : l(n.components)),
          d.createElement(r.Provider, { value: e }, n.children)
        );
      }
    },
    9252(n, e, s) {
      (s.r(e),
        s.d(e, {
          assets: () => c,
          contentTitle: () => t,
          default: () => o,
          frontMatter: () => l,
          metadata: () => d,
          toc: () => h,
        }));
      const d = JSON.parse(
        '{"id":"guide/popup-notices","title":"\u5f39\u7a97\u516c\u544a","description":"\u6982\u8ff0","source":"@site/i18n/zh-Hans/docusaurus-plugin-content-docs/current/guide/popup-notices.md","sourceDirName":"guide","slug":"/guide/popup-notices","permalink":"/docs/zh-Hans/guide/popup-notices","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/guide/popup-notices.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2,"sidebar_label":"\u5f39\u7a97\u516c\u544a"},"sidebar":"tutorialSidebar","previous":{"title":"\u670d\u52a1\u516c\u544a","permalink":"/docs/zh-Hans/guide/service-notices"},"next":{"title":"\u4f18\u60e0\u5238","permalink":"/docs/zh-Hans/guide/coupons"}}'
      );
      var i = s(4848),
        r = s(8453);
      const l = { sidebar_position: 2, sidebar_label: '\u5f39\u7a97\u516c\u544a' },
        t = '\u5f39\u7a97\u516c\u544a',
        c = {},
        h = [
          { value: '\u6982\u8ff0', id: '\u6982\u8ff0', level: 2 },
          { value: '\u529f\u80fd', id: '\u529f\u80fd', level: 2 },
          {
            value: '\u521b\u5efa\u5f39\u7a97\u516c\u544a\u7684\u65b9\u6cd5',
            id: '\u521b\u5efa\u5f39\u7a97\u516c\u544a\u7684\u65b9\u6cd5',
            level: 2,
          },
          {
            value: '\u663e\u793a\u9891\u7387\u9009\u9879',
            id: '\u663e\u793a\u9891\u7387\u9009\u9879',
            level: 2,
          },
          { value: '\u7fa4\u7ec4\u5b9a\u4f4d', id: '\u7fa4\u7ec4\u5b9a\u4f4d', level: 2 },
        ];
      function x(n) {
        const e = {
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
          ...n.components,
        };
        return (0, i.jsxs)(i.Fragment, {
          children: [
            (0, i.jsx)(e.header, {
              children: (0, i.jsx)(e.h1, {
                id: '\u5f39\u7a97\u516c\u544a',
                children: '\u5f39\u7a97\u516c\u544a',
              }),
            }),
            '\n',
            (0, i.jsx)(e.h2, { id: '\u6982\u8ff0', children: '\u6982\u8ff0' }),
            '\n',
            (0, i.jsx)(e.p, {
              children:
                '\u521b\u5efa\u5728\u73a9\u5bb6\u767b\u5f55\u65f6\u6216\u6e38\u620f\u8fc7\u7a0b\u4e2d\u663e\u793a\u7684\u5f39\u7a97\u516c\u544a\u3002',
            }),
            '\n',
            (0, i.jsxs)(e.p, {
              children: [
                (0, i.jsx)(e.strong, { children: '\u8bbf\u95ee\u8def\u5f84\uff1a' }),
                ' \u6e38\u620f\u8fd0\u8425 \u2192 \u5f39\u7a97\u516c\u544a',
              ],
            }),
            '\n',
            (0, i.jsx)(e.h2, { id: '\u529f\u80fd', children: '\u529f\u80fd' }),
            '\n',
            (0, i.jsxs)(e.ul, {
              children: [
                '\n',
                (0, i.jsx)(e.li, {
                  children: '\u6e38\u620f\u767b\u5f55\u65f6\u663e\u793a\u5f39\u7a97',
                }),
                '\n',
                (0, i.jsx)(e.li, { children: '\u9488\u5bf9\u7279\u5b9a\u7528\u6237\u7fa4\u7ec4' }),
                '\n',
                (0, i.jsx)(e.li, { children: '\u9884\u7ea6\u663e\u793a\u65f6\u95f4' }),
                '\n',
                (0, i.jsx)(e.li, {
                  children: '\u652f\u6301\u56fe\u7247\u548c\u5bcc\u6587\u672c\u5185\u5bb9',
                }),
                '\n',
                (0, i.jsx)(e.li, { children: '\u8ffd\u8e2a\u67e5\u770b\u6b21\u6570' }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(e.h2, {
              id: '\u521b\u5efa\u5f39\u7a97\u516c\u544a\u7684\u65b9\u6cd5',
              children: '\u521b\u5efa\u5f39\u7a97\u516c\u544a\u7684\u65b9\u6cd5',
            }),
            '\n',
            (0, i.jsxs)(e.ol, {
              children: [
                '\n',
                (0, i.jsxs)(e.li, {
                  children: [
                    '\u524d\u5f80 ',
                    (0, i.jsx)(e.strong, { children: '\u6e38\u620f\u8fd0\u8425' }),
                    ' > ',
                    (0, i.jsx)(e.strong, { children: '\u5f39\u7a97\u516c\u544a' }),
                    '\u3002',
                  ],
                }),
                '\n',
                (0, i.jsxs)(e.li, {
                  children: [
                    '\u70b9\u51fb ',
                    (0, i.jsx)(e.strong, { children: '\u6dfb\u52a0\u5f39\u7a97' }),
                    ' \u6309\u94ae\u3002',
                  ],
                }),
                '\n',
                (0, i.jsx)(e.li, { children: '\u914d\u7f6e\u5f39\u7a97\uff1a' }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsxs)(e.table, {
              children: [
                (0, i.jsx)(e.thead, {
                  children: (0, i.jsxs)(e.tr, {
                    children: [
                      (0, i.jsx)(e.th, { children: '\u5b57\u6bb5' }),
                      (0, i.jsx)(e.th, { children: '\u7c7b\u578b' }),
                      (0, i.jsx)(e.th, { children: '\u662f\u5426\u5fc5\u586b' }),
                      (0, i.jsx)(e.th, { children: '\u8bf4\u660e' }),
                    ],
                  }),
                }),
                (0, i.jsxs)(e.tbody, {
                  children: [
                    (0, i.jsxs)(e.tr, {
                      children: [
                        (0, i.jsx)(e.td, { children: '\u542f\u7528' }),
                        (0, i.jsx)(e.td, { children: '\u5f00\u5173' }),
                        (0, i.jsx)(e.td, { children: '-' }),
                        (0, i.jsx)(e.td, {
                          children: '\u5207\u6362\u5f39\u7a97\u663e\u793a\u72b6\u6001',
                        }),
                      ],
                    }),
                    (0, i.jsxs)(e.tr, {
                      children: [
                        (0, i.jsx)(e.td, { children: '\u6807\u9898' }),
                        (0, i.jsx)(e.td, { children: '\u6587\u672c' }),
                        (0, i.jsx)(e.td, { children: '\u5fc5\u586b' }),
                        (0, i.jsx)(e.td, { children: '\u5f39\u7a97\u6807\u9898' }),
                      ],
                    }),
                    (0, i.jsxs)(e.tr, {
                      children: [
                        (0, i.jsx)(e.td, { children: '\u5185\u5bb9' }),
                        (0, i.jsx)(e.td, { children: '\u5bcc\u6587\u672c' }),
                        (0, i.jsx)(e.td, { children: '\u5fc5\u586b' }),
                        (0, i.jsx)(e.td, { children: '\u5f39\u7a97\u6b63\u6587\u5185\u5bb9' }),
                      ],
                    }),
                    (0, i.jsxs)(e.tr, {
                      children: [
                        (0, i.jsx)(e.td, { children: '\u56fe\u7247' }),
                        (0, i.jsx)(e.td, { children: '\u56fe\u7247\u4e0a\u4f20' }),
                        (0, i.jsx)(e.td, { children: '-' }),
                        (0, i.jsx)(e.td, {
                          children: '\u53ef\u9009\u7684\u5f39\u7a97\u56fe\u7247',
                        }),
                      ],
                    }),
                    (0, i.jsxs)(e.tr, {
                      children: [
                        (0, i.jsx)(e.td, { children: '\u5f00\u59cb\u65f6\u95f4' }),
                        (0, i.jsx)(e.td, { children: '\u65e5\u671f\u65f6\u95f4\u9009\u62e9' }),
                        (0, i.jsx)(e.td, { children: '-' }),
                        (0, i.jsx)(e.td, {
                          children:
                            '\u5f39\u7a97\u5f00\u59cb\u663e\u793a\u7684\u65e5\u671f\u548c\u65f6\u95f4',
                        }),
                      ],
                    }),
                    (0, i.jsxs)(e.tr, {
                      children: [
                        (0, i.jsx)(e.td, { children: '\u7ed3\u675f\u65f6\u95f4' }),
                        (0, i.jsx)(e.td, { children: '\u65e5\u671f\u65f6\u95f4\u9009\u62e9' }),
                        (0, i.jsx)(e.td, { children: '-' }),
                        (0, i.jsx)(e.td, {
                          children:
                            '\u5f39\u7a97\u7ed3\u675f\u663e\u793a\u7684\u65e5\u671f\u548c\u65f6\u95f4',
                        }),
                      ],
                    }),
                    (0, i.jsxs)(e.tr, {
                      children: [
                        (0, i.jsx)(e.td, { children: '\u663e\u793a\u9891\u7387' }),
                        (0, i.jsx)(e.td, { children: '\u4e0b\u62c9\u9009\u62e9' }),
                        (0, i.jsx)(e.td, { children: '-' }),
                        (0, i.jsx)(e.td, {
                          children:
                            '\u4ec5\u4e00\u6b21\u3001\u6bcf\u65e5\u3001\u6bcf\u6b21\u767b\u5f55',
                        }),
                      ],
                    }),
                    (0, i.jsxs)(e.tr, {
                      children: [
                        (0, i.jsx)(e.td, { children: '\u76ee\u6807\u7fa4\u7ec4' }),
                        (0, i.jsx)(e.td, { children: '\u4e0b\u62c9\u9009\u62e9' }),
                        (0, i.jsx)(e.td, { children: '-' }),
                        (0, i.jsx)(e.td, {
                          children: '\u7279\u5b9a\u7684\u7528\u6237\u7fa4\u7ec4',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, i.jsxs)(e.ol, {
              start: '4',
              children: [
                '\n',
                (0, i.jsxs)(e.li, {
                  children: [
                    '\u70b9\u51fb ',
                    (0, i.jsx)(e.strong, { children: '\u521b\u5efa' }),
                    ' \u4fdd\u5b58\u3002',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(e.h2, {
              id: '\u663e\u793a\u9891\u7387\u9009\u9879',
              children: '\u663e\u793a\u9891\u7387\u9009\u9879',
            }),
            '\n',
            (0, i.jsxs)(e.ul, {
              children: [
                '\n',
                (0, i.jsxs)(e.li, {
                  children: [
                    (0, i.jsx)(e.strong, { children: '\u4ec5\u4e00\u6b21' }),
                    ' - \u6bcf\u4e2a\u7528\u6237\u4ec5\u663e\u793a\u4e00\u6b21',
                  ],
                }),
                '\n',
                (0, i.jsxs)(e.li, {
                  children: [
                    (0, i.jsx)(e.strong, { children: '\u6bcf\u65e5' }),
                    ' - \u6bcf\u65e5\u663e\u793a\u4e00\u6b21',
                  ],
                }),
                '\n',
                (0, i.jsxs)(e.li, {
                  children: [
                    (0, i.jsx)(e.strong, { children: '\u6bcf\u6b21\u767b\u5f55' }),
                    ' - \u6bcf\u6b21\u6e38\u620f\u767b\u5f55\u65f6\u90fd\u663e\u793a',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(e.h2, {
              id: '\u7fa4\u7ec4\u5b9a\u4f4d',
              children: '\u7fa4\u7ec4\u5b9a\u4f4d',
            }),
            '\n',
            (0, i.jsx)(e.p, {
              children:
                '\u60a8\u53ef\u4ee5\u9488\u5bf9\u7279\u5b9a\u7684\u7528\u6237\u7fa4\u7ec4\u6295\u653e\u5f39\u7a97\uff1a',
            }),
            '\n',
            (0, i.jsxs)(e.ul, {
              children: [
                '\n',
                (0, i.jsx)(e.li, { children: '\u65b0\u7528\u6237' }),
                '\n',
                (0, i.jsx)(e.li, { children: '\u56de\u6d41\u7528\u6237' }),
                '\n',
                (0, i.jsx)(e.li, { children: 'VIP \u7528\u6237' }),
                '\n',
                (0, i.jsx)(e.li, { children: '\u7279\u5b9a\u5730\u533a/\u56fd\u5bb6' }),
                '\n',
              ],
            }),
          ],
        });
      }
      function o(n = {}) {
        const { wrapper: e } = { ...(0, r.R)(), ...n.components };
        return e ? (0, i.jsx)(e, { ...n, children: (0, i.jsx)(x, { ...n }) }) : x(n);
      }
    },
  },
]);
