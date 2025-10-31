#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

const migration = require('./src/database/migrations/026_add_ingame_popup_notice_targeting.js');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'gatrix_user',
    password: process.env.DB_PASSWORD || 'gatrix_password',
    database: process.env.DB_NAME || 'gatrix',
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log('Running migration 026...');
    await migration.up(connection);
    console.log('✅ Migration 026 completed successfully');
  } catch (error) {
    console.error('❌ Migration 026 failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();

