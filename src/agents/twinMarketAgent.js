/**
 * Twin Market Agent
 *
 * Problem: Budget is capped. Teams can't rebuild everything from scratch in each market.
 * Solution: Find markets that are structurally similar ("identical twins") so playbooks,
 * models, and calibrations can be transferred with minimal localisation cost.
 *
 * Algorithm: Weighted Euclidean similarity on 7 normalised market indicators.
 * Similarity = 1 − (weighted distance / max possible distance)
 */

'use strict';

const { MARKETS } = require('../data/sampleData');

// Feature weights — what matters most for commercial similarity
const WEIGHTS = {
  beer_consumption_pc: 0.25,  // most predictive of category behaviour
  gdp_pc_normalised:   0.20,  // purchasing power
  mt_share:            0.20,  // channel mix match (critical for Modern Trade playbooks)
  premium_share:       0.15,  // brand positioning match
  heineken_share:      0.10,  // brand strength / awareness base
  cpi_normalised:      0.05,  // macro environment
  unemployment_norm:   0.05,  // disposable income context
};

// Normalisation ranges (min, max across all markets)
const RANGES = {
  beer_consumption_pc: { min: 12,   max: 92   },
  gdp_pc:              { min: 2200, max: 56000 },
  mt_share:            { min: 0.35, max: 0.75  },
  premium_share:       { min: 0.18, max: 0.45  },
  heineken_share:      { min: 0.08, max: 0.38  },
  cpi:                 { min: 2.8,  max: 18.4  },
  unemployment:        { min: 3.1,  max: 11.5  },
};

function normalise(value, min, max) {
  return (value - min) / (max - min);
}

function marketVector(m) {
  return {
    beer_consumption_pc: normalise(m.beer_consumption_pc, RANGES.beer_consumption_pc.min, RANGES.beer_consumption_pc.max),
    gdp_pc_normalised:   normalise(m.gdp_pc, RANGES.gdp_pc.min, RANGES.gdp_pc.max),
    mt_share:            normalise(m.mt_share, RANGES.mt_share.min, RANGES.mt_share.max),
    premium_share:       normalise(m.premium_share, RANGES.premium_share.min, RANGES.premium_share.max),
    heineken_share:      normalise(m.heineken_share, RANGES.heineken_share.min, RANGES.heineken_share.max),
    cpi_normalised:      normalise(m.cpi, RANGES.cpi.min, RANGES.cpi.max),
    unemployment_norm:   normalise(m.unemployment, RANGES.unemployment.min, RANGES.unemployment.max),
  };
}

function similarity(vecA, vecB) {
  let dist = 0;
  let maxDist = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const diff = (vecA[key] ?? 0) - (vecB[key] ?? 0);
    dist    += weight * diff * diff;
    maxDist += weight * 1;
  }
  return 1 - Math.sqrt(dist / maxDist);
}

// What capabilities the source market has that the target market lacks
function transferablePlaybooks(sourceMarket, targetName) {
  const target    = MARKETS[targetName];
  const source    = MARKETS[sourceMarket];
  const playbooks = [];

  // Model transfers
  if (source.models.mmm.deployed && !target.models.mmm.deployed) {
    playbooks.push({
      type: 'MMM Transfer',
      detail: `${sourceMarket} has a live MMM (${source.models.mmm.last_calibrated}). ${targetName} has none.`,
      saving: '€35,000–€55,000 in model build cost + 10 weeks faster',
      effort: 'Recalibrate with local data (4–6 weeks vs 14 weeks from scratch)',
    });
  }
  if (source.models.pricing_tool.deployed && !target.models.pricing_tool.deployed) {
    playbooks.push({
      type: 'Pricing Tool Deployment',
      detail: `${sourceMarket} Pricing Tool (${source.models.pricing_tool.last_calibrated}) can be adapted.`,
      saving: '€20,000–€30,000 + 6 weeks',
      effort: 'Map retailer price data to existing schema (2–3 weeks)',
    });
  }

  // Data infrastructure transfers
  if (source.data_availability.distribution.freshness === 'Daily' &&
      target.data_availability.distribution.freshness !== 'Daily') {
    playbooks.push({
      type: 'Distribution Data Pipeline',
      detail: `${sourceMarket} runs daily distribution feeds. ${targetName} has ${target.data_availability.distribution.freshness || 'no'} distribution data.`,
      saving: '4 weeks of data engineering + 6 days earlier OOS detection',
      effort: 'Replicate API connector — standard 2-week job',
    });
  }

  // Replenishment playbooks
  if (source.team.ds >= 2 && target.team.ds <= 1) {
    playbooks.push({
      type: 'Replenishment Algorithm',
      detail: `${sourceMarket} has a validated replenishment model. ${targetName} team is too small to build from scratch this half-year.`,
      saving: '8 weeks of development',
      effort: 'Parameter tuning for local retailer lead times (1 week)',
    });
  }

  return playbooks;
}

class TwinMarketAgent {
  constructor(market) {
    this.market = market;
    this.logs   = [];
  }

  _log(msg) { this.logs.push({ ts: new Date().toISOString(), agent: 'TwinMarket', msg }); }

  async findTwins() {
    this._log(`▶ Twin Market Agent — finding similarity profiles for ${this.market}`);
    this._log(`  Algorithm: weighted Euclidean similarity on 7 normalised market indicators`);
    this._log(`  Indicators: beer consumption, GDP/capita, MT share, premium share, Heineken share, CPI, unemployment`);
    this._log(`  Weights: consumption(25%) GDP(20%) channel(20%) premium(15%) share(10%) CPI(5%) unemployment(5%)`);
    await this._delay(350);

    const sourceProfile = MARKETS[this.market];
    const sourceVec     = marketVector(sourceProfile);

    this._log(`  ${this.market} profile: beer ${sourceProfile.beer_consumption_pc}L/cap · GDP €${(sourceProfile.gdp_pc / 1000).toFixed(0)}K · MT ${(sourceProfile.mt_share * 100).toFixed(0)}% · premium ${(sourceProfile.premium_share * 100).toFixed(0)}%`);
    await this._delay(250);

    const comparisons = [];

    for (const [name, profile] of Object.entries(MARKETS)) {
      if (name === this.market) continue;

      const targetVec = marketVector(profile);
      const sim       = similarity(sourceVec, targetVec);
      const playbooks = transferablePlaybooks(this.market, name);

      const dim_scores = Object.entries(WEIGHTS).map(([key, w]) => {
        const a    = sourceVec[key] ?? 0;
        const b    = targetVec[key] ?? 0;
        const diff = Math.abs(a - b);
        return {
          indicator: key.replace(/_normalised|_norm/, '').replace(/_/g, ' '),
          source_raw: getReadableRaw(this.market, key),
          target_raw: getReadableRaw(name, key),
          match: diff < 0.15 ? 'STRONG' : diff < 0.30 ? 'MODERATE' : 'WEAK',
          match_pct: Math.round((1 - diff) * 100),
        };
      });

      comparisons.push({
        market: name,
        flag: profile.flag,
        region: profile.region,
        similarity_pct: Math.round(sim * 100),
        similarity_label: sim >= 0.80 ? 'Very High' : sim >= 0.65 ? 'High' : sim >= 0.50 ? 'Moderate' : 'Low',
        transferable_playbooks: playbooks,
        playbook_count: playbooks.length,
        estimated_saving: playbooks.length > 0
          ? `€${playbooks.length * 35}K–€${playbooks.length * 55}K + ${playbooks.length * 5}–${playbooks.length * 8} weeks saved`
          : 'Minimal (models already deployed)',
        dim_scores,
        model_gap: [
          !profile.models.mmm.deployed && MARKETS[this.market].models.mmm.deployed ? 'MMM' : null,
          !profile.models.pricing_tool.deployed && MARKETS[this.market].models.pricing_tool.deployed ? 'Pricing Tool' : null,
          !profile.models.dist_planner.deployed && MARKETS[this.market].models.dist_planner.deployed ? 'Distribution Planner' : null,
        ].filter(Boolean),
      });

      this._log(`  ${profile.flag} ${name}: ${(sim * 100).toFixed(0)}% similar — ${playbooks.length} transferable playbook(s)`);
      await this._delay(120);
    }

    // Sort by similarity
    comparisons.sort((a, b) => b.similarity_pct - a.similarity_pct);

    const top_twin   = comparisons[0];
    const budget_msg = top_twin
      ? `Budget recommendation: Start with ${top_twin.market} (${top_twin.similarity_pct}% similar). ` +
        `Transfer ${top_twin.playbook_count} playbook(s) → estimated ${top_twin.estimated_saving} across pilot markets.`
      : 'No high-similarity market found.';

    this._log(`✅ Twin analysis complete. Top twin: ${top_twin?.market || 'N/A'} at ${top_twin?.similarity_pct || 0}%`);
    this._log(`   ${budget_msg}`);

    return { comparisons, top_twin, budget_message: budget_msg, logs: this.logs };
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

function getReadableRaw(marketName, key) {
  const m = MARKETS[marketName];
  const map = {
    beer_consumption_pc: `${m.beer_consumption_pc}L/cap`,
    gdp_pc_normalised:   `€${(m.gdp_pc / 1000).toFixed(0)}K`,
    mt_share:            `${(m.mt_share * 100).toFixed(0)}%`,
    premium_share:       `${(m.premium_share * 100).toFixed(0)}%`,
    heineken_share:      `${(m.heineken_share * 100).toFixed(0)}%`,
    cpi_normalised:      `${m.cpi}%`,
    unemployment_norm:   `${m.unemployment}%`,
  };
  return map[key] || '—';
}

module.exports = TwinMarketAgent;
