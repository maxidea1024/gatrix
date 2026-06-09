// ============================================================================
// Query DSL Engine — Barrel Exports
// ============================================================================

// Core engine
export { tokenize } from './lexer';
export { parse } from './parser';
export { validate } from './validator';
export { serializeForBackend } from './serializer';
export { formatQuery, renderTokensToSpans } from './formatter';
export type { TokenSpan } from './formatter';

// Autocomplete
export { resolveEditorState } from './editor-fsm';
export { resolveCursorContext } from './cursor-context';
export { getSuggestions, applyCompletion } from './suggestion-engine';

// Field registry & domain configs
export {
  ALL_QUERY_FIELDS,
  LOGS_CONFIG,
  ISSUES_CONFIG,
  DISCOVER_CONFIG,
  FEEDBACK_CONFIG,
  PERFORMANCE_CONFIG,
  SESSIONS_CONFIG,
  pickFields,
  getFieldByKey,
  isFieldInDomain,
  resolveAlias,
} from './fields';

// UI Components
export { QueryDSLEditor } from './QueryDSLEditor';
export type { QueryDSLEditorProps } from './QueryDSLEditor';
export { QuerySuggestionDropdown } from './QuerySuggestionDropdown';
export type { QuerySuggestionDropdownProps } from './QuerySuggestionDropdown';

// Types (re-export everything)
export type {
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
  QueryField,
  QueryOperator,
  DomainConfig,
  CursorContext,
  CursorContextType,
  SuggestionItem,
  SuggestionCategory,
  FieldType,
  FieldCategory,
} from './types';

export { TokenType, EditorState } from './types';
