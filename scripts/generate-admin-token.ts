/**
 * Generate admin JWT token from database
 */

import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

interface User {
  id: number;
  email: string;
  role: string;
  name: string;
}

async function generateAdminToken() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gatrix',
    });

    console.log('✅ Connected to database');

    // Find admin user
    const [rows] = await connection.execute<any[]>(
      'SELECT id, email, role, name FROM g_users WHERE role = ? AND status = ? LIMIT 1',
      ['admin', 'active']
    );

    if (rows.length === 0) {
      console.error('❌ No active admin user found in database');
      process.exit(1);
    }

    const user: User = rows[0];
    console.log(`✅ Found admin user: ${user.email} (ID: ${user.id})`);

    // Generate JWT token
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const options = {
      expiresIn: '30d',
      issuer: 'admin-panel',
      audience: 'admin-panel-users',
    };

    const token = jwt.sign(payload, JWT_SECRET, options);

    console.log('\n✅ JWT Token generated successfully!\n');
    console.log('Token:');
    console.log(token);
    console.log('\n');

    return token;

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
generateAdminToken()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

