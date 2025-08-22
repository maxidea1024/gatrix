const name = 'Create game worlds table';

async function up(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS g_game_worlds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shareId VARCHAR(100) NOT NULL UNIQUE COMMENT '공유 ID',
      name VARCHAR(255) NOT NULL COMMENT '월드 이름',
      connectionUrl VARCHAR(500) NOT NULL COMMENT '접속 주소',
      isVisible BOOLEAN NOT NULL DEFAULT TRUE COMMENT '표시 여부',
      description TEXT COMMENT '설명',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
      INDEX idx_share_id (shareId),
      INDEX idx_name (name),
      INDEX idx_is_visible (isVisible),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await connection.execute(sql);
}

async function down(connection) {
  await connection.execute('DROP TABLE IF EXISTS g_game_worlds');
}

module.exports = { name, up, down };
