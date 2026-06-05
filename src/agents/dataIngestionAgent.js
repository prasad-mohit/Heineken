/**
 * Data Ingestion Agent
 * Collects data from all 6 source types, validates quality, reports freshness issues.
 */

const { generateAllData } = require('../data/sampleData');

const SOURCE_WEIGHTS = {
  pos: 0.30,
  atl: 0.15,
  btl: 0.10,
  pricing: 0.20,
  distribution: 0.15,
  macro: 0.10,
};

const QUALITY_SCORE = { HIGH: 1.0, MEDIUM: 0.7, LOW: 0.4 };

class DataIngestionAgent {
  constructor(market) {
    this.market = market;
    this.logs = [];
  }

  _log(msg) {
    this.logs.push({ ts: new Date().toISOString(), agent: 'DataIngestion', msg });
  }

  async ingest() {
    this._log(`▶ Starting data ingestion for market: ${this.market}`);
    await this._delay(400);

    const raw = generateAllData(this.market);
    this._log(`  Fetched 6 data source streams: POS, ATL, BTL, Pricing, Distribution, Macro`);
    await this._delay(300);

    const sourceReport = [];
    for (const [source, data] of Object.entries(raw)) {
      const quality = (Array.isArray(data) ? data[0] : data).quality || 'MEDIUM';
      const freshness = (Array.isArray(data) ? data[0] : data).dataFreshness || 'Unknown';
      const score = QUALITY_SCORE[quality] ?? 0.5;
      const weight = SOURCE_WEIGHTS[source];
      sourceReport.push({ source, quality, freshness, score, weight });
      this._log(`  ✔ ${source.toUpperCase().padEnd(14)} quality=${quality.padEnd(6)} freshness="${freshness}"`);
      await this._delay(150);
    }

    const overallQuality = sourceReport.reduce((acc, s) => acc + s.score * s.weight, 0);
    const issues = sourceReport.filter(s => s.quality !== 'HIGH');

    this._log(`  Data Quality Score: ${(overallQuality * 100).toFixed(1)}%`);
    if (issues.length > 0) {
      issues.forEach(i => this._log(`  ⚠ ${i.source.toUpperCase()} has ${i.quality} quality — weight adjusted`));
    }
    await this._delay(200);

    this._log(`✅ Ingestion complete. ${sourceReport.length} sources loaded. Overall quality: ${(overallQuality * 100).toFixed(1)}%`);

    return {
      data: raw,
      sourceReport,
      overallQuality: parseFloat(overallQuality.toFixed(3)),
      logs: this.logs,
    };
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = DataIngestionAgent;
