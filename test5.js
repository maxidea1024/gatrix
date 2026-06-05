const fs = require('fs');
let code = fs.readFileSync('packages/frontend/src/pages/argus/ArgusLogsPage.tsx', 'utf8');

const highlightFn = `
/**
 * Extract free-text search terms from a query string (ignoring key:value pairs)
 * and wrap matching substrings in the text with a highlighted <mark> element.
 */
function highlightSearchTerms(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  // Tokenize query: extract tokens that are NOT key:value pairs and NOT logical operators
  const tokens = query.match(/(?:[^\\s\\"]+|\\"[^\\"]*\\")+/g) || [];
  const freeTextTerms = tokens
    .filter(t => !/^[\\w.-]+[:!=]/.test(t))  // skip key:value, key!=value
    .filter(t => !['AND', 'OR', 'NOT'].includes(t.toUpperCase()))
    .map(t => t.replace(/^\\"|\\"$/g, '').trim())  // strip quotes
    .filter(t => t.length > 0);

  if (freeTextTerms.length === 0) return text;

  // Build regex from terms, escaping special chars
  const escaped = freeTextTerms.map(t => t.replace(/[.*+?^\\${}()|[\\]\\\\]/g, '\\\\$&'));
  const regex = new RegExp(\`(\${escaped.join('|')})\`, 'gi');

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} style={{ backgroundColor: 'rgba(255,213,79,0.4)', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
      : part
  );
}
`;

code = code.replace('const ArgusLogsPage: React.FC = () => {', highlightFn + '\nconst ArgusLogsPage: React.FC = () => {');
fs.writeFileSync('packages/frontend/src/pages/argus/ArgusLogsPage.tsx', code);
