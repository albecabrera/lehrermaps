CREATE DATABASE IF NOT EXISTS lehrermaps CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lehrermaps;

CREATE TABLE IF NOT EXISTS folders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  subject     VARCHAR(50)  NOT NULL,
  group_name  VARCHAR(100) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  DATETIME DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  folder_id     INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100),
  size_bytes    INT,
  uploaded_at   DATETIME DEFAULT NOW(),
  timer_minutes INT NULL DEFAULT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lesson_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL DEFAULT 1, folder_id INT NULL,
  title VARCHAR(255) NOT NULL, lesson_date DATE NOT NULL, class_name VARCHAR(100), subject VARCHAR(100),
  learning_goal TEXT, teacher_notes LONGTEXT, status VARCHAR(24) NOT NULL DEFAULT 'draft',
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS lesson_phases (
  id INT AUTO_INCREMENT PRIMARY KEY, lesson_session_id INT NOT NULL, position INT NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL, duration_seconds INT NOT NULL DEFAULT 300, description TEXT,
  teacher_notes TEXT, student_instruction TEXT, student_responses LONGTEXT NULL, status VARCHAR(24) NOT NULL DEFAULT 'pending',
  timer_state VARCHAR(16) NOT NULL DEFAULT 'idle', timer_started_at DATETIME NULL, timer_remaining_seconds INT NULL,
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS lesson_phase_materials (
  id INT AUTO_INCREMENT PRIMARY KEY, phase_id INT NOT NULL, file_id INT NULL, folder_id INT NULL,
  visibility VARCHAR(24) NOT NULL DEFAULT 'private', position INT NOT NULL DEFAULT 0,
  FOREIGN KEY (phase_id) REFERENCES lesson_phases(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS lesson_display_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY, lesson_session_id INT NOT NULL, active_phase_id INT NULL,
  token VARCHAR(128) NOT NULL UNIQUE, expires_at DATETIME NOT NULL,
  FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (active_phase_id) REFERENCES lesson_phases(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lesson_phase_canvases (
  id INT AUTO_INCREMENT PRIMARY KEY, phase_id INT NOT NULL, version INT NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL DEFAULT 'Unterrichtsleinwand', viewport_json LONGTEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (phase_id) REFERENCES lesson_phases(id) ON DELETE CASCADE,
  UNIQUE KEY active_phase_canvas (phase_id, is_active)
);
CREATE TABLE IF NOT EXISTS lesson_phase_elements (
  id INT AUTO_INCREMENT PRIMARY KEY, canvas_id INT NOT NULL, type VARCHAR(32) NOT NULL,
  content_json LONGTEXT NULL, position_json LONGTEXT NULL, style_json LONGTEXT NULL,
  visibility VARCHAR(24) NOT NULL DEFAULT 'private', layer INT NOT NULL DEFAULT 0,
  is_live_annotation TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (canvas_id) REFERENCES lesson_phase_canvases(id) ON DELETE CASCADE
);
