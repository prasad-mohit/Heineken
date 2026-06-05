/**
 * Signal Normalization Agent  — "The Super Agent"
 *
 * Problem: Data sources refresh at wildly different rates.
 *   POS = 7 days stale. BTL = 21 days stale. Macro = 31 days stale.
 *   But Distribution feeds daily, ATL feeds weekly.
 *
 * What this agent does:
 *   For each STALE signal, it finds the most correlated FRESH lead indicator,
 *   applies the historically-derived beta coefficient, and produces a
 *   probabilistic estimate of what the stale signal looks like TODAY.
 *
 * Output: normalised signals + confidence intervals so every downstream agent
 * works from the same effective time-point rather than a patchwork of lags.
 */

'use strict';

const STALENESS_THRESHOLD = {
  pos:          5,   // days — stale if older than this
  atl:          3,
  btl:          7,
  pricing:      5,
  distribution: 2,
  macro:        14,
};

class SignalNormalizationAgent {
  constructor(market) {
    this.market = market;
    this.logs   = [];
  }

  _log(msg) { this.logs.push({ ts: new Date().toISOString(), agent: 'SignalNormalization', msg }); }

  async normalize(allData) {
    const { signals, lead_lag, profile } = allData;
    this._log(`▶ Signal Normalization Agent activated — market: ${this.market}`);
    this._log(`  Mission: align 6 signal streams to a single effective time-point`);
    await this._delay(400);

    const normalised = {};
    const signal_report = [];

    // ── POS: STALE (7 days) → Normalise using Distribution (daily, r=0.85) ───
    {
      const days_stale = profile.data_availability.pos.last_updated_days;
      const raw_weekly = signals.pos.weekly_cases;
      const oos_raw    = 0.07; // assumed baseline OOS
      const oos_now    = signals.distribution.oos_rate;
      const oos_delta  = oos_now - oos_raw;   // pp change since last POS report
      const ll         = lead_lag['distribution→pos'];
      const vol_adj    = oos_delta * ll.beta / 100;  // beta: 1pp OOS = -1.8% volume
      const est_weekly = Math.round(raw_weekly * (1 + vol_adj));
      const std_err    = Math.round(raw_weekly * 0.04);

      this._log(`  📦 POS: ${days_stale} days stale — applying distribution lead-lag correction`);
      this._log(`     Distribution OOS changed ${oos_raw * 100}% → ${(oos_now * 100).toFixed(1)}% (Δ +${(oos_delta * 100).toFixed(1)}pp)`);
      this._log(`     Lead-lag: ${ll.lag_days}d lag, r=${ll.correlation}, β=${ll.beta} (1pp OOS = ${ll.beta}% volume change)`);
      this._log(`     POS raw: ${raw_weekly.toLocaleString()} cases/wk → Normalised: ${est_weekly.toLocaleString()} ±${std_err} cases/wk`);
      this._log(`     Change from reported: ${(vol_adj * 100).toFixed(1)}% — confidence: HIGH`);
      await this._delay(350);

      normalised.pos = { ...signals.pos, weekly_cases_normalised: est_weekly, cases_per_day_normalised: Math.round(est_weekly / 7), vol_adjustment_pct: parseFloat((vol_adj * 100).toFixed(1)), std_err };
      signal_report.push({
        source: 'POS', raw_label: `${raw_weekly.toLocaleString()} cases/wk`,
        staleness_days: days_stale, stale: days_stale > STALENESS_THRESHOLD.pos,
        lead_indicator: 'Distribution (daily)', lead_correlation: ll.correlation,
        normalised_label: `${est_weekly.toLocaleString()} ±${std_err} cases/wk`,
        change_pct: parseFloat((vol_adj * 100).toFixed(1)),
        direction: vol_adj < 0 ? 'DOWN' : 'UP',
        confidence: 'HIGH',
        method: `Distribution OOS Δ × β(${ll.beta}) / lag ${ll.lag_days}d`,
      });
    }
    await this._delay(200);

    // ── ATL: FRESH — pass through ─────────────────────────────────────────────
    {
      const days_stale = profile.data_availability.atl.last_updated_days;
      normalised.atl = { ...signals.atl };
      this._log(`  📺 ATL: ${days_stale} day(s) old — FRESH, no normalisation needed`);
      signal_report.push({
        source: 'ATL', raw_label: `${signals.atl.grp} GRP`,
        staleness_days: days_stale, stale: false,
        lead_indicator: 'N/A (fresh)', lead_correlation: null,
        normalised_label: `${signals.atl.grp} GRP (unchanged)`,
        change_pct: 0, direction: 'UNCHANGED', confidence: 'HIGH', method: 'Direct — no lag',
      });
      await this._delay(150);
    }

    // ── BTL: STALE (21 days) → Estimate using ATL correlation ────────────────
    {
      const days_stale = profile.data_availability.btl.last_updated_days;
      const raw_act    = signals.btl.activations;
      let est_act = raw_act;
      let confidence  = 'LOW';

      if (days_stale && days_stale > STALENESS_THRESHOLD.btl) {
        const grp_trend = signals.atl.grp > 280 ? 1.05 : 0.97;
        est_act = Math.round(raw_act * grp_trend);
        confidence = 'LOW';
        this._log(`  🎪 BTL: ${days_stale} days stale — using ATL trend as proxy (r=${lead_lag['btl→pos'].correlation})`);
        this._log(`     ATL GRP ${signals.atl.grp > 280 ? 'above' : 'below'} threshold → BTL activations estimated at ${est_act} (raw: ${raw_act})`);
        this._log(`     ⚠ LOW confidence — BTL data quality is POOR. Recommend: mobile reporting form to cut lag to 48h`);
      } else {
        this._log(`  🎪 BTL: FRESH, passing through`);
      }
      normalised.btl = { ...signals.btl, activations_normalised: est_act };
      signal_report.push({
        source: 'BTL', raw_label: `${raw_act} activations`,
        staleness_days: days_stale || 0, stale: (days_stale || 0) > STALENESS_THRESHOLD.btl,
        lead_indicator: 'ATL GRP direction', lead_correlation: 0.58,
        normalised_label: `~${est_act} activations (estimated)`,
        change_pct: parseFloat(((est_act / raw_act - 1) * 100).toFixed(1)),
        direction: est_act > raw_act ? 'UP' : est_act < raw_act ? 'DOWN' : 'UNCHANGED',
        confidence, method: 'ATL directional proxy — r=0.58',
      });
      await this._delay(250);
    }

    // ── Pricing: mostly fresh — pass through with minor drift note ───────────
    {
      const days_stale = profile.data_availability.pricing.last_updated_days;
      normalised.pricing = { ...signals.pricing };
      this._log(`  💰 Pricing: ${days_stale} day(s) — ${days_stale > STALENESS_THRESHOLD.pricing ? 'slightly stale' : 'FRESH'}, passing through`);
      signal_report.push({
        source: 'Pricing', raw_label: `€${signals.pricing.shelf_price} shelf price`,
        staleness_days: days_stale, stale: days_stale > STALENESS_THRESHOLD.pricing,
        lead_indicator: 'N/A', lead_correlation: null,
        normalised_label: `€${signals.pricing.shelf_price} (${days_stale}d old)`,
        change_pct: 0, direction: 'UNCHANGED',
        confidence: days_stale <= 5 ? 'HIGH' : 'MEDIUM',
        method: 'Direct measurement',
      });
      await this._delay(100);
    }

    // ── Distribution: FRESH (daily) — pass through ───────────────────────────
    {
      normalised.distribution = { ...signals.distribution };
      this._log(`  🚛 Distribution: Daily feed — FRESH, using as primary lead indicator for POS normalisation`);
      signal_report.push({
        source: 'Distribution', raw_label: `${(signals.distribution.oos_rate * 100).toFixed(1)}% OOS`,
        staleness_days: 1, stale: false,
        lead_indicator: 'N/A (this IS the lead)', lead_correlation: 0.85,
        normalised_label: `${(signals.distribution.oos_rate * 100).toFixed(1)}% OOS (unchanged)`,
        change_pct: 0, direction: 'UNCHANGED', confidence: 'HIGH', method: 'Direct daily feed',
      });
      await this._delay(100);
    }

    // ── Macro: STALE (31 days) → Extrapolate CPI trend ───────────────────────
    {
      const days_stale = profile.data_availability.macro.last_updated_days;
      const raw_cci = signals.macro.cci;
      const raw_cpi = signals.macro.cpi;
      const trend_delta = 0.1; // estimated monthly CPI drift
      const est_cpi = parseFloat((raw_cpi + trend_delta).toFixed(1));
      normalised.macro = { ...signals.macro, cpi_normalised: est_cpi };
      this._log(`  🌍 Macro: ${days_stale} days stale — linear extrapolation: CPI ${raw_cpi}% → ~${est_cpi}% (trend +0.1pp/month)`);
      this._log(`     ⚠ LOW confidence — macro changes slowly; used for context only, not primary risk driver`);
      signal_report.push({
        source: 'Macro', raw_label: `CCI ${raw_cci} · CPI ${raw_cpi}%`,
        staleness_days: days_stale, stale: true,
        lead_indicator: 'Historical trend extrapolation', lead_correlation: 0.41,
        normalised_label: `CCI ${raw_cci} · CPI ~${est_cpi}% (estimated)`,
        change_pct: parseFloat((trend_delta / raw_cpi * 100).toFixed(1)),
        direction: 'UP', confidence: 'LOW', method: 'Linear CPI trend at +0.1pp/month',
      });
      await this._delay(150);
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const stale_count = signal_report.filter(s => s.stale).length;
    const high_conf   = signal_report.filter(s => s.confidence === 'HIGH').length;
    this._log(`✅ Normalisation complete: ${stale_count} of ${signal_report.length} signals were stale and estimated`);
    this._log(`   Signal confidence: ${high_conf} HIGH · ${signal_report.filter(s => s.confidence === 'MEDIUM').length} MEDIUM · ${signal_report.filter(s => s.confidence === 'LOW').length} LOW`);
    this._log(`   Key finding: normalised weekly POS volume is ${normalised.pos.weekly_cases_normalised.toLocaleString()} cases vs raw ${signals.pos.weekly_cases.toLocaleString()} (${normalised.pos.vol_adjustment_pct > 0 ? '+' : ''}${normalised.pos.vol_adjustment_pct}%)`);

    return { normalised_signals: normalised, signal_report, logs: this.logs };
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = SignalNormalizationAgent;
