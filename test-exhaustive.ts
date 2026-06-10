import { conditionToSqlPretty, Condition } from './packages/frontend/src/components/argus/query-builder-tree';

function check() {
  const trees: Condition[] = [
    // 1. Root group negated, filter not negated
    {
      id: 'root', type: 'group', connector: 'OR', negated: true,
      children: [
        { id: '1', type: 'filter', field: 'level', operator: '=', value: 'info', negated: false },
        { id: '2', type: 'group', connector: 'AND', negated: false, children: [
          { id: '3', type: 'filter', field: 'span_id', operator: '=', value: 'c076', negated: false }
        ]}
      ]
    },
    // 2. Root group not negated, filter negated
    {
      id: 'root', type: 'group', connector: 'OR', negated: false,
      children: [
        { id: '1', type: 'filter', field: 'level', operator: '=', value: 'info', negated: true },
        { id: '2', type: 'group', connector: 'AND', negated: false, children: [
          { id: '3', type: 'filter', field: 'span_id', operator: '=', value: 'c076', negated: false }
        ]}
      ]
    },
    // 3. Root group negated, filter negated
    {
      id: 'root', type: 'group', connector: 'OR', negated: true,
      children: [
        { id: '1', type: 'filter', field: 'level', operator: '=', value: 'info', negated: true },
        { id: '2', type: 'group', connector: 'AND', negated: false, children: [
          { id: '3', type: 'filter', field: 'span_id', operator: '=', value: 'c076', negated: false }
        ]}
      ]
    },
  ];

  trees.forEach((t, i) => {
    console.log(`\n--- AST ${i + 1} ---`);
    console.log(JSON.stringify(t, null, 2));
    console.log('--- OUTPUT ---');
    console.log(conditionToSqlPretty(t));
  });
}

check();
