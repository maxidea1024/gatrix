/**
 * Replace marketType with channel/subchannel in g_crashes and g_crash_events
 */

exports.name = '003_replace_market_type_with_channel';

exports.up = async function (connection) {
  // g_crashes: add channel/subchannel, drop marketType
  try {
    await connection.execute(`
      ALTER TABLE g_crashes
      ADD COLUMN channel VARCHAR(50) NULL AFTER platform,
      ADD COLUMN subchannel VARCHAR(50) NULL AFTER channel
    `);
  } catch (err) {
    if (err.errno !== 1060) throw err;
    console.log('[003] channel/subchannel columns already exist on g_crashes, skipping');
  }

  try {
    await connection.execute(`ALTER TABLE g_crashes DROP COLUMN marketType`);
  } catch (err) {
    if (err.errno !== 1091) throw err; // 1091 = Can't DROP; check column exists
    console.log('[003] marketType already dropped from g_crashes, skipping');
  }

  // g_crash_events: add channel/subchannel, drop marketType
  try {
    await connection.execute(`
      ALTER TABLE g_crash_events
      ADD COLUMN channel VARCHAR(50) NULL AFTER platform,
      ADD COLUMN subchannel VARCHAR(50) NULL AFTER channel
    `);
  } catch (err) {
    if (err.errno !== 1060) throw err;
    console.log('[003] channel/subchannel columns already exist on g_crash_events, skipping');
  }

  try {
    await connection.execute(`ALTER TABLE g_crash_events DROP COLUMN marketType`);
  } catch (err) {
    if (err.errno !== 1091) throw err;
    console.log('[003] marketType already dropped from g_crash_events, skipping');
  }

  console.log('[003] ✓ Replaced marketType with channel/subchannel');
};

exports.down = async function (connection) {
  // g_crashes: restore marketType, drop channel/subchannel
  try {
    await connection.execute(`ALTER TABLE g_crashes ADD COLUMN marketType VARCHAR(50) NULL AFTER platform`);
  } catch (err) { if (err.errno !== 1060) throw err; }
  try {
    await connection.execute(`ALTER TABLE g_crashes DROP COLUMN channel, DROP COLUMN subchannel`);
  } catch (err) { if (err.errno !== 1091) throw err; }

  // g_crash_events: restore marketType, drop channel/subchannel
  try {
    await connection.execute(`ALTER TABLE g_crash_events ADD COLUMN marketType VARCHAR(50) NULL AFTER platform`);
  } catch (err) { if (err.errno !== 1060) throw err; }
  try {
    await connection.execute(`ALTER TABLE g_crash_events DROP COLUMN channel, DROP COLUMN subchannel`);
  } catch (err) { if (err.errno !== 1091) throw err; }

  console.log('[003] ✓ Restored marketType, dropped channel/subchannel');
};
