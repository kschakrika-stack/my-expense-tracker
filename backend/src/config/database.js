const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
const backendDir = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(backendDir, '.env') });

// Detect serverless deployment (Vercel / AWS Lambda) where filesystem is read-only except /tmp
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultDbPath = isServerless ? '/tmp/expense-tracker.db' : 'database/expense-tracker.db';
const dbRelativePath = process.env.DB_PATH || defaultDbPath;

// Always resolve the database path
const dbFullPath = path.isAbsolute(dbRelativePath)
  ? dbRelativePath
  : path.resolve(backendDir, dbRelativePath);

// Ensure the target directory for the database file exists
const dbDir = path.dirname(dbFullPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite using better-sqlite3 with seamless fallback to Node's built-in SQLite engine
let db;
try {
  const BetterSqlite3 = require('better-sqlite3');
  db = new BetterSqlite3(dbFullPath);
} catch (err) {
  const { DatabaseSync } = require('node:sqlite');
  class BetterSqlite3Adapter {
    constructor(file) {
      this._db = new DatabaseSync(file);
    }
    exec(sql) {
      return this._db.exec(sql);
    }
    pragma(pragmaStr) {
      try {
        return this._db.exec(`PRAGMA ${pragmaStr}`);
      } catch (_) {}
    }
    prepare(sql) {
      const stmt = this._db.prepare(sql);
      return {
        run: (...params) => stmt.run(...params),
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params),
      };
    }
    close() {
      return this._db.close();
    }
  }
  db = new BetterSqlite3Adapter(dbFullPath);
}

// Enable WAL mode and foreign keys for performance and data integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const FALLBACK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  date TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monthly_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
`;

// Initialize database schema
function initDatabase() {
  try {
    const schemaPath = path.resolve(backendDir, 'database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schemaSql);
      return;
    }
  } catch (_) {}
  db.exec(FALLBACK_SCHEMA_SQL);
}

// Run schema initialization automatically
initDatabase();

module.exports = db;
