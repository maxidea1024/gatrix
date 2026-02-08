'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [5557],
  {
    7447(e, n, t) {
      (t.r(n),
        t.d(n, {
          assets: () => l,
          contentTitle: () => o,
          default: () => h,
          frontMatter: () => i,
          metadata: () => s,
          toc: () => d,
        }));
      var s = t(8811),
        a = t(4848),
        r = t(8453);
      const i = {
          slug: 'api-integration-webhooks',
          title:
            'Gatrix API \ud1b5\ud569 \ubc0f \uc6f9\ud6c5 \uc124\uc815 \uc644\uc804 \uac00\uc774\ub4dc',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'api', 'tutorial', 'tips'],
        },
        o = void 0,
        l = { authorsImageUrls: [void 0] },
        d = [
          {
            value: '\ud83d\udd0c API \ud1b5\ud569 \uac1c\uc694',
            id: '-api-\ud1b5\ud569-\uac1c\uc694',
            level: 2,
          },
          { value: '\ud83d\udce1 REST API \ud1b5\ud569', id: '-rest-api-\ud1b5\ud569', level: 2 },
          { value: '1. \uc778\uc99d \uc124\uc815', id: '1-\uc778\uc99d-\uc124\uc815', level: 3 },
          {
            value: '2. \uc8fc\uc694 API \uc5d4\ub4dc\ud3ec\uc778\ud2b8',
            id: '2-\uc8fc\uc694-api-\uc5d4\ub4dc\ud3ec\uc778\ud2b8',
            level: 3,
          },
          {
            value: '\uc0ac\uc6a9\uc790 \uad00\ub9ac',
            id: '\uc0ac\uc6a9\uc790-\uad00\ub9ac',
            level: 4,
          },
          {
            value: '\uac8c\uc784 \uc6d4\ub4dc \uad00\ub9ac',
            id: '\uac8c\uc784-\uc6d4\ub4dc-\uad00\ub9ac',
            level: 4,
          },
          { value: '\ud83d\udd17 WebSocket \ud1b5\ud569', id: '-websocket-\ud1b5\ud569', level: 2 },
          {
            value: '1. \uc2e4\uc2dc\uac04 \uc774\ubca4\ud2b8 \uad6c\ub3c5',
            id: '1-\uc2e4\uc2dc\uac04-\uc774\ubca4\ud2b8-\uad6c\ub3c5',
            level: 3,
          },
          {
            value: '\ud83e\ude9d \uc6f9\ud6c5 \uc124\uc815',
            id: '-\uc6f9\ud6c5-\uc124\uc815',
            level: 2,
          },
          {
            value: '1. \uc6f9\ud6c5 \uc5d4\ub4dc\ud3ec\uc778\ud2b8 \uc0dd\uc131',
            id: '1-\uc6f9\ud6c5-\uc5d4\ub4dc\ud3ec\uc778\ud2b8-\uc0dd\uc131',
            level: 3,
          },
          {
            value: '2. Gatrix\uc5d0\uc11c \uc6f9\ud6c5 \uc124\uc815',
            id: '2-gatrix\uc5d0\uc11c-\uc6f9\ud6c5-\uc124\uc815',
            level: 3,
          },
          { value: '\ud83d\udee0\ufe0f SDK \uc0ac\uc6a9', id: '\ufe0f-sdk-\uc0ac\uc6a9', level: 2 },
          { value: '1. Node.js SDK', id: '1-nodejs-sdk', level: 3 },
          { value: '2. Python SDK', id: '2-python-sdk', level: 3 },
          {
            value: '\ud83d\udcca \ubaa8\ub2c8\ud130\ub9c1 \ubc0f \ub85c\uae45',
            id: '-\ubaa8\ub2c8\ud130\ub9c1-\ubc0f-\ub85c\uae45',
            level: 2,
          },
          {
            value: '1. API \ud638\ucd9c \ubaa8\ub2c8\ud130\ub9c1',
            id: '1-api-\ud638\ucd9c-\ubaa8\ub2c8\ud130\ub9c1',
            level: 3,
          },
          { value: '2. \uc5d0\ub7ec \ub85c\uae45', id: '2-\uc5d0\ub7ec-\ub85c\uae45', level: 3 },
          { value: '\ud83c\udfaf \uacb0\ub860', id: '-\uacb0\ub860', level: 2 },
        ];
      function c(e) {
        const n = {
          a: 'a',
          code: 'code',
          h2: 'h2',
          h3: 'h3',
          h4: 'h4',
          hr: 'hr',
          li: 'li',
          ol: 'ol',
          p: 'p',
          pre: 'pre',
          strong: 'strong',
          ul: 'ul',
          ...(0, r.R)(),
          ...e.components,
        };
        return (0, a.jsxs)(a.Fragment, {
          children: [
            (0, a.jsx)(n.p, {
              children:
                'Gatrix\uc758 \uac15\ub825\ud55c API \uc2dc\uc2a4\ud15c\uc744 \ud65c\uc6a9\ud558\uc5ec \uc678\ubd80 \uc11c\ube44\uc2a4\uc640\uc758 \ud1b5\ud569\uc744 \uad6c\ud604\ud558\uace0, \uc2e4\uc2dc\uac04 \uc774\ubca4\ud2b8\ub97c \ucc98\ub9ac\ud558\ub294 \uc6f9\ud6c5\uc744 \uc124\uc815\ud558\ub294 \ubc29\ubc95\uc744 \uc54c\uc544\ubcf4\uaca0\uc2b5\ub2c8\ub2e4. \uc774 \uac00\uc774\ub4dc\ub97c \ud1b5\ud574 \uac8c\uc784 \ud50c\ub7ab\ud3fc\uc744 \ub354\uc6b1 \ud655\uc7a5 \uac00\ub2a5\ud558\uace0 \uc720\uc5f0\ud558\uac8c \ub9cc\ub4e4 \uc218 \uc788\uc2b5\ub2c8\ub2e4.',
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-api-\ud1b5\ud569-\uac1c\uc694',
              children: '\ud83d\udd0c API \ud1b5\ud569 \uac1c\uc694',
            }),
            '\n',
            (0, a.jsx)(n.p, {
              children:
                'Gatrix\ub294 RESTful API\uc640 WebSocket\uc744 \ud1b5\ud574 \ub2e4\uc591\ud55c \uc678\ubd80 \uc11c\ube44\uc2a4\uc640\uc758 \ud1b5\ud569\uc744 \uc9c0\uc6d0\ud569\ub2c8\ub2e4:',
            }),
            '\n',
            (0, a.jsxs)(n.ul, {
              children: [
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: 'REST API' }),
                    ': \ud45c\uc900 HTTP \uba54\uc11c\ub4dc\ub97c \uc0ac\uc6a9\ud55c \ub370\uc774\ud130 \uad50\ud658',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: 'WebSocket' }),
                    ': \uc2e4\uc2dc\uac04 \uc774\ubca4\ud2b8 \uc2a4\ud2b8\ub9ac\ubc0d',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: 'Webhook' }),
                    ': \uc11c\ubc84 \uac04 \ube44\ub3d9\uae30 \ud1b5\uc2e0',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: 'SDK' }),
                    ': \ub2e4\uc591\ud55c \uc5b8\uc5b4\ub97c \uc704\ud55c \ud074\ub77c\uc774\uc5b8\ud2b8 \ub77c\uc774\ube0c\ub7ec\ub9ac',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-rest-api-\ud1b5\ud569',
              children: '\ud83d\udce1 REST API \ud1b5\ud569',
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '1-\uc778\uc99d-\uc124\uc815',
              children: '1. \uc778\uc99d \uc124\uc815',
            }),
            '\n',
            (0, a.jsx)(n.p, {
              children:
                '\ubaa8\ub4e0 API \uc694\uccad\uc5d0\ub294 \uc801\uc808\ud55c \uc778\uc99d\uc774 \ud544\uc694\ud569\ub2c8\ub2e4:',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// JWT \ud1a0\ud070\uc744 \uc0ac\uc6a9\ud55c \uc778\uc99d\nconst axios = require('axios');\n\nconst apiClient = axios.create({\n  baseURL: 'https://api.gatrix.com',\n  headers: {\n    'Authorization': `Bearer ${jwtToken}`,\n    'Content-Type': 'application/json'\n  }\n});\n\n// API \ud0a4\ub97c \uc0ac\uc6a9\ud55c \uc778\uc99d\nconst apiKeyClient = axios.create({\n  baseURL: 'https://api.gatrix.com',\n  headers: {\n    'X-API-Key': process.env.GATRIX_API_KEY,\n    'Content-Type': 'application/json'\n  }\n});\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-\uc8fc\uc694-api-\uc5d4\ub4dc\ud3ec\uc778\ud2b8',
              children: '2. \uc8fc\uc694 API \uc5d4\ub4dc\ud3ec\uc778\ud2b8',
            }),
            '\n',
            (0, a.jsx)(n.h4, {
              id: '\uc0ac\uc6a9\uc790-\uad00\ub9ac',
              children: '\uc0ac\uc6a9\uc790 \uad00\ub9ac',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// \uc0ac\uc6a9\uc790 \ubaa9\ub85d \uc870\ud68c\nconst users = await apiClient.get('/api/v1/users', {\n  params: {\n    page: 1,\n    limit: 50,\n    role: 'player'\n  }\n});\n\n// \uc0ac\uc6a9\uc790 \uc0dd\uc131\nconst newUser = await apiClient.post('/api/v1/users', {\n  username: 'player123',\n  email: 'player@example.com',\n  role: 'player'\n});\n\n// \uc0ac\uc6a9\uc790 \uc815\ubcf4 \uc5c5\ub370\uc774\ud2b8\nconst updatedUser = await apiClient.put('/api/v1/users/123', {\n  status: 'active',\n  lastLoginAt: new Date().toISOString()\n});\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h4, {
              id: '\uac8c\uc784-\uc6d4\ub4dc-\uad00\ub9ac',
              children: '\uac8c\uc784 \uc6d4\ub4dc \uad00\ub9ac',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// \uac8c\uc784 \uc6d4\ub4dc \ubaa9\ub85d \uc870\ud68c\nconst worlds = await apiClient.get('/api/v1/game-worlds');\n\n// \uac8c\uc784 \uc6d4\ub4dc \uc0dd\uc131\nconst newWorld = await apiClient.post('/api/v1/game-worlds', {\n  worldId: 'world_001',\n  name: '\uba54\uc778 \uc6d4\ub4dc',\n  description: '\uae30\ubcf8 \uac8c\uc784 \uc6d4\ub4dc',\n  visible: true,\n  maintenance: false\n});\n\n// \uac8c\uc784 \uc6d4\ub4dc \uc0c1\ud0dc \ubcc0\uacbd\nconst maintenanceMode = await apiClient.put('/api/v1/game-worlds/1/maintenance', {\n  enabled: true,\n  message: '\uc11c\ubc84 \uc810\uac80 \uc911\uc785\ub2c8\ub2e4. 2\uc2dc\uac04 \ud6c4 \uc815\uc0c1\ud654 \uc608\uc815\uc785\ub2c8\ub2e4.'\n});\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-websocket-\ud1b5\ud569',
              children: '\ud83d\udd17 WebSocket \ud1b5\ud569',
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '1-\uc2e4\uc2dc\uac04-\uc774\ubca4\ud2b8-\uad6c\ub3c5',
              children: '1. \uc2e4\uc2dc\uac04 \uc774\ubca4\ud2b8 \uad6c\ub3c5',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "const io = require('socket.io-client');\n\nclass GatrixWebSocketClient {\n  constructor(serverUrl, token) {\n    this.socket = io(serverUrl, {\n      auth: { token },\n      transports: ['websocket', 'polling']\n    });\n    \n    this.setupEventHandlers();\n  }\n  \n  setupEventHandlers() {\n    // \uc5f0\uacb0 \uc774\ubca4\ud2b8\n    this.socket.on('connect', () => {\n      console.log('Gatrix \uc11c\ubc84\uc5d0 \uc5f0\uacb0\ub418\uc5c8\uc2b5\ub2c8\ub2e4.');\n    });\n    \n    this.socket.on('disconnect', (reason) => {\n      console.log('\uc5f0\uacb0\uc774 \ub04a\uc5b4\uc84c\uc2b5\ub2c8\ub2e4:', reason);\n    });\n    \n    // \uc0ac\uc6a9\uc790 \uc774\ubca4\ud2b8\n    this.socket.on('user_registered', (data) => {\n      console.log('\uc0c8 \uc0ac\uc6a9\uc790 \ub4f1\ub85d:', data);\n      this.handleUserRegistration(data);\n    });\n    \n    this.socket.on('user_login', (data) => {\n      console.log('\uc0ac\uc6a9\uc790 \ub85c\uadf8\uc778:', data);\n      this.handleUserLogin(data);\n    });\n    \n    // \uac8c\uc784 \uc6d4\ub4dc \uc774\ubca4\ud2b8\n    this.socket.on('world_maintenance_started', (data) => {\n      console.log('\uc6d4\ub4dc \uc810\uac80 \uc2dc\uc791:', data);\n      this.handleMaintenanceStart(data);\n    });\n    \n    this.socket.on('world_maintenance_ended', (data) => {\n      console.log('\uc6d4\ub4dc \uc810\uac80 \uc885\ub8cc:', data);\n      this.handleMaintenanceEnd(data);\n    });\n  }\n  \n  // \uc774\ubca4\ud2b8 \ud578\ub4e4\ub7ec\ub4e4\n  handleUserRegistration(data) {\n    // \uc0ac\uc6a9\uc790 \ub4f1\ub85d \ucc98\ub9ac \ub85c\uc9c1\n    this.sendWelcomeEmail(data.user);\n    this.updateAnalytics('user_registered', data);\n  }\n  \n  handleUserLogin(data) {\n    // \ub85c\uadf8\uc778 \ucc98\ub9ac \ub85c\uc9c1\n    this.updateUserActivity(data.userId);\n    this.logSecurityEvent('user_login', data);\n  }\n  \n  handleMaintenanceStart(data) {\n    // \uc810\uac80 \uc2dc\uc791 \ucc98\ub9ac \ub85c\uc9c1\n    this.notifyUsers(data.worldId, 'maintenance_started');\n    this.updateWorldStatus(data.worldId, 'maintenance');\n  }\n  \n  handleMaintenanceEnd(data) {\n    // \uc810\uac80 \uc885\ub8cc \ucc98\ub9ac \ub85c\uc9c1\n    this.notifyUsers(data.worldId, 'maintenance_ended');\n    this.updateWorldStatus(data.worldId, 'active');\n  }\n}\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-\uc6f9\ud6c5-\uc124\uc815',
              children: '\ud83e\ude9d \uc6f9\ud6c5 \uc124\uc815',
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '1-\uc6f9\ud6c5-\uc5d4\ub4dc\ud3ec\uc778\ud2b8-\uc0dd\uc131',
              children: '1. \uc6f9\ud6c5 \uc5d4\ub4dc\ud3ec\uc778\ud2b8 \uc0dd\uc131',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "const express = require('express');\nconst crypto = require('crypto');\n\nclass WebhookHandler {\n  constructor(secret) {\n    this.secret = secret;\n    this.app = express();\n    this.setupMiddleware();\n    this.setupRoutes();\n  }\n  \n  setupMiddleware() {\n    this.app.use(express.json());\n    this.app.use(this.verifySignature.bind(this));\n  }\n  \n  // \uc6f9\ud6c5 \uc11c\uba85 \uac80\uc99d\n  verifySignature(req, res, next) {\n    const signature = req.headers['x-gatrix-signature'];\n    const payload = JSON.stringify(req.body);\n    const expectedSignature = crypto\n      .createHmac('sha256', this.secret)\n      .update(payload)\n      .digest('hex');\n    \n    if (signature !== expectedSignature) {\n      return res.status(401).json({ error: 'Invalid signature' });\n    }\n    \n    next();\n  }\n  \n  setupRoutes() {\n    // \uc0ac\uc6a9\uc790 \uad00\ub828 \uc6f9\ud6c5\n    this.app.post('/webhook/users', (req, res) => {\n      const { event, data } = req.body;\n      \n      switch (event) {\n        case 'user.created':\n          this.handleUserCreated(data);\n          break;\n        case 'user.updated':\n          this.handleUserUpdated(data);\n          break;\n        case 'user.deleted':\n          this.handleUserDeleted(data);\n          break;\n        default:\n          console.log('\uc54c \uc218 \uc5c6\ub294 \uc0ac\uc6a9\uc790 \uc774\ubca4\ud2b8:', event);\n      }\n      \n      res.status(200).json({ received: true });\n    });\n    \n    // \uac8c\uc784 \uc6d4\ub4dc \uad00\ub828 \uc6f9\ud6c5\n    this.app.post('/webhook/worlds', (req, res) => {\n      const { event, data } = req.body;\n      \n      switch (event) {\n        case 'world.maintenance_started':\n          this.handleWorldMaintenanceStarted(data);\n          break;\n        case 'world.maintenance_ended':\n          this.handleWorldMaintenanceEnded(data);\n          break;\n        default:\n          console.log('\uc54c \uc218 \uc5c6\ub294 \uc6d4\ub4dc \uc774\ubca4\ud2b8:', event);\n      }\n      \n      res.status(200).json({ received: true });\n    });\n  }\n  \n  // \uc774\ubca4\ud2b8 \ud578\ub4e4\ub7ec\ub4e4\n  handleUserCreated(data) {\n    console.log('\uc0c8 \uc0ac\uc6a9\uc790 \uc0dd\uc131:', data);\n    // \uc0ac\uc6a9\uc790 \uc0dd\uc131 \ud6c4\ucc98\ub9ac \ub85c\uc9c1\n  }\n  \n  handleUserUpdated(data) {\n    console.log('\uc0ac\uc6a9\uc790 \uc815\ubcf4 \uc5c5\ub370\uc774\ud2b8:', data);\n    // \uc0ac\uc6a9\uc790 \uc5c5\ub370\uc774\ud2b8 \ud6c4\ucc98\ub9ac \ub85c\uc9c1\n  }\n  \n  handleUserDeleted(data) {\n    console.log('\uc0ac\uc6a9\uc790 \uc0ad\uc81c:', data);\n    // \uc0ac\uc6a9\uc790 \uc0ad\uc81c \ud6c4\ucc98\ub9ac \ub85c\uc9c1\n  }\n  \n  handleWorldMaintenanceStarted(data) {\n    console.log('\uc6d4\ub4dc \uc810\uac80 \uc2dc\uc791:', data);\n    // \uc810\uac80 \uc2dc\uc791 \ud6c4\ucc98\ub9ac \ub85c\uc9c1\n  }\n  \n  handleWorldMaintenanceEnded(data) {\n    console.log('\uc6d4\ub4dc \uc810\uac80 \uc885\ub8cc:', data);\n    // \uc810\uac80 \uc885\ub8cc \ud6c4\ucc98\ub9ac \ub85c\uc9c1\n  }\n  \n  start(port = 3000) {\n    this.app.listen(port, () => {\n      console.log(`\uc6f9\ud6c5 \uc11c\ubc84\uac00 \ud3ec\ud2b8 ${port}\uc5d0\uc11c \uc2e4\ud589 \uc911\uc785\ub2c8\ub2e4.`);\n    });\n  }\n}\n\n// \uc6f9\ud6c5 \uc11c\ubc84 \uc2dc\uc791\nconst webhookHandler = new WebhookHandler(process.env.WEBHOOK_SECRET);\nwebhookHandler.start(3000);\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-gatrix\uc5d0\uc11c-\uc6f9\ud6c5-\uc124\uc815',
              children: '2. Gatrix\uc5d0\uc11c \uc6f9\ud6c5 \uc124\uc815',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// Gatrix\uc5d0\uc11c \uc6f9\ud6c5 \ub4f1\ub85d\nconst webhookConfig = {\n  url: 'https://your-service.com/webhook/users',\n  events: ['user.created', 'user.updated', 'user.deleted'],\n  secret: 'your-webhook-secret',\n  active: true\n};\n\n// \uc6f9\ud6c5 \ub4f1\ub85d API \ud638\ucd9c\nconst registeredWebhook = await apiClient.post('/api/v1/webhooks', webhookConfig);\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '\ufe0f-sdk-\uc0ac\uc6a9',
              children: '\ud83d\udee0\ufe0f SDK \uc0ac\uc6a9',
            }),
            '\n',
            (0, a.jsx)(n.h3, { id: '1-nodejs-sdk', children: '1. Node.js SDK' }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "const GatrixClient = require('@gatrix/nodejs-sdk');\n\nconst client = new GatrixClient({\n  apiKey: process.env.GATRIX_API_KEY,\n  baseURL: 'https://api.gatrix.com',\n  timeout: 5000\n});\n\n// \uc0ac\uc6a9\uc790 \uad00\ub9ac\nconst users = await client.users.list({ page: 1, limit: 10 });\nconst user = await client.users.create({\n  username: 'player123',\n  email: 'player@example.com'\n});\n\n// \uac8c\uc784 \uc6d4\ub4dc \uad00\ub9ac\nconst worlds = await client.worlds.list();\nconst world = await client.worlds.create({\n  worldId: 'world_001',\n  name: '\uba54\uc778 \uc6d4\ub4dc'\n});\n\n// \ud074\ub77c\uc774\uc5b8\ud2b8 \ubc84\uc804 \uad00\ub9ac\nconst versions = await client.versions.list({\n  channel: 'PC',\n  subChannel: 'Steam'\n});\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, { id: '2-python-sdk', children: '2. Python SDK' }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-python',
                children:
                  "from gatrix import GatrixClient\n\nclient = GatrixClient(\n    api_key='your-api-key',\n    base_url='https://api.gatrix.com'\n)\n\n# \uc0ac\uc6a9\uc790 \uad00\ub9ac\nusers = client.users.list(page=1, limit=10)\nuser = client.users.create(\n    username='player123',\n    email='player@example.com'\n)\n\n# \uac8c\uc784 \uc6d4\ub4dc \uad00\ub9ac\nworlds = client.worlds.list()\nworld = client.worlds.create(\n    world_id='world_001',\n    name='\uba54\uc778 \uc6d4\ub4dc'\n)\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-\ubaa8\ub2c8\ud130\ub9c1-\ubc0f-\ub85c\uae45',
              children: '\ud83d\udcca \ubaa8\ub2c8\ud130\ub9c1 \ubc0f \ub85c\uae45',
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '1-api-\ud638\ucd9c-\ubaa8\ub2c8\ud130\ub9c1',
              children: '1. API \ud638\ucd9c \ubaa8\ub2c8\ud130\ub9c1',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  'class APIMonitor {\n  constructor() {\n    this.metrics = {\n      totalRequests: 0,\n      successfulRequests: 0,\n      failedRequests: 0,\n      averageResponseTime: 0\n    };\n  }\n  \n  recordRequest(duration, success) {\n    this.metrics.totalRequests++;\n    if (success) {\n      this.metrics.successfulRequests++;\n    } else {\n      this.metrics.failedRequests++;\n    }\n    \n    // \ud3c9\uade0 \uc751\ub2f5 \uc2dc\uac04 \uacc4\uc0b0\n    this.metrics.averageResponseTime = \n      (this.metrics.averageResponseTime + duration) / 2;\n  }\n  \n  getMetrics() {\n    return {\n      ...this.metrics,\n      successRate: this.metrics.successfulRequests / this.metrics.totalRequests\n    };\n  }\n}\n',
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-\uc5d0\ub7ec-\ub85c\uae45',
              children: '2. \uc5d0\ub7ec \ub85c\uae45',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "class ErrorLogger {\n  constructor() {\n    this.errors = [];\n  }\n  \n  logError(error, context = {}) {\n    const errorEntry = {\n      timestamp: new Date().toISOString(),\n      message: error.message,\n      stack: error.stack,\n      context\n    };\n    \n    this.errors.push(errorEntry);\n    \n    // \uc678\ubd80 \ub85c\uae45 \uc11c\ube44\uc2a4\ub85c \uc804\uc1a1\n    this.sendToExternalLogger(errorEntry);\n  }\n  \n  sendToExternalLogger(errorEntry) {\n    // Sentry, LogRocket \ub4f1\uc5d0 \uc804\uc1a1\n    console.error('API \uc5d0\ub7ec:', errorEntry);\n  }\n}\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, { id: '-\uacb0\ub860', children: '\ud83c\udfaf \uacb0\ub860' }),
            '\n',
            (0, a.jsx)(n.p, {
              children:
                'Gatrix\uc758 API \uc2dc\uc2a4\ud15c\uc744 \ud65c\uc6a9\ud558\uba74 \uac15\ub825\ud558\uace0 \ud655\uc7a5 \uac00\ub2a5\ud55c \uac8c\uc784 \ud50c\ub7ab\ud3fc\uc744 \uad6c\ucd95\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4. \uc774 \uac00\uc774\ub4dc\uc758 \ub0b4\uc6a9\uc744 \ucc38\uace0\ud558\uc5ec:',
            }),
            '\n',
            (0, a.jsxs)(n.ol, {
              children: [
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: 'REST API' }),
                    '\ub85c \uae30\ubcf8\uc801\uc778 \ub370\uc774\ud130 \uad50\ud658 \uad6c\ud604',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: 'WebSocket' }),
                    '\uc73c\ub85c \uc2e4\uc2dc\uac04 \uc774\ubca4\ud2b8 \ucc98\ub9ac',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: '\uc6f9\ud6c5' }),
                    '\uc73c\ub85c \uc11c\ubc84 \uac04 \ube44\ub3d9\uae30 \ud1b5\uc2e0',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: 'SDK' }),
                    '\ub97c \uc0ac\uc6a9\ud55c \uac04\ud3b8\ud55c \ud1b5\ud569',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, a.jsx)(n.p, {
              children:
                '\uc774\ub7ec\ud55c \uae30\ub2a5\ub4e4\uc744 \uc870\ud569\ud558\uc5ec \uac8c\uc784 \ud50c\ub7ab\ud3fc\uc758 \uae30\ub2a5\uc744 \ud655\uc7a5\ud558\uace0 \uc0ac\uc6a9\uc790 \uacbd\ud5d8\uc744 \ud5a5\uc0c1\uc2dc\ud0ac \uc218 \uc788\uc2b5\ub2c8\ub2e4.',
            }),
            '\n',
            (0, a.jsx)(n.hr, {}),
            '\n',
            (0, a.jsxs)(n.p, {
              children: [(0, a.jsx)(n.strong, { children: '\uad00\ub828 \uc790\ub8cc' }), ':'],
            }),
            '\n',
            (0, a.jsxs)(n.ul, {
              children: [
                '\n',
                (0, a.jsx)(n.li, {
                  children: (0, a.jsx)(n.a, {
                    href: 'api/client-api',
                    children: 'API \ubb38\uc11c',
                  }),
                }),
                '\n',
                (0, a.jsx)(n.li, {
                  children: (0, a.jsx)(n.a, {
                    href: 'api/server-sdk-api',
                    children: '\uc11c\ubc84 SDK API',
                  }),
                }),
                '\n',
                (0, a.jsx)(n.li, {
                  children: (0, a.jsx)(n.a, {
                    href: 'https://github.com/your-org/gatrix',
                    children: 'GitHub \uc800\uc7a5\uc18c',
                  }),
                }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: n } = { ...(0, r.R)(), ...e.components };
        return n ? (0, a.jsx)(n, { ...e, children: (0, a.jsx)(c, { ...e }) }) : c(e);
      }
    },
    8453(e, n, t) {
      t.d(n, { R: () => i, x: () => o });
      var s = t(6540);
      const a = {},
        r = s.createContext(a);
      function i(e) {
        const n = s.useContext(r);
        return s.useMemo(
          function () {
            return 'function' == typeof e ? e(n) : { ...n, ...e };
          },
          [n, e]
        );
      }
      function o(e) {
        let n;
        return (
          (n = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(a)
              : e.components || a
            : i(e.components)),
          s.createElement(r.Provider, { value: n }, e.children)
        );
      }
    },
    8811(e) {
      e.exports = JSON.parse(
        '{"permalink":"/docs/ko/blog/api-integration-webhooks","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2021-08-26-welcome/index.md","source":"@site/blog/2021-08-26-welcome/index.md","title":"Gatrix API \ud1b5\ud569 \ubc0f \uc6f9\ud6c5 \uc124\uc815 \uc644\uc804 \uac00\uc774\ub4dc","description":"Gatrix\uc758 \uac15\ub825\ud55c API \uc2dc\uc2a4\ud15c\uc744 \ud65c\uc6a9\ud558\uc5ec \uc678\ubd80 \uc11c\ube44\uc2a4\uc640\uc758 \ud1b5\ud569\uc744 \uad6c\ud604\ud558\uace0, \uc2e4\uc2dc\uac04 \uc774\ubca4\ud2b8\ub97c \ucc98\ub9ac\ud558\ub294 \uc6f9\ud6c5\uc744 \uc124\uc815\ud558\ub294 \ubc29\ubc95\uc744 \uc54c\uc544\ubcf4\uaca0\uc2b5\ub2c8\ub2e4. \uc774 \uac00\uc774\ub4dc\ub97c \ud1b5\ud574 \uac8c\uc784 \ud50c\ub7ab\ud3fc\uc744 \ub354\uc6b1 \ud655\uc7a5 \uac00\ub2a5\ud558\uace0 \uc720\uc5f0\ud558\uac8c \ub9cc\ub4e4 \uc218 \uc788\uc2b5\ub2c8\ub2e4.","date":"2021-08-26T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/ko/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":false,"label":"API","permalink":"/docs/ko/blog/tags/api","description":"API documentation and usage"},{"inline":false,"label":"Tutorial","permalink":"/docs/ko/blog/tags/tutorial","description":"Step-by-step tutorials and guides"},{"inline":false,"label":"Tips","permalink":"/docs/ko/blog/tags/tips","description":"Tips and best practices"}],"readingTime":4.61,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/ko/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"api-integration-webhooks","title":"Gatrix API \ud1b5\ud569 \ubc0f \uc6f9\ud6c5 \uc124\uc815 \uc644\uc804 \uac00\uc774\ub4dc","authors":["gatrix-team"],"tags":["gatrix","api","tutorial","tips"]},"unlisted":false,"prevItem":{"title":"Gatrix Production Deployment Tips and Best Practices","permalink":"/docs/ko/blog/production-deployment-tips"},"nextItem":{"title":"Gatrix \uc2e4\uc2dc\uac04 \ucc44\ud305 \uc11c\ubc84 \uc644\uc804 \uc124\uc815 \uac00\uc774\ub4dc","permalink":"/docs/ko/blog/real-time-chat-server-setup"}}'
      );
    },
  },
]);
