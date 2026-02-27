/**
 * Application Hostname Strategy
 *
 * Enables feature for applications running on specific hosts.
 */

import { hostname } from 'os';
import { EvaluationContext, StrategyParameters, StrategyEvaluationResult } from '../types';
import { Strategy } from './Strategy';

export class ApplicationHostnameStrategy extends Strategy {
    private readonly currentHostname: string;

    constructor() {
        super('applicationHostname');
        this.currentHostname = (
            process.env.HOSTNAME || hostname() || 'undefined'
        ).toLowerCase();
    }

    isEnabled(parameters: StrategyParameters, _context: EvaluationContext): boolean {
        return this.isEnabledWithDetails(parameters, _context).enabled;
    }

    isEnabledWithDetails(
        parameters: StrategyParameters,
        _context: EvaluationContext
    ): StrategyEvaluationResult {
        const hostNames = parameters.hostNames;
        if (!hostNames) {
            return { enabled: false, reason: 'No hostNames defined in parameters' };
        }

        const hostList = hostNames.toLowerCase().split(/\s*,\s*/);
        const matched = hostList.includes(this.currentHostname);

        return {
            enabled: matched,
            reason: matched
                ? `Hostname "${this.currentHostname}" found in list`
                : `Hostname "${this.currentHostname}" not in list [${hostList.join(', ')}]`,
            details: { currentHostname: this.currentHostname, hostList },
        };
    }
}
