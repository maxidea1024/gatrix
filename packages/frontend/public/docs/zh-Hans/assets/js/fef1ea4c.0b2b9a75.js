'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4566],
  {
    6698(e, n, s) {
      (s.r(n),
        s.d(n, {
          assets: () => o,
          contentTitle: () => c,
          default: () => h,
          frontMatter: () => l,
          metadata: () => r,
          toc: () => d,
        }));
      const r = JSON.parse(
        '{"id":"features/feature-flags","title":"\u529f\u80fd\u5f00\u5173","description":"\u529f\u80fd\u5f00\u5173\u662f\u4e00\u79cd\u65e0\u9700\u91cd\u65b0\u90e8\u7f72\u4ee3\u7801\u5373\u53ef\u5b9e\u65f6\u63a7\u5236\u529f\u80fd\u7684\u5de5\u5177\u3002","source":"@site/i18n/zh-Hans/docusaurus-plugin-content-docs/current/features/feature-flags.md","sourceDirName":"features","slug":"/features/feature-flags","permalink":"/docs/zh-Hans/features/feature-flags","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/features/feature-flags.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1},"sidebar":"tutorialSidebar","previous":{"title":"\u914d\u7f6e\u6307\u5357","permalink":"/docs/zh-Hans/getting-started/configuration"},"next":{"title":"\u53d7\u4f17\u7fa4\u7ec4","permalink":"/docs/zh-Hans/features/segments"}}'
      );
      var t = s(4848),
        i = s(8453);
      const l = { sidebar_position: 1 },
        c = '\u529f\u80fd\u5f00\u5173',
        o = {},
        d = [
          { value: '\u6982\u8ff0', id: '\u6982\u8ff0', level: 2 },
          { value: '\u4e3b\u8981\u529f\u80fd', id: '\u4e3b\u8981\u529f\u80fd', level: 2 },
          {
            value: '\u521b\u5efa\u529f\u80fd\u5f00\u5173',
            id: '\u521b\u5efa\u529f\u80fd\u5f00\u5173',
            level: 2,
          },
          { value: '\u4e0b\u4e00\u6b65', id: '\u4e0b\u4e00\u6b65', level: 2 },
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
          strong: 'strong',
          ul: 'ul',
          ...(0, i.R)(),
          ...e.components,
        };
        return (0, t.jsxs)(t.Fragment, {
          children: [
            (0, t.jsx)(n.header, {
              children: (0, t.jsx)(n.h1, {
                id: '\u529f\u80fd\u5f00\u5173',
                children: '\u529f\u80fd\u5f00\u5173',
              }),
            }),
            '\n',
            (0, t.jsx)(n.p, {
              children:
                '\u529f\u80fd\u5f00\u5173\u662f\u4e00\u79cd\u65e0\u9700\u91cd\u65b0\u90e8\u7f72\u4ee3\u7801\u5373\u53ef\u5b9e\u65f6\u63a7\u5236\u529f\u80fd\u7684\u5de5\u5177\u3002',
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: '\u6982\u8ff0', children: '\u6982\u8ff0' }),
            '\n',
            (0, t.jsx)(n.p, {
              children:
                '\u529f\u80fd\u5f00\u5173\uff08Feature Flags\uff09\u5141\u8bb8\u60a8\u5728\u4e0d\u53d1\u5e03\u4ee3\u7801\u7684\u60c5\u51b5\u4e0b\u63a7\u5236\u529f\u80fd\u7684\u542f\u7528/\u7981\u7528\uff0c\u5e76\u53ef\u4ee5\u5c06\u529f\u80fd\u4ec5\u66b4\u9732\u7ed9\u7279\u5b9a\u7684\u7528\u6237\u7fa4\u7ec4\u3002',
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '\u4e3b\u8981\u529f\u80fd',
              children: '\u4e3b\u8981\u529f\u80fd',
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: '\u5b9e\u65f6\u5207\u6362' }),
                    ' - \u65e0\u9700\u66f4\u6539\u4ee3\u7801\u5373\u53ef\u5f00\u5173\u529f\u80fd',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: '\u73af\u5883\u914d\u7f6e' }),
                    ' - \u9488\u5bf9\u5f00\u53d1/\u6d4b\u8bd5/\u751f\u4ea7\u73af\u5883\u5206\u522b\u63a7\u5236',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: '\u7fa4\u7ec4\u5b9a\u4f4d' }),
                    ' - \u4ec5\u5411\u7279\u5b9a\u7528\u6237\u7fa4\u7ec4\u5c55\u793a\u529f\u80fd',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'A/B \u6d4b\u8bd5\u652f\u6301' }),
                    ' - \u9010\u6b65\u53d1\u5e03\u548c\u6d4b\u8bd5',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: '\u7acb\u5373\u56de\u6eda' }),
                    ' - \u53d1\u751f\u95ee\u9898\u65f6\u7acb\u5373\u7981\u7528\u529f\u80fd',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '\u521b\u5efa\u529f\u80fd\u5f00\u5173',
              children: '\u521b\u5efa\u529f\u80fd\u5f00\u5173',
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    '\u5728\u4eea\u8868\u677f\u4e2d\u8fdb\u5165 ',
                    (0, t.jsx)(n.strong, { children: 'Feature Flags' }),
                    ' \u83dc\u5355\u3002',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    '\u70b9\u51fb ',
                    (0, t.jsx)(n.strong, { children: '\u65b0\u5efa\u529f\u80fd\u5f00\u5173' }),
                    ' \u6309\u94ae\u3002',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    '\u8f93\u5165\u4ee5\u4e0b\u4fe1\u606f\uff1a',
                    '\n',
                    (0, t.jsxs)(n.ul, {
                      children: [
                        '\n',
                        (0, t.jsxs)(n.li, {
                          children: [
                            (0, t.jsx)(n.strong, { children: '\u952e (Key)' }),
                            ': \u552f\u4e00\u6807\u8bc6\u7b26\uff08\u4f8b\u5982 ',
                            (0, t.jsx)(n.code, { children: 'new_payment_system' }),
                            '\uff09',
                          ],
                        }),
                        '\n',
                        (0, t.jsxs)(n.li, {
                          children: [
                            (0, t.jsx)(n.strong, { children: '\u540d\u79f0' }),
                            ': \u663e\u793a\u540d\u79f0',
                          ],
                        }),
                        '\n',
                        (0, t.jsxs)(n.li, {
                          children: [
                            (0, t.jsx)(n.strong, { children: '\u63cf\u8ff0' }),
                            ': \u529f\u80fd\u63cf\u8ff0',
                          ],
                        }),
                        '\n',
                        (0, t.jsxs)(n.li, {
                          children: [
                            (0, t.jsx)(n.strong, { children: '\u7c7b\u578b' }),
                            ': \u4ece Boolean, String, Number, JSON \u4e2d\u9009\u62e9',
                          ],
                        }),
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
            (0, t.jsx)(n.h2, { id: '\u4e0b\u4e00\u6b65', children: '\u4e0b\u4e00\u6b65' }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.a, { href: './segments', children: '\u53d7\u4f17\u7fa4\u7ec4' }),
                    ' - \u57fa\u4e8e\u7528\u6237\u7fa4\u7ec4\u7684\u5b9a\u4f4d',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.a, {
                      href: './environments',
                      children: '\u73af\u5883\u7ba1\u7406',
                    }),
                    ' - \u4e0d\u540c\u73af\u5883\u7684\u914d\u7f6e\u7ba1\u7406',
                  ],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, i.R)(), ...e.components };
        return n ? (0, t.jsx)(n, { ...e, children: (0, t.jsx)(a, { ...e }) }) : a(e);
      }
    },
    8453(e, n, s) {
      s.d(n, { R: () => l, x: () => c });
      var r = s(6540);
      const t = {},
        i = r.createContext(t);
      function l(e) {
        const n = r.useContext(i);
        return r.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function c(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(t)
              : e.components || t
            : l(e.components)),
          r.createElement(i.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
