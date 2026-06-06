'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const crypto     = require('crypto');

const { runPipeline }      = require('./src/agents/agentOrchestrator');
const { getRegionOverview, MARKETS } = require('./src/data/sampleData');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  transports: ['polling', 'websocket'],   // polling first for Vercel compat
});

// ── Session & IP Tracking ─────────────────────────────────────────────────
// In-memory store (resets on cold start; swap for Vercel KV for persistence)
const visitors = new Map(); // sessionId -> { ip, firstSeen, lastSeen, hits, ua }

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function sessionMiddleware(req, res, next) {
  const COOKIE = 'hk_sid';
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

  // Parse cookies manually (no cookie-parser dep needed)
  const rawCookies = req.headers.cookie || '';
  const cookieMap  = Object.fromEntries(
    rawCookies.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );

  let sid = cookieMap[COOKIE];
  if (!sid || !/^[0-9a-f]{32}$/.test(sid)) {
    sid = crypto.randomBytes(16).toString('hex');
  }

  const ip  = getClientIp(req);
  const now = new Date().toISOString();
  const ua  = req.headers['user-agent'] || 'unknown';

  if (visitors.has(sid)) {
    const v = visitors.get(sid);
    v.lastSeen = now;
    v.hits    += 1;
    if (!v.ips.includes(ip)) v.ips.push(ip); // track multiple IPs per session
  } else {
    visitors.set(sid, { sid, ips: [ip], firstSeen: now, lastSeen: now, hits: 1, ua });
    console.log(`[Visitor] New session ${sid} from ${ip}`);
  }

  res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`);
  req.sessionId = sid;
  next();
}

app.use(sessionMiddleware);
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

// ── Visitor Analytics ─────────────────────────────────────────────────────
app.get('/api/visitors', (req, res) => {
  const summary = {
    totalUniqueSessions: visitors.size,
    sessions: Array.from(visitors.values()).sort(
      (a, b) => new Date(b.lastSeen) - new Date(a.lastSeen)
    ),
  };
  res.json(summary);
});

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
