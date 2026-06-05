'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const { runPipeline }      = require('./src/agents/agentOrchestrator');
const { getRegionOverview, MARKETS } = require('./src/data/sampleData');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  transports: ['polling', 'websocket'],   // polling first for Vercel compat
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── REST endpoints ─────────────────────────────────────────────────────────
app.get('/api/region', (req, res) => {
  res.json({ markets: getRegionOverview() });
});

app.get('/api/markets', (req, res) => {
  res.json({ markets: Object.keys(MARKETS) });
});

app.get('/api/market/:name', (req, res) => {
  const m = MARKETS[req.params.name];
  if (!m) return res.status(404).json({ error: 'Market not found' });
  res.json({ market: req.params.name, profile: m });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Socket.IO real-time pipeline ──────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Send region overview immediately on connect
  socket.emit('region_overview', { markets: getRegionOverview() });

  socket.on('run_pipeline', async ({ market }) => {
    const selectedMarket = market || 'Netherlands';
    console.log(`[Pipeline] Starting for ${selectedMarket}`);

    const emit = (event, data) => socket.emit(event, data);

    try {
      await runPipeline(selectedMarket, emit);
    } catch (err) {
      console.error('[Pipeline] Error:', err);
      socket.emit('pipeline_error', { message: err.message, market: selectedMarket });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🍺 Heineken AI Early Warning System`);
  console.log(`   Running on http://localhost:${PORT}\n`);
});
