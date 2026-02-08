'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [9353],
  {
    6376(e, n, s) {
      (s.r(n),
        s.d(n, {
          assets: () => a,
          contentTitle: () => c,
          default: () => h,
          frontMatter: () => l,
          metadata: () => i,
          toc: () => d,
        }));
      const i = JSON.parse(
        '{"id":"api/client-api","title":"Client API","description":"API for game clients to access Gatrix features.","source":"@site/docs/api/client-api.md","sourceDirName":"api","slug":"/api/client-api","permalink":"/docs/api/client-api","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/api/client-api.md","tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1,"sidebar_label":"Client API"},"sidebar":"tutorialSidebar","previous":{"title":"New Relic","permalink":"/docs/integrations/new-relic"},"next":{"title":"Server SDK API","permalink":"/docs/api/server-sdk-api"}}'
      );
      var t = s(4848),
        r = s(8453);
      const l = { sidebar_position: 1, sidebar_label: 'Client API' },
        c = 'Client API',
        a = {},
        d = [
          { value: 'Base URL', id: 'base-url', level: 2 },
          { value: 'Authentication', id: 'authentication', level: 2 },
          { value: 'Endpoints', id: 'endpoints', level: 2 },
          { value: 'Get Feature Flags', id: 'get-feature-flags', level: 3 },
          { value: 'Get Notices', id: 'get-notices', level: 3 },
          { value: 'Redeem Coupon', id: 'redeem-coupon', level: 3 },
          { value: 'Check Version', id: 'check-version', level: 3 },
          { value: 'Get Status', id: 'get-status', level: 3 },
        ];
      function o(e) {
        const n = {
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          header: 'header',
          li: 'li',
          p: 'p',
          pre: 'pre',
          ul: 'ul',
          ...(0, r.R)(),
          ...e.components,
        };
        return (0, t.jsxs)(t.Fragment, {
          children: [
            (0, t.jsx)(n.header, {
              children: (0, t.jsx)(n.h1, { id: 'client-api', children: 'Client API' }),
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'API for game clients to access Gatrix features.' }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'base-url', children: 'Base URL' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, { children: 'https://your-edge-server:3400/api/v1\n' }),
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'authentication', children: 'Authentication' }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Include the API key in the request header:' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, { children: 'X-API-Key: your-client-api-key\n' }),
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'endpoints', children: 'Endpoints' }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'get-feature-flags', children: 'Get Feature Flags' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-http',
                children: 'GET /flags\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Query parameters:' }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.code, { children: 'context' }),
                    ' - JSON-encoded context object',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Response:' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "flags": {\n    "dark_mode": true,\n    "max_items": 50,\n    "welcome_message": "Hello!"\n  }\n}\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'get-notices', children: 'Get Notices' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-http',
                children: 'GET /notices\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Query parameters:' }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.code, { children: 'category' }),
                    ' - Filter by category (optional)',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.code, { children: 'limit' }),
                    ' - Max results (default: 20)',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Response:' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "notices": [\n    {\n      "id": "1",\n      "title": "Maintenance Notice",\n      "content": "...",\n      "category": "maintenance",\n      "startDate": "2024-01-15T00:00:00Z",\n      "endDate": "2024-01-15T06:00:00Z"\n    }\n  ]\n}\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'redeem-coupon', children: 'Redeem Coupon' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-http',
                children: 'POST /coupons/redeem\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Request:' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children: '{\n  "code": "SUMMER2024",\n  "userId": "user123"\n}\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Response:' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "success": true,\n  "rewards": [\n    { "type": "item", "id": "item_001", "quantity": 1 }\n  ]\n}\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'check-version', children: 'Check Version' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-http',
                children: 'GET /client-version\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Query parameters:' }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.code, { children: 'platform' }),
                    ' - ios, android, windows, mac',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.code, { children: 'version' }),
                    ' - Current client version',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Response:' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "needsUpdate": true,\n  "forceUpdate": false,\n  "latestVersion": "1.3.0",\n  "updateUrl": "https://..."\n}\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: 'get-status', children: 'Get Status' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-http',
                children: 'GET /status\n',
              }),
            }),
            '\n',
            (0, t.jsx)(n.p, { children: 'Response:' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-json',
                children: '{\n  "maintenance": false,\n  "message": null\n}\n',
              }),
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, r.R)(), ...e.components };
        return n ? (0, t.jsx)(n, { ...e, children: (0, t.jsx)(o, { ...e }) }) : o(e);
      }
    },
    8453(e, n, s) {
      s.d(n, { R: () => l, x: () => c });
      var i = s(6540);
      const t = {},
        r = i.createContext(t);
      function l(e) {
        const n = i.useContext(r);
        return i.useMemo(
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
              ? e.components(t)
              : e.components || t
            : l(e.components)),
          i.createElement(r.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
