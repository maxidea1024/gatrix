const bcrypt = require('bcrypt');

const name = 'Create default admin user';

async function up(connection) {
  // Check if admin user already exists
  const [existingAdmin] = await connection.execute(
    'SELECT id FROM g_users WHERE email = ? LIMIT 1',
    ['admin@motifgames.com']
  );

  if (existingAdmin.length > 0) {
    console.log('Default admin user already exists, skipping creation');
    return;
  }

  // Hash the default password
  const hashedPassword = await bcrypt.hash('admin123$', 12);

  // Create default admin user
  await connection.execute(`
    INSERT INTO g_users (
      email,
      passwordHash,
      name,
      role,
      status,
      emailVerified,
      emailVerifiedAt,
      createdAt,
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
  `, [
    'admin@motifgames.com',
    hashedPassword,
    'Administrator',
    'admin',
    'active',
    true
  ]);

  console.log('Default admin user created successfully');
  console.log('Email: admin@motifgames.com');
  console.log('Password: admin123$');
}

async function down(connection) {
  await connection.execute(
    'DELETE FROM g_users WHERE email = ?',
    ['admin@motifgames.com']
  );
  console.log('Default admin user removed');
}

module.exports = { name, up, down };
