'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [9325],
  {
    1180(e, n, r) {
      (r.r(n),
        r.d(n, {
          assets: () => d,
          contentTitle: () => u,
          default: () => m,
          frontMatter: () => c,
          metadata: () => a,
          toc: () => h,
        }));
      var a = r(1632),
        t = r(4848),
        s = r(8453),
        i = r(1470),
        l = r(9365),
        o = r(4907);
      const c = {
          slug: 'real-time-chat-server-setup',
          title: 'Gatrix Real-time Chat Server Setup Guide',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'chat', 'tutorial', 'setup'],
        },
        u = void 0,
        d = { authorsImageUrls: [void 0] },
        h = [
          {
            value: '\ud83d\ude80 Chat Server Architecture',
            id: '-chat-server-architecture',
            level: 2,
          },
          { value: '\ud83d\udce6 Installation and Setup', id: '-installation-and-setup', level: 2 },
          { value: '1. Basic Installation', id: '1-basic-installation', level: 3 },
          { value: '2. Environment Variables', id: '2-environment-variables', level: 3 },
          { value: '\ud83d\udd27 Core Features', id: '-core-features', level: 2 },
          { value: '1. Channel Management', id: '1-channel-management', level: 3 },
          { value: '2. Message Sending', id: '2-message-sending', level: 3 },
          {
            value: '\ud83d\udcca Performance Optimization',
            id: '-performance-optimization',
            level: 2,
          },
          { value: 'Redis Cluster Configuration', id: 'redis-cluster-configuration', level: 3 },
          { value: '\ud83c\udfaf Conclusion', id: '-conclusion', level: 2 },
        ];
      function p(e) {
        const n = {
          a: 'a',
          code: 'code',
          h2: 'h2',
          h3: 'h3',
          hr: 'hr',
          li: 'li',
          p: 'p',
          pre: 'pre',
          strong: 'strong',
          ul: 'ul',
          ...(0, s.R)(),
          ...e.components,
        };
        return (0, t.jsxs)(t.Fragment, {
          children: [
            (0, t.jsx)(n.p, {
              children:
                "Gatrix's real-time chat server uses Socket.IO and Redis clustering to provide high-performance messaging. This guide will walk you through setting up and optimizing the chat server step by step.",
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-chat-server-architecture',
              children: '\ud83d\ude80 Chat Server Architecture',
            }),
            '\n',
            (0, t.jsx)(n.p, {
              children: 'Gatrix chat server provides the following advanced features:',
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Socket.IO Based' }),
                    ': Automatically handles WebSockets and polling',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Redis Clustering' }),
                    ': Synchronization across multiple instances',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Message Broadcasting' }),
                    ': Capable of handling 100,000+ messages/sec',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Real-time Monitoring' }),
                    ': Prometheus metrics collection',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Auto-scaling' }),
                    ': Supports horizontal scaling out of the box',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-installation-and-setup',
              children: '\ud83d\udce6 Installation and Setup',
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: '1-basic-installation', children: '1. Basic Installation' }),
            '\n',
            (0, t.jsxs)(i.A, {
              children: [
                (0, t.jsx)(l.A, {
                  value: 'npm',
                  label: 'npm',
                  default: !0,
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-bash',
                      children:
                        '# Navigate to chat server package\r\ncd packages/chat-server\r\n\r\n# Install dependencies\r\nnpm install\r\n\r\n# Setup environment variables\r\ncp .env.example .env\n',
                    }),
                  }),
                }),
                (0, t.jsx)(l.A, {
                  value: 'yarn',
                  label: 'yarn',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-bash',
                      children:
                        '# Navigate to chat server package\r\ncd packages/chat-server\r\n\r\n# Install dependencies\r\nyarn install\r\n\r\n# Setup environment variables\r\ncp .env.example .env\n',
                    }),
                  }),
                }),
                (0, t.jsx)(l.A, {
                  value: 'docker',
                  label: 'Docker',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-bash',
                      children:
                        '# Run full stack with Docker Compose\r\ndocker-compose up -d\r\n\r\n# Or run chat server only\r\ndocker-compose up chat-server\n',
                    }),
                  }),
                }),
              ],
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '2-environment-variables',
              children: '2. Environment Variables',
            }),
            '\n',
            (0, t.jsx)(o.A, {
              language: 'bash',
              children:
                '# Server Settings\nNODE_ENV=production\nPORT=3001\nHOST=0.0.0.0\n\n# Database\nDB_HOST=localhost\nDB_PORT=3306\nDB_NAME=gatrix_chat\nDB_USER=chat_user\nDB_PASSWORD=your_password\n\n# Redis Cluster\nREDIS_HOST=localhost\nREDIS_PORT=6379\nREDIS_PASSWORD=your_redis_password\n\n# Gatrix Main Server Integration\nGATRIX_API_URL=http://localhost:5000\nGATRIX_API_SECRET=shared_secret\n\n# Performance Tuning\nCLUSTER_ENABLED=true\nWS_MAX_CONNECTIONS=10000\nBROADCAST_BATCH_SIZE=1000',
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: '-core-features', children: '\ud83d\udd27 Core Features' }),
            '\n',
            (0, t.jsx)(n.h3, { id: '1-channel-management', children: '1. Channel Management' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// Join channel with WebSocket\r\nsocket.emit('join_channel', {\r\n  channelId: 'channel_123',\r\n  userId: 'user_456'\r\n});\n",
              }),
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: '2-message-sending', children: '2. Message Sending' }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// Send message\r\nsocket.emit('send_message', {\r\n  channelId: 'channel_123',\r\n  content: 'Hello!',\r\n  type: 'text'\r\n});\n",
              }),
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-performance-optimization',
              children: '\ud83d\udcca Performance Optimization',
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: 'redis-cluster-configuration',
              children: 'Redis Cluster Configuration',
            }),
            '\n',
            (0, t.jsx)(n.pre, {
              children: (0, t.jsx)(n.code, {
                className: 'language-yaml',
                children:
                  "# docker-compose.yml\r\nversion: '3.8'\r\nservices:\r\n  redis-cluster:\r\n    image: redis:7-alpine\r\n    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes\n",
              }),
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: '-conclusion', children: '\ud83c\udfaf Conclusion' }),
            '\n',
            (0, t.jsx)(n.p, {
              children:
                'Gatrix chat server provides a complete solution for high-performance real-time communication.',
            }),
            '\n',
            (0, t.jsx)(n.hr, {}),
            '\n',
            (0, t.jsxs)(n.p, {
              children: [(0, t.jsx)(n.strong, { children: 'Related Resources' }), ':'],
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsx)(n.li, {
                  children: (0, t.jsx)(n.a, {
                    href: '../../api/client-api',
                    children: 'API Documentation',
                  }),
                }),
                '\n',
                (0, t.jsx)(n.li, {
                  children: (0, t.jsx)(n.a, {
                    href: 'https://github.com/motifgames/gatrix',
                    children: 'GitHub Repository',
                  }),
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function m(e = {}) {
        const { wrapper: n } = { ...(0, s.R)(), ...e.components };
        return n ? (0, t.jsx)(n, { ...e, children: (0, t.jsx)(p, { ...e }) }) : p(e);
      }
    },
    1470(e, n, r) {
      r.d(n, { A: () => y });
      var a = r(6540),
        t = r(4164),
        s = r(3104),
        i = r(6347),
        l = r(205),
        o = r(7485),
        c = r(1682),
        u = r(679);
      function d(e) {
        return (
          a.Children.toArray(e)
            .filter((e) => '\n' !== e)
            .map((e) => {
              if (
                !e ||
                ((0, a.isValidElement)(e) &&
                  (function (e) {
                    const { props: n } = e;
                    return !!n && 'object' == typeof n && 'value' in n;
                  })(e))
              )
                return e;
              throw new Error(
                `Docusaurus error: Bad <Tabs> child <${'string' == typeof e.type ? e.type : e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`
              );
            })
            ?.filter(Boolean) ?? []
        );
      }
      function h(e) {
        const { values: n, children: r } = e;
        return (0, a.useMemo)(() => {
          const e =
            n ??
            (function (e) {
              return d(e).map(({ props: { value: e, label: n, attributes: r, default: a } }) => ({
                value: e,
                label: n,
                attributes: r,
                default: a,
              }));
            })(r);
          return (
            (function (e) {
              const n = (0, c.XI)(e, (e, n) => e.value === n.value);
              if (n.length > 0)
                throw new Error(
                  `Docusaurus error: Duplicate values "${n.map((e) => e.value).join(', ')}" found in <Tabs>. Every value needs to be unique.`
                );
            })(e),
            e
          );
        }, [n, r]);
      }
      function p({ value: e, tabValues: n }) {
        return n.some((n) => n.value === e);
      }
      function m({ queryString: e = !1, groupId: n }) {
        const r = (0, i.W6)(),
          t = (function ({ queryString: e = !1, groupId: n }) {
            if ('string' == typeof e) return e;
            if (!1 === e) return null;
            if (!0 === e && !n)
              throw new Error(
                'Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".'
              );
            return n ?? null;
          })({ queryString: e, groupId: n });
        return [
          (0, o.aZ)(t),
          (0, a.useCallback)(
            (e) => {
              if (!t) return;
              const n = new URLSearchParams(r.location.search);
              (n.set(t, e), r.replace({ ...r.location, search: n.toString() }));
            },
            [t, r]
          ),
        ];
      }
      function g(e) {
        const { defaultValue: n, queryString: r = !1, groupId: t } = e,
          s = h(e),
          [i, o] = (0, a.useState)(() =>
            (function ({ defaultValue: e, tabValues: n }) {
              if (0 === n.length)
                throw new Error(
                  'Docusaurus error: the <Tabs> component requires at least one <TabItem> children component'
                );
              if (e) {
                if (!p({ value: e, tabValues: n }))
                  throw new Error(
                    `Docusaurus error: The <Tabs> has a defaultValue "${e}" but none of its children has the corresponding value. Available values are: ${n.map((e) => e.value).join(', ')}. If you intend to show no default tab, use defaultValue={null} instead.`
                  );
                return e;
              }
              const r = n.find((e) => e.default) ?? n[0];
              if (!r) throw new Error('Unexpected error: 0 tabValues');
              return r.value;
            })({ defaultValue: n, tabValues: s })
          ),
          [c, d] = m({ queryString: r, groupId: t }),
          [g, v] = (function ({ groupId: e }) {
            const n = (function (e) {
                return e ? `docusaurus.tab.${e}` : null;
              })(e),
              [r, t] = (0, u.Dv)(n);
            return [
              r,
              (0, a.useCallback)(
                (e) => {
                  n && t.set(e);
                },
                [n, t]
              ),
            ];
          })({ groupId: t }),
          b = (() => {
            const e = c ?? g;
            return p({ value: e, tabValues: s }) ? e : null;
          })();
        (0, l.A)(() => {
          b && o(b);
        }, [b]);
        return {
          selectedValue: i,
          selectValue: (0, a.useCallback)(
            (e) => {
              if (!p({ value: e, tabValues: s }))
                throw new Error(`Can't select invalid tab value=${e}`);
              (o(e), d(e), v(e));
            },
            [d, v, s]
          ),
          tabValues: s,
        };
      }
      var v = r(2303);
      const b = 'tabList__CuJ',
        x = 'tabItem_LNqP';
      var f = r(4848);
      function j({ className: e, block: n, selectedValue: r, selectValue: a, tabValues: i }) {
        const l = [],
          { blockElementScrollPositionUntilNextRender: o } = (0, s.a_)(),
          c = (e) => {
            const n = e.currentTarget,
              t = l.indexOf(n),
              s = i[t].value;
            s !== r && (o(n), a(s));
          },
          u = (e) => {
            let n = null;
            switch (e.key) {
              case 'Enter':
                c(e);
                break;
              case 'ArrowRight': {
                const r = l.indexOf(e.currentTarget) + 1;
                n = l[r] ?? l[0];
                break;
              }
              case 'ArrowLeft': {
                const r = l.indexOf(e.currentTarget) - 1;
                n = l[r] ?? l[l.length - 1];
                break;
              }
            }
            n?.focus();
          };
        return (0, f.jsx)('ul', {
          role: 'tablist',
          'aria-orientation': 'horizontal',
          className: (0, t.A)('tabs', { 'tabs--block': n }, e),
          children: i.map(({ value: e, label: n, attributes: a }) =>
            (0, f.jsx)(
              'li',
              {
                role: 'tab',
                tabIndex: r === e ? 0 : -1,
                'aria-selected': r === e,
                ref: (e) => {
                  l.push(e);
                },
                onKeyDown: u,
                onClick: c,
                ...a,
                className: (0, t.A)('tabs__item', x, a?.className, {
                  'tabs__item--active': r === e,
                }),
                children: n ?? e,
              },
              e
            )
          ),
        });
      }
      function S({ lazy: e, children: n, selectedValue: r }) {
        const s = (Array.isArray(n) ? n : [n]).filter(Boolean);
        if (e) {
          const e = s.find((e) => e.props.value === r);
          return e
            ? (0, a.cloneElement)(e, { className: (0, t.A)('margin-top--md', e.props.className) })
            : null;
        }
        return (0, f.jsx)('div', {
          className: 'margin-top--md',
          children: s.map((e, n) =>
            (0, a.cloneElement)(e, { key: n, hidden: e.props.value !== r })
          ),
        });
      }
      function k(e) {
        const n = g(e);
        return (0, f.jsxs)('div', {
          className: (0, t.A)('tabs-container', b),
          children: [(0, f.jsx)(j, { ...n, ...e }), (0, f.jsx)(S, { ...n, ...e })],
        });
      }
      function y(e) {
        const n = (0, v.A)();
        return (0, f.jsx)(k, { ...e, children: d(e.children) }, String(n));
      }
    },
    1632(e) {
      e.exports = JSON.parse(
        '{"permalink":"/docs/ko/blog/real-time-chat-server-setup","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2021-08-01-mdx-blog-post.mdx","source":"@site/blog/2021-08-01-mdx-blog-post.mdx","title":"Gatrix Real-time Chat Server Setup Guide","description":"Gatrix\'s real-time chat server uses Socket.IO and Redis clustering to provide high-performance messaging. This guide will walk you through setting up and optimizing the chat server step by step.","date":"2021-08-01T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/ko/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":false,"label":"Chat","permalink":"/docs/ko/blog/tags/chat","description":"Real-time chat server features"},{"inline":false,"label":"Tutorial","permalink":"/docs/ko/blog/tags/tutorial","description":"Step-by-step tutorials and guides"},{"inline":false,"label":"Setup","permalink":"/docs/ko/blog/tags/setup","description":"Installation and configuration guides"}],"readingTime":1.62,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/ko/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"real-time-chat-server-setup","title":"Gatrix Real-time Chat Server Setup Guide","authors":["gatrix-team"],"tags":["gatrix","chat","tutorial","setup"]},"unlisted":false,"prevItem":{"title":"Gatrix API Integration and Webhook Setup Guide","permalink":"/docs/ko/blog/api-integration-webhooks"},"nextItem":{"title":"Mastering Gatrix Job Management System","permalink":"/docs/ko/blog/mastering-job-management-system"}}'
      );
    },
    9365(e, n, r) {
      r.d(n, { A: () => i });
      r(6540);
      var a = r(4164);
      const t = 'tabItem_Ymn6';
      var s = r(4848);
      function i({ children: e, hidden: n, className: r }) {
        return (0, s.jsx)('div', {
          role: 'tabpanel',
          className: (0, a.A)(t, r),
          hidden: n,
          children: e,
        });
      }
    },
  },
]);
