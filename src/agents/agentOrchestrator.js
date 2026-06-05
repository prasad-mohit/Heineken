/**
 * Agent Orchestrator
 * Coordinates the full Minority Report agent pipeline and streams events via Socket.IO.
 */

const DataIngestionAgent  = require('./dataIngestionAgent');
const RiskDetectionAgent  = require('./riskDetectionAgent');
const AlertAgent          = require('./alertAgent');
const RecommendationAgent = require('./recommendationAgent');

class AgentOrchestrator {
  constructor(io, socketId, market) {
    this.io       = io;
    this.socketId = socketId;
    this.market   = market;
  }

  _emit(event, payload) {
    this.io.to(this.socketId).emit(event, payload);
  }

  async run() {
    const startTime = Date.now();
    this._emit('agent_start', { market: this.market, ts: new Date().toISOString() });
    this._emit('orchestrator_log', { msg: `🧠 Orchestrator activated for market: ${this.market}` });
    this._emit('orchestrator_log', { msg: `   Spawning agent pipeline: DataIngestion → RiskDetection → Alert → Recommendation` });
    await this._delay(400);

    // ── PHASE 1: Data Ingestion ──────────────────────────────────────────────
    this._emit('phase_change', { phase: 'ingestion', label: 'Data Ingestion', status: 'active' });
    const ingestionAgent = new DataIngestionAgent(this.market);
    const ingestionResult = await ingestionAgent.ingest();

    for (const log of ingestionResult.logs) {
      this._emit('agent_log', { ...log });
      await this._delay(80);
    }
    this._emit('ingestion_complete', {
      sourceReport: ingestionResult.sourceReport,
      overallQuality: ingestionResult.overallQuality,
    });
    this._emit('phase_change', { phase: 'ingestion', label: 'Data Ingestion', status: 'done' });
    await this._delay(300);

    // ── PHASE 2: Risk Detection ──────────────────────────────────────────────
    this._emit('phase_change', { phase: 'risk', label: 'Risk Detection', status: 'active' });
    const riskAgent = new RiskDetectionAgent(this.market);
    const riskResult = await riskAgent.detect(ingestionResult);

    for (const log of riskResult.logs) {
      this._emit('agent_log', { ...log });
      await this._delay(80);
    }
    this._emit('risk_complete', {
      riskScore: riskResult.riskScore,
      severity: riskResult.severity,
      components: riskResult.components,
      topDrivers: riskResult.topDrivers,
    });
    this._emit('phase_change', { phase: 'risk', label: 'Risk Detection', status: 'done' });
    await this._delay(300);

    // ── PHASE 3: Alerting ────────────────────────────────────────────────────
    this._emit('phase_change', { phase: 'alert', label: 'Alert Routing', status: 'active' });
    const alertAgent = new AlertAgent(this.market);
    const alertResult = await alertAgent.generateAlerts(riskResult, ingestionResult);

    for (const log of alertResult.logs) {
      this._emit('agent_log', { ...log });
      await this._delay(80);
    }
    this._emit('alerts_complete', { alerts: alertResult.alerts });
    this._emit('phase_change', { phase: 'alert', label: 'Alert Routing', status: 'done' });
    await this._delay(300);

    // ── PHASE 4: Recommendations ─────────────────────────────────────────────
    this._emit('phase_change', { phase: 'recommendation', label: 'Recommendations', status: 'active' });
    const recAgent = new RecommendationAgent(this.market);
    const recResult = await recAgent.recommend(riskResult, ingestionResult);

    for (const log of recResult.logs) {
      this._emit('agent_log', { ...log });
      await this._delay(80);
    }
    this._emit('recommendations_complete', { recommendations: recResult.recommendations });
    this._emit('phase_change', { phase: 'recommendation', label: 'Recommendations', status: 'done' });
    await this._delay(200);

    // ── DONE ─────────────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this._emit('orchestrator_log', { msg: `✅ Pipeline complete in ${elapsed}s. Risk: ${riskResult.riskScore}/100 (${riskResult.severity}). Actions: ${recResult.recommendations.length}` });
    this._emit('agent_done', {
      market: this.market,
      riskScore: riskResult.riskScore,
      severity: riskResult.severity,
      alertCount: alertResult.alerts.length,
      recommendationCount: recResult.recommendations.length,
      elapsedSeconds: elapsed,
    });
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = AgentOrchestrator;
