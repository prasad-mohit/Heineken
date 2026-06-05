const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const AgentOrchestrator = require('./src/agents/agentOrchestrator');

const app = express();
const server = http.createServer(app);
// Allow both WebSocket and long-polling so the app works on Vercel serverless
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['polling', 'websocket'],
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// REST: get current market state snapshot
app.get('/api/markets', (req, res) => {
  const { getSampleMarkets } = require('./src/data/sampleData');
  res.json(getSampleMarkets());
});

// REST: get historical risk trend for a market
app.get('/api/risk-trend/:market', (req, res) => {
  const { getRiskTrend } = require('./src/data/sampleData');
  res.json(getRiskTrend(req.params.market));
});

// REST: get agent pipeline config
app.get('/api/agents', (req, res) => {
  res.json([
    { id: 'orchestrator', name: 'Orchestrator Agent', role: 'Coordinates all agents and assembles final decision', icon: '🧠' },
    { id: 'ingestion',    name: 'Data Ingestion Agent', role: 'Collects & validates POS, ATL, BTL, pricing, distribution, macro data', icon: '📥' },
    { id: 'risk',         name: 'Risk Detection Agent', role: 'Analyses patterns and computes sell-out risk score (0–100)', icon: '⚠️' },
    { id: 'alert',        name: 'Alert Agent', role: 'Routes severity-graded alerts to Market MDs and Global Hub', icon: '🔔' },
    { id: 'recommendation', name: 'Recommendation Agent', role: 'Proposes ranked corrective actions with ROI estimates', icon: '💡' },
  ]);
});

// Socket.IO: client triggers a full agent run
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('run_agents', async (payload) => {
    const market = (payload && payload.market) ? payload.market : 'Netherlands';
    const orchestrator = new AgentOrchestrator(io, socket.id, market);
    await orchestrator.run();
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  🍺  Heineken Minority Report running at http://localhost:${PORT}\n`);
});
