import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'lehrermaps.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

// SQLite is embedded in Node: no database server, credentials, or network are needed.
const database = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
database.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

function translate(sql) {
  return sql.replace(/`/g, '')
    .replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO')
    .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bIF\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, 'CASE WHEN $1 THEN $2 ELSE $3 END')
    .replace(/([\w.]+)::text/gi, '$1');
}

class Connection {
  async execute(sql, values = []) {
    const query = translate(sql);
    const statement = database.prepare(query);
    if (/^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(query)) return [statement.all(...values), []];
    const result = statement.run(...values);
    if (/^\s*INSERT\b/i.test(query)) return [{ insertId: Number(result.lastInsertRowid), affectedRows: result.changes }, []];
    return [{ affectedRows: result.changes }, []];
  }
  query(sql, values = []) { return this.execute(sql, values); }
  async beginTransaction() { database.exec('BEGIN'); }
  async commit() { database.exec('COMMIT'); }
  async rollback() { try { database.exec('ROLLBACK'); } catch {} }
  release() {}
}

const pool = new Connection();
pool.getConnection = async () => new Connection();
pool.end = () => database.close();

const schema = [
  `CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY, subject TEXT NOT NULL, group_name TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, notes TEXT, is_favorite INTEGER NOT NULL DEFAULT 0, due_at TEXT, parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE, color TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY, folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE, original_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime_type TEXT, size_bytes INTEGER, uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, timer_minutes INTEGER, is_shared INTEGER NOT NULL DEFAULT 0, due_at TEXT, is_public INTEGER NOT NULL DEFAULT 0, public_token TEXT, material_role TEXT NOT NULL DEFAULT 'other', version_group_id TEXT, version_number INTEGER NOT NULL DEFAULT 1, is_current_version INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY, folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL, is_shared INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS file_edit_copies (id INTEGER PRIMARY KEY, file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE, copy_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS schedule (id INTEGER PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS notebooks (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, color TEXT DEFAULT '#3B82F6', position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS sections (id INTEGER PRIMARY KEY, notebook_id INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE, title TEXT NOT NULL, color TEXT DEFAULT '#64748B', position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE, title TEXT NOT NULL, template_id TEXT, position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS blocks (id INTEGER PRIMARY KEY, page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE, type TEXT NOT NULL, content TEXT, pos_x INTEGER NOT NULL DEFAULT 0, pos_y INTEGER NOT NULL DEFAULT 0, width INTEGER NOT NULL DEFAULT 420, z_index INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS quick_notes (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, content TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS document_annotations (id INTEGER PRIMARY KEY, file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE, user_id INTEGER NOT NULL DEFAULT 1, page_number INTEGER NOT NULL, type TEXT NOT NULL, data_json TEXT NOT NULL, style_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS document_annotation_history (id INTEGER PRIMARY KEY, annotation_id INTEGER NOT NULL, file_id INTEGER NOT NULL, user_id INTEGER NOT NULL, page_number INTEGER NOT NULL, type TEXT NOT NULL, data_json TEXT NOT NULL, style_json TEXT, action TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY, title TEXT NOT NULL, class_name TEXT NOT NULL, subject TEXT, exam_date TEXT NOT NULL, exam_time TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS annual_plans (id INTEGER PRIMARY KEY, root_folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE, school_year TEXT NOT NULL, start_date TEXT, end_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(root_folder_id, school_year))`,
  `CREATE TABLE IF NOT EXISTS annual_plan_entries (id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES annual_plans(id) ON DELETE CASCADE, entry_date TEXT NOT NULL, end_date TEXT, entry_type TEXT NOT NULL DEFAULT 'lesson', lesson_number TEXT, title TEXT NOT NULL, notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS annual_plan_materials (id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES annual_plan_entries(id) ON DELETE CASCADE, file_id INTEGER REFERENCES files(id) ON DELETE CASCADE, folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE, UNIQUE(entry_id, file_id, folder_id))`,
  `CREATE TABLE IF NOT EXISTS lesson_sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL DEFAULT 1, folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL, title TEXT NOT NULL, lesson_date TEXT NOT NULL, class_name TEXT, subject TEXT, learning_goal TEXT, teacher_notes TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS lesson_phases (id INTEGER PRIMARY KEY, lesson_session_id INTEGER NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE, position INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, duration_seconds INTEGER NOT NULL DEFAULT 300, description TEXT, teacher_notes TEXT, student_instruction TEXT, student_responses TEXT, status TEXT NOT NULL DEFAULT 'pending', timer_state TEXT NOT NULL DEFAULT 'idle', timer_started_at TEXT, timer_remaining_seconds INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS lesson_phase_materials (id INTEGER PRIMARY KEY, phase_id INTEGER NOT NULL REFERENCES lesson_phases(id) ON DELETE CASCADE, file_id INTEGER REFERENCES files(id) ON DELETE CASCADE, folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE, visibility TEXT NOT NULL DEFAULT 'private', position INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS lesson_display_sessions (id INTEGER PRIMARY KEY, lesson_session_id INTEGER NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE, active_phase_id INTEGER REFERENCES lesson_phases(id) ON DELETE SET NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS lesson_phase_canvases (id INTEGER PRIMARY KEY, phase_id INTEGER NOT NULL REFERENCES lesson_phases(id) ON DELETE CASCADE, version INTEGER NOT NULL DEFAULT 1, title TEXT NOT NULL DEFAULT 'Unterrichtsleinwand', viewport_json TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(phase_id, is_active))`,
  `CREATE TABLE IF NOT EXISTS lesson_phase_elements (id INTEGER PRIMARY KEY, canvas_id INTEGER NOT NULL REFERENCES lesson_phase_canvases(id) ON DELETE CASCADE, type TEXT NOT NULL, content_json TEXT, position_json TEXT, style_json TEXT, visibility TEXT NOT NULL DEFAULT 'private', layer INTEGER NOT NULL DEFAULT 0, is_live_annotation INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
];

export async function initSchema() {
  for (const statement of schema) database.exec(statement);
  database.exec('CREATE INDEX IF NOT EXISTS document_annotation_owner ON document_annotations(file_id, user_id, page_number); CREATE INDEX IF NOT EXISTS document_annotation_history_owner ON document_annotation_history(file_id, user_id, created_at);');
  for (const table of ['schedule', 'notebooks', 'sections', 'pages', 'blocks', 'document_annotations', 'annual_plans', 'annual_plan_entries', 'lesson_sessions', 'lesson_phases', 'lesson_phase_canvases', 'lesson_phase_elements']) database.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_touch_updated_at AFTER UPDATE ON ${table} FOR EACH ROW BEGIN UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;`);
  await pool.execute("UPDATE folders SET group_name = 'Klasse 9' WHERE subject = 'spanisch' AND group_name = 'es-9'");
  await pool.execute("UPDATE folders SET group_name = 'Q1' WHERE subject = 'spanisch' AND group_name IN ('Klasse 12', 'es-12')");
  await pool.execute("UPDATE folders SET group_name = 'WP Klasse 6–7' WHERE subject = 'informatik' AND group_name = 'inf-67'");
  await pool.execute("UPDATE folders SET group_name = 'WP Klasse 8–10' WHERE subject = 'informatik' AND group_name = 'inf-810'");
  await pool.execute("UPDATE folders SET group_name = 'Q1' WHERE subject = 'sport' AND group_name IN ('Klasse 12', 'sp-q1')");
  await pool.execute('UPDATE files SET version_group_id = lower(hex(randomblob(16))) WHERE version_group_id IS NULL');
  const bookLinks = [[['Klasse 6'], 'click & teach – Buch Informatik Klasse 6', 'https://www.click-and-teach.de/Player/id/1280/page/21'], [['WP 7', 'WP 8', 'WP 9', 'WP 10'], 'click & teach – Buch Informatik', 'https://www.click-and-teach.de/Player/id/1259/page/10']];
  for (const [groups, title, url] of bookLinks) for (const group of groups) await pool.execute('INSERT OR IGNORE INTO links (folder_id, title, url) SELECT f.id, ?, ? FROM folders f WHERE f.subject = \'informatik\' AND f.group_name = ? AND f.parent_id IS NULL AND NOT EXISTS (SELECT 1 FROM links l WHERE l.folder_id = f.id AND l.url = ?)', [title, url, group, url]);
  const [rows] = await pool.execute('SELECT COUNT(*) AS c FROM schedule');
  if (Number(rows[0].c) === 0) await pool.execute("INSERT INTO schedule (data) VALUES ('{}')");
}

export default pool;
