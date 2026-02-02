import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserService } from "../services/userService";
import logger from "../config/logger";

export interface ServerAuthRequest extends Request {
  apiToken?: any;
}

class ServerAuthController {
  // JWT 토큰 검증
  static async verifyToken(req: ServerAuthRequest, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: "Token is required",
        });
      }

      // JWT 토큰 검증
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      if (!decoded || !decoded.userId) {
        return res.status(401).json({
          success: false,
          error: "Invalid token",
        });
      }

      // 사용자 정보 조회
      const user = await UserService.getUserById(decoded.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // 사용자가 활성 상태인지 확인
      if (user.status !== "active") {
        return res.status(401).json({
          success: false,
          error: "User account is not active",
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      logger.error("Token verification failed:", error);

      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: "Invalid token",
        });
      }

      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  // 사용자 ID로 사용자 정보 조회
  static async getUserById(req: ServerAuthRequest, res: Response) {
    try {
      const userId = parseInt(req.params.id);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID",
        });
      }

      const user = await UserService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      logger.error("Failed to get user by ID:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}

export default ServerAuthController;
