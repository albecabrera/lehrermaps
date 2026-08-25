import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',
  database: process.env.DB_NAME     || 'lehrermaps',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

export async function initSchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS folders (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      subject     VARCHAR(50)  NOT NULL,
      group_name  VARCHAR(100) NOT NULL,
      name        VARCHAR(100) NOT NULL,
      created_at  DATETIME DEFAULT NOW()
    )
  `);
  await pool.execute(`
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
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS links (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      folder_id  INT NOT NULL,
      title      VARCHAR(255) NOT NULL,
      url        TEXT NOT NULL,
      created_at DATETIME DEFAULT NOW(),
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    )
  `);
  // Migrations — safe to run multiple times
  try { await pool.execute(`ALTER TABLE folders ADD COLUMN sort_order INT DEFAULT 0`); } catch {}
  try { await pool.execute(`ALTER TABLE folders ADD COLUMN notes LONGTEXT DEFAULT NULL`); } catch {}
  try { await pool.execute(`ALTER TABLE folders ADD COLUMN is_favorite TINYINT(1) DEFAULT 0`); } catch {}
  try { await pool.execute(`ALTER TABLE folders ADD COLUMN due_at DATETIME NULL`); } catch {}
  try { await pool.execute(`ALTER TABLE folders ADD COLUMN parent_id INT NULL DEFAULT NULL`); } catch {}
  try { await pool.execute(`ALTER TABLE folders ADD COLUMN color VARCHAR(20) NULL DEFAULT NULL`); } catch {}
  // Fix group_name inconsistency: normalize group IDs to display names
  try {
    await pool.execute(`UPDATE folders SET group_name = 'Klasse 9' WHERE subject = 'spanisch' AND group_name = 'es-9'`);
    // Preserve the existing Q1 folder tree while aligning its group label with the UI.
    await pool.execute(`UPDATE folders SET group_name = 'Q1' WHERE subject = 'spanisch' AND group_name IN ('Klasse 12', 'es-12')`);
    await pool.execute(`UPDATE folders SET group_name = 'WP Klasse 6–7' WHERE subject = 'informatik' AND group_name = 'inf-67'`);
    await pool.execute(`UPDATE folders SET group_name = 'WP Klasse 8–10' WHERE subject = 'informatik' AND group_name = 'inf-810'`);
    // Keep any existing Sport Q1 tree intact while normalizing legacy labels.
    await pool.execute(`UPDATE folders SET group_name = 'Q1' WHERE subject = 'sport' AND group_name IN ('Klasse 12', 'sp-q1')`);
  } catch {}
  // Curated click & teach book links for the Informatik groups. The unique URL
  // check makes this safe when the schema initializer runs more than once.
  try {
    const bookLinks = [
      { groups: ['Klasse 6'], title: 'click & teach – Buch Informatik Klasse 6', url: 'https://www.click-and-teach.de/Player/id/1280/page/21' },
      { groups: ['WP 7'], title: 'click & teach – Buch Informatik WP 7', url: 'https://www.click-and-teach.de/Player/id/1259/page/10' },
      { groups: ['WP 8'], title: 'click & teach – Buch Informatik WP 8', url: 'https://www.click-and-teach.de/Player/id/1259/page/10' },
      { groups: ['WP 9'], title: 'click & teach – Buch Informatik WP 9', url: 'https://www.click-and-teach.de/Player/id/1259/page/10' },
      { groups: ['WP 10'], title: 'click & teach – Buch Informatik WP 10', url: 'https://www.click-and-teach.de/Player/id/1259/page/10' },
    ];
    for (const { groups, title, url } of bookLinks) {
      const placeholders = groups.map(() => '?').join(', ');
      await pool.execute(
        `INSERT INTO links (folder_id, title, url)
         SELECT f.id, ?, ?
         FROM folders f
         WHERE f.subject = 'informatik'
           AND f.group_name IN (${placeholders})
           AND f.parent_id IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM links existing
             WHERE existing.folder_id = f.id AND existing.url = ?
           )`,
        [title, url, ...groups, url]
      );
    }
  } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN is_shared TINYINT(1) DEFAULT 0`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN due_at DATETIME NULL`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN timer_minutes INT NULL DEFAULT NULL`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN is_public TINYINT(1) DEFAULT 0`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN public_token VARCHAR(64) NULL`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN material_role VARCHAR(40) NOT NULL DEFAULT 'other'`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN version_group_id VARCHAR(64) NULL`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN version_number INT NOT NULL DEFAULT 1`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN is_current_version TINYINT(1) NOT NULL DEFAULT 1`); } catch {}
  try { await pool.execute(`UPDATE files SET version_group_id = COALESCE(version_group_id, REPLACE(UUID(), '-', '')) WHERE version_group_id IS NULL`); } catch {}
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS file_edit_copies (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      file_id      INT NOT NULL,
      copy_name    VARCHAR(255) NOT NULL,
      created_at   DATETIME DEFAULT NOW(),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schedule (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      data       LONGTEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS document_annotation_history (
      id INT AUTO_INCREMENT PRIMARY KEY, annotation_id INT NOT NULL, file_id INT NOT NULL, user_id INT NOT NULL,
      page_number INT NOT NULL, type VARCHAR(24) NOT NULL, data_json LONGTEXT NULL, style_json LONGTEXT NULL,
      action VARCHAR(16) NOT NULL DEFAULT 'update', created_at DATETIME DEFAULT NOW(),
      INDEX annotation_history_lookup (annotation_id, user_id, created_at)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      title      VARCHAR(255) NOT NULL,
      color      VARCHAR(20) DEFAULT '#3B82F6',
      position   INT DEFAULT 0,
      created_at DATETIME DEFAULT NOW(),
      updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sections (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      notebook_id INT NOT NULL,
      title       VARCHAR(255) NOT NULL,
      color       VARCHAR(20) DEFAULT '#64748B',
      position    INT DEFAULT 0,
      created_at  DATETIME DEFAULT NOW(),
      updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pages (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      section_id  INT NOT NULL,
      title       VARCHAR(255) NOT NULL,
      template_id VARCHAR(64) NULL,
      position    INT DEFAULT 0,
      created_at  DATETIME DEFAULT NOW(),
      updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS blocks (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      page_id    INT NOT NULL,
      type       VARCHAR(40) NOT NULL,
      content    JSON,
      pos_x      INT DEFAULT 0,
      pos_y      INT DEFAULT 0,
      width      INT DEFAULT 420,
      z_index    INT DEFAULT 1,
      created_at DATETIME DEFAULT NOW(),
      updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS quick_notes (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      content    LONGTEXT,
      created_at DATETIME DEFAULT NOW()
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS exams (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      title      VARCHAR(255) NOT NULL,
      class_name VARCHAR(100) NOT NULL,
      subject    VARCHAR(100),
      exam_date  DATE NOT NULL,
      exam_time  TIME,
      notes      TEXT,
      created_at DATETIME DEFAULT NOW()
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS annual_plans (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      root_folder_id INT NOT NULL,
      school_year    VARCHAR(20) NOT NULL,
      start_date     DATE NULL,
      end_date       DATE NULL,
      created_at     DATETIME DEFAULT NOW(),
      updated_at     DATETIME DEFAULT NOW() ON UPDATE NOW(),
      UNIQUE KEY annual_plan_scope (root_folder_id, school_year),
      FOREIGN KEY (root_folder_id) REFERENCES folders(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS annual_plan_entries (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      plan_id       INT NOT NULL,
      entry_date    DATE NOT NULL,
      end_date      DATE NULL,
      entry_type    VARCHAR(32) NOT NULL DEFAULT 'lesson',
      lesson_number VARCHAR(40) NULL,
      title         VARCHAR(255) NOT NULL,
      notes         TEXT NULL,
      sort_order    INT NOT NULL DEFAULT 0,
      created_at    DATETIME DEFAULT NOW(),
      updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (plan_id) REFERENCES annual_plans(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS annual_plan_materials (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      entry_id  INT NOT NULL,
      file_id   INT NULL,
      folder_id INT NULL,
      FOREIGN KEY (entry_id) REFERENCES annual_plan_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS lesson_sessions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT NOT NULL DEFAULT 1,
      folder_id     INT NULL,
      title         VARCHAR(255) NOT NULL,
      lesson_date   DATE NOT NULL,
      class_name    VARCHAR(100) NULL,
      subject       VARCHAR(100) NULL,
      learning_goal TEXT NULL,
      teacher_notes LONGTEXT NULL,
      status        VARCHAR(24) NOT NULL DEFAULT 'draft',
      created_at    DATETIME DEFAULT NOW(),
      updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS lesson_phases (
      id                       INT AUTO_INCREMENT PRIMARY KEY,
      lesson_session_id       INT NOT NULL,
      position                 INT NOT NULL DEFAULT 0,
      title                    VARCHAR(255) NOT NULL,
      duration_seconds        INT NOT NULL DEFAULT 300,
      description              TEXT NULL,
      teacher_notes            TEXT NULL,
      student_instruction      TEXT NULL,
      student_responses        LONGTEXT NULL,
      status                   VARCHAR(24) NOT NULL DEFAULT 'pending',
      timer_state              VARCHAR(16) NOT NULL DEFAULT 'idle',
      timer_started_at         DATETIME NULL,
      timer_remaining_seconds  INT NULL,
      created_at               DATETIME DEFAULT NOW(),
      updated_at               DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id) ON DELETE CASCADE
    )
  `);
  try { await pool.execute(`ALTER TABLE lesson_phases ADD COLUMN student_responses LONGTEXT NULL`); } catch {}
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS lesson_phase_materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phase_id INT NOT NULL,
      file_id INT NULL,
      folder_id INT NULL,
      visibility VARCHAR(24) NOT NULL DEFAULT 'private',
      position INT NOT NULL DEFAULT 0,
      FOREIGN KEY (phase_id) REFERENCES lesson_phases(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS lesson_display_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lesson_session_id INT NOT NULL,
      active_phase_id INT NULL,
      token VARCHAR(128) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (active_phase_id) REFERENCES lesson_phases(id) ON DELETE SET NULL
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS lesson_phase_canvases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phase_id INT NOT NULL,
      version INT NOT NULL DEFAULT 1,
      title VARCHAR(255) NOT NULL DEFAULT 'Unterrichtsleinwand',
      viewport_json LONGTEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (phase_id) REFERENCES lesson_phases(id) ON DELETE CASCADE,
      UNIQUE KEY active_phase_canvas (phase_id, is_active)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS lesson_phase_elements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      canvas_id INT NOT NULL,
      type VARCHAR(32) NOT NULL,
      content_json LONGTEXT NULL, position_json LONGTEXT NULL, style_json LONGTEXT NULL,
      visibility VARCHAR(24) NOT NULL DEFAULT 'private',
      layer INT NOT NULL DEFAULT 0, is_live_annotation TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (canvas_id) REFERENCES lesson_phase_canvases(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS document_annotations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_id INT NOT NULL,
      user_id INT NOT NULL,
      page_number INT NOT NULL DEFAULT 1,
      type VARCHAR(24) NOT NULL DEFAULT 'ink',
      data_json LONGTEXT NULL,
      style_json LONGTEXT NULL,
      created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      INDEX document_annotation_lookup (file_id, user_id, page_number)
    )
  `);
  const [rows] = await pool.execute(`SELECT COUNT(*) AS c FROM schedule`);
  if (rows[0].c === 0) await pool.execute(`INSERT INTO schedule (data) VALUES (?)`, ['{}']);
}

export default pool;
