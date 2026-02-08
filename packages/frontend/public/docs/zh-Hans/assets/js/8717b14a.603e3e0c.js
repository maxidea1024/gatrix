'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [3694],
  {
    1615(t, e, a) {
      (a.r(e),
        a.d(e, {
          assets: () => m,
          contentTitle: () => r,
          default: () => g,
          frontMatter: () => i,
          metadata: () => o,
          toc: () => l,
        }));
      var o = a(5802),
        n = a(4848),
        s = a(8453);
      const i = {
          slug: 'mastering-job-management-system',
          title: 'Mastering Gatrix Job Management System',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'jobs', 'tutorial', 'automation'],
        },
        r = void 0,
        m = { authorsImageUrls: [void 0] },
        l = [];
      function u(t) {
        const e = { p: 'p', ...(0, s.R)(), ...t.components };
        return (0, n.jsx)(e.p, {
          children:
            'Gatrix includes a comprehensive job management system that allows you to schedule and execute various types of automated tasks.',
        });
      }
      function g(t = {}) {
        const { wrapper: e } = { ...(0, s.R)(), ...t.components };
        return e ? (0, n.jsx)(e, { ...t, children: (0, n.jsx)(u, { ...t }) }) : u(t);
      }
    },
    5802(t) {
      t.exports = JSON.parse(
        '{"permalink":"/docs/zh-Hans/blog/mastering-job-management-system","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2019-05-29-long-blog-post.md","source":"@site/blog/2019-05-29-long-blog-post.md","title":"Mastering Gatrix Job Management System","description":"Gatrix includes a comprehensive job management system that allows you to schedule and execute various types of automated tasks.","date":"2019-05-29T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/zh-Hans/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":false,"label":"Jobs","permalink":"/docs/zh-Hans/blog/tags/jobs","description":"Job management and automation"},{"inline":false,"label":"Tutorial","permalink":"/docs/zh-Hans/blog/tags/tutorial","description":"Step-by-step tutorials and guides"},{"inline":true,"label":"automation","permalink":"/docs/zh-Hans/blog/tags/automation"}],"readingTime":0.64,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/zh-Hans/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"mastering-job-management-system","title":"Mastering Gatrix Job Management System","authors":["gatrix-team"],"tags":["gatrix","jobs","tutorial","automation"]},"unlisted":false,"prevItem":{"title":"Gatrix Real-time Chat Server Setup Guide","permalink":"/docs/zh-Hans/blog/real-time-chat-server-setup"},"nextItem":{"title":"Welcome to Gatrix - A New Dimension of Game Platform Management","permalink":"/docs/zh-Hans/blog/welcome-to-gatrix"}}'
      );
    },
    8453(t, e, a) {
      a.d(e, { R: () => i, x: () => r });
      var o = a(6540);
      const n = {},
        s = o.createContext(n);
      function i(t) {
        const e = o.useContext(s);
        return o.useMemo(
          function () {
            return 'function' == typeof t ? t(e) : { ...e, ...t };
          },
          [e, t]
        );
      }
      function r(t) {
        let e;
        return (
          (e = t.disableParentContext
            ? 'function' == typeof t.components
              ? t.components(n)
              : t.components || n
            : i(t.components)),
          o.createElement(s.Provider, { value: e }, t.children)
        );
      }
    },
  },
]);
