/**
 * AI CR Summary Service
 *
 * Generates human-readable title and description for a Change Request
 * based on its change items (ops and draftData).
 * Uses the same AI infrastructure as AISuggestService.
 */

import { createLogger } from '../../config/logger';
import { AISettingsService } from './ai-settings-service';
import { createLLMProvider, type ChatMessage } from './llm-provider';
import { resolveEntityLabel } from '../../utils/entity-label-resolver';

const logger = createLogger('AICRSummary');

export interface CRSummaryInput {
  changeItems: Array<{
    targetTable: string;
    targetId: string;
    displayName?: string;
    opType: string;
    ops?: Array<{
      path: string;
      oldValue: any;
      newValue: any;
      opType: string;
    }>;
    draftData?: Record<string, any>;
    beforeDraftData?: Record<string, any>;
  }>;
  actionGroups?: Array<{
    title: string;
    actionType: string;
  }>;
  envNameMap?: Record<string, string>;
}

export interface CRSummaryResult {
  title: string;
  description: string;
}

/**
 * Format change items into a structured text for the LLM
 */
function formatChangesForPrompt(input: CRSummaryInput): string {
  const lines: string[] = [];

  for (const item of input.changeItems) {
    const label =
      item.displayName ||
      resolveEntityLabel(item.targetTable, item.draftData || null) ||
      item.targetId;
    const cleanTable = item.targetTable.replace(/^g_/, '');

    lines.push(`## ${cleanTable} (${label}) — ${item.opType}`);

    if (item.ops && item.ops.length > 0) {
      for (const op of item.ops) {
        const oldStr =
          op.oldValue !== null && op.oldValue !== undefined
            ? JSON.stringify(op.oldValue)
            : 'null';
        const newStr =
          op.newValue !== null && op.newValue !== undefined
            ? JSON.stringify(op.newValue)
            : 'null';
        lines.push(`  ${op.opType} ${op.path}: ${oldStr} → ${newStr}`);
      }
    } else if (item.draftData) {
      // For draftData-based items, summarize what environments are being modified
      const envKeys = Object.keys(item.draftData).filter(
        (k) => !k.startsWith('_')
      );
      lines.push(
        `  Modified environments: ${envKeys.map((k) => input.envNameMap?.[k] || k).join(', ')}`
      );

      // Include key changes within each environment
      for (const envKey of envKeys) {
        const envName = input.envNameMap?.[envKey] || envKey;
        const envData = item.draftData[envKey];
        const beforeEnvData = item.beforeDraftData?.[envKey];
        if (envData && typeof envData === 'object') {
          const keys = Object.keys(envData).filter(
            (k) =>
              ![
                'id',
                'createdAt',
                'updatedAt',
                'createdBy',
                'updatedBy',
                'environmentId',
                'projectId',
              ].includes(k)
          );
          if (keys.length > 0) {
            const summary = keys.map((k) => {
              const val = envData[k];
              const oldVal = beforeEnvData?.[k];
              if (k === 'isEnabled') {
                if (oldVal !== undefined && oldVal !== val) {
                  return `isEnabled: ${oldVal} → ${val} (${val ? 'enabled' : 'disabled'})`;
                }
                return `isEnabled=${val} (${val ? 'enabled' : 'disabled'})`;
              }
              if (k === 'strategies' && Array.isArray(val)) {
                if (val.length === 0) {
                  if (Array.isArray(oldVal) && oldVal.length > 0) {
                    const names = oldVal.map(
                      (s: any) => s.name || s.strategyName || 'unknown'
                    );
                    return `strategies: removed ${oldVal.length} strategies (${names.join(', ')})`;
                  }
                  return 'strategies=removed all';
                }
                // Compare with old strategies to show actual parameter changes
                if (Array.isArray(oldVal) && oldVal.length > 0) {
                  const diffs: string[] = [];
                  for (const newS of val) {
                    const sName = newS.name || newS.strategyName || 'unknown';
                    const oldS = oldVal.find(
                      (o: any) => (o.name || o.strategyName) === sName
                    );
                    if (oldS && newS.parameters && oldS.parameters) {
                      for (const [pk, pv] of Object.entries(newS.parameters)) {
                        if (String(oldS.parameters[pk]) !== String(pv)) {
                          diffs.push(
                            `${sName}.${pk}: ${oldS.parameters[pk]} → ${pv}`
                          );
                        }
                      }
                    } else if (!oldS) {
                      diffs.push(`added strategy: ${sName}`);
                    }
                  }
                  for (const oldS of oldVal) {
                    const sName = oldS.name || oldS.strategyName || 'unknown';
                    if (
                      !val.find(
                        (n: any) => (n.name || n.strategyName) === sName
                      )
                    ) {
                      diffs.push(`removed strategy: ${sName}`);
                    }
                  }
                  if (diffs.length > 0)
                    return `strategies: ${diffs.join('; ')}`;
                  return `strategies(${val.length} rules, unchanged)`;
                }
                return `strategies(${val.length} rules)`;
              }
              if (k === 'variants' && Array.isArray(val)) {
                return `variants(${val.length} items)`;
              }
              if (typeof val === 'boolean' || val === 0 || val === 1) {
                return `${k}=${val}`;
              }
              return k;
            });
            lines.push(`    ${envName}: ${summary.join(', ')}`);
          }
        }
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are an assistant that generates concise titles and descriptions for Change Requests in a game operations platform.

RULES:
- Title: One line, max 80 characters. Format: "[Entity Type] Action: Entity Name" or descriptive summary
- The title MUST reflect ALL changes, not just the first or most prominent one. If a feature flag is disabled AND its strategies are removed, the title must mention BOTH actions (e.g. "비활성화 및 전략 제거" or "Disable and remove strategies")
- If there are MULTIPLE entities changed, use a combined format like "[Service Notice] Delete + [Game World] Create"
- Description: 2-5 sentences explaining WHAT changed and WHY it matters for reviewers
- NEVER include raw IDs (ULIDs, UUIDs, environment IDs, etc.) in the title or description. Use entity names and environment names instead.
- Use the entity name (not ID) when available
- Use environment display names (e.g. "Production", "Development") instead of environment IDs
- Focus on the semantic meaning of changes, not raw field names
- For feature flags: describe what the flag controls, what the rollout change means
- For strategy parameter changes: explicitly mention which parameters changed and how (e.g. "rollout 100% → 50%")
- For strategy additions/removals: mention the count and type of strategies
- For variants/weight changes: explain the rollout percentage shift
- For boolean toggles: describe what is being enabled/disabled
- Write in the same language as the entity names (Korean if Korean names, English otherwise)

RESPONSE FORMAT:
Return ONLY a JSON object with "title" and "description" fields. No markdown, no code blocks.
Example for single change: {"title": "[Feature Flag] Rollout update: new-feature-vtbc", "description": "Updated variant weights for new-feature-vtbc in Production."}
Example for multiple changes: {"title": "[Service Notice] Delete + [Game World] Create: UWO-CN-01", "description": "Deleted a service notice about bikini products. Also created a new game world UWO-CN-01 in Production environment."}`;

export class AICRSummaryService {
  /**
   * Generate a title and description for a Change Request.
   */
  static async generateSummary(
    orgId: string,
    input: CRSummaryInput,
    language?: string
  ): Promise<CRSummaryResult> {
    // Get AI settings
    const settings = await AISettingsService.getSettings(orgId);
    if (!settings || !settings.enabled || !settings.apiKey) {
      throw new Error('AI_NOT_CONFIGURED');
    }

    const changesText = formatChangesForPrompt(input);

    const langInstruction = language
      ? `\n\nIMPORTANT: Write the title and description in ${language === 'ko' ? 'Korean' : language === 'ja' ? 'Japanese' : language === 'zh' ? 'Chinese' : 'English'}.`
      : '';

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate a title and description for this Change Request:\n\n${changesText}${langInstruction}`,
      },
    ];

    const provider = createLLMProvider({
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      apiBaseUrl: settings.apiBaseUrl,
    });

    logger.info('Generating CR summary', {
      orgId,
      itemCount: input.changeItems.length,
      provider: settings.provider,
      model: settings.model,
    });

    const result = await provider.createCompletion(messages);
    return this.parseResult(result.content);
  }

  /**
   * Parse LLM response into title + description
   */
  private static parseResult(content: string): CRSummaryResult {
    try {
      const trimmed = content.trim();

      // Remove markdown code block wrapper if present
      let jsonStr = trimmed;
      const codeBlockMatch = trimmed.match(
        /```(?:json)?\s*\n?([\s\S]*?)\n?```/
      );
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      // Find JSON object
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed.title && parsed.description) {
          return {
            title: String(parsed.title).slice(0, 200),
            description: String(parsed.description).slice(0, 2000),
          };
        }
      }

      // Fallback: use the entire content as description
      return {
        title: 'Change Request',
        description: trimmed.slice(0, 2000),
      };
    } catch (error: any) {
      logger.error('Failed to parse AI CR summary', {
        error: error.message,
        content: content.substring(0, 200),
      });
      return {
        title: 'Change Request',
        description: content.slice(0, 2000),
      };
    }
  }
}
