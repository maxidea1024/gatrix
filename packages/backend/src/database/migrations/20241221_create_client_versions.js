const Database = require('../../config/database').default;

const name = 'Create client versions table';

async function up(connection) {
  await connection.execute(`
    CREATE TABLE g_client_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      channel VARCHAR(100) NOT NULL COMMENT '채널명 (예: production, staging, development)',
      subChannel VARCHAR(100) NOT NULL COMMENT '서브채널명 (예: live, beta, alpha)',
      clientVersion VARCHAR(50) NOT NULL COMMENT '클라이언트 버전 (semver 형식)',
      clientStatus ENUM(
        'online',
        'offline',
        'recommended_update',
        'forced_update',
        'under_review',
        'blocked_patch_allowed'
      ) NOT NULL COMMENT '클라이언트 상태',
      gameServerAddress VARCHAR(500) NOT NULL COMMENT '게임서버 주소',
      gameServerAddressForWhiteList VARCHAR(500) NULL COMMENT '화이트리스트 전용 게임서버 주소',
      patchAddress VARCHAR(500) NOT NULL COMMENT '패치파일 다운로드 주소',
      patchAddressForWhiteList VARCHAR(500) NULL COMMENT '화이트리스트 전용 패치파일 다운로드 주소',
      guestModeAllowed BOOLEAN NOT NULL DEFAULT FALSE COMMENT '게스트 모드 허용 여부',
      externalClickLink VARCHAR(500) NULL COMMENT '외부 클릭 링크',
      memo TEXT NULL COMMENT '메모',
      customPayload TEXT NULL COMMENT '사용자 정의 페이로드 (JSON 형식)',
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      createdBy INT NOT NULL COMMENT '생성자 사용자 ID',
      updatedBy INT NOT NULL COMMENT '수정자 사용자 ID'
    )
  `);

  // 인덱스 생성
  await connection.execute(`
    CREATE INDEX idx_channel_subchannel ON g_client_versions (channel, subChannel)
  `);

  await connection.execute(`
    CREATE INDEX idx_client_version ON g_client_versions (clientVersion)
  `);

  await connection.execute(`
    CREATE INDEX idx_client_status ON g_client_versions (clientStatus)
  `);

  await connection.execute(`
    CREATE INDEX idx_created_at ON g_client_versions (createdAt)
  `);

  // 유니크 제약조건 추가 (channel + subChannel + clientVersion)
  await connection.execute(`
    ALTER TABLE g_client_versions
    ADD CONSTRAINT unique_channel_subchannel_version
    UNIQUE (channel, subChannel, clientVersion)
  `);
}

async function down(connection) {
  await connection.execute('DROP TABLE IF EXISTS g_client_versions');
}

module.exports = { name, up, down };
