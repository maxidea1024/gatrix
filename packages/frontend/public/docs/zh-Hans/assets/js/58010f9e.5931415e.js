'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [1014],
  {
    1409(e, n, s) {
      (s.r(n),
        s.d(n, {
          assets: () => l,
          contentTitle: () => c,
          default: () => h,
          frontMatter: () => o,
          metadata: () => i,
          toc: () => d,
        }));
      const i = JSON.parse(
        '{"id":"monitoring/setup","title":"Monitoring Setup","description":"This page provides a quick entry point for setting up Prometheus and Grafana.","source":"@site/docs/monitoring/setup.md","sourceDirName":"monitoring","slug":"/monitoring/setup","permalink":"/docs/zh-Hans/monitoring/setup","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/monitoring/setup.md","tags":[],"version":"current","sidebarPosition":51,"frontMatter":{"slug":"/monitoring/setup","title":"Monitoring Setup","sidebar_position":51}}'
      );
      var t = s(4848),
        r = s(8453);
      const o = { slug: '/monitoring/setup', title: 'Monitoring Setup', sidebar_position: 51 },
        c = 'Monitoring Setup',
        l = {},
        d = [{ value: 'Quick Steps', id: 'quick-steps', level: 2 }];
      function a(e) {
        const n = {
          a: 'a',
          code: 'code',
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          ol: 'ol',
          p: 'p',
          pre: 'pre',
          ul: 'ul',
          ...(0, r.R)(),
          ...e.components,
        };
        return (0, t.jsxs)(t.Fragment, {
          children: [
            (0, t.jsx)(n.header, {
              children: (0, t.jsx)(n.h1, { id: 'monitoring-setup', children: 'Monitoring Setup' }),
            }),
            '\n',
            (0, t.jsx)(n.p, {
              children:
                'This page provides a quick entry point for setting up Prometheus and Grafana.',
            }),
            '\n',
            (0, t.jsxs)(n.p, {
              children: [
                'For the complete guide, see: ',
                (0, t.jsx)(n.a, {
                  href: '/features/monitoring',
                  children: '/docs/features/monitoring',
                }),
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: 'quick-steps', children: 'Quick Steps' }),
            '\n',
            (0, t.jsxs)(n.ol, {
              children: [
                '\n',
                (0, t.jsx)(n.li, {
                  children: 'Start the dev stack (Prometheus + Grafana included)',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-bash',
                children: 'docker compose -f docker-compose.dev.yml up -d\n',
              }),
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              start: '2',
              children: ['\n', (0, t.jsx)(n.li, { children: 'Access UIs' }), '\n'],
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    'Grafana: ',
                    (0, t.jsx)(n.a, {
                      href: 'http://localhost:44000',
                      children: 'http://localhost:44000',
                    }),
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    'Prometheus: ',
                    (0, t.jsx)(n.a, {
                      href: 'http://localhost:49090',
                      children: 'http://localhost:49090',
                    }),
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              start: '3',
              children: ['\n', (0, t.jsx)(n.li, { children: 'Enable metrics per service' }), '\n'],
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: ['Set ', (0, t.jsx)(n.code, { children: 'MONITORING_ENABLED=true' })],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: ['Default metrics path ', (0, t.jsx)(n.code, { children: '/metrics' })],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              start: '4',
              children: ['\n', (0, t.jsx)(n.li, { children: 'Service discovery' }), '\n'],
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    'Prometheus scrapes targets from Backend HTTP-SD endpoint:',
                    '\n',
                    (0, t.jsxs)(n.ul, {
                      children: [
                        '\n',
                        (0, t.jsx)(n.li, {
                          children: (0, t.jsx)(n.code, {
                            children: '/api/v1/public/monitoring/prometheus/targets',
                          }),
                        }),
                        '\n',
                      ],
                    }),
                    '\n',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              start: '5',
              children: ['\n', (0, t.jsx)(n.li, { children: 'Restart policy' }), '\n'],
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    'Use ',
                    (0, t.jsx)(n.code, { children: 'docker compose down' }),
                    ' then ',
                    (0, t.jsx)(n.code, { children: 'up' }),
                    ' (do not use ',
                    (0, t.jsx)(n.code, { children: 'restart' }),
                    ').',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsxs)(n.ol, {
              start: '6',
              children: ['\n', (0, t.jsx)(n.li, { children: 'Direct Log Push (SDK)' }), '\n'],
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    'Game servers now push logs directly to Loki via the ',
                    (0, t.jsx)(n.code, { children: '@gatrix/server-sdk' }),
                    '.',
                  ],
                }),
                '\n',
                (0, t.jsx)(n.li, {
                  children: 'This eliminates the need for Promtail or file scraping.',
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    'Configuration in ',
                    (0, t.jsx)(n.code, { children: 'mconf.ts' }),
                    ' (or ',
                    (0, t.jsx)(n.code, { children: 'default.json5' }),
                    '):',
                    '\n',
                    (0, t.jsx)(n.pre, {
                      children: (0, t.jsx)(n.code, {
                        className: 'language-json5',
                        children:
                          'gatrix: {\n  loki: {\n    enabled: true,\n    url: "http://localhost:43100/loki/api/v1/push"\n  }\n}\n',
                      }),
                    }),
                    '\n',
                  ],
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, r.R)(), ...e.components };
        return n ? (0, t.jsx)(n, { ...e, children: (0, t.jsx)(a, { ...e }) }) : a(e);
      }
    },
    8453(e, n, s) {
      s.d(n, { R: () => o, x: () => c });
      var i = s(6540);
      const t = {},
        r = i.createContext(t);
      function o(e) {
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
            : o(e.components)),
          i.createElement(r.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
