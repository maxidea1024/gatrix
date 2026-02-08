'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [6918],
  {
    4731(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => a,
          contentTitle: () => c,
          default: () => u,
          frontMatter: () => o,
          metadata: () => s,
          toc: () => d,
        }));
      const s = JSON.parse(
        '{"id":"features/environments","title":"?\ufffd\uacbd","description":"?\ufffd\uacbd\ubcc4\ub85c ?\ufffd\ucc98 ?\ufffd\ub798\uadf8\ufffd? \uad00\ub9ac\ud558?\ufffd\uc694.","source":"@site/docs/features/environments.md","sourceDirName":"features","slug":"/features/environments","permalink":"/docs/zh-Hans/features/environments","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/features/environments.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"tutorialSidebar","previous":{"title":"?\ufffd\uadf8\uba3c\ud2b8","permalink":"/docs/zh-Hans/features/segments"},"next":{"title":"?\ufffd\ube44??\uacf5\ufffd?","permalink":"/docs/zh-Hans/guide/service-notices"}}'
      );
      var r = t(4848),
        i = t(8453);
      const o = { sidebar_position: 3 },
        c = '?\ufffd\uacbd',
        a = {},
        d = [{ value: '\uae30\ubcf8 ?\ufffd\uacbd', id: '\uae30\ubcf8-\uacbd', level: 2 }];
      function l(e) {
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
              children: (0, r.jsx)(n.h1, { id: '\uacbd', children: '?\ufffd\uacbd' }),
            }),
            '\n',
            (0, r.jsx)(n.p, {
              children:
                '?\ufffd\uacbd\ubcc4\ub85c ?\ufffd\ucc98 ?\ufffd\ub798\uadf8\ufffd? \uad00\ub9ac\ud558?\ufffd\uc694.',
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: '\uae30\ubcf8-\uacbd', children: '\uae30\ubcf8 ?\ufffd\uacbd' }),
            '\n',
            (0, r.jsxs)(n.ul, {
              children: [
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    (0, r.jsx)(n.strong, { children: 'Development' }),
                    ' - \uac1c\ubc1c ?\ufffd\uacbd',
                  ],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    (0, r.jsx)(n.strong, { children: 'Staging' }),
                    ' - ?\ufffd\ud14c?\ufffd\uc9d5 ?\ufffd\uacbd',
                  ],
                }),
                '\n',
                (0, r.jsxs)(n.li, {
                  children: [
                    (0, r.jsx)(n.strong, { children: 'Production' }),
                    ' - ?\ufffd\ub85c?\ufffd\uc158 ?\ufffd\uacbd',
                  ],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function u(e = {}) {
        const { wrapper: n } = { ...(0, i.R)(), ...e.components };
        return n ? (0, r.jsx)(n, { ...e, children: (0, r.jsx)(l, { ...e }) }) : l(e);
      }
    },
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
  },
]);
