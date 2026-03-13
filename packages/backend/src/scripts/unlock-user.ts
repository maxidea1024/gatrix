import database from '../config/database';

/**
 * Emergency CLI script to unlock a user account locked due to failed login attempts.
 * Usage: npx ts-node src/scripts/unlock-user.ts <email>
 */
async function unlockUser() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx ts-node src/scripts/unlock-user.ts <email>');
    process.exit(1);
  }

  try {
    const users = await database.query(
      'SELECT id, email, failedLoginAttempts, lockedAt FROM g_users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const user = users[0];
    if (!user.lockedAt) {
      console.log(`User ${email} is not locked.`);
      process.exit(0);
    }

    await database.query(
      'UPDATE g_users SET failedLoginAttempts = 0, lockedAt = NULL WHERE id = ?',
      [user.id]
    );

    console.log(`User ${email} has been unlocked successfully.`);
    console.log(`  Previous failed attempts: ${user.failedLoginAttempts}`);
    console.log(`  Locked at: ${user.lockedAt}`);
  } catch (error) {
    console.error('Failed to unlock user:', error);
    process.exit(1);
  } finally {
    await database.close();
  }
}

unlockUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unlock failed:', error);
    process.exit(1);
  });
