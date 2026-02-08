'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [3880],
  {
    8453(t, e, a) {
      a.d(e, { R: () => r, x: () => s });
      var i = a(6540);
      const o = {},
        n = i.createContext(o);
      function r(t) {
        const e = i.useContext(n);
        return i.useMemo(
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
              ? t.components(o)
              : t.components || o
            : r(t.components)),
          i.createElement(n.Provider, { value: e }, t.children)
        );
      }
    },
    8536(t) {
      t.exports = JSON.parse(
        '{"permalink":"/docs/zh-Hans/blog/performance-optimization-guide","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2024-01-20-performance-optimization.md","source":"@site/blog/2024-01-20-performance-optimization.md","title":"Gatrix ?\ufffd\ub2a5 \ucd5c\uc801???\ufffd\uc804 \uac00?\ufffd\ub4dc: \ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab??\uad6c\ucd95?\ufffd\uae30","description":"Gatrix???\ufffd\ub2a5??\uadf9\ufffd??\ufffd\ud558???\ufffd\ubc31\ufffd??\ufffd\uc6a9?\ufffd\ufffd? \uc9c0?\ufffd\ud558??\ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab?\ufffd\uc744 \uad6c\ucd95?\ufffd\ub294 \ubc29\ubc95???\ufffd\uc544\ubcf4\uaca0?\ufffd\ub2c8?? ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801?\ufffd\ufffd???\uce90\uc2f1 ?\ufffd\ub7b5, \ub85c\ub4dc \ubc38\ub7f0?\ufffd\uae4c\uc9c0 \ubaa8\ub4e0 ?\ufffd\uc5ed???\ufffd\ub8f9?\ufffd\ub2e4.","date":"2024-01-20T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/zh-Hans/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":true,"label":"performance","permalink":"/docs/zh-Hans/blog/tags/performance"},{"inline":true,"label":"optimization","permalink":"/docs/zh-Hans/blog/tags/optimization"},{"inline":false,"label":"Tips","permalink":"/docs/zh-Hans/blog/tags/tips","description":"Tips and best practices"}],"readingTime":9.13,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/zh-Hans/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"performance-optimization-guide","title":"Gatrix ?\ufffd\ub2a5 \ucd5c\uc801???\ufffd\uc804 \uac00?\ufffd\ub4dc: \ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab??\uad6c\ucd95?\ufffd\uae30","authors":["gatrix-team"],"tags":["gatrix","performance","optimization","tips"]},"unlisted":false,"nextItem":{"title":"Gatrix ?\ufffd\ub85c?\ufffd\uc158 \ubc30\ud3ec\ufffd??\ufffd\ud55c ?\ufffd\uc218 ?\ufffd\uacfc \ubca0\uc2a4???\ufffd\ub799?\ufffd\uc2a4","permalink":"/docs/zh-Hans/blog/production-deployment-tips"}}'
      );
    },
    9422(t, e, a) {
      (a.r(e),
        a.d(e, {
          assets: () => m,
          contentTitle: () => s,
          default: () => l,
          frontMatter: () => r,
          metadata: () => i,
          toc: () => p,
        }));
      var i = a(8536),
        o = a(4848),
        n = a(8453);
      const r = {
          slug: 'performance-optimization-guide',
          title:
            'Gatrix ?\ufffd\ub2a5 \ucd5c\uc801???\ufffd\uc804 \uac00?\ufffd\ub4dc: \ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab??\uad6c\ucd95?\ufffd\uae30',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'performance', 'optimization', 'tips'],
        },
        s = void 0,
        m = { authorsImageUrls: [void 0] },
        p = [];
      function c(t) {
        const e = { p: 'p', ...(0, n.R)(), ...t.components };
        return (0, o.jsx)(e.p, {
          children:
            'Gatrix???\ufffd\ub2a5??\uadf9\ufffd??\ufffd\ud558???\ufffd\ubc31\ufffd??\ufffd\uc6a9?\ufffd\ufffd? \uc9c0?\ufffd\ud558??\ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab?\ufffd\uc744 \uad6c\ucd95?\ufffd\ub294 \ubc29\ubc95???\ufffd\uc544\ubcf4\uaca0?\ufffd\ub2c8?? ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801?\ufffd\ufffd???\uce90\uc2f1 ?\ufffd\ub7b5, \ub85c\ub4dc \ubc38\ub7f0?\ufffd\uae4c\uc9c0 \ubaa8\ub4e0 ?\ufffd\uc5ed???\ufffd\ub8f9?\ufffd\ub2e4.',
        });
      }
      function l(t = {}) {
        const { wrapper: e } = { ...(0, n.R)(), ...t.components };
        return e ? (0, o.jsx)(e, { ...t, children: (0, o.jsx)(c, { ...t }) }) : c(t);
      }
    },
  },
]);
