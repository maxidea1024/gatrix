import { optic } from '@gatrix/argus-optic';

async function test() {
  try {
    const sql = `
        SELECT
          event_name AS name,
          count() AS count
        FROM argus.activities
        WHERE project_id = '01KN8GSHBJ10JTQ9D0HD60RKFV'
        GROUP BY event_name
        ORDER BY count DESC
        LIMIT 200
    `;
    const result = optic.generateSQL(sql, {});
    console.log(result);
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}
test();
