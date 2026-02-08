const path = require('path');
const knex = require('../packages/backend/src/config/knex').default;

async function check() {
  const crId = '01KE6EQTET0132W723GEYZ2MGC';
  const cr = await knex('g_change_requests').where('id', crId).first();
  console.log('Change Request:', JSON.stringify(cr, null, 2));

  const approvals = await knex('g_approvals').where('changeRequestId', crId);
  console.log('Approvals:', JSON.stringify(approvals, null, 2));

  if (cr) {
    const env = await knex('g_environments').where('environment', cr.environment).first();
    console.log('Environment Settings:', JSON.stringify(env, null, 2));
  }

  process.exit(0);
}

check().catch((err) => {
  console.error(err);
  process.exit(1);
});
