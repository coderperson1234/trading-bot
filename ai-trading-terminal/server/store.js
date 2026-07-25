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
  const seedClients = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'seed-clients.json'), 'utf8'),
  );
  return {
    managers: [
      {
        uid: '1',
        username: 'jmorgan',
        email: 'james.morgan@meridianwealth.com',
        fullName: 'James Morgan',
        passwordHash: bcrypt.hashSync('Password@123', 10),
      },
    ],
    // clients keyed by manager uid
    clients: { 1: seedClients.map((c) => ({ ...c })) },
    privateInvestments: {
      1: [
        { id: 'pi_1', clientId: '1', assetCategory: 'Instruments', assetType: 'REITs', avgPrice: 120000, currentPrice: 150000 },
        { id: 'pi_2', clientId: '1', assetCategory: 'Unlisted', assetType: 'Real Estate', avgPrice: 50000, currentPrice: 60000 },
        { id: 'pi_3', clientId: '1', assetCategory: 'Instruments', assetType: 'Treasury Bills (T-bills)', avgPrice: 7000, currentPrice: 8000 },
        { id: 'pi_4', clientId: '1', assetCategory: 'Unlisted', assetType: 'Private credit', avgPrice: 80000, currentPrice: 86000 },
      ],
    },
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
