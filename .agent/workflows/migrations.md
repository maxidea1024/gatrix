---
description: How to create database migrations in this project
---

# Database Migration Guidelines

## ⚠️ CRITICAL - READ THIS FIRST ⚠️

**THIS PROJECT DOES NOT USE KNEX FOR MIGRATIONS!**

The migration system uses raw MySQL2 `connection.execute()` calls. 
If you use `knex.schema.alterTable()` or `knex.raw()`, IT WILL FAIL!

## Key Points

1. **Migration files use mysql2 connection, NOT knex**
   - The migration system in this project uses `mysql2/promise` connections
   - Parameter is `connection`, not `knex`
   - Use `connection.execute()` or `connection.query()` with raw SQL strings
   - **NEVER use `knex.schema.createTable()`, `knex.schema.alterTable()`, `knex.raw()`, etc.**

2. **Correct format for migrations:**
   ```javascript
   exports.up = async function (connection) {
       // Use raw SQL with connection.execute()
       await connection.execute(`
           ALTER TABLE my_table
           ADD COLUMN my_column VARCHAR(255)
       `);
   };

   exports.down = async function (connection) {
       await connection.execute(`
           ALTER TABLE my_table
           DROP COLUMN my_column
       `);
   };
   ```

3. **❌ WRONG format (DO NOT USE - WILL CAUSE ERROR):**
   ```javascript
   // WRONG - knex is undefined! This will throw:
   // "Cannot read properties of undefined (reading 'alterTable')"
   exports.up = async function (knex) {
       await knex.schema.alterTable(...);  // ❌ ERROR!
       await knex.raw(`...`);              // ❌ ERROR!
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
