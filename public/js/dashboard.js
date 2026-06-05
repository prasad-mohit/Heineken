/* global io */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  market: 'Netherlands',
  running: false,
  lastResult: null,
};

// ── Socket.IO ──────────────────────────────────────────────────────────────
const socket = io({ transports: ['polling', 'websocket'] });

socket.on('connect',    () => console.log('[WS] Connected:', socket.id));
socket.on('disconnect', () => setStatus('idle'));

socket.on('region_overview', ({ markets }) => {
  renderRegionGrid(markets);
});

socket.on('phase', ({ phase, label, status }) => {
  updatePipelineStep(phase, status === 'running' ? 'active' : 'done');
  if (status === 'running') setStatus('running', label);
  if (status === 'done')    setStatus('done', 'Complete');
});

socket.on('normalization_complete', data => {
  renderSignalTable(data.signal_report);
  renderLeadLagGrid(data);
  // KPI: signal quality
  const highConf = data.signal_report.filter(s => s.confidence === 'HIGH').length;
  const total    = data.signal_report.length;
  setKpi('kpiSigValue', `${highConf}/${total}`, highConf >= 4 ? 'kpi-green' : 'kpi-orange');
  setKpi('kpiSigSub', `signals at HIGH confidence`, '');
});

socket.on('conflicts_complete', data => {
  renderConflicts(data);
  setKpi('kpiConflictValue', data.conflicts.length.toString(),
    data.conflicts.length >= 2 ? 'kpi-red' : 'kpi-orange');
  setKpi('kpiConflictSub',
    `${data.conflicts.filter(c => c.severity === 'HIGH').length} critical`, '');
});

socket.on('twin_complete', data => {
  renderTwins(data);
  const top = data.top_twin;
  if (top) {
    setKpi('kpiTwinValue', `${top.similarity_pct}%`, 'kpi-green');
    setKpi('kpiTwinSub', top.market, '');
  }
});

socket.on('risk_complete', data => {
  renderRiskGauge(data.riskScore, data.severity);
  renderRiskDrivers(data);
  const cls = data.riskScore >= 75 ? 'kpi-red' : data.riskScore >= 55 ? 'kpi-orange' : 'kpi-green';
  setKpi('kpiRiskValue', `${data.riskScore}`, cls);
  setKpi('kpiRiskSev', data.severity, '');
});

socket.on('recommendations_complete', data => {
  renderRecommendations(data.recommendations);
  setKpi('kpiRecValue', data.recommendations.length.toString(),
    data.recommendations.length > 0 ? 'kpi-orange' : 'kpi-green');
});

socket.on('alerts_complete', data => {
  // Alerts are noted in log — no separate panel
});

socket.on('logs', ({ agent, logs }) => {
  appendLogs(agent, logs);
});

socket.on('pipeline_error', ({ message }) => {
  setStatus('error', 'Error');
  appendLog('System', `Pipeline error: ${message}`, 'agent-risk');
});

// ── Run button ──────────────────────────────────────────────────────────────
document.getElementById('runBtn').addEventListener('click', () => {
  if (state.running) return;
  state.market = document.getElementById('marketSelect').value;
  state.running = true;

  // Reset UI
  resetPipeline();
  clearSections();
  document.getElementById('selectedMarketLabel').textContent = marketFlag(state.market) + ' ' + state.market;
  document.getElementById('runBtn').classList.add('running');
  document.getElementById('runLabel').textContent = 'Running…';

  socket.emit('run_pipeline', { market: state.market });
});

document.getElementById('marketSelect').addEventListener('change', e => {
  document.getElementById('selectedMarketLabel').textContent = marketFlag(e.target.value) + ' ' + e.target.value;
});

document.getElementById('clearLogBtn').addEventListener('click', () => {
  const log = document.getElementById('agentLog');
  log.innerHTML = '<div class="log-placeholder">Log cleared.</div>';
});

// ── Status helpers ──────────────────────────────────────────────────────────
function setStatus(type, label) {
  const badge = document.getElementById('statusBadge');
  badge.className = `status-badge status-${type}`;
  badge.textContent = label || type.charAt(0).toUpperCase() + type.slice(1);

  if (type !== 'running') {
    state.running = false;
    const btn = document.getElementById('runBtn');
    btn.classList.remove('running');
    document.getElementById('runLabel').textContent = 'Run Pipeline';
  }
}

function updatePipelineStep(phase, status) {
  const el = document.getElementById(`ps-${phase}`);
  if (!el) return;
  el.className = `pipe-step ${status}`;
}

function resetPipeline() {
  document.querySelectorAll('.pipe-step').forEach(el => {
    el.className = 'pipe-step';
  });
  setStatus('running', 'Starting…');
}

function clearSections() {
  ['signalsTableWrap', 'conflictsWrap', 'twinsWrap', 'recsWrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="placeholder-msg">Running…</div>';
  });
  ['kpiRiskValue', 'kpiSigValue', 'kpiConflictValue', 'kpiTwinValue', 'kpiRecValue'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = '—'; el.className = 'kpi-value kpi-neutral'; }
  });
  document.getElementById('riskDriversList').innerHTML = '<div class="rd-placeholder">Computing…</div>';
  document.getElementById('reconciledSection').style.display = 'none';
  document.getElementById('agentLog').innerHTML = '';
  // Reset gauge
  const arc = document.getElementById('gaugeArc');
  if (arc) { arc.setAttribute('stroke-dashoffset', '283'); }
  document.getElementById('gaugeText').textContent = '—';
  document.getElementById('gaugeSevText').textContent = 'Computing…';
}

function setKpi(id, value, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  if (cls) el.className = `kpi-value ${cls}`;
}

// ── Log ──────────────────────────────────────────────────────────────────────
function appendLogs(agent, logs) {
  const agentClassMap = {
    SignalNormalization: 'agent-signal',
    ModelConflict:       'agent-conflict',
    TwinMarket:          'agent-twin',
    RiskDetection:       'agent-risk',
    Recommendation:      'agent-rec',
    Alert:               'agent-signal',
    System:              '',
  };
  const cls = agentClassMap[agent] || '';
  const el = document.getElementById('agentLog');
  const placeholder = el.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  logs.forEach(entry => {
    const div = document.createElement('div');
    div.className = `log-entry ${cls}`;
    div.textContent = entry.msg;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  });
}
function appendLog(agent, msg, cls) {
  appendLogs(agent, [{ msg }]);
}

// ── Render: Signal Table ──────────────────────────────────────────────────────
function renderSignalTable(report) {
  if (!report || !report.length) return;
  const wrap = document.getElementById('signalsTableWrap');
  const rows = report.map(s => {
    const stalenessClass = !s.stale ? 'badge-fresh' : s.staleness_days > 14 ? 'badge-stale' : 'badge-partial';
    const stalenessLabel = !s.stale ? 'Fresh' : s.staleness_days > 14 ? `${s.staleness_days}d stale` : `${s.staleness_days}d`;
    const changeHtml = s.change_pct === 0
      ? `<span class="change-flat">—</span>`
      : s.direction === 'DOWN'
        ? `<span class="change-down">▼ ${Math.abs(s.change_pct)}%</span>`
        : `<span class="change-up">▲ ${s.change_pct}%</span>`;
    const confClass = s.confidence === 'HIGH' ? 'badge-high' : s.confidence === 'MEDIUM' ? 'badge-medium' : 'badge-low';
    return `
      <tr>
        <td><strong>${s.source}</strong></td>
        <td>${s.raw_label}</td>
        <td><span class="badge ${stalenessClass}">${stalenessLabel}</span></td>
        <td>${s.lead_indicator}</td>
        <td style="font-family:var(--mono);font-size:12px">${s.normalised_label}</td>
        <td>${changeHtml}</td>
        <td><span class="badge ${confClass}">${s.confidence}</span></td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Signal</th><th>Raw Value</th><th>Staleness</th>
          <th>Lead Indicator Used</th><th>Normalised Estimate</th>
          <th>Change</th><th>Confidence</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Render: Lead-Lag Grid ─────────────────────────────────────────────────────
function renderLeadLagGrid(data) {
  const LEAD_LAG_STATIC = [
    { pair: 'Distribution → POS', lag: '3.5 days', correlation: '0.85', beta: '-1.8', n_weeks: 52, desc: '1pp increase in OOS rate → -1.8% volume decline within 3–4 days' },
    { pair: 'ATL (GRP) → POS',    lag: '2.5 weeks', correlation: '0.72', beta: '+0.045', n_weeks: 104, desc: '10 additional GRP → +0.45% volume lift after ~2.5 weeks' },
    { pair: 'Pricing → POS',      lag: '0.8 weeks', correlation: '-0.68', beta: '-1.4', n_weeks: 78, desc: '1% price increase → -1.4% volume decline within ~1 week' },
    { pair: 'BTL → POS',          lag: '1.2 weeks', correlation: '0.58', beta: '+0.8', n_weeks: 52, desc: '10 BTL activations → +0.8% volume lift after 1–2 weeks' },
    { pair: 'Macro → POS',        lag: '4.0 weeks', correlation: '0.41', beta: '+0.6', n_weeks: 104, desc: '1-point CCI improvement → +0.6% volume lift after ~4 weeks' },
  ];
  const grid = document.getElementById('leadLagGrid');
  grid.innerHTML = LEAD_LAG_STATIC.map(ll => `
    <div class="ll-card">
      <div class="ll-pair">${ll.pair}</div>
      <div class="ll-stats">
        <div class="ll-stat"><span class="ll-stat-label">Lag</span><span class="ll-stat-value">${ll.lag}</span></div>
        <div class="ll-stat"><span class="ll-stat-label">r</span><span class="ll-stat-value">${ll.correlation}</span></div>
        <div class="ll-stat"><span class="ll-stat-label">Beta (β)</span><span class="ll-stat-value">${ll.beta}</span></div>
        <div class="ll-stat"><span class="ll-stat-label">History</span><span class="ll-stat-value">${ll.n_weeks}w</span></div>
      </div>
      <div class="ll-desc">${ll.desc}</div>
    </div>`).join('');
}

// ── Render: Model Conflicts ───────────────────────────────────────────────────
function renderConflicts(data) {
  // Tool columns
  if (data.allData) {
    const m = data.allData.mmm;
    const p = data.allData.pricing_tool;
    const d = data.allData.dist_planner;
    document.getElementById('tcMMMStatus').textContent = m.model_status || '—';
    document.getElementById('tcPTStatus').textContent  = p.tool_status  || '—';
    document.getElementById('tcDPStatus').textContent  = d.tool_status  || '—';
  }

  // Conflict cards
  const wrap = document.getElementById('conflictsWrap');
  if (!data.conflicts || !data.conflicts.length) {
    wrap.innerHTML = '<div class="placeholder-msg">No significant model conflicts detected.</div>';
    return;
  }

  wrap.innerHTML = data.conflicts.map(c => `
    <div class="conflict-card sev-${c.severity}">
      <div class="conflict-header">
        <span class="conflict-id">${c.id}</span>
        <span class="conflict-dim">${c.dimension}</span>
        <span class="badge badge-conflict">${c.severity}</span>
        <span class="badge badge-none">${c.divergence_pct}% divergence</span>
      </div>
      <div class="conflict-body">
        <div class="conflict-row">
          <span class="conflict-row-label">MMM says</span>
          <span class="conflict-row-val">${c.mmm_says}</span>
        </div>
        <div class="conflict-row">
          <span class="conflict-row-label">${c.other_tool} says</span>
          <span class="conflict-row-val val-conflict">${c.other_tool_says}</span>
        </div>
        <div class="conflict-row">
          <span class="conflict-row-label">Impact</span>
          <span class="conflict-row-val">${c.practical_impact}</span>
        </div>
        <div class="conflict-resolution">
          <strong>Resolution:</strong> ${c.resolution} <br/>
          <strong>Trust:</strong> ${c.trust_winner}
        </div>
      </div>
    </div>`).join('');

  // Alignments
  if (data.alignments && data.alignments.length) {
    wrap.innerHTML += `
      <div class="alignments-section">
        <div class="align-title">✓ Where all tools agree</div>
        ${data.alignments.map(a => `
          <div class="align-item">
            <span class="align-check">✓</span>
            <span><strong>${a.dimension}:</strong> ${a.note}</span>
          </div>`).join('')}
      </div>`;
  }

  // Reconciled
  if (data.reconciled_priority && data.reconciled_priority.length) {
    const sec = document.getElementById('reconciledSection');
    sec.style.display = 'block';
    document.getElementById('reconciledList').innerHTML = data.reconciled_priority.map(r => `
      <div class="rec-priority-item">
        <div class="rp-rank">Priority ${r.rank}</div>
        <div class="rp-action">${r.action}</div>
        <div class="rp-driver">Source: ${r.driver}</div>
        <div class="rp-rationale">${r.rationale}</div>
      </div>`).join('');
  }
}

// ── Render: Region Grid ───────────────────────────────────────────────────────
function renderRegionGrid(markets) {
  const grid = document.getElementById('regionGrid');
  if (!markets || !markets.length) return;

  grid.innerHTML = markets.map(m => {
    const dataDots = Object.entries(m.data_scores).map(([key, score]) =>
      `<div class="dot-item"><div class="dot dot-${score}"></div><span>${key}</span></div>`).join('');
    const modelDots = Object.entries(m.model_scores).map(([key, score]) =>
      `<div class="dot-item"><div class="dot dot-${score}"></div><span>${key.replace('_', ' ')}</span></div>`).join('');

    return `
      <div class="mkt-card">
        <div class="mkt-header">
          <div class="mkt-flag">${m.flag}</div>
          <div>
            <div class="mkt-name">${m.name}</div>
            <div class="mkt-region">${m.region}</div>
          </div>
          <div class="mkt-scores">
            <div class="mkt-pct" title="Data coverage">Data ${m.data_quality_pct}%</div>
            <div class="mkt-pct" title="Model coverage" style="color:var(--green)">Models ${m.model_coverage_pct}%</div>
          </div>
        </div>
        <div class="mkt-body">
          <div class="mkt-section">
            <div class="mkt-sec-label">Data Availability</div>
            <div class="dot-row">${dataDots}</div>
          </div>
          <div class="mkt-section">
            <div class="mkt-sec-label">Model Deployment</div>
            <div class="dot-row">${modelDots}</div>
          </div>
          <div class="mkt-section">
            <div class="mkt-sec-label">Team</div>
            <div class="team-row">
              <div class="team-stat"><span class="team-stat-n">${m.team.ds}</span><span class="team-stat-l">Data Scientists</span></div>
              <div class="team-stat"><span class="team-stat-n">${m.team.analysts}</span><span class="team-stat-l">Analysts</span></div>
              <div class="team-stat backlog"><span class="team-stat-n">${m.team.backlog_items}</span><span class="team-stat-l">Backlog items</span></div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Render: Risk Gauge ────────────────────────────────────────────────────────
function renderRiskGauge(score, severity) {
  const arc = document.getElementById('gaugeArc');
  const textEl = document.getElementById('gaugeText');
  const sevEl  = document.getElementById('gaugeSevText');

  // Arc total length ~283px for the semicircle
  const offset = 283 - (score / 100) * 283;
  arc.setAttribute('stroke-dashoffset', offset.toString());

  textEl.textContent = score.toString();
  sevEl.textContent  = severity;

  const colorMap = { CRITICAL: '#DC2626', HIGH: '#EA580C', MEDIUM: '#D97706', LOW: '#16a34a' };
  arc.setAttribute('stroke', colorMap[severity] || '#6B7280');
  textEl.setAttribute('fill', colorMap[severity] || '#374151');
}

// ── Render: Risk Drivers ──────────────────────────────────────────────────────
function renderRiskDrivers(data) {
  const { components, topDrivers } = data;
  const nameMap = { pos: 'POS Volume', dist: 'Distribution', price: 'Pricing', brand: 'Brand / ATL', macro: 'Macro' };
  const colorMap = { pos: '#2563EB', dist: '#EA580C', price: '#D97706', brand: '#00843D', macro: '#6B7280' };

  const list = document.getElementById('riskDriversList');
  list.innerHTML = topDrivers.map(d => `
    <div class="rd-item">
      <div class="rd-name">${nameMap[d.name] || d.name}</div>
      <div class="rd-bar-wrap">
        <div class="rd-bar" style="width:${Math.round(d.score)}%;background:${colorMap[d.name] || '#6B7280'}"></div>
      </div>
      <div class="rd-score">${Math.round(d.score)}</div>
    </div>`).join('');
}

// ── Render: Twin Markets ──────────────────────────────────────────────────────
function renderTwins(data) {
  const wrap = document.getElementById('twinsWrap');
  if (!data.comparisons || !data.comparisons.length) {
    wrap.innerHTML = '<div class="placeholder-msg">No twin market data available.</div>';
    return;
  }

  const simColor = pct =>
    pct >= 75 ? '#16a34a' : pct >= 55 ? '#ca8a04' : pct >= 40 ? '#ea580c' : '#9ca3af';

  const rows = data.comparisons.map(c => `
    <div class="twin-row">
      <div class="twin-market-info">
        <div class="twin-flag">${c.flag}</div>
        <div>
          <div class="twin-name">${c.market}</div>
          <div class="twin-region">${c.region}</div>
        </div>
      </div>
      <div class="twin-sim">
        <div class="twin-sim-pct" style="color:${simColor(c.similarity_pct)}">${c.similarity_pct}%</div>
        <div class="twin-sim-label">${c.similarity_label}</div>
      </div>
      <div class="twin-bar-wrap">
        <div class="sim-bar-bg">
          <div class="sim-bar-fill" style="width:${c.similarity_pct}%;background:${simColor(c.similarity_pct)}"></div>
        </div>
        ${c.model_gap.length > 0 ? `<div style="font-size:11px;color:var(--text-3);margin-top:4px">Missing: ${c.model_gap.join(' · ')}</div>` : ''}
      </div>
      <div class="twin-playbooks">
        ${c.playbook_count > 0
          ? `<div class="twin-pb-count">${c.playbook_count} playbook(s) transferable</div>
             <div class="twin-pb-saving">${c.estimated_saving}</div>
             <div class="twin-pb-detail">${c.transferable_playbooks.map(p => `• ${p.type}: ${p.effort}`).join('<br>')}</div>`
          : `<div style="font-size:11px;color:var(--text-4)">Already deployed</div>`}
      </div>
    </div>`).join('');

  wrap.innerHTML = `
    <div class="twin-header-row">
      <span>Market</span><span>Similarity</span><span>Profile Match</span><span>Playbooks to Transfer</span>
    </div>
    ${rows}`;
}

// ── Render: Recommendations ───────────────────────────────────────────────────
function renderRecommendations(recs) {
  const wrap = document.getElementById('recsWrap');
  if (!recs || !recs.length) {
    wrap.innerHTML = '<div class="placeholder-msg">No recommendations generated — risk levels appear acceptable.</div>';
    return;
  }

  wrap.innerHTML = recs.map(rec => {
    const mathsRows = (rec.the_maths || []).map(m => `
      <li class="rec-maths-item">
        <span class="rm-label">${m.label}</span>
        <span class="rm-value">${m.value}</span>
        <span class="rm-source">${m.source}</span>
      </li>`).join('');

    const roi = rec.roi;
    const roiNum = roi.quarterly || roi.one_time || '—';
    const dn = rec.do_nothing;

    const confCls = rec.confidence === 'HIGH' ? 'badge-high' : rec.confidence === 'MEDIUM' ? 'badge-medium' : 'badge-low';

    return `
      <div class="rec-card prio-${rec.priority}">
        <div class="rec-card-header">
          <div class="rec-id-badge">
            <span class="rec-id">${rec.id}</span>
            <span class="rec-cat">${rec.category}</span>
          </div>
          <div class="rec-head-content">
            <div class="rec-headline">${rec.headline}</div>
            <div class="rec-meta">
              <span class="rec-meta-item"><strong>Owner:</strong> ${rec.owner}</span>
              <span class="rec-meta-item"><strong>Deadline:</strong> ${rec.deadline}</span>
              <span class="rec-meta-item rec-conf"><span class="badge ${confCls}">${rec.confidence} confidence</span></span>
              ${(rec.evidence_from || []).map(e => `<span class="rec-meta-item badge badge-none">${e}</span>`).join('')}
            </div>
          </div>
        </div>

        <div class="rec-body">
          <div class="rec-section">
            <div class="rec-sec-title">Problem</div>
            <div class="rec-problem">${rec.problem}</div>
          </div>
          <div class="rec-section">
            <div class="rec-sec-title">The Maths</div>
            <ul class="rec-maths-list">${mathsRows}</ul>
          </div>
          <div class="rec-section" style="display:flex;flex-direction:column;gap:12px">
            <div>
              <div class="rec-sec-title">ROI</div>
              <div class="roi-box">
                <div class="roi-number">${roiNum}x</div>
                <div class="roi-label">${roi.quarterly ? '13-week ROI' : 'One-time ROI'}</div>
              </div>
              <div class="roi-formula">${roi.formula || ''}</div>
            </div>
            ${dn ? `<div class="do-nothing-box">
              <div class="dn-label">Do-nothing cost</div>
              <div class="dn-formula">${dn.formula}</div>
            </div>` : ''}
          </div>
        </div>

        <div class="rec-action-section">
          <div class="rec-sec-title">Action</div>
          <div class="rec-action-text">${rec.action}</div>
          <div class="rec-owner-row">
            <span class="owner-chip">👤 ${rec.owner}</span>
            <span class="deadline-chip">⏰ ${rec.deadline}</span>
            ${rec.cost ? `<span class="owner-chip">💰 €${rec.cost.value.toLocaleString()} (${rec.cost.description})</span>` : ''}
          </div>
        </div>

        ${rec.confidence_note ? `<div class="conf-note">⚠ ${rec.confidence_note}</div>` : ''}
      </div>`;
  }).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const FLAGS = { Netherlands: '🇳🇱', Belgium: '🇧🇪', Germany: '🇩🇪', Poland: '🇵🇱', Spain: '🇪🇸', Nigeria: '🇳🇬' };
function marketFlag(m) { return FLAGS[m] || ''; }

// Active nav highlighting on scroll
const sections = document.querySelectorAll('.content-section');
const navItems = document.querySelectorAll('.nav-item');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = '#' + entry.target.id;
      navItems.forEach(n => {
        n.classList.toggle('active', n.getAttribute('href') === id);
      });
    }
  });
}, { threshold: 0.4 });
sections.forEach(s => observer.observe(s));

// On load: fetch region overview
socket.on('connect', () => {});
