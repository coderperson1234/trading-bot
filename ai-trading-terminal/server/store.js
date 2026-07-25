// Tiny JSON-file persistence layer. Swap for a real database in production.
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');

let db = null;
let writeTimer = null;

function load() {
  if (db) return db;
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } else {
    db = seed();
    persistNow();
  }
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
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 1));
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

module.exports = { load, persist, persistNow, nextId };
