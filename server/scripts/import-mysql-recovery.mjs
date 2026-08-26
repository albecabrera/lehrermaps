#!/usr/bin/env node
/**
 * Imports the historical MySQL export into the application's SQLite database.
 * It is intentionally a one-off recovery utility: it writes a separate
 * candidate database and never alters the live database itself.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptDir, '..');
const [sourcePath, candidatePath] = process.argv.slice(2);
if (!sourcePath || !candidatePath) throw new Error('Uso: node import-mysql-recovery.mjs <dump.sql> <candidate.sqlite>');

const dump = fs.readFileSync(path.resolve(sourcePath), 'utf8');
const livePath = path.join(serverDir, 'data', 'lehrermaps.sqlite');
fs.copyFileSync(livePath, path.resolve(candidatePath));

function splitTopLevel(text, delimiter = ',') {
  const values = [];
  let start = 0, quote = false, escaped = false, depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === "'") quote = false;
    } else if (char === "'") quote = true;
    else if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === delimiter && depth === 0) { values.push(text.slice(start, i)); start = i + 1; }
  }
  values.push(text.slice(start));
  return values;
}

function mysqlValue(raw) {
  const value = raw.trim();
  if (/^NULL$/i.test(value)) return null;
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/\\([0btnrZ\\'])/g, (_, char) => ({ 0: '\0', b: '\b', t: '\t', n: '\n', r: '\r', Z: '\x1a', '\\': '\\', "'": "'" }[char]));
  }
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return Number(value);
  throw new Error(`Valor MySQL no compatible: ${value.slice(0, 80)}`);
}

function parseCreateColumns(sql) {
  const tables = new Map();
  const expression = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE=/g;
  for (const match of sql.matchAll(expression)) {
    const columns = splitTopLevel(match[2]).map((line) => line.trim()).filter((line) => line.startsWith('`')).map((line) => line.match(/^`([^`]+)`/)[1]);
    tables.set(match[1], columns);
  }
  return tables;
}

const sourceColumns = parseCreateColumns(dump);
const database = new DatabaseSync(path.resolve(candidatePath), { enableForeignKeyConstraints: true });
database.exec('PRAGMA foreign_keys = OFF;');
const targetTables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(({ name }) => name);
for (const table of targetTables) database.exec(`DELETE FROM \"${table.replaceAll('"', '""')}\"`);

const targetColumns = new Map(targetTables.map((table) => [table, new Set(database.prepare(`PRAGMA table_info(\"${table.replaceAll('"', '""')}\")`).all().map(({ name }) => name))]));
const summary = new Map();
const insertExpression = /INSERT INTO `([^`]+)` VALUES ([\s\S]*?);\n/g;
database.exec('BEGIN IMMEDIATE');
try {
  for (const match of dump.matchAll(insertExpression)) {
    const [_, table, rowsText] = match;
    const columns = sourceColumns.get(table);
    if (!columns || !targetColumns.has(table)) continue;
    const usableColumns = columns.filter((column) => targetColumns.get(table).has(column));
    const usableIndices = usableColumns.map((column) => columns.indexOf(column));
    const quotedTable = `\"${table.replaceAll('"', '""')}\"`;
    const statement = database.prepare(`INSERT INTO ${quotedTable} (${usableColumns.map((column) => `\"${column.replaceAll('"', '""')}\"`).join(', ')}) VALUES (${usableColumns.map(() => '?').join(', ')})`);
    for (const rowText of splitTopLevel(rowsText)) {
      const row = rowText.trim();
      if (!row.startsWith('(') || !row.endsWith(')')) throw new Error(`Fila inválida en ${table}`);
      const values = splitTopLevel(row.slice(1, -1)).map(mysqlValue);
      if (values.length !== columns.length) throw new Error(`Número de columnas inesperado en ${table}: ${values.length} != ${columns.length}`);
      statement.run(...usableIndices.map((index) => values[index]));
      summary.set(table, (summary.get(table) || 0) + 1);
    }
  }
  const foreignKeys = database.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeys.length) throw new Error(`Referencias inválidas: ${JSON.stringify(foreignKeys.slice(0, 3))}`);
  database.exec('COMMIT; PRAGMA foreign_keys = ON;');
  console.log(JSON.stringify(Object.fromEntries([...summary.entries()].sort()), null, 2));
} catch (error) {
  try { database.exec('ROLLBACK;'); } catch {}
  throw error;
} finally {
  database.close();
}
