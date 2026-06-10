import { conditionToSqlPretty, conditionToDslPretty, Condition } from './packages/frontend/src/components/argus/query-builder-tree';

const tree: Condition = {
  id: 'root',
  type: 'group',
  connector: 'OR',
  negated: false,
  children: [
    { id: 'f2', type: 'filter', field: 'span_id', operator: '=', value: 'c076a9b4b34c417b', negated: false },
    {
      id: 'g1',
      type: 'group',
      connector: 'AND',
      negated: true,
      children: [
        { id: 'f1', type: 'filter', field: 'level', operator: '=', value: 'info', negated: false },
      ]
    }
  ]
};

console.log(conditionToSqlPretty(tree));
