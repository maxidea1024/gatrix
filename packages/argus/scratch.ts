import { clickhouse } from './src/config/clickhouse';
import { mysqlPool } from './src/config/mysql';

async function run() {
  const projectId = '01KN8GSHBJ10JTQ9D0HD60RKFV';
  const txnName = 'GET /api/v2/player/inventory';
  const interval = '7 DAY';

  try {
    console.log('Querying errors...');
    const errorsResult = await clickhouse.query({
      query: `
        SELECT
          issue_id,
          count() AS event_count,
          max(timestamp) AS last_seen
        FROM argus.errors
        WHERE project_id = {projectId:String}
          AND transaction = {txnName:String}
          AND timestamp >= now() - INTERVAL ${interval}
          AND toString(issue_id) != ''
        GROUP BY issue_id
        ORDER BY event_count DESC
        LIMIT 5
      `,
      query_params: { projectId: String(projectId), txnName },
    });
    const errorsData = await errorsResult.json();
    console.log('errorsData', errorsData);

    let relatedIssues: any[] = [];
    if (errorsData.data?.length > 0) {
      relatedIssues = errorsData.data.map((r: any) => ({
        issue_id: r.issue_id,
        event_count: Number(r.event_count),
        last_seen: r.last_seen,
      }));
    }

    if (relatedIssues.length > 0) {
      const issueIds = relatedIssues.map((i) => i.issue_id);
      console.log('Querying mysql for issues:', issueIds);
      const [issueRows] = (await mysqlPool.query(
        `SELECT id, title, subtitle, level FROM g_argus_issues WHERE id IN (${issueIds.map(() => '?').join(',')})`,
        issueIds
      )) as any;
      console.log('issueRows', issueRows);
    }

    console.log('Done!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}
run();
