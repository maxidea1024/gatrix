import { Expression } from '@/components/argus/query-dsl';
import { ArgusRelease } from '@/services/argusService';

/**
 * Evaluate a parsed AST against a single release for client-side filtering.
 */
export const evaluateAST = (
  node: Expression | null,
  release: ArgusRelease,
  totalSessionsAll: number
): boolean => {
  if (!node) return true;

  switch (node.type) {
    case 'Binary': {
      const leftVal = evaluateAST(node.left, release, totalSessionsAll);
      const rightVal = evaluateAST(node.right, release, totalSessionsAll);
      return node.operator === 'or' ? leftVal || rightVal : leftVal && rightVal;
    }
    case 'Not':
      return !evaluateAST(node.expression, release, totalSessionsAll);
    case 'Group':
      return evaluateAST(node.expression, release, totalSessionsAll);
    case 'FreeText': {
      const val = node.value.toLowerCase();
      return release.release.toLowerCase().includes(val);
    }
    case 'Filter': {
      const field = node.field.toLowerCase();
      let rVal: any;

      if (field === 'release' || field === 'version') {
        rVal = release.release;
      } else if (field === 'crash_free') {
        rVal = release.crash_free_rate;
      } else if (field === 'sessions') {
        rVal = release.total_sessions;
      } else if (field === 'errors') {
        rVal = release.error_count;
      } else if (field === 'new_issues') {
        rVal = release.new_issues;
      } else if (field === 'status') {
        const stage =
          totalSessionsAll === 0
            ? 'low'
            : (Number(release.total_sessions) / totalSessionsAll) * 100 >= 10
              ? 'adopted'
              : 'low';
        rVal = stage;
      } else {
        return true;
      }

      const op = node.operator;
      const target = node.value;

      if (typeof rVal === 'number') {
        const numTarget =
          typeof target === 'number'
            ? target
            : typeof target === 'string'
              ? parseFloat(target)
              : NaN;
        if (isNaN(numTarget)) return false;

        switch (op) {
          case '=':
            return rVal === numTarget;
          case '!=':
            return rVal !== numTarget;
          case '>':
            return rVal > numTarget;
          case '>=':
            return rVal >= numTarget;
          case '<':
            return rVal < numTarget;
          case '<=':
            return rVal <= numTarget;
          default:
            return false;
        }
      } else if (typeof rVal === 'string') {
        const strTarget = String(target).toLowerCase();
        const strVal = rVal.toLowerCase();

        switch (op) {
          case '=':
            return strVal === strTarget;
          case '!=':
            return strVal !== strTarget;
          case 'contains':
            return strVal.includes(strTarget);
          case '!contains':
            return !strVal.includes(strTarget);
          case 'startsWith':
            return strVal.startsWith(strTarget);
          case '!startsWith':
            return !strVal.startsWith(strTarget);
          case 'endsWith':
            return strVal.endsWith(strTarget);
          case '!endsWith':
            return !strVal.endsWith(strTarget);
          default:
            return false;
        }
      }
      return true;
    }
    case 'Partial':
    default:
      return true;
  }
};
