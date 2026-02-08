'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [9325],
  {
    1180(e, n, r) {
      (r.r(n),
        r.d(n, {
          Highlight: () => h,
          assets: () => u,
          contentTitle: () => d,
          default: () => g,
          frontMatter: () => o,
          metadata: () => a,
          toc: () => p,
        }));
      var a = r(1632),
        t = r(4848),
        s = r(8453),
        l = r(1470),
        i = r(9365),
        c = r(4907);
      const o = {
          slug: 'real-time-chat-server-setup',
          title:
            'Gatrix \uc2e4\uc2dc\uac04 \ucc44\ud305 \uc11c\ubc84 \uc644\uc804 \uc124\uc815 \uac00\uc774\ub4dc',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'chat', 'tutorial', 'setup'],
        },
        d = void 0,
        u = { authorsImageUrls: [void 0] },
        h = ({ children: e, color: n }) =>
          (0, t.jsx)('span', {
            style: { backgroundColor: n, borderRadius: '2px', color: '#fff', padding: '0.2rem' },
            children: e,
          }),
        p = [
          {
            value: '\ud83d\ude80 \ucc44\ud305 \uc11c\ubc84 \uc544\ud0a4\ud14d\ucc98',
            id: '-\ucc44\ud305-\uc11c\ubc84-\uc544\ud0a4\ud14d\ucc98',
            level: 2,
          },
          {
            value: '\ud83d\udce6 \uc124\uce58 \ubc0f \uc124\uc815',
            id: '-\uc124\uce58-\ubc0f-\uc124\uc815',
            level: 2,
          },
          { value: '1. \uae30\ubcf8 \uc124\uce58', id: '1-\uae30\ubcf8-\uc124\uce58', level: 3 },
          {
            value: '2. \ud658\uacbd \ubcc0\uc218 \uc124\uc815',
            id: '2-\ud658\uacbd-\ubcc0\uc218-\uc124\uc815',
            level: 3,
          },
          {
            value: '\ud83d\udd27 \ud575\uc2ec \uae30\ub2a5 \uc124\uc815',
            id: '-\ud575\uc2ec-\uae30\ub2a5-\uc124\uc815',
            level: 2,
          },
          { value: '1. \ucc44\ub110 \uad00\ub9ac', id: '1-\ucc44\ub110-\uad00\ub9ac', level: 3 },
          {
            value: '2. \uba54\uc2dc\uc9c0 \uc804\uc1a1',
            id: '2-\uba54\uc2dc\uc9c0-\uc804\uc1a1',
            level: 3,
          },
          {
            value: '3. \uc2e4\uc2dc\uac04 \uae30\ub2a5',
            id: '3-\uc2e4\uc2dc\uac04-\uae30\ub2a5',
            level: 3,
          },
          {
            value: '\ud83d\udcca \uc131\ub2a5 \ucd5c\uc801\ud654',
            id: '-\uc131\ub2a5-\ucd5c\uc801\ud654',
            level: 2,
          },
          {
            value: '1. \uba54\uc2dc\uc9c0 \ube0c\ub85c\ub4dc\uce90\uc2a4\ud305 \ucd5c\uc801\ud654',
            id: '1-\uba54\uc2dc\uc9c0-\ube0c\ub85c\ub4dc\uce90\uc2a4\ud305-\ucd5c\uc801\ud654',
            level: 3,
          },
          {
            value: '2. Redis \ud074\ub7ec\uc2a4\ud130 \uc124\uc815',
            id: '2-redis-\ud074\ub7ec\uc2a4\ud130-\uc124\uc815',
            level: 3,
          },
          {
            value: '3. \ubaa8\ub2c8\ud130\ub9c1 \uc124\uc815',
            id: '3-\ubaa8\ub2c8\ud130\ub9c1-\uc124\uc815',
            level: 3,
          },
          {
            value: '\ud83d\udd12 \ubcf4\uc548 \uc124\uc815',
            id: '-\ubcf4\uc548-\uc124\uc815',
            level: 2,
          },
          { value: '1. JWT \uc778\uc99d', id: '1-jwt-\uc778\uc99d', level: 3 },
          { value: '2. Rate Limiting', id: '2-rate-limiting', level: 3 },
          {
            value: '\ud83d\ude80 \ubc30\ud3ec \ubc0f \ud655\uc7a5',
            id: '-\ubc30\ud3ec-\ubc0f-\ud655\uc7a5',
            level: 2,
          },
          { value: '1. Docker \ubc30\ud3ec', id: '1-docker-\ubc30\ud3ec', level: 3 },
          {
            value: '2. \ub85c\ub4dc \ubc38\ub7f0\uc2f1',
            id: '2-\ub85c\ub4dc-\ubc38\ub7f0\uc2f1',
            level: 3,
          },
          { value: '\ud83c\udfaf \uacb0\ub860', id: '-\uacb0\ub860', level: 2 },
        ];
      function m(e) {
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
                'Gatrix\uc758 \uc2e4\uc2dc\uac04 \ucc44\ud305 \uc11c\ubc84\ub294 Socket.IO\uc640 Redis \ud074\ub7ec\uc2a4\ud130\ub9c1\uc744 \uc0ac\uc6a9\ud558\uc5ec \uace0\uc131\ub2a5 \uba54\uc2dc\uc9d5\uc744 \uc81c\uacf5\ud569\ub2c8\ub2e4. \uc774 \uac00\uc774\ub4dc\uc5d0\uc11c\ub294 \ucc44\ud305 \uc11c\ubc84\ub97c \uc124\uc815\ud558\uace0 \ucd5c\uc801\ud654\ud558\ub294 \ubc29\ubc95\uc744 \ub2e8\uacc4\ubcc4\ub85c \uc54c\uc544\ubcf4\uaca0\uc2b5\ub2c8\ub2e4.',
            }),
            '\n',
            '\n',
            (0, t.jsxs)(n.p, {
              children: [
                (0, t.jsx)(h, { color: '#25c2a0', children: '\uace0\uc131\ub2a5' }),
                ' \uc2e4\uc2dc\uac04 \ucc44\ud305 \uc11c\ubc84\ub85c \uac8c\uc784 \ucee4\ubba4\ub2c8\ud2f0\ub97c \uac15\ud654\ud558\uc138\uc694!',
              ],
            }),
            '\n',
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-\ucc44\ud305-\uc11c\ubc84-\uc544\ud0a4\ud14d\ucc98',
              children: '\ud83d\ude80 \ucc44\ud305 \uc11c\ubc84 \uc544\ud0a4\ud14d\ucc98',
            }),
            '\n',
            (0, t.jsx)(n.p, {
              children:
                'Gatrix \ucc44\ud305 \uc11c\ubc84\ub294 \ub2e4\uc74c\uacfc \uac19\uc740 \uace0\uae09 \uae30\ub2a5\uc744 \uc81c\uacf5\ud569\ub2c8\ub2e4:',
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Socket.IO \uae30\ubc18' }),
                    ': WebSocket\uacfc \ud3f4\ub9c1\uc744 \uc790\ub3d9\uc73c\ub85c \ucc98\ub9ac',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: 'Redis \ud074\ub7ec\uc2a4\ud130\ub9c1' }),
                    ': \ub2e4\uc911 \uc778\uc2a4\ud134\uc2a4 \ub3d9\uae30\ud654',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, {
                      children: '\uba54\uc2dc\uc9c0 \ube0c\ub85c\ub4dc\uce90\uc2a4\ud305',
                    }),
                    ': 100,000+ \uba54\uc2dc\uc9c0/\ucd08 \ucc98\ub9ac',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, {
                      children: '\uc2e4\uc2dc\uac04 \ubaa8\ub2c8\ud130\ub9c1',
                    }),
                    ': Prometheus \uba54\ud2b8\ub9ad \uc218\uc9d1',
                  ],
                }),
                '\n',
                (0, t.jsxs)(n.li, {
                  children: [
                    (0, t.jsx)(n.strong, { children: '\uc790\ub3d9 \ud655\uc7a5' }),
                    ': \uc218\ud3c9\uc801 \ud655\uc7a5 \uc9c0\uc6d0',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-\uc124\uce58-\ubc0f-\uc124\uc815',
              children: '\ud83d\udce6 \uc124\uce58 \ubc0f \uc124\uc815',
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '1-\uae30\ubcf8-\uc124\uce58',
              children: '1. \uae30\ubcf8 \uc124\uce58',
            }),
            '\n',
            (0, t.jsxs)(l.A, {
              children: [
                (0, t.jsx)(i.A, {
                  value: 'npm',
                  label: 'npm',
                  default: !0,
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-bash',
                      children:
                        '# \ucc44\ud305 \uc11c\ubc84 \ud328\ud0a4\uc9c0\ub85c \uc774\ub3d9\r\ncd packages/chat-server\r\n\r\n# \uc758\uc874\uc131 \uc124\uce58\r\nnpm install\r\n\r\n# \ud658\uacbd \ubcc0\uc218 \uc124\uc815\r\ncp .env.example .env\n',
                    }),
                  }),
                }),
                (0, t.jsx)(i.A, {
                  value: 'yarn',
                  label: 'yarn',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-bash',
                      children:
                        '# \ucc44\ud305 \uc11c\ubc84 \ud328\ud0a4\uc9c0\ub85c \uc774\ub3d9\r\ncd packages/chat-server\r\n\r\n# \uc758\uc874\uc131 \uc124\uce58\r\nyarn install\r\n\r\n# \ud658\uacbd \ubcc0\uc218 \uc124\uc815\r\ncp .env.example .env\n',
                    }),
                  }),
                }),
                (0, t.jsx)(i.A, {
                  value: 'docker',
                  label: 'Docker',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-bash',
                      children:
                        '# Docker Compose\ub85c \uc804\uccb4 \uc2a4\ud0dd \uc2e4\ud589\r\ndocker-compose up -d\r\n\r\n# \ub610\ub294 \ucc44\ud305 \uc11c\ubc84\ub9cc \uc2e4\ud589\r\ndocker-compose up chat-server\n',
                    }),
                  }),
                }),
              ],
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '2-\ud658\uacbd-\ubcc0\uc218-\uc124\uc815',
              children: '2. \ud658\uacbd \ubcc0\uc218 \uc124\uc815',
            }),
            '\n',
            (0, t.jsx)(c.A, {
              language: 'bash',
              children:
                '# \uc11c\ubc84 \uc124\uc815\nNODE_ENV=production\nPORT=3001\nHOST=0.0.0.0\n\n# \ub370\uc774\ud130\ubca0\uc774\uc2a4\nDB_HOST=localhost\nDB_PORT=3306\nDB_NAME=gatrix_chat\nDB_USER=chat_user\nDB_PASSWORD=your_password\n\n# Redis \ud074\ub7ec\uc2a4\ud130\nREDIS_HOST=localhost\nREDIS_PORT=6379\nREDIS_PASSWORD=your_redis_password\n\n# Gatrix \uba54\uc778 \uc11c\ubc84 \uc5f0\ub3d9\nGATRIX_API_URL=http://localhost:5000\nGATRIX_API_SECRET=shared_secret\n\n# \uc131\ub2a5 \ud29c\ub2dd\nCLUSTER_ENABLED=true\nWS_MAX_CONNECTIONS=10000\nBROADCAST_BATCH_SIZE=1000',
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-\ud575\uc2ec-\uae30\ub2a5-\uc124\uc815',
              children: '\ud83d\udd27 \ud575\uc2ec \uae30\ub2a5 \uc124\uc815',
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '1-\ucc44\ub110-\uad00\ub9ac',
              children: '1. \ucc44\ub110 \uad00\ub9ac',
            }),
            '\n',
            (0, t.jsxs)(l.A, {
              children: [
                (0, t.jsx)(i.A, {
                  value: 'create',
                  label: '\ucc44\ub110 \uc0dd\uc131',
                  default: !0,
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-javascript',
                      children:
                        '// \ucc44\ub110 \uc0dd\uc131 API\r\nPOST /api/v1/channels\r\n{\r\n  "name": "\uc77c\ubc18 \ucc44\ud305",\r\n  "description": "\ubaa8\ub4e0 \uc0ac\uc6a9\uc790\uac00 \ucc38\uc5ec\ud560 \uc218 \uc788\ub294 \ucc44\ub110",\r\n  "type": "public",\r\n  "maxMembers": 1000\r\n}\n',
                    }),
                  }),
                }),
                (0, t.jsx)(i.A, {
                  value: 'join',
                  label: '\ucc44\ub110 \ucc38\uc5ec',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-javascript',
                      children:
                        "// WebSocket\uc73c\ub85c \ucc44\ub110 \ucc38\uc5ec\r\nsocket.emit('join_channel', {\r\n  channelId: 'channel_123',\r\n  userId: 'user_456'\r\n});\n",
                    }),
                  }),
                }),
                (0, t.jsx)(i.A, {
                  value: 'leave',
                  label: '\ucc44\ub110 \ub098\uac00\uae30',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-javascript',
                      children:
                        "// WebSocket\uc73c\ub85c \ucc44\ub110 \ub098\uac00\uae30\r\nsocket.emit('leave_channel', {\r\n  channelId: 'channel_123',\r\n  userId: 'user_456'\r\n});\n",
                    }),
                  }),
                }),
              ],
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '2-\uba54\uc2dc\uc9c0-\uc804\uc1a1',
              children: '2. \uba54\uc2dc\uc9c0 \uc804\uc1a1',
            }),
            '\n',
            (0, t.jsx)(c.A, {
              language: 'javascript',
              children:
                "// \uba54\uc2dc\uc9c0 \uc804\uc1a1\nsocket.emit('send_message', {\nchannelId: 'channel_123',\ncontent: '\uc548\ub155\ud558\uc138\uc694!',\ntype: 'text',\nmetadata: {\n  mentions: ['user_456'],\n  replyTo: 'message_789'\n}\n});\n\n// \uc11c\ubc84\uc5d0\uc11c \uba54\uc2dc\uc9c0 \uc218\uc2e0\nsocket.on('message', (data) => {\nconsole.log('\uc0c8 \uba54\uc2dc\uc9c0:', data);\n// {\n//   id: 'msg_123',\n//   channelId: 'channel_123',\n//   userId: 'user_456',\n//   content: '\uc548\ub155\ud558\uc138\uc694!',\n//   timestamp: '2024-01-15T10:30:00Z',\n//   type: 'text'\n// }\n});",
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '3-\uc2e4\uc2dc\uac04-\uae30\ub2a5',
              children: '3. \uc2e4\uc2dc\uac04 \uae30\ub2a5',
            }),
            '\n',
            (0, t.jsxs)(l.A, {
              children: [
                (0, t.jsx)(i.A, {
                  value: 'typing',
                  label: '\ud0c0\uc774\ud551 \uc778\ub514\ucf00\uc774\ud130',
                  default: !0,
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-javascript',
                      children:
                        "// \ud0c0\uc774\ud551 \uc2dc\uc791\r\nsocket.emit('typing_start', {\r\n  channelId: 'channel_123',\r\n  userId: 'user_456'\r\n});\r\n\r\n// \ud0c0\uc774\ud551 \uc911\uc9c0\r\nsocket.emit('typing_stop', {\r\n  channelId: 'channel_123',\r\n  userId: 'user_456'\r\n});\n",
                    }),
                  }),
                }),
                (0, t.jsx)(i.A, {
                  value: 'presence',
                  label: '\uc0ac\uc6a9\uc790 \uc0c1\ud0dc',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-javascript',
                      children:
                        "// \uc628\ub77c\uc778 \uc0c1\ud0dc \uc5c5\ub370\uc774\ud2b8\r\nsocket.emit('presence_update', {\r\n  status: 'online',\r\n  lastSeen: new Date().toISOString()\r\n});\n",
                    }),
                  }),
                }),
                (0, t.jsx)(i.A, {
                  value: 'reactions',
                  label: '\uba54\uc2dc\uc9c0 \ubc18\uc751',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-javascript',
                      children:
                        "// \uba54\uc2dc\uc9c0\uc5d0 \ubc18\uc751 \ucd94\uac00\r\nsocket.emit('add_reaction', {\r\n  messageId: 'msg_123',\r\n  emoji: '\ud83d\udc4d',\r\n  userId: 'user_456'\r\n});\n",
                    }),
                  }),
                }),
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-\uc131\ub2a5-\ucd5c\uc801\ud654',
              children: '\ud83d\udcca \uc131\ub2a5 \ucd5c\uc801\ud654',
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '1-\uba54\uc2dc\uc9c0-\ube0c\ub85c\ub4dc\uce90\uc2a4\ud305-\ucd5c\uc801\ud654',
              children:
                '1. \uba54\uc2dc\uc9c0 \ube0c\ub85c\ub4dc\uce90\uc2a4\ud305 \ucd5c\uc801\ud654',
            }),
            '\n',
            (0, t.jsx)(c.A, {
              language: 'javascript',
              children:
                '// \ubc30\uce58 \ucc98\ub9ac\ub85c \uba54\uc2dc\uc9c0 \uc804\uc1a1\nconst broadcastService = {\nasync broadcastMessage(channelId, message) {\n  const members = await this.getChannelMembers(channelId);\n  \n  // 1000\uac1c\uc529 \ubc30\uce58\ub85c \ub098\ub204\uc5b4 \uc804\uc1a1\n  const batches = this.chunkArray(members, 1000);\n  \n  for (const batch of batches) {\n    await this.sendBatch(batch, message);\n  }\n},\n\nasync sendBatch(members, message) {\n  const promises = members.map(member => \n    this.sendToUser(member.userId, message)\n  );\n  \n  await Promise.all(promises);\n}\n};',
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '2-redis-\ud074\ub7ec\uc2a4\ud130-\uc124\uc815',
              children: '2. Redis \ud074\ub7ec\uc2a4\ud130 \uc124\uc815',
            }),
            '\n',
            (0, t.jsx)(c.A, {
              language: 'yaml',
              children:
                '# docker-compose.yml\nversion: \'3.8\'\nservices:\nredis-cluster:\n  image: redis:7-alpine\n  command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes\n  ports:\n    - "7000:7000"\n    - "7001:7001"\n    - "7002:7002"\n  volumes:\n    - redis-data:/data\n\nchat-server:\n  build: ./packages/chat-server\n  environment:\n    - REDIS_CLUSTER_NODES=redis-cluster:7000,redis-cluster:7001,redis-cluster:7002\n  depends_on:\n    - redis-cluster',
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '3-\ubaa8\ub2c8\ud130\ub9c1-\uc124\uc815',
              children: '3. \ubaa8\ub2c8\ud130\ub9c1 \uc124\uc815',
            }),
            '\n',
            (0, t.jsxs)(l.A, {
              children: [
                (0, t.jsx)(i.A, {
                  value: 'prometheus',
                  label: 'Prometheus \uba54\ud2b8\ub9ad',
                  default: !0,
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-javascript',
                      children:
                        "// \uba54\ud2b8\ub9ad \uc218\uc9d1\r\nconst prometheus = require('prom-client');\r\n\r\nconst messageCounter = new prometheus.Counter({\r\n  name: 'chat_messages_total',\r\n  help: 'Total number of messages sent',\r\n  labelNames: ['channel', 'type']\r\n});\r\n\r\nconst connectionGauge = new prometheus.Gauge({\r\n  name: 'chat_connections_active',\r\n  help: 'Number of active connections'\r\n});\n",
                    }),
                  }),
                }),
                (0, t.jsx)(i.A, {
                  value: 'grafana',
                  label: 'Grafana \ub300\uc2dc\ubcf4\ub4dc',
                  children: (0, t.jsx)(n.pre, {
                    children: (0, t.jsx)(n.code, {
                      className: 'language-json',
                      children:
                        '{\r\n  "dashboard": {\r\n    "title": "Gatrix Chat Server",\r\n    "panels": [\r\n      {\r\n        "title": "Active Connections",\r\n        "type": "graph",\r\n        "targets": [\r\n          {\r\n            "expr": "chat_connections_active"\r\n          }\r\n        ]\r\n      },\r\n      {\r\n        "title": "Messages per Second",\r\n        "type": "graph",\r\n        "targets": [\r\n          {\r\n            "expr": "rate(chat_messages_total[5m])"\r\n          }\r\n        ]\r\n      }\r\n    ]\r\n  }\r\n}\n',
                    }),
                  }),
                }),
              ],
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-\ubcf4\uc548-\uc124\uc815',
              children: '\ud83d\udd12 \ubcf4\uc548 \uc124\uc815',
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: '1-jwt-\uc778\uc99d', children: '1. JWT \uc778\uc99d' }),
            '\n',
            (0, t.jsx)(c.A, {
              language: 'javascript',
              children:
                "// JWT \ud1a0\ud070 \uac80\uc99d \ubbf8\ub4e4\uc6e8\uc5b4\nconst jwt = require('jsonwebtoken');\n\nconst authenticateSocket = (socket, next) => {\nconst token = socket.handshake.auth.token;\n\ntry {\n  const decoded = jwt.verify(token, process.env.JWT_SECRET);\n  socket.userId = decoded.userId;\n  socket.userRole = decoded.role;\n  next();\n} catch (error) {\n  next(new Error('Authentication failed'));\n}\n};\n\nio.use(authenticateSocket);",
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: '2-rate-limiting', children: '2. Rate Limiting' }),
            '\n',
            (0, t.jsx)(c.A, {
              language: 'javascript',
              children:
                "// \uba54\uc2dc\uc9c0 \uc804\uc1a1 \uc81c\ud55c\nconst rateLimiter = new RateLimiter({\nkeyGenerator: (socket) => socket.userId,\npoints: 10, // 10\uac1c \uba54\uc2dc\uc9c0\nduration: 60, // 1\ubd84 \ub3d9\uc548\n});\n\nsocket.on('send_message', async (data) => {\ntry {\n  await rateLimiter.consume(socket.userId);\n  // \uba54\uc2dc\uc9c0 \ucc98\ub9ac\n} catch (rejRes) {\n  socket.emit('rate_limit_exceeded', {\n    retryAfter: rejRes.msBeforeNext\n  });\n}\n});",
            }),
            '\n',
            (0, t.jsx)(n.h2, {
              id: '-\ubc30\ud3ec-\ubc0f-\ud655\uc7a5',
              children: '\ud83d\ude80 \ubc30\ud3ec \ubc0f \ud655\uc7a5',
            }),
            '\n',
            (0, t.jsx)(n.h3, { id: '1-docker-\ubc30\ud3ec', children: '1. Docker \ubc30\ud3ec' }),
            '\n',
            (0, t.jsx)(c.A, {
              language: 'dockerfile',
              children:
                '# Dockerfile\nFROM node:18-alpine\n\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\n\nCOPY . .\nRUN npm run build\n\nEXPOSE 3001\n\nCMD ["npm", "start"]',
            }),
            '\n',
            (0, t.jsx)(n.h3, {
              id: '2-\ub85c\ub4dc-\ubc38\ub7f0\uc2f1',
              children: '2. \ub85c\ub4dc \ubc38\ub7f0\uc2f1',
            }),
            '\n',
            (0, t.jsx)(c.A, {
              language: 'nginx',
              children:
                "# nginx.conf\nupstream chat_servers {\n  ip_hash; # Sticky session\n  server chat-server-1:3001;\n  server chat-server-2:3001;\n  server chat-server-3:3001;\n}\n\nserver {\n  listen 80;\n  server_name chat.gatrix.com;\n  \n  location / {\n      proxy_pass http://chat_servers;\n      proxy_http_version 1.1;\n      proxy_set_header Upgrade $http_upgrade;\n      proxy_set_header Connection 'upgrade';\n      proxy_set_header Host $host;\n      proxy_cache_bypass $http_upgrade;\n  }\n}",
            }),
            '\n',
            (0, t.jsx)(n.h2, { id: '-\uacb0\ub860', children: '\ud83c\udfaf \uacb0\ub860' }),
            '\n',
            (0, t.jsx)(n.p, {
              children:
                'Gatrix \ucc44\ud305 \uc11c\ubc84\ub294 \uace0\uc131\ub2a5 \uc2e4\uc2dc\uac04 \ud1b5\uc2e0\uc744 \uc704\ud55c \uc644\uc804\ud55c \uc194\ub8e8\uc158\uc744 \uc81c\uacf5\ud569\ub2c8\ub2e4. \uc774 \uac00\uc774\ub4dc\ub97c \ub530\ub77c \uc124\uc815\ud558\uba74 \ud655\uc7a5 \uac00\ub2a5\ud558\uace0 \uc548\uc815\uc801\uc778 \ucc44\ud305 \uc2dc\uc2a4\ud15c\uc744 \uad6c\ucd95\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.',
            }),
            '\n',
            (0, t.jsx)(n.p, {
              children:
                '\ub2e4\uc74c \ud3ec\uc2a4\ud2b8\uc5d0\uc11c\ub294 API \ud1b5\ud569\uacfc \uc6f9\ud6c5 \uc124\uc815\uc5d0 \ub300\ud574 \uc54c\uc544\ubcf4\uaca0\uc2b5\ub2c8\ub2e4!',
            }),
            '\n',
            (0, t.jsx)(n.hr, {}),
            '\n',
            (0, t.jsxs)(n.p, {
              children: [(0, t.jsx)(n.strong, { children: '\uad00\ub828 \uc790\ub8cc' }), ':'],
            }),
            '\n',
            (0, t.jsxs)(n.ul, {
              children: [
                '\n',
                (0, t.jsx)(n.li, {
                  children: (0, t.jsx)(n.a, {
                    href: 'https://github.com/motifgames/gatrix/blob/main/packages/chat-server/README.md',
                    children: '\ucc44\ud305 \uc11c\ubc84 \ubb38\uc11c',
                  }),
                }),
                '\n',
                (0, t.jsx)(n.li, {
                  children: (0, t.jsx)(n.a, {
                    href: '/docs/api/client-api',
                    children: 'API \ubb38\uc11c',
                  }),
                }),
                '\n',
                (0, t.jsx)(n.li, {
                  children: (0, t.jsx)(n.a, {
                    href: 'https://github.com/motifgames/gatrix',
                    children: 'GitHub \uc800\uc7a5\uc18c',
                  }),
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function g(e = {}) {
        const { wrapper: n } = { ...(0, s.R)(), ...e.components };
        return n ? (0, t.jsx)(n, { ...e, children: (0, t.jsx)(m, { ...e }) }) : m(e);
      }
    },
    1470(e, n, r) {
      r.d(n, { A: () => y });
      var a = r(6540),
        t = r(4164),
        s = r(3104),
        l = r(6347),
        i = r(205),
        c = r(7485),
        o = r(1682),
        d = r(679);
      function u(e) {
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
              return u(e).map(({ props: { value: e, label: n, attributes: r, default: a } }) => ({
                value: e,
                label: n,
                attributes: r,
                default: a,
              }));
            })(r);
          return (
            (function (e) {
              const n = (0, o.XI)(e, (e, n) => e.value === n.value);
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
        const r = (0, l.W6)(),
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
          (0, c.aZ)(t),
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
          [l, c] = (0, a.useState)(() =>
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
          [o, u] = m({ queryString: r, groupId: t }),
          [g, x] = (function ({ groupId: e }) {
            const n = (function (e) {
                return e ? `docusaurus.tab.${e}` : null;
              })(e),
              [r, t] = (0, d.Dv)(n);
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
          v = (() => {
            const e = o ?? g;
            return p({ value: e, tabValues: s }) ? e : null;
          })();
        (0, i.A)(() => {
          v && c(v);
        }, [v]);
        return {
          selectedValue: l,
          selectValue: (0, a.useCallback)(
            (e) => {
              if (!p({ value: e, tabValues: s }))
                throw new Error(`Can't select invalid tab value=${e}`);
              (c(e), u(e), x(e));
            },
            [u, x, s]
          ),
          tabValues: s,
        };
      }
      var x = r(2303);
      const v = 'tabList__CuJ',
        b = 'tabItem_LNqP';
      var j = r(4848);
      function f({ className: e, block: n, selectedValue: r, selectValue: a, tabValues: l }) {
        const i = [],
          { blockElementScrollPositionUntilNextRender: c } = (0, s.a_)(),
          o = (e) => {
            const n = e.currentTarget,
              t = i.indexOf(n),
              s = l[t].value;
            s !== r && (c(n), a(s));
          },
          d = (e) => {
            let n = null;
            switch (e.key) {
              case 'Enter':
                o(e);
                break;
              case 'ArrowRight': {
                const r = i.indexOf(e.currentTarget) + 1;
                n = i[r] ?? i[0];
                break;
              }
              case 'ArrowLeft': {
                const r = i.indexOf(e.currentTarget) - 1;
                n = i[r] ?? i[i.length - 1];
                break;
              }
            }
            n?.focus();
          };
        return (0, j.jsx)('ul', {
          role: 'tablist',
          'aria-orientation': 'horizontal',
          className: (0, t.A)('tabs', { 'tabs--block': n }, e),
          children: l.map(({ value: e, label: n, attributes: a }) =>
            (0, j.jsx)(
              'li',
              {
                role: 'tab',
                tabIndex: r === e ? 0 : -1,
                'aria-selected': r === e,
                ref: (e) => {
                  i.push(e);
                },
                onKeyDown: d,
                onClick: o,
                ...a,
                className: (0, t.A)('tabs__item', b, a?.className, {
                  'tabs__item--active': r === e,
                }),
                children: n ?? e,
              },
              e
            )
          ),
        });
      }
      function _({ lazy: e, children: n, selectedValue: r }) {
        const s = (Array.isArray(n) ? n : [n]).filter(Boolean);
        if (e) {
          const e = s.find((e) => e.props.value === r);
          return e
            ? (0, a.cloneElement)(e, { className: (0, t.A)('margin-top--md', e.props.className) })
            : null;
        }
        return (0, j.jsx)('div', {
          className: 'margin-top--md',
          children: s.map((e, n) =>
            (0, a.cloneElement)(e, { key: n, hidden: e.props.value !== r })
          ),
        });
      }
      function k(e) {
        const n = g(e);
        return (0, j.jsxs)('div', {
          className: (0, t.A)('tabs-container', v),
          children: [(0, j.jsx)(f, { ...n, ...e }), (0, j.jsx)(_, { ...n, ...e })],
        });
      }
      function y(e) {
        const n = (0, x.A)();
        return (0, j.jsx)(k, { ...e, children: u(e.children) }, String(n));
      }
    },
    1632(e) {
      e.exports = JSON.parse(
        '{"permalink":"/docs/blog/real-time-chat-server-setup","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2021-08-01-mdx-blog-post.mdx","source":"@site/blog/2021-08-01-mdx-blog-post.mdx","title":"Gatrix \uc2e4\uc2dc\uac04 \ucc44\ud305 \uc11c\ubc84 \uc644\uc804 \uc124\uc815 \uac00\uc774\ub4dc","description":"Gatrix\uc758 \uc2e4\uc2dc\uac04 \ucc44\ud305 \uc11c\ubc84\ub294 Socket.IO\uc640 Redis \ud074\ub7ec\uc2a4\ud130\ub9c1\uc744 \uc0ac\uc6a9\ud558\uc5ec \uace0\uc131\ub2a5 \uba54\uc2dc\uc9d5\uc744 \uc81c\uacf5\ud569\ub2c8\ub2e4. \uc774 \uac00\uc774\ub4dc\uc5d0\uc11c\ub294 \ucc44\ud305 \uc11c\ubc84\ub97c \uc124\uc815\ud558\uace0 \ucd5c\uc801\ud654\ud558\ub294 \ubc29\ubc95\uc744 \ub2e8\uacc4\ubcc4\ub85c \uc54c\uc544\ubcf4\uaca0\uc2b5\ub2c8\ub2e4.","date":"2021-08-01T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":false,"label":"Chat","permalink":"/docs/blog/tags/chat","description":"Real-time chat server features"},{"inline":false,"label":"Tutorial","permalink":"/docs/blog/tags/tutorial","description":"Step-by-step tutorials and guides"},{"inline":false,"label":"Setup","permalink":"/docs/blog/tags/setup","description":"Installation and configuration guides"}],"readingTime":4.33,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"real-time-chat-server-setup","title":"Gatrix \uc2e4\uc2dc\uac04 \ucc44\ud305 \uc11c\ubc84 \uc644\uc804 \uc124\uc815 \uac00\uc774\ub4dc","authors":["gatrix-team"],"tags":["gatrix","chat","tutorial","setup"]},"unlisted":false,"prevItem":{"title":"Gatrix API \ud1b5\ud569 \ubc0f \uc6f9\ud6c5 \uc124\uc815 \uc644\uc804 \uac00\uc774\ub4dc","permalink":"/docs/blog/api-integration-webhooks"},"nextItem":{"title":"Gatrix ?\ufffd\uc5c5 \uad00\ufffd??\ufffd\uc2a4???\ufffd\uc804 \uac00?\ufffd\ub4dc: ?\ufffd\ub3d9?\ufffd\uc758 ?\ufffd\ub85c??\ucc28\uc6d0","permalink":"/docs/blog/mastering-job-management-system"}}'
      );
    },
    9365(e, n, r) {
      r.d(n, { A: () => l });
      r(6540);
      var a = r(4164);
      const t = 'tabItem_Ymn6';
      var s = r(4848);
      function l({ children: e, hidden: n, className: r }) {
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
