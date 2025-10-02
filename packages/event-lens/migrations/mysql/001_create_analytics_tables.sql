-- Analytics Projects 테이블
CREATE TABLE IF NOT EXISTS analytics_projects (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  userId INT NOT NULL,
  settings JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (userId),
  INDEX idx_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics Clients 테이블
CREATE TABLE IF NOT EXISTS analytics_clients (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('write', 'read', 'root') NOT NULL DEFAULT 'write',
  projectId VARCHAR(36) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  cors JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES analytics_projects(id) ON DELETE CASCADE,
  INDEX idx_project_id (projectId),
  INDEX idx_secret (secret),
  UNIQUE KEY unique_id_secret (id, secret)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

