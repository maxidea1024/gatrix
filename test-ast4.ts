import { conditionToSqlPretty, conditionToDslPretty, Condition } from './packages/frontend/src/components/argus/query-builder-tree';

const tree: Condition = {
  id: 'root',
  type: 'group',
  connector: 'OR',
  negated: false,
  children: [
    { id: 'f1', type: 'filter', field: 'level', operator: '=', value: 'info', negated: true },
    {
      id: 'g1',
      type: 'group',
      connector: 'AND',
      negated: false,
      children: [
        { id: 'f2', type: 'filter', field: 'message', operator: 'in', values: ['AnimationSlotError...'], negated: false },
        { id: 'f3', type: 'filter', field: 'span_id', operator: '=', value: 'c076a9b4b34c417b', negated: false }
      ]
    }
  ]
};

console.log('SQL Pretty:\n' + conditionToSqlPretty(tree));
