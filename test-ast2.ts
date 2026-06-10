import { conditionToSql, conditionToSqlPretty, Condition } from './packages/frontend/src/components/argus/query-builder-tree';

const tree: Condition = {
  id: 'root',
  type: 'group',
  connector: 'OR',
  negated: true,
  children: [
    { id: 'f1', type: 'filter', field: 'level', operator: '=', value: 'info', negated: false },
    { id: 'f2', type: 'filter', field: 'span_id', operator: '=', value: 'c076a9b4b34c417b', negated: false }
  ]
};

console.log('Single line:', conditionToSql(tree));
console.log('Pretty:', conditionToSqlPretty(tree));
