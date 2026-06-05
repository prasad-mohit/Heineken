/**
 * Recommendation Agent
 * Proposes ranked, actionable corrective measures with estimated ROI and effort scores.
 */

class RecommendationAgent {
  constructor(market) {
    this.market = market;
    this.logs = [];
  }

  _log(msg) {
    this.logs.push({ ts: new Date().toISOString(), agent: 'Recommendation', msg });
  }

  async recommend(riskResult, ingestedData) {
    const { riskScore, severity, components, topDrivers } = riskResult;
    const { data } = ingestedData;
    this._log(`▶ Generating recommendations for ${this.market} (risk=${riskScore}, severity=${severity})`);
    await this._delay(400);

    const candidates = [];

    // Supply / Distribution recommendations
    if (components.distRisk > 55 || components.posRisk > 55) {
      candidates.push({
        id: 'REC-001',
        priority: 1,
        category: 'Supply Chain',
        action: 'Accelerate replenishment cycle for top 3 retailers',
        rationale: `Stock coverage average is below safe threshold. Increasing delivery frequency from weekly to bi-weekly for Albert Heijn, Jumbo, and Lidl can recover ${this._vol(riskScore)}% volume.`,
        estimatedVolumeRecovery: `${this._vol(riskScore)}%`,
        estimatedROI: `€${this._roi(riskScore, 120)}K / quarter`,
        effort: 'LOW',
        timeToImpact: '1–2 weeks',
        owner: 'Supply Chain Director',
        kpi: 'Stock Coverage Days ≥ 21',
      });
      this._log(`  ✔ REC-001: Accelerate replenishment cycle`);
      await this._delay(200);
    }

    // Promotional recommendations
    if (components.pricingRisk > 50) {
      candidates.push({
        id: 'REC-002',
        priority: 2,
        category: 'Pricing & Promotions',
        action: 'Activate tactical promotional pack at Albert Heijn and Jumbo — 4-pack at −15% shelf price',
        rationale: `Price-vs-competitor index is ${data.pricing.priceVsCompetitor.toFixed(2)}x. A targeted 4-pack promotion at −15% is projected to lift volume +${this._promoLift(data.pricing)}% with a price elasticity of ${data.pricing.elasticity}.`,
        estimatedVolumeRecovery: `+${this._promoLift(data.pricing)}%`,
        estimatedROI: `€${this._roi(riskScore, 95)}K / quarter`,
        effort: 'MEDIUM',
        timeToImpact: '2–3 weeks',
        owner: 'Commercial Director + Revenue Management Hub',
        kpi: 'Promo Lift ≥ 1.15x vs baseline',
      });
      this._log(`  ✔ REC-002: Tactical promotional pack activation`);
      await this._delay(200);
    }

    // Distribution gap fix
    if (components.distRisk > 45) {
      candidates.push({
        id: 'REC-003',
        priority: 3,
        category: 'Distribution',
        action: 'Close distribution gap: target 5 new listings at independent modern trade stores',
        rationale: `Numeric distribution at ${(data.distribution.numericDistribution * 100).toFixed(1)}% vs 80% target. Prioritise independent MT stores in urban areas to close gap within 4 weeks.`,
        estimatedVolumeRecovery: `+${Math.round(4 + Math.random() * 3)}%`,
        estimatedROI: `€${this._roi(riskScore, 60)}K / quarter`,
        effort: 'MEDIUM',
        timeToImpact: '3–4 weeks',
        owner: 'Field Sales Manager',
        kpi: 'Numeric Distribution ≥ 80%',
      });
      this._log(`  ✔ REC-003: Close distribution gap at independent MT`);
      await this._delay(200);
    }

    // Brand / BTL recommendations
    if (components.brandRisk > 50) {
      candidates.push({
        id: 'REC-004',
        priority: 4,
        category: 'Brand & Activation',
        action: 'Deploy 20 additional in-store activations and launch "Ice Cold Heineken" summer BTL campaign',
        rationale: `Brand sentiment at ${(data.atl.sentimentScore * 100).toFixed(1)}% and only ${data.btl.inStoreActivations} active in-store promoters. Summer season index at ${data.macro.summerSeasonIndex} is favourable for visibility push.`,
        estimatedVolumeRecovery: `+${Math.round(2 + Math.random() * 3)}%`,
        estimatedROI: `€${this._roi(riskScore, 50)}K / quarter`,
        effort: 'HIGH',
        timeToImpact: '4–6 weeks',
        owner: 'Category Director + Field Marketing',
        kpi: 'Brand Sentiment ≥ 72%, In-store activations ≥ 55',
      });
      this._log(`  ✔ REC-004: BTL activation push + summer campaign`);
      await this._delay(200);
    }

    // Pilot decision recommendation (the meta-question in the brief)
    candidates.push({
      id: 'REC-005',
      priority: 5,
      category: 'Strategic',
      action: `Proceed with Option A: Launch controlled Minority Report pilot in ${this.market} + 1 additional market within 8 weeks`,
      rationale: `Risk score of ${riskScore}/100 validates the need for early-warning capability NOW. Re-architecture (Option B) delays impact by 12–16 weeks. Current signals suggest the model can already demonstrate measurable lift in 12 weeks with the 4 tactical recommendations above. Estimated incremental volume: +€${this._roi(riskScore, 400)}K across both pilot markets.`,
      estimatedVolumeRecovery: `+${Math.round(6 + Math.random() * 4)}% vs no-action baseline`,
      estimatedROI: `€${this._roi(riskScore, 400)}K / quarter across pilot markets`,
      effort: 'HIGH',
      timeToImpact: '8–12 weeks',
      owner: 'Chapter Lead Data Science + Country MD',
      kpi: 'Volume decline contained to <2% vs baseline in 12 weeks',
    });
    this._log(`  ✔ REC-005: Strategic pilot launch recommendation (Option A)`);
    await this._delay(250);

    this._log(`✅ ${candidates.length} recommendations generated. Top priority: ${candidates[0].action}`);

    return { recommendations: candidates, logs: this.logs };
  }

  _vol(riskScore) {
    return (3 + Math.round(riskScore / 20)).toString();
  }

  _roi(riskScore, base) {
    return Math.round(base * (0.7 + riskScore / 200));
  }

  _promoLift(pricing) {
    return Math.abs(Math.round(pricing.elasticity * pricing.promoDepth * 100)).toString();
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = RecommendationAgent;
