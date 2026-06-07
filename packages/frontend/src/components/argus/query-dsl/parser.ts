// ============================================================================
// Query DSL Engine — Recursive Descent Parser
// Spec: Section 7
// ============================================================================
//
// Grammar (from EBNF):
//   Query         = Expression | ε
//   Expression    = OrExpr
//   OrExpr        = AndExpr ( OR AndExpr )*
//   AndExpr       = UnaryExpr ( AND UnaryExpr )*
//   UnaryExpr     = (NOT | BANG) UnaryExpr | Primary
//   Primary       = LPAREN Expression RPAREN | Filter | FreeText
//   Filter        = FIELD COLON ValueExpr
//   FreeText      = QuotedString | UnquotedString
//   ValueExpr     = CompareOp Value | FuncOp LPAREN ArgList RPAREN | Value
// ============================================================================

import { tokenize } from './lexer';
import { TokenType } from './types';
import type {
  Token,
  Expression,
  FilterExpression,
  FreeTextExpression,
  BinaryExpression,
  NotExpression,
  GroupExpression,
  PartialExpression,
  ParseResult,
  ValidationError,
  QueryOperator,
} from './types';

// ─── Public API ──────────────────────────────────────────────────────────────

export function parse(input: string): ParseResult {
  const tokens = tokenize(input);
  const parser = new Parser(tokens, input);
  return parser.parse();
}

// ─── Parser ──────────────────────────────────────────────────────────────────

const COMPARE_TOKEN_TO_OP: Partial<Record<TokenType, QueryOperator>> = {
  [TokenType.NE]: '!=',
  [TokenType.GT]: '>',
  [TokenType.GTE]: '>=',
  [TokenType.LT]: '<',
  [TokenType.LTE]: '<=',
};

const FUNC_TOKEN_TO_OP: Partial<Record<TokenType, QueryOperator>> = {
  [TokenType.CONTAINS]: 'contains',
  [TokenType.STARTS_WITH]: 'startsWith',
  [TokenType.ENDS_WITH]: 'endsWith',
  [TokenType.BEFORE]: 'before',
  [TokenType.AFTER]: 'after',
};

class Parser {
  private readonly tokens: Token[];
  private readonly input: string;
  private pos: number = 0;
  private errors: ValidationError[] = [];

  constructor(tokens: Token[], input: string) {
    this.tokens = tokens;
    this.input = input;
  }

  parse(): ParseResult {
    if (this.current().type === TokenType.EOF) {
      return { ast: null, tokens: this.tokens, errors: [] };
    }

    const ast = this.parseExpression();

    // Check for trailing tokens (not EOF)
    if (this.current().type !== TokenType.EOF) {
      const tok = this.current();
      this.addError('UNEXPECTED_TOKEN', tok.start, tok.end, {
        token: tok.value,
      });
    }

    return { ast, tokens: this.tokens, errors: this.errors };
  }

  // ─── Expression parsers ────────────────────────────────────────────

  private parseExpression(): Expression {
    return this.parseOrExpr();
  }

  private parseOrExpr(): Expression {
    let left = this.parseAndExpr();

    while (this.current().type === TokenType.OR) {
      const opToken = this.current();
      this.advance(); // consume OR

      if (this.isExpressionEnd()) {
        this.addError('DANGLING_OPERATOR', opToken.start, opToken.end, {
          op: 'or',
        });
        return left;
      }

      const right = this.parseAndExpr();
      left = {
        type: 'Binary',
        operator: 'or',
        left,
        right,
        start: left.start,
        end: right.end,
      } as BinaryExpression;
    }

    return left;
  }

  private parseAndExpr(): Expression {
    let left = this.parseUnaryExpr();

    while (this.current().type === TokenType.AND || this.isImplicitAndStart()) {
      let opToken: Token | null = null;
      if (this.current().type === TokenType.AND) {
        opToken = this.current();
        this.advance(); // consume AND
      }

      if (this.isExpressionEnd()) {
        if (opToken) {
          this.addError('DANGLING_OPERATOR', opToken.start, opToken.end, {
            op: 'and',
          });
        }
        return left;
      }

      const right = this.parseUnaryExpr();
      const isImplicit = opToken === null;
      left = {
        type: 'Binary',
        operator: 'and',
        left,
        right,
        implicit: isImplicit,
        start: left.start,
        end: right.end,
      } as BinaryExpression;
    }

    return left;
  }

  private isImplicitAndStart(): boolean {
    const type = this.current().type;
    return (
      type === TokenType.FIELD ||
      type === TokenType.STRING ||
      type === TokenType.NUMBER ||
      type === TokenType.BOOLEAN ||
      type === TokenType.LPAREN ||
      type === TokenType.NOT ||
      type === TokenType.BANG
    );
  }

  private parseUnaryExpr(): Expression {
    const tok = this.current();

    if (tok.type === TokenType.NOT) {
      this.advance();
      if (this.isExpressionEnd()) {
        this.addError('DANGLING_OPERATOR', tok.start, tok.end, { op: 'not' });
        return this.makePartial(tok.start, tok.end);
      }
      const expr = this.parseUnaryExpr();
      return {
        type: 'Not',
        expression: expr,
        usedBang: false,
        start: tok.start,
        end: expr.end,
      } as NotExpression;
    }

    if (tok.type === TokenType.BANG) {
      this.advance();
      if (this.isExpressionEnd()) {
        this.addError('DANGLING_OPERATOR', tok.start, tok.end, { op: '!' });
        return this.makePartial(tok.start, tok.end);
      }
      const expr = this.parseUnaryExpr();
      return {
        type: 'Not',
        expression: expr,
        usedBang: true,
        start: tok.start,
        end: expr.end,
      } as NotExpression;
    }

    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const tok = this.current();

    // Grouped expression: ( ... )
    if (tok.type === TokenType.LPAREN) {
      this.advance(); // consume (
      const expr = this.parseExpression();

      if (this.current().type === TokenType.RPAREN) {
        const end = this.current().end;
        this.advance(); // consume )
        return {
          type: 'Group',
          expression: expr,
          start: tok.start,
          end,
        } as GroupExpression;
      } else {
        this.addError('UNCLOSED_PAREN', tok.start, tok.end, {});
        return {
          type: 'Group',
          expression: expr,
          start: tok.start,
          end: expr.end,
        } as GroupExpression;
      }
    }

    // Filter: FIELD COLON ValueExpr
    if (tok.type === TokenType.FIELD && this.peek()?.type === TokenType.COLON) {
      return this.parseFilter();
    }

    // Free text: quoted or unquoted string without a field
    if (tok.type === TokenType.FIELD) {
      this.advance();
      return {
        type: 'FreeText',
        value: tok.value,
        quoted: false,
        start: tok.start,
        end: tok.end,
      } as FreeTextExpression;
    }

    if (tok.type === TokenType.STRING) {
      this.advance();
      return {
        type: 'FreeText',
        value: tok.value,
        quoted: true,
        start: tok.start,
        end: tok.end,
      } as FreeTextExpression;
    }

    // Unexpected token
    this.addError('UNEXPECTED_TOKEN', tok.start, tok.end, {
      token: tok.value,
    });
    this.advance();
    return this.makePartial(tok.start, tok.end);
  }

  private parseFilter(): FilterExpression {
    const fieldToken = this.current();
    this.advance(); // consume FIELD
    this.advance(); // consume COLON (we already verified it exists)

    const tok = this.current();

    // Check for comparison operator
    const compareOp = COMPARE_TOKEN_TO_OP[tok.type];
    if (compareOp) {
      this.advance(); // consume operator
      return this.parseFilterValue(fieldToken, compareOp);
    }

    // Check for function operator
    const funcOp = FUNC_TOKEN_TO_OP[tok.type];
    if (funcOp) {
      const funcToken = tok;
      this.advance(); // consume function name

      if (this.current().type === TokenType.LPAREN) {
        this.advance(); // consume (



        // Single arg function: contains("..."), before("..."), etc.
        const valueToken = this.current();
        let value: string | number | boolean = '';
        let quoted = false;

        if (valueToken.type === TokenType.STRING) {
          value = valueToken.value;
          quoted = true;
          this.advance();
        } else if (valueToken.type === TokenType.RPAREN) {
          // Empty function call: contains()
          this.addError('INCOMPLETE_FUNCTION', funcToken.start, funcToken.end, {
            op: funcToken.value,
          });
        } else {
          value = valueToken.value;
          this.advance();
        }

        let end = this.pos < this.tokens.length ? this.tokens[this.pos - 1].end : valueToken.end;

        if (this.current().type === TokenType.RPAREN) {
          end = this.current().end;
          this.advance(); // consume )
        } else {
          this.addError('UNCLOSED_PAREN', funcToken.start, end, {});
        }

        return {
          type: 'Filter',
          field: fieldToken.value,
          operator: funcOp,
          value,
          quoted,
          funcOp: funcToken.value,
          start: fieldToken.start,
          end,
        };
      } else {
        // Function name without parentheses
        this.addError('INCOMPLETE_FUNCTION', funcToken.start, funcToken.end, {
          op: funcToken.value,
        });
        return {
          type: 'Filter',
          field: fieldToken.value,
          operator: funcOp,
          value: '',
          quoted: false,
          funcOp: funcToken.value,
          start: fieldToken.start,
          end: funcToken.end,
        };
      }
    }

    // Simple value: field:value
    return this.parseFilterValue(fieldToken, '=');
  }

  private parseFilterValue(
    fieldToken: Token,
    operator: QueryOperator,
  ): FilterExpression {
    const tok = this.current();
    let value: string | number | boolean;
    let quoted = false;

    if (tok.type === TokenType.STRING) {
      // Check if the original text was quoted
      const rawChar = this.input[tok.start];
      quoted = rawChar === '"';
      value = tok.value;
      this.advance();
    } else if (tok.type === TokenType.NUMBER) {
      value = parseFloat(tok.value);
      this.advance();
    } else if (tok.type === TokenType.BOOLEAN) {
      value = tok.value === 'true';
      this.advance();
    } else if (tok.type === TokenType.EOF || tok.type === TokenType.AND ||
               tok.type === TokenType.OR || tok.type === TokenType.RPAREN) {
      // Incomplete filter: field: or field:> (no value)
      this.addError('INCOMPLETE_FILTER', fieldToken.start, this.tokens[this.pos - 1].end, {
        field: fieldToken.value,
      });
      return {
        type: 'Filter',
        field: fieldToken.value,
        operator,
        value: '',
        quoted: false,
        start: fieldToken.start,
        end: this.tokens[this.pos - 1].end,
      };
    } else {
      // Unexpected token as value — consume it anyway
      value = tok.value;
      this.advance();
    }

    return {
      type: 'Filter',
      field: fieldToken.value,
      operator,
      value,
      quoted,
      start: fieldToken.start,
      end: this.tokens[this.pos - 1].end,
    };
  }



  // ─── Helpers ───────────────────────────────────────────────────────

  private current(): Token {
    return this.tokens[this.pos] ?? {
      type: TokenType.EOF,
      value: '',
      start: this.input.length,
      end: this.input.length,
    };
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos + 1];
  }

  private advance(): void {
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
  }

  private isExpressionEnd(): boolean {
    const t = this.current().type;
    return t === TokenType.EOF || t === TokenType.RPAREN;
  }

  private makePartial(start: number, end: number): PartialExpression {
    return {
      type: 'Partial',
      raw: this.input.slice(start, end),
      start,
      end,
    };
  }

  private addError(
    type: ValidationError['type'],
    start: number,
    end: number,
    params: Record<string, string>,
  ): void {
    const typeKey = type.replace(/([A-Z])/g, (m) => m.toLowerCase());
    this.errors.push({
      type,
      messageKey: `dsl.error.${camelToSnake(type)}`,
      hintKey: `dsl.hint.${camelToSnake(type)}`,
      params,
      start,
      end,
      severity: ['INCOMPLETE_FILTER', 'INCOMPLETE_FUNCTION', 'DANGLING_OPERATOR', 'UNKNOWN_FIELD'].includes(type) ? 'warning' : 'error',
    });
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function camelToSnake(s: string): string {
  // DANGLING_OPERATOR → danglingOperator
  return s
    .split('_')
    .map((part, i) =>
      i === 0 ? part.toLowerCase() : part.charAt(0) + part.slice(1).toLowerCase(),
    )
    .join('');
}
