'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [3880],
  {
    7041(t, e, o) {
      (o.r(e),
        o.d(e, {
          assets: () => s,
          contentTitle: () => m,
          default: () => u,
          frontMatter: () => n,
          metadata: () => a,
          toc: () => c,
        }));
      var a = o(8536),
        i = o(4848),
        r = o(8453);
      const n = {
          slug: 'performance-optimization',
          title: 'Gatrix Performance Optimization Guide',
          authors: ['gatrix-team'],
          tags: ['performance', 'optimization'],
        },
        m = void 0,
        s = { authorsImageUrls: [void 0] },
        c = [];
      function p(t) {
        const e = { p: 'p', ...(0, r.R)(), ...t.components };
        return (0, i.jsx)(e.p, {
          children: 'Learn how to optimize Gatrix for maximum performance.',
        });
      }
      function u(t = {}) {
        const { wrapper: e } = { ...(0, r.R)(), ...t.components };
        return e ? (0, i.jsx)(e, { ...t, children: (0, i.jsx)(p, { ...t }) }) : p(t);
      }
    },
    8453(t, e, o) {
      o.d(e, { R: () => n, x: () => m });
      var a = o(6540);
      const i = {},
        r = a.createContext(i);
      function n(t) {
        const e = a.useContext(r);
        return a.useMemo(
          function () {
            return 'function' == typeof t ? t(e) : { ...e, ...t };
          },
          [e, t]
        );
      }
      function m(t) {
        let e;
        return (
          (e = t.disableParentContext
            ? 'function' == typeof t.components
              ? t.components(i)
              : t.components || i
            : n(t.components)),
          a.createElement(r.Provider, { value: e }, t.children)
        );
      }
    },
    8536(t) {
      t.exports = JSON.parse(
        '{"permalink":"/docs/zh-Hans/blog/performance-optimization","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2024-01-20-performance-optimization.md","source":"@site/blog/2024-01-20-performance-optimization.md","title":"Gatrix Performance Optimization Guide","description":"Learn how to optimize Gatrix for maximum performance.","date":"2024-01-20T00:00:00.000Z","tags":[{"inline":true,"label":"performance","permalink":"/docs/zh-Hans/blog/tags/performance"},{"inline":true,"label":"optimization","permalink":"/docs/zh-Hans/blog/tags/optimization"}],"readingTime":0.89,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/zh-Hans/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"performance-optimization","title":"Gatrix Performance Optimization Guide","authors":["gatrix-team"],"tags":["performance","optimization"]},"unlisted":false,"nextItem":{"title":"Gatrix Production Deployment Tips and Best Practices","permalink":"/docs/zh-Hans/blog/production-deployment-tips"}}'
      );
    },
  },
]);
