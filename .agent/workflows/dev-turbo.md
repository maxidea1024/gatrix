---
description: Run dev environment with auto-approval
---

// turbo-all

## Start Development Environment

1. Reset database and run migrations:

```bash
docker exec gatrix-mysql-dev mysql -uroot -pgatrix_rootpassword -e "DROP DATABASE IF EXISTS gatrix; CREATE DATABASE gatrix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON gatrix.* TO 'gatrix_user'@'%';"
```

2. Run migrations:

```bash
yarn workspace @gatrix/backend migrate:up
```

3. Start backend:

```bash
yarn dev:backend
```

4. Start all services:

```bash
yarn dev:all
```
