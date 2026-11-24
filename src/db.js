import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  category TEXT,
  topic TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | scheduled | publishing | posted | failed
  scheduled_at TEXT,                      -- ISO UTC
  posted_at TEXT,
  threads_id TEXT,
  permalink TEXT,
  error TEXT,
  origin TEXT DEFAULT 'manual',           -- manual | autopilot
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_status_time ON posts(status, scheduled_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS used_topics (
  key TEXT PRIMARY KEY,
  used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

export function log(level, message) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  (level === 'error' ? console.error : console.log)(line);
  db.prepare('INSERT INTO logs (level, message) VALUES (?, ?)').run(level, String(message).slice(0, 2000));
  db.prepare('DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 500)').run();
}

export function topicKey(str = '') {
  return str.toLowerCase().replace(/[^a-z0-9À-ɏ ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function isTopicUsed(title) {
  return !!db.prepare('SELECT 1 FROM used_topics WHERE key = ?').get(topicKey(title));
}

export function markTopicUsed(title) {
  if (!title) return;
  db.prepare('INSERT OR IGNORE INTO used_topics (key) VALUES (?)').run(topicKey(title));
  // Simpan 30 hari sahaja
  db.prepare("DELETE FROM used_topics WHERE used_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')").run();
}
