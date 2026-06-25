import { CHUNK_SIZE } from './config';
import { generateLogsForEvent } from './metrics';

export async function generateAndInsertLogs(
  ch: any,
  chDatabase: string,
  allEvents: any[],
  issueMap: Map<string, any>
): Promise<number> {
  console.log('\n📝 Generating contextual logs...');
  let totalLogs = 0;
  let logBatch: any[] = [];
  for (const event of allEvents) {
    const s = issueMap.get(event.fingerprint[0])?.scenario;
    if (!s) continue;
    if (Math.random() > 0.3) continue; // ~30% of events get logs

    const user = { id: event.user_id, ip: event.user_ip };
    const eventLogs = generateLogsForEvent(
      1234, // mock issue ID
      event.event_id, // trace ID
      new Date(event.timestamp),
      s,
      user,
      event.server_name,
      event.environment,
      event.release
    );
    logBatch.push(...eventLogs);

    if (logBatch.length >= CHUNK_SIZE) {
      await ch.insert({
        table: `${chDatabase}.logs`,
        values: logBatch,
        format: 'JSONEachRow',
      });
      totalLogs += logBatch.length;
      logBatch = [];
    }
  }
  if (logBatch.length > 0) {
    await ch.insert({
      table: `${chDatabase}.logs`,
      values: logBatch,
      format: 'JSONEachRow',
    });
    totalLogs += logBatch.length;
  }
  console.log(`   ✓ ${totalLogs.toLocaleString()} logs inserted`);
  return totalLogs;
}
