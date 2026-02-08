'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [2057],
  {
    7376(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => c,
          contentTitle: () => a,
          default: () => h,
          frontMatter: () => r,
          metadata: () => s,
          toc: () => l,
        }));
      const s = JSON.parse(
        '{"id":"integrations/teams","title":"Microsoft Teams ?\ufffd\ub3d9","description":"Microsoft Teams \ucc44\ub110\ufffd??\ufffd\ub9bc??\ubc1b\uc744 ???\ufffd\uc2b5?\ufffd\ub2e4.","source":"@site/docs/integrations/teams.md","sourceDirName":"integrations","slug":"/integrations/teams","permalink":"/docs/zh-Hans/integrations/teams","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/integrations/teams.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"tutorialSidebar","previous":{"title":"Slack ?\ufffd\ub3d9","permalink":"/docs/zh-Hans/integrations/slack"},"next":{"title":"Webhook ?\ufffd\ub3d9","permalink":"/docs/zh-Hans/integrations/webhook"}}'
      );
      var o = t(4848),
        i = t(8453);
      const r = { sidebar_position: 3 },
        a = 'Microsoft Teams ?\ufffd\ub3d9',
        c = {},
        l = [
          { value: '?\ufffd\uc815 \ubc29\ubc95', id: '\uc815-\ubc29\ubc95', level: 2 },
          { value: '?\ufffd\uc694 ?\ufffd\ubcf4', id: '\uc694-\ubcf4', level: 2 },
        ];
      function d(e) {
        const n = {
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          ol: 'ol',
          p: 'p',
          strong: 'strong',
          ul: 'ul',
          ...(0, i.R)(),
          ...e.components,
        };
        return (0, o.jsxs)(o.Fragment, {
          children: [
            (0, o.jsx)(n.header, {
              children: (0, o.jsx)(n.h1, {
                id: 'microsoft-teams-\ub3d9',
                children: 'Microsoft Teams ?\ufffd\ub3d9',
              }),
            }),
            '\n',
            (0, o.jsx)(n.p, {
              children:
                'Microsoft Teams \ucc44\ub110\ufffd??\ufffd\ub9bc??\ubc1b\uc744 ???\ufffd\uc2b5?\ufffd\ub2e4.',
            }),
            '\n',
            (0, o.jsx)(n.h2, { id: '\uc815-\ubc29\ubc95', children: '?\ufffd\uc815 \ubc29\ubc95' }),
            '\n',
            (0, o.jsxs)(n.ol, {
              children: [
                '\n',
                (0, o.jsx)(n.li, {
                  children: 'Teams?\ufffd\uc11c Incoming Webhook \ucee4\ub125??\ucd94\ufffd?',
                }),
                '\n',
                (0, o.jsx)(n.li, { children: 'Webhook URL \ubcf5\uc0ac' }),
                '\n',
                (0, o.jsx)(n.li, {
                  children: 'Gatrix?\ufffd\uc11c ?\ufffd\ub3d9 ?\ufffd\uc815 ??URL ?\ufffd\ub825',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, o.jsx)(n.h2, { id: '\uc694-\ubcf4', children: '?\ufffd\uc694 ?\ufffd\ubcf4' }),
            '\n',
            (0, o.jsxs)(n.ul, {
              children: [
                '\n',
                (0, o.jsxs)(n.li, {
                  children: [
                    (0, o.jsx)(n.strong, { children: 'Teams Webhook URL' }),
                    ': Teams?\ufffd\uc11c ?\ufffd\uc131??Incoming Webhook URL',
                  ],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, i.R)(), ...e.components };
        return n ? (0, o.jsx)(n, { ...e, children: (0, o.jsx)(d, { ...e }) }) : d(e);
      }
    },
    8453(e, n, t) {
      t.d(n, { R: () => r, x: () => a });
      var s = t(6540);
      const o = {},
        i = s.createContext(o);
      function r(e) {
        const n = s.useContext(i);
        return s.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function a(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(o)
              : e.components || o
            : r(e.components)),
          s.createElement(i.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
