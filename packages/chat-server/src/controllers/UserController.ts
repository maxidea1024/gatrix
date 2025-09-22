import { Request, Response } from 'express';
import { UserService, UserData } from '../services/UserService';

export class UserController {
  /**
   * 사용자 정보 업서트 (서버 토큰 필요)
   * POST /api/v1/users/upsert
   */
  static async upsertUser(req: Request, res: Response): Promise<void> {
    try {
      const userData: UserData = req.body;

      if (!userData.id || !userData.username) {
        res.status(400).json({
          success: false,
          error: { message: 'id and username are required' }
        });
        return;
      }

      // UserService를 통해 데이터베이스에 저장
      const savedUser = await UserService.upsertUser(userData);

      res.json({
        success: true,
        data: {
          user: savedUser,
          message: 'User information updated successfully'
        }
      });
    } catch (error: any) {
      console.error('Error upserting user:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update user information' }
      });
    }
  }

  /**
   * 사용자 정보 조회
   * GET /api/v1/users/:userId
   */
  static async getUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid userId' }
        });
        return;
      }

      const user = await UserService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
        return;
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error: any) {
      console.error('Error getting user:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get user information' }
      });
    }
  }

  /**
   * 모든 사용자 목록 조회
   * GET /api/v1/users
   */
  static async getUsers(req: Request, res: Response) {
    try {
      const users = await UserService.getAllUsers();

      res.json({
        success: true,
        data: { users }
      });
    } catch (error: any) {
      console.error('Error getting users:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get users' }
      });
    }
  }

  /**
   * 사용자 상태 업데이트
   * PUT /api/v1/users/:userId/status
   */
  static async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const { status, customStatus } = req.body;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid userId' }
        });
        return;
      }

      const success = await UserService.updateUserStatus(userId, status, customStatus);

      if (!success) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          message: 'User status updated successfully'
        }
      });
    } catch (error: any) {
      console.error('Error updating user status:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update user status' }
      });
    }
  }

  /**
   * 사용자 삭제
   * DELETE /api/v1/users/:userId
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid userId' }
        });
        return;
      }

      const success = await UserService.deleteUser(userId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          message: 'User deleted successfully'
        }
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to delete user' }
      });
    }
  }
}
