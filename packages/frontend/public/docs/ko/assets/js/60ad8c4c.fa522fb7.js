'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [7318],
  {
    471(n, e, s) {
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
        '{"id":"integrations/slack","title":"Slack \uc5f0\ub3d9","description":"Gatrix \uc54c\ub9bc\uc744 Slack\uc73c\ub85c \uc804\uc1a1\ud569\ub2c8\ub2e4.","source":"@site/i18n/ko/docusaurus-plugin-content-docs/current/integrations/slack.md","sourceDirName":"integrations","slug":"/integrations/slack","permalink":"/docs/ko/integrations/slack","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/integrations/slack.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2,"sidebar_label":"Slack"},"sidebar":"tutorialSidebar","previous":{"title":"\uac1c\uc694","permalink":"/docs/ko/integrations/overview"},"next":{"title":"Microsoft Teams","permalink":"/docs/ko/integrations/teams"}}'
      );
      var r = s(4848),
        t = s(8453);
      const l = { sidebar_position: 2, sidebar_label: 'Slack' },
        c = 'Slack \uc5f0\ub3d9',
        o = {},
        d = [
          { value: '\uc124\uc815 \ubc29\ubc95', id: '\uc124\uc815-\ubc29\ubc95', level: 2 },
          { value: '1. Slack \uc571 \uc0dd\uc131', id: '1-slack-\uc571-\uc0dd\uc131', level: 3 },
          {
            value: '2. Incoming Webhooks \uad6c\uc131',
            id: '2-incoming-webhooks-\uad6c\uc131',
            level: 3,
          },
          { value: '3. Gatrix\uc5d0 \ub4f1\ub85d', id: '3-gatrix\uc5d0-\ub4f1\ub85d', level: 3 },
          {
            value: '\uc54c\ub9bc \uc774\ubca4\ud2b8',
            id: '\uc54c\ub9bc-\uc774\ubca4\ud2b8',
            level: 2,
          },
          { value: '\ud14c\uc2a4\ud2b8', id: '\ud14c\uc2a4\ud2b8', level: 2 },
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
                id: 'slack-\uc5f0\ub3d9',
                children: 'Slack \uc5f0\ub3d9',
              }),
            }),
            '\n',
            (0, r.jsx)(e.p, {
              children:
                'Gatrix \uc54c\ub9bc\uc744 Slack\uc73c\ub85c \uc804\uc1a1\ud569\ub2c8\ub2e4.',
            }),
            '\n',
            (0, r.jsx)(e.h2, {
              id: '\uc124\uc815-\ubc29\ubc95',
              children: '\uc124\uc815 \ubc29\ubc95',
            }),
            '\n',
            (0, r.jsx)(e.h3, {
              id: '1-slack-\uc571-\uc0dd\uc131',
              children: '1. Slack \uc571 \uc0dd\uc131',
            }),
            '\n',
            (0, r.jsxs)(e.ol, {
              children: [
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    (0, r.jsx)(e.a, {
                      href: 'https://api.slack.com/apps',
                      children: 'api.slack.com/apps',
                    }),
                    '\ub85c \uc774\ub3d9\ud569\ub2c8\ub2e4.',
                  ],
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    (0, r.jsx)(e.strong, { children: 'Create New App' }),
                    '\uc744 \ud074\ub9ad\ud569\ub2c8\ub2e4.',
                  ],
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    (0, r.jsx)(e.strong, { children: 'From scratch' }),
                    '\ub97c \uc120\ud0dd\ud569\ub2c8\ub2e4.',
                  ],
                }),
                '\n',
                (0, r.jsx)(e.li, {
                  children:
                    '\uc571 \uc774\ub984\uc744 \uc785\ub825\ud558\uace0 \uc6cc\ud06c\uc2a4\ud398\uc774\uc2a4\ub97c \uc120\ud0dd\ud569\ub2c8\ub2e4.',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(e.h3, {
              id: '2-incoming-webhooks-\uad6c\uc131',
              children: '2. Incoming Webhooks \uad6c\uc131',
            }),
            '\n',
            (0, r.jsxs)(e.ol, {
              children: [
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    'Slack \uc571 \uc124\uc815\uc5d0\uc11c ',
                    (0, r.jsx)(e.strong, { children: 'Incoming Webhooks' }),
                    ' \uba54\ub274\ub85c \uc774\ub3d9\ud569\ub2c8\ub2e4.',
                  ],
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    (0, r.jsx)(e.strong, { children: 'Activate Incoming Webhooks' }),
                    '\ub97c On\uc73c\ub85c \uc124\uc815\ud569\ub2c8\ub2e4.',
                  ],
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    (0, r.jsx)(e.strong, { children: 'Add New Webhook to Workspace' }),
                    '\ub97c \ud074\ub9ad\ud569\ub2c8\ub2e4.',
                  ],
                }),
                '\n',
                (0, r.jsx)(e.li, {
                  children:
                    '\uc54c\ub9bc\uc744 \ubc1b\uc744 \ucc44\ub110\uc744 \uc120\ud0dd\ud569\ub2c8\ub2e4.',
                }),
                '\n',
                (0, r.jsx)(e.li, {
                  children: '\uc0dd\uc131\ub41c Webhook URL\uc744 \ubcf5\uc0ac\ud569\ub2c8\ub2e4.',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(e.h3, {
              id: '3-gatrix\uc5d0-\ub4f1\ub85d',
              children: '3. Gatrix\uc5d0 \ub4f1\ub85d',
            }),
            '\n',
            (0, r.jsxs)(e.ol, {
              children: [
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    (0, r.jsx)(e.strong, { children: '\uc124\uc815' }),
                    ' > ',
                    (0, r.jsx)(e.strong, { children: '\uc678\ubd80 \uc5f0\ub3d9' }),
                    ' > ',
                    (0, r.jsx)(e.strong, { children: 'Slack' }),
                    '\uc73c\ub85c \uc774\ub3d9\ud569\ub2c8\ub2e4.',
                  ],
                }),
                '\n',
                (0, r.jsx)(e.li, {
                  children:
                    '\ubcf5\uc0ac\ud55c Webhook URL\uc744 \ubd99\uc5ec\ub123\uc2b5\ub2c8\ub2e4.',
                }),
                '\n',
                (0, r.jsx)(e.li, {
                  children:
                    '\uc54c\ub9bc\uc744 \ubc1b\uc744 \uc774\ubca4\ud2b8\ub97c \uad6c\uc131\ud569\ub2c8\ub2e4.',
                }),
                '\n',
                (0, r.jsxs)(e.li, {
                  children: [
                    (0, r.jsx)(e.strong, { children: '\uc800\uc7a5' }),
                    '\uc744 \ud074\ub9ad\ud569\ub2c8\ub2e4.',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, r.jsx)(e.h2, {
              id: '\uc54c\ub9bc-\uc774\ubca4\ud2b8',
              children: '\uc54c\ub9bc \uc774\ubca4\ud2b8',
            }),
            '\n',
            (0, r.jsxs)(e.table, {
              children: [
                (0, r.jsx)(e.thead, {
                  children: (0, r.jsxs)(e.tr, {
                    children: [
                      (0, r.jsx)(e.th, { children: '\uc774\ubca4\ud2b8' }),
                      (0, r.jsx)(e.th, { children: '\uc124\uba85' }),
                    ],
                  }),
                }),
                (0, r.jsxs)(e.tbody, {
                  children: [
                    (0, r.jsxs)(e.tr, {
                      children: [
                        (0, r.jsx)(e.td, {
                          children: '\ud53c\ucc98 \ud50c\ub798\uadf8 \ubcc0\uacbd',
                        }),
                        (0, r.jsx)(e.td, {
                          children:
                            '\ud50c\ub798\uadf8 \uc0dd\uc131/\uc218\uc815/\uc0ad\uc81c \uc2dc \uc54c\ub9bc',
                        }),
                      ],
                    }),
                    (0, r.jsxs)(e.tr, {
                      children: [
                        (0, r.jsx)(e.td, { children: '\uc810\uac80 \uc0c1\ud0dc' }),
                        (0, r.jsx)(e.td, {
                          children: '\uc810\uac80 \uc2dc\uc791/\uc885\ub8cc \uc2dc \uc54c\ub9bc',
                        }),
                      ],
                    }),
                    (0, r.jsxs)(e.tr, {
                      children: [
                        (0, r.jsx)(e.td, { children: '\uc2dc\uc2a4\ud15c \uc624\ub958' }),
                        (0, r.jsx)(e.td, {
                          children:
                            '\uc2dc\uc2a4\ud15c \uc624\ub958 \ubc1c\uc0dd \uc2dc \uc54c\ub9bc',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, r.jsx)(e.h2, { id: '\ud14c\uc2a4\ud2b8', children: '\ud14c\uc2a4\ud2b8' }),
            '\n',
            (0, r.jsxs)(e.p, {
              children: [
                (0, r.jsx)(e.strong, {
                  children: '\ud14c\uc2a4\ud2b8 \uba54\uc2dc\uc9c0 \uc804\uc1a1',
                }),
                '\uc744 \ud074\ub9ad\ud558\uc5ec \uc5f0\ub3d9\uc774 \uc815\uc0c1\uc801\uc73c\ub85c \uc791\ub3d9\ud558\ub294\uc9c0 \ud655\uc778\ud569\ub2c8\ub2e4.',
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
