'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [911],
  {
    8453(e, n, t) {
      t.d(n, { R: () => o, x: () => c });
      var s = t(6540);
      const r = {},
        i = s.createContext(r);
      function o(e) {
        const n = s.useContext(i);
        return s.useMemo(
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
              ? e.components(r)
              : e.components || r
            : o(e.components)),
          s.createElement(i.Provider, { value: n }, e.children)
        );
      }
    },
    9062(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => l,
          contentTitle: () => c,
          default: () => u,
          frontMatter: () => o,
          metadata: () => s,
          toc: () => d,
        }));
      const s = JSON.parse(
        '{"id":"features/environments","title":"\u73af\u5883\u7ba1\u7406","description":"Gatrix \u901a\u8fc7\u73af\u5883\uff08Environments\uff09\u652f\u6301\u591a\u9636\u6bb5\u7684\u53d1\u5e03\u5de5\u4f5c\u6d41\u3002","source":"@site/i18n/zh-Hans/docusaurus-plugin-content-docs/current/features/environments.md","sourceDirName":"features","slug":"/features/environments","permalink":"/docs/zh-Hans/features/environments","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/features/environments.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"tutorialSidebar","previous":{"title":"\u53d7\u4f17\u7fa4\u7ec4","permalink":"/docs/zh-Hans/features/segments"},"next":{"title":"\u670d\u52a1\u516c\u544a","permalink":"/docs/zh-Hans/guide/service-notices"}}'
      );
      var r = t(4848),
        i = t(8453);
      const o = { sidebar_position: 3 },
        c = '\u73af\u5883\u7ba1\u7406',
        l = {},
        d = [
          { value: '\u9ed8\u8ba4\u73af\u5883', id: '\u9ed8\u8ba4\u73af\u5883', level: 2 },
          { value: '\u73af\u5883\u9694\u79bb', id: '\u73af\u5883\u9694\u79bb', level: 2 },
          { value: '\u79d8\u94a5\u7ba1\u7406', id: '\u79d8\u94a5\u7ba1\u7406', level: 2 },
        ];
      function a(e) {
        const n = {
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          p: 'p',
          strong: 'strong',
          ul: 'ul',
          ...(0, i.R)(),
          ...e.components,
        };
        return (0, r.jsxs)(r.Fragment, {
          children: [
            (0, r.jsx)(n.header, {
              children: (0, r.jsx)(n.h1, {
                id: '\u73af\u5883\u7ba1\u7406',
                children: '\u73af\u5883\u7ba1\u7406',
              }),
            }),
            '\n',
            (0, r.jsx)(n.p, {
              children:
                'Gatrix \u901a\u8fc7\u73af\u5883\uff08Environments\uff09\u652f\u6301\u591a\u9636\u6bb5\u7684\u53d1\u5e03\u5de5\u4f5c\u6d41\u3002',
            }),
            '\n',
            (0, r.jsx)(n.h2, {
              id: '\u9ed8\u8ba4\u73af\u5883',
              children: '\u9ed8\u8ba4\u73af\u5883',
            }),
            '\n',
            (0, r.jsx)(n.p, {
              children: '\u7cfb\u7edf\u901a\u5e38\u9884\u8bbe\u4ee5\u4e0b\u73af\u5883\uff1a',
            }),
            '\n',
            (0, r.jsxs)(n.ul, {
              children: [
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    (0, r.jsx)(n.strong, { children: 'Development' }),
                    ': \u5f00\u53d1\u548c\u5185\u90e8\u6d4b\u8bd5',
                  ],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    (0, r.jsx)(n.strong, { children: 'Staging' }),
                    ': \u9884\u53d1\u5e03\u548c QA \u6d4b\u8bd5',
                  ],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    (0, r.jsx)(n.strong, { children: 'Production' }),
                    ': \u5bf9\u771f\u5b9e\u73a9\u5bb6\u5f00\u653e\u7684\u751f\u4ea7\u73af\u5883',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(n.h2, {
              id: '\u73af\u5883\u9694\u79bb',
              children: '\u73af\u5883\u9694\u79bb',
            }),
            '\n',
            (0, r.jsx)(n.p, {
              children:
                '\u6bcf\u4e2a\u73af\u5883\u7684\u529f\u80fd\u5f00\u5173\u503c\u662f\u5b8c\u5168\u9694\u79bb\u7684\u3002\u8fd9\u610f\u5473\u7740\u60a8\u53ef\u4ee5\u5728\u751f\u4ea7\u73af\u5883\u4e2d\u5173\u95ed\u67d0\u4e2a\u529f\u80fd\uff0c\u800c\u5728\u5f00\u53d1\u73af\u5883\u4e2d\u5f00\u542f\u5b83\u8fdb\u884c\u6d4b\u8bd5\u3002',
            }),
            '\n',
            (0, r.jsx)(n.h2, {
              id: '\u79d8\u94a5\u7ba1\u7406',
              children: '\u79d8\u94a5\u7ba1\u7406',
            }),
            '\n',
            (0, r.jsxs)(n.p, {
              children: [
                '\u6bcf\u4e2a\u73af\u5883\u90fd\u6709\u81ea\u5df1\u552f\u4e00\u7684 ',
                (0, r.jsx)(n.strong, { children: 'Server SDK API Key' }),
                ' \u548c ',
                (0, r.jsx)(n.strong, { children: 'Client API Key' }),
                '\u3002\u8bf7\u786e\u4fdd\u5728\u5bf9\u5e94\u7684\u670d\u52a1\u5668\u6216\u5ba2\u6237\u7aef\u5e94\u7528\u4e2d\u4f7f\u7528\u6b63\u786e\u7684\u79d8\u94a5\u3002',
              ],
            }),
          ],
        });
      }
      function u(e = {}) {
        const { wrapper: n } = { ...(0, i.R)(), ...e.components };
        return n ? (0, r.jsx)(n, { ...e, children: (0, r.jsx)(a, { ...e }) }) : a(e);
      }
    },
  },
]);
