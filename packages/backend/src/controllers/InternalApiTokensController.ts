import { Response } from "express";
import { SDKRequest } from "../middleware/apiTokenAuth";
import knex from "../config/knex";
import logger from "../config/logger";
import apiTokenUsageService from "../services/ApiTokenUsageService";
import {
  sendForbidden,
  sendBadRequest,
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from "../utils/apiResponse";

/**
 * Internal API controller for Edge server to fetch API tokens
 * Only accessible with Edge bypass token
 */
class InternalApiTokensController {
  /**
   * Get all valid API tokens for Edge mirroring
   * Returns tokens with their full details for Edge to cache and validate locally
   *
   * GET /api/v1/server/internal/tokens
   */
  async getAllTokens(req: SDKRequest, res: Response) {
    try {
      // Only allow Edge bypass token to access this endpoint
      if (!req.isEdgeBypassToken) {
        return sendForbidden(
          res,
          "This endpoint is only accessible with Edge bypass token",
          ErrorCodes.AUTH_PERMISSION_DENIED,
        );
      }

      // Get all valid tokens (not expired)
      const tokens = await knex("g_api_access_tokens")
        .select(
          "id",
          "tokenName",
          "tokenValue",
          "tokenType",
          "allowAllEnvironments",
          "expiresAt",
          "createdAt",
          "updatedAt",
        )
        .where((builder) => {
          builder.whereNull("expiresAt").orWhere("expiresAt", ">", new Date());
        });

      // Get environment assignments for each token
      const tokenIds = tokens.map((t: any) => t.id);
      const environmentAssignments =
        tokenIds.length > 0
          ? await knex("g_api_access_token_environments")
              .whereIn("tokenId", tokenIds)
              .select("tokenId", "environment")
          : [];

      // Group environment names by token
      const envByToken = environmentAssignments.reduce((acc: any, env: any) => {
        if (!acc[env.tokenId]) acc[env.tokenId] = [];
        acc[env.tokenId].push(env.environment);
        return acc;
      }, {});

      // Format tokens for Edge
      const formattedTokens = tokens.map((token: any) => ({
        id: token.id,
        tokenName: token.tokenName,
        tokenValue: token.tokenValue,
        tokenType: token.tokenType,
        allowAllEnvironments: Boolean(token.allowAllEnvironments),
        environments: token.allowAllEnvironments
          ? ["*"]
          : envByToken[token.id] || [],
        expiresAt: token.expiresAt
          ? new Date(token.expiresAt).toISOString()
          : null,
        createdAt: new Date(token.createdAt).toISOString(),
        updatedAt: new Date(token.updatedAt).toISOString(),
      }));

      logger.info(
        `[InternalApiTokens] Edge fetched ${formattedTokens.length} tokens`,
      );

      return sendSuccessResponse(res, {
        tokens: formattedTokens,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      return sendInternalError(
        res,
        "Failed to fetch tokens",
        error,
        ErrorCodes.API_TOKEN_NOT_FOUND,
      );
    }
  }

  /**
   * Receive token usage report from Edge servers
   * Aggregates usage data and updates database
   *
   * POST /api/v1/server/internal/token-usage-report
   */
  async receiveUsageReport(req: SDKRequest, res: Response) {
    try {
      // Only allow Edge bypass token to access this endpoint
      if (!req.isEdgeBypassToken) {
        return sendForbidden(
          res,
          "This endpoint is only accessible with Edge bypass token",
          ErrorCodes.AUTH_PERMISSION_DENIED,
        );
      }

      const { edgeInstanceId, usageData, reportedAt } = req.body;

      if (!edgeInstanceId || !Array.isArray(usageData)) {
        return sendBadRequest(
          res,
          "Invalid request body: edgeInstanceId and usageData are required",
          {
            fields: ["edgeInstanceId", "usageData"],
          },
        );
      }

      logger.info(`[InternalApiTokens] Received usage report from Edge`, {
        edgeInstanceId,
        tokenCount: usageData.length,
        reportedAt,
      });

      // Process each token's usage
      let processedCount = 0;
      for (const usage of usageData) {
        const { tokenId, usageCount } = usage;

        if (!tokenId || typeof usageCount !== "number") {
          logger.warn("[InternalApiTokens] Invalid usage entry:", usage);
          continue;
        }

        try {
          // Record usage for each count (batch recording)
          for (let i = 0; i < usageCount; i++) {
            await apiTokenUsageService.recordTokenUsage(tokenId);
          }
          processedCount++;
        } catch (error) {
          logger.error(
            `[InternalApiTokens] Failed to record usage for token ${tokenId}:`,
            error,
          );
        }
      }

      logger.info(`[InternalApiTokens] Processed usage report`, {
        edgeInstanceId,
        processedCount,
        totalTokens: usageData.length,
      });

      return sendSuccessResponse(res, {
        processedCount,
        receivedAt: new Date().toISOString(),
      });
    } catch (error) {
      return sendInternalError(
        res,
        "Failed to process usage report",
        error,
        ErrorCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

export default new InternalApiTokensController();
