'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [6343],
  {
    6374(e, s, n) {
      (n.r(s),
        n.d(s, {
          assets: () => l,
          contentTitle: () => d,
          default: () => h,
          frontMatter: () => o,
          metadata: () => r,
          toc: () => c,
        }));
      const r = JSON.parse(
        '{"id":"sdks/server-side","title":"Server-side SDKs","description":"Gatrix provides various server-side SDKs to integrate feature flagging into your backend services.","source":"@site/docs/sdks/server-side.md","sourceDirName":"sdks","slug":"/sdks/server-side","permalink":"/docs/zh-Hans/sdks/server-side","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/sdks/server-side.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1},"sidebar":"tutorialSidebar","previous":{"title":"New Relic","permalink":"/docs/zh-Hans/integrations/new-relic"},"next":{"title":"Client-side SDKs","permalink":"/docs/zh-Hans/sdks/client-side"}}'
      );
      var i = n(4848),
        t = n(8453);
      const o = { sidebar_position: 1 },
        d = 'Server-side SDKs',
        l = {},
        c = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Available SDKs', id: 'available-sdks', level: 2 },
          { value: 'Integration Steps', id: 'integration-steps', level: 2 },
        ];
      function a(e) {
        const s = {
          a: 'a',
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          ol: 'ol',
          p: 'p',
          strong: 'strong',
          ul: 'ul',
          ...(0, t.R)(),
          ...e.components,
        };
        return (0, i.jsxs)(i.Fragment, {
          children: [
            (0, i.jsx)(s.header, {
              children: (0, i.jsx)(s.h1, { id: 'server-side-sdks', children: 'Server-side SDKs' }),
            }),
            '\n',
            (0, i.jsx)(s.p, {
              children:
                'Gatrix provides various server-side SDKs to integrate feature flagging into your backend services.',
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, i.jsx)(s.p, {
              children:
                'Server-side SDKs are designed to run in a trusted environment (your servers). They typically:',
            }),
            '\n',
            (0, i.jsxs)(s.ul, {
              children: [
                '\n',
                (0, i.jsx)(s.li, {
                  children: 'Fetch flag definitions from the Gatrix API (e.g., Gatrix Edge).',
                }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Evaluate flags locally for high performance.' }),
                '\n',
                (0, i.jsx)(s.li, {
                  children: 'Support real-time updates via WebSockets or long-polling.',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'available-sdks', children: 'Available SDKs' }),
            '\n',
            (0, i.jsxs)(s.ul, {
              children: [
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Node.js' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/node', children: 'Docs' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Java' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/java', children: 'Docs' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Python' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/python', children: 'Docs' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Go' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/go', children: 'Docs' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: '.NET' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/dotnet', children: 'Docs' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Ruby' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/ruby', children: 'Docs' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'PHP' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/php', children: 'Docs' }),
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'integration-steps', children: 'Integration Steps' }),
            '\n',
            (0, i.jsxs)(s.ol, {
              children: [
                '\n',
                (0, i.jsx)(s.li, { children: 'Install the SDK via your package manager.' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Initialize the Gatrix client with your API token.' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Use the client to check flag states in your code.' }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: s } = { ...(0, t.R)(), ...e.components };
        return s ? (0, i.jsx)(s, { ...e, children: (0, i.jsx)(a, { ...e }) }) : a(e);
      }
    },
    8453(e, s, n) {
      n.d(s, { R: () => o, x: () => d });
      var r = n(6540);
      const i = {},
        t = r.createContext(i);
      function o(e) {
        const s = r.useContext(t);
        return r.useMemo(
          function () {
            return 'function' == typeof e ? e(s) : { ...s, ...e };
          },
          [s, e]
        );
      }
      function d(e) {
        let s;
        return (
          (s = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(i)
              : e.components || i
            : o(e.components)),
          r.createElement(t.Provider, { value: s }, e.children)
        );
      }
    },
  },
]);
