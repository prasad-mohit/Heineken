'use strict';

const SignalNormalizationAgent = require('./signalNormalizationAgent');
const ModelConflictAgent       = require('./modelConflictAgent');
const TwinMarketAgent          = require('./twinMarketAgent');
const RiskDetectionAgent       = require('./riskDetectionAgent');
const RecommendationAgent      = require('./recommendationAgent');
const AlertAgent               = require('./alertAgent');
const { generateAllData }      = require('../data/sampleData');

/**
 * Pipeline:
 * 1. Signal Normalization  — align all signals to today (lead-lag bridge)
 * 2. Model Conflicts       — MMM vs Pricing Tool vs Distribution Planner
 * 3. Twin Markets          — find structurally similar markets for leverage
 * 4. Risk Detection        — score using normalised signals
 * 5. Recommendations       — evidence-backed actions with simple maths
 * 6. Alert Routing         — stakeholder notifications
 */
async function runPipeline(market, emit) {
  const allData = generateAllData(market);

  // ── Phase 1: Signal Normalization ──────────────────────────────────────────
  emit('phase', { phase: 'signal_normalization', label: 'Signal Normalization', status: 'running', market });
  const normAgent  = new SignalNormalizationAgent(market);
  const normResult = await normAgent.normalize(allData);
  emit('normalization_complete', { ...normResult, market });
  emit('logs', { agent: 'SignalNormalization', logs: normResult.logs });

  // ── Phase 2: Model Conflicts ───────────────────────────────────────────────
  emit('phase', { phase: 'model_conflicts', label: 'Model Conflict Analysis', status: 'running', market });
  const conflictAgent  = new ModelConflictAgent(market);
  const conflictResult = await conflictAgent.analyse(allData);
  emit('conflicts_complete', { ...conflictResult, market });
  emit('logs', { agent: 'ModelConflict', logs: conflictResult.logs });

  // ── Phase 3: Twin Markets ──────────────────────────────────────────────────
  emit('phase', { phase: 'twin_markets', label: 'Twin Market Analysis', status: 'running', market });
  const twinAgent  = new TwinMarketAgent(market);
  const twinResult = await twinAgent.findTwins();
  emit('twin_complete', { ...twinResult, market });
  emit('logs', { agent: 'TwinMarket', logs: twinResult.logs });

  // ── Phase 4: Risk Detection ────────────────────────────────────────────────
  emit('phase', { phase: 'risk_detection', label: 'Risk Detection', status: 'running', market });
  const riskAgent  = new RiskDetectionAgent(market);
  const riskResult = await riskAgent.detect(normResult.normalised_signals, allData);
  emit('risk_complete', { ...riskResult, market });
  emit('logs', { agent: 'RiskDetection', logs: riskResult.logs });

  // ── Phase 5: Recommendations ───────────────────────────────────────────────
  emit('phase', { phase: 'recommendations', label: 'Generating Recommendations', status: 'running', market });
  const recAgent  = new RecommendationAgent(market);
  const recResult = await recAgent.generate(riskResult, normResult.normalised_signals, allData, conflictResult, twinResult);
  emit('recommendations_complete', { ...recResult, market });
  emit('logs', { agent: 'Recommendation', logs: recResult.logs });

  // ── Phase 6: Alert Routing ─────────────────────────────────────────────────
  emit('phase', { phase: 'alerts', label: 'Alert Routing', status: 'running', market });
  const alertAgent  = new AlertAgent(market);
  const alertResult = await alertAgent.route(riskResult, recResult.recommendations);
  emit('alerts_complete', { ...alertResult, market });
  emit('logs', { agent: 'Alert', logs: alertResult.logs });

  emit('phase', { phase: 'complete', label: 'Pipeline Complete', status: 'done', market });

  return {
    market, allData, normResult, conflictResult, twinResult, riskResult, recResult, alertResult,
  };
}

module.exports = { runPipeline };
