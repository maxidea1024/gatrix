/**
 * AI Tools Registry
 *
 * Aggregates domain-specific tool definitions and provides
 * filtering/execution with RBAC permission checks.
 *
 * Tool definitions are split by domain:
 *   tools/feature-flag-tools.ts
 *   tools/game-world-tools.ts
 *   tools/maintenance-tools.ts
 *   tools/service-notice-tools.ts
 *   tools/banner-tools.ts
 */

import { createLogger } from '../../config/logger';
import type { ToolDefinition, ToolCall } from './llm-provider';
import type { AIToolConfig } from './ai-tool-types';
import { checkPermission } from '@gatrix/shared/permissions';

import { featureFlagTools } from './tools/feature-flag-tools';
import { segmentTools } from './tools/segment-tools';
import { gameWorldTools } from './tools/game-world-tools';
import { maintenanceTools } from './tools/maintenance-tools';
import { serviceNoticeTools } from './tools/service-notice-tools';
import { bannerTools } from './tools/banner-tools';
import { clientVersionTools } from './tools/client-version-tools';
import { surveyTools } from './tools/survey-tools';
import { storeProductTools } from './tools/store-product-tools';
import { ingamePopupTools } from './tools/ingame-popup-tools';
import { rewardTemplateTools } from './tools/reward-template-tools';
import { couponTools } from './tools/coupon-tools';

const logger = createLogger('AITools');

// Aggregate all domain tools into a single registry
const toolRegistry: AIToolConfig[] = [
  ...featureFlagTools,
  ...segmentTools,
  ...gameWorldTools,
  ...maintenanceTools,
  ...serviceNoticeTools,
  ...bannerTools,
  ...clientVersionTools,
  ...surveyTools,
  ...storeProductTools,
  ...ingamePopupTools,
  ...rewardTemplateTools,
  ...couponTools,
];

/**
 * Get available AI tools filtered by user permissions.
 * Uses checkPermission for proper wildcard matching (e.g. *:*).
 */
export function getAITools(userPermissions: string[]): ToolDefinition[] {
  return toolRegistry
    .filter((config) =>
      checkPermission(userPermissions, config.requiredPermission)
    )
    .map((config) => config.tool);
}

/**
 * Execute a tool call with permission check
 */
export async function executeToolCall(
  toolCall: ToolCall,
  userPermissions: string[],
  orgId: number,
  userId: string
): Promise<unknown> {
  const toolConfig = toolRegistry.find((t) => t.tool.name === toolCall.name);

  if (!toolConfig) {
    logger.warn('Unknown tool called', { name: toolCall.name });
    return { error: `Unknown tool: ${toolCall.name}` };
  }

  // Check permission with wildcard support
  if (!checkPermission(userPermissions, toolConfig.requiredPermission)) {
    logger.warn('Tool call denied by RBAC', {
      tool: toolCall.name,
      requiredPermission: toolConfig.requiredPermission,
    });
    return {
      error: `Insufficient permissions to execute ${toolCall.name}`,
    };
  }

  try {
    const result = await toolConfig.handler(toolCall.arguments, orgId, userId);
    logger.info('Tool executed successfully', {
      tool: toolCall.name,
      riskLevel: toolConfig.riskLevel,
    });
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Tool execution failed', {
      tool: toolCall.name,
      error: message,
    });
    return { error: `Tool execution failed: ${message}` };
  }
}
