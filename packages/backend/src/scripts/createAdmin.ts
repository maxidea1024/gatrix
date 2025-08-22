import bcrypt from 'bcrypt';
import database from '../config/database';
import logger from '../config/logger';

async function createDefaultAdmin() {
  try {
    // Check if admin user already exists
    const existingAdmin = await database.query(
      'SELECT id FROM g_users WHERE email = ? LIMIT 1',
      ['admin@motifgames.com']
    );

    if (existingAdmin.length > 0) {
      logger.info('Default admin user already exists');
      return;
    }

    // Hash the default password
    const hashedPassword = await bcrypt.hash('admin123$', 12);

    // Create default admin user
    await database.query(`
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

    logger.info('Default admin user created successfully');
    logger.info('Email: admin@motifgames.com');
    logger.info('Password: admin123$');
  } catch (error) {
    logger.error('Error creating default admin user:', error);
    throw error;
  } finally {
    await database.close();
  }
}

createDefaultAdmin()
  .then(() => {
    console.log('Admin creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Admin creation failed:', error);
    process.exit(1);
  });
