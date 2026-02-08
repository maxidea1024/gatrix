'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [9006],
  {
    5126(t) {
      t.exports = JSON.parse(
        '{"permalink":"/docs/zh-Hans/blog/production-deployment-tips","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2024-01-15-production-deployment-tips.md","source":"@site/blog/2024-01-15-production-deployment-tips.md","title":"Gatrix Production Deployment Tips and Best Practices","description":"Essential tips and best practices for deploying Gatrix safely and efficiently to production environments.","date":"2024-01-15T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/zh-Hans/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":false,"label":"Tips","permalink":"/docs/zh-Hans/blog/tags/tips","description":"Tips and best practices"},{"inline":true,"label":"deployment","permalink":"/docs/zh-Hans/blog/tags/deployment"},{"inline":true,"label":"production","permalink":"/docs/zh-Hans/blog/tags/production"}],"readingTime":1.51,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/zh-Hans/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"production-deployment-tips","title":"Gatrix Production Deployment Tips and Best Practices","authors":["gatrix-team"],"tags":["gatrix","tips","deployment","production"]},"unlisted":false,"prevItem":{"title":"Gatrix Performance Optimization Guide","permalink":"/docs/zh-Hans/blog/performance-optimization"},"nextItem":{"title":"Gatrix API Integration and Webhook Setup Guide","permalink":"/docs/zh-Hans/blog/api-integration-webhooks"}}'
      );
    },
    5432(t, e, o) {
      (o.r(e),
        o.d(e, {
          assets: () => p,
          contentTitle: () => s,
          default: () => d,
          frontMatter: () => r,
          metadata: () => n,
          toc: () => l,
        }));
      var n = o(5126),
        i = o(4848),
        a = o(8453);
      const r = {
          slug: 'production-deployment-tips',
          title: 'Gatrix Production Deployment Tips and Best Practices',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'tips', 'deployment', 'production'],
        },
        s = void 0,
        p = { authorsImageUrls: [void 0] },
        l = [];
      function c(t) {
        const e = { p: 'p', ...(0, a.R)(), ...t.components };
        return (0, i.jsx)(e.p, {
          children:
            'Essential tips and best practices for deploying Gatrix safely and efficiently to production environments.',
        });
      }
      function d(t = {}) {
        const { wrapper: e } = { ...(0, a.R)(), ...t.components };
        return e ? (0, i.jsx)(e, { ...t, children: (0, i.jsx)(c, { ...t }) }) : c(t);
      }
    },
    8453(t, e, o) {
      o.d(e, { R: () => r, x: () => s });
      var n = o(6540);
      const i = {},
        a = n.createContext(i);
      function r(t) {
        const e = n.useContext(a);
        return n.useMemo(
          function () {
            return 'function' == typeof t ? t(e) : { ...e, ...t };
          },
          [e, t]
        );
      }
      function s(t) {
        let e;
        return (
          (e = t.disableParentContext
            ? 'function' == typeof t.components
              ? t.components(i)
              : t.components || i
            : r(t.components)),
          n.createElement(a.Provider, { value: e }, t.children)
        );
      }
    },
  },
]);
