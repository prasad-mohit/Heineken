/* ══════════════════════════════════════════════════════════════════════
   Heineken Minority Report — Dashboard Controller
   All Socket.IO events wired, evidence grid fully rendered
══════════════════════════════════════════════════════════════════════ */
'use strict';

const socket = io();
let selectedMarket = 'Netherlands';
let gaugeChart     = null;
let compChart      = null;
let trendChart     = null;
let logCount       = 0;

/* ── Boot ────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topnav-date').textContent =
    new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  document.querySelectorAll('.mtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMarket = btn.dataset.market;
      loadTrend(selectedMarket);
    });
  });

  drawGauge(0);
  loadTrend(selectedMarket);
});

/* ── Gauge (half-doughnut) ───────────────────────────────────────────── */
function drawGauge(score) {
  const ctx = document.getElementById('gaugeCanvas').getContext('2d');
  if (gaugeChart) gaugeChart.destroy();

  const s   = Math.min(100, Math.max(0, score));
  const col = s >= 75 ? '#ef4444'
            : s >= 55 ? '#f97316'
            : s >= 35 ? '#eab308'
            : '#4ade80';

  gaugeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [s, 100 - s, 100],
        backgroundColor: [col, '#2a2f3e', 'transparent'],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }]
    },
    options: {
      responsive: false,
      cutout: '74%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 700, easing: 'easeOutQuart' },
    }
  });
}

/* ── Components bar chart ────────────────────────────────────────────── */
function drawComponents(components) {
  const labels = ['POS / Stock', 'Distribution', 'Pricing', 'Brand', 'Macro'];
  const values = [
    components.posRisk, components.distRisk, components.pricingRisk,
    components.brandRisk, components.macroRisk,
  ];
  const colors = values.map(v =>
    v >= 70 ? '#ef4444' : v >= 55 ? '#f97316' : v >= 35 ? '#eab308' : '#4ade80'
  );

  const ctx = document.getElementById('compChart').getContext('2d');
  if (compChart) compChart.destroy();

  compChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          min: 0, max: 100,
          grid: { color: '#2a2f3e' },
          ticks: { color: '#64748b', font: { size: 11 } },
          border: { color: '#2a2f3e' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } },
          border: { display: false },
        }
      },
      animation: { duration: 500 },
    }
  });

  document.getElementById('comp-empty').style.display = 'none';
  document.getElementById('comp-bars').style.display = 'block';
}

/* ── Trend chart ─────────────────────────────────────────────────────── */
async function loadTrend(market) {
  try {
    const res  = await fetch(`/api/risk-trend/${market}`);
    const json = await res.json();
    const labels = json.trend.map(t => t.week);
    const values = json.trend.map(t => t.riskScore);

    document.getElementById('trend-market-label').textContent = market;

    const ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0,   'rgba(0,166,81,.25)');
    grad.addColorStop(1,   'rgba(0,166,81,0)');

    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Risk Score',
          data: values,
          borderColor: '#00a651',
          backgroundColor: grad,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#00a651',
          pointBorderWidth: 0,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#13161c',
            borderColor: '#2a2f3e',
            borderWidth: 1,
            titleColor: '#94a3b8',
            bodyColor: '#f1f5f9',
            callbacks: { label: c => ` Risk: ${c.raw}/100` }
          }
        },
        scales: {
          y: {
            min: 0, max: 100,
            grid: { color: '#1a1e27' },
            ticks: { color: '#64748b', font: { size: 11 } },
            border: { color: '#2a2f3e' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 11 } },
            border: { color: '#2a2f3e' },
          }
        },
        animation: { duration: 500 },
      }
    });
  } catch (e) { /* silent fail on trend */ }
}

/* ── Run Pipeline ────────────────────────────────────────────────────── */
function runAgents() {
  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" class="spin-svg"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="20" stroke-dashoffset="10"/></svg> Running…`;

  // Reset
  clearLog();
  resetPipeline();
  document.getElementById('alerts-section').style.display = 'none';
  document.getElementById('recs-section').style.display   = 'none';
  document.getElementById('kv-risk').textContent    = '—';
  document.getElementById('kv-sev').textContent     = '—';
  document.getElementById('kv-qual').textContent    = '—';
  document.getElementById('kv-alerts').textContent  = '—';
  document.getElementById('kv-recs').textContent    = '—';
  document.getElementById('kpi-sev').querySelector('.kpi-num').className = 'kpi-num';
  document.getElementById('gauge-num').textContent  = '…';
  document.getElementById('gauge-sev').textContent  = 'Running';
  drawGauge(0);

  // Spinner CSS
  const style = document.getElementById('spin-style') || (() => {
    const s = document.createElement('style');
    s.id = 'spin-style';
    document.head.appendChild(s);
    return s;
  })();
  style.textContent = `.spin-svg { animation: _spin .7s linear infinite; } @keyframes _spin { to { transform: rotate(360deg); } }`;

  socket.emit('run_agents', { market: selectedMarket });
}

/* ── Socket events ───────────────────────────────────────────────────── */
socket.on('agent_start', ({ market }) => {
  log(`Pipeline started — market: ${market}`, 'orchestrator');
  loadTrend(market);
});

socket.on('orchestrator_log', ({ msg }) => log(msg, 'orchestrator'));

socket.on('phase_change', ({ phase, status }) => {
  const step  = document.querySelector(`[data-phase="${phase}"]`);
  const badge = document.getElementById(`badge-${phase}`);
  if (!step || !badge) return;

  step.classList.remove('running', 'done');
  badge.classList.remove('idle', 'running', 'done');

  if (status === 'active') {
    step.classList.add('running');
    badge.classList.add('running');
    badge.textContent = 'Running';
  } else if (status === 'done') {
    step.classList.add('done');
    badge.classList.add('done');
    badge.textContent = '✓ Done';
  }
});

socket.on('agent_log', ({ agent, msg }) => {
  log(msg, (agent || '').toLowerCase().replace(/\s/g, ''));
});

socket.on('ingestion_complete', ({ sourceReport, overallQuality }) => {
  document.getElementById('kv-qual').textContent = `${Math.round(overallQuality * 100)}%`;
  updateSrcTable(sourceReport);
});

socket.on('risk_complete', ({ riskScore, severity, components }) => {
  document.getElementById('kv-risk').textContent = riskScore;

  const sevEl = document.getElementById('kv-sev');
  sevEl.textContent  = severity;
  sevEl.className    = `kpi-num sev-${severity}`;

  drawGauge(riskScore);
  document.getElementById('gauge-num').textContent = `${riskScore}`;
  document.getElementById('gauge-sev').textContent = severity;
  document.getElementById('gauge-sev').className   = `gauge-sev sev-${severity}`;

  drawComponents(components);
});

socket.on('alerts_complete', ({ alerts }) => {
  document.getElementById('kv-alerts').textContent = alerts.length;
  document.getElementById('ks-alerts').textContent = alerts.map(a => a.severity).join(' · ');
  renderAlerts(alerts);
});

socket.on('recommendations_complete', ({ recommendations }) => {
  document.getElementById('kv-recs').textContent = recommendations.length;
  document.getElementById('ks-recs').textContent = `${recommendations.filter(r => r.breachCount > 0).length} with breaches`;
  renderRecommendations(recommendations);
});

socket.on('agent_done', ({ elapsedSeconds, riskScore, severity }) => {
  const btn = document.getElementById('run-btn');
  btn.disabled = false;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polygon points="3,1 13,7 3,13" fill="currentColor"/></svg> Run Again`;
  document.getElementById('spin-style').textContent = '';
  log(`Pipeline complete in ${elapsedSeconds}s — Risk: ${riskScore}/100 (${severity})`, 'orchestrator');
});

/* ── Render: Alerts ──────────────────────────────────────────────────── */
function renderAlerts(alerts) {
  const grid = document.getElementById('alerts-grid');
  grid.innerHTML = '';

  alerts.forEach(a => {
    const stakeholders = Array.isArray(a.stakeholders) ? a.stakeholders.join(', ') : (a.stakeholders || '');
    grid.innerHTML += `
      <div class="alert-card ${a.severity}">
        <div class="alert-sev">● ${a.severity} · ${a.type.replace(/_/g, ' ')}</div>
        <div class="alert-headline">${x(a.headline)}</div>
        <div class="alert-body">${x(a.body)}</div>
        <div class="alert-meta">👥 ${x(stakeholders)} · 📢 ${x(a.channel)}</div>
      </div>`;
  });

  document.getElementById('alert-count').textContent = alerts.length;
  document.getElementById('alerts-section').style.display = 'block';
}

/* ── Render: Recommendations ─────────────────────────────────────────── */
function renderRecommendations(recs) {
  const list = document.getElementById('recs-list');
  list.innerHTML = '';

  recs.forEach(r => {
    // Evidence rows HTML
    const evRowsHtml = (r.evidence || []).map(e => {
      const icon  = e.status === 'BREACH' ? '🔴' : e.status === 'WARNING' ? '🟡' : '🟢';
      return `
        <div class="ev-row ${x(e.status)}">
          <span class="ev-status-icon">${icon}</span>
          <span class="ev-signal">${x(e.signal)}</span>
          <span class="ev-observed">${x(e.observed)}</span>
          <span class="ev-vs">vs</span>
          <span class="ev-threshold">${x(e.threshold)}</span>
          <span class="ev-source">${x(e.dataSource)}</span>
        </div>`;
    }).join('');

    // Breach / warning badge counts
    const breachBadge = r.breachCount > 0
      ? `<span class="ev-badge-breach">${r.breachCount} breach${r.breachCount > 1 ? 'es' : ''}</span>` : '';
    const warnBadge = r.warningCount > 0
      ? `<span class="ev-badge-warn">${r.warningCount} warning${r.warningCount > 1 ? 's' : ''}</span>` : '';

    list.innerHTML += `
      <div class="rec-card">

        <div class="rec-head">
          <div class="rec-rank">${r.priority}</div>
          <div class="rec-cat">${x(r.category)}</div>
          <span class="rec-conf ${r.confidence}">${x(r.confidence)} confidence</span>
          <span class="rec-effort ${r.effort}">${x(r.effort)}</span>
        </div>

        <div class="rec-action">${x(r.action)}</div>

        <div class="ev-block">
          <div class="ev-block-head">
            <span class="ev-block-title">Evidence — what triggered this recommendation</span>
            <div class="ev-badges">${breachBadge}${warnBadge}</div>
          </div>
          ${evRowsHtml}
        </div>

        <div class="rec-reasoning">${x(r.reasoning)}</div>

        <div class="rec-metrics">
          <div class="rec-metric">
            <div class="rec-metric-label">Volume Recovery</div>
            <div class="rec-metric-value">${x(r.estimatedVolumeRecovery)}</div>
          </div>
          <div class="rec-metric">
            <div class="rec-metric-label">Est. ROI / Quarter</div>
            <div class="rec-metric-value">${x(r.estimatedROI)}</div>
          </div>
          <div class="rec-metric">
            <div class="rec-metric-label">Time to Impact</div>
            <div class="rec-metric-value">${x(r.timeToImpact)}</div>
          </div>
          <div class="rec-metric">
            <div class="rec-metric-label">Owner</div>
            <div class="rec-metric-value" style="font-size:11px;color:var(--text-2)">${x(r.owner)}</div>
          </div>
        </div>

        <div class="rec-footer">
          <span class="rec-kpi">🎯 KPI: <strong>${x(r.kpi)}</strong></span>
        </div>

      </div>`;
  });

  document.getElementById('recs-section').style.display = 'block';
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function updateSrcTable(sourceReport) {
  if (!sourceReport || !sourceReport.length) return;
  const tbody = document.querySelector('#src-table tbody');
  const WEIGHTS = { pos: '30%', atl: '15%', btl: '10%', pricing: '20%', distribution: '15%', macro: '10%' };
  const NAMES   = { pricing: 'Pricing', distribution: 'Dist.' };
  tbody.innerHTML = '';
  sourceReport.forEach(s => {
    const qcls = s.quality === 'HIGH' ? 'high' : s.quality === 'MEDIUM' ? 'med' : 'low';
    const name = NAMES[s.source] || s.source.toUpperCase();
    tbody.innerHTML += `
      <tr>
        <td>${name}</td>
        <td>${x(s.freshness)}</td>
        <td><span class="q-dot ${qcls}"></span>${s.quality === 'MEDIUM' ? 'MED' : s.quality}</td>
        <td>${WEIGHTS[s.source] || '—'}</td>
      </tr>`;
  });
}

function log(msg, cls) {
  const body = document.getElementById('log-body');
  const empty = body.querySelector('.log-empty');
  if (empty) empty.remove();

  const ts   = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line = document.createElement('div');
  line.className = `log-line ${cls || ''}`;
  line.innerHTML = `<span class="log-ts">${ts}</span>${x(msg)}`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;

  logCount++;
  document.getElementById('log-meta').textContent = `${logCount} entries`;
}

function clearLog() {
  logCount = 0;
  document.getElementById('log-meta').textContent = '0 entries';
  const body = document.getElementById('log-body');
  body.innerHTML = '<div class="log-empty">Pipeline starting…</div>';
}

function resetPipeline() {
  document.querySelectorAll('.p-step').forEach(s => s.classList.remove('running', 'done'));
  document.querySelectorAll('.p-step-badge').forEach(b => {
    b.className = 'p-step-badge idle';
    b.textContent = 'Idle';
  });
  document.getElementById('comp-empty').style.display = 'flex';
  document.getElementById('comp-bars').style.display  = 'none';
}

// Safe HTML escape
function x(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
