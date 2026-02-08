'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [1552],
  {
    5488(i, e, n) {
      (n.r(e),
        n.d(e, {
          assets: () => l,
          contentTitle: () => r,
          default: () => p,
          frontMatter: () => s,
          metadata: () => t,
          toc: () => c,
        }));
      const t = JSON.parse(
        '{"id":"optimization/database","title":"Database Optimization Guide","description":"This page outlines practical tips for optimizing MySQL performance in Gatrix.","source":"@site/docs/optimization/database.md","sourceDirName":"optimization","slug":"/optimization/database","permalink":"/docs/optimization/database","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/optimization/database.md","tags":[],"version":"current","sidebarPosition":60,"frontMatter":{"slug":"/optimization/database","title":"Database Optimization Guide","sidebar_position":60}}'
      );
      var a = n(4848),
        o = n(8453);
      const s = {
          slug: '/optimization/database',
          title: 'Database Optimization Guide',
          sidebar_position: 60,
        },
        r = 'Database Optimization Guide',
        l = {},
        c = [
          { value: 'Indexing', id: 'indexing', level: 2 },
          { value: 'Connection Pooling', id: 'connection-pooling', level: 2 },
          { value: 'Pagination', id: 'pagination', level: 2 },
          { value: 'Observability', id: 'observability', level: 2 },
          { value: 'Next', id: 'next', level: 2 },
        ];
      function d(i) {
        const e = {
          a: 'a',
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          p: 'p',
          pre: 'pre',
          ul: 'ul',
          ...(0, o.R)(),
          ...i.components,
        };
        return (0, a.jsxs)(a.Fragment, {
          children: [
            (0, a.jsx)(e.header, {
              children: (0, a.jsx)(e.h1, {
                id: 'database-optimization-guide',
                children: 'Database Optimization Guide',
              }),
            }),
            '\n',
            (0, a.jsx)(e.p, {
              children:
                'This page outlines practical tips for optimizing MySQL performance in Gatrix.',
            }),
            '\n',
            (0, a.jsx)(e.h2, { id: 'indexing', children: 'Indexing' }),
            '\n',
            (0, a.jsxs)(e.ul, {
              children: [
                '\n',
                (0, a.jsx)(e.li, {
                  children: 'Create selective single and composite indexes for hot queries',
                }),
                '\n',
                (0, a.jsxs)(e.li, {
                  children: [
                    'Review query plans regularly using ',
                    (0, a.jsx)(e.code, { children: 'EXPLAIN' }),
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, a.jsx)(e.h2, { id: 'connection-pooling', children: 'Connection Pooling' }),
            '\n',
            (0, a.jsx)(e.p, {
              children: 'Configure conservative but sufficient pool limits and timeouts (Knex):',
            }),
            '\n',
            (0, a.jsx)(e.pre, {
              children: (0, a.jsx)(e.code, {
                className: 'language-js',
                children:
                  'pool: {\n  min: 2,\n  max: 20,\n  acquireTimeoutMillis: 60000,\n  idleTimeoutMillis: 600000,\n}\n',
              }),
            }),
            '\n',
            (0, a.jsx)(e.h2, { id: 'pagination', children: 'Pagination' }),
            '\n',
            (0, a.jsxs)(e.p, {
              children: [
                'Prefer cursor-based pagination when feasible (use ',
                (0, a.jsx)(e.code, { children: 'id' }),
                ' or created timestamp).',
              ],
            }),
            '\n',
            (0, a.jsx)(e.h2, { id: 'observability', children: 'Observability' }),
            '\n',
            (0, a.jsx)(e.p, {
              children: 'Track slow queries and collect latency metrics exposed via Prometheus.',
            }),
            '\n',
            (0, a.jsx)(e.h2, { id: 'next', children: 'Next' }),
            '\n',
            (0, a.jsxs)(e.ul, {
              children: [
                '\n',
                (0, a.jsxs)(e.li, {
                  children: [
                    'See caching strategies: ',
                    (0, a.jsx)(e.a, {
                      href: '/optimization/caching',
                      children: '/docs/optimization/caching',
                    }),
                  ],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function p(i = {}) {
        const { wrapper: e } = { ...(0, o.R)(), ...i.components };
        return e ? (0, a.jsx)(e, { ...i, children: (0, a.jsx)(d, { ...i }) }) : d(i);
      }
    },
    8453(i, e, n) {
      n.d(e, { R: () => s, x: () => r });
      var t = n(6540);
      const a = {},
        o = t.createContext(a);
      function s(i) {
        const e = t.useContext(o);
        return t.useMemo(
          function () {
            return 'function' == typeof i ? i(e) : { ...e, ...i };
          },
          [e, i]
        );
      }
      function r(i) {
        let e;
        return (
          (e = i.disableParentContext
            ? 'function' == typeof i.components
              ? i.components(a)
              : i.components || a
            : s(i.components)),
          t.createElement(o.Provider, { value: e }, i.children)
        );
      }
    },
  },
]);
