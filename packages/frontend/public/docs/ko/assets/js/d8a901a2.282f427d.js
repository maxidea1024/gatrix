'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4217],
  {
    3130(e, n, s) {
      (s.r(n),
        s.d(n, {
          assets: () => o,
          contentTitle: () => c,
          default: () => h,
          frontMatter: () => i,
          metadata: () => t,
          toc: () => l,
        }));
      var t = s(8536),
        a = s(4848),
        r = s(8453);
      const i = {
          slug: 'performance-optimization-guide',
          title:
            'Gatrix ?\ufffd\ub2a5 \ucd5c\uc801???\ufffd\uc804 \uac00?\ufffd\ub4dc: \ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab??\uad6c\ucd95?\ufffd\uae30',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'performance', 'optimization', 'tips'],
        },
        c = void 0,
        o = { authorsImageUrls: [void 0] },
        l = [
          {
            value: '?? ?\ufffd\ub2a5 \ucd5c\uc801??\uac1c\uc694',
            id: '-\ub2a5-\ucd5c\uc801\uac1c\uc694',
            level: 2,
          },
          {
            value: '?\ufffd\ufffd\ufffd??\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801??',
            id: '\uc774\ubca0\uc2a4-\ucd5c\uc801',
            level: 2,
          },
          { value: '1. ?\ufffd\ub371???\ufffd\ub7b5', id: '1-\ub371\ub7b5', level: 3 },
          { value: '2. \ucffc\ub9ac \ucd5c\uc801??', id: '2-\ucffc\ub9ac-\ucd5c\uc801', level: 3 },
          {
            value: '3. ?\ufffd\uacb0 ?\ufffd \ucd5c\uc801??',
            id: '3-\uacb0--\ucd5c\uc801',
            level: 3,
          },
          { value: '??\uce90\uc2f1 ?\ufffd\ub7b5', id: '\uce90\uc2f1-\ub7b5', level: 2 },
          {
            value: '1. ?\ufffd\uce35 \uce90\uc2f1 ?\ufffd\ud0a4?\ufffd\ucc98',
            id: '1-\uce35-\uce90\uc2f1-\ud0a4\ucc98',
            level: 3,
          },
          {
            value: '2. \uce90\uc2dc ?\ufffd\ub7b5\ufffd?\uad6c\ud604',
            id: '2-\uce90\uc2dc-\ub7b5\uad6c\ud604',
            level: 3,
          },
          { value: '?? API \ucd5c\uc801??', id: '-api-\ucd5c\uc801', level: 2 },
          { value: '1. ?\ufffd\ub2f5 ?\ufffd\ucd95', id: '1-\ub2f5-\ucd95', level: 3 },
          {
            value: '2. API ?\ufffd\ub2f5 \ucd5c\uc801??',
            id: '2-api-\ub2f5-\ucd5c\uc801',
            level: 3,
          },
          { value: '3. API ?\ufffd\uc774??\ub9ac\ufffd???', id: '3-api-\uc774\ub9ac', level: 3 },
          {
            value: '?\ufffd\ufffd \ucc44\ud305 ?\ufffd\ubc84 \ucd5c\uc801??',
            id: '-\ucc44\ud305-\ubc84-\ucd5c\uc801',
            level: 2,
          },
          {
            value: '1. \uba54\uc2dc\uc9c0 \ube0c\ub85c?\ufffd\uce90?\ufffd\ud305 \ucd5c\uc801??',
            id: '1-\uba54\uc2dc\uc9c0-\ube0c\ub85c\uce90\ud305-\ucd5c\uc801',
            level: 3,
          },
          {
            value: '2. ?\ufffd\uacb0 \uad00\ufffd?\ucd5c\uc801??',
            id: '2-\uacb0-\uad00\ucd5c\uc801',
            level: 3,
          },
          {
            value: '?\ufffd\ufffd ?\ufffd\ub860?\ufffd\uc5d4??\ucd5c\uc801??',
            id: '-\ub860\uc5d4\ucd5c\uc801',
            level: 2,
          },
          { value: '1. \ubc88\ub4e4 \ucd5c\uc801??', id: '1-\ubc88\ub4e4-\ucd5c\uc801', level: 3 },
          {
            value: '2. \ucf54\ub4dc ?\ufffd\ud50c\ub9ac\ud305',
            id: '2-\ucf54\ub4dc-\ud50c\ub9ac\ud305',
            level: 3,
          },
          {
            value: '3. ?\ufffd\ufffd?\uc9c0 \ucd5c\uc801??',
            id: '3-\uc9c0-\ucd5c\uc801',
            level: 3,
          },
          {
            value: '?\ufffd\ufffd ?\ufffd\ub2a5 \ubaa8\ub2c8?\ufffd\ub9c1',
            id: '-\ub2a5-\ubaa8\ub2c8\ub9c1',
            level: 2,
          },
          {
            value: '1. ?\ufffd\ub2a5 \uba54\ud2b8\ufffd??\ufffd\uc9d1',
            id: '1-\ub2a5-\uba54\ud2b8\uc9d1',
            level: 3,
          },
          {
            value: '2. ?\ufffd\uc2dc\ufffd??\ufffd\ub2a5 ?\ufffd?\ufffd\ubcf4??',
            id: '2-\uc2dc\ub2a5-\ubcf4',
            level: 3,
          },
          { value: '?\ufffd\ufffd \uacb0\ub860', id: '-\uacb0\ub860', level: 2 },
        ];
      function d(e) {
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
          ...(0, r.R)(),
          ...e.components,
        };
        return (0, a.jsxs)(a.Fragment, {
          children: [
            (0, a.jsx)(n.p, {
              children:
                'Gatrix???\ufffd\ub2a5??\uadf9\ufffd??\ufffd\ud558???\ufffd\ubc31\ufffd??\ufffd\uc6a9?\ufffd\ufffd? \uc9c0?\ufffd\ud558??\ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab?\ufffd\uc744 \uad6c\ucd95?\ufffd\ub294 \ubc29\ubc95???\ufffd\uc544\ubcf4\uaca0?\ufffd\ub2c8?? ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801?\ufffd\ufffd???\uce90\uc2f1 ?\ufffd\ub7b5, \ub85c\ub4dc \ubc38\ub7f0?\ufffd\uae4c\uc9c0 \ubaa8\ub4e0 ?\ufffd\uc5ed???\ufffd\ub8f9?\ufffd\ub2e4.',
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-\ub2a5-\ucd5c\uc801\uac1c\uc694',
              children: '?? ?\ufffd\ub2a5 \ucd5c\uc801??\uac1c\uc694',
            }),
            '\n',
            (0, a.jsx)(n.p, {
              children:
                'Gatrix???\ufffd\ub2a5 \ucd5c\uc801?\ufffd\ub294 ?\ufffd\uc74c\ufffd?\uac19\ufffd? ?\ufffd\uc5ed?\ufffd\uc11c ?\ufffd\ub8e8?\ufffd\uc9d1?\ufffd\ub2e4:',
            }),
            '\n',
            (0, a.jsxs)(n.ul, {
              children: [
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    '**?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801??*: \ucffc\ub9ac ?\ufffd\ub2a5 ?\ufffd\uc0c1 \ufffd??\ufffd\ub371??- ',
                    (0, a.jsx)(n.strong, { children: '\uce90\uc2f1 ?\ufffd\ub7b5' }),
                    ': Redis\ufffd??\ufffd\uc6a9???\ufffd\uce35 \uce90\uc2f1',
                  ],
                }),
                '\n',
                (0, a.jsx)(n.li, {
                  children:
                    '**API \ucd5c\uc801??*: ?\ufffd\ub2f5 ?\ufffd\uac04 ?\ufffd\ucd95 \ufffd?\ucc98\ub9ac??\uc99d\ufffd?',
                }),
                '\n',
                (0, a.jsx)(n.li, {
                  children:
                    '**\ucc44\ud305 ?\ufffd\ubc84 \ucd5c\uc801??*: ?\ufffd\uc2dc\ufffd?\uba54\uc2dc\ufffd??\ufffd\ub2a5 ?\ufffd\uc0c1',
                }),
                '\n',
                (0, a.jsx)(n.li, {
                  children:
                    '**?\ufffd\ub860?\ufffd\uc5d4??\ucd5c\uc801??*: \ubc88\ub4e4 ?\ufffd\uae30 \ucd5c\uc801??\ufffd?\ub85c\ub529 ?\ufffd\ub3c4 ?\ufffd\uc0c1',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '\uc774\ubca0\uc2a4-\ucd5c\uc801',
              children:
                '?\ufffd\ufffd\ufffd??\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.h3, { id: '1-\ub371\ub7b5', children: '1. ?\ufffd\ub371???\ufffd\ub7b5' }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-sql',
                children:
                  '-- ?\ufffd\uc6a9???\ufffd\uc774\ufffd?\ucd5c\uc801??CREATE INDEX idx_users_email ON users(email);\nCREATE INDEX idx_users_created_at ON users(created_at);\nCREATE INDEX idx_users_status ON users(status);\nCREATE INDEX idx_users_role ON users(role);\n\n-- \ubcf5\ud569 ?\ufffd\ub371??CREATE INDEX idx_users_status_created ON users(status, created_at);\nCREATE INDEX idx_users_role_status ON users(role, status);\n\n-- \uba54\uc2dc\uc9c0 ?\ufffd\uc774\ufffd?\ucd5c\uc801??CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at);\nCREATE INDEX idx_messages_user_created ON messages(user_id, created_at);\nCREATE INDEX idx_messages_type ON messages(type);\n\n-- ?\ufffd\uc5c5 ?\ufffd\uc774\ufffd?\ucd5c\uc801??CREATE INDEX idx_jobs_status_scheduled ON jobs(status, scheduled_at);\nCREATE INDEX idx_jobs_type_status ON jobs(type, status);\nCREATE INDEX idx_jobs_created_at ON jobs(created_at);\n',
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-\ucffc\ub9ac-\ucd5c\uc801',
              children: '2. \ucffc\ub9ac \ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// \ube44\ud6a8?\ufffd\uc801??\ucffc\ub9ac\nconst users = await db('users')\n  .where('status', 'active')\n  .where('created_at', '>', '2024-01-01')\n  .orderBy('created_at', 'desc')\n  .limit(100);\n\n// \ucd5c\uc801?\ufffd\ub41c \ucffc\ub9ac\nconst users = await db('users')\n  .select('id', 'username', 'email', 'created_at')\n  .where('status', 'active')\n  .where('created_at', '>', '2024-01-01')\n  .orderBy('created_at', 'desc')\n  .limit(100);\n\n// ?\ufffd\uc774\uc9c0?\ufffd\uc774??\ucd5c\uc801??const users = await db('users')\n  .select('id', 'username', 'email', 'created_at')\n  .where('status', 'active')\n  .where('id', '>', lastId) // \ucee4\uc11c \uae30\ubc18 ?\ufffd\uc774\uc9c0?\ufffd\uc774??  .orderBy('id', 'asc')\n  .limit(100);\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '3-\uacb0--\ucd5c\uc801',
              children: '3. ?\ufffd\uacb0 ?\ufffd \ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// database.js\nconst knex = require('knex');\n\nconst db = knex({\n  client: 'mysql2',\n  connection: {\n    host: process.env.DB_HOST,\n    port: process.env.DB_PORT,\n    user: process.env.DB_USER,\n    password: process.env.DB_PASSWORD,\n    database: process.env.DB_NAME,\n    charset: 'utf8mb4'\n  },\n  pool: {\n    min: 2,\n    max: 20,\n    acquireTimeoutMillis: 60000,\n    createTimeoutMillis: 30000,\n    destroyTimeoutMillis: 5000,\n    idleTimeoutMillis: 600000,\n    reapIntervalMillis: 1000,\n    createRetryIntervalMillis: 200\n  },\n  acquireConnectionTimeout: 60000\n});\n\n// ?\ufffd\uacb0 ?\ufffd\ud0dc \ubaa8\ub2c8?\ufffd\ub9c1\nsetInterval(async () => {\n  try {\n    const stats = await db.raw('SHOW STATUS LIKE \"Threads_connected\"');\n    console.log('Active connections:', stats[0][0].Value);\n  } catch (error) {\n    console.error('Database connection error:', error);\n  }\n}, 30000);\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '\uce90\uc2f1-\ub7b5',
              children: '??\uce90\uc2f1 ?\ufffd\ub7b5',
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '1-\uce35-\uce90\uc2f1-\ud0a4\ucc98',
              children: '1. ?\ufffd\uce35 \uce90\uc2f1 ?\ufffd\ud0a4?\ufffd\ucc98',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// cache-manager.js\nconst Redis = require('ioredis');\nconst NodeCache = require('node-cache');\n\nclass CacheManager {\n  constructor() {\n    // L1 \uce90\uc2dc (\uba54\ubaa8\ufffd?\n    this.l1Cache = new NodeCache({\n      stdTTL: 60, // 1\ufffd?      checkperiod: 120,\n      useClones: false\n    });\n\n    // L2 \uce90\uc2dc (Redis)\n    this.l2Cache = new Redis({\n      host: process.env.REDIS_HOST,\n      port: process.env.REDIS_PORT,\n      password: process.env.REDIS_PASSWORD,\n      retryDelayOnFailover: 100,\n      maxRetriesPerRequest: 3,\n      lazyConnect: true\n    });\n\n    this.setupEventHandlers();\n  }\n\n  setupEventHandlers() {\n    this.l2Cache.on('error', (err) => {\n      console.error('Redis connection error:', err);\n    });\n\n    this.l2Cache.on('connect', () => {\n      console.log('Redis connected');\n    });\n  }\n\n  async get(key) {\n    // L1 \uce90\uc2dc?\ufffd\uc11c \uba3c\ufffd? ?\ufffd\uc778\n    let value = this.l1Cache.get(key);\n    if (value) {\n      return value;\n    }\n\n    // L2 \uce90\uc2dc?\ufffd\uc11c ?\ufffd\uc778\n    try {\n      const cached = await this.l2Cache.get(key);\n      if (cached) {\n        value = JSON.parse(cached);\n        // L1 \uce90\uc2dc???\ufffd??        this.l1Cache.set(key, value);\n        return value;\n      }\n    } catch (error) {\n      console.error('Redis get error:', error);\n    }\n\n    return null;\n  }\n\n  async set(key, value, ttl = 3600) {\n    // L1 \uce90\uc2dc???\ufffd??    this.l1Cache.set(key, value);\n\n    // L2 \uce90\uc2dc???\ufffd??    try {\n      await this.l2Cache.setex(key, ttl, JSON.stringify(value));\n    } catch (error) {\n      console.error('Redis set error:', error);\n    }\n  }\n\n  async invalidate(pattern) {\n    // L1 \uce90\uc2dc \ubb34\ud6a8??    this.l1Cache.flushAll();\n\n    // L2 \uce90\uc2dc \ubb34\ud6a8??    try {\n      const keys = await this.l2Cache.keys(pattern);\n      if (keys.length > 0) {\n        await this.l2Cache.del(...keys);\n      }\n    } catch (error) {\n      console.error('Redis invalidate error:', error);\n    }\n  }\n}\n\nmodule.exports = new CacheManager();\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-\uce90\uc2dc-\ub7b5\uad6c\ud604',
              children: '2. \uce90\uc2dc ?\ufffd\ub7b5\ufffd?\uad6c\ud604',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// cache-strategies.js\nclass CacheStrategies {\n  constructor(cacheManager) {\n    this.cache = cacheManager;\n  }\n\n  // ?\ufffd\uc6a9???\ufffd\ubcf4 \uce90\uc2f1\n  async getUser(userId) {\n    const cacheKey = `user:${userId}`;\n    \n    let user = await this.cache.get(cacheKey);\n    if (!user) {\n      user = await db('users').where('id', userId).first();\n      if (user) {\n        await this.cache.set(cacheKey, user, 1800); // 30\ufffd?      }\n    }\n    \n    return user;\n  }\n\n  // \uac8c\uc784 ?\ufffd\ub4dc \ubaa9\ub85d \uce90\uc2f1\n  async getGameWorlds() {\n    const cacheKey = 'game_worlds:public';\n    \n    let worlds = await this.cache.get(cacheKey);\n    if (!worlds) {\n      worlds = await db('game_worlds')\n        .where('visible', true)\n        .where('maintenance', false)\n        .orderBy('display_order', 'asc');\n      \n      await this.cache.set(cacheKey, worlds, 600); // 10\ufffd?    }\n    \n    return worlds;\n  }\n\n  // ?\ufffd\ub77c?\ufffd\uc5b8??\ubc84\uc804 \uce90\uc2f1\n  async getClientVersions(channel, subChannel) {\n    const cacheKey = `client_versions:${channel}:${subChannel}`;\n    \n    let versions = await this.cache.get(cacheKey);\n    if (!versions) {\n      let query = db('client_versions');\n      \n      if (channel) {\n        query = query.where('channel', channel);\n      }\n      if (subChannel) {\n        query = query.where('sub_channel', subChannel);\n      }\n      \n      versions = await query.orderBy('created_at', 'desc');\n      await this.cache.set(cacheKey, versions, 300); // 5\ufffd?    }\n    \n    return versions;\n  }\n\n  // \uba54\uc2dc\uc9c0 \uce90\uc2f1 (\ucd5c\uadfc \uba54\uc2dc\uc9c0)\n  async getRecentMessages(channelId, limit = 50) {\n    const cacheKey = `messages:recent:${channelId}:${limit}`;\n    \n    let messages = await this.cache.get(cacheKey);\n    if (!messages) {\n      messages = await db('messages')\n        .where('channel_id', channelId)\n        .orderBy('created_at', 'desc')\n        .limit(limit);\n      \n      await this.cache.set(cacheKey, messages, 60); // 1\ufffd?    }\n    \n    return messages;\n  }\n}\n\nmodule.exports = new CacheStrategies(cacheManager);\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, { id: '-api-\ucd5c\uc801', children: '?? API \ucd5c\uc801??' }),
            '\n',
            (0, a.jsx)(n.h3, { id: '1-\ub2f5-\ucd95', children: '1. ?\ufffd\ub2f5 ?\ufffd\ucd95' }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// compression.js\nconst compression = require('compression');\n\nconst compressionOptions = {\n  level: 6, // ?\ufffd\ucd95 ?\ufffd\ubca8 (1-9)\n  threshold: 1024, // 1KB ?\ufffd\uc0c1???\ufffd\ub9cc ?\ufffd\ucd95\n  filter: (req, res) => {\n    if (req.headers['x-no-compression']) {\n      return false;\n    }\n    return compression.filter(req, res);\n  }\n};\n\napp.use(compression(compressionOptions));\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-api-\ub2f5-\ucd5c\uc801',
              children: '2. API ?\ufffd\ub2f5 \ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// api-optimization.js\nclass APIOptimizer {\n  // ?\ufffd\ub2f5 ?\ufffd\uc774??\ucd5c\uc801??  optimizeUserResponse(user) {\n    return {\n      id: user.id,\n      username: user.username,\n      email: user.email,\n      status: user.status,\n      createdAt: user.created_at\n      // \ubbfc\uac10???\ufffd\ubcf4 ?\ufffd\uc678\n    };\n  }\n\n  // \ubc30\uce58 \ucc98\ub9ac\n  async batchProcessUsers(userIds) {\n    const users = await db('users')\n      .whereIn('id', userIds)\n      .select('id', 'username', 'email', 'status', 'created_at');\n    \n    return users.map(user => this.optimizeUserResponse(user));\n  }\n\n  // \ubcd1\ub82c \ucc98\ub9ac\n  async parallelDataFetch(userId) {\n    const [user, worlds, messages] = await Promise.all([\n      this.getUser(userId),\n      this.getGameWorlds(),\n      this.getRecentMessages(userId)\n    ]);\n\n    return { user, worlds, messages };\n  }\n\n  // ?\ufffd\uc774\uc9c0?\ufffd\uc774??\ucd5c\uc801??  async paginatedUsers(page = 1, limit = 20) {\n    const offset = (page - 1) * limit;\n    \n    const [users, total] = await Promise.all([\n      db('users')\n        .select('id', 'username', 'email', 'status', 'created_at')\n        .orderBy('created_at', 'desc')\n        .limit(limit)\n        .offset(offset),\n      db('users').count('* as total').first()\n    ]);\n\n    return {\n      users: users.map(user => this.optimizeUserResponse(user)),\n      pagination: {\n        page,\n        limit,\n        total: total.total,\n        pages: Math.ceil(total.total / limit)\n      }\n    };\n  }\n}\n\nmodule.exports = new APIOptimizer();\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '3-api-\uc774\ub9ac',
              children: '3. API ?\ufffd\uc774??\ub9ac\ufffd???',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// rate-limiting.js\nconst rateLimit = require('express-rate-limit');\nconst RedisStore = require('rate-limit-redis');\nconst Redis = require('ioredis');\n\nconst redis = new Redis({\n  host: process.env.REDIS_HOST,\n  port: process.env.REDIS_PORT,\n  password: process.env.REDIS_PASSWORD\n});\n\n// ?\ufffd\ubc18 API ?\ufffd\uc774??\ub9ac\ufffd???const generalLimiter = rateLimit({\n  store: new RedisStore({\n    sendCommand: (...args) => redis.call(...args),\n  }),\n  windowMs: 15 * 60 * 1000, // 15\ufffd?  max: 100, // \ucd5c\ufffd? 100 ?\ufffd\uccad\n  message: '?\ufffd\ubb34 \ub9ce\ufffd? ?\ufffd\uccad??\ubc1c\uc0dd?\ufffd\uc2b5?\ufffd\ub2e4.',\n  standardHeaders: true,\n  legacyHeaders: false,\n});\n\n// \ub85c\uadf8??API ?\ufffd\uc774??\ub9ac\ufffd???const loginLimiter = rateLimit({\n  store: new RedisStore({\n    sendCommand: (...args) => redis.call(...args),\n  }),\n  windowMs: 15 * 60 * 1000, // 15\ufffd?  max: 5, // \ucd5c\ufffd? 5???\ufffd\ub3c4\n  message: '\ub85c\uadf8???\ufffd\ub3c4 ?\ufffd\uc218\ufffd?\ucd08\uacfc?\ufffd\uc2b5?\ufffd\ub2e4.',\n  skipSuccessfulRequests: true,\n});\n\n// \ucc44\ud305 API ?\ufffd\uc774??\ub9ac\ufffd???const chatLimiter = rateLimit({\n  store: new RedisStore({\n    sendCommand: (...args) => redis.call(...args),\n  }),\n  windowMs: 60 * 1000, // 1\ufffd?  max: 30, // \ucd5c\ufffd? 30\ufffd?\uba54\uc2dc\uc9c0\n  message: '\uba54\uc2dc\uc9c0 ?\ufffd\uc1a1 ?\ufffd\ub3c4\ufffd?\ucd08\uacfc?\ufffd\uc2b5?\ufffd\ub2e4.',\n});\n\nmodule.exports = { generalLimiter, loginLimiter, chatLimiter };\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-\ucc44\ud305-\ubc84-\ucd5c\uc801',
              children: '?\ufffd\ufffd \ucc44\ud305 ?\ufffd\ubc84 \ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '1-\uba54\uc2dc\uc9c0-\ube0c\ub85c\uce90\ud305-\ucd5c\uc801',
              children:
                '1. \uba54\uc2dc\uc9c0 \ube0c\ub85c?\ufffd\uce90?\ufffd\ud305 \ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// broadcast-optimizer.js\nclass BroadcastOptimizer {\n  constructor() {\n    this.messageQueue = [];\n    this.batchSize = 1000;\n    this.flushInterval = 100; // 100ms\n    this.setupBatchProcessor();\n  }\n\n  setupBatchProcessor() {\n    setInterval(() => {\n      this.flushMessageQueue();\n    }, this.flushInterval);\n  }\n\n  // \uba54\uc2dc\uc9c0\ufffd??\ufffd\uc5d0 \ucd94\ufffd?\n  queueMessage(channelId, message) {\n    this.messageQueue.push({\n      channelId,\n      message,\n      timestamp: Date.now()\n    });\n\n    // \ubc30\uce58 ?\ufffd\uae30???\ufffd\ub2ec?\ufffd\uba74 \uc989\uc2dc \ucc98\ub9ac\n    if (this.messageQueue.length >= this.batchSize) {\n      this.flushMessageQueue();\n    }\n  }\n\n  // ?\ufffd\uc5d0 ?\ufffd\ub294 \uba54\uc2dc\uc9c0?\ufffd\uc744 \ubc30\uce58\ufffd?\ucc98\ub9ac\n  async flushMessageQueue() {\n    if (this.messageQueue.length === 0) return;\n\n    const messages = this.messageQueue.splice(0, this.batchSize);\n    const groupedMessages = this.groupMessagesByChannel(messages);\n\n    // \ucc44\ub110\ubcc4\ub85c \ubcd1\ub82c \ucc98\ub9ac\n    const promises = Object.entries(groupedMessages).map(([channelId, msgs]) =>\n      this.broadcastToChannel(channelId, msgs)\n    );\n\n    await Promise.all(promises);\n  }\n\n  // \ucc44\ub110\ubcc4\ub85c \uba54\uc2dc\uc9c0 \uadf8\ub8f9??  groupMessagesByChannel(messages) {\n    return messages.reduce((groups, msg) => {\n      if (!groups[msg.channelId]) {\n        groups[msg.channelId] = [];\n      }\n      groups[msg.channelId].push(msg.message);\n      return groups;\n    }, {});\n  }\n\n  // \ucc44\ub110??\uba54\uc2dc\uc9c0 \ube0c\ub85c?\ufffd\uce90?\ufffd\ud2b8\n  async broadcastToChannel(channelId, messages) {\n    const channel = io.to(channelId);\n    \n    // \uba54\uc2dc\uc9c0 ?\ufffd\ucd95\n    const compressedMessages = this.compressMessages(messages);\n    \n    // \ubc30\uce58 ?\ufffd\uc1a1\n    channel.emit('message_batch', {\n      channelId,\n      messages: compressedMessages,\n      count: messages.length\n    });\n  }\n\n  // \uba54\uc2dc\uc9c0 ?\ufffd\ucd95\n  compressMessages(messages) {\n    // MessagePack ?\ufffd\ub294 gzip ?\ufffd\ucd95\n    return messages.map(msg => ({\n      id: msg.id,\n      content: msg.content,\n      type: msg.type,\n      timestamp: msg.timestamp\n    }));\n  }\n}\n\nmodule.exports = new BroadcastOptimizer();\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-\uacb0-\uad00\ucd5c\uc801',
              children: '2. ?\ufffd\uacb0 \uad00\ufffd?\ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  '// connection-manager.js\nclass ConnectionManager {\n  constructor() {\n    this.connections = new Map();\n    this.channelConnections = new Map();\n    this.setupCleanup();\n  }\n\n  // ?\ufffd\uacb0 ?\ufffd\ub85d\n  addConnection(socketId, userId, channels = []) {\n    this.connections.set(socketId, {\n      userId,\n      channels,\n      connectedAt: Date.now(),\n      lastActivity: Date.now()\n    });\n\n    // \ucc44\ub110\ufffd??\ufffd\uacb0 \uad00\ufffd?    channels.forEach(channelId => {\n      if (!this.channelConnections.has(channelId)) {\n        this.channelConnections.set(channelId, new Set());\n      }\n      this.channelConnections.get(channelId).add(socketId);\n    });\n  }\n\n  // ?\ufffd\uacb0 ?\ufffd\uac70\n  removeConnection(socketId) {\n    const connection = this.connections.get(socketId);\n    if (connection) {\n      connection.channels.forEach(channelId => {\n        const channelConnections = this.channelConnections.get(channelId);\n        if (channelConnections) {\n          channelConnections.delete(socketId);\n          if (channelConnections.size === 0) {\n            this.channelConnections.delete(channelId);\n          }\n        }\n      });\n      this.connections.delete(socketId);\n    }\n  }\n\n  // \ucc44\ub110 ?\ufffd\uacb0????\uc870\ud68c\n  getChannelConnectionCount(channelId) {\n    return this.channelConnections.get(channelId)?.size || 0;\n  }\n\n  // ?\ufffd\uc131 ?\ufffd\uacb0 ??\uc870\ud68c\n  getActiveConnectionCount() {\n    return this.connections.size;\n  }\n\n  // ?\ufffd\ub9ac ?\ufffd\uc5c5\n  setupCleanup() {\n    setInterval(() => {\n      this.cleanupInactiveConnections();\n    }, 60000); // 1\ubd84\ub9c8??  }\n\n  cleanupInactiveConnections() {\n    const now = Date.now();\n    const inactiveThreshold = 30 * 60 * 1000; // 30\ufffd?\n    for (const [socketId, connection] of this.connections) {\n      if (now - connection.lastActivity > inactiveThreshold) {\n        this.removeConnection(socketId);\n      }\n    }\n  }\n}\n\nmodule.exports = new ConnectionManager();\n',
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-\ub860\uc5d4\ucd5c\uc801',
              children: '?\ufffd\ufffd ?\ufffd\ub860?\ufffd\uc5d4??\ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '1-\ubc88\ub4e4-\ucd5c\uc801',
              children: '1. \ubc88\ub4e4 \ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// vite.config.js\nimport { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport { visualizer } from 'rollup-plugin-visualizer';\n\nexport default defineConfig({\n  plugins: [\n    react(),\n    visualizer({\n      filename: 'dist/stats.html',\n      open: true,\n      gzipSize: true,\n      brotliSize: true,\n    })\n  ],\n  build: {\n    rollupOptions: {\n      output: {\n        manualChunks: {\n          vendor: ['react', 'react-dom'],\n          mui: ['@mui/material', '@mui/icons-material'],\n          utils: ['axios', 'swr', 'dayjs']\n        }\n      }\n    },\n    chunkSizeWarningLimit: 1000,\n    minify: 'terser',\n    terserOptions: {\n      compress: {\n        drop_console: true,\n        drop_debugger: true\n      }\n    }\n  },\n  server: {\n    hmr: {\n      overlay: false\n    }\n  }\n});\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-\ucf54\ub4dc-\ud50c\ub9ac\ud305',
              children: '2. \ucf54\ub4dc ?\ufffd\ud50c\ub9ac\ud305',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// App.jsx\nimport { lazy, Suspense } from 'react';\nimport { Routes, Route } from 'react-router-dom';\n\n// \uc9c0??\ub85c\ub529\nconst AdminPage = lazy(() => import('./pages/AdminPage'));\nconst JobsPage = lazy(() => import('./pages/JobsPage'));\nconst ChatPage = lazy(() => import('./pages/ChatPage'));\n\nfunction App() {\n  return (\n    <Suspense fallback={<div>Loading...</div>}>\n      <Routes>\n        <Route path=\"/admin\" element={<AdminPage />} />\n        <Route path=\"/jobs\" element={<JobsPage />} />\n        <Route path=\"/chat\" element={<ChatPage />} />\n      </Routes>\n    </Suspense>\n  );\n}\n\nexport default App;\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '3-\uc9c0-\ucd5c\uc801',
              children: '3. ?\ufffd\ufffd?\uc9c0 \ucd5c\uc801??',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  '// ImageOptimizer.jsx\nimport { useState, useEffect } from \'react\';\n\nconst ImageOptimizer = ({ src, alt, width, height, ...props }) => {\n  const [imageSrc, setImageSrc] = useState(\'\');\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    const img = new Image();\n    img.onload = () => {\n      setImageSrc(src);\n      setLoading(false);\n    };\n    img.src = src;\n  }, [src]);\n\n  if (loading) {\n    return <div className="image-placeholder" style={{ width, height }} />;\n  }\n\n  return (\n    <img\n      src={imageSrc}\n      alt={alt}\n      width={width}\n      height={height}\n      loading="lazy"\n      {...props}\n    />\n  );\n};\n\nexport default ImageOptimizer;\n',
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, {
              id: '-\ub2a5-\ubaa8\ub2c8\ub9c1',
              children: '?\ufffd\ufffd ?\ufffd\ub2a5 \ubaa8\ub2c8?\ufffd\ub9c1',
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '1-\ub2a5-\uba54\ud2b8\uc9d1',
              children: '1. ?\ufffd\ub2a5 \uba54\ud2b8\ufffd??\ufffd\uc9d1',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// performance-monitor.js\nconst prometheus = require('prom-client');\n\nclass PerformanceMonitor {\n  constructor() {\n    this.httpRequestDuration = new prometheus.Histogram({\n      name: 'http_request_duration_seconds',\n      help: 'Duration of HTTP requests in seconds',\n      labelNames: ['method', 'route', 'status_code'],\n      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]\n    });\n\n    this.databaseQueryDuration = new prometheus.Histogram({\n      name: 'database_query_duration_seconds',\n      help: 'Duration of database queries in seconds',\n      labelNames: ['query_type', 'table'],\n      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]\n    });\n\n    this.cacheHitRate = new prometheus.Counter({\n      name: 'cache_hits_total',\n      help: 'Total number of cache hits',\n      labelNames: ['cache_type']\n    });\n\n    this.cacheMissRate = new prometheus.Counter({\n      name: 'cache_misses_total',\n      help: 'Total number of cache misses',\n      labelNames: ['cache_type']\n    });\n\n    this.activeConnections = new prometheus.Gauge({\n      name: 'websocket_connections_active',\n      help: 'Number of active WebSocket connections'\n    });\n\n    this.messageThroughput = new prometheus.Counter({\n      name: 'messages_processed_total',\n      help: 'Total number of messages processed',\n      labelNames: ['channel']\n    });\n  }\n\n  // HTTP ?\ufffd\uccad ?\ufffd\uac04 \uce21\uc815\n  measureHttpRequest(method, route, statusCode, duration) {\n    this.httpRequestDuration\n      .labels(method, route, statusCode)\n      .observe(duration);\n  }\n\n  // ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucffc\ub9ac ?\ufffd\uac04 \uce21\uc815\n  measureDatabaseQuery(queryType, table, duration) {\n    this.databaseQueryDuration\n      .labels(queryType, table)\n      .observe(duration);\n  }\n\n  // \uce90\uc2dc ?\ufffd\ud2b8/\ubbf8\uc2a4 \uae30\ub85d\n  recordCacheHit(cacheType) {\n    this.cacheHitRate.labels(cacheType).inc();\n  }\n\n  recordCacheMiss(cacheType) {\n    this.cacheMissRate.labels(cacheType).inc();\n  }\n\n  // ?\ufffd\uc131 ?\ufffd\uacb0 ???\ufffd\ub370?\ufffd\ud2b8\n  updateActiveConnections(count) {\n    this.activeConnections.set(count);\n  }\n\n  // \uba54\uc2dc\uc9c0 \ucc98\ub9ac??\uae30\ub85d\n  recordMessageProcessed(channel) {\n    this.messageThroughput.labels(channel).inc();\n  }\n}\n\nmodule.exports = new PerformanceMonitor();\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h3, {
              id: '2-\uc2dc\ub2a5-\ubcf4',
              children: '2. ?\ufffd\uc2dc\ufffd??\ufffd\ub2a5 ?\ufffd?\ufffd\ubcf4??',
            }),
            '\n',
            (0, a.jsx)(n.pre, {
              children: (0, a.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// performance-dashboard.js\nconst express = require('express');\nconst { register } = require('./performance-monitor');\n\nconst app = express();\n\n// Prometheus \uba54\ud2b8\ufffd??\ufffd\ub4dc?\ufffd\uc778??app.get('/metrics', async (req, res) => {\n  res.set('Content-Type', register.contentType);\n  res.end(await register.metrics());\n});\n\n// ?\ufffd\ub2a5 ?\ufffd\ud0dc ?\ufffd\ub4dc?\ufffd\uc778??app.get('/health', async (req, res) => {\n  const health = {\n    status: 'healthy',\n    timestamp: new Date().toISOString(),\n    uptime: process.uptime(),\n    memory: process.memoryUsage(),\n    cpu: process.cpuUsage()\n  };\n\n  res.json(health);\n});\n\n// ?\ufffd\ub2a5 ?\ufffd\uacc4 ?\ufffd\ub4dc?\ufffd\uc778??app.get('/stats', async (req, res) => {\n  const stats = {\n    connections: connectionManager.getActiveConnectionCount(),\n    cache: {\n      hitRate: await getCacheHitRate(),\n      missRate: await getCacheMissRate()\n    },\n    database: {\n      activeConnections: await getDatabaseConnectionCount(),\n      queryTime: await getAverageQueryTime()\n    }\n  };\n\n  res.json(stats);\n});\n\nmodule.exports = app;\n",
              }),
            }),
            '\n',
            (0, a.jsx)(n.h2, { id: '-\uacb0\ub860', children: '?\ufffd\ufffd \uacb0\ub860' }),
            '\n',
            (0, a.jsx)(n.p, {
              children:
                '???\ufffd\ub2a5 \ucd5c\uc801??\uac00?\ufffd\ub4dc\ufffd??\ufffd\ud574 Gatrix???\ufffd\uc74c\ufffd?\uac19\ufffd? ?\ufffd\ub2a5???\ufffd\uc131?????\ufffd\uc2b5?\ufffd\ub2e4:',
            }),
            '\n',
            (0, a.jsxs)(n.ul, {
              children: [
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: 'API ?\ufffd\ub2f5 ?\ufffd\uac04' }),
                    ': ?\ufffd\uade0 50ms ?\ufffd\ud558',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, {
                      children: '?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucffc\ub9ac',
                    }),
                    ': \ubcf5\uc7a1??\ucffc\ub9ac??100ms ?\ufffd\ud558',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, {
                      children: '\ucc44\ud305 \uba54\uc2dc\uc9c0 \ucc98\ub9ac',
                    }),
                    ': \ucd08\ub2f9 100,000+ \uba54\uc2dc\uc9c0',
                  ],
                }),
                '\n',
                (0, a.jsxs)(n.li, {
                  children: [
                    (0, a.jsx)(n.strong, { children: '?\ufffd\uc2dc ?\ufffd\uacb0' }),
                    ': 100\ufffd??\ufffd\uc6a9??\uc9c0??- **\uce90\uc2dc ?\ufffd\ud2b8??*: 95% ?\ufffd\uc0c1',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, a.jsx)(n.p, {
              children:
                '?\ufffd\ub7ec??\ucd5c\uc801?\ufffd\ufffd? ?\ufffd\ud574 ?\ufffd\uc815?\ufffd\uc774\ufffd??\ufffd\uc7a5 \uac00?\ufffd\ud55c \uac8c\uc784 ?\ufffd\ub7ab?\ufffd\uc744 \uad6c\ucd95?????\ufffd\uc2b5?\ufffd\ub2e4!',
            }),
            '\n',
            (0, a.jsx)(n.hr, {}),
            '\n',
            (0, a.jsxs)(n.p, {
              children: [(0, a.jsx)(n.strong, { children: '\uad00???\ufffd\ub8cc' }), ':'],
            }),
            '\n',
            (0, a.jsxs)(n.ul, {
              children: [
                '\n',
                (0, a.jsx)(n.li, {
                  children: (0, a.jsx)(n.a, {
                    href: 'optimization/database',
                    children:
                      '?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801??\uac00?\ufffd\ub4dc',
                  }),
                }),
                '\n',
                (0, a.jsx)(n.li, {
                  children: (0, a.jsx)(n.a, {
                    href: 'optimization/caching',
                    children: '\uce90\uc2f1 ?\ufffd\ub7b5 \ubb38\uc11c',
                  }),
                }),
                '\n',
                (0, a.jsx)(n.li, {
                  children: (0, a.jsx)(n.a, {
                    href: 'https://github.com/your-org/gatrix',
                    children: 'GitHub ?\ufffd?\ufffd\uc18c',
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
        return n ? (0, a.jsx)(n, { ...e, children: (0, a.jsx)(d, { ...e }) }) : d(e);
      }
    },
    8453(e, n, s) {
      s.d(n, { R: () => i, x: () => c });
      var t = s(6540);
      const a = {},
        r = t.createContext(a);
      function i(e) {
        const n = t.useContext(r);
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
              ? e.components(a)
              : e.components || a
            : i(e.components)),
          t.createElement(r.Provider, { value: n }, e.children)
        );
      }
    },
    8536(e) {
      e.exports = JSON.parse(
        '{"permalink":"/docs/ko/blog/performance-optimization-guide","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2024-01-20-performance-optimization.md","source":"@site/blog/2024-01-20-performance-optimization.md","title":"Gatrix ?\ufffd\ub2a5 \ucd5c\uc801???\ufffd\uc804 \uac00?\ufffd\ub4dc: \ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab??\uad6c\ucd95?\ufffd\uae30","description":"Gatrix???\ufffd\ub2a5??\uadf9\ufffd??\ufffd\ud558???\ufffd\ubc31\ufffd??\ufffd\uc6a9?\ufffd\ufffd? \uc9c0?\ufffd\ud558??\ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab?\ufffd\uc744 \uad6c\ucd95?\ufffd\ub294 \ubc29\ubc95???\ufffd\uc544\ubcf4\uaca0?\ufffd\ub2c8?? ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801?\ufffd\ufffd???\uce90\uc2f1 ?\ufffd\ub7b5, \ub85c\ub4dc \ubc38\ub7f0?\ufffd\uae4c\uc9c0 \ubaa8\ub4e0 ?\ufffd\uc5ed???\ufffd\ub8f9?\ufffd\ub2e4.","date":"2024-01-20T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/ko/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":true,"label":"performance","permalink":"/docs/ko/blog/tags/performance"},{"inline":true,"label":"optimization","permalink":"/docs/ko/blog/tags/optimization"},{"inline":false,"label":"Tips","permalink":"/docs/ko/blog/tags/tips","description":"Tips and best practices"}],"readingTime":9.13,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/ko/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"performance-optimization-guide","title":"Gatrix ?\ufffd\ub2a5 \ucd5c\uc801???\ufffd\uc804 \uac00?\ufffd\ub4dc: \ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab??\uad6c\ucd95?\ufffd\uae30","authors":["gatrix-team"],"tags":["gatrix","performance","optimization","tips"]},"unlisted":false,"nextItem":{"title":"Gatrix ?\ufffd\ub85c?\ufffd\uc158 \ubc30\ud3ec\ufffd??\ufffd\ud55c ?\ufffd\uc218 ?\ufffd\uacfc \ubca0\uc2a4???\ufffd\ub799?\ufffd\uc2a4","permalink":"/docs/ko/blog/production-deployment-tips"}}'
      );
    },
  },
]);
