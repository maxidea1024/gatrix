/**
 * Server Feature Flag Controller
 * Handles server SDK feature flag API endpoints
 * Returns only data fields required for runtime evaluation
 */

import { Request, Response } from 'express';
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
import { featureMetricsService } from '../services/FeatureMetricsService';
import { networkTrafficService } from '../services/NetworkTrafficService';

// Type for minimal flag data needed for runtime evaluation
interface EvaluationFlag {
  id: string;
  name: string;
  isEnabled: boolean;
  impressionDataEnabled: boolean;
  strategies: EvaluationStrategy[];
  variants: EvaluationVariant[];
  valueType?: string;
  enabledValue?: any;
  disabledValue?: any;
  version?: number;
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
  valueType?: string;
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
  static async getFeatureFlags(req: Request, res: Response): Promise<void> {
    try {
      const environment = req.params.env;

      if (!environment) {
        res.status(400).json({ success: false, error: 'Environment is required' });
        return;
      }

      // Record network traffic (fire-and-forget)
      const appName = (req.headers['x-application-name'] as string) || 'unknown';
      networkTrafficService.recordTraffic(environment, appName, 'features').catch(() => {});

      // Get all enabled, non-archived flags for this environment
      const result = await FeatureFlagModel.findAll({
        environment,
        isArchived: false,
      });

      const rawFlags = result.flags;

      // Collect all referenced segment names
      const referencedSegmentNames = new Set<string>();

      // Get strategies and variants for each flag
      const flags: EvaluationFlag[] = await Promise.all(
        rawFlags.map(async (flag: FeatureFlagAttributes & { isEnabled: boolean }) => {
          const strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(
            flag.id,
            environment
          );
          const variants = await FeatureVariantModel.findByFlagIdAndEnvironment(
            flag.id,
            environment
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
              valueType: v.valueType,
            })
          );

          return {
            id: flag.id,
            name: flag.flagName,
            isEnabled: flag.isEnabled,
            impressionDataEnabled: flag.impressionDataEnabled,
            strategies: evaluationStrategies,
            variants: evaluationVariants,
            valueType: (flag as any).valueType,
            enabledValue:
              (flag as any).environments?.find((e: any) => e.environment === environment)
                ?.enabledValue ?? (flag as any).enabledValue,
            disabledValue:
              (flag as any).environments?.find((e: any) => e.environment === environment)
                ?.disabledValue ?? (flag as any).disabledValue,
            version: flag.version,
          };
        })
      );

      // Fetch only referenced segments
      let segments: EvaluationSegment[] = [];
      if (referencedSegmentNames.size > 0) {
        const rawSegments = await FeatureSegmentModel.findByNames(
          Array.from(referencedSegmentNames)
        );
        segments = rawSegments.map((s) => ({
          name: s.segmentName,
          constraints: s.constraints || [],
          isActive: s.isActive,
        }));
      }

      res.json({
        success: true,
        data: { flags, segments },
      });
    } catch (error: any) {
      console.error('Error fetching feature flags:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch feature flags' });
    }
  }

  /**
   * Get a single feature flag for runtime evaluation
   * GET /api/v1/server/:env/features/:flagName
   */
  static async getFeatureFlag(req: Request, res: Response): Promise<void> {
    try {
      const { env: environment, flagName } = req.params;

      if (!environment || !flagName) {
        res.status(400).json({
          success: false,
          error: 'Environment and flag name are required',
        });
        return;
      }

      const flag = await FeatureFlagModel.findByName(environment, flagName);

      if (!flag || flag.isArchived) {
        res.status(404).json({ success: false, error: 'Flag not found' });
        return;
      }

      const strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(
        flag.id,
        environment
      );
      const variants = await FeatureVariantModel.findByFlagIdAndEnvironment(flag.id, environment);

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
          valueType: v.valueType,
        })),
        valueType: flag.valueType,
        enabledValue:
          flag.environments?.find((e) => e.environment === environment)?.enabledValue ??
          flag.enabledValue,
        disabledValue:
          flag.environments?.find((e) => e.environment === environment)?.disabledValue ??
          flag.disabledValue,
        version: flag.version,
      };

      res.json({
        success: true,
        data: { flag: evaluationFlag },
      });
    } catch (error: any) {
      console.error('Error fetching feature flag:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch feature flag' });
    }
  }

  /**
   * Get all segments for runtime evaluation
   * GET /api/v1/server/segments
   * Segments are global (not environment-specific)
   */
  static async getSegments(req: Request, res: Response): Promise<void> {
    try {
      // Record network traffic (fire-and-forget)
      const appName = (req.headers['x-application-name'] as string) || 'unknown';
      const environment = req.params.env || 'global';
      networkTrafficService.recordTraffic(environment, appName, 'segments').catch(() => {});

      const rawSegments = await FeatureSegmentModel.findAll();

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
      console.error('Error fetching segments:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch segments' });
    }
  }

  /**
   * Receive aggregated metrics from SDK
   * POST /api/v1/server/:env/features/metrics
   */
  static async receiveMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { metrics, timestamp, bucket } = req.body;
      const environment = req.params.env || 'production';
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
        environment,
        metrics,
        reportedAt,
        appName,
        bucketStart,
        sdkVersion
      );

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error processing metrics:', error);
      res.status(500).json({ success: false, error: 'Failed to process metrics' });
    }
  }

  /**
   * Report unknown flag access from SDK
   * POST /api/v1/server/:env/features/unknown
   */
  static async reportUnknownFlag(req: Request, res: Response): Promise<void> {
    try {
      const { flagName } = req.body;
      const environment = req.params.env || 'production';
      const appName = (req.headers['x-application-name'] as string) || req.body.appName;
      const sdkVersion = (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

      if (!flagName || typeof flagName !== 'string') {
        res.status(400).json({ success: false, error: 'flagName is required' });
        return;
      }

      // Import and use unknown flag service
      const { unknownFlagService } = await import('../services/UnknownFlagService');
      await unknownFlagService.reportUnknownFlag({
        flagName,
        environment,
        appName,
        sdkVersion,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error reporting unknown flag:', error);
      res.status(500).json({ success: false, error: 'Failed to report unknown flag' });
    }
  }

  /**
   * Get all flag definitions (global, no environment required)
   * GET /api/v1/server/features/definitions
   * Returns lightweight flag definitions for code scanner tools
   */
  static async getFlagDefinitions(req: Request, res: Response): Promise<void> {
    try {
      const rows = await db('g_feature_flags').select(
        'flagName',
        'flagType',
        'valueType',
        'isArchived'
      );

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
      console.error('Error fetching flag definitions:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch flag definitions' });
    }
  }

  /**
   * Receive code references report from scanner tool
   * POST /api/v1/server/features/code-references/report
   */
  static async receiveCodeReferences(req: Request, res: Response): Promise<void> {
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

      const { FeatureCodeReferenceModel } = await import('../models/FeatureCodeReference');
      const insertedCount = await FeatureCodeReferenceModel.replaceForScan(
        scanId,
        repository,
        branch,
        references
      );

      // Add audit log
      try {
        const { AuditLogModel } = await import('../models/AuditLog');
        await AuditLogModel.create({
          action: 'feature_code_references_report',
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
        console.error('Failed to create audit log for code references:', logError);
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
      console.error('Error receiving code references:', error.message, error.stack);
      res.status(500).json({ success: false, error: 'Failed to store code references' });
    }
  }
}
