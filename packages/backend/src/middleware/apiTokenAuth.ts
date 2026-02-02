import { Request, Response, NextFunction } from "express";
import { ApiAccessToken } from "../models/ApiAccessToken";
import { Environment } from "../models/Environment";
import { CacheService } from "../services/CacheService";
import logger from "../config/logger";
import { HEADERS, HEADER_VALUES } from "../constants/headers";
import { isValidEnvironment } from "../utils/environmentContext";
import { ErrorCodes } from "../utils/apiResponse";

// Unsecured tokens for testing purposes
const UNSECURED_CLIENT_TOKEN = "gatrix-unsecured-client-api-token";
const UNSECURED_SERVER_TOKEN = "gatrix-unsecured-server-api-token";

// Edge bypass token - allows access to all environments and internal APIs
// This token is used by Edge servers that run in internal network
// Can be configured via EDGE_BYPASS_TOKEN environment variable
// TODO: In the future, this should be replaced with a generated/registered token
export const EDGE_BYPASS_TOKEN =
  process.env.EDGE_BYPASS_TOKEN || "gatrix-edge-internal-bypass-token";

export interface SDKRequest extends Request {
  apiToken?: ApiAccessToken;
  environments?: Environment[];
  environment?: string; // Environment name string
  environmentModel?: Environment; // Optional model if needed
  isUnsecuredToken?: boolean; // Flag to indicate unsecured token usage
  isEdgeBypassToken?: boolean; // Flag to indicate Edge bypass token usage
}

/**
 * Middleware to authenticate API access tokens
 */
export const authenticateApiToken = async (
  req: SDKRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers[HEADERS.AUTHORIZATION];
    const apiTokenHeader = req.headers[HEADERS.X_API_TOKEN] as string;

    // Extract token from Authorization header or X-API-Token header
    let token: string | undefined;

    if (authHeader && authHeader.startsWith(HEADER_VALUES.BEARER_PREFIX)) {
      token = authHeader.substring(HEADER_VALUES.BEARER_PREFIX.length);
    } else if (apiTokenHeader) {
      token = apiTokenHeader;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTH_TOKEN_MISSING,
          message: "API token is required",
        },
      });
    }

    // Check for unsecured client token (for testing)
    if (token === UNSECURED_CLIENT_TOKEN) {
      req.isUnsecuredToken = true;
      req.apiToken = {
        id: "unsecured-client",
        tokenType: "client",
        tokenValue: UNSECURED_CLIENT_TOKEN,
        tokenName: "Unsecured Client Token (Testing)",
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      return next();
    }

    // Check for Edge bypass token (internal network only)
    // Edge server uses this token when proxying client requests to backend
    if (token === EDGE_BYPASS_TOKEN) {
      req.isUnsecuredToken = true;
      req.isEdgeBypassToken = true;
      req.apiToken = {
        id: "edge-bypass",
        tokenType: "client", // Treat as client for client SDK endpoints
        tokenValue: EDGE_BYPASS_TOKEN,
        tokenName: "Edge Bypass Token (Internal)",
        allowAllEnvironments: true,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      return next();
    }

    // Try to get token from cache first
    const cacheKey = `api_token:${token.substring(0, 16)}...`; // Use partial token for cache key
    let apiToken = await CacheService.get<ApiAccessToken>(cacheKey);

    if (!apiToken) {
      // Validate token against database
      apiToken = await ApiAccessToken.validateAndUse(token);

      if (!apiToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTH_TOKEN_INVALID,
            message: "Invalid or expired API token",
          },
        });
      }

      // Cache the token for 5 minutes
      await CacheService.set(cacheKey, apiToken, 300);
    } else {
      // 캐시에서 토큰을 찾았어도 사용량 기록
      if (apiToken.id) {
        const { default: apiTokenUsageService } =
          await import("../services/ApiTokenUsageService");
        apiTokenUsageService.recordTokenUsage(apiToken.id).catch((error) => {
          logger.error("Failed to record token usage from cache:", error);
        });
      }
    }

    // Check if token is valid (handle both model instances and plain objects from cache)
    const isExpired = apiToken.expiresAt
      ? new Date() > new Date(apiToken.expiresAt)
      : false;
    if (isExpired) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTH_TOKEN_EXPIRED,
          message: "API token is inactive or expired",
        },
      });
    }

    // Get environments if token has specific environment access
    let environments: Environment[] = [];

    if (
      !apiToken.allowAllEnvironments &&
      apiToken.environments &&
      apiToken.environments.length > 0
    ) {
      environments = apiToken.environments;
    } else if (!apiToken.allowAllEnvironments) {
      // Fetch environments from database if not loaded
      const { default: knex } = await import("../config/knex");
      const envNames = await knex("g_api_access_token_environments")
        .where("tokenId", apiToken.id)
        .select("environment");

      if (envNames.length > 0) {
        environments = await Environment.query().whereIn(
          "environment",
          envNames.map((e) => e.environment),
        );
      }
    }

    // If token has no environments and doesn't allow all, deny access
    if (!apiToken.allowAllEnvironments && environments.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCodes.ENV_ACCESS_DENIED,
          message: "API token has no environment access configured",
        },
      });
    }

    // Attach token and environments to request
    req.apiToken = apiToken;
    req.environments = environments;

    next();
  } catch (error) {
    logger.error("Error authenticating API token:", error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: "Authentication error",
      },
    });
  }
};

/**
 * Middleware to check token type
 * 'all' token type can access both client and server APIs
 */
export const requireTokenType = (tokenType: "client" | "server" | "admin") => {
  return (req: SDKRequest, res: Response, next: NextFunction) => {
    const apiToken = req.apiToken;

    if (!apiToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTH_TOKEN_MISSING,
          message: "API token not found",
        },
      });
    }

    // 'all' token type can access any API
    if (apiToken.tokenType === "all") {
      return next();
    }

    if (apiToken.tokenType !== tokenType) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCodes.AUTH_PERMISSION_DENIED,
          message: `Invalid token type. Required: ${tokenType}, got: ${apiToken.tokenType}`,
        },
      });
    }

    next();
  };
};

/**
 * Middleware to validate application name header
 */
export const validateApplicationName = (
  req: SDKRequest,
  res: Response,
  next: NextFunction,
) => {
  const appName = req.headers[HEADERS.X_APPLICATION_NAME] as string;

  if (!appName) {
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCodes.BAD_REQUEST,
        message: "X-Application-Name header is required",
      },
    });
  }

  // Validate app name format
  if (!/^[a-zA-Z0-9_-]+$/.test(appName) || appName.length > 100) {
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Invalid application name format",
      },
    });
  }

  // Attach app name to request for metrics
  (req as any).applicationName = appName;

  next();
};

/**
 * Rate limiting for SDK endpoints
 */
export const sdkRateLimit = (
  req: SDKRequest,
  res: Response,
  next: NextFunction,
) => {
  // TODO: Implement rate limiting based on token type and environment
  // For now, just pass through
  next();
};

/**
 * SDK 환경 설정 미들웨어
 * X-Environment 헤더 또는 URL 파라미터를 사용하여 req.environment를 설정합니다.
 * 토큰의 환경 접근 권한을 검증합니다.
 */
export const setSDKEnvironment = async (
  req: SDKRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const apiToken = req.apiToken;

    // Get environment from header or use default
    // SDK sends 'X-Environment'
    let environmentName = req.headers["x-environment"] as string;

    // Use pre-resolved environment if available (e.g. from URL params)
    if (!environmentName && req.environment) {
      environmentName = req.environment;
    }

    // Attempt to resolve from URL (specifically for server routes like /api/v1/server/:env/...
    // or client feature flag routes like /api/v1/client/features/:env/eval)
    if (!environmentName) {
      let envParam = req.params?.env || req.params?.environment;

      // Fallback: Manually parse URL if req.params is not populated (middleware order issue)
      if (!envParam) {
        const path = req.originalUrl || req.url;
        // Match /api/v1/server/:env/ pattern
        let match = path.match(/\/api\/v1\/server\/([^\/]+)\//);
        if (
          match &&
          match[1] &&
          match[1] !== "services" &&
          match[1] !== "internal" &&
          match[1] !== "auth"
        ) {
          envParam = match[1];
        }

        // Match /api/v1/client/features/:env/eval pattern
        if (!envParam) {
          match = path.match(/\/api\/v1\/client\/features\/([^\/]+)\/eval/);
          if (match && match[1]) {
            envParam = match[1];
          }
        }
      }

      if (envParam) {
        environmentName = envParam;
      }
    }

    if (!environmentName) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCodes.ENV_INVALID,
          message: "Environment is required (via X-Environment header)",
        },
      });
    }

    // Fetch environment from database to validate
    const cacheKey = `sdk_env:${environmentName}`;
    let environment: Environment | null =
      await CacheService.get<Environment>(cacheKey);

    if (!environment) {
      const foundEnv = await Environment.getByName(environmentName);

      if (!foundEnv) {
        return res.status(404).json({
          success: false,
          error: {
            code: ErrorCodes.ENV_NOT_FOUND,
            message: `Environment not found: ${environmentName}`,
          },
        });
      }

      environment = foundEnv;

      // Cache environment for 5 minutes
      await CacheService.set(cacheKey, environment, 300);
    }

    // Update to canonical name
    environmentName = environment.environment;
    req.environment = environmentName;
    req.environmentModel = environment;

    // Validate token has access to this environment (skip for unsecured tokens)
    if (!req.isUnsecuredToken && apiToken && !apiToken.allowAllEnvironments) {
      let hasAccess = false;

      if (typeof apiToken.hasEnvironmentAccess === "function") {
        hasAccess = await apiToken.hasEnvironmentAccess(environmentName);
      } else {
        // For cached plain objects, query the database
        const { default: knex } = await import("../config/knex");
        const envAccess = await knex("g_api_access_token_environments")
          .where("tokenId", apiToken.id)
          .where("environment", environmentName)
          .first();
        hasAccess = !!envAccess;
      }

      if (!hasAccess) {
        // Detailed logging for debugging
        logger.error("API token environment access denied:", {
          tokenId: apiToken.id,
          tokenName: apiToken.tokenName,
          environment: environmentName,
          isUnsecuredToken: req.isUnsecuredToken,
          allowAllEnvironments: apiToken.allowAllEnvironments,
          path: req.originalUrl,
        });

        return res.status(403).json({
          success: false,
          error: {
            code: ErrorCodes.ENV_ACCESS_DENIED,
            message: "API token does not have access to this environment",
            details: {
              tokenId: apiToken.id,
              tokenName: apiToken.tokenName,
              environment: environmentName,
            },
          },
        });
      }
    }

    next();
  } catch (error) {
    logger.error("Error setting SDK environment:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: "Failed to set environment",
      },
    });
  }
};

/**
 * Combined middleware for client SDK endpoints
 */
export const clientSDKAuth = [
  authenticateApiToken,
  requireTokenType("client"),
  validateApplicationName,
  setSDKEnvironment,
  sdkRateLimit,
];

/**
 * Server API 토큰 인증 미들웨어
 * X-API-Token 헤더를 사용하여 서버 간 통신을 인증합니다.
 */
export const authenticateServerApiToken = async (
  req: SDKRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const apiToken = req.headers[HEADERS.X_API_TOKEN] as string;
    const appName = req.headers[HEADERS.X_APPLICATION_NAME] as string;

    if (!apiToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTH_TOKEN_MISSING,
          message: "API token is required",
        },
      });
    }

    if (!appName) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.BAD_REQUEST,
          message: "Application name is required",
        },
      });
    }

    // Check for unsecured server token (for testing)
    if (apiToken === UNSECURED_SERVER_TOKEN) {
      req.isUnsecuredToken = true;
      req.apiToken = {
        id: "unsecured-server",
        tokenType: "server",
        tokenValue: UNSECURED_SERVER_TOKEN,
        tokenName: "Unsecured Server Token (Testing)",
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      return next();
    }

    // Check for Edge bypass token (internal network only)
    if (apiToken === EDGE_BYPASS_TOKEN) {
      req.isUnsecuredToken = true;
      req.isEdgeBypassToken = true;
      req.apiToken = {
        id: "edge-bypass",
        tokenType: "server",
        tokenValue: EDGE_BYPASS_TOKEN,
        tokenName: "Edge Bypass Token (Internal)",
        allowAllEnvironments: true,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      return next();
    }

    // Try to get token from cache first
    const cacheKey = `server_api_token:${apiToken.substring(0, 16)}...`;
    let validatedToken = await CacheService.get<ApiAccessToken>(cacheKey);

    if (!validatedToken) {
      // Validate token against database
      validatedToken = await ApiAccessToken.validateAndUse(apiToken);

      if (!validatedToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTH_TOKEN_INVALID,
            message: "Invalid or expired API token",
          },
        });
      }

      // Check server token type - 'server' or 'all' are allowed
      if (
        validatedToken.tokenType !== "server" &&
        validatedToken.tokenType !== "all"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: ErrorCodes.AUTH_PERMISSION_DENIED,
            message: "Server API token required",
          },
        });
      }

      // Cache the validated token for 5 minutes
      await CacheService.set(cacheKey, validatedToken, 5 * 60 * 1000);
    }

    // 요청 객체에 토큰 정보 추가
    req.apiToken = validatedToken;

    next();
  } catch (error) {
    logger.error("Server API token authentication error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: "Authentication failed",
      },
    });
  }
};

/**
 * Combined middleware for server SDK endpoints
 */
export const serverSDKAuth = [
  authenticateServerApiToken,
  setSDKEnvironment,
  sdkRateLimit,
];

export default {
  authenticateApiToken,
  authenticateServerApiToken,
  requireTokenType,
  validateApplicationName,
  setSDKEnvironment,
  sdkRateLimit,
  clientSDKAuth,
  serverSDKAuth,
};
