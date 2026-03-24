/**
 * Playground Routes
 * API endpoints for feature flag playground evaluation
 * Includes evaluation engine helpers used exclusively by the playground
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { featureFlagService } from '../../../services/feature-flag-service';
import { ValidationRules } from '../../../models/FeatureFlag';
import { validateFlagValue } from '../../../utils/validate-flag-value';
import {
  VALUE_SOURCE,
  evaluateStrategyWithDetails,
  normalizedStrategyValue,
} from '@gatrix/evaluator';
import { createLogger } from '../../../config/logger';
import { getFallbackValue } from './_helpers';

const logger = createLogger('PlaygroundRoutes');
const router = Router();

// Evaluate all flags with custom context (for playground testing)
router.post(
  '/playground',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, context, flagNames } = req.body;

    if (
      !environments ||
      !Array.isArray(environments) ||
      environments.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: 'At least one environment is required',
      });
    }

    const results: Record<string, any[]> = {};

    // Load all segments (global)
    const segments = await featureFlagService.listSegments();
    const segmentsMap = new Map(segments.map((s) => [s.segmentName, s]));

    // Analyze context values for common issues
    const contextWarnings: {
      field: string;
      type: string;
      message: string;
      suggestion?: string;
      data?: any;
      severity: 'warning' | 'error';
    }[] = [];
    // Load context field definitions for validation (used both for provided values and missing-field checks)
    const contextFieldDefs = await featureFlagService.listContextFields();
    const fieldDefMap = new Map(
      contextFieldDefs.map((f: any) => [f.fieldName, f])
    );

    if (context && typeof context === 'object') {
      for (const [key, value] of Object.entries(context)) {
        const fieldDef = fieldDefMap.get(key);

        // Check rules with field definition
        if (fieldDef) {
          const expectedType = fieldDef.fieldType;
          const rules = fieldDef.validationRules as ValidationRules | undefined;

          // isRequired is always enforced regardless of validation enabled/disabled
          const isEmpty = value === undefined || value === null || value === '';
          if (isEmpty && rules?.isRequired === true) {
            contextWarnings.push({
              field: key,
              type: 'EMPTY_VALUE',
              message: `Value is missing or empty, but this field is required.`,
              data: { value },
              severity: 'error',
            });
            continue; // Skip further validation for empty required fields
          }

          // Trim whitespace check - always enforced regardless of validation enabled/disabled
          if (typeof value === 'string' && rules?.trimWhitespace !== 'none') {
            if (value !== value.trim()) {
              const hasLeading = value !== value.trimStart();
              const hasTrailing = value !== value.trimEnd();
              const parts = [];
              if (hasLeading) parts.push('leading');
              if (hasTrailing) parts.push('trailing');

              const isReject = rules?.trimWhitespace === 'reject';
              contextWarnings.push({
                field: key,
                type: 'WHITESPACE',
                message: `Value has ${parts.join(' and ')} whitespace: "${value}" →trimmed: "${value.trim()}"`,
                suggestion: value.trim(),
                data: { value, trimmed: value.trim(), parts },
                severity: isReject ? 'error' : 'warning',
              });

              // If rejected, skip further validation as it's already an error
              if (isReject) {
                continue;
              }
            }
          }

          // Skip remaining detailed validation if disabled
          const isValidationEnabled = rules?.enabled !== false;
          if (!isValidationEnabled) {
            continue;
          }

          // Handle empty values (non-required fields with empty values skip detailed validation)
          if (value === undefined || value === null || value === '') {
            continue; // Skip further validation for empty values
          }

          if (expectedType === 'number' && typeof value !== 'number') {
            contextWarnings.push({
              field: key,
              type: 'TYPE_MISMATCH',
              message: `Expected number but got ${typeof value}: "${value}"`,
              data: { expectedType, actualType: typeof value, value },
              severity: 'error',
            });
          } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
            contextWarnings.push({
              field: key,
              type: 'TYPE_MISMATCH',
              message: `Expected boolean but got ${typeof value}: "${value}"`,
              data: { expectedType, actualType: typeof value, value },
              severity: 'error',
            });
          }

          // Check legal values from validationRules only (when rules are enabled)
          const rulesEnabled = rules?.enabled !== false;
          const legalValues = rulesEnabled ? rules?.legalValues : undefined;
          if (
            legalValues &&
            Array.isArray(legalValues) &&
            legalValues.length > 0
          ) {
            const strValue = String(value);
            if (!legalValues.includes(strValue)) {
              // Check if trimmed value matches
              const trimmedMatch = legalValues.find(
                (lv: string) => lv === strValue.trim()
              );
              contextWarnings.push({
                field: key,
                type: 'INVALID_VALUE',
                message: `Value "${strValue}" is not in the allowed values: [${legalValues.join(', ')}]`,
                suggestion: trimmedMatch || undefined,
                data: {
                  value: strValue,
                  allowedValues: legalValues,
                  suggestion: trimmedMatch,
                },
                severity: 'error',
              });
            }
          }

          // Check pattern validation
          if (rules?.pattern && typeof value === 'string') {
            try {
              const regex = new RegExp(rules.pattern);
              if (!regex.test(value)) {
                contextWarnings.push({
                  field: key,
                  type: 'PATTERN_MISMATCH',
                  message: `Value "${value}" does not match pattern: ${rules.pattern}`,
                  data: {
                    value,
                    pattern: rules.pattern,
                    patternDescription: rules.patternDescription,
                  },
                  severity: 'error',
                });
              }
            } catch {
              // Invalid regex pattern, skip validation
            }
          }

          // Check minLength / maxLength
          if (typeof value === 'string') {
            if (
              rules?.minLength !== undefined &&
              value.length < rules.minLength
            ) {
              contextWarnings.push({
                field: key,
                type: 'MIN_LENGTH',
                message: `Value "${value}" length (${value.length}) is less than minimum (${rules.minLength})`,
                data: {
                  value,
                  length: value.length,
                  minLength: rules.minLength,
                },
                severity: 'error',
              });
            }
            if (
              rules?.maxLength !== undefined &&
              value.length > rules.maxLength
            ) {
              contextWarnings.push({
                field: key,
                type: 'MAX_LENGTH',
                message: `Value "${value}" length (${value.length}) exceeds maximum (${rules.maxLength})`,
                data: {
                  value,
                  length: value.length,
                  maxLength: rules.maxLength,
                },
                severity: 'error',
              });
            }
          }

          // Check min / max for numbers
          if (typeof value === 'number') {
            if (rules?.min !== undefined && value < rules.min) {
              contextWarnings.push({
                field: key,
                type: 'MIN_VALUE',
                message: `Value ${value} is less than minimum (${rules.min})`,
                data: { value, min: rules.min },
                severity: 'error',
              });
            }
            if (rules?.max !== undefined && value > rules.max) {
              contextWarnings.push({
                field: key,
                type: 'MAX_VALUE',
                message: `Value ${value} exceeds maximum (${rules.max})`,
                data: { value, max: rules.max },
                severity: 'error',
              });
            }
            if (rules?.integerOnly && !Number.isInteger(value)) {
              contextWarnings.push({
                field: key,
                type: 'INTEGER_ONLY',
                message: `Value ${value} must be an integer`,
                data: { value },
                severity: 'error',
              });
            }
          }
        }
      }
    }

    // If any context errors exist, we still proceed but include them in the response
    const contextValid = !contextWarnings.some((w) => w.severity === 'error');

    // If specific flags are requested, create a Set for faster lookup
    const flagNamesSet =
      flagNames && Array.isArray(flagNames) && flagNames.length > 0
        ? new Set(flagNames)
        : null;

    // Flags are project-scoped, so fetch the list once (using first environment for isEnabled join)
    const flagsResult = await featureFlagService.listFlags({
      environmentId: environments[0],
      projectId: req.projectId,
      isArchived: false,
      page: 1,
      limit: 10000,
    });

    // Filter to requested flag names if specified
    const targetFlags = flagNamesSet
      ? flagsResult.data.filter((f) => flagNamesSet.has(f.flagName))
      : flagsResult.data;

    // Load pending CR draft data for feature flags (replaces old DraftService)
    // draftData structure: { [envId]: { isEnabled, strategies, ... } }
    const { ChangeRequestService } =
      await import('../../../services/change-request-service');
    const draftsByTarget = new Map<string, any>();
    for (const env of environments) {
      const pendingDrafts =
        await ChangeRequestService.getAllPendingDraftsForTable(
          'g_feature_flags',
          env
        );
      for (const d of pendingDrafts) {
        // Merge: if draft already exists for this target from another env, merge the draftData
        const existing = draftsByTarget.get(d.targetId);
        if (existing) {
          Object.assign(existing, d.draftData);
        } else {
          draftsByTarget.set(d.targetId, { ...d.draftData });
        }
      }
    }

    // Pre-load target flags to collect referenced context fields
    // We'll check if any required fields are missing from the provided context
    const contextKeys = new Set(Object.keys(context || {}));
    const referencedFields = new Set<string>();

    // Helper: collect contextNames from constraints
    const collectConstraintFields = (constraints: any[]) => {
      if (!Array.isArray(constraints)) return;
      for (const c of constraints) {
        if (c.contextName) referencedFields.add(c.contextName);
      }
    };

    // Scan flags to collect referenced context fields (strategies are env-scoped,
    // but we use first env as representative for field discovery)
    if (environments.length > 0) {
      try {
        for (const flagSummary of targetFlags) {
          const flag = await featureFlagService.getFlag(
            environments[0],
            flagSummary.flagName,
            req.projectId
          );
          if (!flag) continue;

          // Collect from published strategies
          const strategies = (flag as any).strategies || [];
          for (const strategy of strategies) {
            collectConstraintFields(strategy.constraints || []);

            // Collect from segments referenced by this strategy
            const segmentNames = strategy.segments || [];
            for (const segName of segmentNames) {
              const seg = segmentsMap.get(segName);
              if (seg) {
                collectConstraintFields((seg as any).constraints || []);
              }
            }
          }

          // Also collect from draft strategies (unpublished changes)
          const flagDraftData = draftsByTarget.get((flag as any).id);
          if (flagDraftData) {
            for (const envDraft of Object.values(flagDraftData)) {
              if (
                envDraft &&
                typeof envDraft === 'object' &&
                (envDraft as any).strategies
              ) {
                for (const draftStrategy of (envDraft as any).strategies) {
                  collectConstraintFields(draftStrategy.constraints || []);
                  const draftSegNames = draftStrategy.segments || [];
                  for (const segName of draftSegNames) {
                    const seg = segmentsMap.get(segName);
                    if (seg) {
                      collectConstraintFields((seg as any).constraints || []);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (_) {
        // Silently ignore scan errors
      }
    }

    // Check referenced fields that are missing from context
    if (referencedFields.size > 0 && fieldDefMap) {
      for (const fieldName of referencedFields) {
        if (contextKeys.has(fieldName)) continue;

        const fieldDef = fieldDefMap.get(fieldName);
        if (!fieldDef) continue;

        const rules = fieldDef.validationRules as ValidationRules | undefined;
        if (!rules) continue;

        // isRequired is checked independently of enabled flag
        // enabled controls detailed validation (pattern, length, etc.)
        // isRequired is always enforced

        if (rules.isRequired === true) {
          contextWarnings.push({
            field: fieldName,
            type: 'MISSING_REQUIRED',
            message: `Field "${fieldName}" is used in flag strategies/segments but was not provided in context, and this field is required.`,
            data: { fieldName },
            severity: 'error',
          });
        }
      }
    }

    // draftsByTarget already loaded above (before field collection)

    // Evaluate flags per environment (flag list is shared, only env-specific state differs)
    for (const env of environments) {
      try {
        const envResults: any[] = [];

        for (const flagSummary of targetFlags) {
          // Get detailed flag info with environment-specific state
          const flag = await featureFlagService.getFlag(
            env,
            flagSummary.flagName,
            req.projectId
          );
          if (!flag) continue;

          // Merge draft data into flag if draft exists for this flag+env
          const flagDraftData = draftsByTarget.get((flag as any).id);
          if (flagDraftData) {
            const envDraft = flagDraftData[env];
            if (envDraft && typeof envDraft === 'object') {
              // Apply draft environment fields to the flag object
              const draftFields = [
                'isEnabled',
                'strategies',
                'variants',
                'enabledValue',
                'disabledValue',
                'overrideEnabledValue',
                'overrideDisabledValue',
                'impressionDataEnabled',
              ];
              for (const field of draftFields) {
                if (field in envDraft) {
                  (flag as any)[field] = envDraft[field];
                }
              }
              // Also update environment-level overrides in environments array
              const envEntry = (flag as any).environments?.find(
                (e: any) => e.environmentId === env
              );
              if (envEntry) {
                for (const field of draftFields) {
                  if (field in envDraft) {
                    envEntry[field] = envDraft[field];
                  }
                }
              }
            }
          }

          // Evaluate the flag
          const evalResult = evaluateFlagWithDetails(
            flag,
            context || {},
            segmentsMap,
            env,
            contextWarnings
          );

          // Manual override if variant is somehow missing (already handled in evaluateFlagWithDetails now)
          // But kept for safety
          if (!evalResult.variant) {
            const envSettings = (flag as any).environments?.find(
              (e: any) => e.environmentId === env
            );
            let value = (flag as any).isEnabled
              ? (envSettings?.enabledValue ?? (flag as any).enabledValue)
              : (envSettings?.disabledValue ?? (flag as any).disabledValue);
            let valueSource: 'environment' | 'flag' | undefined;

            // Check overrides
            const envOverride = (flag as any).environments?.find(
              (e: any) => e.environmentId === env
            );
            if ((flag as any).isEnabled) {
              if (
                envOverride?.overrideEnabledValue &&
                envOverride?.enabledValue !== undefined
              ) {
                value = envOverride.enabledValue;
                valueSource = 'environment';
              } else if ((flag as any).enabledValue !== undefined) {
                value = (flag as any).enabledValue;
                valueSource = 'flag';
              }
            } else {
              if (
                envOverride?.overrideDisabledValue &&
                envOverride?.disabledValue !== undefined
              ) {
                value = envOverride.disabledValue;
                valueSource = 'environment';
              } else if ((flag as any).disabledValue !== undefined) {
                value = (flag as any).disabledValue;
                valueSource = 'flag';
              }
            }

            // Determine explicit variant name based on value source
            let variantName: string;
            if (evalResult.enabled) {
              variantName =
                valueSource === 'environment'
                  ? VALUE_SOURCE.ENV_DEFAULT_ENABLED
                  : VALUE_SOURCE.FLAG_DEFAULT_ENABLED;
            } else {
              variantName =
                valueSource === 'environment'
                  ? VALUE_SOURCE.ENV_DEFAULT_DISABLED
                  : VALUE_SOURCE.FLAG_DEFAULT_DISABLED;
            }
            (evalResult as any).variant = {
              name: (evalResult as any).variant?.name || variantName,
              value: getFallbackValue(value, (flag as any).valueType),
              valueType: (flag as any).valueType || 'string',
              valueSource,
            };
          }

          // Validate the returned value against validation rules if present
          let validation: any = undefined;
          if (
            flag.validationRules &&
            Object.keys(flag.validationRules).length > 0 &&
            (evalResult as any).variant?.value !== undefined
          ) {
            const valueToValidate = (evalResult as any).variant.value;
            const valueType = (flag as any).valueType || 'string';
            const validationResult = validateFlagValue(
              valueToValidate,
              valueType,
              flag.validationRules
            );
            validation = {
              valid: validationResult.valid,
              errors: validationResult.errors,
              transformedValue:
                validationResult.transformedValue !== valueToValidate
                  ? validationResult.transformedValue
                  : undefined,
              rules: flag.validationRules,
            };
          }

          envResults.push({
            flagName: flag.flagName,
            displayName: flag.displayName,
            flagType: flag.flagType,
            enabled: evalResult.enabled,
            variant: (evalResult as any).variant,
            reason: evalResult.reason,
            reasonDetails: evalResult.reasonDetails,
            evaluationSteps: evalResult.evaluationSteps,
            validation,
          });
        }

        // Sort by flag name
        envResults.sort((a, b) => a.flagName.localeCompare(b.flagName));
        results[env] = envResults;
      } catch (error: any) {
        logger.error(
          `Playground evaluation failed for environment '${env}':`,
          error
        );
        results[env] = [];
      }
    }

    res.json({
      success: true,
      data: {
        results,
        contextWarnings:
          contextWarnings.length > 0 ? contextWarnings : undefined,
        referencedFields:
          referencedFields.size > 0
            ? Array.from(referencedFields).map((name) => {
                const fieldDef = fieldDefMap?.get(name);
                const rules = fieldDef?.validationRules as any;
                return {
                  name,
                  isRequired: rules?.isRequired === true,
                  fieldType: (fieldDef?.fieldType as string) || 'string',
                };
              })
            : undefined,
      },
    });
  })
);

// ==================== Evaluation Helpers ====================
// These functions are used exclusively by the playground evaluation

// Helper function for detailed flag evaluation
function evaluateFlagWithDetails(
  flag: any,
  context: Record<string, any>,
  segmentsMap: Map<string, any>,
  environmentId?: string,
  contextWarnings?: any[]
): {
  enabled: boolean;
  variant: {
    name: string;
    value?: any;
    valueType?: string;
    valueSource?: string;
  };
  reason: string;
  reasonDetails?: any;
  evaluationSteps?: any[];
} {
  const evaluationSteps: any[] = [];

  // Step 1: Context Validation
  const errorWarnings =
    contextWarnings?.filter((w) => w.severity === 'error') || [];
  let contextFailed = false;
  if (errorWarnings.length > 0) {
    evaluationSteps.push({
      step: 'CONTEXT_VALIDATION',
      passed: false,
      message: 'Context validation failed',
      details: {
        errors: errorWarnings.map((w) => ({
          field: w.field,
          type: w.type,
          message: w.message,
          data: w.data,
        })),
      },
    });
    contextFailed = true;
  } else {
    evaluationSteps.push({
      step: 'CONTEXT_VALIDATION',
      passed: true,
      message: 'Context validation passed',
    });
  }

  // Step 2: Check if flag is enabled in environment
  if (contextFailed) {
    evaluationSteps.push({
      step: 'ENVIRONMENT_CHECK',
      passed: null, // skipped
      message: 'Skipped due to context validation failure',
    });
  } else if (!flag.isEnabled) {
    evaluationSteps.push({
      step: 'ENVIRONMENT_CHECK',
      passed: false,
      message: 'Flag is disabled in this environment',
    });
    const envOverrideRow = flag.environments?.find(
      (e: any) => e.environmentId === environmentId
    );
    const envDisabledValue = envOverrideRow?.overrideDisabledValue
      ? envOverrideRow.disabledValue
      : undefined;
    const isEnvSource = envOverrideRow?.overrideDisabledValue === true;
    return {
      enabled: false,
      reason: 'FLAG_DISABLED',
      variant: {
        name: isEnvSource
          ? VALUE_SOURCE.ENV_DEFAULT_DISABLED
          : VALUE_SOURCE.FLAG_DEFAULT_DISABLED,
        value: getFallbackValue(
          envDisabledValue ?? flag.disabledValue,
          flag.valueType
        ),
        valueType: flag.valueType || 'string',
        valueSource: isEnvSource ? 'environment' : 'flag',
      },
      evaluationSteps,
    };
  } else {
    evaluationSteps.push({
      step: 'ENVIRONMENT_CHECK',
      passed: true,
      message: 'Flag is enabled in this environment',
    });
  }

  const strategies = flag.strategies || [];

  // Step 3: Check if strategies exist
  if (strategies.length === 0) {
    evaluationSteps.push({
      step: 'STRATEGY_COUNT',
      passed: contextFailed ? null : true,
      message: contextFailed
        ? 'Skipped due to context validation failure'
        : 'No strategies defined - enabled by default',
    });
    if (contextFailed) {
      const ctxEnvRow = flag.environments?.find(
        (e: any) => e.environmentId === environmentId
      );
      const ctxEnvDisVal = ctxEnvRow?.overrideDisabledValue
        ? ctxEnvRow.disabledValue
        : undefined;
      const ctxIsEnvSource = ctxEnvRow?.overrideDisabledValue === true;
      return {
        enabled: false,
        reason: 'CONTEXT_VALIDATION_FAILED',
        variant: {
          name: ctxIsEnvSource
            ? VALUE_SOURCE.ENV_DEFAULT_DISABLED
            : VALUE_SOURCE.FLAG_DEFAULT_DISABLED,
          value: getFallbackValue(
            ctxEnvDisVal ?? flag.disabledValue,
            flag.valueType
          ),
          valueType: flag.valueType || 'string',
          valueSource: ctxIsEnvSource ? 'environment' : 'flag',
        },
        evaluationSteps,
      };
    }
    const variant = selectVariantForFlag(
      flag,
      flag.variants || [],
      context,
      undefined,
      environmentId
    );
    return {
      enabled: true,
      variant,
      reason: 'NO_STRATEGIES',
      evaluationSteps,
    };
  }
  evaluationSteps.push({
    step: 'STRATEGY_COUNT',
    passed: contextFailed ? null : true,
    message: contextFailed
      ? 'Skipped due to context validation failure'
      : `${strategies.length} strategy(s) to evaluate`,
  });

  // Step 4+: Evaluate each strategy
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    const strategyStep: any = {
      step: 'STRATEGY_EVALUATION',
      strategyIndex: i,
      strategyName: strategy.strategyName,
      isEnabled: strategy.isEnabled,
      checks: [],
    };

    if (!strategy.isEnabled) {
      strategyStep.passed = null; // Skipped
      strategyStep.message = 'Strategy is disabled - skipped';
      evaluationSteps.push(strategyStep);
      continue;
    }

    // Evaluate segments
    let segmentsPassed = true;
    if (strategy.segments && strategy.segments.length > 0) {
      for (const segmentName of strategy.segments) {
        const segment = segmentsMap.get(segmentName);
        if (!segment) {
          strategyStep.checks.push({
            type: 'SEGMENT',
            name: segmentName,
            passed: true,
            message: 'Segment not found - skipped',
          });
          continue;
        }

        if (segment.constraints && segment.constraints.length > 0) {
          for (const constraint of segment.constraints) {
            const constraintPassed = evaluateConstraint(constraint, context);
            strategyStep.checks.push({
              type: 'SEGMENT_CONSTRAINT',
              segment: segmentName,
              constraint: constraint,
              passed: contextFailed ? null : constraintPassed,
              contextValue:
                getContextValue(constraint.contextName, context) ?? null,
            });
            if (!constraintPassed) {
              segmentsPassed = false;
            }
          }
        } else {
          // Segment exists but has no constraints
          strategyStep.checks.push({
            type: 'SEGMENT',
            name: segmentName,
            passed: contextFailed ? null : true,
            message: 'Segment has no constraints - passed',
          });
        }
      }
    } else {
      // No segments defined
      strategyStep.checks.push({
        type: 'SEGMENTS_CHECK',
        passed: contextFailed ? null : true,
        message: 'No segments defined - passed',
      });
    }

    // Evaluate strategy constraints
    let constraintsPassed = true;
    if (strategy.constraints && strategy.constraints.length > 0) {
      for (const constraint of strategy.constraints) {
        const constraintPassed = evaluateConstraint(constraint, context);
        strategyStep.checks.push({
          type: 'STRATEGY_CONSTRAINT',
          constraint: constraint,
          passed: contextFailed ? null : constraintPassed,
          contextValue:
            getContextValue(constraint.contextName, context) ?? null,
        });
        if (!constraintPassed) {
          constraintsPassed = false;
        }
      }
    } else {
      // No constraints defined
      strategyStep.checks.push({
        type: 'CONSTRAINTS_CHECK',
        passed: contextFailed ? null : true,
        message: 'No constraints defined - passed',
      });
    }

    // Evaluate strategy-specific isEnabled logic
    const strategyResult = evaluateStrategyWithDetails(
      strategy.strategyName,
      strategy.parameters || {},
      context
    );

    strategyStep.checks.push({
      type: 'STRATEGY_RULE',
      strategyType: strategy.strategyName,
      passed: contextFailed ? null : strategyResult.enabled,
      strategyFound: strategyResult.strategyFound,
      reason: strategyResult.reason,
      parameters: strategy.parameters || {},
      details: strategyResult.details,
      message: !strategyResult.strategyFound
        ? `Unknown strategy type: ${strategy.strategyName}`
        : strategyResult.reason,
    });

    // Determine if strategy matched
    const strategyMatched =
      segmentsPassed && constraintsPassed && strategyResult.enabled;
    strategyStep.passed = contextFailed ? null : strategyMatched;
    strategyStep.message = contextFailed
      ? 'Skipped - context validation failed'
      : strategyMatched
        ? 'All conditions met'
        : 'One or more conditions failed';
    evaluationSteps.push(strategyStep);

    if (!contextFailed && strategyMatched) {
      const variant = selectVariantForFlag(
        flag,
        flag.variants || [],
        context,
        strategy,
        environmentId
      );
      return {
        enabled: true,
        variant,
        reason: 'STRATEGY_MATCHED',
        reasonDetails: {
          strategyName: strategy.strategyName,
          strategyIndex: i,
          constraints: strategy.constraints,
          segments: strategy.segments,
        },
        evaluationSteps,
      };
    }
  }

  // Context validation failed - return after full evaluation
  if (contextFailed) {
    const ctxFailEnvRow = flag.environments?.find(
      (e: any) => e.environmentId === environmentId
    );
    const ctxFailEnvDisVal = ctxFailEnvRow?.overrideDisabledValue
      ? ctxFailEnvRow.disabledValue
      : undefined;
    const ctxFailIsEnvSource = ctxFailEnvRow?.overrideDisabledValue === true;
    return {
      enabled: false,
      reason: 'CONTEXT_VALIDATION_FAILED',
      variant: {
        name: ctxFailIsEnvSource
          ? VALUE_SOURCE.ENV_DEFAULT_DISABLED
          : VALUE_SOURCE.FLAG_DEFAULT_DISABLED,
        value: getFallbackValue(
          ctxFailEnvDisVal ?? flag.disabledValue,
          flag.valueType
        ),
        valueType: flag.valueType || 'string',
        valueSource: ctxFailIsEnvSource ? 'environment' : 'flag',
      },
      evaluationSteps,
    };
  }

  // No strategy matched
  const activeStrategies = strategies.filter((s: any) => s.isEnabled);
  const allStrategiesDisabled =
    strategies.length > 0 && activeStrategies.length === 0;

  if (allStrategiesDisabled) {
    const variant = selectVariantForFlag(
      flag,
      flag.variants || [],
      context,
      undefined,
      environmentId
    );
    return {
      enabled: true,
      variant,
      reason: 'ALL_STRATEGIES_DISABLED',
      evaluationSteps,
    };
  }

  const noMatchEnvRow = flag.environments?.find(
    (e: any) => e.environmentId === environmentId
  );
  const noMatchEnvDisVal = noMatchEnvRow?.overrideDisabledValue
    ? noMatchEnvRow.disabledValue
    : undefined;
  const noMatchIsEnvSource = noMatchEnvRow?.overrideDisabledValue === true;
  return {
    enabled: false,
    reason: 'NO_MATCHING_STRATEGY',
    reasonDetails: {
      strategiesCount: strategies.length,
      activeStrategiesCount: activeStrategies.length,
    },
    evaluationSteps,
    variant: {
      name: noMatchIsEnvSource
        ? VALUE_SOURCE.ENV_DEFAULT_DISABLED
        : VALUE_SOURCE.FLAG_DEFAULT_DISABLED,
      value: noMatchEnvDisVal ?? flag.disabledValue ?? null,
      valueType: flag.valueType || 'string',
      valueSource: noMatchIsEnvSource ? 'environment' : 'flag',
    },
  };
}

function evaluateConstraint(
  constraint: any,
  context: Record<string, any>
): boolean {
  const contextValue = getContextValue(constraint.contextName, context);

  // Handle exists / not_exists before undefined check
  if (constraint.operator === 'exists') {
    const result = contextValue !== undefined && contextValue !== null;
    return constraint.inverted ? !result : result;
  }
  if (constraint.operator === 'not_exists') {
    const result = contextValue === undefined || contextValue === null;
    return constraint.inverted ? !result : result;
  }

  // Handle arr_empty before undefined check (undefined treated as empty)
  if (constraint.operator === 'arr_empty') {
    const result = !Array.isArray(contextValue) || contextValue.length === 0;
    return constraint.inverted ? !result : result;
  }

  if (contextValue === undefined) {
    return constraint.inverted ? true : false;
  }

  // Array operators - handled before string conversion (matching shared evaluator)
  if (constraint.operator === 'arr_any' || constraint.operator === 'arr_all') {
    const arr = Array.isArray(contextValue) ? contextValue.map(String) : [];
    const targetValues =
      constraint.values?.map((v: string) =>
        constraint.caseInsensitive ? v.toLowerCase() : v
      ) || [];
    const compareArr = constraint.caseInsensitive
      ? arr.map((v: string) => v.toLowerCase())
      : arr;

    let result = false;
    if (constraint.operator === 'arr_any') {
      // At least one target value is in the array
      result = targetValues.some((tv: string) => compareArr.includes(tv));
    } else {
      // All target values are in the array
      result =
        targetValues.length > 0 &&
        targetValues.every((tv: string) => compareArr.includes(tv));
    }
    return constraint.inverted ? !result : result;
  }

  const stringValue = String(contextValue);
  const compareValue = constraint.caseInsensitive
    ? stringValue.toLowerCase()
    : stringValue;
  const targetValue = constraint.value
    ? constraint.caseInsensitive
      ? constraint.value.toLowerCase()
      : constraint.value
    : '';
  const targetValues =
    constraint.values?.map((v: string) =>
      constraint.caseInsensitive ? v.toLowerCase() : v
    ) || [];

  let result = false;

  switch (constraint.operator) {
    // String operators (use inverted flag for negation)
    case 'str_eq':
      result = compareValue === targetValue;
      break;
    case 'str_contains':
      result = compareValue.includes(targetValue);
      break;
    case 'str_starts_with':
      result = compareValue.startsWith(targetValue);
      break;
    case 'str_ends_with':
      result = compareValue.endsWith(targetValue);
      break;
    case 'str_in':
      result = targetValues.includes(compareValue);
      break;
    case 'str_regex':
      try {
        const flags = constraint.caseInsensitive ? 'i' : '';
        const regex = new RegExp(constraint.value || '', flags);
        result = regex.test(stringValue);
      } catch {
        result = false;
      }
      break;
    // Number operators
    case 'num_eq':
      result = Number(contextValue) === Number(constraint.value);
      break;
    case 'num_gt':
      result = Number(contextValue) > Number(constraint.value);
      break;
    case 'num_gte':
      result = Number(contextValue) >= Number(constraint.value);
      break;
    case 'num_lt':
      result = Number(contextValue) < Number(constraint.value);
      break;
    case 'num_lte':
      result = Number(contextValue) <= Number(constraint.value);
      break;
    case 'num_in':
      result = targetValues.map(Number).includes(Number(contextValue));
      break;
    // Boolean operators
    case 'bool_is':
      result = Boolean(contextValue) === (constraint.value === 'true');
      break;
    // Date operators
    case 'date_eq':
      result =
        new Date(stringValue).getTime() === new Date(targetValue).getTime();
      break;
    case 'date_gt':
      result = new Date(stringValue) > new Date(targetValue);
      break;
    case 'date_gte':
      result = new Date(stringValue) >= new Date(targetValue);
      break;
    case 'date_lt':
      result = new Date(stringValue) < new Date(targetValue);
      break;
    case 'date_lte':
      result = new Date(stringValue) <= new Date(targetValue);
      break;
    // Semver operators
    case 'semver_eq':
      result = compareSemver(stringValue, targetValue) === 0;
      break;
    case 'semver_gt':
      result = compareSemver(stringValue, targetValue) > 0;
      break;
    case 'semver_gte':
      result = compareSemver(stringValue, targetValue) >= 0;
      break;
    case 'semver_lt':
      result = compareSemver(stringValue, targetValue) < 0;
      break;
    case 'semver_lte':
      result = compareSemver(stringValue, targetValue) <= 0;
      break;
    case 'semver_in':
      result = targetValues.some(
        (v: string) => compareSemver(stringValue, v) === 0
      );
      break;
    default:
      result = false;
  }

  return constraint.inverted ? !result : result;
}

function compareSemver(a: string, b: string): number {
  const parseVersion = (v: string): number[] => {
    const cleaned = v.replace(/^v/, '');
    return cleaned.split('.').map((n) => parseInt(n, 10) || 0);
  };

  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }
  return 0;
}

function getContextValue(name: string, context: Record<string, any>): any {
  switch (name) {
    case 'userId':
      return context.userId;
    case 'sessionId':
      return context.sessionId;
    case 'appName':
      return context.appName;
    case 'appVersion':
      return context.appVersion;
    case 'remoteAddress':
      return context.remoteAddress;
    default:
      return context.properties?.[name] ?? context[name];
  }
}

function calculatePercentage(
  context: Record<string, any>,
  stickiness: string,
  groupId: string
): number {
  let stickinessValue = '';
  if (stickiness === 'default' || stickiness === 'userId') {
    stickinessValue =
      context.userId || context.sessionId || String(Math.random());
  } else if (stickiness === 'sessionId') {
    stickinessValue = context.sessionId || String(Math.random());
  } else if (stickiness === 'random') {
    stickinessValue = String(Math.random());
  } else {
    stickinessValue = String(
      getContextValue(stickiness, context) || Math.random()
    );
  }

  return normalizedStrategyValue(stickinessValue, groupId);
}

function selectVariantForFlag(
  flag: any,
  variants: any[],
  context: Record<string, any>,
  matchedStrategy?: any,
  environmentId?: string
): { name: string; value?: any; valueType?: string; valueSource?: string } {
  const envSettings = environmentId
    ? flag.environments?.find((e: any) => e.environmentId === environmentId)
    : undefined;

  const resolvedEnabledValue = envSettings?.overrideEnabledValue
    ? envSettings.enabledValue
    : flag.enabledValue;
  const valueSource =
    envSettings?.overrideEnabledValue === true ? 'environment' : 'flag';

  if (variants.length === 0) {
    return {
      name:
        valueSource === 'environment'
          ? VALUE_SOURCE.ENV_DEFAULT_ENABLED
          : VALUE_SOURCE.FLAG_DEFAULT_ENABLED,
      value: getFallbackValue(resolvedEnabledValue, flag.valueType),
      valueType: flag.valueType || 'string',
      valueSource,
    };
  }

  const totalWeight = variants.reduce(
    (sum: number, v: any) => sum + v.weight,
    0
  );
  if (totalWeight <= 0) {
    return {
      name:
        valueSource === 'environment'
          ? VALUE_SOURCE.ENV_DEFAULT_ENABLED
          : VALUE_SOURCE.FLAG_DEFAULT_ENABLED,
      value: getFallbackValue(resolvedEnabledValue, flag.valueType),
      valueType: flag.valueType || 'string',
      valueSource,
    };
  }

  const stickiness = matchedStrategy?.parameters?.stickiness || 'default';
  const percentage = calculatePercentage(
    context,
    stickiness,
    `${flag.flagName}-variant`
  );
  const targetWeight = (percentage / 100) * totalWeight;

  let cumulativeWeight = 0;
  for (const variant of variants) {
    cumulativeWeight += variant.weight;
    if (targetWeight <= cumulativeWeight) {
      // Determine value and its source
      let value = variant.value;
      let actualValueSource: 'variant' | 'environment' | 'flag' = 'variant';
      if (value === undefined || value === null) {
        value = resolvedEnabledValue;
        actualValueSource = valueSource as any;
      }
      return {
        name: variant.variantName || variant.name,
        value: getFallbackValue(value, flag.valueType),
        valueType: flag.valueType || 'string',
        valueSource: value !== undefined ? actualValueSource : 'default',
      };
    }
  }
  const lastVariant = variants[variants.length - 1];
  let value = lastVariant.value;
  let actualValueSource: 'variant' | 'environment' | 'flag' = 'variant';
  if (value === undefined || value === null) {
    value = resolvedEnabledValue;
    actualValueSource = valueSource as any;
  }
  return {
    name: lastVariant.variantName || lastVariant.name,
    value: getFallbackValue(value, flag.valueType),
    valueType: flag.valueType || 'string',
    valueSource: value !== undefined ? actualValueSource : 'default',
  };
}

export default router;
