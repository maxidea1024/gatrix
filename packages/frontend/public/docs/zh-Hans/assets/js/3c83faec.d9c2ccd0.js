'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [3753],
  {
    6777(e, i, n) {
      (n.r(i),
        n.d(i, {
          assets: () => o,
          contentTitle: () => c,
          default: () => h,
          frontMatter: () => a,
          metadata: () => t,
          toc: () => l,
        }));
      const t = JSON.parse(
        '{"id":"optimization/caching","title":"Caching Strategy Guide","description":"This page summarizes a practical multi-tier caching approach used in Gatrix.","source":"@site/docs/optimization/caching.md","sourceDirName":"optimization","slug":"/optimization/caching","permalink":"/docs/zh-Hans/optimization/caching","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/optimization/caching.md","tags":[],"version":"current","sidebarPosition":61,"frontMatter":{"slug":"/optimization/caching","title":"Caching Strategy Guide","sidebar_position":61}}'
      );
      var r = n(4848),
        s = n(8453);
      const a = {
          slug: '/optimization/caching',
          title: 'Caching Strategy Guide',
          sidebar_position: 61,
        },
        c = 'Caching Strategy Guide',
        o = {},
        l = [
          { value: 'Architecture', id: 'architecture', level: 2 },
          { value: 'Patterns', id: 'patterns', level: 2 },
          { value: 'Keys', id: 'keys', level: 2 },
          { value: 'TTLs', id: 'ttls', level: 2 },
          { value: 'Error Handling', id: 'error-handling', level: 2 },
          { value: 'Next', id: 'next', level: 2 },
        ];
      function d(e) {
        const i = {
          a: 'a',
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          p: 'p',
          ul: 'ul',
          ...(0, s.R)(),
          ...e.components,
        };
        return (0, r.jsxs)(r.Fragment, {
          children: [
            (0, r.jsx)(i.header, {
              children: (0, r.jsx)(i.h1, {
                id: 'caching-strategy-guide',
                children: 'Caching Strategy Guide',
              }),
            }),
            '\n',
            (0, r.jsx)(i.p, {
              children:
                'This page summarizes a practical multi-tier caching approach used in Gatrix.',
            }),
            '\n',
            (0, r.jsx)(i.h2, { id: 'architecture', children: 'Architecture' }),
            '\n',
            (0, r.jsxs)(i.ul, {
              children: [
                '\n',
                (0, r.jsx)(i.li, { children: 'L1: in-memory (per-instance)' }),
                '\n',
                (0, r.jsx)(i.li, { children: 'L2: Redis cluster (shared)' }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(i.h2, { id: 'patterns', children: 'Patterns' }),
            '\n',
            (0, r.jsxs)(i.ul, {
              children: [
                '\n',
                (0, r.jsx)(i.li, { children: 'Cache-aside for read-heavy workloads' }),
                '\n',
                (0, r.jsx)(i.li, {
                  children: 'Explicit invalidation on writes (key pattern-based where needed)',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(i.h2, { id: 'keys', children: 'Keys' }),
            '\n',
            (0, r.jsxs)(i.ul, {
              children: [
                '\n',
                (0, r.jsxs)(i.li, {
                  children: [
                    'Use explicit, deterministic keys: ',
                    (0, r.jsx)(i.code, { children: 'gatrix:<type>:<identifier>:<sorted-params>' }),
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(i.h2, { id: 'ttls', children: 'TTLs' }),
            '\n',
            (0, r.jsxs)(i.ul, {
              children: [
                '\n',
                (0, r.jsx)(i.li, {
                  children: 'Choose TTLs per data type (hot paths shorter; configs longer)',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(i.h2, { id: 'error-handling', children: 'Error Handling' }),
            '\n',
            (0, r.jsxs)(i.ul, {
              children: [
                '\n',
                (0, r.jsx)(i.li, {
                  children: 'Degrade gracefully on Redis errors; never block core paths',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(i.h2, { id: 'next', children: 'Next' }),
            '\n',
            (0, r.jsxs)(i.ul, {
              children: [
                '\n',
                (0, r.jsxs)(i.li, {
                  children: [
                    'See database optimization: ',
                    (0, r.jsx)(i.a, {
                      href: '/optimization/database',
                      children: '/docs/optimization/database',
                    }),
                  ],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: i } = { ...(0, s.R)(), ...e.components };
        return i ? (0, r.jsx)(i, { ...e, children: (0, r.jsx)(d, { ...e }) }) : d(e);
      }
    },
    8453(e, i, n) {
      n.d(i, { R: () => a, x: () => c });
      var t = n(6540);
      const r = {},
        s = t.createContext(r);
      function a(e) {
        const i = t.useContext(s);
        return t.useMemo(
          function () {
            return 'function' == typeof e ? e(i) : { ...i, ...e };
          },
          [i, e]
        );
      }
      function c(e) {
        let i;
        return (
          (i = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(r)
              : e.components || r
            : a(e.components)),
          t.createElement(s.Provider, { value: i }, e.children)
        );
      }
    },
  },
]);
