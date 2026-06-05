/**
 * Sample Data — 6 EMEA market profiles with realistic signal data.
 *
 * Each market has:
 *  - Structural characteristics (macro, channel, brand)
 *  - Data availability per source (with staleness)
 *  - Model deployment status
 *  - Team headcount
 *  - Current signals (with randomised noise around realistic means)
 *  - MMM output, Pricing Tool output, Distribution Planner output
 */

'use strict';

const R = () => Math.random();

// ── Lead-lag historical relationships (derived from 52-104 weeks of data) ──
const LEAD_LAG = {
  'distribution→pos': {
    lag_days: 3.5, correlation: 0.85, beta: -1.8,
    description: '1pp increase in OOS rate leads to -1.8% volume decline 3–4 days later',
    n_weeks: 52,
  },
  'atl→pos': {
    lag_weeks: 2.5, correlation: 0.72, beta: 0.045,
    description: '10 additional GRP = +0.45% volume lift after ~2.5 weeks',
    n_weeks: 104,
  },
  'pricing→pos': {
    lag_weeks: 0.8, correlation: -0.68, beta: -1.4,
    description: '1% price increase leads to -1.4% volume decline within ~1 week',
    n_weeks: 78,
  },
  'btl→pos': {
    lag_weeks: 1.2, correlation: 0.58, beta: 0.8,
    description: '10 additional BTL activations = +0.8% volume lift after 1–2 weeks',
    n_weeks: 52,
  },
  'macro→pos': {
    lag_weeks: 4.0, correlation: 0.41, beta: 0.6,
    description: '1-point CCI improvement = +0.6% volume lift after ~4 weeks',
    n_weeks: 104,
  },
};

// ── Market profiles ─────────────────────────────────────────────────────────
const MARKETS = {
  Netherlands: {
    id: 'NL', flag: '🇳🇱', region: 'Europe (West)',
    population: 17.9, gdp_pc: 56000, beer_consumption_pc: 78, cpi: 3.1, unemployment: 3.8,
    mt_share: 0.68, on_trade_share: 0.24, impulse_share: 0.08,
    premium_share: 0.32, heineken_share: 0.24,
    key_retailers: ['Albert Heijn', 'Jumbo', 'Lidl', 'Plus'],
    baseline_weekly_cases: 10500,
    revenue_per_case: 3.20,
    extra_delivery_cost: 4200,
    delivery_lead_days: 4,
    data_availability: {
      pos:          { available: true,  freshness: 'Weekly (7-day lag)',  last_updated_days: 7,  coverage: 0.92 },
      atl:          { available: true,  freshness: 'Daily',               last_updated_days: 1,  coverage: 1.00 },
      btl:          { available: true,  freshness: 'Sporadic (~21-day)',  last_updated_days: 21, coverage: 0.60 },
      pricing:      { available: true,  freshness: 'Weekly (3-day lag)',  last_updated_days: 3,  coverage: 0.88 },
      distribution: { available: true,  freshness: 'Daily',               last_updated_days: 1,  coverage: 0.78 },
      macro:        { available: true,  freshness: 'Monthly',             last_updated_days: 31, coverage: 1.00 },
    },
    models: {
      mmm:          { deployed: true,  last_calibrated: '2025-Q4', granularity: 'Monthly', confidence: 'HIGH' },
      pricing_tool: { deployed: true,  last_calibrated: '2026-Q1', granularity: 'Weekly',  confidence: 'HIGH' },
      dist_planner: { deployed: true,  granularity: 'Daily',       confidence: 'MEDIUM'   },
    },
    team: { ds: 3, analysts: 4, backlog_items: 47, active_sprints: 2 },
  },

  Belgium: {
    id: 'BE', flag: '🇧🇪', region: 'Europe (West)',
    population: 11.6, gdp_pc: 48000, beer_consumption_pc: 72, cpi: 3.4, unemployment: 5.2,
    mt_share: 0.71, on_trade_share: 0.20, impulse_share: 0.09,
    premium_share: 0.29, heineken_share: 0.20,
    key_retailers: ['Colruyt', 'Carrefour', 'Delhaize', 'Lidl'],
    baseline_weekly_cases: 4200,
    revenue_per_case: 3.15,
    extra_delivery_cost: 3100,
    delivery_lead_days: 3,
    data_availability: {
      pos:          { available: true,  freshness: 'Weekly (7-day lag)',  last_updated_days: 7,  coverage: 0.85 },
      atl:          { available: true,  freshness: 'Weekly',              last_updated_days: 2,  coverage: 0.90 },
      btl:          { available: false, freshness: 'Not available',       last_updated_days: null, coverage: 0 },
      pricing:      { available: true,  freshness: 'Manual (2-week lag)', last_updated_days: 14, coverage: 0.60 },
      distribution: { available: true,  freshness: 'Weekly',             last_updated_days: 5,  coverage: 0.65 },
      macro:        { available: true,  freshness: 'Monthly',             last_updated_days: 28, coverage: 1.00 },
    },
    models: {
      mmm:          { deployed: true,  last_calibrated: '2024-Q2', granularity: 'Monthly', confidence: 'LOW', note: 'Stale — needs recalibration' },
      pricing_tool: { deployed: false, last_calibrated: null, granularity: 'Manual', confidence: 'LOW' },
      dist_planner: { deployed: false, granularity: null, confidence: null },
    },
    team: { ds: 1, analysts: 2, backlog_items: 84, active_sprints: 1 },
  },

  Germany: {
    id: 'DE', flag: '🇩🇪', region: 'Europe (Central)',
    population: 84.0, gdp_pc: 51000, beer_consumption_pc: 84, cpi: 2.8, unemployment: 3.1,
    mt_share: 0.75, on_trade_share: 0.18, impulse_share: 0.07,
    premium_share: 0.22, heineken_share: 0.08,
    key_retailers: ['Rewe', 'Edeka', 'Aldi', 'Lidl'],
    baseline_weekly_cases: 22000,
    revenue_per_case: 2.95,
    extra_delivery_cost: 7200,
    delivery_lead_days: 5,
    data_availability: {
      pos:          { available: true,  freshness: 'Weekly (7-day lag)',  last_updated_days: 7,  coverage: 0.80 },
      atl:          { available: true,  freshness: 'Weekly',              last_updated_days: 2,  coverage: 0.92 },
      btl:          { available: false, freshness: 'Not available',       last_updated_days: null, coverage: 0 },
      pricing:      { available: true,  freshness: 'Weekly (3-day lag)',  last_updated_days: 3,  coverage: 0.82 },
      distribution: { available: true,  freshness: 'Manual (weekly)',     last_updated_days: 6,  coverage: 0.55 },
      macro:        { available: true,  freshness: 'Monthly',             last_updated_days: 22, coverage: 1.00 },
    },
    models: {
      mmm:          { deployed: true,  last_calibrated: '2025-Q4', granularity: 'Monthly', confidence: 'HIGH' },
      pricing_tool: { deployed: false, last_calibrated: null, granularity: null, confidence: null },
      dist_planner: { deployed: false, granularity: null, confidence: null },
    },
    team: { ds: 2, analysts: 3, backlog_items: 62, active_sprints: 2 },
  },

  Poland: {
    id: 'PL', flag: '🇵🇱', region: 'Europe (East)',
    population: 38.0, gdp_pc: 22000, beer_consumption_pc: 92, cpi: 4.1, unemployment: 3.4,
    mt_share: 0.62, on_trade_share: 0.28, impulse_share: 0.10,
    premium_share: 0.18, heineken_share: 0.32,
    key_retailers: ['Biedronka', 'Lidl', 'Kaufland', 'Carrefour'],
    baseline_weekly_cases: 7200,
    revenue_per_case: 2.40,
    extra_delivery_cost: 2800,
    delivery_lead_days: 5,
    data_availability: {
      pos:          { available: true,  freshness: 'Weekly (30-day lag)', last_updated_days: 30, coverage: 0.60 },
      atl:          { available: true,  freshness: 'Weekly',              last_updated_days: 3,  coverage: 0.85 },
      btl:          { available: true,  freshness: 'Sporadic (~30-day)', last_updated_days: 30, coverage: 0.40 },
      pricing:      { available: false, freshness: 'Not connected',       last_updated_days: null, coverage: 0 },
      distribution: { available: true,  freshness: 'Manual (2-week)',     last_updated_days: 14, coverage: 0.48 },
      macro:        { available: true,  freshness: 'Monthly',             last_updated_days: 18, coverage: 1.00 },
    },
    models: {
      mmm:          { deployed: false, last_calibrated: null, granularity: null, confidence: null },
      pricing_tool: { deployed: false, last_calibrated: null, granularity: null, confidence: null },
      dist_planner: { deployed: false, granularity: null, confidence: null },
    },
    team: { ds: 0, analysts: 2, backlog_items: 118, active_sprints: 0 },
  },

  Spain: {
    id: 'ES', flag: '🇪🇸', region: 'Europe (South)',
    population: 47.0, gdp_pc: 32000, beer_consumption_pc: 68, cpi: 3.8, unemployment: 11.5,
    mt_share: 0.58, on_trade_share: 0.35, impulse_share: 0.07,
    premium_share: 0.25, heineken_share: 0.28,
    key_retailers: ['Mercadona', 'Carrefour', 'Dia', 'El Corte Inglés'],
    baseline_weekly_cases: 8800,
    revenue_per_case: 3.05,
    extra_delivery_cost: 5500,
    delivery_lead_days: 4,
    data_availability: {
      pos:          { available: true,  freshness: 'Weekly (5-day lag)',  last_updated_days: 5,  coverage: 0.88 },
      atl:          { available: true,  freshness: 'Daily',               last_updated_days: 1,  coverage: 0.95 },
      btl:          { available: true,  freshness: 'Weekly',              last_updated_days: 4,  coverage: 0.70 },
      pricing:      { available: true,  freshness: 'Weekly (2-day lag)',  last_updated_days: 2,  coverage: 0.85 },
      distribution: { available: true,  freshness: 'Weekly',              last_updated_days: 3,  coverage: 0.72 },
      macro:        { available: false, freshness: 'National stats only', last_updated_days: 30, coverage: 0.50 },
    },
    models: {
      mmm:          { deployed: true,  last_calibrated: '2025-Q2', granularity: 'Monthly', confidence: 'MEDIUM' },
      pricing_tool: { deployed: true,  last_calibrated: '2025-Q4', granularity: 'Weekly',  confidence: 'HIGH' },
      dist_planner: { deployed: false, granularity: null, confidence: null },
    },
    team: { ds: 2, analysts: 3, backlog_items: 55, active_sprints: 1 },
  },

  Nigeria: {
    id: 'NG', flag: '🇳🇬', region: 'Africa',
    population: 220.0, gdp_pc: 2200, beer_consumption_pc: 12, cpi: 18.4, unemployment: 4.8,
    mt_share: 0.35, on_trade_share: 0.55, impulse_share: 0.10,
    premium_share: 0.45, heineken_share: 0.38,
    key_retailers: ['Shoprite', 'Park n Shop', 'Spar', 'Trade depots'],
    baseline_weekly_cases: 14500,
    revenue_per_case: 1.80,
    extra_delivery_cost: 1800,
    delivery_lead_days: 7,
    data_availability: {
      pos:          { available: true,  freshness: 'Weekly (10-day lag)', last_updated_days: 10, coverage: 0.45 },
      atl:          { available: true,  freshness: 'Weekly',              last_updated_days: 4,  coverage: 0.80 },
      btl:          { available: false, freshness: 'Not available',       last_updated_days: null, coverage: 0 },
      pricing:      { available: false, freshness: 'Not available',       last_updated_days: null, coverage: 0 },
      distribution: { available: true,  freshness: 'Sporadic (weekly)',   last_updated_days: 8,  coverage: 0.35 },
      macro:        { available: true,  freshness: 'Monthly (IMF)',       last_updated_days: 45, coverage: 0.90 },
    },
    models: {
      mmm:          { deployed: false, last_calibrated: null, granularity: null, confidence: null },
      pricing_tool: { deployed: false, last_calibrated: null, granularity: null, confidence: null },
      dist_planner: { deployed: false, granularity: null, confidence: null },
    },
    team: { ds: 0, analysts: 1, backlog_items: 203, active_sprints: 0 },
  },
};

// ── Current signals with realistic noise ─────────────────────────────────────
function generateSignals(marketName) {
  const m = MARKETS[marketName];
  const noise = (base, pct) => base * (1 + (R() - 0.5) * pct * 2);

  const retailer_detail = m.key_retailers.map((ret, i) => {
    const base_days = [6.1, 14.2, 22.4, 9.8][i] || noise(12, 0.3);
    const oos = parseFloat((noise(0.08, 0.3)).toFixed(3));
    return {
      retailer: ret,
      stock_days: parseFloat(noise(base_days, 0.12).toFixed(1)),
      oos_rate: oos,
      status: base_days < 8 ? 'AT RISK' : base_days < 14 ? 'WARNING' : 'OK',
    };
  });
  const avg_stock_days = parseFloat((retailer_detail.reduce((s, r) => s + r.stock_days, 0) / retailer_detail.length).toFixed(1));

  return {
    pos: {
      weekly_cases: Math.round(noise(m.baseline_weekly_cases, 0.08)),
      sell_out_rate: parseFloat(noise(0.82, 0.06).toFixed(2)),
      retailer_detail, avg_stock_days,
    },
    atl: {
      grp: Math.round(noise(312, 0.08)),
      sentiment: parseFloat(noise(0.62, 0.06).toFixed(2)),
      campaign_active: true,
    },
    btl: {
      activations: m.data_availability.btl.available ? Math.round(noise(38, 0.15)) : 0,
    },
    pricing: {
      shelf_price:        parseFloat(noise(2.18, 0.02).toFixed(2)),
      competitor_price:   2.02,
      price_vs_competitor: parseFloat(noise(1.08, 0.01).toFixed(2)),
      promo_depth:        parseFloat(noise(0.14, 0.15).toFixed(2)),
      promo_freq:         parseFloat(noise(0.22, 0.15).toFixed(2)),
    },
    distribution: {
      oos_rate:           parseFloat(noise(0.092, 0.20).toFixed(3)),
      numeric_dist:       parseFloat(noise(0.73, 0.05).toFixed(2)),
      otif:               parseFloat(noise(0.84, 0.04).toFixed(2)),
      avg_stock_days,
      delivery_lead_days: m.delivery_lead_days,
      extra_delivery_cost: m.extra_delivery_cost,
    },
    macro: {
      cci:          Math.round(noise(96, 0.04)),
      cpi:          parseFloat(noise(m.cpi, 0.05).toFixed(1)),
      summer_index: parseFloat(noise(1.08, 0.03).toFixed(2)),
    },
  };
}

// ── MMM output ────────────────────────────────────────────────────────────────
function generateMMM(marketName) {
  const m = MARKETS[marketName];
  if (!m.models.mmm.deployed) return { model_status: 'Not deployed', deployed: false };

  const N = (b, p) => parseFloat((b * (1 + (R() - 0.5) * p * 2)).toFixed(1));
  const pct = {
    base_volume:       { pct: 90.5, label: 'Base volume (no marketing)' },
    price_effect:      { pct: N(-8,  0.10), label: 'Price premium drag' },
    distribution_gain: { pct: N(12,  0.10), label: 'Distribution channel expansion (YTD)' },
    atl_contribution:  { pct: N(15,  0.08), label: 'ATL — Fresh Experience campaign' },
    btl_contribution:  { pct: N(3,   0.15), label: 'BTL activations' },
    seasonality:       { pct: N(5,   0.10), label: 'Summer seasonal index' },
    competitive:       { pct: N(-6,  0.12), label: 'Competitor promotional activity' },
    residual:          { pct: N(-7,  0.15), label: 'Unexplained residual (OOS? Competitive?)' },
  };
  const base4wk  = m.baseline_weekly_cases * 4;
  const contrib  = Object.values(pct).slice(1).reduce((s, d) => s + d.pct, 0);
  const predicted = Math.round(base4wk * (1 + contrib / 100));
  const actual    = Math.round(predicted * N(0.848, 0.02));
  const gap_pct   = parseFloat(((actual - predicted) / predicted * 100).toFixed(1));

  return {
    model_status: `Live — ${m.models.mmm.last_calibrated}`,
    model_version: m.models.mmm.last_calibrated,
    deployed: true,
    elasticities: { price: -1.4, distribution: 1.2, atl_grp: 0.003, btl_activation: 0.08 },
    volume_decomposition_pct: pct,
    predicted_4wk_cases: predicted,
    actual_4wk_cases:    actual,
    forecast_gap:        actual - predicted,
    forecast_gap_pct:    gap_pct,
    model_blind_spots: [
      'Real-time OOS (monthly granularity misses intra-week stockouts)',
      'Competitor flash promotions with < 2-week notice',
      'Distribution listing changes within month',
    ],
  };
}

// ── Pricing Tool output ───────────────────────────────────────────────────────
function generatePricingTool(marketName) {
  const m = MARKETS[marketName];
  if (!m.models.pricing_tool.deployed) return { tool_status: 'Not deployed', deployed: false };

  const N   = (b, p) => parseFloat((b * (1 + (R() - 0.5) * p * 2)).toFixed(2));
  const cur = N(2.18, 0.02);
  const opt = 2.05;
  const gap_pct  = parseFloat(((cur - opt) / opt * 100).toFixed(1));
  const elast    = -1.8;
  const drag_pct = parseFloat((gap_pct * Math.abs(elast) / 100).toFixed(1));

  return {
    tool_status: `Live`,
    deployed: true,
    current_shelf_price:       cur,
    optimal_shelf_price:       opt,
    competitor_price:          2.02,
    price_gap_pct:             gap_pct,
    elasticity_used:           elast,
    volume_drag_pct:           parseFloat((-drag_pct).toFixed(1)),
    expected_volume_uplift_pct: parseFloat((gap_pct * 0.9 * Math.abs(elast) / 100).toFixed(1)),
    recommended_action: `Reduce shelf price to €${opt} via promo mechanic`,
    promo_options: [
      { mechanic: '4-pack €7.99 (€2.00/unit)', uplift_pct: 15, cost_per_case: 0.18 },
      { mechanic: 'BOGOF for 4 weeks',          uplift_pct: 22, cost_per_case: 0.50 },
      { mechanic: 'Loyalty card 6% discount',   uplift_pct: 8,  cost_per_case: 0.12 },
    ],
  };
}

// ── Distribution Planner output ───────────────────────────────────────────────
function generateDistPlanner(marketName, signals) {
  const m = MARKETS[marketName];
  if (!m.models.dist_planner.deployed) {
    return { tool_status: 'Not deployed', deployed: false, oos_rate: signals.distribution.oos_rate, oos_volume_drag_pct: 0, avg_stock_days: signals.pos.avg_stock_days };
  }
  return {
    tool_status: 'Live — daily feed',
    deployed: true,
    oos_rate: signals.distribution.oos_rate,
    oos_volume_drag_pct: parseFloat((-signals.distribution.oos_rate * 100).toFixed(1)),
    avg_stock_days: signals.pos.avg_stock_days,
    numeric_distribution: signals.distribution.numeric_dist,
    otif: signals.distribution.otif,
    retailer_status: signals.pos.retailer_detail,
    mmm_inconsistency: true,
    note: 'MMM captures historical channel expansion (positive); this captures current OOS (negative). Different time horizons — both correct.',
  };
}

// ── Master data generator ─────────────────────────────────────────────────────
function generateAllData(marketName) {
  const profile  = MARKETS[marketName];
  const signals  = generateSignals(marketName);
  return {
    profile, signals, lead_lag: LEAD_LAG,
    mmm:          generateMMM(marketName),
    pricing_tool: generatePricingTool(marketName),
    dist_planner: generateDistPlanner(marketName, signals),
  };
}

// ── Region overview ───────────────────────────────────────────────────────────
function getRegionOverview() {
  return Object.entries(MARKETS).map(([name, m]) => ({
    name, flag: m.flag, region: m.region,
    data_scores: {
      pos:          scoreData(m.data_availability.pos),
      atl:          scoreData(m.data_availability.atl),
      btl:          scoreData(m.data_availability.btl),
      pricing:      scoreData(m.data_availability.pricing),
      distribution: scoreData(m.data_availability.distribution),
      macro:        scoreData(m.data_availability.macro),
    },
    model_scores: {
      mmm:          scoreModel(m.models.mmm),
      pricing_tool: scoreModel(m.models.pricing_tool),
      dist_planner: scoreModel(m.models.dist_planner),
    },
    team: m.team,
    data_quality_pct:  Math.round(Object.values(m.data_availability).filter(d => d.available).length / 6 * 100),
    model_coverage_pct: Math.round(Object.values(m.models).filter(mo => mo.deployed).length / 3 * 100),
  }));
}

function scoreData(d) {
  if (!d.available || d.last_updated_days === null) return 'none';
  if (d.last_updated_days <= 2) return 'good';
  if (d.last_updated_days <= 7) return 'partial';
  return 'poor';
}

function scoreModel(m) {
  if (!m.deployed) return 'none';
  if (m.confidence === 'HIGH') return 'good';
  if (m.confidence === 'MEDIUM') return 'partial';
  return 'poor';
}

module.exports = { MARKETS, LEAD_LAG, generateAllData, generateSignals, generateMMM, generatePricingTool, generateDistPlanner, getRegionOverview };
