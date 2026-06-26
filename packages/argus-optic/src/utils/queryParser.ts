import { createLogger } from './logger';
import type { SearchSchema, MapColumnDef } from '../types';

const logger = createLogger('query-parser');

// ─────────────────────────────────────────────────────────────────────────────
// QueryParser — A Sentry-compatible search query parser for ClickHouse
//
// This module implements a recursive-descent parser that converts a search
// query string into an Abstract Syntax Tree (AST), and then generates
// parameterised ClickHouse SQL WHERE / HAVING clauses from that AST.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  SUPPORTED QUERY SYNTAX                                                │
// │                                                                        │
// │  1. Key-value conditions:                                              │
// │     severity:error       → level = 'error'    (: is treated as =)      │
// │     severity:"info"      → level = 'info'     (quoted values)          │
// │     level!=warning       → level != 'warning'                          │
// │     count():>100         → HAVING count() > 100 (aggregate filter)     │
// │                                                                        │
// │  2. Logical operators (case-sensitive):                                │
// │     severity:error AND service:api   (explicit AND)                    │
// │     severity:error service:api       (implicit AND — space-separated)  │
// │     severity:error OR severity:warn  (explicit OR)                     │
// │                                                                        │
// │  3. Grouping with parentheses:                                         │
// │     (severity:error OR severity:warn) AND service:api                  │
// │                                                                        │
// │  4. Negation:                                                          │
// │     !severity:error      → NOT (level = 'error')                       │
// │                                                                        │
// │  5. List values (IN clause):                                           │
// │     severity:[error, warn]  → level IN ('error', 'warn')               │
// │                                                                        │
// │  6. Wildcard matching:                                                 │
// │     message:*timeout*    → message ILIKE '%timeout%'                   │
// │                                                                        │
// │  7. Special keys:                                                      │
// │     has:environment      → environment != '' AND environment IS NOT NULL│
// │     age:>24h             → timestamp < now() - INTERVAL 24 HOUR        │
// │                                                                        │
// │  8. Raw text (no key: prefix):                                         │
// │     timeout              → message ILIKE '%timeout%' (full-text search)│
// │                                                                        │
// │  9. Column aliases (e.g. severity → level):                            │
// │     The parser resolves user-friendly names to actual DB column names   │
// │     via the aliases map in the SearchSchema.                           │
// │                                                                        │
// │ 10. Compound text-matching operators:                                  │
// │     message.contains:timeout       → message ILIKE '%timeout%'         │
// │     message.not_contains:timeout   → message NOT ILIKE '%timeout%'     │
// │     message.starts_with:Error      → message ILIKE 'Error%'            │
// │     message.ends_with:.js          → message ILIKE '%.js'              │
// │     These operators use dot-notation: key.operator:value               │
// │                                                                        │
// │ 11. Map column fallback:                                               │
// │     server.region:eu-west-1                                            │
// │       → mapContains(tags, 'server.region')                             │
// │         AND tags['server.region'] = 'eu-west-1'                        │
// │     Unknown keys automatically fall back to the first Map column       │
// │     defined in the SearchSchema.                                       │
// └─────────────────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

// ─── Token Types ─────────────────────────────────────────────────────────────

type TokenType =
  | 'WORD'
  | 'QUOTED_STRING'
  | 'OR'
  | 'AND'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'OP'
  | 'NEGATION'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

// ─── AST Node Types ──────────────────────────────────────────────────────────

export type ASTNode =
  | { type: 'AND'; left: ASTNode; right: ASTNode }
  | { type: 'OR'; left: ASTNode; right: ASTNode }
  | { type: 'NOT'; expr: ASTNode }
  | { type: 'CONDITION'; key: string; op: string; value: string | string[] }
  | { type: 'RAW_SEARCH'; value: string };

// ─── QueryParser Class ──────────────────────────────────────────────────────

export class QueryParser {
  private pos = 0;
  private tokens: Token[] = [];
  private current = 0;
  private columnAliases: Record<string, string>;
  private allowedColumns: Set<string>;
  private allowedAggregates: Set<string>;
  private mapColumns: MapColumnDef[];

  /**
   * Schema-based construction. The schema defines all columns, Map columns,
   * and aliases in one place.
   *
   * @param schema            SearchSchema from types.ts
   * @param allowedAggregates Optional set of aggregate function names for HAVING.
   */
  constructor(
    schema: SearchSchema,
    allowedAggregates: Set<string> = new Set()
  ) {
    this.allowedColumns = new Set(Object.keys(schema.columns));
    this.allowedAggregates = allowedAggregates;
    this.columnAliases = schema.aliases || {};
    this.mapColumns = schema.mapColumns || [];
  }

  private resolveKey(key: string): string {
    return this.columnAliases[key] || key;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: TOKENIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  private tokenize(input: string) {
    this.tokens = [];
    this.pos = 0;

    while (this.pos < input.length) {
      let char = input[this.pos];

      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      if (char === '(') {
        this.tokens.push({ type: 'LPAREN', value: '(' });
        this.pos++;
        continue;
      }
      if (char === ')') {
        this.tokens.push({ type: 'RPAREN', value: ')' });
        this.pos++;
        continue;
      }
      if (char === '[') {
        this.tokens.push({ type: 'LBRACKET', value: '[' });
        this.pos++;
        continue;
      }
      if (char === ']') {
        this.tokens.push({ type: 'RBRACKET', value: ']' });
        this.pos++;
        continue;
      }
      if (char === ',') {
        this.tokens.push({ type: 'COMMA', value: ',' });
        this.pos++;
        continue;
      }

      if (char === '!') {
        if (this.pos + 1 < input.length && input[this.pos + 1] !== '=') {
          this.tokens.push({ type: 'NEGATION', value: '!' });
          this.pos++;
          continue;
        }
      }

      if (char === ':' || char === '=') {
        this.tokens.push({ type: 'OP', value: char });
        this.pos++;
        continue;
      }
      if (char === '!' && input[this.pos + 1] === '=') {
        this.tokens.push({ type: 'OP', value: '!=' });
        this.pos += 2;
        continue;
      }
      if (char === '>' || char === '<') {
        if (input[this.pos + 1] === '=') {
          this.tokens.push({ type: 'OP', value: char + '=' });
          this.pos += 2;
        } else {
          this.tokens.push({ type: 'OP', value: char });
          this.pos++;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        const quote = char;
        let str = '';
        this.pos++;
        while (this.pos < input.length && input[this.pos] !== quote) {
          if (input[this.pos] === '\\' && this.pos + 1 < input.length) {
            str += input[this.pos + 1];
            this.pos += 2;
          } else {
            str += input[this.pos];
            this.pos++;
          }
        }
        if (this.pos < input.length) this.pos++;
        this.tokens.push({ type: 'QUOTED_STRING', value: str });
        continue;
      }

      let wordMatch = input.slice(this.pos).match(/^[^\s\(\)\[\],:=><!'"]+/);
      if (wordMatch) {
        const word = wordMatch[0];
        if (word === 'OR') {
          this.tokens.push({ type: 'OR', value: 'OR' });
        } else if (word === 'AND') {
          this.tokens.push({ type: 'AND', value: 'AND' });
        } else {
          this.tokens.push({ type: 'WORD', value: word });
        }
        this.pos += word.length;
        continue;
      }

      this.tokens.push({ type: 'WORD', value: char });
      this.pos++;
    }

    this.tokens.push({ type: 'EOF', value: '' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: RECURSIVE-DESCENT PARSING
  // ═══════════════════════════════════════════════════════════════════════════

  private peek(): Token {
    return this.tokens[this.current];
  }

  private advance(): Token {
    if (this.current < this.tokens.length - 1) this.current++;
    return this.tokens[this.current - 1];
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.peek().type === type) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private parseExpression(): ASTNode | null {
    return this.parseOr();
  }

  private parseOr(): ASTNode | null {
    let expr = this.parseAnd();
    if (!expr) return null;

    while (this.match('OR')) {
      const right = this.parseAnd();
      if (right) {
        expr = { type: 'OR', left: expr, right };
      }
    }
    return expr;
  }

  private parseAnd(): ASTNode | null {
    let expr = this.parseCondition();
    if (!expr) return null;

    while (true) {
      if (this.match('AND')) {
        const right = this.parseCondition();
        if (right) expr = { type: 'AND', left: expr, right };
      } else {
        const nextType = this.peek().type;
        if (nextType !== 'EOF' && nextType !== 'OR' && nextType !== 'RPAREN') {
          const right = this.parseCondition();
          if (right) expr = { type: 'AND', left: expr, right };
          else break;
        } else {
          break;
        }
      }
    }
    return expr;
  }

  private parseCondition(): ASTNode | null {
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.match('RPAREN');
      return expr;
    }

    let isNegated = false;
    if (this.match('NEGATION')) {
      isNegated = true;
    }

    const token = this.advance();

    if (
      (token.type === 'WORD' || token.type === 'QUOTED_STRING') &&
      !['OP'].includes(this.peek().type)
    ) {
      const node: ASTNode = { type: 'RAW_SEARCH', value: token.value };
      return isNegated ? { type: 'NOT', expr: node } : node;
    }

    if (token.type === 'WORD' || token.type === 'QUOTED_STRING') {
      let key = token.value;

      const COMPOUND_OPS = [
        'contains',
        'not_contains',
        'starts_with',
        'not_starts_with',
        'ends_with',
        'not_ends_with',
      ];
      let compoundOp: string | null = null;
      const dotIdx = key.lastIndexOf('.');
      if (dotIdx > 0) {
        const suffix = key.slice(dotIdx + 1);
        if (COMPOUND_OPS.includes(suffix)) {
          compoundOp = suffix;
          key = key.slice(0, dotIdx);
        }
      }

      if (this.peek().type === 'OP') {
        let op = this.advance().value;
        if (op === ':') op = '=';

        if (op === '=' && this.peek().type === 'OP') {
          const nextOp = this.peek().value;
          if (['!=', '>', '<', '>=', '<='].includes(nextOp)) {
            op = this.advance().value;
          }
        }

        if (compoundOp) {
          switch (compoundOp) {
            case 'contains':
              op = 'CONTAINS';
              break;
            case 'not_contains':
              op = 'NOT_CONTAINS';
              break;
            case 'starts_with':
              op = 'STARTS_WITH';
              break;
            case 'ends_with':
              op = 'ENDS_WITH';
              break;
            case 'not_starts_with':
              op = 'NOT_STARTS_WITH';
              break;
            case 'not_ends_with':
              op = 'NOT_ENDS_WITH';
              break;
          }
        }

        if (this.match('LBRACKET')) {
          const values: string[] = [];
          while (
            this.peek().type !== 'RBRACKET' &&
            this.peek().type !== 'EOF'
          ) {
            const vToken = this.advance();
            if (vToken.type === 'WORD' || vToken.type === 'QUOTED_STRING') {
              values.push(vToken.value);
            }
            this.match('COMMA');
          }
          this.match('RBRACKET');

          if (values.length > 0) {
            const node: ASTNode = {
              type: 'CONDITION',
              key,
              op: op === '!=' ? '!=' : 'IN',
              value: values,
            };
            return isNegated ? { type: 'NOT', expr: node } : node;
          }
        } else {
          const valToken = this.advance();
          if (valToken.type === 'WORD' || valToken.type === 'QUOTED_STRING') {
            const node: ASTNode = {
              type: 'CONDITION',
              key,
              op,
              value: valToken.value,
            };
            return isNegated ? { type: 'NOT', expr: node } : node;
          }
        }
      }
    }

    if (token.type !== 'EOF') {
      return { type: 'RAW_SEARCH', value: token.value };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  public parse(input: string): ASTNode | null {
    if (!input || !input.trim()) return null;
    this.tokenize(input);
    this.current = 0;
    try {
      return this.parseExpression();
    } catch (e) {
      logger.warn('Failed to parse query', { input, error: e });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP COLUMN HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  private genMapCondition(
    mapKey: string,
    op: string,
    value: string | string[],
    params: Record<string, string>
  ): string {
    const mapCol = this.mapColumns[0];
    const keyParam = `mk_${Math.random().toString(36).substring(7)}`;
    params[keyParam] = mapKey;

    const mapRef = `${mapCol.name}[{${keyParam}:String}]`;
    const existCheck = `mapContains(${mapCol.name}, {${keyParam}:String})`;

    if (Array.isArray(value)) {
      if (op === '!=') op = 'NOT IN';
      if (op !== 'IN' && op !== 'NOT IN') op = 'IN';

      const arrParams = value.map((v) => {
        const p = `mv_${Math.random().toString(36).substring(7)}`;
        params[p] = v.replace(/\*/g, '%');
        return `{${p}:String}`;
      });

      return `(${existCheck} AND ${mapRef} ${op} (${arrParams.join(', ')}))`;
    }

    let val = String(value);

    if (val.includes('*')) {
      val = val.replace(/\*/g, '%');
      if (op === '=') op = 'ILIKE';
      if (op === '!=') op = 'NOT ILIKE';
    }

    if (op === 'CONTAINS') {
      op = 'ILIKE';
      val = `%${val}%`;
    } else if (op === 'NOT_CONTAINS') {
      op = 'NOT ILIKE';
      val = `%${val}%`;
    } else if (op === 'STARTS_WITH') {
      op = 'ILIKE';
      val = `${val}%`;
    } else if (op === 'ENDS_WITH') {
      op = 'ILIKE';
      val = `%${val}`;
    } else if (op === 'NOT_STARTS_WITH') {
      op = 'NOT ILIKE';
      val = `${val}%`;
    } else if (op === 'NOT_ENDS_WITH') {
      op = 'NOT ILIKE';
      val = `%${val}`;
    }

    const valParam = `mv_${Math.random().toString(36).substring(7)}`;
    params[valParam] = val;

    if (
      ['>', '<', '>=', '<='].includes(op) &&
      mapCol.valueType === 'Float64' &&
      !isNaN(Number(val))
    ) {
      return `(${existCheck} AND ${mapRef} ${op} {${valParam}:Float64})`;
    }

    return `(${existCheck} AND ${mapRef} ${op} {${valParam}:String})`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SQL GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  public generateSQL(
    node: ASTNode | null,
    params: Record<string, string>
  ): { where: string; having: string } {
    if (!node) return { where: '', having: '' };

    const genNode = (n: ASTNode): { w: string; h: string } => {
      if (n.type === 'AND') {
        const left = genNode(n.left);
        const right = genNode(n.right);
        const w =
          left.w && right.w ? `(${left.w} AND ${right.w})` : left.w || right.w;
        const h =
          left.h && right.h ? `(${left.h} AND ${right.h})` : left.h || right.h;
        return { w, h };
      }

      if (n.type === 'OR') {
        const left = genNode(n.left);
        const right = genNode(n.right);

        if ((left.h && right.w) || (left.w && right.h)) {
          throw new Error(
            'Cannot OR between aggregate and non-aggregate filters'
          );
        }

        const w =
          left.w && right.w ? `(${left.w} OR ${right.w})` : left.w || right.w;
        const h =
          left.h && right.h ? `(${left.h} OR ${right.h})` : left.h || right.h;
        return { w, h };
      }

      if (n.type === 'NOT') {
        const inner = genNode(n.expr);
        return {
          w: inner.w ? `NOT (${inner.w})` : '',
          h: inner.h ? `NOT (${inner.h})` : '',
        };
      }

      if (n.type === 'RAW_SEARCH') {
        const pName = `raw_${Math.random().toString(36).substring(7)}`;
        const val = n.value.replace(/\*/g, '%');
        params[pName] = val.includes('%') ? val : `%${val}%`;

        const textCandidates = [
          'message',
          'body',
          'value',
          'type',
          'transaction',
          'logger_name',
          'description',
        ];
        const textCols = textCandidates.filter((c) =>
          this.allowedColumns.has(c)
        );
        if (textCols.length === 0) {
          return { w: '1=0', h: '' };
        }
        const conds = textCols
          .map((c) => `${c} ILIKE {${pName}:String}`)
          .join(' OR ');
        return { w: `(${conds})`, h: '' };
      }

      if (n.type === 'CONDITION') {
        let key = this.resolveKey(n.key);
        let op = n.op;
        let isAggregate = false;

        const aggMatch = key.match(/^(\w+)\((.*?)\)$/);
        if (aggMatch) {
          const fn = aggMatch[1].toLowerCase();
          if (!this.allowedAggregates.has(fn)) {
            return { w: '1=1', h: '' };
          }
          isAggregate = true;
          const innerCol = aggMatch[2];
          if (innerCol && !this.allowedColumns.has(innerCol)) {
            return { w: '1=1', h: '' };
          }
        } else if (key === 'age') {
          const valStr = String(n.value);
          const match = valStr.match(/^(\d+)(h|d|w)$/);
          if (match) {
            const num = match[1];
            const unit =
              match[2] === 'h' ? 'HOUR' : match[2] === 'd' ? 'DAY' : 'WEEK';
            const realOp =
              op === '>' ? '<' : op === '<' ? '>' : op === '>=' ? '<=' : '>=';
            return {
              w: `timestamp ${realOp} now() - INTERVAL ${num} ${unit}`,
              h: '',
            };
          }
        } else if (key === 'event.timestamp' || key === 'timestamp') {
          const valStr = String(n.value);
          const nowMatch = valStr.match(/^(?:now)?([+-])(\d+)(h|d|w|m)$/);

          if (nowMatch) {
            const sign = nowMatch[1];
            const num = nowMatch[2];
            let unit = 'HOUR';
            if (nowMatch[3] === 'd') unit = 'DAY';
            else if (nowMatch[3] === 'w') unit = 'WEEK';
            else if (nowMatch[3] === 'm') unit = 'MINUTE';

            return {
              w: `timestamp ${op} now() ${sign} INTERVAL ${num} ${unit}`,
              h: '',
            };
          }

          const pName = `ts_${Math.random().toString(36).substring(7)}`;
          params[pName] = valStr;
          return {
            w: `timestamp ${op} parseDateTimeBestEffort({${pName}:String})`,
            h: '',
          };
        } else if (key === 'has') {
          const val = this.resolveKey(String(n.value));
          if (this.allowedColumns.has(val)) {
            return { w: `${val} != '' AND ${val} IS NOT NULL`, h: '' };
          }
          if (this.mapColumns.length > 0) {
            const pName = `mk_${Math.random().toString(36).substring(7)}`;
            params[pName] = val;
            return {
              w: `mapContains(${this.mapColumns[0].name}, {${pName}:String})`,
              h: '',
            };
          }
          return { w: '1=1', h: '' };

          // ── Unknown column → fall back to Map column ──
        } else if (!this.allowedColumns.has(key)) {
          if (this.mapColumns.length > 0) {
            return {
              w: this.genMapCondition(key, op, n.value, params),
              h: '',
            };
          }
          return { w: '1=1', h: '' };
        }

        // ── Generate SQL for the value side ──

        // Check if this known column also needs a Map fallback
        // (data may exist in either the column or the tags Map)
        const needsMapFallback = this.mapColumns.length > 0;

        if (Array.isArray(n.value)) {
          if (op === '!=') op = 'NOT IN';
          if (op !== 'IN' && op !== 'NOT IN') op = 'IN';

          const arrParams = n.value.map((v) => {
            const p = `p_${Math.random().toString(36).substring(7)}`;
            params[p] = v.replace(/\*/g, '%');
            return `{${p}:String}`;
          });

          const clause = `${key} ${op} (${arrParams.join(', ')})`;
          if (needsMapFallback && !isAggregate) {
            const mapClause = this.genMapCondition(
              key,
              op === 'IN' ? '=' : '!=',
              n.value,
              params
            );
            return { w: `(${clause} OR ${mapClause})`, h: '' };
          }
          return { w: isAggregate ? '' : clause, h: isAggregate ? clause : '' };
        } else {
          let val = String(n.value);

          if (val.includes('*')) {
            val = val.replace(/\*/g, '%');
            if (op === '=') op = 'ILIKE';
            if (op === '!=') op = 'NOT ILIKE';
          }

          if (op === 'CONTAINS') {
            op = 'ILIKE';
            val = `%${val}%`;
          } else if (op === 'NOT_CONTAINS') {
            op = 'NOT ILIKE';
            val = `%${val}%`;
          } else if (op === 'STARTS_WITH') {
            op = 'ILIKE';
            val = `${val}%`;
          } else if (op === 'ENDS_WITH') {
            op = 'ILIKE';
            val = `%${val}`;
          } else if (op === 'NOT_STARTS_WITH') {
            op = 'NOT ILIKE';
            val = `${val}%`;
          } else if (op === 'NOT_ENDS_WITH') {
            op = 'NOT ILIKE';
            val = `%${val}`;
          }

          const pName = `p_${Math.random().toString(36).substring(7)}`;

          if (['>', '<', '>=', '<='].includes(op)) {
            if (!isNaN(Number(val))) {
              params[pName] = val;
              const clause = `${key} ${op} {${pName}:Float64}`;
              return {
                w: isAggregate ? '' : clause,
                h: isAggregate ? clause : '',
              };
            }
          }

          params[pName] = val;
          const clause = `${key} ${op} {${pName}:String}`;

          // For non-aggregate, non-special columns: also check tags Map as fallback
          if (needsMapFallback && !isAggregate && (op === '=' || op === '!=')) {
            const mapClause = this.genMapCondition(key, n.op, n.value, params);
            if (op === '!=') {
              // Negative: column != val AND NOT in map
              return { w: `(${clause} AND ${mapClause})`, h: '' };
            }
            return { w: `(${clause} OR ${mapClause})`, h: '' };
          }

          return { w: isAggregate ? '' : clause, h: isAggregate ? clause : '' };
        }
      }

      return { w: '', h: '' };
    };

    const result = genNode(node);

    return {
      where: result.w
        .replace(/\(1=1 AND /g, '(')
        .replace(/ AND 1=1\)/g, ')')
        .replace(/^1=1 AND /, '')
        .replace(/ AND 1=1$/, '')
        .replace(/^1=1$/, ''),
      having: result.h
        .replace(/\(1=1 AND /g, '(')
        .replace(/ AND 1=1\)/g, ')')
        .replace(/^1=1 AND /, '')
        .replace(/ AND 1=1$/, '')
        .replace(/^1=1$/, ''),
    };
  }
}
