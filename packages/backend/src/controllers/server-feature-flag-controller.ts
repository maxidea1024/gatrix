/**
 * Server Feature Flag Controller
 * Handles server SDK feature flag API endpoints
 * Returns only data fields required for runtime evaluation
 */

import { Response } from 'express';
import { SDKRequest } from '../middleware/api-token-auth';
import {
  FeatureFlagModel,
  FeatureStrategyModel,
  FeatureVariantModel,
  FeatureSegmentModel,
  FeatureFlagAttributes,
  FeatureStrategyAttributes,
  FeatureVariantAttributes,
} from '../models/FeatureFlag';
import db from '../config/knex';
import { featureMetricsService } from '../services/feature-metrics-service';
import { networkTrafficService } from '../services/network-traffic-service';
import { ErrorCodes, sendInternalError } from '../utils/api-response';

import { createLogger } from '../config/logger';
const logger = createLogger('ServerFeatureFlagController');

// Type for minimal flag data needed for runtime evaluation
interface EvaluationFlag {
  id: string;
  name: string;
  isEnabled: boolean;
  impressionDataEnabled: boolean;
  strategies?: EvaluationStrategy[];
  variants?: EvaluationVariant[];
  valueType?: string;
  enabledValue?: any;
  disabledValue?: any;
  version?: number;
  compact?: boolean; // true when evaluation data is stripped (disabled flag in compact mode)
}

interface EvaluationStrategy {
  name: string;
  parameters?: any;
  constraints?: any[];
  segments?: string[]; // Segment names only (references)
  isEnabled: boolean;
}

interface EvaluationVariant {
  name: string;
  weight: number;
  value?: any;
}

// Type for minimal segment data needed for runtime evaluation
interface EvaluationSegment {
  name: string;
  constraints: any[];
  isActive: boolean;
}

export default class ServerFeatureFlagController {
  /**
   * Get all feature flags for runtime evaluation
   * GET /api/v1/server/:env/features
   * Returns only fields required for runtime evaluation
   * Also returns referenced segments for efficiency (single API call)
   */
  static async getFeatureFlags(req: SDKRequest, res: Response): Promise<void> {
    try {
      // environmentId is resolved from token by setSDKEnvironment middleware
      const environmentId = req.environmentId!;

      // Get projectId from API token for project-level scoping
      const projectId = req.apiToken?.projectId;

      // Record network traffic (fire-and-forget)
      const appName = (req.headers['x-application-name'] as string) || 'unknown';
      networkTrafficService.recordTraffic(environmentId, appName, 'features').catch(() => {});

      // Parse optional flagNames filter (comma-separated query parameter)
      const flagNamesParam = req.query.flagNames as string | undefined;
      const flagNamesFilter = flagNamesParam
        ? flagNamesParam
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        : undefined;

      // Parse compact option: strip strategies/variants/enabledValue from disabled flags
      const compact = req.query.compact === 'true' || req.query.compact === '1';

      // Get all enabled, non-archived flags for this environment (project-scoped)
      const result = await FeatureFlagModel.findAll({
        environmentId,
        projectId,
        isArchived: false,
        flagNames: flagNamesFilter,
      });

      const rawFlags = result.flags;

      // Collect all referenced segment names
      const referencedSegmentNames = new Set<string>();

      // Get strategies and variants for each flag
      const flags: EvaluationFlag[] = await Promise.all(
        rawFlags.map(async (flag: FeatureFlagAttributes & { isEnabled: boolean }) => {
          const envOverride = flag.environments?.find((e) => e.environmentId === environmentId);

          // In compact mode, skip DB queries for disabled flags entirely
          if (compact && !flag.isEnabled) {
            return {
              id: flag.id,
              name: flag.flagName,
              isEnabled: false,
              impressionDataEnabled: flag.impressionDataEnabled,
              valueType: flag.valueType,
              disabledValue: envOverride?.overrideDisabledValue
                ? envOverride.disabledValue
                : flag.disabledValue,
              valueSource: envOverride?.overrideDisabledValue ? 'environment' : 'flag',
              version: flag.version,
              compact: true,
            };
          }

          const strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(
            flag.id,
            environmentId
          );
          const variants = await FeatureVariantModel.findByFlagIdAndEnvironment(
            flag.id,
            environmentId
          );

          // Transform to minimal evaluation format
          const evaluationStrategies: EvaluationStrategy[] = strategies
            .sort(
              (a: FeatureStrategyAttributes, b: FeatureStrategyAttributes) =>
                a.sortOrder - b.sortOrder
            )
            .map((s: FeatureStrategyAttributes) => {
              // s.segments is already string[] from enrichStrategiesWithSegments
              const segmentNames: string[] = s.segments || [];
              // Collect for referenced segments lookup
              segmentNames.forEach((name) => referencedSegmentNames.add(name));

              return {
                name: s.strategyName,
                parameters: s.parameters,
                constraints: s.constraints || [],
                segments: segmentNames, // Segment names only
                isEnabled: s.isEnabled,
              };
            });

          const evaluationVariants: EvaluationVariant[] = variants.map(
            (v: FeatureVariantAttributes) => ({
              name: v.variantName,
              weight: v.weight,
              value: v.value,
            })
          );

          const hasEnvOverride =
            envOverride?.overrideEnabledValue || envOverride?.overrideDisabledValue;

          return {
            id: flag.id,
            name: flag.flagName,
            isEnabled: flag.isEnabled,
            impressionDataEnabled: flag.impressionDataEnabled,
            strategies: evaluationStrategies,
            variants: evaluationVariants,
            valueType: flag.valueType,
            enabledValue: envOverride?.overrideEnabledValue
              ? envOverride.enabledValue
              : flag.enabledValue,
            disabledValue: envOverride?.overrideDisabledValue
              ? envOverride.disabledValue
              : flag.disabledValue,
            valueSource: hasEnvOverride ? 'environment' : 'flag',
            version: flag.version,
          };
        })
      );

      // Fetch only referenced segments (project-scoped)
      let segments: EvaluationSegment[] = [];
      if (referencedSegmentNames.size > 0) {
        const rawSegments = await FeatureSegmentModel.findByNames(
          Array.from(referencedSegmentNames),
          projectId
        );
        segments = rawSegments.map((s) => ({
          name: s.segmentName,
          constraints: s.constraints || [],
          isActive: s.isActive,
        }));
      }

      const data: { flags: EvaluationFlag[]; segments?: EvaluationSegment[] } = { flags };
      if (segments.length > 0) {
        data.segments = segments;
      }

      res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      sendInternalError(
        res,
        'Failed to fetch feature flags',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }

  /**
   * Get a single feature flag for runtime evaluation
   * GET /api/v1/server/:env/features/:flagName
   */
  static async getFeatureFlag(req: SDKRequest, res: Response): Promise<void> {
    try {
      // environmentId is resolved from token by setSDKEnvironment middleware
      const environmentId = req.environmentId!;
      const { flagName } = req.params;

      if (!flagName) {
        res.status(400).json({
          success: false,
          error: 'Flag name is required',
        });
        return;
      }

      // Parse compact option
      const compact = req.query.compact === 'true' || req.query.compact === '1';

      const flag = await FeatureFlagModel.findByName(environmentId, flagName);

      if (!flag || flag.isArchived) {
        res.status(404).json({ success: false, error: 'Flag not found' });
        return;
      }

      // In compact mode, skip DB queries for disabled flags entirely
      if (compact && !flag.isEnabled) {
        const envOverride = flag.environments?.find((e) => e.environmentId === environmentId);

        res.json({
          success: true,
          data: {
            flag: {
              id: flag.id,
              name: flag.flagName,
              isEnabled: false,
              impressionDataEnabled: flag.impressionDataEnabled,
              valueType: flag.valueType,
              disabledValue: envOverride?.overrideDisabledValue
                ? envOverride.disabledValue
                : flag.disabledValue,
              valueSource: envOverride?.overrideDisabledValue ? 'environment' : 'flag',
              version: flag.version,
              compact: true,
            },
          },
        });
        return;
      }

      const strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(
        flag.id,
        environmentId
      );
      const variants = await FeatureVariantModel.findByFlagIdAndEnvironment(flag.id, environmentId);

      const evaluationFlag: EvaluationFlag = {
        id: flag.id,
        name: flag.flagName,
        isEnabled: flag.isEnabled,
        impressionDataEnabled: flag.impressionDataEnabled,
        strategies: strategies
          .sort(
            (a: FeatureStrategyAttributes, b: FeatureStrategyAttributes) =>
              a.sortOrder - b.sortOrder
          )
          .map((s: FeatureStrategyAttributes) => ({
            name: s.strategyName,
            parameters: s.parameters,
            constraints: s.constraints || [],
            segments: s.segments || [], // s.segments is already string[]
            isEnabled: s.isEnabled,
          })),
        variants: variants.map((v: FeatureVariantAttributes) => ({
          name: v.variantName,
          weight: v.weight,
          value: v.value,
        })),
        valueType: flag.valueType,
        enabledValue: (() => {
          const env = flag.environments?.find((e) => e.environmentId === environmentId);
          return env?.overrideEnabledValue ? env.enabledValue : flag.enabledValue;
        })(),
        disabledValue: (() => {
          const env = flag.environments?.find((e) => e.environmentId === environmentId);
          return env?.overrideDisabledValue ? env.disabledValue : flag.disabledValue;
        })(),
        version: flag.version,
      };

      res.json({
        success: true,
        data: { flag: evaluationFlag },
      });
    } catch (error: any) {
      logger.error('Error fetching feature flag:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch feature flag' });
    }
  }

  /**
   * Get all segments for runtime evaluation
   * GET /api/v1/server/segments
   * Segments are project-scoped (not global)
   */
  static async getSegments(req: SDKRequest, res: Response): Promise<void> {
    try {
      // Get projectId from API token for project-level scoping
      const projectId = req.apiToken?.projectId;

      // Record network traffic (fire-and-forget)
      const appName = (req.headers['x-application-name'] as string) || 'unknown';
      const environmentId = req.environmentId!;
      networkTrafficService.recordTraffic(environmentId, appName, 'segments').catch(() => {});

      // Parse optional segmentNames filter (comma-separated query parameter)
      const segmentNamesParam = req.query.segmentNames as string | undefined;
      const segmentNamesFilter = segmentNamesParam
        ? segmentNamesParam
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        : undefined;

      const rawSegments = segmentNamesFilter
        ? await FeatureSegmentModel.findByNames(segmentNamesFilter, projectId)
        : await FeatureSegmentModel.findAll(undefined, projectId);

      // Transform to minimal evaluation format
      const segments: EvaluationSegment[] = rawSegments.map((s) => ({
        name: s.segmentName,
        constraints: s.constraints || [],
        isActive: s.isActive,
      }));

      res.json({
        success: true,
        data: { segments },
      });
    } catch (error: any) {
      sendInternalError(res, 'Failed to fetch segments', error, ErrorCodes.RESOURCE_FETCH_FAILED);
    }
  }

  /**
   * Receive aggregated metrics from SDK
   * POST /api/v1/server/:env/features/metrics
   */
  static async receiveMetrics(req: SDKRequest, res: Response): Promise<void> {
    try {
      const { metrics, timestamp, bucket } = req.body;
      // environmentId is resolved from token by setSDKEnvironment middleware
      const environmentId = req.environmentId!;
      // Get appName from X-Application-Name header
      const appName = req.headers['x-application-name'] as string | undefined;

      if (!Array.isArray(metrics)) {
        res.status(400).json({ success: false, error: 'metrics must be an array' });
        return;
      }

      // Use bucket.stop if available, fallback to timestamp, then current time
      const reportedAt = bucket?.stop || timestamp;
      // bucket.start is used for more accurate hourBucket calculation
      const bucketStart = bucket?.start;
      const sdkVersion = (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

      // Process aggregated metrics via queue with appName and bucket info
      await featureMetricsService.processAggregatedMetrics(
        environmentId,
        metrics,
        reportedAt,
        appName,
        bucketStart,
        sdkVersion
      );

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error processing metrics:', error);
      res.status(500).json({ success: false, error: 'Failed to process metrics' });
    }
  }

  /**
   * Report unknown flag access from SDK
   * POST /api/v1/server/:env/features/unknown
   */
  static async reportUnknownFlag(req: SDKRequest, res: Response): Promise<void> {
    try {
      const { flagName } = req.body;
      // environmentId is resolved from token by setSDKEnvironment middleware
      const environmentId = req.environmentId!;
      const appName = (req.headers['x-application-name'] as string) || req.body.appName;
      const sdkVersion = (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

      if (!flagName || typeof flagName !== 'string') {
        res.status(400).json({ success: false, error: 'flagName is required' });
        return;
      }

      // Import and use unknown flag service
      const { unknownFlagService } = await import('../services/unknown-flag-service');
      await unknownFlagService.reportUnknownFlag({
        flagName,
        environmentId,
        appName,
        sdkVersion,
      });

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error reporting unknown flag:', error);
      res.status(500).json({ success: false, error: 'Failed to report unknown flag' });
    }
  }

  /**
   * Get all flag definitions (project-scoped)
   * GET /api/v1/server/features/definitions
   * Returns lightweight flag definitions for code scanner tools
   */
  static async getFlagDefinitions(req: SDKRequest, res: Response): Promise<void> {
    try {
      // Get projectId from API token for project-level scoping
      const projectId = req.apiToken?.projectId;

      let query = db('g_feature_flags').select('flagName', 'flagType', 'valueType', 'isArchived');

      if (projectId) {
        query = query.where('projectId', projectId);
      }

      const rows = await query;

      const flags: Record<string, { type: string; flagType: string; archived: boolean }> = {};
      for (const row of rows) {
        // Map valueType to scanner-compatible type
        const typeMap: Record<string, string> = {
          boolean: 'bool',
          string: 'string',
          number: 'number',
          json: 'json',
        };

        flags[row.flagName] = {
          type: typeMap[row.valueType] || 'string',
          flagType: row.flagType,
          archived: Boolean(row.isArchived),
        };
      }

      res.json({
        success: true,
        data: { flags },
      });
    } catch (error: any) {
      sendInternalError(
        res,
        'Failed to fetch flag definitions',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }

  /**
   * Receive code references report from scanner tool
   * POST /api/v1/server/features/code-references/report
   */
  static async receiveCodeReferences(req: SDKRequest, res: Response): Promise<void> {
    try {
      const report = req.body;

      if (!report || !report.usages) {
        res
          .status(400)
          .json({ success: false, error: 'Invalid report format: usages array required' });
        return;
      }

      const repository = report.metadata?.repository || 'unknown';
      const branch = report.metadata?.branch || 'unknown';
      const commitHash = report.metadata?.commit || null;
      const scanId = report.metadata?.scanId || `scan-${Date.now()}`;
      const scanTime = report.metadata?.scanTime ? new Date(report.metadata.scanTime) : new Date();

      // Map usages to code reference records
      const references = report.usages.map((usage: any) => ({
        flagName: usage.flagName,
        filePath: usage.filePath,
        lineNumber: usage.line,
        columnNumber: usage.column || null,
        codeSnippet: usage.codeSnippet || null,
        functionName: usage.methodName || null,
        receiver: usage.receiver || null,
        language: usage.language || null,
        confidence: usage.confidenceScore || 0,
        detectionStrategy: usage.detectionStrategy || null,
        codeUrl: usage.codeUrl || null,
        repository,
        branch,
        commitHash,
        scanId,
        scanTime,
      }));

      const { FeatureCodeReferenceModel } = await import('../models/feature-code-reference');
      const insertedCount = await FeatureCodeReferenceModel.replaceForScan(
        scanId,
        repository,
        branch,
        references
      );

      // Add audit log
      try {
        const { AuditLogModel } = await import('../models/audit-log');
        await AuditLogModel.create({
          action: 'feature_code_references_report',
          description: `Code references scan '${scanId}' from ${repository}/${branch} (${insertedCount} references, ${new Set(references.map((r: any) => r.flagName)).size} flags)`,
          resourceType: 'feature_flag',
          resourceId: `scan:${scanId}`,
          newValues: {
            scanId,
            repository,
            branch,
            commitHash,
            insertedCount,
            uniqueFlags: new Set(references.map((r: any) => r.flagName)).size,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (logError) {
        logger.error('Failed to create audit log for code references:', logError);
      }

      res.json({
        success: true,
        data: {
          insertedCount,
          scanId,
          repository,
          branch,
        },
      });
    } catch (error: any) {
      logger.error('Error receiving code references:', error.message, error.stack);
      res.status(500).json({ success: false, error: 'Failed to store code references' });
    }
  }
}
