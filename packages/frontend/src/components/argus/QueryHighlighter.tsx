import React, { useMemo } from 'react';
import { ContentCopy as CopyIcon } from '@mui/icons-material';
import SafeTooltip from '@/components/common/SafeTooltip';
import { useTranslation } from 'react-i18next';
import {
  PreviewContainer,
  EmptyPreview,
  CopyButton,
} from './QueryHighlighter.styles';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueryHighlighterProps {
  /** The query string to render with syntax highlighting */
  query: string;
  /** Which syntax to use for coloring */
  mode: 'dsl' | 'clickhouse';
  /** Dark mode flag */
  isDark: boolean;
  /** Show copy button */
  showCopy?: boolean;
  /** Optional placeholder when query is empty */
  emptyText?: string;
}

// ─── Token classification ────────────────────────────────────────────────────

interface ColoredSpan {
  text: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
}

// ─── DSL Syntax Colors ──────────────────────────────────────────────────────

function getDslColors(isDark: boolean) {
  return {
    field: isDark ? '#ce93d8' : '#7b1fa2', // purple
    operator: isDark ? '#ffb74d' : '#ed6c02', // orange (AND, OR, NOT)
    funcOp: isDark ? '#64b5f6' : '#1565c0', // blue (contains, starts_with)
    string: isDark ? '#a5d6a7' : '#2e7d32', // green
    number: isDark ? '#90caf9' : '#1976d2', // blue
    colon: isDark ? '#e0e0e0' : '#616161', // neutral
    negation: isDark ? '#ef9a9a' : '#c62828', // red (!)
    paren: isDark ? '#b0bec5' : '#546e7a', // grey
    has: isDark ? '#80cbc4' : '#00695c', // teal (has, !has)
    text: isDark ? '#e0e0e0' : '#424242', // default
  };
}

function tokenizeDsl(query: string, isDark: boolean): ColoredSpan[] {
  if (!query) return [];

  const colors = getDslColors(isDark);
  const spans: ColoredSpan[] = [];

  // Regex to match DSL tokens (order matters — more specific patterns first):
  // 1. Quoted strings: "..." or '...'
  // 2. Function operators after dot: .contains: .starts_with: etc.
  // 3. Logical operators: AND OR NOT
  // 4. has:"field" or !has:"field" — special keyword
  // 5. Negation: ! before field name (but not !has)
  // 6. Colon
  // 7. Comparison operators in value: >= <= > < !=
  // 8. Field names (before colon)
  // 9. Parens
  // 10. Everything else
  const tokenRegex =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:AND|OR|NOT)\b)|(\.(?:contains|not_contains|starts_with|not_starts_with|ends_with|not_ends_with|before|after|between):)|(!?has(?=:))|(!(?=[a-zA-Z_]))|(:)|([><=!]+(?=\d|"))|([a-zA-Z_][\w.]*(?=:))|(\(|\))|(\S+)/gi;

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(query)) !== null) {
    // Add whitespace between tokens
    if (match.index > lastIndex) {
      spans.push({
        text: query.slice(lastIndex, match.index),
        color: colors.text,
      });
    }

    const [
      fullMatch,
      quoted,
      logical,
      funcOp,
      hasKeyword,
      negation,
      colon,
      compareOp,
      field,
      paren,
      other,
    ] = match;

    if (quoted) {
      spans.push({ text: fullMatch, color: colors.string });
    } else if (logical) {
      spans.push({ text: fullMatch, color: colors.operator, bold: true });
    } else if (funcOp) {
      spans.push({ text: fullMatch, color: colors.funcOp, bold: true });
    } else if (hasKeyword) {
      // has or !has keyword
      spans.push({ text: fullMatch, color: colors.has, bold: true });
    } else if (negation) {
      spans.push({ text: fullMatch, color: colors.negation, bold: true });
    } else if (colon) {
      spans.push({ text: fullMatch, color: colors.colon });
    } else if (compareOp) {
      spans.push({ text: fullMatch, color: colors.operator, bold: true });
    } else if (field) {
      spans.push({ text: fullMatch, color: colors.field, bold: true });
    } else if (paren) {
      spans.push({ text: fullMatch, color: colors.paren });
    } else if (other) {
      if (/^\d+(\.\d+)?$/.test(other)) {
        spans.push({ text: fullMatch, color: colors.number });
      } else {
        spans.push({ text: fullMatch, color: colors.text });
      }
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Trailing text
  if (lastIndex < query.length) {
    spans.push({ text: query.slice(lastIndex), color: colors.text });
  }

  return spans;
}

// ─── ClickHouse SQL Colors ───────────────────────────────────────────────────

function getSqlColors(isDark: boolean) {
  return {
    keyword: isDark ? '#ffb74d' : '#ed6c02',
    string: isDark ? '#a5d6a7' : '#2e7d32',
    comment: isDark ? '#607d8b' : '#9e9e9e',
    field: isDark ? '#e0e0e0' : '#424242',
    operator: isDark ? '#90caf9' : '#1976d2',
  };
}

function tokenizeSql(query: string, isDark: boolean): ColoredSpan[][] {
  if (!query) return [];

  const colors = getSqlColors(isDark);
  const lines = query.split('\n');

  return lines.map((line) => {
    const spans: ColoredSpan[] = [];

    if (line.trimStart().startsWith('--')) {
      spans.push({ text: line, color: colors.comment, italic: true });
      return spans;
    }

    const parts = line.split(
      /('(?:[^']|'')*')|((?:NOT\s+)?ILIKE|IS\s+NOT\s+NULL|IS\s+NULL|\bWHERE\b|\bAND\b|\bOR\b|\bNOT\b|\bIN\b|\bBETWEEN\b|!=|>=|<=|[=><])/g
    );

    for (const part of parts) {
      if (!part) continue;

      if (part.startsWith("'") && part.endsWith("'")) {
        spans.push({ text: part, color: colors.string });
      } else if (
        /^(WHERE|AND|OR|NOT|IN|BETWEEN|IS\s+NOT\s+NULL|IS\s+NULL)$/i.test(
          part.trim()
        )
      ) {
        spans.push({ text: part, color: colors.keyword, bold: true });
      } else if (/^((?:NOT\s+)?ILIKE)$/i.test(part.trim())) {
        spans.push({ text: part, color: colors.keyword, bold: true });
      } else if (/^[!=><]+$/.test(part.trim())) {
        spans.push({ text: part, color: colors.operator, bold: true });
      } else {
        spans.push({ text: part, color: colors.field });
      }
    }

    return spans;
  });
}

// ─── Render Helpers ──────────────────────────────────────────────────────────

const SpanRenderer: React.FC<{ spans: ColoredSpan[] }> = ({ spans }) => (
  <>
    {spans.map((span, i) => (
      <span
        key={i}
        style={{
          color: span.color,
          fontWeight: span.bold ? 700 : undefined,
          fontStyle: span.italic ? 'italic' : undefined,
        }}
      >
        {span.text}
      </span>
    ))}
  </>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export const QueryHighlighter: React.FC<QueryHighlighterProps> = ({
  query,
  mode,
  isDark,
  showCopy = true,
  emptyText,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(query).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const dslSpans = useMemo(
    () => (mode === 'dsl' ? tokenizeDsl(query, isDark) : []),
    [query, mode, isDark]
  );

  const sqlLines = useMemo(
    () => (mode === 'clickhouse' ? tokenizeSql(query, isDark) : []),
    [query, mode, isDark]
  );

  if (!query) {
    return (
      <EmptyPlaceholder
        message={
          emptyText ||
          t(
            'argus.builder.noConditions',
            'Add conditions above to preview the generated query.'
          )
        }
        sx={{ flex: 1 }}
      />
    );
  }

  return (
    <PreviewContainer isDark={isDark}>
      {mode === 'dsl' ? (
        <SpanRenderer spans={dslSpans} />
      ) : (
        sqlLines.map((lineSpans, i) => (
          <div key={i}>
            <SpanRenderer spans={lineSpans} />
          </div>
        ))
      )}

      {showCopy && (
        <SafeTooltip
          title={
            copied ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')
          }
        >
          <CopyButton
            className="copy-btn"
            size="small"
            isDark={isDark}
            onClick={handleCopy}
          >
            <CopyIcon sx={{ fontSize: 13 }} />
          </CopyButton>
        </SafeTooltip>
      )}
    </PreviewContainer>
  );
};

export default QueryHighlighter;
