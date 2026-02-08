'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [2875],
  {
    7449(n, e, s) {
      (s.r(e),
        s.d(e, {
          assets: () => o,
          contentTitle: () => c,
          default: () => h,
          frontMatter: () => l,
          metadata: () => i,
          toc: () => d,
        }));
      const i = JSON.parse(
        '{"id":"integrations/slack","title":"Slack \u96c6\u6210","description":"\u53d1\u9001 Gatrix \u901a\u77e5\u5230 Slack\u3002","source":"@site/i18n/zh-Hans/docusaurus-plugin-content-docs/current/integrations/slack.md","sourceDirName":"integrations","slug":"/integrations/slack","permalink":"/docs/zh-Hans/integrations/slack","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/integrations/slack.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2,"sidebar_label":"Slack"},"sidebar":"tutorialSidebar","previous":{"title":"\u6982\u8ff0","permalink":"/docs/zh-Hans/integrations/overview"},"next":{"title":"Microsoft Teams","permalink":"/docs/zh-Hans/integrations/teams"}}'
      );
      var r = s(4848),
        t = s(8453);
      const l = { sidebar_position: 2, sidebar_label: 'Slack' },
        c = 'Slack \u96c6\u6210',
        o = {},
        d = [
          { value: '\u8bbe\u7f6e\u6307\u5357', id: '\u8bbe\u7f6e\u6307\u5357', level: 2 },
          {
            value: '1. \u521b\u5efa Slack \u5e94\u7528',
            id: '1-\u521b\u5efa-slack-\u5e94\u7528',
            level: 3,
          },
          {
            value: '2. \u914d\u7f6e Incoming Webhooks',
            id: '2-\u914d\u7f6e-incoming-webhooks',
            level: 3,
          },
          {
            value: '3. \u5728 Gatrix \u4e2d\u6ce8\u518c',
            id: '3-\u5728-gatrix-\u4e2d\u6ce8\u518c',
            level: 3,
          },
          { value: '\u901a\u77e5\u4e8b\u4ef6', id: '\u901a\u77e5\u4e8b\u4ef6', level: 2 },
          { value: '\u6d4b\u8bd5', id: '\u6d4b\u8bd5', level: 2 },
        ];
      function a(n) {
        const e = {
          a: 'a',
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          header: 'header',
          li: 'li',
          ol: 'ol',
          p: 'p',
          strong: 'strong',
          table: 'table',
          tbody: 'tbody',
          td: 'td',
          th: 'th',
          thead: 'thead',
          tr: 'tr',
          ...(0, t.R)(),
          ...n.components,
        };
        return (0, r.jsxs)(r.Fragment, {
          children: [
            (0, r.jsx)(e.header, {
              children: (0, r.jsx)(e.h1, {
                id: 'slack-\u96c6\u6210',
                children: 'Slack \u96c6\u6210',
              }),
            }),
            '\n',
            (0, r.jsx)(e.p, { children: '\u53d1\u9001 Gatrix \u901a\u77e5\u5230 Slack\u3002' }),
            '\n',
            (0, r.jsx)(e.h2, {
              id: '\u8bbe\u7f6e\u6307\u5357',
              children: '\u8bbe\u7f6e\u6307\u5357',
            }),
            '\n',
            (0, r.jsx)(e.h3, {
              id: '1-\u521b\u5efa-slack-\u5e94\u7528',
              children: '1. \u521b\u5efa Slack \u5e94\u7528',
            }),
            '\n',
            (0, r.jsxs)(e.ol, {
              children: [
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    '\u524d\u5f80 ',
                    (0, r.jsx)(e.a, {
                      href: 'https://api.slack.com/apps',
                      children: 'api.slack.com/apps',
                    }),
                    '\u3002',
                  ],
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    '\u70b9\u51fb ',
                    (0, r.jsx)(e.strong, { children: 'Create New App' }),
                    '\u3002',
                  ],
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    '\u9009\u62e9 ',
                    (0, r.jsx)(e.strong, { children: 'From scratch' }),
                    '\u3002',
                  ],
                }),
                '\n',
                (0, r.jsx)(e.li, {
                  children:
                    '\u8f93\u5165\u5e94\u7528\u540d\u79f0\u5e76\u9009\u62e9\u5de5\u4f5c\u533a\u3002',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(e.h3, {
              id: '2-\u914d\u7f6e-incoming-webhooks',
              children: '2. \u914d\u7f6e Incoming Webhooks',
            }),
            '\n',
            (0, r.jsxs)(e.ol, {
              children: [
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    '\u5728 Slack \u5e94\u7528\u8bbe\u7f6e\u4e2d\uff0c\u524d\u5f80 ',
                    (0, r.jsx)(e.strong, { children: 'Incoming Webhooks' }),
                    '\u3002',
                  ],
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    '\u5c06 ',
                    (0, r.jsx)(e.strong, { children: 'Activate Incoming Webhooks' }),
                    ' \u8bbe\u7f6e\u4e3a On\u3002',
                  ],
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    '\u70b9\u51fb ',
                    (0, r.jsx)(e.strong, { children: 'Add New Webhook to Workspace' }),
                    '\u3002',
                  ],
                }),
                '\n',
                (0, r.jsx)(e.li, {
                  children: '\u9009\u62e9\u8981\u63a5\u6536\u901a\u77e5\u7684\u9891\u9053\u3002',
                }),
                '\n',
                (0, r.jsx)(e.li, { children: '\u590d\u5236\u751f\u6210\u7684 Webhook URL\u3002' }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(e.h3, {
              id: '3-\u5728-gatrix-\u4e2d\u6ce8\u518c',
              children: '3. \u5728 Gatrix \u4e2d\u6ce8\u518c',
            }),
            '\n',
            (0, r.jsxs)(e.ol, {
              children: [
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    '\u524d\u5f80 ',
                    (0, r.jsx)(e.strong, { children: '\u8bbe\u7f6e' }),
                    ' > ',
                    (0, r.jsx)(e.strong, { children: '\u5916\u90e8\u96c6\u6210' }),
                    ' > ',
                    (0, r.jsx)(e.strong, { children: 'Slack' }),
                    '\u3002',
                  ],
                }),
                '\n',
                (0, r.jsx)(e.li, { children: '\u7c98\u8d34 Webhook URL\u3002' }),
                '\n',
                (0, r.jsx)(e.li, {
                  children: '\u914d\u7f6e\u8981\u63a5\u6536\u901a\u77e5\u7684\u4e8b\u4ef6\u3002',
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    '\u70b9\u51fb ',
                    (0, r.jsx)(e.strong, { children: '\u4fdd\u5b58' }),
                    '\u3002',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(e.h2, {
              id: '\u901a\u77e5\u4e8b\u4ef6',
              children: '\u901a\u77e5\u4e8b\u4ef6',
            }),
            '\n',
            (0, r.jsxs)(e.table, {
              children: [
                (0, r.jsx)(e.thead, {
                  children: (0, r.jsxs)(e.tr, {
                    children: [
                      (0, r.jsx)(e.th, { children: '\u4e8b\u4ef6' }),
                      (0, r.jsx)(e.th, { children: '\u8bf4\u660e' }),
                    ],
                  }),
                }),
                (0, r.jsxs)(e.tbody, {
                  children: [
                    (0, r.jsxs)(e.tr, {
                      children: [
                        (0, r.jsx)(e.td, { children: '\u529f\u80fd\u5f00\u5173\u53d8\u66f4' }),
                        (0, r.jsx)(e.td, {
                          children:
                            '\u521b\u5efa/\u66f4\u65b0/\u5220\u9664\u5f00\u5173\u65f6\u901a\u77e5',
                        }),
                      ],
                    }),
                    (0, r.jsxs)(e.tr, {
                      children: [
                        (0, r.jsx)(e.td, { children: '\u7ef4\u62a4\u72b6\u6001' }),
                        (0, r.jsx)(e.td, {
                          children: '\u7ef4\u62a4\u5f00\u59cb/\u7ed3\u675f\u65f6\u901a\u77e5',
                        }),
                      ],
                    }),
                    (0, r.jsxs)(e.tr, {
                      children: [
                        (0, r.jsx)(e.td, { children: '\u7cfb\u7edf\u9519\u8bef' }),
                        (0, r.jsx)(e.td, {
                          children: '\u53d1\u751f\u7cfb\u7edf\u9519\u8bef\u65f6\u901a\u77e5',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, r.jsx)(e.h2, { id: '\u6d4b\u8bd5', children: '\u6d4b\u8bd5' }),
            '\n',
            (0, r.jsxs)(e.p, {
              children: [
                '\u70b9\u51fb ',
                (0, r.jsx)(e.strong, { children: '\u53d1\u9001\u6d4b\u8bd5\u6d88\u606f' }),
                ' \u9a8c\u8bc1\u96c6\u6210\u662f\u5426\u6b63\u5e38\u5de5\u4f5c\u3002',
              ],
            }),
          ],
        });
      }
      function h(n = {}) {
        const { wrapper: e } = { ...(0, t.R)(), ...n.components };
        return e ? (0, r.jsx)(e, { ...n, children: (0, r.jsx)(a, { ...n }) }) : a(n);
      }
    },
    8453(n, e, s) {
      s.d(e, { R: () => l, x: () => c });
      var i = s(6540);
      const r = {},
        t = i.createContext(r);
      function l(n) {
        const e = i.useContext(t);
        return i.useMemo(
          function () {
            return 'function' == typeof n ? n(e) : { ...e, ...n };
          },
          [e, n]
        );
      }
      function c(n) {
        let e;
        return (
          (e = n.disableParentContext
            ? 'function' == typeof n.components
              ? n.components(r)
              : n.components || r
            : l(n.components)),
          i.createElement(t.Provider, { value: e }, n.children)
        );
      }
    },
  },
]);
