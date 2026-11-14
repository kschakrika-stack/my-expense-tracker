const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
const backendDir = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(backendDir, '.env') });

const dbRelativePath = process.env.DB_PATH || 'database/expense-tracker.db';
// Always resolve the database path relative to the backend folder
const dbFullPath = path.isAbsolute(dbRelativePath)
  ? dbRelativePath
  : path.resolve(backendDir, dbRelativePath);

// Ensure the target directory for the database file exists
const dbDir = path.dirname(dbFullPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite using better-sqlite3.
// If Windows Application Control blocks the unsigned native .node binary (ERR_DLOPEN_FAILED),
// seamlessly adapt to Node's built-in SQLite engine with the identical API.
let db;
try {
  const BetterSqlite3 = require('better-sqlite3');
  db = new BetterSqlite3(dbFullPath);
} catch (err) {
  if (err.code === 'ERR_DLOPEN_FAILED') {
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
  } else {
    throw err;
  }
}

// Enable WAL mode and foreign keys for performance and data integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
function initDatabase() {
  const schemaPath = path.resolve(backendDir, 'database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

// Run schema initialization automatically
initDatabase();

module.exports = db;
