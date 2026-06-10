import { conditionToSqlPretty, conditionToDslPretty, Condition } from './packages/frontend/src/components/argus/query-builder-tree';

const tree: Condition = {
  id: 'root',
  type: 'group',
  connector: 'OR',
  negated: true,
  children: [
    { id: 'f1', type: 'filter', field: 'level', operator: '=', value: 'info', negated: false },
    {
      id: 'g1',
      type: 'group',
      connector: 'AND',
      negated: false,
      children: [
        { id: 'f2', type: 'filter', field: 'message', operator: 'in', values: ['msg1', 'msg2'], negated: false },
        { id: 'f3', type: 'filter', field: 'span_id', operator: '=', value: 'c076a9b4b34c417b', negated: false },
        { id: 'f4', type: 'filter', field: 'span_id', operator: '=', value: 'c076a9b4b34c417b', negated: false },
        { id: 'f5', type: 'filter', field: 'span_id', operator: '=', value: 'bf45e74b32e748de', negated: false },
        { id: 'f6', type: 'filter', field: 'level', operator: 'in', values: ['info', 'warn', 'error', 'warning'], negated: false }
      ]
    }
  ]
};

console.log('SQL Pretty:\n' + conditionToSqlPretty(tree));
