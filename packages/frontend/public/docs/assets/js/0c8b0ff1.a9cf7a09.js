'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [8411],
  {
    3740(e, n, r) {
      (r.r(n),
        r.d(n, {
          assets: () => l,
          contentTitle: () => o,
          default: () => p,
          frontMatter: () => i,
          metadata: () => t,
          toc: () => d,
        }));
      var t = r(5126),
        s = r(4848),
        a = r(8453);
      const i = {
          slug: 'production-deployment-tips',
          title:
            'Gatrix ?\ufffd\ub85c?\ufffd\uc158 \ubc30\ud3ec\ufffd??\ufffd\ud55c ?\ufffd\uc218 ?\ufffd\uacfc \ubca0\uc2a4???\ufffd\ub799?\ufffd\uc2a4',
          authors: ['gatrix-team'],
          tags: ['gatrix', 'tips', 'deployment', 'production'],
        },
        o = void 0,
        l = { authorsImageUrls: [void 0] },
        d = [
          {
            value: '?? \ubc30\ud3ec ??\uccb4\ud06c\ub9ac\uc2a4??',
            id: '-\ubc30\ud3ec-\uccb4\ud06c\ub9ac\uc2a4',
            level: 2,
          },
          {
            value: '1. ?\ufffd\uacbd ?\ufffd\uc815 \uac80\ufffd?',
            id: '1-\uacbd-\uc815-\uac80',
            level: 3,
          },
          {
            value: '2. \ubcf4\uc548 ?\ufffd\uc815 ?\ufffd\ufffd?',
            id: '2-\ubcf4\uc548-\uc815-',
            level: 3,
          },
          { value: '?\ufffd\ufffd Docker \ucd5c\uc801??', id: '-docker-\ucd5c\uc801', level: 2 },
          {
            value: '1. \uba40?\ufffd\uc2a4?\ufffd\uc774\uc9c0 \ube4c\ub4dc',
            id: '1-\uba40\uc2a4\uc774\uc9c0-\ube4c\ub4dc',
            level: 3,
          },
          {
            value: '2. Docker Compose ?\ufffd\ub85c?\ufffd\uc158 ?\ufffd\uc815',
            id: '2-docker-compose-\ub85c\uc158-\uc815',
            level: 3,
          },
          {
            value: '?\ufffd\ufffd \ubaa8\ub2c8?\ufffd\ub9c1 ?\ufffd\uc815',
            id: '-\ubaa8\ub2c8\ub9c1-\uc815',
            level: 2,
          },
          {
            value: '1. Prometheus \uba54\ud2b8\ufffd??\ufffd\uc9d1',
            id: '1-prometheus-\uba54\ud2b8\uc9d1',
            level: 3,
          },
          {
            value: '2. Grafana ?\ufffd?\ufffd\ubcf4???\ufffd\uc815',
            id: '2-grafana-\ubcf4\uc815',
            level: 3,
          },
          {
            value: '?\ufffd\ufffd \ubcf4\uc548 \uac15\ud654',
            id: '-\ubcf4\uc548-\uac15\ud654',
            level: 2,
          },
          { value: '1. SSL/TLS ?\ufffd\uc815', id: '1-ssltls-\uc815', level: 3 },
          {
            value: '2. ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ubcf4\uc548',
            id: '2-\uc774\ubca0\uc2a4-\ubcf4\uc548',
            level: 3,
          },
          {
            value: '?\ufffd\ufffd \ub85c\uae45 \ufffd??\ufffd\ub9bc',
            id: '-\ub85c\uae45-\ub9bc',
            level: 2,
          },
          {
            value: '1. \uad6c\uc870?\ufffd\ub41c \ub85c\uae45',
            id: '1-\uad6c\uc870\ub41c-\ub85c\uae45',
            level: 3,
          },
          { value: '2. ?\ufffd\ub9bc ?\ufffd\uc2a4??', id: '2-\ub9bc-\uc2a4', level: 3 },
          {
            value: '?\ufffd\ufffd \ubc31\uc5c5 \ufffd?\ubcf5\uad6c',
            id: '-\ubc31\uc5c5-\ubcf5\uad6c',
            level: 2,
          },
          {
            value: '1. ?\ufffd\ub3d9 \ubc31\uc5c5 ?\ufffd\ud06c\ub9bd\ud2b8',
            id: '1-\ub3d9-\ubc31\uc5c5-\ud06c\ub9bd\ud2b8',
            level: 3,
          },
          {
            value: '2. \ubcf5\uad6c ?\ufffd\ud06c\ub9bd\ud2b8',
            id: '2-\ubcf5\uad6c-\ud06c\ub9bd\ud2b8',
            level: 3,
          },
          {
            value: '?\ufffd\ufffd ?\ufffd\ub2a5 \ucd5c\uc801??',
            id: '-\ub2a5-\ucd5c\uc801',
            level: 2,
          },
          { value: '1. \uce90\uc2dc ?\ufffd\ub7b5', id: '1-\uce90\uc2dc-\ub7b5', level: 3 },
          {
            value: '2. ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801??',
            id: '2-\uc774\ubca0\uc2a4-\ucd5c\uc801',
            level: 3,
          },
          { value: '?\ufffd\ufffd \uacb0\ub860', id: '-\uacb0\ub860', level: 2 },
        ];
      function c(e) {
        const n = {
          a: 'a',
          code: 'code',
          h2: 'h2',
          h3: 'h3',
          hr: 'hr',
          li: 'li',
          ol: 'ol',
          p: 'p',
          pre: 'pre',
          strong: 'strong',
          ul: 'ul',
          ...(0, a.R)(),
          ...e.components,
        };
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(n.p, {
              children:
                'Gatrix\ufffd??\ufffd\ub85c?\ufffd\uc158 ?\ufffd\uacbd???\ufffd\uc804?\ufffd\uace0 ?\ufffd\uc728?\ufffd\uc73c\ufffd?\ubc30\ud3ec?\ufffd\uae30 ?\ufffd\ud55c ?\ufffd\uc804 ?\ufffd\uacfc \ubca0\uc2a4???\ufffd\ub799?\ufffd\uc2a4\ufffd?\uacf5\uc720?\ufffd\ub2c8?? ??\uac00?\ufffd\ub4dc\ufffd??\ufffd\ub77c?\ufffd\uba74 ?\ufffd\uc815?\ufffd\uc774\ufffd??\ufffd\uc7a5 \uac00?\ufffd\ud55c \uac8c\uc784 ?\ufffd\ub7ab?\ufffd\uc744 \uad6c\ucd95?????\ufffd\uc2b5?\ufffd\ub2e4.',
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '-\ubc30\ud3ec-\uccb4\ud06c\ub9ac\uc2a4',
              children: '?? \ubc30\ud3ec ??\uccb4\ud06c\ub9ac\uc2a4??',
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '1-\uacbd-\uc815-\uac80',
              children: '1. ?\ufffd\uacbd ?\ufffd\uc815 \uac80\ufffd?',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children:
                  '# ?\ufffd\uc218 ?\ufffd\uacbd \ubcc0???\ufffd\uc778\necho "=== ?\ufffd\uc218 ?\ufffd\uacbd \ubcc0??\uccb4\ud06c ==="\necho "NODE_ENV: $NODE_ENV"\necho "DB_HOST: $DB_HOST"\necho "REDIS_HOST: $REDIS_HOST"\necho "JWT_SECRET: ${JWT_SECRET:0:10}..."\necho "API_SECRET: ${API_SECRET:0:10}..."\n\n# ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 ?\ufffd\uacb0 ?\ufffd\uc2a4??npm run test:db-connection\n\n# Redis ?\ufffd\uacb0 ?\ufffd\uc2a4??npm run test:redis-connection\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '2-\ubcf4\uc548-\uc815-',
              children: '2. \ubcf4\uc548 ?\ufffd\uc815 ?\ufffd\ufffd?',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// \ubcf4\uc548 \ubbf8\ub4e4?\ufffd\uc5b4 ?\ufffd\uc815\nconst helmet = require('helmet');\nconst rateLimit = require('express-rate-limit');\n\napp.use(helmet({\n  contentSecurityPolicy: {\n    directives: {\n      defaultSrc: [\"'self'\"],\n      styleSrc: [\"'self'\", \"'unsafe-inline'\"],\n      scriptSrc: [\"'self'\"],\n      imgSrc: [\"'self'\", \"data:\", \"https:\"],\n    },\n  },\n  hsts: {\n    maxAge: 31536000,\n    includeSubDomains: true,\n    preload: true\n  }\n}));\n\n// Rate Limiting ?\ufffd\uc815\nconst limiter = rateLimit({\n  windowMs: 15 * 60 * 1000, // 15\ufffd?  max: 100, // \ucd5c\ufffd? 100 ?\ufffd\uccad\n  message: '?\ufffd\ubb34 \ub9ce\ufffd? ?\ufffd\uccad??\ubc1c\uc0dd?\ufffd\uc2b5?\ufffd\ub2e4. ?\ufffd\uc2dc ???\ufffd\uc2dc ?\ufffd\ub3c4?\ufffd\uc8fc?\ufffd\uc694.',\n  standardHeaders: true,\n  legacyHeaders: false,\n});\n\napp.use('/api/', limiter);\n",
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '-docker-\ucd5c\uc801',
              children: '?\ufffd\ufffd Docker \ucd5c\uc801??',
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '1-\uba40\uc2a4\uc774\uc9c0-\ube4c\ub4dc',
              children: '1. \uba40?\ufffd\uc2a4?\ufffd\uc774\uc9c0 \ube4c\ub4dc',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-dockerfile',
                children:
                  '# Dockerfile\nFROM node:18-alpine AS builder\n\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production && npm cache clean --force\n\nCOPY . .\nRUN npm run build\n\n# ?\ufffd\ub85c?\ufffd\uc158 ?\ufffd\ufffd?\uc9c0\nFROM node:18-alpine AS production\n\n# \ubcf4\uc548???\ufffd\ud55c non-root ?\ufffd\uc6a9???\ufffd\uc131\nRUN addgroup -g 1001 -S nodejs\nRUN adduser -S gatrix -u 1001\n\nWORKDIR /app\n\n# ?\ufffd\uc694???\ufffd\uc77c\ufffd?\ubcf5\uc0ac\nCOPY --from=builder --chown=gatrix:nodejs /app/dist ./dist\nCOPY --from=builder --chown=gatrix:nodejs /app/node_modules ./node_modules\nCOPY --from=builder --chown=gatrix:nodejs /app/package*.json ./\n\nUSER gatrix\n\nEXPOSE 3000 5000 3001\n\nCMD ["node", "dist/index.js"]\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '2-docker-compose-\ub85c\uc158-\uc815',
              children: '2. Docker Compose ?\ufffd\ub85c?\ufffd\uc158 ?\ufffd\uc815',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-yaml',
                children:
                  '# docker-compose.prod.yml\nversion: \'3.8\'\n\nservices:\n  nginx:\n    image: nginx:alpine\n    ports:\n      - "80:80"\n      - "443:443"\n    volumes:\n      - ./nginx.conf:/etc/nginx/nginx.conf\n      - ./ssl:/etc/nginx/ssl\n    depends_on:\n      - frontend\n      - backend\n      - chat-server\n\n  frontend:\n    build:\n      context: ./packages/frontend\n      dockerfile: Dockerfile.prod\n    environment:\n      - NODE_ENV=production\n      - REACT_APP_API_URL=https://api.gatrix.com\n    restart: unless-stopped\n\n  backend:\n    build:\n      context: ./packages/backend\n      dockerfile: Dockerfile.prod\n    environment:\n      - NODE_ENV=production\n      - DB_HOST=mysql\n      - REDIS_HOST=redis\n    depends_on:\n      - mysql\n      - redis\n    restart: unless-stopped\n\n  chat-server:\n    build:\n      context: ./packages/chat-server\n      dockerfile: Dockerfile.prod\n    environment:\n      - NODE_ENV=production\n      - DB_HOST=mysql\n      - REDIS_HOST=redis\n    depends_on:\n      - mysql\n      - redis\n    restart: unless-stopped\n\n  mysql:\n    image: mysql:8.0\n    environment:\n      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}\n      - MYSQL_DATABASE=${DB_NAME}\n      - MYSQL_USER=${DB_USER}\n      - MYSQL_PASSWORD=${DB_PASSWORD}\n    volumes:\n      - mysql_data:/var/lib/mysql\n      - ./mysql/conf.d:/etc/mysql/conf.d\n    restart: unless-stopped\n\n  redis:\n    image: redis:7-alpine\n    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}\n    volumes:\n      - redis_data:/data\n    restart: unless-stopped\n\nvolumes:\n  mysql_data:\n  redis_data:\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '-\ubaa8\ub2c8\ub9c1-\uc815',
              children: '?\ufffd\ufffd \ubaa8\ub2c8?\ufffd\ub9c1 ?\ufffd\uc815',
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '1-prometheus-\uba54\ud2b8\uc9d1',
              children: '1. Prometheus \uba54\ud2b8\ufffd??\ufffd\uc9d1',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// metrics.js\nconst prometheus = require('prom-client');\n\n// \uae30\ubcf8 \uba54\ud2b8\ufffd??\ufffd\uc9d1\nconst register = new prometheus.Registry();\nprometheus.collectDefaultMetrics({ register });\n\n// \ucee4\uc2a4?\ufffd \uba54\ud2b8\ufffd?const httpRequestDuration = new prometheus.Histogram({\n  name: 'http_request_duration_seconds',\n  help: 'Duration of HTTP requests in seconds',\n  labelNames: ['method', 'route', 'status_code'],\n  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]\n});\n\nconst activeConnections = new prometheus.Gauge({\n  name: 'websocket_connections_active',\n  help: 'Number of active WebSocket connections'\n});\n\nconst jobQueueSize = new prometheus.Gauge({\n  name: 'job_queue_size',\n  help: 'Number of jobs in queue',\n  labelNames: ['queue_name']\n});\n\nregister.registerMetric(httpRequestDuration);\nregister.registerMetric(activeConnections);\nregister.registerMetric(jobQueueSize);\n\nmodule.exports = { register, httpRequestDuration, activeConnections, jobQueueSize };\n",
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '2-grafana-\ubcf4\uc815',
              children: '2. Grafana ?\ufffd?\ufffd\ubcf4???\ufffd\uc815',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-json',
                children:
                  '{\n  "dashboard": {\n    "title": "Gatrix Production Dashboard",\n    "panels": [\n      {\n        "title": "Request Rate",\n        "type": "graph",\n        "targets": [\n          {\n            "expr": "rate(http_requests_total[5m])",\n            "legendFormat": "{{method}} {{route}}"\n          }\n        ]\n      },\n      {\n        "title": "Response Time",\n        "type": "graph",\n        "targets": [\n          {\n            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",\n            "legendFormat": "95th percentile"\n          }\n        ]\n      },\n      {\n        "title": "Active Connections",\n        "type": "singlestat",\n        "targets": [\n          {\n            "expr": "websocket_connections_active"\n          }\n        ]\n      },\n      {\n        "title": "Job Queue Size",\n        "type": "graph",\n        "targets": [\n          {\n            "expr": "job_queue_size",\n            "legendFormat": "{{queue_name}}"\n          }\n        ]\n      }\n    ]\n  }\n}\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '-\ubcf4\uc548-\uac15\ud654',
              children: '?\ufffd\ufffd \ubcf4\uc548 \uac15\ud654',
            }),
            '\n',
            (0, s.jsx)(n.h3, { id: '1-ssltls-\uc815', children: '1. SSL/TLS ?\ufffd\uc815' }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-nginx',
                children:
                  '# nginx.conf\nserver {\n    listen 80;\n    server_name gatrix.com www.gatrix.com;\n    return 301 https://$server_name$request_uri;\n}\n\nserver {\n    listen 443 ssl http2;\n    server_name gatrix.com www.gatrix.com;\n\n    ssl_certificate /etc/nginx/ssl/cert.pem;\n    ssl_certificate_key /etc/nginx/ssl/key.pem;\n    \n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;\n    ssl_prefer_server_ciphers off;\n    \n    ssl_session_cache shared:SSL:10m;\n    ssl_session_timeout 10m;\n    \n    # HSTS\n    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n    \n    # \ubcf4\uc548 ?\ufffd\ub354\n    add_header X-Frame-Options DENY;\n    add_header X-Content-Type-Options nosniff;\n    add_header X-XSS-Protection "1; mode=block";\n    add_header Referrer-Policy "strict-origin-when-cross-origin";\n\n    location / {\n        proxy_pass http://frontend;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n\n    location /api/ {\n        proxy_pass http://backend;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n\n    location /socket.io/ {\n        proxy_pass http://chat-server;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '2-\uc774\ubca0\uc2a4-\ubcf4\uc548',
              children: '2. ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ubcf4\uc548',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-sql',
                children:
                  "-- MySQL \ubcf4\uc548 ?\ufffd\uc815\n-- \ub8e8\ud2b8 ?\ufffd\uc6a9??\ube44\ufffd?\ubc88\ud638 \ubcc0\ufffd?ALTER USER 'root'@'localhost' IDENTIFIED BY 'strong_password_here';\n\n-- \ubd88\ud544?\ufffd\ud55c ?\ufffd\uc6a9???\ufffd\uac70\nDROP USER IF EXISTS ''@'localhost';\nDROP USER IF EXISTS ''@'%';\n\n-- ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4\ufffd??\ufffd\uc6a9???\ufffd\uc131\nCREATE USER 'gatrix_app'@'%' IDENTIFIED BY 'app_password';\nCREATE USER 'gatrix_readonly'@'%' IDENTIFIED BY 'readonly_password';\n\n-- \uad8c\ud55c \ubd80??GRANT SELECT, INSERT, UPDATE, DELETE ON gatrix.* TO 'gatrix_app'@'%';\nGRANT SELECT ON gatrix.* TO 'gatrix_readonly'@'%';\n\n-- ?\ufffd\uaca9 \ub8e8\ud2b8 ?\ufffd\uadfc \ube44\ud65c?\ufffd\ud654\nDELETE FROM mysql.user WHERE User='root' AND Host='%';\nFLUSH PRIVILEGES;\n",
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '-\ub85c\uae45-\ub9bc',
              children: '?\ufffd\ufffd \ub85c\uae45 \ufffd??\ufffd\ub9bc',
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '1-\uad6c\uc870\ub41c-\ub85c\uae45',
              children: '1. \uad6c\uc870?\ufffd\ub41c \ub85c\uae45',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// logger.js\nconst winston = require('winston');\nconst DailyRotateFile = require('winston-daily-rotate-file');\n\nconst logger = winston.createLogger({\n  level: process.env.LOG_LEVEL || 'info',\n  format: winston.format.combine(\n    winston.format.timestamp(),\n    winston.format.errors({ stack: true }),\n    winston.format.json()\n  ),\n  transports: [\n    new DailyRotateFile({\n      filename: 'logs/application-%DATE%.log',\n      datePattern: 'YYYY-MM-DD',\n      maxSize: '20m',\n      maxFiles: '14d',\n      zippedArchive: true\n    }),\n    new DailyRotateFile({\n      filename: 'logs/error-%DATE%.log',\n      datePattern: 'YYYY-MM-DD',\n      level: 'error',\n      maxSize: '20m',\n      maxFiles: '30d',\n      zippedArchive: true\n    })\n  ]\n});\n\n// ?\ufffd\ub85c?\ufffd\uc158?\ufffd\uc11c??\ucf58\uc194 \ub85c\uadf8 ?\ufffd\uac70\nif (process.env.NODE_ENV !== 'production') {\n  logger.add(new winston.transports.Console({\n    format: winston.format.simple()\n  }));\n}\n\nmodule.exports = logger;\n",
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '2-\ub9bc-\uc2a4',
              children: '2. ?\ufffd\ub9bc ?\ufffd\uc2a4??',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// notification.js\nconst nodemailer = require('nodemailer');\nconst axios = require('axios');\n\nclass NotificationService {\n  constructor() {\n    this.emailTransporter = nodemailer.createTransporter({\n      service: 'gmail',\n      auth: {\n        user: process.env.EMAIL_USER,\n        pass: process.env.EMAIL_PASS\n      }\n    });\n  }\n\n  async sendCriticalAlert(message, details = {}) {\n    // ?\ufffd\uba54???\ufffd\ub9bc\n    await this.sendEmail({\n      to: process.env.ADMIN_EMAIL,\n      subject: `[CRITICAL] Gatrix Alert: ${message}`,\n      html: `\n        <h2>Critical Alert</h2>\n        <p><strong>Message:</strong> ${message}</p>\n        <p><strong>Time:</strong> ${new Date().toISOString()}</p>\n        <p><strong>Details:</strong></p>\n        <pre>${JSON.stringify(details, null, 2)}</pre>\n      `\n    });\n\n    // Slack ?\ufffd\ub9bc\n    await this.sendSlackNotification({\n      text: `?\ufffd\ufffd *Critical Alert*: ${message}`,\n      attachments: [{\n        color: 'danger',\n        fields: [\n          { title: 'Time', value: new Date().toISOString(), short: true },\n          { title: 'Details', value: JSON.stringify(details), short: false }\n        ]\n      }]\n    });\n  }\n\n  async sendEmail({ to, subject, html }) {\n    return this.emailTransporter.sendMail({\n      from: process.env.EMAIL_USER,\n      to,\n      subject,\n      html\n    });\n  }\n\n  async sendSlackNotification(payload) {\n    return axios.post(process.env.SLACK_WEBHOOK_URL, payload);\n  }\n}\n\nmodule.exports = new NotificationService();\n",
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '-\ubc31\uc5c5-\ubcf5\uad6c',
              children: '?\ufffd\ufffd \ubc31\uc5c5 \ufffd?\ubcf5\uad6c',
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '1-\ub3d9-\ubc31\uc5c5-\ud06c\ub9bd\ud2b8',
              children: '1. ?\ufffd\ub3d9 \ubc31\uc5c5 ?\ufffd\ud06c\ub9bd\ud2b8',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children:
                  '#!/bin/bash\n# backup.sh\n\nBACKUP_DIR="/backups/gatrix"\nDATE=$(date +%Y%m%d_%H%M%S)\nDB_NAME="gatrix"\nDB_USER="gatrix_app"\nDB_PASS="app_password"\n\n# \ubc31\uc5c5 ?\ufffd\ub809?\ufffd\ub9ac ?\ufffd\uc131\nmkdir -p $BACKUP_DIR\n\n# ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ubc31\uc5c5\nmysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_$DATE.sql\n\n# Redis \ubc31\uc5c5\nredis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb\n\n# ?\ufffd\ud50c\ub9ac\ufffd??\ufffd\uc158 ?\ufffd\uc77c \ubc31\uc5c5\ntar -czf $BACKUP_DIR/app_$DATE.tar.gz /app/dist /app/uploads\n\n# ?\ufffd\ub798??\ubc31\uc5c5 ?\ufffd\uc77c ??\ufffd\ufffd (7???\ufffd\uc0c1)\nfind $BACKUP_DIR -name "*.sql" -mtime +7 -delete\nfind $BACKUP_DIR -name "*.rdb" -mtime +7 -delete\nfind $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete\n\necho "Backup completed: $DATE"\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '2-\ubcf5\uad6c-\ud06c\ub9bd\ud2b8',
              children: '2. \ubcf5\uad6c ?\ufffd\ud06c\ub9bd\ud2b8',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-bash',
                children:
                  '#!/bin/bash\n# restore.sh\n\nBACKUP_DIR="/backups/gatrix"\nBACKUP_DATE=$1\n\nif [ -z "$BACKUP_DATE" ]; then\n    echo "Usage: $0 <backup_date>"\n    echo "Available backups:"\n    ls -la $BACKUP_DIR/*.sql | awk \'{print $9}\' | sed \'s/.*db_//\' | sed \'s/\\.sql//\'\n    exit 1\nfi\n\nDB_NAME="gatrix"\nDB_USER="gatrix_app"\nDB_PASS="app_password"\n\n# ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ubcf5\uad6c\nmysql -u $DB_USER -p$DB_PASS $DB_NAME < $BACKUP_DIR/db_$BACKUP_DATE.sql\n\n# Redis \ubcf5\uad6c\nredis-cli --rdb $BACKUP_DIR/redis_$BACKUP_DATE.rdb\n\n# ?\ufffd\ud50c\ub9ac\ufffd??\ufffd\uc158 ?\ufffd\uc77c \ubcf5\uad6c\ntar -xzf $BACKUP_DIR/app_$BACKUP_DATE.tar.gz -C /\n\necho "Restore completed: $BACKUP_DATE"\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, {
              id: '-\ub2a5-\ucd5c\uc801',
              children: '?\ufffd\ufffd ?\ufffd\ub2a5 \ucd5c\uc801??',
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '1-\uce90\uc2dc-\ub7b5',
              children: '1. \uce90\uc2dc ?\ufffd\ub7b5',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-javascript',
                children:
                  "// cache-strategy.js\nconst Redis = require('ioredis');\n\nclass CacheStrategy {\n  constructor() {\n    this.redis = new Redis({\n      host: process.env.REDIS_HOST,\n      port: process.env.REDIS_PORT,\n      password: process.env.REDIS_PASSWORD,\n      retryDelayOnFailover: 100,\n      maxRetriesPerRequest: 3\n    });\n  }\n\n  // \uce90\uc2dc ???\ufffd\ub7b5\n  getCacheKey(type, identifier, params = {}) {\n    const paramString = Object.keys(params)\n      .sort()\n      .map(key => `${key}:${params[key]}`)\n      .join('|');\n    \n    return `gatrix:${type}:${identifier}:${paramString}`;\n  }\n\n  // \uce90\uc2dc ?\ufffd\uc815\n  async set(key, value, ttl = 3600) {\n    const serialized = JSON.stringify(value);\n    return this.redis.setex(key, ttl, serialized);\n  }\n\n  // \uce90\uc2dc \uc870\ud68c\n  async get(key) {\n    const value = await this.redis.get(key);\n    return value ? JSON.parse(value) : null;\n  }\n\n  // \uce90\uc2dc \ubb34\ud6a8??  async invalidate(pattern) {\n    const keys = await this.redis.keys(pattern);\n    if (keys.length > 0) {\n      return this.redis.del(...keys);\n    }\n  }\n}\n\nmodule.exports = new CacheStrategy();\n",
              }),
            }),
            '\n',
            (0, s.jsx)(n.h3, {
              id: '2-\uc774\ubca0\uc2a4-\ucd5c\uc801',
              children: '2. ?\ufffd\uc774?\ufffd\ubca0?\ufffd\uc2a4 \ucd5c\uc801??',
            }),
            '\n',
            (0, s.jsx)(n.pre, {
              children: (0, s.jsx)(n.code, {
                className: 'language-sql',
                children:
                  '-- ?\ufffd\ub371??\ucd5c\uc801??CREATE INDEX idx_users_email ON users(email);\nCREATE INDEX idx_users_created_at ON users(created_at);\nCREATE INDEX idx_messages_channel_id ON messages(channel_id);\nCREATE INDEX idx_messages_created_at ON messages(created_at);\nCREATE INDEX idx_jobs_status ON jobs(status);\nCREATE INDEX idx_jobs_scheduled_at ON jobs(scheduled_at);\n\n-- ?\ufffd\ud2f0?\ufffd\ub2dd (\uba54\uc2dc\uc9c0 ?\ufffd\uc774\ufffd?\nALTER TABLE messages PARTITION BY RANGE (YEAR(created_at)) (\n  PARTITION p2024 VALUES LESS THAN (2025),\n  PARTITION p2025 VALUES LESS THAN (2026),\n  PARTITION p2026 VALUES LESS THAN (2027)\n);\n',
              }),
            }),
            '\n',
            (0, s.jsx)(n.h2, { id: '-\uacb0\ub860', children: '?\ufffd\ufffd \uacb0\ub860' }),
            '\n',
            (0, s.jsx)(n.p, {
              children:
                '??\uac00?\ufffd\ub4dc\ufffd??\ufffd\ub77c Gatrix\ufffd??\ufffd\ub85c?\ufffd\uc158??\ubc30\ud3ec?\ufffd\uba74:',
            }),
            '\n',
            (0, s.jsxs)(n.ol, {
              children: [
                '\n',
                (0, s.jsx)(n.li, {
                  children:
                    '**?\ufffd\uc815??*: \ubaa8\ub2c8?\ufffd\ub9c1\ufffd??\ufffd\ub9bc?\ufffd\ub85c \ubb38\uc81c\ufffd?\ube60\ub974\ufffd?\uac10\ufffd?',
                }),
                '\n',
                (0, s.jsx)(n.li, {
                  children:
                    '**\ubcf4\uc548??*: ?\ufffd\uce35 \ubcf4\uc548?\ufffd\ub85c ?\ufffd\uc2a4?\ufffd\uc744 \ubcf4\ud638',
                }),
                '\n',
                (0, s.jsx)(n.li, {
                  children:
                    '**?\ufffd\uc7a5??*: \uce90\uc2dc?\ufffd \ucd5c\uc801?\ufffd\ub85c ?\ufffd\ub2a5 ?\ufffd\uc0c1',
                }),
                '\n',
                (0, s.jsx)(n.li, {
                  children:
                    '**\ubcf5\uad6c??*: \ubc31\uc5c5\ufffd?\ubcf5\uad6c\ufffd??\ufffd\uc774??\ubcf4\ud638',
                }),
                '\n',
              ],
            }),
            '\n',
            (0, s.jsx)(n.p, {
              children:
                '?\ufffd\ub7ec??\ubca0\uc2a4???\ufffd\ub799?\ufffd\uc2a4\ufffd??\ufffd\uc6a9?\ufffd\uc5ec ?\ufffd\uc815?\ufffd\uc774\ufffd??\ufffd\uc7a5 \uac00?\ufffd\ud55c \uac8c\uc784 ?\ufffd\ub7ab?\ufffd\uc744 \uad6c\ucd95?\ufffd\uc138??',
            }),
            '\n',
            (0, s.jsx)(n.hr, {}),
            '\n',
            (0, s.jsxs)(n.p, {
              children: [(0, s.jsx)(n.strong, { children: '\uad00???\ufffd\ub8cc' }), ':'],
            }),
            '\n',
            (0, s.jsxs)(n.ul, {
              children: [
                '\n',
                (0, s.jsx)(n.li, {
                  children: (0, s.jsx)(n.a, {
                    href: 'deployment/docker',
                    children: 'Docker ?\ufffd\uc815 \uac00?\ufffd\ub4dc',
                  }),
                }),
                '\n',
                (0, s.jsx)(n.li, {
                  children: (0, s.jsx)(n.a, {
                    href: 'monitoring/setup',
                    children: '\ubaa8\ub2c8?\ufffd\ub9c1 ?\ufffd\uc815',
                  }),
                }),
                '\n',
                (0, s.jsx)(n.li, {
                  children: (0, s.jsx)(n.a, {
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
      function p(e = {}) {
        const { wrapper: n } = { ...(0, a.R)(), ...e.components };
        return n ? (0, s.jsx)(n, { ...e, children: (0, s.jsx)(c, { ...e }) }) : c(e);
      }
    },
    5126(e) {
      e.exports = JSON.parse(
        '{"permalink":"/docs/blog/production-deployment-tips","editUrl":"https://github.com/your-org/gatrix/tree/main/docs/blog/2024-01-15-production-deployment-tips.md","source":"@site/blog/2024-01-15-production-deployment-tips.md","title":"Gatrix ?\ufffd\ub85c?\ufffd\uc158 \ubc30\ud3ec\ufffd??\ufffd\ud55c ?\ufffd\uc218 ?\ufffd\uacfc \ubca0\uc2a4???\ufffd\ub799?\ufffd\uc2a4","description":"Gatrix\ufffd??\ufffd\ub85c?\ufffd\uc158 ?\ufffd\uacbd???\ufffd\uc804?\ufffd\uace0 ?\ufffd\uc728?\ufffd\uc73c\ufffd?\ubc30\ud3ec?\ufffd\uae30 ?\ufffd\ud55c ?\ufffd\uc804 ?\ufffd\uacfc \ubca0\uc2a4???\ufffd\ub799?\ufffd\uc2a4\ufffd?\uacf5\uc720?\ufffd\ub2c8?? ??\uac00?\ufffd\ub4dc\ufffd??\ufffd\ub77c?\ufffd\uba74 ?\ufffd\uc815?\ufffd\uc774\ufffd??\ufffd\uc7a5 \uac00?\ufffd\ud55c \uac8c\uc784 ?\ufffd\ub7ab?\ufffd\uc744 \uad6c\ucd95?????\ufffd\uc2b5?\ufffd\ub2e4.","date":"2024-01-15T00:00:00.000Z","tags":[{"inline":false,"label":"Gatrix","permalink":"/docs/blog/tags/gatrix","description":"Gatrix game platform management system"},{"inline":false,"label":"Tips","permalink":"/docs/blog/tags/tips","description":"Tips and best practices"},{"inline":true,"label":"deployment","permalink":"/docs/blog/tags/deployment"},{"inline":true,"label":"production","permalink":"/docs/blog/tags/production"}],"readingTime":7.23,"hasTruncateMarker":true,"authors":[{"name":"Gatrix Team","title":"Game Platform Development Team","url":"https://github.com/your-org/gatrix","page":{"permalink":"/docs/blog/authors/gatrix-team"},"socials":{"github":"https://github.com/your-org","email":"mailto:support@gatrix.com"},"imageURL":"https://avatars.githubusercontent.com/u/0?v=4","key":"gatrix-team"}],"frontMatter":{"slug":"production-deployment-tips","title":"Gatrix ?\ufffd\ub85c?\ufffd\uc158 \ubc30\ud3ec\ufffd??\ufffd\ud55c ?\ufffd\uc218 ?\ufffd\uacfc \ubca0\uc2a4???\ufffd\ub799?\ufffd\uc2a4","authors":["gatrix-team"],"tags":["gatrix","tips","deployment","production"]},"unlisted":false,"prevItem":{"title":"Gatrix ?\ufffd\ub2a5 \ucd5c\uc801???\ufffd\uc804 \uac00?\ufffd\ub4dc: \ucd08\uace0??\uac8c\uc784 ?\ufffd\ub7ab??\uad6c\ucd95?\ufffd\uae30","permalink":"/docs/blog/performance-optimization-guide"},"nextItem":{"title":"Gatrix API \ud1b5\ud569 \ubc0f \uc6f9\ud6c5 \uc124\uc815 \uc644\uc804 \uac00\uc774\ub4dc","permalink":"/docs/blog/api-integration-webhooks"}}'
      );
    },
    8453(e, n, r) {
      r.d(n, { R: () => i, x: () => o });
      var t = r(6540);
      const s = {},
        a = t.createContext(s);
      function i(e) {
        const n = t.useContext(a);
        return t.useMemo(
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
              ? e.components(s)
              : e.components || s
            : i(e.components)),
          t.createElement(a.Provider, { value: n }, e.children)
        );
      }
    },
  },
]);
