import jwt from "jsonwebtoken";
import { config } from "../config";
import logger from "../config/logger";
import { UserWithoutPassword } from "../types/user";

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class JwtUtils {
  static generateToken(user: UserWithoutPassword): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const options: jwt.SignOptions = {
      expiresIn: config.jwt.expiresIn as any,
      issuer: "admin-panel",
      audience: "admin-panel-users",
    };
    return jwt.sign(payload, config.jwt.secret as string, options);
  }

  static generateRefreshToken(user: UserWithoutPassword): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const options: jwt.SignOptions = {
      expiresIn: "30d", // Refresh token expires in 30 days
      issuer: "admin-panel",
      audience: "admin-panel-refresh",
    };
    return jwt.sign(payload, config.jwt.secret as string, options);
  }

  static verifyToken(token: string): JwtPayload | null {
    try {
      logger.debug("Verifying JWT token:", {
        tokenPrefix: token.substring(0, 20) + "...",
        tokenLength: token.length,
      });

      const decoded = jwt.verify(token, config.jwt.secret as string, {
        issuer: "admin-panel",
        audience: "admin-panel-users",
      }) as JwtPayload & { exp: number; iat: number };

      logger.debug("JWT token verified successfully:", {
        userId: decoded.userId,
        role: decoded.role,
        exp: decoded.exp,
        iat: decoded.iat,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
        timeUntilExpiry:
          Math.round((decoded.exp * 1000 - Date.now()) / 1000 / 60) +
          " minutes",
        currentTime: new Date().toISOString(),
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn("JWT token expired:", {
          tokenPrefix: token.substring(0, 20) + "...",
          expiredAt: error.expiredAt,
        });
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn("Invalid JWT token:", {
          tokenPrefix: token.substring(0, 20) + "...",
          message: error.message,
        });
      } else {
        logger.error("JWT verification error:", {
          error,
          tokenPrefix: token.substring(0, 20) + "...",
        });
      }
      return null;
    }
  }

  static verifyRefreshToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret as string, {
        issuer: "admin-panel",
        audience: "admin-panel-refresh",
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn("Refresh token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn("Invalid refresh token");
      } else {
        logger.error("Refresh token verification error:", error);
      }
      return null;
    }
  }

  static getTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  static decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      return decoded;
    } catch (error) {
      logger.error("JWT decode error:", error);
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  }

  static getTokenExpirationTime(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }
}
