/**
 * Risk Detection Agent
 * Uses NORMALISED signals (not raw) so the risk score reflects today's reality,
 * not a 7-day-old snapshot.
 */

'use strict';

class RiskDetectionAgent {
  constructor(market) {
    this.market = market;
    this.logs   = [];
  }

  _log(msg) { this.logs.push({ ts: new Date().toISOString(), agent: 'RiskDetection', msg }); }

  async detect(normalisedSignals, allData) {
    this._log(`▶ Risk Detection — using normalised signals for ${this.market}`);
    this._log(`  Note: scores computed on normalised data, not raw — more accurate than POS-only view`);
    await this._delay(350);

    const ns = normalisedSignals;
    const dist   = ns.distribution;
    const pos    = ns.pos;
    const price  = ns.pricing;
    const atl    = ns.atl;
    const btl    = ns.btl;
    const macro  = ns.macro;

    // ── Component scores ────────────────────────────────────────────────────
    const posRisk   = this._posRisk(pos.weekly_cases_normalised, pos.sell_out_rate, allData.signals.pos.weekly_cases, allData.profile.baseline_weekly_cases);
    const distRisk  = this._distRisk(dist.oos_rate, dist.numeric_dist, dist.otif, allData.signals.pos.retailer_detail);
    const priceRisk = this._priceRisk(price.price_vs_competitor, price.promo_depth, price.promo_freq);
    const brandRisk = this._brandRisk(atl.sentiment, atl.grp, btl.activations_normalised || btl.activations, atl.campaign_active);
    const macroRisk = this._macroRisk(macro.cci, macro.cpi_normalised || macro.cpi, macro.summer_index);

    const W = { pos: 0.30, dist: 0.25, price: 0.22, brand: 0.13, macro: 0.10 };
    const rawScore = posRisk * W.pos + distRisk * W.dist + priceRisk * W.price + brandRisk * W.brand + macroRisk * W.macro;
    const final    = Math.min(100, Math.round(rawScore));
    const severity = final >= 75 ? 'CRITICAL' : final >= 55 ? 'HIGH' : final >= 35 ? 'MEDIUM' : 'LOW';

    this._log(`  POS risk (normalised): ${posRisk.toFixed(1)} — normalised weekly volume vs baseline`);
    this._log(`  Distribution risk:     ${distRisk.toFixed(1)} — OOS rate ${(dist.oos_rate * 100).toFixed(1)}%, ${allData.signals.pos.retailer_detail.filter(r => r.status !== 'OK').length} retailers at risk`);
    this._log(`  Pricing risk:          ${priceRisk.toFixed(1)} — price index ${price.price_vs_competitor.toFixed(2)}x vs competition`);
    this._log(`  Brand risk:            ${brandRisk.toFixed(1)} — sentiment ${(atl.sentiment * 100).toFixed(1)}%, GRP ${atl.grp}`);
    this._log(`  Macro risk:            ${macroRisk.toFixed(1)} — CCI ${macro.cci}, seasonal index ${macro.summer_index}`);
    this._log(`  Composite risk score:  ${final}/100 — Severity: ${severity}`);
    await this._delay(200);

    const topDrivers = [
      { name: 'pos',   score: posRisk,   weighted: posRisk * W.pos },
      { name: 'dist',  score: distRisk,  weighted: distRisk * W.dist },
      { name: 'price', score: priceRisk, weighted: priceRisk * W.price },
      { name: 'brand', score: brandRisk, weighted: brandRisk * W.brand },
      { name: 'macro', score: macroRisk, weighted: macroRisk * W.macro },
    ].sort((a, b) => b.weighted - a.weighted).slice(0, 3);

    this._log(`✅ Top 3 drivers: ${topDrivers.map(d => `${d.name} (${d.weighted.toFixed(1)})`).join(', ')}`);

    return {
      riskScore: final, severity,
      components: { posRisk, distRisk, priceRisk, brandRisk, macroRisk },
      topDrivers, logs: this.logs,
    };
  }

  _posRisk(normWeekly, sellOutRate, rawWeekly, baseline) {
    let r = 40;
    const vs_baseline = (normWeekly - baseline) / baseline;
    if (vs_baseline < -0.12) r += 35;
    else if (vs_baseline < -0.06) r += 20;
    else if (vs_baseline < -0.02) r += 10;
    if (sellOutRate < 0.78) r += 20;
    else if (sellOutRate < 0.85) r += 8;
    return Math.min(100, r);
  }

  _distRisk(oos, numDist, otif, retailers) {
    let r = 40;
    r += oos * 150;
    if (numDist < 0.65) r += 20;
    else if (numDist < 0.75) r += 10;
    if (otif < 0.82) r += 15;
    if (retailers) {
      const atRisk = retailers.filter(r => r.status === 'AT RISK').length;
      r += atRisk * 8;
    }
    return Math.min(100, r);
  }

  _priceRisk(priceVsComp, promoDepth, promoFreq) {
    let r = 38;
    if (priceVsComp > 1.10) r += 28;
    else if (priceVsComp > 1.05) r += 14;
    if (promoDepth < 0.12) r += 10;
    if (promoFreq < 0.20) r += 8;
    return Math.min(100, r);
  }

  _brandRisk(sentiment, grp, activations, campaignActive) {
    let r = 35;
    if (sentiment < 0.55) r += 28;
    else if (sentiment < 0.65) r += 14;
    if (grp < 250) r += 15;
    else if (grp < 280) r += 7;
    if (!campaignActive) r += 10;
    if (activations < 25) r += 8;
    return Math.min(100, r);
  }

  _macroRisk(cci, cpi, seasonIdx) {
    let r = 30;
    if (cci < 90) r += 20;
    if (cpi > 5) r += 15;
    if (seasonIdx > 1.05) r -= 12;
    return Math.max(0, Math.min(100, r));
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = RiskDetectionAgent;
