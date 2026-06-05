-- Feedback activity log for tracking status changes, assignments, and comments
CREATE TABLE IF NOT EXISTS g_argus_feedback_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  feedback_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(255) DEFAULT NULL,
  action ENUM('status_change','assign','comment','mark_spam','unmark_spam') NOT NULL,
  data JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback (project_id, feedback_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
