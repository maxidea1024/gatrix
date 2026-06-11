// ============================================================================
// AQL (Argus Query Language) Engine — Type Definitions
// Spec: packages/argus/docs/AQL_ENGINE_SPEC.md
// ============================================================================

// ─── Token Types ─────────────────────────────────────────────────────────────

export enum TokenType {
  // === Literals ===
  FIELD = 'FIELD',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',

  // === Structural ===
  COLON = 'COLON',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET', // [ (multi-value list)
  RBRACKET = 'RBRACKET', // ] (multi-value list)

  // === Comparison Operators (after colon) ===
  NE = 'NE', // !=
  GT = 'GT', // >
  GTE = 'GTE', // >=
  LT = 'LT', // <
  LTE = 'LTE', // <=

  // === Function Operators (identifiers after colon) ===
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
  BETWEEN = 'BETWEEN',
  NOT_CONTAINS = 'NOT_CONTAINS',
  NOT_STARTS_WITH = 'NOT_STARTS_WITH',
  NOT_ENDS_WITH = 'NOT_ENDS_WITH',

  // === Logical Operators ===
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  BANG = 'BANG', // ! (NOT의 축약형, != 와 구분)

  // === Special ===
  COMMA = 'COMMA', // , (function argument separator)
  EOF = 'EOF',
  ERROR = 'ERROR',
}

export interface Token {
  type: TokenType;
  value: string;
  start: number; // 0-indexed character offset (inclusive)
  end: number; // 0-indexed character offset (exclusive)
}

// ─── AST Nodes ───────────────────────────────────────────────────────────────

export type Expression =
  | FilterExpression
  | AggregateFilterExpression
  | FreeTextExpression
  | BinaryExpression
  | NotExpression
  | GroupExpression
  | PartialExpression;

export interface FilterExpression {
  type: 'Filter';
  field: string;
  operator: QueryOperator;
  value: string | number | boolean;
  /** Multiple values for in/!in operators */
  values?: (string | number | boolean)[];
  /** Whether the value was a quoted string in the input */
  quoted: boolean;
  /** For function operators: the function name (contains, startsWith, etc.) */
  funcOp?: string;
  start: number;
  end: number;
}

/**
 * Aggregate function filter: count():>100, avg(duration):>500, p95(response_time):>=1000
 * Created when Parser detects FIELD+LPAREN where FIELD matches DomainConfig.aggregates.
 */
export interface AggregateFilterExpression {
  type: 'AggregateFilter';
  /** Function name: count, avg, p95, uniq, etc. */
  funcName: string;
  /** Function arguments: ['duration'], ['user_id'], [] (for count) */
  args: string[];
  /** Comparison operator after colon */
  operator: QueryOperator;
  /** Comparison value */
  value: string | number | boolean;
  /** Whether the value was a quoted string */
  quoted: boolean;
  start: number;
  end: number;
}

/**
 * Free text without a field.
 * Created as FreeTextExpression in Parser (not converted to FilterExpression).
 * Serializer converts this to message:contains("...") for the backend.
 * Reason: Parser only structures AQL grammar. Semantic interpretation
 * (which field to map to) is the Serializer's responsibility.
 */
export interface FreeTextExpression {
  type: 'FreeText';
  value: string;
  quoted: boolean;
  start: number;
  end: number;
}

export interface BinaryExpression {
  type: 'Binary';
  operator: 'and' | 'or';
  left: Expression;
  right: Expression;
  implicit?: boolean;
  start: number;
  end: number;
}

export interface NotExpression {
  type: 'Not';
  expression: Expression;
  /** Whether ! was used instead of 'not' */
  usedBang: boolean;
  start: number;
  end: number;
}

export interface GroupExpression {
  type: 'Group';
  expression: Expression;
  start: number;
  end: number;
}

export interface PartialExpression {
  type: 'Partial';
  raw: string;
  field?: string;
  operator?: string;
  value?: string;
  start: number;
  end: number;
}

// ─── Parse Result ────────────────────────────────────────────────────────────

export interface ParseResult {
  ast: Expression | null;
  tokens: Token[];
  errors: ValidationError[];
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrorType =
  | 'DANGLING_OPERATOR'
  | 'UNEXPECTED_TOKEN'
  | 'INCOMPLETE_FILTER'
  | 'UNCLOSED_PAREN'
  | 'UNCLOSED_BRACKET'
  | 'UNCLOSED_QUOTE'
  | 'INCOMPLETE_FUNCTION'
  | 'UNKNOWN_FIELD'
  | 'INVALID_OPERATOR'
  | 'INVALID_VALUE_TYPE';

export interface ValidationError {
  type: ValidationErrorType;
  /** i18n message key: `AQL.error.${type}` */
  messageKey: string;
  /** i18n hint key: `AQL.hint.${type}` */
  hintKey: string;
  /** Interpolation params for i18n */
  params: Record<string, string>;
  field?: string;
  operator?: string;
  /** Raw text that caused the error */
  raw?: string;
  start: number;
  end: number;
  severity: 'error' | 'warning';
}

// ─── Query Fields ────────────────────────────────────────────────────────────

export type QueryOperator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | '!contains'
  | '!startsWith'
  | '!endsWith'
  | 'before'
  | 'after'
  | 'between';

export type FieldType = 'string' | 'number' | 'boolean' | 'datetime';

export type FieldCategory =
  | 'log'
  | 'resource'
  | 'trace'
  | 'event'
  | 'user'
  | 'custom';

export interface QueryField {
  key: string;
  label: string; // i18n key for display label
  type: FieldType;
  searchable: boolean;
  operators: QueryOperator[];
  autocompleteProvider?: string;
  category: FieldCategory;
  description: string; // i18n key for field description
  /** Static autocomplete values (e.g., status → ['resolved', 'unresolved']) */
  staticValues?: string[];
}

// ─── Domain Config ───────────────────────────────────────────────────────────

/** Definition of an aggregate function available in a domain */
export interface AggregateFunctionDef {
  /** Function name (lowercase): count, avg, p95, uniq, etc. */
  name: string;
  /** i18n key for display label */
  label: string;
  /** i18n key for description */
  description: string;
  /** Function arguments definition */
  args: {
    name: string;
    type: 'field' | 'number' | 'duration';
    required: boolean;
  }[];
  /** Return type (determines valid comparison operators) */
  returnType: 'number' | 'percentage' | 'duration';
}

export interface DomainConfig {
  /** Domain name (for logging/debugging and localStorage keys) */
  name: string;
  /** Fields available in this domain */
  fields: QueryField[];
  /** Field aliases (e.g., severity → level) */
  aliases?: Record<string, string>;
  /** Free text default mapping field (default: 'message') */
  freeTextField?: string;
  /** Aggregate functions available in this domain */
  aggregates?: AggregateFunctionDef[];
}

// ─── Editor FSM ──────────────────────────────────────────────────────────────

export enum EditorState {
  EXPECT_FIELD = 'EXPECT_FIELD',
  EXPECT_COLON = 'EXPECT_COLON',
  EXPECT_OPERATOR_OR_VALUE = 'EXPECT_OPERATOR_OR_VALUE',
  EXPECT_VALUE = 'EXPECT_VALUE',
  EXPECT_LOGICAL_OPERATOR = 'EXPECT_LOGICAL_OPERATOR',
  IN_QUOTED_STRING = 'IN_QUOTED_STRING',
  IN_PARENTHESIS = 'IN_PARENTHESIS',
}

// ─── Cursor Context ──────────────────────────────────────────────────────────

export type CursorContextType =
  | 'FIELD'
  | 'OPERATOR'
  | 'VALUE'
  | 'LOGICAL_OPERATOR';

export interface CursorContext {
  type: CursorContextType;
  field?: string;
  operator?: string;
  prefix: string;
  tokenStart: number;
  tokenEnd: number;
  editorState: EditorState;
  inQuotedString: boolean;
  inParenthesis: boolean;
  isNegated?: boolean;
}

// ─── Suggestion ──────────────────────────────────────────────────────────────

export type SuggestionCategory =
  | 'field'
  | 'operator'
  | 'value'
  | 'logical'
  | 'paren'
  | 'aggregate';

/** @deprecated Use SuggestionCategory instead */
export type SuggestionType = SuggestionCategory;

export interface SuggestionItem {
  label: string;
  insertText?: string;
  description?: string;
  category: SuggestionCategory;
  fieldType?: FieldType;
  /** Field domain category (log, resource, trace, etc.) for tab grouping */
  fieldCategory?: string;
  count?: number; // facet count
}

export interface SuggestionResult {
  items: SuggestionItem[];
  /** New input text after applying the completion */
  text: string;
  /** New cursor position after applying the completion */
  cursorOffset: number;
}

// ─── Component Props ─────────────────────────────────────────────────────────

export interface QueryAQLEditorProps {
  /** Domain config — determines fields, aliases, facet endpoints */
  config: DomainConfig;
  /** Initial query string */
  initialQuery?: string;
  /** Called on Enter only. Not called if syntax errors exist. */
  onSearch: (query: string) => void;
  /** Called when query changes (parent state sync) */
  onChange?: (query: string) => void;
  /** Lazy-loading callback: fetches values for a specific field on demand */
  fetchFieldValues?: (fieldKey: string) => Promise<string[]>;
  /** Maximum number of suggestion items (default: 20) */
  maxSuggestions?: number;
  /** Placeholder text (i18n key) */
  placeholder?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_MAX_SUGGESTIONS = 20;

/** Function operator keywords — only valid after colon */
export const FUNCTION_OPERATORS = new Set([
  'contains',
  'startswith',
  'endswith',
  'before',
  'after',
  'between',
  '!contains',
  '!startswith',
  '!endswith',
]);

/** Logical operator keywords */
export const LOGICAL_KEYWORDS = new Set(['and', 'or', 'not']);

/** Comparison operator characters that start a comparison operator after colon */
export const COMPARE_OP_CHARS = new Set(['!', '>', '<']);

/** Map from function operator keyword to TokenType */
export const FUNC_OP_TOKEN_MAP: Record<string, TokenType> = {
  contains: TokenType.CONTAINS,
  startswith: TokenType.STARTS_WITH,
  endswith: TokenType.ENDS_WITH,
  before: TokenType.BEFORE,
  after: TokenType.AFTER,
  between: TokenType.BETWEEN,
  '!contains': TokenType.NOT_CONTAINS,
  '!startswith': TokenType.NOT_STARTS_WITH,
  '!endswith': TokenType.NOT_ENDS_WITH,
};
