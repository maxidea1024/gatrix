'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [8737],
  {
    4137(t, e, o) {
      (o.r(e),
        o.d(e, {
          assets: () => l,
          contentTitle: () => s,
          default: () => u,
          frontMatter: () => n,
          metadata: () => a,
          toc: () => p,
        }));
      var a = o(8811),
        i = o(4848),
        r = o(8453);
      const n = {
          slug: 'api-integration-webhooks',
          title: 'Gatrix API Integration and Webhook Setup Guide',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'api', 'tutorial', 'tips'],
        },
        s = void 0,
        l = { authorsImageUrls: [void 0] },
        p = [];
      function c(t) {
        const e = { p: 'p', ...(0, r.R)(), ...t.components };
        return (0, i.jsx)(e.p, {
          children:
            "Learn how to leverage Gatrix's powerful API system to implement integrations with external services and set up webhooks to process real-time events.",
        });
      }
      function u(t = {}) {
        const { wrapper: e } = { ...(0, r.R)(), ...t.components };
        return e ? (0, i.jsx)(e, { ...t, children: (0, i.jsx)(c, { ...t }) }) : c(t);
      }
    },
    8453(t, e, o) {
      o.d(e, { R: () => n, x: () => s });
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
      function s(t) {
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
    8811(t) {
      t.exports = JSON.parse(
        '{"permalink":"/docs/ko/blog/api-integration-webhooks","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2021-08-26-welcome/index.md","source":"@site/blog/2021-08-26-welcome/index.md","title":"Gatrix API Integration and Webhook Setup Guide","description":"Learn how to leverage Gatrix\'s powerful API system to implement integrations with external services and set up webhooks to process real-time events.","date":"2021-08-26T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/ko/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":false,"label":"API","permalink":"/docs/ko/blog/tags/api","description":"API documentation and usage"},{"inline":false,"label":"Tutorial","permalink":"/docs/ko/blog/tags/tutorial","description":"Step-by-step tutorials and guides"},{"inline":false,"label":"Tips","permalink":"/docs/ko/blog/tags/tips","description":"Tips and best practices"}],"readingTime":0.93,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/ko/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"api-integration-webhooks","title":"Gatrix API Integration and Webhook Setup Guide","authors":["gatrix-team"],"tags":["gatrix","api","tutorial","tips"]},"unlisted":false,"prevItem":{"title":"Gatrix Production Deployment Tips and Best Practices","permalink":"/docs/ko/blog/production-deployment-tips"},"nextItem":{"title":"Gatrix Real-time Chat Server Setup Guide","permalink":"/docs/ko/blog/real-time-chat-server-setup"}}'
      );
    },
  },
]);
