'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4039],
  {
    3752(e, n, s) {
      (s.r(n),
        s.d(n, {
          assets: () => a,
          contentTitle: () => c,
          default: () => h,
          frontMatter: () => d,
          metadata: () => r,
          toc: () => t,
        }));
      const r = JSON.parse(
        '{"id":"api/server-sdk-api","title":"Server SDK API \ubb38\uc11c","description":"\ubc31\uc5d4???\ufffd\ube44?\ufffd\ufffd? ?\ufffd\ubc84 ?\ufffd\ud50c\ub9ac\ufffd??\ufffd\uc158???\ufffd\ud55c ?\ufffd\ubc84 \ufffd?API ?\ufffd\ub4dc?\ufffd\uc778?\ufffd\uc785?\ufffd\ub2e4.","source":"@site/i18n/ko/docusaurus-plugin-content-docs/current/api/server-sdk-api.md","sourceDirName":"api","slug":"/api/server-sdk-api","permalink":"/docs/ko/api/server-sdk-api","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/api/server-sdk-api.md","tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"tutorialSidebar","previous":{"title":"?\ufffd\ub77c?\ufffd\uc5b8??API \ubb38\uc11c","permalink":"/docs/ko/api/client-api"},"next":{"title":"Docker Deployment Guide","permalink":"/docs/ko/deployment/docker"}}'
      );
      var i = s(4848),
        l = s(8453);
      const d = { sidebar_position: 3 },
        c = 'Server SDK API \ubb38\uc11c',
        a = {},
        t = [
          { value: '?\ufffd\uc9d5', id: '\uc9d5', level: 2 },
          { value: '?\ufffd\uc99d', id: '\uc99d', level: 2 },
          { value: 'API ?\ufffd\ub4dc?\ufffd\uc778??', id: 'api-\ub4dc\uc778', level: 2 },
          {
            value: '?\ufffd\uacbd\ufffd??\ufffd\ub4dc?\ufffd\uc778??',
            id: '\uacbd\ub4dc\uc778',
            level: 3,
          },
          { value: '1. \uac8c\uc784 ?\ufffd\ub4dc', id: '1-\uac8c\uc784-\ub4dc', level: 3 },
          { value: '?\ufffd\ub2f5', id: '\ub2f5', level: 4 },
          { value: '2. ?\ufffd\uc5c5 \uacf5\ufffd?', id: '2-\uc5c5-\uacf5', level: 3 },
          { value: '3. ?\ufffd\ubb38\uc870\uc0ac', id: '3-\ubb38\uc870\uc0ac', level: 3 },
          {
            value: '4. ?\ufffd\ube44???\ufffd\uc2a4\ucee4\ubc84\ufffd?',
            id: '4-\ube44\uc2a4\ucee4\ubc84',
            level: 3,
          },
          { value: '?\ufffd\ub2f5', id: '\ub2f5-1', level: 4 },
          { value: '5. ?\ufffd\uc99d ?\ufffd\uc2a4??', id: '5-\uc99d-\uc2a4', level: 3 },
          { value: '?\ufffd\ub2f5', id: '\ub2f5-2', level: 4 },
          {
            value: '6. ?\ufffd\ubc84 ?\ufffd\ud50c\ufffd?\uc870\ud68c',
            id: '6-\ubc84-\ud50c\uc870\ud68c',
            level: 3,
          },
          { value: '?\ufffd\ub2f5', id: '\ub2f5-3', level: 4 },
          { value: '3. \uba54\ud2b8\ufffd??\ufffd\ucd9c', id: '3-\uba54\ud2b8\ucd9c', level: 3 },
          { value: '?\ufffd\uccad \ubcf8\ubb38', id: '\uccad-\ubcf8\ubb38', level: 4 },
          { value: '?\ufffd\ub2f5', id: '\ub2f5-4', level: 4 },
          { value: '?\ufffd\ub958 ?\ufffd\ub2f5', id: '\ub958-\ub2f5', level: 2 },
          {
            value: '?\ufffd\ubc18?\ufffd\uc778 ?\ufffd\ub958 \ucf54\ub4dc',
            id: '\ubc18\uc778-\ub958-\ucf54\ub4dc',
            level: 3,
          },
          { value: '?\ufffd\uc6a9 ?\ufffd\uc81c', id: '\uc6a9-\uc81c', level: 2 },
          { value: 'Node.js ?\ufffd\uc81c', id: 'nodejs-\uc81c', level: 3 },
          { value: 'Rate Limits', id: 'rate-limits', level: 2 },
          { value: '\ubaa8\ubc94 ?\ufffd\ufffd?', id: '\ubaa8\ubc94-', level: 2 },
        ];
      function o(e) {
        const n = {
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          h4: 'h4',
          header: 'header',
          li: 'li',
          ol: 'ol',
          p: 'p',
          pre: 'pre',
          strong: 'strong',
          ul: 'ul',
          ...(0, l.R)(),
          ...e.components,
        };
        return (0, i.jsxs)(i.Fragment, {
          children: [
            (0, i.jsx)(n.header, {
              children: (0, i.jsx)(n.h1, {
                id: 'server-sdk-api-\ubb38\uc11c',
                children: 'Server SDK API \ubb38\uc11c',
              }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\ubc31\uc5d4???\ufffd\ube44?\ufffd\ufffd? ?\ufffd\ubc84 ?\ufffd\ud50c\ub9ac\ufffd??\ufffd\uc158???\ufffd\ud55c ?\ufffd\ubc84 \ufffd?API ?\ufffd\ub4dc?\ufffd\uc778?\ufffd\uc785?\ufffd\ub2e4.',
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: '\uc9d5', children: '?\ufffd\uc9d5' }),
            '\n',
            (0, i.jsxs)(n.ul, {
              children: [
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.strong, { children: 'API ?\ufffd\ud070 ?\ufffd\uc99d' }),
                    ': ?\ufffd\uc804???\ufffd\ubc84 \ufffd??\ufffd\uc2e0',
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    '**\uace0\uc131??*: ?\ufffd\ubc84 \ufffd??\ufffd\uc6a9??\ucd5c\uc801??- ',
                    (0, i.jsx)(n.strong, { children: 'Rate Limiting' }),
                    ': ?\ufffd\ubc84 ?\ufffd\ud50c\ub9ac\ufffd??\ufffd\uc158???\ufffd\ud569???\ufffd\ud55c',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: '\uc99d', children: '?\ufffd\uc99d' }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\ubaa8\ub4e0 Server SDK ?\ufffd\ub4dc?\ufffd\uc778?\ufffd\ub294 API ?\ufffd\ud070 ?\ufffd\uc99d???\ufffd\uc694?\ufffd\ub2c8??',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                children:
                  'Headers:\nX-API-Token: your-server-api-token\nX-Application-Name: your-application-name\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h2, {
              id: 'api-\ub4dc\uc778',
              children: 'API ?\ufffd\ub4dc?\ufffd\uc778??',
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '\uacbd\ub4dc\uc778',
              children: '?\ufffd\uacbd\ufffd??\ufffd\ub4dc?\ufffd\uc778??',
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\ubaa8\ub4e0 ?\ufffd\uacbd\ufffd??\ufffd\ub4dc?\ufffd\uc778?\ufffd\ub294 ?\ufffd\uc74c ?\ufffd\ud134???\ufffd\ub985?\ufffd\ub2e4:',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, { children: 'GET /api/v1/server/:env/resource\n' }),
            }),
            '\n',
            (0, i.jsxs)(n.p, {
              children: [
                (0, i.jsx)(n.code, { children: ':env' }),
                '???\ufffd\uacbd ID?\ufffd\ub2c8??(?? ',
                (0, i.jsx)(n.code, { children: 'development' }),
                ', ',
                (0, i.jsx)(n.code, { children: 'production' }),
                ', ',
                (0, i.jsx)(n.code, { children: 'qa' }),
                ').',
              ],
            }),
            '\n',
            (0, i.jsxs)(n.p, {
              children: [
                (0, i.jsx)(n.strong, { children: '\uc911\uc694:' }),
                ' \ufffd??\ufffd\ub4dc?\ufffd\uc778?\ufffd\ub294 \uc9c0?\ufffd\ub41c ?\ufffd\uacbd?\ufffd\ub85c ?\ufffd\ud130\ub9c1\ub41c ?\ufffd\uc774?\ufffd\ufffd? \ubc18\ud658?\ufffd\ub2c8??',
              ],
            }),
            '\n',
            (0, i.jsxs)(n.ul, {
              children: [
                '\n',
                (0, i.jsx)(n.li, {
                  children:
                    '\uac1c\ubc1c ?\ufffd\uacbd ?\ufffd\uccad?\ufffd\ub294 \uac1c\ubc1c ?\ufffd\uc774?\ufffd\ub9cc \ubc18\ud658?\ufffd\ub2c8??- ?\ufffd\ub85c?\ufffd\uc158 ?\ufffd\uacbd ?\ufffd\uccad?\ufffd\ub294 ?\ufffd\ub85c?\ufffd\uc158 ?\ufffd\uc774?\ufffd\ub9cc \ubc18\ud658?\ufffd\ub2c8??- ?\ufffd\uacbd \ufffd??\ufffd\uc774???\ufffd\ucd9c??\ubc1c\uc0dd?\ufffd\ufffd? ?\ufffd\uc2b5?\ufffd\ub2e4',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '1-\uac8c\uc784-\ub4dc',
              children: '1. \uac8c\uc784 ?\ufffd\ub4dc',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, { children: 'GET /api/v1/server/:env/game-worlds\n' }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\uc9c0?\ufffd\ub41c ?\ufffd\uacbd??\ubaa8\ub4e0 ?\ufffd\uc2dc \uac00?\ufffd\ud55c \uac8c\uc784 ?\ufffd\ub4dc\ufffd?\uc870\ud68c?\ufffd\ub2c8??',
            }),
            '\n',
            (0, i.jsx)(n.h4, { id: '\ub2f5', children: '?\ufffd\ub2f5' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "success": true,\n  "data": {\n    "worlds": [\n      {\n        "id": 1,\n        "worldId": "world-1",\n        "name": "\uba54\uc778 ?\ufffd\ubc84",\n        "worldServerAddress": "world1.example.com:7777",\n        "status": "active",\n        "hasMaintenanceScheduled": false,\n        "isMaintenanceActive": false\n      }\n    ]\n  }\n}\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, { id: '2-\uc5c5-\uacf5', children: '2. ?\ufffd\uc5c5 \uacf5\ufffd?' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                children: 'GET /api/v1/server/:env/ingame-popup-notices\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\uc9c0?\ufffd\ub41c ?\ufffd\uacbd???\ufffd\uc131 ?\ufffd\uc5c5 \uacf5\ufffd?\ufffd?\uc870\ud68c?\ufffd\ub2c8??',
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '3-\ubb38\uc870\uc0ac',
              children: '3. ?\ufffd\ubb38\uc870\uc0ac',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, { children: 'GET /api/v1/server/:env/surveys\n' }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\uc9c0?\ufffd\ub41c ?\ufffd\uacbd???\ufffd\uc131 ?\ufffd\ubb38\uc870\uc0ac\ufffd?\uc870\ud68c?\ufffd\ub2c8??',
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '4-\ube44\uc2a4\ucee4\ubc84',
              children: '4. ?\ufffd\ube44???\ufffd\uc2a4\ucee4\ubc84\ufffd?',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                children: 'GET /api/v1/server/:env/service-discovery\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\uc9c0?\ufffd\ub41c ?\ufffd\uacbd???\ufffd\uc774?\ufffd\ub9ac?\ufffd\ud2b8\ufffd??\ufffd\ud568???\ufffd\ube44???\ufffd\uc2a4\ucee4\ubc84\ufffd??\ufffd\uc774?\ufffd\ufffd? \uc870\ud68c?\ufffd\ub2c8??',
            }),
            '\n',
            (0, i.jsx)(n.h4, { id: '\ub2f5-1', children: '?\ufffd\ub2f5' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "success": true,\n  "data": {\n    "ipWhitelist": [\n      { "ip": "192.168.1.0/24", "description": "?\ufffd\ubb34???\ufffd\ud2b8?\ufffd\ud06c" }\n    ],\n    "accountWhitelist": [\n      { "accountId": "admin123", "description": "\uad00\ub9ac\uc790 \uacc4\uc815" }\n    ]\n  }\n}\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '5-\uc99d-\uc2a4',
              children: '5. ?\ufffd\uc99d ?\ufffd\uc2a4??',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, { children: 'GET /api/v1/server/test\n' }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children: '?\ufffd\ubc84 SDK ?\ufffd\uc99d???\ufffd\uc2a4?\ufffd\ud569?\ufffd\ub2e4.',
            }),
            '\n',
            (0, i.jsx)(n.h4, { id: '\ub2f5-2', children: '?\ufffd\ub2f5' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "success": true,\n  "message": "SDK authentication successful",\n  "data": {\n    "tokenId": "token-id",\n    "tokenName": "token-name",\n    "tokenType": "server",\n    "timestamp": "2024-01-01T00:00:00.000Z"\n  }\n}\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '6-\ubc84-\ud50c\uc870\ud68c',
              children: '6. ?\ufffd\ubc84 ?\ufffd\ud50c\ufffd?\uc870\ud68c',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, { children: 'GET /api/v1/server/templates\n' }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '?\ufffd\ubc84 \ufffd??\ufffd\uc6a9???\ufffd\ud55c ?\ufffd\uaca9 ?\ufffd\uc815 ?\ufffd\ud50c\ub9bf\uc744 \uc870\ud68c?\ufffd\ub2c8??',
            }),
            '\n',
            (0, i.jsx)(n.h4, { id: '\ub2f5-3', children: '?\ufffd\ub2f5' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "success": true,\n  "data": {\n    "templates": [\n      {\n        "id": 1,\n        "key": "feature_flag",\n        "name": "\uae30\ub2a5 ?\ufffd\ub798\ufffd?,\n        "type": "boolean",\n        "defaultValue": false,\n        "description": "\uae30\ub2a5 ?\ufffd\uc131??\ube44\ud65c?\ufffd\ud654"\n      }\n    ],\n    "etag": "abc123",\n    "timestamp": "2024-01-01T00:00:00.000Z"\n  }\n}\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '3-\uba54\ud2b8\ucd9c',
              children: '3. \uba54\ud2b8\ufffd??\ufffd\ucd9c',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, { children: 'POST /api/v1/server/metrics\n' }),
            }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '?\ufffd\ubc84 ?\ufffd\ud50c\ub9ac\ufffd??\ufffd\uc158?\ufffd\uc11c ?\ufffd\uc6a9 \uba54\ud2b8\ufffd?\ufffd\ufffd ?\ufffd\ucd9c?\ufffd\ub2c8??',
            }),
            '\n',
            (0, i.jsx)(n.h4, { id: '\uccad-\ubcf8\ubb38', children: '?\ufffd\uccad \ubcf8\ubb38' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "metrics": [\n    {\n      "configKey": "feature_flag",\n      "value": true,\n      "timestamp": "2024-01-01T00:00:00.000Z",\n      "metadata": {\n        "server_id": "server-001",\n        "environment": "production"\n      }\n    }\n  ]\n}\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h4, { id: '\ub2f5-4', children: '?\ufffd\ub2f5' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "success": true,\n  "message": "\uba54\ud2b8\ufffd?\ufffd\ufffd ?\ufffd\uacf5?\ufffd\uc73c\ufffd??\ufffd\ucd9c?\ufffd\uc5c8?\ufffd\ub2c8??,\n  "data": {\n    "processed": 1,\n    "timestamp": "2024-01-01T00:00:00.000Z"\n  }\n}\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: '\ub958-\ub2f5', children: '?\ufffd\ub958 ?\ufffd\ub2f5' }),
            '\n',
            (0, i.jsx)(n.p, {
              children:
                '\ubaa8\ub4e0 ?\ufffd\ub4dc?\ufffd\uc778?\ufffd\ub294 ?\ufffd\ufffd??\ufffd\ub41c ?\ufffd\ub958 ?\ufffd\ub2f5??\ubc18\ud658?\ufffd\ub2c8??',
            }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "success": false,\n  "error": {\n    "message": "?\ufffd\ub958 ?\ufffd\uba85",\n    "code": "ERROR_CODE"\n  }\n}\n',
              }),
            }),
            '\n',
            (0, i.jsx)(n.h3, {
              id: '\ubc18\uc778-\ub958-\ucf54\ub4dc',
              children: '?\ufffd\ubc18?\ufffd\uc778 ?\ufffd\ub958 \ucf54\ub4dc',
            }),
            '\n',
            (0, i.jsxs)(n.ul, {
              children: [
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.code, { children: 'INVALID_API_TOKEN' }),
                    ': ?\ufffd\ud6a8?\ufffd\ufffd? ?\ufffd\uac70???\ufffd\ub77d??API ?\ufffd\ud070',
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.code, { children: 'INSUFFICIENT_PERMISSIONS' }),
                    ': ?\ufffd\ud070???\ufffd\uc694??\uad8c\ud55c???\ufffd\uc74c',
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.code, { children: 'RATE_LIMIT_EXCEEDED' }),
                    ': ?\ufffd\uccad???\ufffd\ubb34 \ub9ce\uc74c',
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.code, { children: 'ENVIRONMENT_NOT_FOUND' }),
                    ': ?\ufffd\uacbd??\ucc3e\uc744 ???\ufffd\uc74c',
                  ],
                }),
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.code, { children: 'VALIDATION_ERROR' }),
                    ': ?\ufffd\uccad \uac80\ufffd??\ufffd\ud328',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: '\uc6a9-\uc81c', children: '?\ufffd\uc6a9 ?\ufffd\uc81c' }),
            '\n',
            (0, i.jsx)(n.h3, { id: 'nodejs-\uc81c', children: 'Node.js ?\ufffd\uc81c' }),
            '\n',
            (0, i.jsx)(n.pre, {
              children: (0, i.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "const axios = require('axios');\n\nconst serverSDK = {\n  baseURL: 'https://api.example.com/api/v1/server',\n  apiKey: 'your-server-api-token',\n  appName: 'your-app-name',\n\n  async getTemplates() {\n    try {\n      const response = await axios.get(`${this.baseURL}/templates`, {\n        headers: {\n          'X-API-Token': this.apiKey,\n          'X-Application-Name': this.appName,\n          'Content-Type': 'application/json'\n        }\n      });\n      return response.data;\n    } catch (error) {\n      console.error('?\ufffd\ud50c\ufffd?\uc870\ud68c ?\ufffd\ub958:', error.response?.data);\n      throw error;\n    }\n  },\n\n  async submitMetrics(metrics) {\n    try {\n      const response = await axios.post(`${this.baseURL}/metrics`, \n        { metrics },\n        {\n          headers: {\n            'X-API-Key': this.apiKey,\n            'X-Application-Name': this.appName,\n            'Content-Type': 'application/json'\n          }\n        }\n      );\n      return response.data;\n    } catch (error) {\n      console.error('\uba54\ud2b8\ufffd??\ufffd\ucd9c ?\ufffd\ub958:', error.response?.data);\n      throw error;\n    }\n  }\n};\n\n// ?\ufffd\uc6a9\ufffd?async function main() {\n  try {\n    const templates = await serverSDK.getTemplates();\n    console.log('?\ufffd\ud50c\ufffd?', templates);\n\n    await serverSDK.submitMetrics([\n      {\n        configKey: 'feature_flag',\n        value: true,\n        timestamp: new Date().toISOString(),\n        metadata: { server_id: 'server-001' }\n      }\n    ]);\n  } catch (error) {\n    console.error('SDK ?\ufffd\ub958:', error);\n  }\n}\n",
              }),
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: 'rate-limits', children: 'Rate Limits' }),
            '\n',
            (0, i.jsxs)(n.ul, {
              children: [
                '\n',
                (0, i.jsx)(n.li, {
                  children: '**?\ufffd\ud50c\ufffd?*: \ubd84\ub2f9 1000???\ufffd\uccad',
                }),
                '\n',
                (0, i.jsx)(n.li, {
                  children: '**\uba54\ud2b8\ufffd?*: \ubd84\ub2f9 10000???\ufffd\uccad',
                }),
                '\n',
                (0, i.jsx)(n.li, {
                  children: '**?\ufffd\uc2a4??*: \ubd84\ub2f9 100???\ufffd\uccad',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(n.h2, { id: '\ubaa8\ubc94-', children: '\ubaa8\ubc94 ?\ufffd\ufffd?' }),
            '\n',
            (0, i.jsxs)(n.ol, {
              children: [
                '\n',
                (0, i.jsxs)(n.li, {
                  children: [
                    (0, i.jsx)(n.strong, { children: '?\ufffd\ud50c\ufffd?\uce90\uc2f1' }),
                    ': ETag\ufffd??\ufffd\uc6a9?\ufffd\uc5ec ?\ufffd\ud50c\ufffd??\ufffd\ub2f5??\uce90\uc2dc?\ufffd\uc138??2. ',
                    (0, i.jsx)(n.strong, { children: '\uba54\ud2b8\ufffd?\ubc30\uce58' }),
                    ': ?\ufffd\ub2a5 ?\ufffd\uc0c1???\ufffd\ud574 \uba54\ud2b8\ufffd?\ufffd\ufffd \ubc30\uce58\ufffd??\ufffd\ucd9c?\ufffd\uc138??3. ',
                    (0, i.jsx)(n.strong, { children: '?\ufffd\ub958 \ucc98\ub9ac' }),
                    ': \uc9c0??\ubc31\uc624?\ufffd\ufffd? ?\ufffd\uc6a9???\ufffd\uc808???\ufffd\uc2dc??\ub85c\uc9c1??\uad6c\ud604?\ufffd\uc138??4. ',
                    (0, i.jsx)(n.strong, { children: '?\ufffd\ud070 \ubcf4\uc548' }),
                    ': API ?\ufffd\ud070???\ufffd\uc804?\ufffd\uac8c ?\ufffd?\ufffd\ud558\ufffd??\ufffd\uae30?\ufffd\uc73c\ufffd?\uad50\uccb4?\ufffd\uc138??5. ',
                    (0, i.jsx)(n.strong, { children: '\ubaa8\ub2c8?\ufffd\ub9c1' }),
                    ': API ?\ufffd\uc6a9?\ufffd\uacfc ?\ufffd\ub2f5 ?\ufffd\uac04??\ubaa8\ub2c8?\ufffd\ub9c1?\ufffd\uc138??',
                  ],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, l.R)(), ...e.components };
        return n ? (0, i.jsx)(n, { ...e, children: (0, i.jsx)(o, { ...e }) }) : o(e);
      }
    },
    8453(e, n, s) {
      s.d(n, { R: () => d, x: () => c });
      var r = s(6540);
      const i = {},
        l = r.createContext(i);
      function d(e) {
        const n = r.useContext(l);
        return r.useMemo(
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
              ? e.components(i)
              : e.components || i
            : d(e.components)),
          r.createElement(l.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
