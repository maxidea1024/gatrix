import database from '../config/database';

export default class VarsModel {
  static async get(key: string): Promise<string | null> {
    const rows = await database.query(`SELECT \`value\` FROM g_vars WHERE \`key\` = ?`, [key]);
    return rows[0]?.value ?? null;
  }

  static async set(key: string, value: string | null): Promise<void> {
    await database.query(
      `INSERT INTO g_vars (\`key\`, \`value\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
      [key, value]
    );
  }
}

