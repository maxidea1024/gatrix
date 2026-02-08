'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4039],
  {
    3752(e, n, i) {
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
        '{"id":"api/server-sdk-api","title":"\uc11c\ubc84 SDK API","description":"\uac8c\uc784 \uc11c\ubc84\uc5d0\uc11c Gatrix\uc640 \ud1b5\uc2e0\ud558\uae30 \uc704\ud55c SDK API \ubb38\uc11c\uc785\ub2c8\ub2e4.","source":"@site/i18n/ko/docusaurus-plugin-content-docs/current/api/server-sdk-api.md","sourceDirName":"api","slug":"/api/server-sdk-api","permalink":"/docs/ko/api/server-sdk-api","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/api/server-sdk-api.md","tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2,"sidebar_label":"\uc11c\ubc84 SDK API"},"sidebar":"tutorialSidebar","previous":{"title":"\ud074\ub77c\uc774\uc5b8\ud2b8 API","permalink":"/docs/ko/api/client-api"},"next":{"title":"Docker Deployment Guide","permalink":"/docs/ko/deployment/docker"}}'
      );
      var r = i(4848),
        s = i(8453);
      const a = { sidebar_position: 2, sidebar_label: '\uc11c\ubc84 SDK API' },
        c = '\uc11c\ubc84 SDK API',
        l = {},
        o = [
          { value: '\ucd08\uae30\ud654', id: '\ucd08\uae30\ud654', level: 2 },
          { value: '\uc8fc\uc694 \uae30\ub2a5', id: '\uc8fc\uc694-\uae30\ub2a5', level: 2 },
          {
            value: '1. \ud53c\ucc98 \ud50c\ub798\uadf8 \ud3c9\uac00',
            id: '1-\ud53c\ucc98-\ud50c\ub798\uadf8-\ud3c9\uac00',
            level: 3,
          },
          {
            value: '2. \uc810\uac80 \uc0c1\ud0dc \ud655\uc778',
            id: '2-\uc810\uac80-\uc0c1\ud0dc-\ud655\uc778',
            level: 3,
          },
          {
            value: '3. \ud654\uc774\ud2b8\ub9ac\uc2a4\ud2b8 \ud655\uc778',
            id: '3-\ud654\uc774\ud2b8\ub9ac\uc2a4\ud2b8-\ud655\uc778',
            level: 3,
          },
          { value: '\uc624\ub958 \ucc98\ub9ac', id: '\uc624\ub958-\ucc98\ub9ac', level: 2 },
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
                id: '\uc11c\ubc84-sdk-api',
                children: '\uc11c\ubc84 SDK API',
              }),
            }),
            '\n',
            (0, r.jsx)(n.p, {
              children:
                '\uac8c\uc784 \uc11c\ubc84\uc5d0\uc11c Gatrix\uc640 \ud1b5\uc2e0\ud558\uae30 \uc704\ud55c SDK API \ubb38\uc11c\uc785\ub2c8\ub2e4.',
            }),
            '\n',
            (0, r.jsx)(n.h2, { id: '\ucd08\uae30\ud654', children: '\ucd08\uae30\ud654' }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "import { GatrixClient } from '@gatrix/server-sdk';\n\nconst client = new GatrixClient({\n  apiKey: 'your-api-key',\n  environment: 'production'\n});\n",
              }),
            }),
            '\n',
            (0, r.jsx)(n.h2, {
              id: '\uc8fc\uc694-\uae30\ub2a5',
              children: '\uc8fc\uc694 \uae30\ub2a5',
            }),
            '\n',
            (0, r.jsx)(n.h3, {
              id: '1-\ud53c\ucc98-\ud50c\ub798\uadf8-\ud3c9\uac00',
              children: '1. \ud53c\ucc98 \ud50c\ub798\uadf8 \ud3c9\uac00',
            }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "const isEnabled = await client.getFeatureFlag('new_battle_mode', {\n  userId: 'player_1',\n  level: 50\n});\n",
              }),
            }),
            '\n',
            (0, r.jsx)(n.h3, {
              id: '2-\uc810\uac80-\uc0c1\ud0dc-\ud655\uc778',
              children: '2. \uc810\uac80 \uc0c1\ud0dc \ud655\uc778',
            }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "const maintenance = await client.getCurrentMaintenance();\nif (maintenance.isActive) {\n  console.log('\uc810\uac80 \uc911:', maintenance.message);\n}\n",
              }),
            }),
            '\n',
            (0, r.jsx)(n.h3, {
              id: '3-\ud654\uc774\ud2b8\ub9ac\uc2a4\ud2b8-\ud655\uc778',
              children: '3. \ud654\uc774\ud2b8\ub9ac\uc2a4\ud2b8 \ud655\uc778',
            }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "const isWhitelisted = await client.whitelist.isIpWhitelisted('1.2.3.4');\n",
              }),
            }),
            '\n',
            (0, r.jsx)(n.h2, {
              id: '\uc624\ub958-\ucc98\ub9ac',
              children: '\uc624\ub958 \ucc98\ub9ac',
            }),
            '\n',
            (0, r.jsx)(n.p, {
              children:
                'SDK\ub294 \ub124\ud2b8\uc6cc\ud06c \ud638\ucd9c \uc2e4\ud328 \uc2dc \uc9c0\uc218 \ubc31\uc624\ud504 \uc804\ub7b5\uc744 \uc0ac\uc6a9\ud558\uc5ec \uc790\ub3d9\uc73c\ub85c \uc7ac\uc2dc\ub3c4\ud569\ub2c8\ub2e4.',
            }),
            '\n',
            (0, r.jsx)(n.pre, {
              children: (0, r.jsx)(n.code, {
                className: 'language-typescript',
                children:
                  "try {\n  const flags = await client.getAllFlags(context);\n} catch (error) {\n  // \ucd5c\uc885 \uc2e4\ud328 \uc2dc \ucc98\ub9ac\n  console.error('SDK \ud638\ucd9c \uc2e4\ud328:', error);\n}\n",
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
  },
]);
