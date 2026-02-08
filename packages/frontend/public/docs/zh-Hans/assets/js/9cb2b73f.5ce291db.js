'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [8385],
  {
    8453(e, n, i) {
      i.d(n, { R: () => a, x: () => c });
      var t = i(6540);
      const r = {},
        s = t.createContext(r);
      function a(e) {
        const n = t.useContext(s);
        return t.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function c(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(r)
              : e.components || r
            : a(e.components)),
          t.createElement(s.Provider, { value: n }, e.children)
        );
      }
    },
    9986(e, n, i) {
      (i.r(n),
        i.d(n, {
          assets: () => l,
          contentTitle: () => c,
          default: () => p,
          frontMatter: () => a,
          metadata: () => t,
          toc: () => o,
        }));
      const t = JSON.parse(
        '{"id":"api/server-sdk-api","title":"\u670d\u52a1\u5668 SDK API","description":"\u7528\u4e8e\u6e38\u620f\u670d\u52a1\u5668\u4e0e Gatrix \u901a\u4fe1\u7684 SDK API \u6587\u6863\u3002","source":"@site/i18n/zh-Hans/docusaurus-plugin-content-docs/current/api/server-sdk-api.md","sourceDirName":"api","slug":"/api/server-sdk-api","permalink":"/docs/zh-Hans/api/server-sdk-api","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/api/server-sdk-api.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2,"sidebar_label":"\u670d\u52a1\u5668 SDK API"},"sidebar":"tutorialSidebar","previous":{"title":"\u5ba2\u6237\u7aef API","permalink":"/docs/zh-Hans/api/client-api"},"next":{"title":"Docker Deployment Guide","permalink":"/docs/zh-Hans/deployment/docker"}}'
      );
      var r = i(4848),
        s = i(8453);
      const a = { sidebar_position: 2, sidebar_label: '\u670d\u52a1\u5668 SDK API' },
        c = '\u670d\u52a1\u5668 SDK API',
        l = {},
        o = [
          { value: '\u521d\u59cb\u5316', id: '\u521d\u59cb\u5316', level: 2 },
          { value: '\u6838\u5fc3\u529f\u80fd', id: '\u6838\u5fc3\u529f\u80fd', level: 2 },
          {
            value: '1. \u529f\u80fd\u5f00\u5173\u8bc4\u4f30',
            id: '1-\u529f\u80fd\u5f00\u5173\u8bc4\u4f30',
            level: 3,
          },
          {
            value: '2. \u83b7\u53d6\u7ef4\u62a4\u72b6\u6001',
            id: '2-\u83b7\u53d6\u7ef4\u62a4\u72b6\u6001',
            level: 3,
          },
          {
            value: '3. \u767d\u540d\u5355\u68c0\u67e5',
            id: '3-\u767d\u540d\u5355\u68c0\u67e5',
            level: 3,
          },
        ];
      function d(e) {
        const n = {
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          header: 'header',
          p: 'p',
          pre: 'pre',
          ...(0, s.R)(),
          ...e.components,
        };
        return (0, r.jsxs)(r.Fragment, {
          children: [
            (0, r.jsx)(n.header, {
              children: (0, r.jsx)(n.h1, {
                id: '\u670d\u52a1\u5668-sdk-api',
                children: '\u670d\u52a1\u5668 SDK API',
              }),
            }),
            '\n',
            (0, r.jsx)(n.p, {
              children:
                '\u7528\u4e8e\u6e38\u620f\u670d\u52a1\u5668\u4e0e Gatrix \u901a\u4fe1\u7684 SDK API \u6587\u6863\u3002',
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: '\u521d\u59cb\u5316', children: '\u521d\u59cb\u5316' }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "import { GatrixClient } from '@gatrix/server-sdk';\r\n\r\nconst client = new GatrixClient({\r\n  apiKey: '\u4f60\u7684 API \u79d8\u94a5',\r\n  environment: 'production'\r\n});\n",
              }),
            }),
            '\n',
            (0, r.jsx)(n.h2, {
              id: '\u6838\u5fc3\u529f\u80fd',
              children: '\u6838\u5fc3\u529f\u80fd',
            }),
            '\n',
            (0, r.jsx)(n.h3, {
              id: '1-\u529f\u80fd\u5f00\u5173\u8bc4\u4f30',
              children: '1. \u529f\u80fd\u5f00\u5173\u8bc4\u4f30',
            }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "const isEnabled = await client.getFeatureFlag('new_battle_mode', {\r\n  userId: 'player_1',\r\n  level: 50\r\n});\n",
              }),
            }),
            '\n',
            (0, r.jsx)(n.h3, {
              id: '2-\u83b7\u53d6\u7ef4\u62a4\u72b6\u6001',
              children: '2. \u83b7\u53d6\u7ef4\u62a4\u72b6\u6001',
            }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "const maintenance = await client.getCurrentMaintenance();\r\nif (maintenance.isActive) {\r\n  console.log('\u7ef4\u62a4\u4e2d:', maintenance.message);\r\n}\n",
              }),
            }),
            '\n',
            (0, r.jsx)(n.h3, {
              id: '3-\u767d\u540d\u5355\u68c0\u67e5',
              children: '3. \u767d\u540d\u5355\u68c0\u67e5',
            }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "const isWhitelisted = await client.whitelist.isIpWhitelisted('1.2.3.4');\n",
              }),
            }),
          ],
        });
      }
      function p(e = {}) {
        const { wrapper: n } = { ...(0, s.R)(), ...e.components };
        return n ? (0, r.jsx)(n, { ...e, children: (0, r.jsx)(d, { ...e }) }) : d(e);
      }
    },
  },
]);
