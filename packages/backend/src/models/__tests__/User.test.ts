import { UserModel } from '../User';
import database from '../../config/database';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('bcryptjs');

const mockDatabase = database as jest.Mocked<typeof database>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UserModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = testUtils.createTestUser();
      mockDatabase.query.mockResolvedValue([mockUser]);

      const result = await UserModel.findById(1);

      expect(result).toEqual(mockUser);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });

    it('should return null when user not found', async () => {
      mockDatabase.query.mockResolvedValue([]);

      const result = await UserModel.findById(999);

      expect(result).toBeNull();
    });

    it('should throw error when database query fails', async () => {
      const error = new Error('Database error');
      mockDatabase.query.mockRejectedValue(error);

      await expect(UserModel.findById(1)).rejects.toThrow('Database error');
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = testUtils.createTestUser();
      mockDatabase.query.mockResolvedValue([mockUser]);

      const result = await UserModel.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM g_users WHERE email = ?'),
        ['test@example.com']
      );
    });

    it('should return null when user not found', async () => {
      mockDatabase.query.mockResolvedValue([]);

      const result = await UserModel.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create user with password', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      };
      const hashedPassword = 'hashedPassword123';
      const mockUser = testUtils.createTestUser({ id: 1, ...userData });

      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      mockDatabase.query.mockResolvedValue({ insertId: 1 });
      jest.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      const result = await UserModel.create(userData);

      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO g_users'),
        expect.arrayContaining([userData.email, hashedPassword, userData.name])
      );
      expect(result).toEqual(mockUser);
    });

    it('should create user without password (OAuth)', async () => {
      const userData = {
        email: 'oauth@example.com',
        name: 'OAuth User',
        oauthProvider: 'google',
        oauthId: 'google123',
      };
      const mockUser = testUtils.createTestUser({ id: 1, ...userData });

      mockDatabase.query.mockResolvedValue({ insertId: 1 });
      jest.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      const result = await UserModel.create(userData);

      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO g_users'),
        expect.arrayContaining([userData.email, null, userData.name])
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const user = testUtils.createTestUser({ passwordHash: 'hashedPassword' });
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await UserModel.verifyPassword(user, 'correctPassword');

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith('correctPassword', 'hashedPassword');
    });

    it('should return false for incorrect password', async () => {
      const user = testUtils.createTestUser({ passwordHash: 'hashedPassword' });
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await UserModel.verifyPassword(user, 'wrongPassword');

      expect(result).toBe(false);
    });

    it('should return false when user has no password hash', async () => {
      const user = testUtils.createTestUser({ passwordHash: null });

      const result = await UserModel.verifyPassword(user, 'anyPassword');

      expect(result).toBe(false);
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });
  });
});
