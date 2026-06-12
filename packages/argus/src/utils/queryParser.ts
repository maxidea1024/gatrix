import { createLogger } from './logger';
import type { TableSchema, MapColumnDef } from './tableSchemas';

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
// │     via the columnAliases map passed to the constructor.               │
// │                                                                        │
// │ 10. Compound text-matching operators:                                  │
// │     message.contains:timeout       → message ILIKE '%timeout%'         │
// │     message.not_contains:timeout   → message NOT ILIKE '%timeout%'     │
// │     message.starts_with:Error      → message ILIKE 'Error%'            │
// │     message.ends_with:.js          → message ILIKE '%.js'              │
// │     These operators use dot-notation: key.operator:value               │
// └─────────────────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

// ─── Token Types ─────────────────────────────────────────────────────────────
// The tokenizer produces a flat array of typed tokens from the raw input.

type TokenType =
  | 'WORD' // Unquoted alphanumeric string (key name, unquoted value, etc.)
  | 'QUOTED_STRING' // String enclosed in single or double quotes (value)
  | 'OR' // Literal "OR" keyword (logical disjunction)
  | 'AND' // Literal "AND" keyword (logical conjunction — usually implicit)
  | 'LPAREN' // (  — opens a grouping expression
  | 'RPAREN' // )  — closes a grouping expression
  | 'LBRACKET' // [  — opens a list value (IN clause)
  | 'RBRACKET' // ]  — closes a list value
  | 'COMMA' // ,  — separates items inside a list
  | 'OP' // Operator: one of  :  =  !=  >  <  >=  <=
  | 'NEGATION' // !  — prefix negation before a key (e.g. !severity:error)
  | 'EOF'; // End-of-input sentinel

interface Token {
  type: TokenType;
  value: string;
}

// ─── AST Node Types ──────────────────────────────────────────────────────────
// The parser builds a tree of these nodes. Each leaf is either a CONDITION
// (key-op-value) or a RAW_SEARCH (free-text). Internal nodes are AND / OR / NOT.

export type ASTNode =
  | { type: 'AND'; left: ASTNode; right: ASTNode } // Conjunction
  | { type: 'OR'; left: ASTNode; right: ASTNode } // Disjunction
  | { type: 'NOT'; expr: ASTNode } // Negation wrapper
  | { type: 'CONDITION'; key: string; op: string; value: string | string[] } // key op value
  | { type: 'RAW_SEARCH'; value: string }; // Free-text search

// ─── QueryParser Class ──────────────────────────────────────────────────────

export class QueryParser {
  /** Character-level position used during tokenization */
  private pos = 0;
  /** Flat list of tokens produced by the tokenizer */
  private tokens: Token[] = [];
  /** Token-level cursor used during recursive-descent parsing */
  private current = 0;
  /** Map of user-friendly names → actual DB column names (e.g. severity → level) */
  private columnAliases: Record<string, string>;
  /** Set of valid top-level DB column names */
  private allowedColumns: Set<string>;
  /** Set of allowed aggregate function names (e.g. 'count', 'sum') */
  private allowedAggregates: Set<string>;
  /** Map(String, T) columns for dynamic key access fallback */
  private mapColumns: MapColumnDef[];

  /**
   * Overload 1: Schema-based construction (recommended).
   * The schema defines all columns, Map columns, and aliases in one place.
   *
   * @param schema            Table schema from tableSchemas.ts
   * @param allowedAggregates Optional set of aggregate function names for HAVING.
   */
  constructor(schema: TableSchema, allowedAggregates?: Set<string>);
  /**
   * Overload 2: Legacy construction (backward-compatible).
   *
   * @param allowedColumns    Set of valid DB column names.
   * @param allowedAggregates Set of allowed aggregate function names.
   * @param columnAliases     Optional map of alias → real column name.
   */
  constructor(
    allowedColumns: Set<string>,
    allowedAggregates: Set<string>,
    columnAliases?: Record<string, string>
  );
  constructor(
    arg1: Set<string> | TableSchema,
    arg2: Set<string> = new Set(),
    arg3: Record<string, string> = {}
  ) {
    if (arg1 instanceof Set) {
      // Legacy: Set<string>, Set<string>, aliases
      this.allowedColumns = arg1;
      this.allowedAggregates = arg2;
      this.columnAliases = arg3;
      this.mapColumns = [];
    } else {
      // Schema-based: TableSchema, aggregates?
      const schema = arg1;
      this.allowedColumns = new Set(Object.keys(schema.columns));
      this.allowedAggregates = arg2;
      this.columnAliases = schema.aliases || {};
      this.mapColumns = schema.mapColumns || [];
    }
  }

  /**
   * Resolve a user-facing key name to the actual DB column name via the alias
   * map. If no alias exists, the key is returned as-is.
   *
   * Example: resolveKey('severity') → 'level'   (if alias configured)
   *          resolveKey('service')  → 'service'  (no alias, pass-through)
   */
  private resolveKey(key: string): string {
    return this.columnAliases[key] || key;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: TOKENIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  // Scans the raw input string character-by-character and produces a flat
  // array of Token objects. Whitespace is consumed but not emitted.
  // ═══════════════════════════════════════════════════════════════════════════

  private tokenize(input: string) {
    this.tokens = [];
    this.pos = 0;

    while (this.pos < input.length) {
      let char = input[this.pos];

      // ── Skip whitespace (spaces, tabs, newlines) ──
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // ── Single-character structural tokens ──
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

      // ── Negation prefix (!) ──
      // Emitted only when '!' is NOT followed by '=' (which would be the != operator).
      // This allows expressions like:  !severity:error  →  NOT severity = error
      if (char === '!') {
        if (this.pos + 1 < input.length && input[this.pos + 1] !== '=') {
          this.tokens.push({ type: 'NEGATION', value: '!' });
          this.pos++;
          continue;
        }
      }

      // ── Operators (:  =  !=  >  <  >=  <=) ──
      // The colon ':' is the Sentry-style equality operator (treated as '=' during parsing).
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
        // Check for compound operators >= and <=
        if (input[this.pos + 1] === '=') {
          this.tokens.push({ type: 'OP', value: char + '=' });
          this.pos += 2;
        } else {
          this.tokens.push({ type: 'OP', value: char });
          this.pos++;
        }
        continue;
      }

      // ── Quoted strings ("..." or '...') ──
      // Supports backslash escaping inside quotes (e.g. "hello \"world\"").
      // The quotes themselves are NOT included in the token value.
      if (char === '"' || char === "'") {
        const quote = char;
        let str = '';
        this.pos++; // skip opening quote
        while (this.pos < input.length && input[this.pos] !== quote) {
          if (input[this.pos] === '\\' && this.pos + 1 < input.length) {
            // Escape sequence: consume backslash, keep the escaped character
            str += input[this.pos + 1];
            this.pos += 2;
          } else {
            str += input[this.pos];
            this.pos++;
          }
        }
        if (this.pos < input.length) this.pos++; // consume closing quote
        this.tokens.push({ type: 'QUOTED_STRING', value: str });
        continue;
      }

      // ── Unquoted words (keys, values, AND, OR) ──
      // A word is any contiguous run of characters that are NOT whitespace,
      // parentheses, brackets, commas, operators, or quotes.
      // The special words "AND" and "OR" are promoted to their own token types.
      //
      // Compound operators (key.contains, key.starts_with, etc.) are handled
      // by tokenizing the entire dot-notation key as a single WORD token.
      // The parser later splits it to extract the compound operator.
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

      // ── Fallback: treat any unrecognised character as a single-char WORD ──
      this.tokens.push({ type: 'WORD', value: char });
      this.pos++;
    }

    // Append EOF sentinel so the parser always has a safe lookahead
    this.tokens.push({ type: 'EOF', value: '' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: RECURSIVE-DESCENT PARSING
  // ═══════════════════════════════════════════════════════════════════════════
  // Grammar (informal):
  //
  //   expression   →  or_expr
  //   or_expr      →  and_expr ( "OR" and_expr )*
  //   and_expr     →  condition ( ("AND" | ε) condition )*      ← implicit AND
  //   condition    →  "(" expression ")"
  //                |  "!" condition                              ← negation
  //                |  WORD OP value                              ← key:value
  //                |  WORD OP "[" value ("," value)* "]"         ← key:[v1, v2]
  //                |  WORD | QUOTED_STRING                       ← raw text search
  //
  // IMPORTANT: Space-separated conditions without explicit AND/OR are treated
  // as IMPLICIT AND, matching Sentry's search behaviour.
  // e.g.  "severity:error service:api"  ≡  "severity:error AND service:api"
  // ═══════════════════════════════════════════════════════════════════════════

  /** Look at the current token without consuming it */
  private peek(): Token {
    return this.tokens[this.current];
  }

  /** Consume and return the current token, then advance the cursor */
  private advance(): Token {
    if (this.current < this.tokens.length - 1) this.current++;
    return this.tokens[this.current - 1];
  }

  /** If the current token matches any of the given types, consume it and return true */
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.peek().type === type) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /** Entry point: parse the full expression (lowest precedence = OR) */
  private parseExpression(): ASTNode | null {
    return this.parseOr();
  }

  /**
   * Parse OR expressions.
   * OR has the lowest precedence, so it wraps AND expressions.
   *
   * Example: "a OR b AND c"  →  OR(a, AND(b, c))
   */
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

  /**
   * Parse AND expressions (both explicit "AND" keyword and implicit AND).
   *
   * Implicit AND: if the next token is NOT EOF, OR, or RPAREN, we treat
   * the juxtaposition as AND. This is the key behaviour that allows
   * "severity:error service:api" to work without an explicit "AND".
   */
  private parseAnd(): ASTNode | null {
    let expr = this.parseCondition();
    if (!expr) return null;

    while (true) {
      if (this.match('AND')) {
        // ── Explicit AND keyword ──
        const right = this.parseCondition();
        if (right) expr = { type: 'AND', left: expr, right };
      } else {
        // ── Implicit AND ──
        // If the next token can start a new condition (i.e. it's not EOF,
        // OR, or a closing paren), treat the gap as an AND.
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

  /**
   * Parse a single condition (highest precedence).
   *
   * Handles:
   *   - Parenthesised sub-expressions: (expr)
   *   - Negation prefix: !expr
   *   - Key-operator-value: severity:error, count():>100
   *   - Key-operator-list: severity:[error, warn]
   *   - Raw text search: any bare word or quoted string without an operator
   */
  private parseCondition(): ASTNode | null {
    // ── Parenthesised group ──
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.match('RPAREN'); // tolerate missing closing paren for fault tolerance
      return expr;
    }

    // ── Negation prefix (!) ──
    let isNegated = false;
    if (this.match('NEGATION')) {
      isNegated = true;
    }

    const token = this.advance();

    // ── Raw text search ──
    // If the token is a word or quoted string and the NEXT token is NOT an
    // operator, this is a free-text search term (e.g. "timeout" or "connection reset").
    if (
      (token.type === 'WORD' || token.type === 'QUOTED_STRING') &&
      !['OP'].includes(this.peek().type)
    ) {
      const node: ASTNode = { type: 'RAW_SEARCH', value: token.value };
      return isNegated ? { type: 'NOT', expr: node } : node;
    }

    // ── Key-operator-value condition ──
    // The token is a key (e.g. "severity", "count()"), followed by an operator
    // (: = != > < >= <=), followed by a value (word, quoted string, or list).
    //
    // Compound operators are expressed as dot-notation keys:
    //   message.contains:timeout   → key='message', compoundOp='contains'
    //   message.starts_with:Error  → key='message', compoundOp='starts_with'
    if (token.type === 'WORD' || token.type === 'QUOTED_STRING') {
      let key = token.value;

      // ── Extract compound operator from dot-notation ──
      // Supported: .contains, .not_contains, .starts_with, .ends_with
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
        // Normalise Sentry-style colon operator to SQL equality
        if (op === ':') op = '=';

        // ── Colon followed by comparison operator: key:!=value, key:>100 ──
        // When ':' was consumed and the next token is also an operator,
        // the comparison operator overrides the default '=' from ':'.
        if (op === '=' && this.peek().type === 'OP') {
          const nextOp = this.peek().value;
          if (['!=', '>', '<', '>=', '<='].includes(nextOp)) {
            op = this.advance().value;
          }
        }

        // Apply compound operator — override the parsed op
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

        // ── List value: key:[val1, val2, val3] → IN clause ──
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
            this.match('COMMA'); // commas between items are optional
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
          // ── Single value: key:value or key:"value" ──
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

    // ── Fallback: unrecognised token → treat as raw search ──
    if (token.type !== 'EOF') {
      return { type: 'RAW_SEARCH', value: token.value };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse a raw search query string into an AST.
   *
   * @param input  The search query (e.g. 'severity:error service:api timeout')
   * @returns      The root AST node, or null if the input is empty/unparseable.
   */
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
  // Generates parameterised SQL for accessing dynamic keys stored in
  // ClickHouse Map(String, T) columns.
  //
  // Pattern:  mapContains(colName, key) AND colName[key] op value
  //
  // This is called by generateSQL when a search key is NOT found in
  // allowedColumns but mapColumns are configured.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a WHERE clause for a Map column access.
   *
   * @param mapKey  The dynamic key to access inside the Map (e.g. 'build')
   * @param op      SQL operator (=, !=, ILIKE, CONTAINS, IN, etc.)
   * @param value   Value or array of values to compare against
   * @param params  Mutable params map — will be populated with new entries
   * @returns       SQL fragment like `(mapContains(tags, {mk:String}) AND tags[{mk:String}] = {mv:String})`
   */
  private genMapCondition(
    mapKey: string,
    op: string,
    value: string | string[],
    params: Record<string, string>
  ): string {
    const mapCol = this.mapColumns[0]; // Default fallback: first Map column
    const keyParam = `mk_${Math.random().toString(36).substring(7)}`;
    params[keyParam] = mapKey;

    const mapRef = `${mapCol.name}[{${keyParam}:String}]`;
    const existCheck = `mapContains(${mapCol.name}, {${keyParam}:String})`;

    // ── List values (IN / NOT IN) ──
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

    // ── Single value ──
    let val = String(value);

    // Wildcard → ILIKE
    if (val.includes('*')) {
      val = val.replace(/\*/g, '%');
      if (op === '=') op = 'ILIKE';
      if (op === '!=') op = 'NOT ILIKE';
    }

    // Compound text-matching operators → ILIKE patterns
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

    // Numeric comparison on Float64 Map columns (e.g. measurements)
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
  // Walks the AST and produces two SQL clause strings:
  //
  //   where  — conditions on raw columns (goes in the WHERE clause)
  //   having — conditions on aggregate functions (goes in the HAVING clause)
  //
  // All values are injected via ClickHouse parameterised queries ({name:Type})
  // to prevent SQL injection. Parameter names are randomised to avoid collisions
  // when multiple conditions reference the same column.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate parameterised ClickHouse SQL from the AST.
   *
   * @param node    The root AST node (from parse())
   * @param params  Mutable map that will be populated with {paramName: value}
   *                entries for each condition. Pass this to ClickHouse query_params.
   * @returns       { where: string, having: string } — ready to splice into SQL.
   */
  public generateSQL(
    node: ASTNode | null,
    params: Record<string, string>
  ): { where: string; having: string } {
    if (!node) return { where: '', having: '' };

    /**
     * Recursive inner function. For each AST node, returns:
     *   w — the WHERE clause fragment
     *   h — the HAVING clause fragment
     * At most one of w/h will be non-empty for leaf nodes.
     */
    const genNode = (n: ASTNode): { w: string; h: string } => {
      // ── AND node: combine left and right with SQL AND ──
      if (n.type === 'AND') {
        const left = genNode(n.left);
        const right = genNode(n.right);
        const w =
          left.w && right.w ? `(${left.w} AND ${right.w})` : left.w || right.w;
        const h =
          left.h && right.h ? `(${left.h} AND ${right.h})` : left.h || right.h;
        return { w, h };
      }

      // ── OR node: combine left and right with SQL OR ──
      if (n.type === 'OR') {
        const left = genNode(n.left);
        const right = genNode(n.right);

        // Cross-clause OR (WHERE OR HAVING) is not valid SQL without subqueries.
        // Following Sentry's approach, we reject this combination.
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

      // ── NOT node: wrap the inner clause with SQL NOT ──
      if (n.type === 'NOT') {
        const inner = genNode(n.expr);
        return {
          w: inner.w ? `NOT (${inner.w})` : '',
          h: inner.h ? `NOT (${inner.h})` : '',
        };
      }

      // ── RAW_SEARCH node: free-text search across all text columns ──
      // Generates:  (message ILIKE '%term%' OR body ILIKE '%term%' OR ...)
      // Wildcards (*) in the search term are converted to SQL % wildcards.
      if (n.type === 'RAW_SEARCH') {
        const pName = `raw_${Math.random().toString(36).substring(7)}`;
        const val = n.value.replace(/\*/g, '%');
        params[pName] = val.includes('%') ? val : `%${val}%`;

        // Only search columns that exist in this table's allowedColumns set.
        // This prevents querying non-existent columns.
        const textCandidates = [
          'message',
          'body',
          'value',
          'type',
          'transaction',
          'logger_name',
        ];
        const textCols = textCandidates.filter((c) =>
          this.allowedColumns.has(c)
        );
        if (textCols.length === 0) {
          // No searchable text column available — return impossible condition
          return { w: '1=0', h: '' };
        }
        const conds = textCols
          .map((c) => `${c} ILIKE {${pName}:String}`)
          .join(' OR ');
        return { w: `(${conds})`, h: '' };
      }

      // ── CONDITION node: key-operator-value ──
      if (n.type === 'CONDITION') {
        // Apply column alias resolution (e.g. "severity" → "level")
        let key = this.resolveKey(n.key);
        let op = n.op;
        let isAggregate = false;

        // ── Aggregate function keys (e.g. count(), sum(duration)) ──
        // If the key looks like "func(col)", validate the function name and
        // inner column, then route the generated clause to HAVING instead of WHERE.
        const aggMatch = key.match(/^(\w+)\((.*?)\)$/);
        if (aggMatch) {
          const fn = aggMatch[1].toLowerCase();
          if (!this.allowedAggregates.has(fn)) {
            return { w: '1=1', h: '' }; // Unknown aggregate → silently ignore
          }
          isAggregate = true;
          const innerCol = aggMatch[2];
          if (innerCol && !this.allowedColumns.has(innerCol)) {
            return { w: '1=1', h: '' }; // Invalid column inside aggregate → ignore
          }

          // ── Special key: age (relative time filter) ──
          // Syntax: age:>24h, age:<7d, age:>=1w
          // Semantics: "age > 24h" means "the event is older than 24h",
          // which translates to "timestamp < now() - 24 HOUR" (inverted operator).
        } else if (key === 'age') {
          const valStr = String(n.value);
          const match = valStr.match(/^(\d+)(h|d|w)$/);
          if (match) {
            const num = match[1];
            const unit =
              match[2] === 'h' ? 'HOUR' : match[2] === 'd' ? 'DAY' : 'WEEK';
            // Invert the operator because "older than X" means "timestamp before X"
            const realOp =
              op === '>' ? '<' : op === '<' ? '>' : op === '>=' ? '<=' : '>=';
            return {
              w: `timestamp ${realOp} now() - INTERVAL ${num} ${unit}`,
              h: '',
            };
          }

          // ── Special key: timestamp / event.timestamp ──
          // Allows direct timestamp comparison using ClickHouse's flexible date parser.
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

          // ── Special key: has (existence check) ──
          // Syntax: has:environment  →  environment != '' AND environment IS NOT NULL
          // Checks that the given column has a non-empty, non-null value.
          // The value is also alias-resolved (e.g. has:severity → level != '' ...).
          // For Map columns: has:build → mapContains(tags, 'build')
        } else if (key === 'has') {
          const val = this.resolveKey(String(n.value));
          if (this.allowedColumns.has(val)) {
            return { w: `${val} != '' AND ${val} IS NOT NULL`, h: '' };
          }
          // Map column fallback: check key existence in Map
          if (this.mapColumns.length > 0) {
            const pName = `mk_${Math.random().toString(36).substring(7)}`;
            params[pName] = val;
            return {
              w: `mapContains(${this.mapColumns[0].name}, {${pName}:String})`,
              h: '',
            };
          }
          return { w: '1=1', h: '' }; // No map columns configured → ignore

          // ── Unknown column → fall back to Map column or silently ignore ──
          // Top-level columns are always checked first. If the key is not a
          // known column AND Map columns are configured, we generate map-access
          // SQL (mapContains + map[key]). Otherwise, emit 1=1 to prevent SQL
          // injection from arbitrary column names.
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

        // List values: key:[val1, val2] → IN / NOT IN clause
        if (Array.isArray(n.value)) {
          if (op === '!=') op = 'NOT IN';
          if (op !== 'IN' && op !== 'NOT IN') op = 'IN'; // default to IN

          const arrParams = n.value.map((v) => {
            const p = `p_${Math.random().toString(36).substring(7)}`;
            params[p] = v.replace(/\*/g, '%');
            return `{${p}:String}`;
          });

          const clause = `${key} ${op} (${arrParams.join(', ')})`;
          // Route to WHERE or HAVING depending on whether the key is an aggregate
          return { w: isAggregate ? '' : clause, h: isAggregate ? clause : '' };
        } else {
          // Single value
          let val = String(n.value);

          // ── Wildcard support ──
          // If the value contains '*', convert to SQL '%' and use ILIKE
          // e.g. message:*timeout* → message ILIKE '%timeout%'
          if (val.includes('*')) {
            val = val.replace(/\*/g, '%');
            if (op === '=') op = 'ILIKE';
            if (op === '!=') op = 'NOT ILIKE';
          }

          // ── Compound text-matching operators ──
          // Convert CONTAINS/NOT_CONTAINS/STARTS_WITH/ENDS_WITH to ILIKE patterns
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

          // ── Numeric comparison for >, <, >=, <= operators ──
          // When the value is numeric and the operator is a comparator,
          // use Float64 type hint for proper numeric comparison in ClickHouse.
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

          // ── Default: string comparison ──
          params[pName] = val;
          const clause = `${key} ${op} {${pName}:String}`;
          return { w: isAggregate ? '' : clause, h: isAggregate ? clause : '' };
        }
      }

      // Fallback for any unhandled node type — should not happen in practice
      return { w: '', h: '' };
    };

    const result = genNode(node);

    // ── Post-processing: strip no-op "1=1" fragments ──
    // When unknown columns are encountered, we emit "1=1" (always true) as a
    // placeholder. This cleanup pass removes those artifacts from the final SQL
    // so they don't clutter the query or confuse debugging.
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
