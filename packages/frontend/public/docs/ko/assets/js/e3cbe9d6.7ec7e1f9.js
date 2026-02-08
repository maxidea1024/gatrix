'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [2184],
  {
    8453(e, n, t) {
      t.d(n, { R: () => r, x: () => d });
      var i = t(6540);
      const s = {},
        o = i.createContext(s);
      function r(e) {
        const n = i.useContext(o);
        return i.useMemo(
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
            : r(e.components)),
          i.createElement(o.Provider, { value: n }, e.children)
        );
      }
    },
    8958(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => a,
          contentTitle: () => d,
          default: () => u,
          frontMatter: () => r,
          metadata: () => i,
          toc: () => c,
        }));
      const i = JSON.parse(
        '{"id":"admin/game-worlds","title":"\uac8c\uc784 ?\ufffd\ub4dc","description":"\uac8c\uc784 ?\ufffd\ubc84 ?\ufffd\ud0dc\ufffd?\uad00\ub9ac\ud569?\ufffd\ub2e4.","source":"@site/docs/admin/game-worlds.md","sourceDirName":"admin","slug":"/admin/game-worlds","permalink":"/docs/ko/admin/game-worlds","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/admin/game-worlds.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"tutorialSidebar","previous":{"title":"?\ufffd\uc774?\ufffd\ub9ac?\ufffd\ud2b8","permalink":"/docs/ko/admin/whitelist"},"next":{"title":"?\ufffd\ub77c?\ufffd\uc5b8??\ubc84\uc804","permalink":"/docs/ko/admin/client-versions"}}'
      );
      var s = t(4848),
        o = t(8453);
      const r = { sidebar_position: 3 },
        d = '\uac8c\uc784 ?\ufffd\ub4dc',
        a = {},
        c = [{ value: '\uae30\ub2a5', id: '\uae30\ub2a5', level: 2 }];
      function l(e) {
        const n = {
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          p: 'p',
          ul: 'ul',
          ...(0, o.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.header, {
              children: (0, s.jsx)(n.h1, {
                id: '\uac8c\uc784-\ub4dc',
                children: '\uac8c\uc784 ?\ufffd\ub4dc',
              }),
            }),
            '\n',
            (0, s.jsx)(n.p, {
              children:
                '\uac8c\uc784 ?\ufffd\ubc84 ?\ufffd\ud0dc\ufffd?\uad00\ub9ac\ud569?\ufffd\ub2e4.',
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: '\uae30\ub2a5', children: '\uae30\ub2a5' }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsx)(n.li, {
                  children: '?\ufffd\ubc84 ?\ufffd\ud0dc \ubaa8\ub2c8?\ufffd\ub9c1',
                }),
                '\n',
                (0, s.jsx)(n.li, { children: '?\ufffd\ufffd? ?\ufffd\ud0dc ?\ufffd\uc815' }),
                '\n',
                (0, s.jsx)(n.li, { children: '?\ufffd\ubc84\ufffd??\ufffd\uc815 \uad00\ufffd?' }),
                '\n',
              ],
            }),
          ],
        });
      }
      function u(e = {}) {
        const { wrapper: n } = { ...(0, o.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(l, { ...e }) }) : l(e);
      }
    },
  },
]);
