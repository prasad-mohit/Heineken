/**
 * Risk Detection Agent
 * Computes a 0-100 sell-out risk score from all ingested data signals.
 * Higher score = higher probability of 6-10%+ volume decline in 12 weeks.
 */

class RiskDetectionAgent {
  constructor(market) {
    this.market = market;
    this.logs = [];
  }

  _log(msg) {
    this.logs.push({ ts: new Date().toISOString(), agent: 'RiskDetection', msg });
  }

  async detect(ingestedData) {
    const { data, overallQuality } = ingestedData;
    this._log(`▶ Starting risk analysis for market: ${this.market}`);
    await this._delay(400);

    // --- 1. POS Signal ---
    const posRecords = data.pos;
    const avgStockCoverage = posRecords.reduce((a, r) => a + r.stockCoverageDays, 0) / posRecords.length;
    const avgSellOut = posRecords.reduce((a, r) => a + r.sellOutRate, 0) / posRecords.length;
    const posRisk = this._posRisk(avgStockCoverage, avgSellOut);
    this._log(`  POS Signal     → stock_coverage=${avgStockCoverage.toFixed(1)}d, sell_out_rate=${(avgSellOut * 100).toFixed(1)}% → risk contribution: ${posRisk.toFixed(1)}`);
    await this._delay(300);

    // --- 2. Distribution Signal ---
    const dist = data.distribution;
    const distRisk = this._distributionRisk(dist.outOfStockRate, dist.numericDistribution, dist.deliveryOnTime);
    this._log(`  Distribution   → OOS=${(dist.outOfStockRate * 100).toFixed(1)}%, num_dist=${(dist.numericDistribution * 100).toFixed(1)}%, OTIF=${(dist.deliveryOnTime * 100).toFixed(1)}% → risk contribution: ${distRisk.toFixed(1)}`);
    await this._delay(250);

    // --- 3. Pricing Signal ---
    const pricing = data.pricing;
    const pricingRisk = this._pricingRisk(pricing.priceVsCompetitor, pricing.promoDepth, pricing.promoFrequency);
    this._log(`  Pricing        → price_vs_competitor=${pricing.priceVsCompetitor.toFixed(2)}x, promo_depth=${(pricing.promoDepth * 100).toFixed(0)}%, elasticity=${pricing.elasticity} → risk contribution: ${pricingRisk.toFixed(1)}`);
    await this._delay(250);

    // --- 4. ATL/BTL Signal ---
    const atl = data.atl;
    const btl = data.btl;
    const brandRisk = this._brandRisk(atl.sentimentScore, atl.grp, btl.inStoreActivations, atl.campaignActive);
    this._log(`  Brand/Comms    → sentiment=${(atl.sentimentScore * 100).toFixed(1)}%, GRP=${atl.grp}, activations=${btl.inStoreActivations} → risk contribution: ${brandRisk.toFixed(1)}`);
    await this._delay(200);

    // --- 5. Macro Signal ---
    const macro = data.macro;
    const macroRisk = this._macroRisk(macro.consumerConfidenceIndex, macro.cpi, macro.summerSeasonIndex);
    this._log(`  Macro          → CCI=${macro.consumerConfidenceIndex}, CPI=${macro.cpi}%, season=${macro.summerSeasonIndex} → risk contribution: ${macroRisk.toFixed(1)}`);
    await this._delay(200);

    // --- Weighted composite risk score ---
    const weights = { pos: 0.30, dist: 0.25, pricing: 0.22, brand: 0.13, macro: 0.10 };
    let rawScore = (
      posRisk      * weights.pos +
      distRisk     * weights.dist +
      pricingRisk  * weights.pricing +
      brandRisk    * weights.brand +
      macroRisk    * weights.macro
    );

    // Data quality penalty: low-quality data adds uncertainty → inflate risk slightly
    const qualityPenalty = (1 - overallQuality) * 8;
    const finalScore = Math.min(100, Math.round(rawScore + qualityPenalty));

    this._log(`  Composite raw score: ${rawScore.toFixed(1)} + quality_uncertainty_penalty: +${qualityPenalty.toFixed(1)}`);
    await this._delay(200);

    const severity = this._severity(finalScore);
    const drivers = this._topDrivers({ posRisk, distRisk, pricingRisk, brandRisk, macroRisk }, weights);

    this._log(`✅ Risk Score: ${finalScore} / 100 — Severity: ${severity}`);
    this._log(`  Top risk drivers: ${drivers.map(d => `${d.name} (${d.contribution.toFixed(1)})`).join(', ')}`);

    return {
      riskScore: finalScore,
      severity,
      components: { posRisk, distRisk, pricingRisk, brandRisk, macroRisk },
      topDrivers: drivers,
      logs: this.logs,
    };
  }

  _posRisk(stockDays, sellOutRate) {
    let r = 50;
    if (stockDays < 10) r += 30;
    else if (stockDays < 15) r += 15;
    else if (stockDays > 28) r += 5;
    if (sellOutRate < 0.75) r += 25;
    else if (sellOutRate < 0.85) r += 10;
    return Math.min(100, r);
  }

  _distributionRisk(oos, numDist, otif) {
    let r = 50;
    r += oos * 120;
    if (numDist < 0.65) r += 20;
    else if (numDist < 0.75) r += 10;
    if (otif < 0.80) r += 15;
    else if (otif < 0.88) r += 5;
    return Math.min(100, r);
  }

  _pricingRisk(priceVsComp, promoDepth, promoFreq) {
    let r = 40;
    if (priceVsComp > 1.10) r += 25;
    else if (priceVsComp > 1.05) r += 12;
    if (promoDepth < 0.12) r += 10;
    if (promoFreq < 0.20) r += 8;
    return Math.min(100, r);
  }

  _brandRisk(sentiment, grp, activations, campaignActive) {
    let r = 35;
    if (sentiment < 0.55) r += 25;
    else if (sentiment < 0.65) r += 12;
    if (grp < 250) r += 15;
    if (!campaignActive) r += 10;
    if (activations < 25) r += 8;
    return Math.min(100, r);
  }

  _macroRisk(cci, cpi, seasonIdx) {
    let r = 30;
    if (cci < 90) r += 20;
    else if (cci < 95) r += 10;
    if (cpi > 4.5) r += 15;
    if (seasonIdx > 1.05) r -= 10;  // seasonality reduces risk
    return Math.max(0, Math.min(100, r));
  }

  _severity(score) {
    if (score >= 75) return 'CRITICAL';
    if (score >= 55) return 'HIGH';
    if (score >= 35) return 'MEDIUM';
    return 'LOW';
  }

  _topDrivers(components, weights) {
    return Object.entries(components)
      .map(([key, val]) => ({ name: key.replace('Risk', ''), contribution: val * (weights[key.replace('Risk', '')] || 0.1) }))
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = RiskDetectionAgent;
