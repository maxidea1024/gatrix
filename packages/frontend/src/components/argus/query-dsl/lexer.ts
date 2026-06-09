// ============================================================================
// Query DSL Engine — Lexer (Character-by-character tokenizer)
// Spec: Section 6
// ============================================================================
//
// Design Rules:
// - Character-by-character scan (NO regex)
// - Every token includes start/end position
// - Context-sensitive: function operators only after colon
// - Identifier: [a-zA-Z_][a-zA-Z0-9_.]*
// - Colon-after-space tolerance: `country: KR` → `country:KR`
// - Incomplete quotes → STRING token (not error)
// - Keywords are case-insensitive
// ============================================================================

import {
  TokenType,
  FUNCTION_OPERATORS,
  FUNC_OP_TOKEN_MAP,
} from './types';
import type { Token } from './types';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Tokenize a DSL query string into a list of tokens.
 * Every token has start/end character offsets (0-indexed, end exclusive).
 */
export function tokenize(input: string): Token[] {
  const lexer = new Lexer(input);
  return lexer.tokenize();
}

// ─── Lexer Implementation ────────────────────────────────────────────────────

class Lexer {
  private readonly input: string;
  private pos: number = 0;
  private tokens: Token[] = [];
  /**
   * Whether we are in a value context (after colon or after a comparison operator).
   * This determines whether words are parsed as values (STRING/NUMBER/BOOLEAN)
   * or as fields/keywords.
   */
  private afterColon: boolean = false;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      if (ch === ':') {
        this.emitSingle(TokenType.COLON, ':');
        this.afterColon = true;
        // Colon-after-space tolerance: skip whitespace after colon
        this.skipWhitespace();
        continue;
      }

      if (ch === '(') {
        this.emitSingle(TokenType.LPAREN, '(');
        this.afterColon = false;
        continue;
      }

      if (ch === ')') {
        this.emitSingle(TokenType.RPAREN, ')');
        this.afterColon = false;
        continue;
      }

      if (ch === ',') {
        this.emitSingle(TokenType.COMMA, ',');
        // Stay in afterColon context (inside function args)
        continue;
      }

      if (ch === '[') {
        this.emitSingle(TokenType.LBRACKET, '[');
        // Stay in afterColon context (inside value list)
        continue;
      }

      if (ch === ']') {
        this.emitSingle(TokenType.RBRACKET, ']');
        this.afterColon = false;
        continue;
      }

      if (ch === '"') {
        this.readQuotedString();
        this.afterColon = false;
        continue;
      }

      // Comparison operators (only valid after colon)
      if (this.afterColon && ch === '!' && this.peek(1) === '=') {
        this.emitFixed(TokenType.NE, '!=', 2);
        // Keep afterColon=true: value follows after comparison op
        continue;
      }

      if (this.afterColon && ch === '>') {
        if (this.peek(1) === '=') {
          this.emitFixed(TokenType.GTE, '>=', 2);
        } else {
          this.emitSingle(TokenType.GT, '>');
        }
        // Keep afterColon=true: value follows after comparison op
        continue;
      }

      if (this.afterColon && ch === '<') {
        if (this.peek(1) === '=') {
          this.emitFixed(TokenType.LTE, '<=', 2);
        } else {
          this.emitSingle(TokenType.LT, '<');
        }
        // Keep afterColon=true: value follows after comparison op
        continue;
      }

      // BANG (! as NOT prefix) — only when NOT after colon
      if (ch === '!' && !this.afterColon) {
        this.emitSingle(TokenType.BANG, '!');
        // afterColon stays false
        continue;
      }

      // Word: identifier, keyword, number, boolean, string value, or function op starting with !
      if (
        this.isIdentifierStart(ch) ||
        this.isDigit(ch) ||
        ch === '-' ||
        ch === '.' ||
        (this.afterColon && ch === '!')
      ) {
        this.readWord();
        continue;
      }

      // Unknown character → ERROR token
      this.emitSingle(TokenType.ERROR, ch);
      this.afterColon = false;
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      start: this.input.length,
      end: this.input.length,
    });

    return this.tokens;
  }

  // ─── Character readers ───────────────────────────────────────────────

  private readQuotedString(): void {
    const start = this.pos;
    this.pos++; // skip opening "

    let value = '';
    let closed = false;

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      if (ch === '\\' && this.pos + 1 < this.input.length) {
        // Escape sequence
        const next = this.input[this.pos + 1];
        if (next === '"' || next === '\\') {
          value += next;
          this.pos += 2;
          continue;
        }
      }

      if (ch === '"') {
        this.pos++; // skip closing "
        closed = true;
        break;
      }

      value += ch;
      this.pos++;
    }

    // Emit STRING whether closed or not (incomplete quote is not an error at lexer level)
    this.tokens.push({
      type: TokenType.STRING,
      value,
      start,
      end: this.pos,
    });

    // Track unclosed for downstream use — but lexer still produces valid token
    // The `closed` flag is not stored in Token, parser/validator will detect UNCLOSED_QUOTE
    void closed;
  }

  private readWord(): void {
    const start = this.pos;
    let word = '';

    // Consume word characters
    // After colon: allow more characters for values (-, ., digits at start, etc.)
    if (this.afterColon) {
      word = this.consumeValueChars();
    } else {
      word = this.consumeIdentifierOrKeyword();
    }

    if (word.length === 0) {
      // Shouldn't happen, but guard
      this.emitSingle(TokenType.ERROR, this.input[this.pos]);
      return;
    }

    const end = this.pos;

    // Classify the word
    if (this.afterColon) {
      this.emitValueToken(word, start, end);
    } else {
      this.emitFieldOrKeywordToken(word, start, end);
    }
  }

  /**
   * Consume characters valid in a value position (after colon).
   * More permissive than identifiers: allows leading digits, hyphens, dots.
   * Examples: KR, 100, 3.14, -50, now-1h, -7d, 2025-01-01T00:00:00
   */
  private consumeValueChars(): string {
    let word = '';
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (
        this.isWhitespace(ch) ||
        ch === ')' ||
        ch === '(' ||
        ch === ']' ||
        ch === '[' ||
        ch === '"' ||
        ch === ',' ||
        ch === ':'
      ) {
        break;
      }
      word += ch;
      this.pos++;
    }
    return word;
  }

  /**
   * Consume characters valid for identifiers and keywords.
   * Identifier: [a-zA-Z_][a-zA-Z0-9_.]*
   * Also handles words starting with digits (which become numbers or strings).
   */
  private consumeIdentifierOrKeyword(): string {
    let word = '';
    const startCh = this.input[this.pos];

    // If starts with digit or '-', consume as potential number/value
    if (this.isDigit(startCh) || startCh === '-' || startCh === '.') {
      while (this.pos < this.input.length) {
        const ch = this.input[this.pos];
        if (
          this.isWhitespace(ch) ||
          ch === ')' ||
          ch === '(' ||
          ch === ']' ||
          ch === '[' ||
          ch === '"' ||
          ch === ',' ||
          ch === ':'
        ) {
          break;
        }
        word += ch;
        this.pos++;
      }
      return word;
    }

    // Identifier: [a-zA-Z_][a-zA-Z0-9_.]*
    if (this.isIdentifierStart(startCh)) {
      word += startCh;
      this.pos++;
      while (this.pos < this.input.length) {
        const ch = this.input[this.pos];
        if (this.isIdentifierContinue(ch)) {
          word += ch;
          this.pos++;
        } else {
          break;
        }
      }
      return word;
    }

    // Fallback: single char
    word += startCh;
    this.pos++;
    return word;
  }

  /**
   * Emit a token for a word found after colon (value position).
   * Checks: function operator → number → boolean → string
   */
  private emitValueToken(word: string, start: number, end: number): void {
    const lower = word.toLowerCase();

    // Function operators: only if followed by '('
    if (FUNCTION_OPERATORS.has(lower) && this.peekNonWhitespace() === '(') {
      const tokenType = FUNC_OP_TOKEN_MAP[lower];
      if (tokenType) {
        this.tokens.push({ type: tokenType, value: word, start, end });
        this.afterColon = false;
        return;
      }
    }

    // Number: integer or float, possibly negative
    if (this.isNumber(word)) {
      this.tokens.push({ type: TokenType.NUMBER, value: word, start, end });
      this.afterColon = false;
      return;
    }

    // Boolean
    if (lower === 'true' || lower === 'false') {
      this.tokens.push({ type: TokenType.BOOLEAN, value: lower, start, end });
      this.afterColon = false;
      return;
    }

    // Default: string value
    this.tokens.push({ type: TokenType.STRING, value: word, start, end });
    this.afterColon = false;
  }

  /**
   * Emit a token for a word found outside value position.
   * Checks: is it a keyword? Or a field?
   * Lookahead: if colon follows, it's a FIELD (even if it matches a keyword).
   */
  private emitFieldOrKeywordToken(
    word: string,
    start: number,
    end: number
  ): void {
    const lower = word.toLowerCase();

    // Lookahead: if ':' follows (possibly with whitespace), treat as FIELD
    // This handles `and:value` → FIELD("and"), not AND keyword
    if (this.peekNonWhitespace() === ':') {
      this.tokens.push({ type: TokenType.FIELD, value: word, start, end });
      this.afterColon = false;
      return;
    }

    // Logical keywords
    if (lower === 'and') {
      this.tokens.push({ type: TokenType.AND, value: word, start, end });
      this.afterColon = false;
      return;
    }
    if (lower === 'or') {
      this.tokens.push({ type: TokenType.OR, value: word, start, end });
      this.afterColon = false;
      return;
    }
    if (lower === 'not') {
      this.tokens.push({ type: TokenType.NOT, value: word, start, end });
      this.afterColon = false;
      return;
    }

    // Boolean values outside of value context → still boolean if standalone
    if (lower === 'true' || lower === 'false') {
      // But if colon follows → FIELD. Already handled above.
      // Outside colon context, boolean keyword is treated as a FIELD (identifier)
      // that could be a free text search target.
      this.tokens.push({ type: TokenType.FIELD, value: word, start, end });
      this.afterColon = false;
      return;
    }

    // Number at field position → treated as FIELD (free text)
    if (this.isNumber(word)) {
      this.tokens.push({ type: TokenType.FIELD, value: word, start, end });
      this.afterColon = false;
      return;
    }

    // Default: FIELD (identifier)
    this.tokens.push({ type: TokenType.FIELD, value: word, start, end });
    this.afterColon = false;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private emitSingle(type: TokenType, value: string): void {
    this.tokens.push({ type, value, start: this.pos, end: this.pos + 1 });
    this.pos++;
  }

  private emitFixed(type: TokenType, value: string, length: number): void {
    this.tokens.push({ type, value, start: this.pos, end: this.pos + length });
    this.pos += length;
  }

  private skipWhitespace(): void {
    while (
      this.pos < this.input.length &&
      this.isWhitespace(this.input[this.pos])
    ) {
      this.pos++;
    }
  }

  private peek(offset: number): string | undefined {
    const idx = this.pos + offset;
    return idx < this.input.length ? this.input[idx] : undefined;
  }

  /** Peek next non-whitespace character without advancing position */
  private peekNonWhitespace(): string | undefined {
    let i = this.pos;
    while (i < this.input.length && this.isWhitespace(this.input[i])) {
      i++;
    }
    return i < this.input.length ? this.input[i] : undefined;
  }

  private isWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isLetter(ch: string): boolean {
    return (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch.charCodeAt(0) > 127
    );
  }

  /** Valid first character of an identifier: [a-zA-Z_] */
  private isIdentifierStart(ch: string): boolean {
    return this.isLetter(ch) || ch === '_';
  }

  /** Valid continuation character: [a-zA-Z0-9_.] */
  private isIdentifierContinue(ch: string): boolean {
    return this.isLetter(ch) || this.isDigit(ch) || ch === '_' || ch === '.';
  }

  /** Check if a string is a valid number (integer or decimal, optionally negative) */
  private isNumber(word: string): boolean {
    if (word.length === 0) return false;

    let i = 0;
    if (word[0] === '-') {
      if (word.length === 1) return false;
      i = 1;
    }

    let hasDigit = false;
    let hasDot = false;

    while (i < word.length) {
      const ch = word[i];
      if (this.isDigit(ch)) {
        hasDigit = true;
      } else if (ch === '.' && !hasDot) {
        hasDot = true;
      } else {
        return false;
      }
      i++;
    }

    return hasDigit;
  }
}
