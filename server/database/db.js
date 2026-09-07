import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'factlens.sqlite');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

let db = null;
let SQL = null;

export async function getDb() {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Could not read existing database file, creating fresh one:', err.message);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Initialize schema
  const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf-8');
  db.run(schemaSql);
  saveDb();

  return db;
}

export function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

export async function queryAll(sql, params = []) {
  const database = await getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function runQuery(sql, params = []) {
  const database = await getDb();
  database.run(sql, params);
  saveDb();
}

export async function resetDatabase() {
  const database = await getDb();
  database.run(`
    DELETE FROM relationships;
    DELETE FROM facts;
    DELETE FROM document_pages;
    DELETE FROM documents;
  `);
  saveDb();
}

export default {
  getDb,
  saveDb,
  queryAll,
  queryOne,
  runQuery,
  resetDatabase,
};
