
import knex from '../packages/backend/src/config/knex';

async function diag() {
    const crId = '01KE6EQTET0132W723GEYZ2MGC';
    const cr = await knex('g_change_requests').where('id', crId).first();
    console.log('CR:', cr);

    if (cr) {
        const approvals = await knex('g_approvals').where('changeRequestId', crId);
        console.log('Approvals Count:', approvals.length);
        console.log('Approvals:', approvals);

        const env = await knex('g_environments').where('environment', cr.environment).first();
        console.log('Environment:', env);

        const countResult = await knex('g_approvals')
            .where('changeRequestId', crId)
            .count('id as count')
            .first();
        console.log('Raw Count Result:', countResult);
        console.log('Count Type:', typeof countResult?.count);
    }

    process.exit(0);
}

diag().catch(e => {
    console.error(e);
    process.exit(1);
});
