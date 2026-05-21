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
  const [rows] = await pool.execute(`SELECT COUNT(*) AS c FROM schedule`);
  if (rows[0].c === 0) await pool.execute(`INSERT INTO schedule (data) VALUES (?)`, ['{}']);
}

export default pool;
