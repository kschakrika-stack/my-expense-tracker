const path = require('path');
const fs = require('fs');
const os = require('os');
const dotenv = require('dotenv');

// Load environment variables from backend/.env (only effective locally)
const backendDir = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(backendDir, '.env') });

// Default schema in case schema.sql is not bundled in serverless environment
const DEFAULT_SCHEMA_SQL = `
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

// --- Determine database path ---
// On Vercel, serverless containers have a read-only filesystem except os.tmpdir() (/tmp).
// Locally, use the configured DB_PATH relative to the backend folder.
let dbFullPath;
if (process.env.VERCEL) {
  dbFullPath = path.join(os.tmpdir(), 'expense-tracker.db');
} else {
  const dbRelativePath = process.env.DB_PATH || 'database/expense-tracker.db';
  dbFullPath = path.isAbsolute(dbRelativePath)
    ? dbRelativePath
    : path.resolve(backendDir, dbRelativePath);
}

// Ensure directory exists if not in tmpdir
const dbDir = path.dirname(dbFullPath);
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (e) {
  console.warn(`[DB] Directory creation notice for ${dbDir}:`, e.message);
}

console.log(`[DB] Using database path: ${dbFullPath}`);

// --- Pure JS In-Memory Fallback Adapter (failsafe for any serverless runtime) ---
class InMemoryDBFallback {
  constructor() {
    this._transactions = [];
    this._budgets = [];
    this._txIdSeq = 1;
    this._budgetIdSeq = 1;
  }
  exec() {}
  pragma() {}
  close() {}
  prepare(sql) {
    const trimmed = sql.trim();
    const self = this;

    // Transactions queries
    if (/SELECT.*FROM\s+transactions\s+WHERE\s+id\s*=\s*\?/i.test(trimmed)) {
      return {
        get: (id) => self._transactions.find((t) => Number(t.id) === Number(id)) || null,
        all: (id) => self._transactions.filter((t) => Number(t.id) === Number(id)),
        run: () => ({ changes: 0 }),
      };
    }
    if (/SELECT.*FROM\s+transactions/i.test(trimmed)) {
      return {
        all: () => [...self._transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
        get: () => self._transactions[0] || null,
        run: () => ({ changes: 0 }),
      };
    }
    if (/INSERT\s+INTO\s+transactions/i.test(trimmed)) {
      return {
        run: (title, description, amount, category, type, date) => {
          const id = self._txIdSeq++;
          const row = {
            id,
            title,
            description: description || title,
            amount: Number(amount),
            category,
            type,
            date,
            created_at: new Date().toISOString(),
          };
          self._transactions.push(row);
          return { lastInsertRowid: id, changes: 1 };
        },
      };
    }
    if (/UPDATE\s+transactions/i.test(trimmed)) {
      return {
        run: (title, description, amount, category, type, date, id) => {
          const idx = self._transactions.findIndex((t) => Number(t.id) === Number(id));
          if (idx !== -1) {
            self._transactions[idx] = {
              ...self._transactions[idx],
              title,
              description: description || title,
              amount: Number(amount),
              category,
              type,
              date,
            };
            return { changes: 1 };
          }
          return { changes: 0 };
        },
      };
    }
    if (/DELETE\s+FROM\s+transactions/i.test(trimmed)) {
      return {
        run: (id) => {
          const before = self._transactions.length;
          self._transactions = self._transactions.filter((t) => Number(t.id) !== Number(id));
          return { changes: before - self._transactions.length };
        },
      };
    }

    // Monthly budgets queries
    if (/SELECT.*FROM\s+monthly_budgets\s+WHERE\s+year\s*=\s*\?\s+AND\s+month\s*=\s*\?/i.test(trimmed)) {
      return {
        get: (year, month) => self._budgets.find((b) => Number(b.year) === Number(year) && Number(b.month) === Number(month)) || null,
        run: () => ({ changes: 0 }),
      };
    }
    if (/SELECT.*FROM\s+monthly_budgets\s+WHERE\s+id\s*=\s*\?/i.test(trimmed)) {
      return {
        get: (id) => self._budgets.find((b) => Number(b.id) === Number(id)) || null,
        run: () => ({ changes: 0 }),
      };
    }
    if (/INSERT\s+INTO\s+monthly_budgets/i.test(trimmed)) {
      return {
        run: (month, year, amount) => {
          const id = self._budgetIdSeq++;
          const row = {
            id,
            month: Number(month),
            year: Number(year),
            amount: Number(amount),
            created_at: new Date().toISOString(),
          };
          self._budgets.push(row);
          return { lastInsertRowid: id, changes: 1 };
        },
      };
    }
    if (/UPDATE\s+monthly_budgets\s+SET\s+amount/i.test(trimmed)) {
      return {
        run: (amount, id) => {
          const idx = self._budgets.findIndex((b) => Number(b.id) === Number(id));
          if (idx !== -1) {
            self._budgets[idx].amount = Number(amount);
            return { changes: 1 };
          }
          return { changes: 0 };
        },
      };
    }

    // Default fallback
    return {
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
      get: () => null,
      all: () => [],
    };
  }
}

// --- Initialize Database Connection ---
// 1. Try better-sqlite3 (standard native SQLite)
// 2. If unavailable/blocked, try node:sqlite (Node 22+ built-in, zero external dependencies)
// 3. If neither is available, use InMemoryDBFallback so the server never crashes
let db;
try {
  const BetterSqlite3 = require('better-sqlite3');
  db = new BetterSqlite3(dbFullPath);
  console.log('[DB] Connected via better-sqlite3');
} catch (betterSqliteErr) {
  console.warn(`[DB] better-sqlite3 not available (${betterSqliteErr.message}). Attempting node:sqlite...`);
  try {
    const { DatabaseSync } = require('node:sqlite');
    class NodeSqliteAdapter {
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
          run: (...params) => {
            const res = stmt.run(...params);
            return {
              ...res,
              lastInsertRowid: Number(res.lastInsertRowid),
            };
          },
          get: (...params) => stmt.get(...params),
          all: (...params) => stmt.all(...params),
        };
      }
      close() {
        return this._db.close();
      }
    }
    db = new NodeSqliteAdapter(dbFullPath);
    console.log('[DB] Connected via node:sqlite (Node built-in)');
  } catch (nodeSqliteErr) {
    console.warn(`[DB] node:sqlite not available (${nodeSqliteErr.message}). Using in-memory fallback.`);
    db = new InMemoryDBFallback();
    console.log('[DB] Connected via in-memory storage fallback');
  }
}

// Configure SQLite pragmas if supported
try {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (_) {}

// Initialize schema safely
function initDatabase() {
  let schemaSql = DEFAULT_SCHEMA_SQL;
  try {
    const schemaPath = path.resolve(backendDir, 'database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    }
  } catch (_) {}

  try {
    db.exec(schemaSql);
    console.log('[DB] Schema initialized successfully');
  } catch (err) {
    console.warn('[DB] Schema init notice:', err.message);
  }
}

initDatabase();

module.exports = db;
