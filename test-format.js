const conditionToSql = (cond) => {
  const esc = (s) => `'${s.replace(/'/g, "''")}'`;
  if (cond.type === 'filter') {
    if (cond.field === 'has') return `${cond.value} IS NOT NULL`;
    if (cond.field === '!has') return `${cond.value} IS NULL`;
    return `${cond.field} ${cond.operator} ${esc(cond.value)}`;
  }
  return '';
};

const prefixBlock = (text, first, rest) => {
  const lines = text.split('\n');
  return lines.map((line, i) => (i === 0 ? first : rest) + line).join('\n');
};

const fmtSql = (c, depth) => {
  if (c.type === 'filter') return conditionToSql(c);
  const parts = c.children.map((ch) => fmtSql(ch, depth + 1)).filter(Boolean);
  if (parts.length === 0) return '';
  const conn = c.connector;
  const pad = ' '.repeat(conn.length + 1); // "AND " or "OR " width

  if (depth > 0) {
    // Nested group: wrap in ( ... ) with aligned content
    const formatted = parts.map((p, i) =>
      i === 0 ? prefixBlock(p, pad, pad) : prefixBlock(p, `${conn} `, `${pad}`),
    ).join('\n');
    const body = `(\n${formatted}\n)`;
    return c.negated ? prefixBlock(body, `NOT `, `    `) : body; // Align negated nested group!
  }

  // Root level: 2-space base indent from WHERE
  const base = '  ';
  if (parts.length === 1) {
    return c.negated ? `${base}NOT ${parts[0]}` : `${base}${parts[0]}`;
  }

  if (c.negated) {
    const formatted = parts.map((p, i) =>
      i === 0 ? prefixBlock(p, pad, pad) : prefixBlock(p, `${conn} `, `${pad}`),
    ).join('\n');
    const body = `(\n${formatted}\n)`;
    return prefixBlock(body, `${base}NOT `, `${base}    `); // Align with base + "NOT "
  }

  // Non-negated root group
  const formatted = parts.map((p, i) =>
    i === 0
      ? prefixBlock(p, `${base}${pad}`, `${base}${pad}`)
      : prefixBlock(p, `${base}${conn} `, `${base}${pad}`),
  ).join('\n');
  return formatted;
};

// Nested negated group under OR
const tree = {
  type: 'group',
  connector: 'OR',
  negated: false,
  children: [
    { type: 'filter', field: '!has', value: 'message' },
    {
      type: 'group',
      connector: 'AND',
      negated: true,
      children: [
        { type: 'filter', field: 'level', operator: '=', value: 'info' },
        { type: 'filter', field: 'service', operator: '=', value: 'game-world' }
      ]
    }
  ]
};

console.log('Result:\n' + `WHERE\n${fmtSql(tree, 0)}`);
