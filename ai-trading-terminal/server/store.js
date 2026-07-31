// Persistence layer.
//
// Two modes:
//  - DATABASE_URL set  -> state persists to Postgres (e.g. a free Neon or
//    Supabase database) as a single JSONB snapshot. Survives restarts and
//    redeploys on hosts without a permanent disk.
//  - otherwise         -> state persists to a local JSON file (great for
//    local development).
//
// The app works with the in-memory `db` object either way; persist() saves
// a debounced snapshot to whichever backend is active.
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || '';

let db = null;
let pool = null;
let writeTimer = null;

async function init() {
  if (db) return db;
  if (DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    });
    await pool.query(
      'CREATE TABLE IF NOT EXISTS app_state (id INT PRIMARY KEY, data JSONB NOT NULL)',
    );
    const { rows } = await pool.query('SELECT data FROM app_state WHERE id = 1');
    if (rows.length) {
      db = rows[0].data;
    } else {
      db = seed();
      await pool.query('INSERT INTO app_state (id, data) VALUES (1, $1)', [db]);
    }
    console.log('Store: Postgres (persistent)');
  } else {
    if (fs.existsSync(DB_PATH)) {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } else {
      db = seed();
      persistNow();
    }
    console.log(`Store: JSON file at ${DB_PATH}`);
  }
  return db;
}

function load() {
  if (!db) throw new Error('Store not initialised — call init() first');
  return db;
}

function seed() {
  const bcrypt = require('bcryptjs');
  // Starts completely blank — sign up for your own account, or use the
  // demo login below, then onboard clients from the Manage Portfolios tab.
  return {
    managers: [
      {
        uid: '1',
        username: 'jmorgan',
        email: 'demo@example.com',
        fullName: 'Demo Manager',
        passwordHash: bcrypt.hashSync('Password@123', 10),
      },
    ],
    // clients keyed by manager uid
    clients: { 1: [] },
    privateInvestments: { 1: [] },
    alpacaCreds: {}, // per-manager override; env vars used by default
    quantBots: {}, // per-manager bot configs + state
    counters: { client: 100, holding: 1000, watch: 1000, pi: 100, bot: 10 },
  };
}

function persistNow() {
  if (pool) {
    pool
      .query('UPDATE app_state SET data = $1 WHERE id = 1', [db])
      .catch((e) => console.error('Postgres persist failed:', e.message));
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 1));
  }
}

function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(persistNow, 150);
}

function nextId(kind) {
  const d = load();
  d.counters[kind] = (d.counters[kind] || 0) + 1;
  persist();
  return String(d.counters[kind]);
}

module.exports = { init, load, persist, persistNow, nextId };
