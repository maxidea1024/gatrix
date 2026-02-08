import knex from '../packages/backend/src/config/knex';
import { ChangeRequest } from '../packages/backend/src/models/ChangeRequest';
import { Environment } from '../packages/backend/src/models/Environment';
import { Approval } from '../packages/backend/src/models/Approval';

async function diag() {
  const crId = '01KE6EQT'; // From user's image, if possible, or just check all OPEN ones

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
      console.log(
        `Env Required Approvers: ${env.requiredApprovers} (Type: ${typeof env.requiredApprovers})`
      );
    }

    const approvals = await Approval.query().where('changeRequestId', cr.id);
    console.log(`Approval Count (DB rows): ${approvals.length}`);

    const approvalCountResult = await Approval.query()
      .where('changeRequestId', cr.id)
      .count('id as count')
      .first();
    console.log('Raw Count Result:', JSON.stringify(approvalCountResult));

    const countVal = (approvalCountResult as any)?.count;
    const currentApprovals =
      typeof countVal === 'bigint' ? Number(countVal) : parseInt(String(countVal || '0'), 10);
    console.log(`Calculated currentApprovals: ${currentApprovals}`);

    const threshold = env?.requiredApprovers ?? 1;
    console.log(`Threshold: ${threshold}`);
    console.log(`Condition (current >= threshold): ${currentApprovals >= threshold}`);
  }

  console.log('\n--- Diagnosis End ---');
  process.exit(0);
}

diag().catch((err) => {
  console.error(err);
  process.exit(1);
});
