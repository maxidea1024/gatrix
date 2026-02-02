import { Request, Response } from "express";
import { ApiTokenService } from "../services/ApiTokenService";
import { createLogger } from "../config/logger";

const logger = createLogger("ApiTokenController");

export class ApiTokenController {
  /**
   * API 토큰 생성
   * POST /api/v1/admin/tokens
   */
  static async createToken(req: Request, res: Response): Promise<void> {
    try {
      const { name, permissions = ["read", "write"] } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: { message: "Token name is required" },
        });
        return;
      }

      const apiToken = await ApiTokenService.generateToken(name, permissions);

      res.json({
        success: true,
        data: {
          id: apiToken.id,
          name: apiToken.name,
          token: apiToken.token,
          permissions: apiToken.permissions,
          createdAt: apiToken.createdAt,
        },
      });
    } catch (error: any) {
      logger.error("Error creating API token:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to create API token" },
      });
    }
  }

  /**
   * API 토큰 목록 조회
   * GET /api/v1/admin/tokens
   */
  static async listTokens(req: Request, res: Response): Promise<void> {
    try {
      const tokens = await ApiTokenService.listTokens();

      // 보안상 실제 토큰 값은 마스킹
      const maskedTokens = tokens.map((token) => ({
        id: token.id,
        name: token.name,
        token: `${token.token.substring(0, 12)}...`,
        permissions: token.permissions,
        createdAt: token.createdAt,
        isActive: token.isActive,
      }));

      res.json({
        success: true,
        data: maskedTokens,
      });
    } catch (error: any) {
      logger.error("Error listing API tokens:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to list API tokens" },
      });
    }
  }

  /**
   * API 토큰 폐기
   * DELETE /api/v1/admin/tokens/:token
   */
  static async revokeToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          success: false,
          error: { message: "Token is required" },
        });
        return;
      }

      const success = await ApiTokenService.revokeToken(token);

      if (!success) {
        res.status(404).json({
          success: false,
          error: { message: "Token not found" },
        });
        return;
      }

      res.json({
        success: true,
        data: { message: "Token revoked successfully" },
      });
    } catch (error: any) {
      logger.error("Error revoking API token:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to revoke API token" },
      });
    }
  }

  /**
   * API 토큰 검증
   * POST /api/v1/admin/tokens/verify
   */
  static async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          error: { message: "Token is required" },
        });
        return;
      }

      const apiToken = await ApiTokenService.verifyToken(token);

      if (!apiToken) {
        res.status(401).json({
          success: false,
          error: { message: "Invalid token" },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          valid: true,
          name: apiToken.name,
          permissions: apiToken.permissions,
          createdAt: apiToken.createdAt,
          isActive: apiToken.isActive,
        },
      });
    } catch (error: any) {
      logger.error("Error verifying API token:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to verify API token" },
      });
    }
  }
}
