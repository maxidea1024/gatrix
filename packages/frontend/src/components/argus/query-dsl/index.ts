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

// Field registry
export {
  ALL_QUERY_FIELDS,
  FIELD_PRESETS,
  getFieldsForDomain,
  getFieldByKey,
  isFieldInDomain,
  resolveAlias,
  getAliases,
  getFacetsEndpoint,
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
  QueryDomain,
  QueryFieldPreset,
  CursorContext,
  CursorContextType,
  SuggestionItem,
  SuggestionCategory,
  FieldType,
  FieldCategory,
} from './types';

export { TokenType, EditorState } from './types';
