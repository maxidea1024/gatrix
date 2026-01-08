
const knex = require('../packages/backend/dist/config/knex').default;
const { ChangeRequest } = require('../packages/backend/dist/models/ChangeRequest');
const { Environment } = require('../packages/backend/dist/models/Environment');
const { Approval } = require('../packages/backend/dist/models/Approval');

async function diag() {
    try {
        console.log('--- Diagnosis Start ---');

        const crs = await ChangeRequest.query().where('status', 'open');
        console.log(`Found ${crs.length} OPEN change requests.`);

        for (const cr of crs) {
            console.log(`\nChecking CR: ${cr.id} (${cr.title})`);
            console.log(`Environment: ${cr.environment}`);

            const env = await Environment.query().findById(cr.environment);
            if (!env) {
                console.log('ERROR: Environment not found!');
            } else {
                console.log(`Env Requires Approval: ${env.requiresApproval}`);
                console.log(`Env Required Approvers: ${env.requiredApprovers} (Type: ${typeof env.requiredApprovers})`);
            }

            const approvals = await Approval.query().where('changeRequestId', cr.id);
            console.log(`Approval Count (DB rows): ${approvals.length}`);

            const approvalCountResult = await Approval.query()
                .where('changeRequestId', cr.id)
                .count('id as count')
                .first();
            console.log('Raw Count Result:', JSON.stringify(approvalCountResult));

            const countVal = approvalCountResult ? approvalCountResult.count : 0;
            const currentApprovals = typeof countVal === 'bigint' ? Number(countVal) : parseInt(String(countVal || '0'), 10);
            console.log(`Calculated currentApprovals: ${currentApprovals}`);

            const threshold = env ? env.requiredApprovers : 1;
            console.log(`Threshold: ${threshold}`);
            console.log(`Condition (current >= threshold): ${currentApprovals >= threshold}`);
        }

        console.log('\n--- Diagnosis End ---');
    } catch (err) {
        console.error('DIAG ERROR:', err);
    } finally {
        process.exit(0);
    }
}

diag();
