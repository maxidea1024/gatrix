import { createLogger } from './logger';

const logger = createLogger('query-parser');

// Tokens
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

// AST Nodes
export type ASTNode =
  | { type: 'AND'; left: ASTNode; right: ASTNode }
  | { type: 'OR'; left: ASTNode; right: ASTNode }
  | { type: 'NOT'; expr: ASTNode }
  | { type: 'CONDITION'; key: string; op: string; value: string | string[] }
  | { type: 'RAW_SEARCH'; value: string };

export class QueryParser {
  private pos = 0;
  private tokens: Token[] = [];
  private current = 0;

  constructor(
    private allowedColumns: Set<string>,
    private allowedAggregates: Set<string>
  ) {}

  private tokenize(input: string) {
    this.tokens = [];
    this.pos = 0;

    while (this.pos < input.length) {
      let char = input[this.pos];

      // Skip whitespace
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      if (char === '(') { this.tokens.push({ type: 'LPAREN', value: '(' }); this.pos++; continue; }
      if (char === ')') { this.tokens.push({ type: 'RPAREN', value: ')' }); this.pos++; continue; }
      if (char === '[') { this.tokens.push({ type: 'LBRACKET', value: '[' }); this.pos++; continue; }
      if (char === ']') { this.tokens.push({ type: 'RBRACKET', value: ']' }); this.pos++; continue; }
      if (char === ',') { this.tokens.push({ type: 'COMMA', value: ',' }); this.pos++; continue; }
      
      // Negation before key
      if (char === '!') {
        if (this.pos + 1 < input.length && input[this.pos + 1] !== '=') {
          this.tokens.push({ type: 'NEGATION', value: '!' });
          this.pos++;
          continue;
        }
      }

      // Operators
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

      // Quoted Strings
      if (char === '"' || char === "'") {
        const quote = char;
        let str = '';
        this.pos++;
        while (this.pos < input.length && input[this.pos] !== quote) {
          // simple escape
          if (input[this.pos] === '\\' && this.pos + 1 < input.length) {
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

      // Words (unquoted strings, keys, values)
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

      // Fallback
      this.tokens.push({ type: 'WORD', value: char });
      this.pos++;
    }
    this.tokens.push({ type: 'EOF', value: '' });
  }

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
        // Implicit AND if next token is NOT an operator/paren closing
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
      this.match('RPAREN'); // ignore missing closing parens for fault tolerance
      return expr;
    }

    let isNegated = false;
    if (this.match('NEGATION')) {
      isNegated = true;
    }

    const token = this.advance();
    
    // Raw Search
    if ((token.type === 'WORD' || token.type === 'QUOTED_STRING') && !['OP'].includes(this.peek().type)) {
      const node: ASTNode = { type: 'RAW_SEARCH', value: token.value };
      return isNegated ? { type: 'NOT', expr: node } : node;
    }

    // Key:Value
    if (token.type === 'WORD' || token.type === 'QUOTED_STRING') {
      const key = token.value;
      
      if (this.peek().type === 'OP') {
        let op = this.advance().value;
        if (op === ':') op = '=';

        // Check if list
        if (this.match('LBRACKET')) {
          const values: string[] = [];
          while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
            const vToken = this.advance();
            if (vToken.type === 'WORD' || vToken.type === 'QUOTED_STRING') {
              values.push(vToken.value);
            }
            this.match('COMMA'); // optional comma
          }
          this.match('RBRACKET');
          
          if (values.length > 0) {
            const node: ASTNode = { type: 'CONDITION', key, op: 'IN', value: values };
            return isNegated ? { type: 'NOT', expr: node } : node;
          }
        } else {
          const valToken = this.advance();
          if (valToken.type === 'WORD' || valToken.type === 'QUOTED_STRING') {
            const node: ASTNode = { type: 'CONDITION', key, op, value: valToken.value };
            return isNegated ? { type: 'NOT', expr: node } : node;
          }
        }
      }
    }

    // Unrecognized or dangling, treat as raw search fallback
    if (token.type !== 'EOF') {
      return { type: 'RAW_SEARCH', value: token.value };
    }
    
    return null;
  }

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

  // Generate SQL from AST
  public generateSQL(node: ASTNode | null, params: Record<string, string>): { where: string; having: string } {
    if (!node) return { where: '', having: '' };

    const genNode = (n: ASTNode): { w: string; h: string } => {
      if (n.type === 'AND') {
        const left = genNode(n.left);
        const right = genNode(n.right);
        const w = (left.w && right.w) ? `(${left.w} AND ${right.w})` : (left.w || right.w);
        const h = (left.h && right.h) ? `(${left.h} AND ${right.h})` : (left.h || right.h);
        return { w, h };
      }
      
      if (n.type === 'OR') {
        const left = genNode(n.left);
        const right = genNode(n.right);
        
        // OR across where and having is not supported cleanly in a single pass without subqueries.
        // If one is empty, it's easy. If both mix w and h, it's invalid SQL if put in one clause.
        // To keep it simple, if either branch has HAVING, the entire OR must be treated specially or rejected.
        // For our use case, Sentry prohibits OR between aggregates and non-aggregates.
        if ((left.h && right.w) || (left.w && right.h)) {
          throw new Error('Cannot OR between aggregate and non-aggregate filters');
        }
        
        const w = (left.w && right.w) ? `(${left.w} OR ${right.w})` : (left.w || right.w);
        const h = (left.h && right.h) ? `(${left.h} OR ${right.h})` : (left.h || right.h);
        return { w, h };
      }

      if (n.type === 'NOT') {
        const inner = genNode(n.expr);
        return {
          w: inner.w ? `NOT (${inner.w})` : '',
          h: inner.h ? `NOT (${inner.h})` : ''
        };
      }

      if (n.type === 'RAW_SEARCH') {
        const pName = `raw_${Math.random().toString(36).substring(7)}`;
        // If wildcard used
        const val = n.value.replace(/\*/g, '%');
        params[pName] = val.includes('%') ? val : `%${val}%`;
        return { w: `(message ILIKE {${pName}:String} OR title ILIKE {${pName}:String})`, h: '' };
      }

      if (n.type === 'CONDITION') {
        let key = n.key;
        let op = n.op;
        let isAggregate = false;

        // Check if key is aggregate function e.g. count()
        const aggMatch = key.match(/^(\w+)\((.*?)\)$/);
        if (aggMatch) {
          const fn = aggMatch[1].toLowerCase();
          if (!this.allowedAggregates.has(fn)) {
            return { w: '1=1', h: '' }; // Invalid
          }
          isAggregate = true;
          // Validate internal column if any
          const innerCol = aggMatch[2];
          if (innerCol && !this.allowedColumns.has(innerCol)) {
            return { w: '1=1', h: '' }; // Invalid
          }
        } else if (key === 'age') {
          // Special age tag: age:>24h
          const valStr = String(n.value);
          const match = valStr.match(/^(\d+)(h|d|w)$/);
          if (match) {
            const num = match[1];
            const unit = match[2] === 'h' ? 'HOUR' : match[2] === 'd' ? 'DAY' : 'WEEK';
            // age > 24h means timestamp < now() - 24h
            const realOp = op === '>' ? '<' : op === '<' ? '>' : op === '>=' ? '<=' : '>=';
            return { w: `timestamp ${realOp} now() - INTERVAL ${num} ${unit}`, h: '' };
          }
        } else if (key === 'event.timestamp' || key === 'timestamp') {
          const pName = `ts_${Math.random().toString(36).substring(7)}`;
          params[pName] = String(n.value);
          return { w: `timestamp ${op} parseDateTimeBestEffort({${pName}:String})`, h: '' };
        } else if (key === 'has') {
          const val = String(n.value);
          if (!this.allowedColumns.has(val)) {
            return { w: '1=1', h: '' }; 
          }
          return { w: `${val} != '' AND ${val} IS NOT NULL`, h: '' };
        } else if (!this.allowedColumns.has(key)) {
          // If neither agg nor allowed column, treat as raw search fallback or ignore
          return { w: '1=1', h: '' }; 
        }

        if (Array.isArray(n.value)) {
          if (op === '!=') op = 'NOT IN';
          if (op !== 'IN' && op !== 'NOT IN') op = 'IN'; // fallback
          
          const arrParams = n.value.map((v) => {
            const p = `p_${Math.random().toString(36).substring(7)}`;
            params[p] = v.replace(/\*/g, '%');
            return `{${p}:String}`;
          });
          
          const clause = `${key} ${op} (${arrParams.join(', ')})`;
          return { w: isAggregate ? '' : clause, h: isAggregate ? clause : '' };
        } else {
          // Wildcard support
          let val = String(n.value);
          if (val.includes('*')) {
            val = val.replace(/\*/g, '%');
            if (op === '=') op = 'ILIKE';
            if (op === '!=') op = 'NOT ILIKE';
          }
          
          const pName = `p_${Math.random().toString(36).substring(7)}`;
          
          // Numeric handling for aggregates or operators
          if (['>', '<', '>=', '<='].includes(op)) {
            if (!isNaN(Number(val))) {
              params[pName] = val; // let clickhouse handle type coercion or pass as string depending on config
              const clause = `${key} ${op} {${pName}:Float64}`;
              return { w: isAggregate ? '' : clause, h: isAggregate ? clause : '' };
            }
          }
          
          params[pName] = val;
          const clause = `${key} ${op} {${pName}:String}`;
          return { w: isAggregate ? '' : clause, h: isAggregate ? clause : '' };
        }
      }

      return { w: '', h: '' };
    };

    const result = genNode(node);
    // Cleanup 1=1 AND ... 
    return {
      where: result.w.replace(/\(1=1 AND /g, '(').replace(/ AND 1=1\)/g, ')').replace(/^1=1 AND /, '').replace(/ AND 1=1$/, '').replace(/^1=1$/, ''),
      having: result.h.replace(/\(1=1 AND /g, '(').replace(/ AND 1=1\)/g, ')').replace(/^1=1 AND /, '').replace(/ AND 1=1$/, '').replace(/^1=1$/, ''),
    };
  }
}
