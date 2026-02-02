---
description: How to create database migrations in this project
---

# Database Migration Guidelines

## Key Points

1. **Migration files use mysql2 connection, NOT knex**
   - The migration system in this project uses `mysql2/promise` connections
   - Parameter is `connection`, not `knex`
   - Use `connection.query()` instead of `knex.raw()`

2. **Correct format for migrations:**
   ```javascript
   exports.up = async function (connection) {
       await connection.query(`
           CREATE TABLE IF NOT EXISTS my_table (
               id INT AUTO_INCREMENT PRIMARY KEY,
               ...
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
       `);
   };

   exports.down = async function (connection) {
       await connection.query('DROP TABLE IF EXISTS my_table');
   };
   ```

3. **Wrong format (DO NOT USE):**
   ```javascript
   // WRONG - knex is not available!
   exports.up = async function (knex) {
       await knex.raw(`...`);
       await knex.schema.createTable(...);
   };
   ```

4. **Reference existing migrations**
   - Always check format of existing migration files before creating new ones
   - Location: `packages/backend/src/database/migrations/`
   - Migration runner: `packages/backend/src/database/Migration.ts`

5. **Timestamp handling**
   - Use `UTC_TIMESTAMP()` in SQL instead of `NOW()`
   - This is required per project rules

## Database Connection Info (from packages/backend/.env)

When you need to connect to the database using docker exec:
```bash
docker exec gatrix-mysql-dev mysql -u gatrix_user -pgatrix_password -D gatrix -e "YOUR SQL QUERY"
```

- Container: `gatrix-mysql-dev`
- User: `gatrix_user`
- Password: `gatrix_password`
- Database: `gatrix`
- Port (host): `43306`
