'use strict';

class AlertAgent {
  constructor(market) {
    this.market = market;
    this.logs   = [];
  }
  _log(msg) { this.logs.push({ ts: new Date().toISOString(), agent: 'Alert', msg }); }

  async route(riskData, recommendations) {
    this._log(`▶ Alert Agent — routing ${recommendations.length} recommendation(s) to stakeholders`);
    await this._delay(250);

    const alerts = recommendations.map(rec => {
      const urgency = rec.priority === 1 ? 'URGENT' : rec.priority === 2 ? 'HIGH' : 'MEDIUM';
      const channels = [];
      if (urgency === 'URGENT')       channels.push('Teams (immediate)', 'Email', 'Dashboard');
      else if (urgency === 'HIGH')    channels.push('Email', 'Dashboard');
      else                            channels.push('Dashboard', 'Weekly digest');

      const a = { id: rec.id, headline: rec.headline, urgency, owner: rec.owner, deadline: rec.deadline, channels, confidence: rec.confidence };
      this._log(`  ${urgency} → ${rec.owner}: ${rec.id} via ${channels[0]}`);
      return a;
    });

    if (riskData.riskScore >= 75) {
      this._log(`  🔴 CRITICAL risk (${riskData.riskScore}/100) — notifying Country MD directly`);
      alerts.push({ id: 'ALERT-MD', headline: `${this.market} risk score ${riskData.riskScore}/100 — immediate review required`, urgency: 'CRITICAL', owner: 'Country MD', channels: ['Teams (urgent)', 'Email'], deadline: 'Today' });
    }

    this._log(`✅ Alerts queued: ${alerts.length} notification(s)`);
    return { alerts, logs: this.logs };
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = AlertAgent;
