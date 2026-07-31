const express = require('express');
const path = require('path');
const api = require('./routes/api');

const app = express();
app.use(express.json({ limit: '25mb' }));

app.use('/api', api);

// Serve the built frontend in production.
const dist = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

// Central error handler (Alpaca and other async failures land here).
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 8787;
require('./store')
  .init()
  .then(() => {
    require('./quant/engine').resumeRunningBots();
    app.listen(PORT, () => console.log(`AI trading terminal server listening on :${PORT}`));
  })
  .catch((e) => {
    console.error('Failed to initialise data store:', e.message);
    process.exit(1);
  });
