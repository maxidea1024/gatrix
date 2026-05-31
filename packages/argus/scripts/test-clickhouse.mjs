import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
  url: 'http://localhost:48123',
  database: 'default',
  username: 'default',
  password: '',
});

async function run() {
  const projectId = '01KN8GSHBJ10JTQ9D0HD60RKFV';
  const interval = '30 DAY';
  try {
    const qp = { projectId: String(projectId) };
    const [envResult, browserResult, osResult] = await Promise.all([
      clickhouse.query({
        query: `SELECT DISTINCT environment FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} ORDER BY environment`,
        query_params: qp,
      }),
      clickhouse.query({
        query: `SELECT DISTINCT browser_name FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} AND browser_name != '' ORDER BY browser_name`,
        query_params: qp,
      }),
      clickhouse.query({
        query: `SELECT DISTINCT os_name FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} AND os_name != '' ORDER BY os_name`,
        query_params: qp,
      }),
    ]);

    const envRows = await envResult.json();
    const browserRows = await browserResult.json();
    const osRows = await osResult.json();
    console.log("SUCCESS!");
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
