CREATE TABLE IF NOT EXISTS notebooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  position INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_notebooks_user (user_id, position)
);

CREATE TABLE IF NOT EXISTS sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notebook_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  color VARCHAR(20) DEFAULT '#64748B',
  position INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_sections_notebook FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,
  INDEX idx_sections_notebook (notebook_id, position)
);

CREATE TABLE IF NOT EXISTS pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  template_id VARCHAR(64) NULL,
  position INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_pages_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  INDEX idx_pages_section (section_id, position)
);

CREATE TABLE IF NOT EXISTS blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_id INT NOT NULL,
  type VARCHAR(40) NOT NULL,
  content JSON,
  pos_x INT DEFAULT 0,
  pos_y INT DEFAULT 0,
  width INT DEFAULT 420,
  z_index INT DEFAULT 1,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_blocks_page FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  INDEX idx_blocks_page (page_id, z_index)
);

CREATE TABLE IF NOT EXISTS quick_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  content LONGTEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_quick_notes_user (user_id, created_at)
);
