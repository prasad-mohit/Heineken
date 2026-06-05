/**
 * Sample data generator for Heineken Minority Report POC
 * Covers: POS, ATL, BTL, Pricing & Promo, Distribution, Macro
 */

const MARKETS = {
  Netherlands: {
    id: 'NL',
    flag: '🇳🇱',
    channel: 'Modern Trade',
    currency: 'EUR',
    baseline_weekly_volume: 42000,  // cases/week
    sku_count: 18,
    key_retailers: ['Albert Heijn', 'Jumbo', 'Lidl', 'Plus'],
  },
  Nigeria: {
    id: 'NG',
    flag: '🇳🇬',
    channel: 'Modern Trade',
    currency: 'NGN',
    baseline_weekly_volume: 61000,
    sku_count: 12,
    key_retailers: ['Shoprite', 'Spar', 'Grocery Bazaar', 'Prince Ebeano'],
  },
};

function gaussian(mean, std) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function getSampleMarkets() {
  return Object.entries(MARKETS).map(([name, m]) => {
    const riskScore = Math.round(gaussian(62, 12));
    return {
      name,
      ...m,
      riskScore: clamp(riskScore, 0, 100),
      weeklyVolume: Math.round(gaussian(m.baseline_weekly_volume * 0.93, m.baseline_weekly_volume * 0.05)),
      stockCoverageDays: Math.round(gaussian(18, 4)),
      promoLift: parseFloat((gaussian(1.08, 0.12)).toFixed(2)),
      distributionScore: Math.round(gaussian(74, 8)),
      competitiveIndex: parseFloat((gaussian(0.72, 0.09)).toFixed(2)),
      lastUpdated: new Date().toISOString(),
    };
  });
}

function getRiskTrend(market) {
  const weeks = 12;
  const data = [];
  let risk = 45;
  for (let w = weeks; w >= 0; w--) {
    const label = `W-${w}`;
    risk = clamp(risk + gaussian(1.8, 4), 20, 95);
    data.push({ week: label, riskScore: Math.round(risk) });
  }
  return { market, trend: data };
}

function generatePosData(marketName) {
  const m = MARKETS[marketName];
  return m.key_retailers.map(r => ({
    retailer: r,
    weeklyVolume: Math.round(gaussian(m.baseline_weekly_volume / m.key_retailers.length, 800)),
    stockOnHand: Math.round(gaussian(2200, 400)),
    stockCoverageDays: Math.round(gaussian(18, 5)),
    sellOutRate: parseFloat((gaussian(0.87, 0.08)).toFixed(2)),
    dataFreshness: 'W-1 (7 day lag)',
    quality: 'HIGH',
  }));
}

function generateAtlData(marketName) {
  return {
    market: marketName,
    campaignActive: Math.random() > 0.4,
    campaignName: 'Fresh Experience 2026',
    grp: Math.round(gaussian(340, 60)),         // Gross Rating Points
    brandAwareness: parseFloat((gaussian(0.71, 0.05)).toFixed(2)),
    socialMentions: Math.round(gaussian(12400, 2000)),
    sentimentScore: parseFloat((gaussian(0.68, 0.09)).toFixed(2)),
    dataFreshness: 'W-0 (weekly)',
    quality: 'HIGH',
  };
}

function generateBtlData(marketName) {
  return {
    market: marketName,
    inStoreActivations: Math.round(gaussian(38, 10)),
    promoterDays: Math.round(gaussian(120, 25)),
    samplingUnits: Math.round(gaussian(8400, 1200)),
    tradeEvents: Math.round(gaussian(4, 2)),
    dataFreshness: 'Sporadic (last 3 weeks)',
    quality: 'MEDIUM',
    note: 'BTL data is manually reported; lag up to 21 days',
  };
}

function generatePricingData(marketName) {
  return {
    market: marketName,
    avgShelfPrice: parseFloat((gaussian(2.15, 0.22)).toFixed(2)),
    priceVsCompetitor: parseFloat((gaussian(1.04, 0.06)).toFixed(2)), // >1 = Heineken more expensive
    promoDepth: parseFloat((gaussian(0.18, 0.05)).toFixed(2)),
    promoFrequency: parseFloat((gaussian(0.31, 0.08)).toFixed(2)),
    promoLift: parseFloat((gaussian(1.11, 0.14)).toFixed(2)),
    elasticity: parseFloat((gaussian(-1.8, 0.3)).toFixed(2)),
    dataFreshness: 'W-1 (weekly)',
    quality: 'HIGH',
  };
}

function generateDistributionData(marketName) {
  const m = MARKETS[marketName];
  return {
    market: marketName,
    numericDistribution: parseFloat((gaussian(0.74, 0.06)).toFixed(2)),
    weightedDistribution: parseFloat((gaussian(0.81, 0.05)).toFixed(2)),
    outOfStockRate: parseFloat((gaussian(0.09, 0.03)).toFixed(2)),
    deliveryOnTime: parseFloat((gaussian(0.88, 0.07)).toFixed(2)),
    skuAvailability: parseFloat((gaussian(0.83, 0.06)).toFixed(2)),
    dataFreshness: 'Daily',
    quality: 'HIGH',
  };
}

function generateMacroData(marketName) {
  return {
    market: marketName,
    gdpGrowthQoQ: parseFloat((gaussian(0.6, 0.3)).toFixed(2)),
    cpi: parseFloat((gaussian(3.2, 0.8)).toFixed(2)),
    consumerConfidenceIndex: Math.round(gaussian(98, 8)),
    unemploymentRate: parseFloat((gaussian(4.1, 0.6)).toFixed(2)),
    summerSeasonIndex: parseFloat((gaussian(1.12, 0.1)).toFixed(2)),
    dataFreshness: 'Monthly',
    quality: 'LOW',
    note: 'Macro data refreshes monthly; seasonal adjustments applied',
  };
}

function generateAllData(marketName) {
  return {
    pos: generatePosData(marketName),
    atl: generateAtlData(marketName),
    btl: generateBtlData(marketName),
    pricing: generatePricingData(marketName),
    distribution: generateDistributionData(marketName),
    macro: generateMacroData(marketName),
  };
}

module.exports = {
  MARKETS,
  getSampleMarkets,
  getRiskTrend,
  generateAllData,
  generatePosData,
  generateAtlData,
  generateBtlData,
  generatePricingData,
  generateDistributionData,
  generateMacroData,
};
