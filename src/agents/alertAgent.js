/**
 * Alert Agent
 * Routes severity-graded alerts to the right stakeholders.
 */

const STAKEHOLDER_MAP = {
  CRITICAL: ['Country MD', 'Commercial Director', 'Supply Chain Director', 'Global Revenue Management Hub', 'Category Director'],
  HIGH:     ['Country MD', 'Commercial Director', 'Supply Chain Director'],
  MEDIUM:   ['Commercial Director', 'Field Sales Manager'],
  LOW:      ['Field Sales Manager'],
};

class AlertAgent {
  constructor(market) {
    this.market = market;
    this.logs = [];
  }

  _log(msg) {
    this.logs.push({ ts: new Date().toISOString(), agent: 'Alert', msg });
  }

  async generateAlerts(riskResult, ingestedData) {
    const { riskScore, severity, topDrivers, components } = riskResult;
    this._log(`▶ Generating alerts for ${this.market} — Risk: ${riskScore} (${severity})`);
    await this._delay(300);

    const stakeholders = STAKEHOLDER_MAP[severity] || STAKEHOLDER_MAP.MEDIUM;
    this._log(`  Routing to ${stakeholders.length} stakeholder(s): ${stakeholders.join(', ')}`);
    await this._delay(250);

    const alerts = [];

    // Primary sell-out risk alert
    alerts.push({
      id: `ALT-${Date.now()}-001`,
      type: 'SELL_OUT_RISK',
      severity,
      market: this.market,
      headline: `${severity} sell-out volume risk detected in ${this.market} Modern Trade`,
      body: `Composite risk score is ${riskScore}/100. Model predicts ${this._volumeRange(riskScore)}% volume decline over next 12 weeks if no action is taken.`,
      stakeholders,
      channel: severity === 'CRITICAL' ? 'Push + Email + Teams' : 'Email + Teams',
      timestamp: new Date().toISOString(),
    });
    this._log(`  ✔ Alert ALT-001 created: ${severity} sell-out risk`);
    await this._delay(200);

    // Sub-alerts per top driver
    for (const driver of topDrivers) {
      const subAlert = this._buildDriverAlert(driver, riskScore, ingestedData);
      if (subAlert) {
        alerts.push(subAlert);
        this._log(`  ✔ Alert ${subAlert.id}: ${subAlert.headline}`);
        await this._delay(150);
      }
    }

    this._log(`✅ ${alerts.length} alerts dispatched. Primary channel: ${alerts[0].channel}`);

    return { alerts, logs: this.logs };
  }

  _volumeRange(riskScore) {
    if (riskScore >= 75) return '8–12';
    if (riskScore >= 55) return '6–9';
    if (riskScore >= 35) return '3–6';
    return '1–3';
  }

  _buildDriverAlert(driver, riskScore, ingestedData) {
    const { data } = ingestedData;
    const driverAlerts = {
      pos: {
        id: `ALT-${Date.now()}-POS`,
        type: 'STOCK_COVERAGE',
        severity: riskScore > 65 ? 'HIGH' : 'MEDIUM',
        market: this.market,
        headline: `Low stock coverage detected across key retailers in ${this.market}`,
        body: `Average stock coverage is below 15 days at ${data.pos.filter(r => r.stockCoverageDays < 15).length} retailer(s). Risk of out-of-stock event within 2 weeks.`,
        stakeholders: ['Supply Chain Director', 'Field Sales Manager'],
        channel: 'Email + Teams',
        timestamp: new Date().toISOString(),
      },
      dist: {
        id: `ALT-${Date.now()}-DIST`,
        type: 'DISTRIBUTION_GAP',
        severity: 'MEDIUM',
        market: this.market,
        headline: `Distribution gap: OOS rate ${(data.distribution.outOfStockRate * 100).toFixed(1)}% above threshold`,
        body: `Numeric distribution at ${(data.distribution.numericDistribution * 100).toFixed(1)}%. Target is 80%+. OTIF delivery at ${(data.distribution.deliveryOnTime * 100).toFixed(1)}%.`,
        stakeholders: ['Supply Chain Director', 'Field Sales Manager'],
        channel: 'Email',
        timestamp: new Date().toISOString(),
      },
      pricing: {
        id: `ALT-${Date.now()}-PRC`,
        type: 'PRICE_COMPETITIVENESS',
        severity: 'MEDIUM',
        market: this.market,
        headline: `Heineken priced ${((data.pricing.priceVsCompetitor - 1) * 100).toFixed(0)}% above competitive benchmark`,
        body: `Shelf price index vs competitor: ${data.pricing.priceVsCompetitor.toFixed(2)}x. Estimated volume elasticity impact at current promo depth.`,
        stakeholders: ['Commercial Director', 'Revenue Management Hub'],
        channel: 'Email',
        timestamp: new Date().toISOString(),
      },
    };
    return driverAlerts[driver.name] || null;
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = AlertAgent;
