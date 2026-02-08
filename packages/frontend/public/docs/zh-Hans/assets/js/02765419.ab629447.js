'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [6343],
  {
    6374(e, s, r) {
      (r.r(s),
        r.d(s, {
          assets: () => d,
          contentTitle: () => o,
          default: () => h,
          frontMatter: () => l,
          metadata: () => n,
          toc: () => a,
        }));
      const n = JSON.parse(
        '{"id":"sdks/server-side","title":"Server-side SDKs","description":"Gatrix provides various server-side SDKs to integrate feature flagging into your backend services with high performance and reliability.","source":"@site/docs/sdks/server-side.md","sourceDirName":"sdks","slug":"/sdks/server-side","permalink":"/docs/zh-Hans/sdks/server-side","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/sdks/server-side.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1},"sidebar":"tutorialSidebar","previous":{"title":"New Relic","permalink":"/docs/zh-Hans/integrations/new-relic"},"next":{"title":"Client-side SDKs","permalink":"/docs/zh-Hans/sdks/client-side"}}'
      );
      var i = r(4848),
        t = r(8453);
      const l = { sidebar_position: 1 },
        o = 'Server-side SDKs',
        d = {},
        a = [
          { value: 'Available SDKs', id: 'available-sdks', level: 2 },
          { value: 'Integration Workflow', id: 'integration-workflow', level: 2 },
          { value: 'Key Features', id: 'key-features', level: 2 },
        ];
      function c(e) {
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
                'Gatrix provides various server-side SDKs to integrate feature flagging into your backend services with high performance and reliability.',
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
                    (0, i.jsx)(s.strong, { children: 'Rust' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/rust', children: 'Docs' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Elixir' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/elixir', children: 'Docs' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'C++' }),
                    ': ',
                    (0, i.jsx)(s.a, { href: '/docs/sdks/cpp', children: 'Docs' }),
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
            (0, i.jsx)(s.h2, { id: 'integration-workflow', children: 'Integration Workflow' }),
            '\n',
            (0, i.jsxs)(s.ol, {
              children: [
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Install the SDK' }),
                    ': Add the Gatrix SDK package to your project.',
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Initialize the Client' }),
                    ': Set up the SDK with your Environment Key.',
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Evaluate Flags' }),
                    ': Use the client to evaluate feature flags for your users.',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'key-features', children: 'Key Features' }),
            '\n',
            (0, i.jsxs)(s.ul, {
              children: [
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Local Evaluation' }),
                    ': Flags are evaluated within your application process for zero latency.',
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Streaming Updates' }),
                    ': Real-time flag updates via Server-Sent Events (SSE).',
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Offline Mode' }),
                    ': Support for fallback values and local configuration.',
                  ],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: s } = { ...(0, t.R)(), ...e.components };
        return s ? (0, i.jsx)(s, { ...e, children: (0, i.jsx)(c, { ...e }) }) : c(e);
      }
    },
    8453(e, s, r) {
      r.d(s, { R: () => l, x: () => o });
      var n = r(6540);
      const i = {},
        t = n.createContext(i);
      function l(e) {
        const s = n.useContext(t);
        return n.useMemo(
          function () {
            return 'function' == typeof e ? e(s) : { ...s, ...e };
          },
          [s, e]
        );
      }
      function o(e) {
        let s;
        return (
          (s = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(i)
              : e.components || i
            : l(e.components)),
          n.createElement(t.Provider, { value: s }, e.children)
        );
      }
    },
  },
]);
