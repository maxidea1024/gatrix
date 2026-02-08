'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [2184],
  {
    8453(e, n, t) {
      t.d(n, { R: () => o, x: () => a });
      var s = t(6540);
      const i = {},
        r = s.createContext(i);
      function o(e) {
        const n = s.useContext(r);
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
              ? e.components(i)
              : e.components || i
            : o(e.components)),
          s.createElement(r.Provider, { value: n }, e.children)
        );
      }
    },
    8958(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => d,
          contentTitle: () => a,
          default: () => u,
          frontMatter: () => o,
          metadata: () => s,
          toc: () => c,
        }));
      const s = JSON.parse(
        '{"id":"admin/game-worlds","title":"\uac8c\uc784 ?\ufffd\ub4dc","description":"\uac8c\uc784 ?\ufffd\ubc84 ?\ufffd\ud0dc\ufffd?\uad00\ub9ac\ud569?\ufffd\ub2e4.","source":"@site/docs/admin/game-worlds.md","sourceDirName":"admin","slug":"/admin/game-worlds","permalink":"/docs/zh-Hans/admin/game-worlds","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/admin/game-worlds.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"tutorialSidebar","previous":{"title":"?\ufffd\uc774?\ufffd\ub9ac?\ufffd\ud2b8","permalink":"/docs/zh-Hans/admin/whitelist"},"next":{"title":"?\ufffd\ub77c?\ufffd\uc5b8??\ubc84\uc804","permalink":"/docs/zh-Hans/admin/client-versions"}}'
      );
      var i = t(4848),
        r = t(8453);
      const o = { sidebar_position: 3 },
        a = '\uac8c\uc784 ?\ufffd\ub4dc',
        d = {},
        c = [{ value: '\uae30\ub2a5', id: '\uae30\ub2a5', level: 2 }];
      function l(e) {
        const n = {
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          p: 'p',
          ul: 'ul',
          ...(0, r.R)(),
          ...e.components,
        };
        return (0, i.jsxs)(i.Fragment, {
          children: [
            (0, i.jsx)(n.header, {
              children: (0, i.jsx)(n.h1, {
                id: '\uac8c\uc784-\ub4dc',
                children: '\uac8c\uc784 ?\ufffd\ub4dc',
              }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\uac8c\uc784 ?\ufffd\ubc84 ?\ufffd\ud0dc\ufffd?\uad00\ub9ac\ud569?\ufffd\ub2e4.',
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: '\uae30\ub2a5', children: '\uae30\ub2a5' }),
            '\n',
            (0, i.jsxs)(n.ul, {
              children: [
                '\n',
                (0, i.jsx)(n.li, {
                  children: '?\ufffd\ubc84 ?\ufffd\ud0dc \ubaa8\ub2c8?\ufffd\ub9c1',
                }),
                '\n',
                (0, i.jsx)(n.li, { children: '?\ufffd\ufffd? ?\ufffd\ud0dc ?\ufffd\uc815' }),
                '\n',
                (0, i.jsx)(n.li, { children: '?\ufffd\ubc84\ufffd??\ufffd\uc815 \uad00\ufffd?' }),
                '\n',
              ],
            }),
          ],
        });
      }
      function u(e = {}) {
        const { wrapper: n } = { ...(0, r.R)(), ...e.components };
        return n ? (0, i.jsx)(n, { ...e, children: (0, i.jsx)(l, { ...e }) }) : l(e);
      }
    },
  },
]);
