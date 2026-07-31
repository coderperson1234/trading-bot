import { create } from 'zustand';
import { api, fetchPrice } from './api';

const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export const useStore = create((set, get) => {
  const patchPortfolio = async (clientId, fn) => {
    const client = get().clients.find((c) => c.id === clientId);
    if (!client) return;
    const portfolio = fn(client.portfolio);
    set({ clients: get().clients.map((c) => (c.id === clientId ? { ...c, portfolio } : c)) });
    try {
      await api(`/api/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify({ portfolio }) });
      const clients = await api('/api/clients');
      set((s) => ({
        clients,
        activeClientId:
          s.activeClientId && clients.find((c) => c.id === s.activeClientId)
            ? s.activeClientId
            : clients[0]?.id ?? null,
      }));
    } catch {
      get().showToast('Failed to save — check connection');
    }
  };

  const loadClients = async () => {
    set({ loadingClients: true });
    try {
      const clients = await api('/api/clients');
      set((s) => ({
        loadingClients: false,
        clients,
        activeClientId:
          s.activeClientId && clients.find((c) => c.id === s.activeClientId)
            ? s.activeClientId
            : clients[0]?.id ?? null,
      }));
    } catch (e) {
      console.error('Failed to load clients:', e);
      set({ loadingClients: false });
    }
  };

  return {
    ready: false,
    loadingClients: false,
    user: null,
    advisor: { fullName: 'Advisor', username: '' },
    clients: [],
    activeClientId: null,
    toast: null,

    initAuth: async () => {
      const token = localStorage.getItem('jwt');
      if (!token) return set({ ready: true });
      try {
        const me = await api('/api/managers/me');
        const payload = JSON.parse(atob(token.split('.')[1]));
        set({
          user: { uid: payload.uid, email: me.email },
          advisor: { fullName: me.fullName, username: me.username },
          ready: true,
        });
        await loadClients();
      } catch {
        localStorage.removeItem('jwt');
        set({ ready: true });
      }
    },

    login: async (emailOrUsername, password) => {
      const r = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername, password }),
      });
      localStorage.setItem('jwt', r.token);
      set({ user: { uid: r.uid, email: r.email }, advisor: { fullName: r.fullName, username: r.username } });
      await loadClients();
    },

    signup: async (email, password, fullName, username) => {
      const r = await api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName, username }),
      });
      localStorage.setItem('jwt', r.token);
      set({ user: { uid: r.uid, email: r.email }, advisor: { fullName: r.fullName, username: r.username } });
    },

    logout: () => {
      localStorage.removeItem('jwt');
      set({ user: null, advisor: { fullName: 'Advisor', username: '' }, clients: [], activeClientId: null });
    },

    setActiveClient: (id) => set({ activeClientId: id }),

    showToast: (msg) => {
      set({ toast: msg });
      window.clearTimeout(window.__toastTimer);
      window.__toastTimer = window.setTimeout(() => set({ toast: null }), 2400);
    },

    addClient: async (draft) => {
      const created = await api('/api/clients', { method: 'POST', body: JSON.stringify(draft) });
      const clients = await api('/api/clients');
      set({ clients, activeClientId: String(created.id) });
      get().showToast(`${draft.name} onboarded`);
    },

    addHolding: async (clientId, ticker, qty, avgCost, meta) => {
      const price = (await fetchPrice(ticker)) ?? avgCost ?? 0;
      await patchPortfolio(clientId, (pf) => {
        const existing = pf.holdings.find((h) => h.ticker === ticker);
        let holdings;
        if (existing) {
          const total = existing.qty + qty;
          const blended = total > 0 ? (existing.qty * existing.avgCost + qty * avgCost) / total : avgCost;
          holdings = pf.holdings.map((h) =>
            h.ticker === ticker
              ? { ...h, qty: total, avgCost: +blended.toFixed(2), currentPrice: price, ...(meta || {}) }
              : h,
          );
        } else {
          holdings = [...pf.holdings, { id: uid('h'), ticker, qty, avgCost, currentPrice: price, ...(meta || {}) }];
        }
        return { ...pf, holdings, watchlist: pf.watchlist.filter((w) => w.ticker !== ticker) };
      });
      get().showToast(`${ticker} added`);
    },

    // Sell / reduce a position. Optionally also submits a market SELL order to
    // Alpaca (paper) when placeOrder is true.
    sellHolding: async (clientId, holdingId, sellQty, { placeOrder } = {}) => {
      const client = get().clients.find((c) => c.id === clientId);
      const holding = client?.portfolio.holdings.find((h) => h.id === holdingId);
      if (!holding) return;
      const qty = Math.min(Number(sellQty) || 0, holding.qty);
      if (qty <= 0) return;

      if (placeOrder) {
        try {
          await api('/api/alpaca/orders', {
            method: 'POST',
            body: JSON.stringify({ symbol: holding.ticker, qty, side: 'sell', type: 'market', time_in_force: 'day' }),
          });
          get().showToast(`Sell order for ${qty} ${holding.ticker} submitted to Alpaca`);
        } catch (e) {
          get().showToast(`Alpaca order failed: ${e.message}`);
        }
      }

      await patchPortfolio(clientId, (pf) => {
        const target = pf.holdings.find((h) => h.id === holdingId);
        const remaining = target.qty - qty;
        const holdings = remaining > 0
          ? pf.holdings.map((h) => (h.id === holdingId ? { ...h, qty: remaining } : h))
          : pf.holdings.filter((h) => h.id !== holdingId);
        return { ...pf, holdings };
      });
      if (!placeOrder) {
        get().showToast(qty >= holding.qty ? `${holding.ticker} position closed` : `Sold ${qty} ${holding.ticker}`);
      }
    },

    replaceHoldings: async (clientId, holdings) => {
      await patchPortfolio(clientId, (pf) => ({ ...pf, holdings }));
      get().showToast('Holdings updated');
    },

    addToWatch: async (clientId, ticker, source = 'manual', orgName) => {
      let added = false;
      await patchPortfolio(clientId, (pf) => {
        if (pf.watchlist.some((w) => w.ticker === ticker)) return pf;
        added = true;
        return { ...pf, watchlist: [...pf.watchlist, { id: uid('w'), ticker, source, ...(orgName ? { orgName } : {}) }] };
      });
      get().showToast(added ? `${ticker} added to watchlist` : `${ticker} already on watchlist`);
    },

    removeWatchlistItems: async (clientId, ids) => {
      await patchPortfolio(clientId, (pf) => ({
        ...pf,
        watchlist: pf.watchlist.filter((w) => !ids.includes(w.id)),
      }));
      get().showToast(`${ids.length} removed from watchlist`);
    },

    moveHoldingToWatch: async (clientId, holdingId) => {
      await patchPortfolio(clientId, (pf) => {
        const h = pf.holdings.find((x) => x.id === holdingId);
        if (!h || pf.watchlist.some((w) => w.ticker === h.ticker)) return pf;
        return {
          ...pf,
          watchlist: [...pf.watchlist, { id: uid('w'), ticker: h.ticker, source: 'manual', ...(h.orgName ? { orgName: h.orgName } : {}) }],
        };
      });
      get().showToast('Copied to watchlist');
    },

    moveWatchToHolding: async (clientId, watchId) => {
      const client = get().clients.find((c) => c.id === clientId);
      const item = client?.portfolio.watchlist.find((w) => w.id === watchId);
      const price = item ? await fetchPrice(item.ticker) : null;
      await patchPortfolio(clientId, (pf) => {
        const w = pf.watchlist.find((x) => x.id === watchId);
        if (!w || pf.holdings.some((h) => h.ticker === w.ticker)) return pf;
        return {
          ...pf,
          watchlist: pf.watchlist.filter((x) => x.id !== watchId),
          holdings: [...pf.holdings, { id: uid('h'), ticker: w.ticker, qty: 0, avgCost: 0, currentPrice: price ?? 0 }],
        };
      });
      get().showToast('Moved to portfolio — set quantity to fund');
    },
  };
});

export const useActiveClient = () =>
  useStore((s) => s.clients.find((c) => c.id === s.activeClientId) || s.clients[0] || null);
