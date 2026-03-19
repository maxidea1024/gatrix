/**
 * AI Tools — Shared types and utilities
 */

import type { ToolDefinition } from './llm-provider';

export type RiskLevel = 'read' | 'low' | 'medium' | 'high';

// Tool definition with required permission and risk level
export interface AIToolConfig {
  tool: ToolDefinition;
  requiredPermission: string;
  riskLevel: RiskLevel;
  handler: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: Record<string, any>,
    orgId: number,
    userId: string
  ) => Promise<unknown>;
}

// Risk label appended to tool descriptions so the AI model is aware
const RISK_LABELS: Record<RiskLevel, string> = {
  read: '',
  low: ' [Risk: LOW — creates new data, easily reversible]',
  medium:
    ' [Risk: MEDIUM — modifies live data, confirm with user before executing]',
  high: ' [Risk: HIGH — immediate user-facing impact, always confirm with user first]',
};

export function descWithRisk(description: string, risk: RiskLevel): string {
  return description + RISK_LABELS[risk];
}
