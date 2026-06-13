import { useMemo } from 'react';

interface DataPoint {
  bucket: string;
  value: number;
}

interface SeriesMap {
  [label: string]: DataPoint[];
}

interface FormulaResult {
  data: DataPoint[];
  error: string;
}

// Tokenizer
type TokenType = 'NUMBER' | 'LABEL' | 'OP' | 'LPAREN' | 'RPAREN';
interface Token {
  type: TokenType;
  value: string;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
    } else if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
    } else if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
    } else if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num });
    } else if (/[A-Z]/.test(ch)) {
      tokens.push({ type: 'LABEL', value: ch });
      i++;
    } else {
      throw new Error(`Unexpected character: ${ch}`);
    }
  }
  return tokens;
}

// Shunting-yard algorithm for precedence
function precedence(op: string): number {
  if (op === '+' || op === '-') return 1;
  if (op === '*' || op === '/') return 2;
  return 0;
}

function toRPN(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const opStack: Token[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'NUMBER':
      case 'LABEL':
        output.push(token);
        break;
      case 'OP':
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1].type === 'OP' &&
          precedence(opStack[opStack.length - 1].value) >=
            precedence(token.value)
        ) {
          output.push(opStack.pop()!);
        }
        opStack.push(token);
        break;
      case 'LPAREN':
        opStack.push(token);
        break;
      case 'RPAREN':
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1].type !== 'LPAREN'
        ) {
          output.push(opStack.pop()!);
        }
        opStack.pop(); // Remove LPAREN
        break;
    }
  }

  while (opStack.length > 0) {
    output.push(opStack.pop()!);
  }

  return output;
}

function evaluateRPN(rpn: Token[], values: Record<string, number>): number {
  const stack: number[] = [];

  for (const token of rpn) {
    switch (token.type) {
      case 'NUMBER':
        stack.push(parseFloat(token.value));
        break;
      case 'LABEL':
        stack.push(values[token.value] ?? 0);
        break;
      case 'OP': {
        const b = stack.pop() ?? 0;
        const a = stack.pop() ?? 0;
        switch (token.value) {
          case '+':
            stack.push(a + b);
            break;
          case '-':
            stack.push(a - b);
            break;
          case '*':
            stack.push(a * b);
            break;
          case '/':
            stack.push(b === 0 ? 0 : a / b);
            break;
        }
        break;
      }
    }
  }

  return stack[0] ?? 0;
}

/**
 * Evaluates a formula expression against time-series data.
 * Each label (A, B, C...) maps to a series of DataPoints.
 * The formula is evaluated bucket-by-bucket.
 */
export function evaluateFormula(
  formula: string,
  seriesMap: SeriesMap
): FormulaResult {
  if (!formula.trim()) {
    return { data: [], error: '' };
  }

  try {
    const tokens = tokenize(formula);
    const rpn = toRPN(tokens);

    // Collect all unique buckets across all series
    const allBuckets = new Set<string>();
    for (const series of Object.values(seriesMap)) {
      for (const point of series) {
        allBuckets.add(point.bucket);
      }
    }

    // Create bucket→value maps for each label
    const labelMaps: Record<string, Map<string, number>> = {};
    for (const [label, series] of Object.entries(seriesMap)) {
      const map = new Map<string, number>();
      for (const point of series) {
        map.set(point.bucket, point.value);
      }
      labelMaps[label] = map;
    }

    // Evaluate formula for each bucket
    const sortedBuckets = Array.from(allBuckets).sort();
    const data: DataPoint[] = sortedBuckets.map((bucket) => {
      const values: Record<string, number> = {};
      for (const [label, map] of Object.entries(labelMaps)) {
        values[label] = map.get(bucket) ?? 0;
      }
      const result = evaluateRPN(rpn, values);
      return {
        bucket,
        value: isFinite(result) ? Math.round(result * 100) / 100 : 0,
      };
    });

    return { data, error: '' };
  } catch (e: any) {
    return { data: [], error: e.message || 'Invalid formula' };
  }
}

/**
 * React hook that memoizes formula evaluation.
 */
export function useFormulaEngine(
  formula: string,
  seriesMap: SeriesMap
): FormulaResult {
  return useMemo(
    () => evaluateFormula(formula, seriesMap),
    [formula, seriesMap]
  );
}
