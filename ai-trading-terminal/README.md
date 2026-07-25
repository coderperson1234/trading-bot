# AI Trading Terminal — Wealth Workspace

A wealth-manager trading workspace: client portfolios, AI-assisted insights,
an Alpaca-connected trading terminal, and a parameter-driven quant bot
framework.

## Modules

| Tab | What it does |
| --- | --- |
| Dashboard | AUM / return / allocation stats, holdings table, auto-scrolling news feed, AI rebalancing commentary + buy/hold/sell plan by horizon |
| Manage Portfolios | Onboard clients, add holdings from a master list, OCR statement import, drag-and-drop portfolio ⇄ watchlist board, private ("other") investments |
| AI Recommender | AI-curated watchlist ideas per client mandate |
| AI Swarm Playground | Bull / bear / balanced multi-agent style read on any security |
| Analysis | Coming soon |
| Valuation | Football-field valuation charts + comparison scorecard for multiple tickers |
| Stock Finder | Natural-language stock screener |
| Prediction Market | Prediction-market style probability reads + analyst forecast panel |
| Risk Exposure | Coming soon |
| **Trading** | **Alpaca account, positions, open orders and an order ticket (market/limit, shares/dollars, paper or live)** |
| **Quant Bot** | **Strategy framework (SMA crossover, RSI reversion out of the box) — signal-only or auto-trade via Alpaca** |

## Quick start

```bash
npm run install:all   # install server + web deps
npm run build         # build the frontend
npm start             # serve API + app on http://localhost:8787
```

Demo login: `jmorgan` / `Password@123` (or create your own account).

For development with hot reload run `npm run dev` (API on :8787) and
`npm run dev:web` (Vite on :5173, proxies /api).

## Alpaca connectivity

Set environment variables before starting the server, or paste keys in the
Trading tab (stored per manager):

```bash
export ALPACA_API_KEY_ID=PK...
export ALPACA_API_SECRET_KEY=...
export ALPACA_PAPER=true        # false = live trading. Be careful.
```

When configured, prices, news, bars, account, positions and orders all come
from Alpaca (paper by default). Without keys the app still works fully using
the local demo dataset and deterministic insight generators.

## Optional AI upgrade

Set `ANTHROPIC_API_KEY` to power the rebalancing commentary, stock summaries
and OCR statement import with Claude. Without it, text endpoints fall back to
deterministic local generators and OCR returns a helpful error.

## Quant bot framework

Strategies live in `server/quant/strategies/` and export a parameter schema
plus an `evaluate({ bars, position, params })` function returning
`buy | sell | hold`. Bots are configured per-user from the Quant Bot tab:
symbol, evaluation interval, strategy parameters, and mode
(signal-only or auto-trade through Alpaca). Add a new strategy file and it
appears in the UI automatically — designed so custom parameter sets can be
dropped in later.

## Storage

A JSON file at `server/data/db.json` (created on first run, seeded with demo
clients). Swap `server/store.js` for a real database in production.
