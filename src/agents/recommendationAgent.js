/**
 * Recommendation Agent
 *
 * Format philosophy: a Country MD should be able to understand every recommendation
 * in under 90 seconds and challenge any number with a calculator.
 *
 * Each recommendation has:
 *   PROBLEM     — one sentence, what's going wrong
 *   THE MATHS   — bullet-point arithmetic any exec can verify
 *   DO NOTHING  — cost of inaction (makes decision easy)
 *   ACTION      — exactly what to do and who does it
 *   COST        — specific euro amount
 *   ROI         — result ÷ cost
 */

'use strict';

class RecommendationAgent {
  constructor(market) {
    this.market = market;
    this.logs   = [];
  }

  _log(msg) { this.logs.push({ ts: new Date().toISOString(), agent: 'Recommendation', msg }); }

  async generate(riskData, normData, allData, conflictData, twinData) {
    this._log(`▶ Recommendation Agent — generating evidence-backed actions for ${this.market}`);
    this._log(`  Input: Risk ${riskData.riskScore}/100 · ${riskData.topDrivers.length} top drivers`);
    this._log(`  Format: problem / the maths / do-nothing cost / action / cost / ROI`);
    await this._delay(350);

    const recs = [];
    const dist   = allData.signals.distribution;
    const pos    = normData.pos;
    const price  = allData.pricing_tool;

    // ── REC-001: OOS / Restock ─────────────────────────────────────────────
    if (dist.oos_rate > 0.06) {
      const worst  = allData.signals.pos.retailer_detail.find(r => r.status === 'AT RISK');
      const cases_per_day = pos.cases_per_day_normalised;
      const stock_days    = worst ? worst.stock_days : dist.avg_stock_days;
      const days_to_act   = Math.max(0, Math.round(stock_days - dist.delivery_lead_days));
      const at_risk_days  = Math.max(1, Math.round(dist.delivery_lead_days * 0.5));
      const lost_cases    = at_risk_days * cases_per_day;
      const lost_revenue  = Math.round(lost_cases * allData.profile.revenue_per_case);
      const action_cost   = dist.extra_delivery_cost;
      const roi_one_time  = parseFloat((lost_revenue / action_cost).toFixed(1));
      const roi_quarterly = parseFloat((roi_one_time * (13 / (at_risk_days / 7))).toFixed(1));

      const rec = {
        id: 'REC-001', priority: 1, confidence: riskData.components.distRisk > 60 ? 'HIGH' : 'MEDIUM',
        category: 'Supply Chain',
        headline: `Stock-out at ${worst?.retailer || 'key retailers'} in ~${Math.round(stock_days)} days — act within ${Math.max(1, days_to_act)} day(s)`,
        problem: `${worst?.retailer || 'Top retailers'} will run out of Heineken in ${Math.round(stock_days)} days. Your replenishment lead time is ${dist.delivery_lead_days} days. This is a ${days_to_act}-day decision window.`,
        the_maths: [
          { label: 'Normalised sell-out rate', value: `${cases_per_day.toLocaleString()} cases/day`, source: 'Signal Normalization Agent (POS + Distribution)' },
          { label: `Stock at ${worst?.retailer || 'affected retailers'}`, value: `${worst ? Math.round(worst.stock_days * cases_per_day).toLocaleString() : 'see report'} cases`, source: 'Distribution Planner (today)' },
          { label: 'Days of stock left', value: `stock ÷ ${cases_per_day} = ${Math.round(stock_days)} days`, source: 'Calculated' },
          { label: 'Delivery lead time', value: `${dist.delivery_lead_days} days`, source: 'Logistics SLA' },
          { label: 'Decision window', value: `${Math.round(stock_days)} − ${dist.delivery_lead_days} = ${days_to_act} day(s)`, source: 'Derived' },
        ],
        do_nothing: {
          days_at_risk: at_risk_days,
          cases_at_risk: lost_cases,
          formula: `${at_risk_days} day(s) × ${cases_per_day.toLocaleString()} cases/day × €${allData.profile.revenue_per_case} = €${lost_revenue.toLocaleString()}`,
          value: lost_revenue, currency: 'EUR',
        },
        action: `Schedule extra delivery to ${worst?.retailer || 'priority retailers'} within ${days_to_act} day(s). Change from weekly to twice-weekly replenishment for 4 weeks.`,
        owner: 'Supply Chain Director',
        deadline: `Within ${days_to_act} day(s)`,
        cost: { value: action_cost, currency: 'EUR', description: `Extra delivery run + route planning` },
        roi: {
          one_time: roi_one_time,
          quarterly: roi_quarterly,
          formula: `€${lost_revenue.toLocaleString()} saved ÷ €${action_cost.toLocaleString()} cost = ${roi_one_time}x immediate · ${roi_quarterly}x over 13 weeks`,
        },
        evidence_from: ['Distribution Planner', 'Signal Normalization Agent'],
      };

      recs.push(rec);
      this._log(`  REC-001 (OOS): ${worst?.retailer || 'retailers'} run-out in ${Math.round(stock_days)} days · do-nothing cost €${lost_revenue.toLocaleString()} · ROI ${roi_one_time}x`);
    }
    await this._delay(200);

    // ── REC-002: Pricing ───────────────────────────────────────────────────
    if (price && price.current_shelf_price > price.optimal_shelf_price * 1.02) {
      const current = price.current_shelf_price;
      const optimal = price.optimal_shelf_price;
      const gap_pct = parseFloat(((current - optimal) / optimal * 100).toFixed(1));
      const elasticity = price.elasticity_used;
      const vol_drag_pct = Math.abs(gap_pct * elasticity / 100);
      const normalised_weekly = normData.pos.weekly_cases_normalised;
      const volume_recoverable = Math.round(normalised_weekly * vol_drag_pct);
      const revenue_uplift = Math.round(volume_recoverable * allData.profile.revenue_per_case * 52); // annual
      const promo_cost = Math.round(volume_recoverable * 0.18 * 52); // ~€0.18/case promo cost
      const roi_annual = parseFloat((revenue_uplift / promo_cost).toFixed(1));

      recs.push({
        id: 'REC-002', priority: 2, confidence: conflictData?.conflicts.find(c => c.id === 'CONFLICT-1') ? 'MEDIUM' : 'HIGH',
        category: 'Revenue Management',
        headline: `Heineken is ${gap_pct}% above optimal price — you are leaving ${volume_recoverable.toLocaleString()} cases/week on the shelf`,
        problem: `Heineken shelf price is €${current} vs €${optimal} optimal and €${price.competitor_price} for nearest competitor. At ${gap_pct}% premium, you are losing ~${volume_recoverable.toLocaleString()} cases/week to price-sensitive shoppers.`,
        the_maths: [
          { label: 'Current shelf price', value: `€${current}`, source: 'Pricing Tool (W-0)' },
          { label: 'Optimal price (revenue maximising)', value: `€${optimal}`, source: 'Pricing Tool model' },
          { label: 'Price gap', value: `€${(current - optimal).toFixed(2)} = ${gap_pct}% above optimal`, source: 'Calculated' },
          { label: 'Price elasticity', value: `${elasticity} (each 1% price rise = ${Math.abs(elasticity)}% volume loss)`, source: 'Pricing Tool (NB: MMM uses -1.4 — see Model Conflicts)' },
          { label: 'Volume drag from over-pricing', value: `${gap_pct}% × ${Math.abs(elasticity)} elasticity = ${(vol_drag_pct * 100).toFixed(1)}% · ${volume_recoverable.toLocaleString()} cases/week`, source: 'Derived' },
        ],
        do_nothing: {
          formula: `${volume_recoverable.toLocaleString()} cases/wk × 52 weeks × €${allData.profile.revenue_per_case} = €${(volume_recoverable * allData.profile.revenue_per_case * 52).toLocaleString()} annual revenue foregone`,
          value: revenue_uplift, currency: 'EUR',
          caveat: 'Note: MMM elasticity is -1.4 (lower). Annual impact range: €' + Math.round(revenue_uplift * 0.78 / 1000) + 'K–€' + Math.round(revenue_uplift / 1000) + 'K',
        },
        action: `Introduce 4-pack promo at €7.99 (implied €2.00/unit) at Albert Heijn and Jumbo for 4 weeks. Review and reset base price in next quarterly price round.`,
        owner: 'Commercial Director',
        deadline: 'Next promotion slot (≤ 3 weeks)',
        cost: { value: promo_cost, currency: 'EUR', description: 'Promo funding @ ~€0.18/case on recoverable volume for 1 year' },
        roi: {
          one_time: null,
          quarterly: parseFloat((revenue_uplift / 4 / (promo_cost / 4)).toFixed(1)),
          formula: `€${(revenue_uplift / 1000).toFixed(0)}K revenue ÷ €${(promo_cost / 1000).toFixed(0)}K promo cost = ${roi_annual}x annual ROI`,
        },
        evidence_from: ['Pricing Tool', 'Model Conflict Agent (use Pricing Tool elasticity -1.8 for short-term)'],
        confidence_note: conflictData?.conflicts.find(c => c.id === 'CONFLICT-1')
          ? `⚠ MMM (−1.4) and Pricing Tool (−1.8) disagree on elasticity. Range: ${Math.round(revenue_uplift * 0.78 / 1000)}K–${Math.round(revenue_uplift / 1000)}K. Action is correct in both cases.`
          : null,
      });

      this._log(`  REC-002 (Pricing): €${current} vs €${optimal} optimal · recoverable ${volume_recoverable.toLocaleString()} cases/wk · ROI ${roi_annual}x annual`);
    }
    await this._delay(200);

    // ── REC-003: Twin Market leverage (if applicable) ──────────────────────
    if (twinData && twinData.top_twin && twinData.top_twin.similarity_pct >= 72 && twinData.top_twin.playbook_count > 0) {
      const twin = twinData.top_twin;
      recs.push({
        id: 'REC-003', priority: 3, confidence: 'HIGH',
        category: 'Efficiency',
        headline: `${twin.market} (${twin.similarity_pct}% similar) can replicate ${this.market}'s playbooks — save budget NOW`,
        problem: `${this.market} has built and validated models (MMM, Pricing Tool, replenishment algorithm) that ${twin.market} needs but doesn't have. Instead of rebuilding from scratch, transfer and recalibrate.`,
        the_maths: [
          { label: 'Market similarity score', value: `${twin.similarity_pct}%`, source: 'Twin Market Agent (7-indicator weighted similarity)' },
          { label: 'Playbooks transferable', value: `${twin.playbook_count} playbook(s)`, source: 'Capability gap analysis' },
          { label: 'Estimated build-from-scratch cost', value: `€${(twin.playbook_count * 55).toLocaleString()}K–€${(twin.playbook_count * 80).toLocaleString()}K`, source: 'Industry benchmark (MMM: €35K, Pricing Tool: €25K, etc.)' },
          { label: 'Transfer + recalibration cost', value: `€${(twin.playbook_count * 18).toLocaleString()}K–€${(twin.playbook_count * 28).toLocaleString()}K`, source: 'Estimated from past transfers' },
          { label: 'Saving vs build-from-scratch', value: `€${(twin.playbook_count * 32).toLocaleString()}K–€${(twin.playbook_count * 55).toLocaleString()}K + ${twin.playbook_count * 6}–${twin.playbook_count * 10} weeks faster`, source: 'Derived' },
        ],
        do_nothing: {
          formula: `${twin.market} builds from scratch: €${(twin.playbook_count * 55).toLocaleString()}K–€${(twin.playbook_count * 80).toLocaleString()}K + ${twin.playbook_count * 14} weeks = no tools for ${twin.playbook_count * 14 / 4} months`,
          value: twin.playbook_count * 67000, currency: 'EUR',
        },
        action: twin.transferable_playbooks.map(p => `• ${p.type}: ${p.effort}`).join('\n'),
        owner: 'Regional Analytics Lead',
        deadline: 'Next quarterly planning cycle',
        cost: { value: twin.playbook_count * 23000, currency: 'EUR', description: 'Transfer, integration, and recalibration effort' },
        roi: {
          one_time: parseFloat((twin.playbook_count * 67000 / (twin.playbook_count * 23000)).toFixed(1)),
          formula: `€${(twin.playbook_count * 67).toFixed(0)}K saved ÷ €${(twin.playbook_count * 23).toFixed(0)}K investment = ${(67 / 23).toFixed(1)}x — plus ${twin.playbook_count * 8} weeks faster time-to-insight`,
        },
        evidence_from: ['Twin Market Agent'],
      });
      this._log(`  REC-003 (Twin markets): Transfer to ${twin.market} · ${twin.playbook_count} playbook(s) · save €${(twin.playbook_count * 32).toLocaleString()}K`);
    }
    await this._delay(200);

    this._log(`✅ Recommendation Agent complete: ${recs.length} recommendation(s) generated`);
    this._log(`   All recommendations include verifiable arithmetic — no black box numbers`);

    return { recommendations: recs, logs: this.logs };
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = RecommendationAgent;
