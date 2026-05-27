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
    await pool.execute(`UPDATE folders SET group_name = 'Klasse 12' WHERE subject = 'spanisch' AND group_name = 'es-12'`);
    await pool.execute(`UPDATE folders SET group_name = 'WP Klasse 6–7' WHERE subject = 'informatik' AND group_name = 'inf-67'`);
    await pool.execute(`UPDATE folders SET group_name = 'WP Klasse 8–10' WHERE subject = 'informatik' AND group_name = 'inf-810'`);
  } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN is_shared TINYINT(1) DEFAULT 0`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN due_at DATETIME NULL`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN is_public TINYINT(1) DEFAULT 0`); } catch {}
  try { await pool.execute(`ALTER TABLE files ADD COLUMN public_token VARCHAR(64) NULL`); } catch {}
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schedule (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      data       LONGTEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
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
  const [rows] = await pool.execute(`SELECT COUNT(*) AS c FROM schedule`);
  if (rows[0].c === 0) await pool.execute(`INSERT INTO schedule (data) VALUES (?)`, ['{}']);
}

export default pool;
