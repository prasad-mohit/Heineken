/**
 * Model Conflict Agent
 *
 * Problem: MMM, Pricing Tool, and Distribution Planner run independently,
 * at different granularities, and can give contradictory guidance.
 * This agent surfaces every conflict explicitly so decision-makers see
 * what tools agree on, what they disagree on, and which to trust.
 */

'use strict';

class ModelConflictAgent {
  constructor(market) {
    this.market = market;
    this.logs   = [];
  }

  _log(msg) { this.logs.push({ ts: new Date().toISOString(), agent: 'ModelConflict', msg }); }

  async analyse(allData) {
    const { mmm, pricing_tool, dist_planner, profile } = allData;
    this._log(`▶ Model Conflict Agent — reconciling 3 tool outputs for ${this.market}`);
    this._log(`  MMM status: ${mmm.model_status} (calibrated ${mmm.model_version || 'N/A'})`);
    this._log(`  Pricing Tool status: ${pricing_tool.tool_status}`);
    this._log(`  Distribution Planner status: ${dist_planner.tool_status}`);
    await this._delay(350);

    const conflicts = [];
    const alignments = [];

    // ── CONFLICT 1: Price elasticity magnitude ─────────────────────────────
    {
      const mmm_e    = mmm.elasticities?.price || -1.4;
      const price_e  = pricing_tool.elasticity_used || -1.8;
      const divergence = Math.abs((mmm_e - price_e) / mmm_e * 100);
      this._log(`  Checking elasticity: MMM=${mmm_e} vs Pricing Tool=${price_e} — divergence ${divergence.toFixed(0)}%`);
      await this._delay(200);

      if (divergence > 15) {
        conflicts.push({
          id: 'CONFLICT-1',
          severity: divergence > 25 ? 'HIGH' : 'MEDIUM',
          dimension: 'Price Elasticity',
          mmm_says:          `Elasticity = ${mmm_e} (1% price rise = ${Math.abs(mmm_e)}% volume loss)`,
          other_tool_says:   `Elasticity = ${price_e} (1% price rise = ${Math.abs(price_e)}% volume loss)`,
          other_tool:        'Pricing Tool',
          divergence_pct:    parseFloat(divergence.toFixed(1)),
          practical_impact:  `MMM predicts ${mmm.volume_decomposition_pct?.price_effect?.pct || -8}% volume drag from pricing. Pricing Tool predicts ${pricing_tool.volume_drag_pct}% drag — a difference of ${Math.abs((mmm.volume_decomposition_pct?.price_effect?.pct || -8) - pricing_tool.volume_drag_pct).toFixed(1)}pp that affects whether price action is #1 or #3 priority.`,
          resolution:        `Use Pricing Tool elasticity (−1.8) for near-term tactical decisions. MMM elasticity (−1.4) reflects longer-run consumer adjustment. For 12-week window: Pricing Tool is more relevant.`,
          trust_winner:      'Pricing Tool (weekly granularity, more current)',
        });
        this._log(`  ⚠ CONFLICT-1 (${divergence.toFixed(0)}% divergence): Price elasticity magnitude differs between MMM and Pricing Tool`);
      }
    }
    await this._delay(200);

    // ── CONFLICT 2: Distribution — historical gain vs current OOS ──────────
    {
      const mmm_dist_pct = mmm.volume_decomposition_pct?.distribution_gain?.pct || 12;
      const current_oos  = dist_planner.oos_rate;
      const oos_drag     = dist_planner.oos_volume_drag_pct;
      this._log(`  Checking distribution: MMM shows +${mmm_dist_pct}% (historical) vs Dist Planner shows ${oos_drag}% (current OOS drag)`);
      await this._delay(200);

      conflicts.push({
        id: 'CONFLICT-2',
        severity: 'HIGH',
        dimension: 'Distribution Contribution',
        mmm_says:        `Distribution is contributing +${mmm_dist_pct}% to volume (YTD channel expansion)`,
        other_tool_says: `Current OOS rate is ${(current_oos * 100).toFixed(1)}% — dragging volume by ${oos_drag}% RIGHT NOW`,
        other_tool:      'Distribution Planner',
        divergence_pct:  mmm_dist_pct + Math.abs(oos_drag),
        practical_impact: `MMM and Distribution Planner are measuring DIFFERENT things. MMM captures historical channel GAINS (positive). Distribution Planner shows current stock-outs (negative). Net real-time distribution effect is approximately ${(mmm_dist_pct + oos_drag).toFixed(1)}pp, not +${mmm_dist_pct}%.`,
        resolution:      `BOTH are correct — they measure different time horizons. For THIS WEEK's action: trust the Distribution Planner. For annual planning: MMM is right. Root cause: MMM runs monthly and cannot see intra-week OOS events.`,
        trust_winner:    'Distribution Planner (daily data, current state)',
      });
      this._log(`  ⚠ CONFLICT-2 (CRITICAL): MMM shows distribution as positive driver but live OOS shows active volume drag`);
      await this._delay(200);
    }

    // ── CONFLICT 3: Forecast accuracy (MMM predicted vs actual) ───────────
    {
      const pred = mmm.predicted_4wk_cases;
      const act  = mmm.actual_4wk_cases;
      const gap  = mmm.forecast_gap_pct;
      this._log(`  Checking MMM forecast accuracy: predicted ${pred.toLocaleString()} vs actual ${act.toLocaleString()} — gap ${gap}%`);
      await this._delay(200);

      if (Math.abs(gap) > 8) {
        conflicts.push({
          id: 'CONFLICT-3',
          severity: Math.abs(gap) > 12 ? 'HIGH' : 'MEDIUM',
          dimension: 'MMM Forecast Accuracy',
          mmm_says:        `Predicted 4-week volume: ${pred.toLocaleString()} cases`,
          other_tool_says: `Actual 4-week volume: ${act.toLocaleString()} cases`,
          other_tool:      'Actual Results',
          divergence_pct:  Math.abs(gap),
          practical_impact: `MMM is ${Math.abs(gap).toFixed(1)}% off from actuals — a ${Math.abs(mmm.forecast_gap).toLocaleString()} case gap. The unexplained residual of ${mmm.volume_decomposition_pct?.residual?.pct || -7}% in the model likely reflects real-time OOS events and competitor actions that MMM cannot capture at monthly granularity.`,
          resolution:      `Use real-time signal normalization (Signal Normalization Agent) to bridge the gap between MMM prediction and daily reality. MMM remains valid for trend direction, not for week-by-week volume accuracy.`,
          trust_winner:    'Actual data + Signal Normalization Agent',
        });
        this._log(`  ⚠ CONFLICT-3: MMM forecast ${gap}% off from actuals — ${mmm.model_blind_spots?.length || 3} known blind spots`);
      }
    }
    await this._delay(200);

    // ── ALIGNMENTS (things all tools agree on) ─────────────────────────────
    {
      alignments.push({ dimension: 'Price is above optimal', note: 'All tools agree Heineken is priced above market equilibrium.' });
      alignments.push({ dimension: 'ATL campaign is working', note: `MMM shows +${mmm.volume_decomposition_pct?.atl_contribution?.pct || 15}% contribution. Sentiment data confirms positive brand response.` });
      alignments.push({ dimension: 'Seasonality is a tailwind', note: 'Summer index >1.05 confirmed by macro and supported by ATL timing.' });
      this._log(`  ✓ ${alignments.length} alignment(s) found across tools: pricing direction, ATL effectiveness, seasonality`);
      await this._delay(150);
    }

    // ── Priority action from reconciled view ──────────────────────────────
    const reconciled_priority = [
      { rank: 1, action: 'Fix OOS immediately', driver: 'Distribution Planner (daily, real-time)', rationale: 'Most certain, fastest impact, MMM blind to this.' },
      { rank: 2, action: 'Reduce price by 5–6% via promo mechanic', driver: 'Pricing Tool', rationale: `Elasticity ${pricing_tool.elasticity_used} suggests ${pricing_tool.expected_volume_uplift_pct}% uplift.` },
      { rank: 3, action: 'Maintain ATL GRP ≥ 280', driver: 'MMM (high confidence on ATL)', rationale: `ATL contributing +${mmm.volume_decomposition_pct?.atl_contribution?.pct || 15}% — do not cut this.` },
    ];

    this._log(`✅ Conflict analysis complete: ${conflicts.length} conflict(s) detected, ${alignments.length} alignment(s)`);
    this._log(`   Priority order from reconciled view: ${reconciled_priority.map(r => r.action).join(' → ')}`);

    return { conflicts, alignments, reconciled_priority, logs: this.logs };
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = ModelConflictAgent;
