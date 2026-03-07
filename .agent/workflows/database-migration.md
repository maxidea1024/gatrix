---
description: How to create database migrations
---

# Database Migration Rules

## Migration Format
- **knex를 사용하지 않는다.** Migration은 raw MySQL `connection.execute()`를 사용한다.
- 함수 시그니처: `exports.up = async function (connection) { ... }`
- SQL 실행: `await connection.execute('ALTER TABLE...')`
- 결과 조회: `const [rows] = await connection.execute('SELECT ...')`

## Example Pattern (reference: 023_roles_scope_type.js)
```javascript
exports.up = async function (connection) {
  console.log('[024] Adding column...');

  // Check if column already exists
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'table_name' AND COLUMN_NAME = 'column_name'`
  );

  if (cols.length === 0) {
    await connection.execute(`
      ALTER TABLE table_name
      ADD COLUMN column_name VARCHAR(255) NULL AFTER some_column
    `);
    console.log('[024] ✓ column added');
  }
};

exports.down = async function (connection) {
  await connection.execute(`ALTER TABLE table_name DROP COLUMN column_name`);
};
```

## Table Column Naming
- **camelCase** 사용 (user rules)
- 예약어 충돌 시 테이블명+필드명 (예: `clientGroup`)

## Important Column Names (자주 실수하는 것들)
- `g_role_bindings`: `assignedAt` (NOT `createdAt`), `assignedBy`, `description`
- 날짜/시간: `UTC_TIMESTAMP()` 사용 (`NOW()` 금지)

## Migration File Naming
- 순번_설명.js (예: `024_role_bindings_description.js`)
- 파일 위치: `packages/backend/src/database/migrations/`
