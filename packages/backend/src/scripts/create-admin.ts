import bcrypt from 'bcrypt';
import database from '../config/database';
import logger from '../config/logger';
import config from '../config';

async function createDefaultAdmin() {
  try {
    // Get admin credentials from config (which reads from environment variables)
    const adminEmail = config.admin.email;
    const adminPassword = config.admin.password;
    const adminName = config.admin.name;

    // Check if admin user already exists
    const existingAdmin = await database.query('SELECT id FROM g_users WHERE email = ? LIMIT 1', [
      adminEmail,
    ]);

    if (existingAdmin.length > 0) {
      logger.info('Default admin user already exists');
      return;
    }

    // Hash the admin password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create default admin user
    await database.query(
      `
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
      ) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
    `,
      [adminEmail, hashedPassword, adminName, 'admin', 'active', true]
    );

    logger.info('Default admin user created successfully');
    logger.info(`Email: ${adminEmail}`);
    logger.info(`Password: ${adminPassword}`);
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
