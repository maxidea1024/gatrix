import database from '../config/database';
import logger from '../config/logger';

async function createPasswordResetTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS g_password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expiresAt TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user_id (userId),
        INDEX idx_expires_at (expiresAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await database.query(sql);
    logger.info('Password reset tokens table created successfully');
  } catch (error) {
    logger.error('Error creating password reset tokens table:', error);
    throw error;
  } finally {
    await database.close();
  }
}

createPasswordResetTable()
  .then(() => {
    console.log('Password reset table creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Password reset table creation failed:', error);
    process.exit(1);
  });
