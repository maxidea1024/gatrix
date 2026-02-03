import { UserModel } from '../models/User';
import { AuthService } from '../services/AuthService';

async function testLogin() {
  try {
    console.log('Testing login process...');

    // Test finding user by email
    const user = await UserModel.findByEmail('admin@gatrix.com');
    console.log('User found:', {
      id: user?.id,
      email: user?.email,
      hasPasswordHash: !!user?.passwordHash,
      passwordHashLength: user?.passwordHash?.length,
    });

    if (user) {
      // Test password verification
      const isValid = await UserModel.verifyPassword(user, 'admin123');
      console.log('Password verification result:', isValid);

      if (isValid) {
        // Test full login process
        try {
          const loginResult = await AuthService.login({
            email: 'admin@gatrix.com',
            password: 'admin123',
          });
          console.log('Login successful!', {
            userId: loginResult.user.id,
            email: loginResult.user.email,
            hasAccessToken: !!loginResult.accessToken,
            hasRefreshToken: !!loginResult.refreshToken,
          });
        } catch (loginError: any) {
          console.error('Login failed:', loginError.message);
        }
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testLogin();
