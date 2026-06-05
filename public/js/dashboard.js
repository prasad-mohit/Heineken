/* ═══════════════════════════════════════════════════════════════════════════
   Heineken Minority Report — Frontend Dashboard Controller
   Handles Socket.IO events, Chart.js rendering, and DOM updates
   ═══════════════════════════════════════════════════════════════════════════ */

const socket = io();
let selectedMarket = 'Netherlands';
let gaugeChart = null;
let componentsChart = null;
let trendChart = null;
let logCount = 0;

// ── Initialise on load ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('header-date').textContent =
    new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  // Market tab switching
  document.querySelectorAll('.market-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.market-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMarket = btn.dataset.market;
    });
  });

  initGauge();
  loadTrendChart(selectedMarket);
});

// ── Gauge init (doughnut half-circle) ───────────────────────────────────────
function initGauge(score = 0) {
  const ctx = document.getElementById('gaugeChart').getContext('2d');
  if (gaugeChart) gaugeChart.destroy();

  const capped = Math.min(Math.max(score, 0), 100);
  const remainder = 100 - capped;

  const color = capped >= 75 ? '#dc2626'
              : capped >= 55 ? '#f97316'
              : capped >= 35 ? '#eab308'
              : '#22c55e';

  gaugeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [capped, remainder, 100],
        backgroundColor: [color, '#e5e7eb', 'transparent'],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }]
    },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 800 },
    }
  });
}

// ── Risk components bar chart ────────────────────────────────────────────────
function renderComponentsChart(components) {
  const labels = ['POS', 'Distribution', 'Pricing', 'Brand', 'Macro'];
  const values = [
    components.posRisk,
    components.distRisk,
    components.pricingRisk,
    components.brandRisk,
    components.macroRisk,
  ];
  const colors = values.map(v => v >= 70 ? '#dc2626' : v >= 50 ? '#f97316' : v >= 35 ? '#eab308' : '#22c55e');

  const ctx = document.getElementById('componentsChart').getContext('2d');
  if (componentsChart) componentsChart.destroy();

  componentsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 100, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      animation: { duration: 600 },
    }
  });

  document.getElementById('risk-components').style.display = 'block';
}

// ── 12-week trend chart ──────────────────────────────────────────────────────
async function loadTrendChart(market) {
  const res  = await fetch(`/api/risk-trend/${market}`);
  const json = await res.json();
  const labels = json.trend.map(t => t.week);
  const values = json.trend.map(t => t.riskScore);

  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${market} Risk Score`,
        data: values,
        borderColor: '#00843D',
        backgroundColor: 'rgba(0,132,61,0.08)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#00843D',
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      plugins: {
        legend: { display: true, labels: { font: { size: 11 }, color: '#6b7280' } },
        tooltip: { callbacks: { label: ctx => ` Risk: ${ctx.raw}/100` } }
      },
      scales: {
        y: { min: 0, max: 100, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      animation: { duration: 700 },
    }
  });
}

// ── Run Agents ───────────────────────────────────────────────────────────────
function runAgents() {
  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Running…';
  btn.classList.add('running-spinner');

  // Reset UI
  clearLog();
  resetPipelineSteps();
  document.getElementById('alerts-section').style.display = 'none';
  document.getElementById('recs-section').style.display = 'none';
  document.getElementById('kpi-risk-value').textContent = '—';
  document.getElementById('kpi-severity-value').textContent = '—';
  document.getElementById('kpi-quality-value').textContent = '—';
  document.getElementById('kpi-alerts-value').textContent = '—';
  initGauge(0);
  document.getElementById('gauge-score').textContent = '…';
  document.getElementById('gauge-label').textContent = 'Analysing…';

  socket.emit('run_agents', { market: selectedMarket });
}

// ── Socket.IO event handlers ─────────────────────────────────────────────────

socket.on('agent_start', ({ market }) => {
  appendLog(`🟢 Pipeline started for market: ${market}`, 'orchestrator');
  loadTrendChart(market); // refresh trend
});

socket.on('orchestrator_log', ({ msg }) => {
  appendLog(msg, 'orchestrator');
});

socket.on('phase_change', ({ phase, label, status }) => {
  const stepEl = document.querySelector(`[data-phase="${phase}"]`);
  if (!stepEl) return;
  const statusEl = stepEl.querySelector('.step-status');
  stepEl.classList.remove('active', 'done');
  statusEl.classList.remove('idle', 'running', 'done');
  if (status === 'active') {
    stepEl.classList.add('active');
    statusEl.classList.add('running');
    statusEl.textContent = 'RUNNING';
  } else if (status === 'done') {
    stepEl.classList.add('done');
    statusEl.classList.add('done');
    statusEl.textContent = '✔ DONE';
  }
});

socket.on('agent_log', ({ agent, msg }) => {
  const cls = agent ? agent.toLowerCase() : '';
  appendLog(msg, cls);
});

socket.on('ingestion_complete', ({ sourceReport, overallQuality }) => {
  document.getElementById('kpi-quality-value').textContent = `${(overallQuality * 100).toFixed(0)}%`;
  updateSourceTable(sourceReport);
});

socket.on('risk_complete', ({ riskScore, severity, components, topDrivers }) => {
  // KPI
  document.getElementById('kpi-risk-value').textContent = riskScore;
  const sevEl = document.getElementById('kpi-severity-value');
  sevEl.textContent = severity;
  sevEl.className = `kpi-value severity-badge sev-${severity}`;

  // Gauge
  initGauge(riskScore);
  document.getElementById('gauge-score').textContent = `${riskScore}/100`;
  document.getElementById('gauge-label').textContent = `Severity: ${severity}`;

  // Components
  renderComponentsChart(components);
});

socket.on('alerts_complete', ({ alerts }) => {
  document.getElementById('kpi-alerts-value').textContent = alerts.length;
  document.getElementById('kpi-alerts-sub').textContent = alerts.map(a => a.severity).join(' · ');
  renderAlerts(alerts);
});

socket.on('recommendations_complete', ({ recommendations }) => {
  renderRecommendations(recommendations);
});

socket.on('agent_done', ({ market, riskScore, severity, elapsedSeconds }) => {
  const btn = document.getElementById('run-btn');
  btn.disabled = false;
  btn.textContent = '▶ Run Again';
  btn.classList.remove('running-spinner');
  appendLog(`✅ Pipeline done in ${elapsedSeconds}s`, 'orchestrator');
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function appendLog(msg, cls = '') {
  const container = document.getElementById('agent-log');
  const placeholder = container.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry ${cls}`;
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  entry.innerHTML = `<span class="log-ts">[${ts}]</span>${escapeHtml(msg)}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  logCount++;
  document.getElementById('log-count').textContent = `${logCount} entries`;
}

function clearLog() {
  logCount = 0;
  document.getElementById('log-count').textContent = '0 entries';
  const container = document.getElementById('agent-log');
  container.innerHTML = '';
}

function resetPipelineSteps() {
  document.querySelectorAll('.pipeline-step').forEach(step => {
    step.classList.remove('active', 'done');
    const s = step.querySelector('.step-status');
    s.className = 'step-status idle';
    s.textContent = 'IDLE';
  });
}

function updateSourceTable(sourceReport) {
  const tbody = document.querySelector('#source-table tbody');
  if (!sourceReport || !sourceReport.length) return;
  tbody.innerHTML = '';
  const WEIGHT_LABELS = { pos: '30%', atl: '15%', btl: '10%', pricing: '20%', distribution: '15%', macro: '10%' };
  sourceReport.forEach(s => {
    const cls = s.quality === 'HIGH' ? 'high' : s.quality === 'MEDIUM' ? 'med' : 'low';
    const name = s.source === 'pricing' ? 'Pricing & Promo' : s.source.toUpperCase();
    tbody.innerHTML += `
      <tr>
        <td>${name}</td>
        <td>${s.freshness}</td>
        <td><span class="quality ${cls}">${s.quality}</span></td>
        <td>${WEIGHT_LABELS[s.source] || '-'}</td>
      </tr>`;
  });
}

function renderAlerts(alerts) {
  const section = document.getElementById('alerts-section');
  const grid    = document.getElementById('alerts-grid');
  const badge   = document.getElementById('alert-badge');

  badge.textContent = alerts.length;
  grid.innerHTML = '';

  alerts.forEach(a => {
    const stakeholders = Array.isArray(a.stakeholders) ? a.stakeholders.join(', ') : a.stakeholders;
    grid.innerHTML += `
      <div class="alert-card ${a.severity}">
        <div class="alert-severity">● ${a.severity} · ${a.type.replace(/_/g,' ')}</div>
        <div class="alert-headline">${escapeHtml(a.headline)}</div>
        <div class="alert-body">${escapeHtml(a.body)}</div>
        <div class="alert-meta">👥 ${escapeHtml(stakeholders)} · 📢 ${escapeHtml(a.channel)}</div>
      </div>`;
  });

  section.style.display = 'block';
}

function renderRecommendations(recs) {
  const section = document.getElementById('recs-section');
  const grid    = document.getElementById('recs-grid');
  grid.innerHTML = '';

  recs.forEach(r => {
    grid.innerHTML += `
      <div class="rec-card">
        <div class="rec-priority">#${r.priority} Priority</div>
        <div class="rec-category">${escapeHtml(r.category)}</div>
        <div class="rec-action">${escapeHtml(r.action)}</div>
        <div class="rec-rationale">${escapeHtml(r.rationale)}</div>
        <div class="rec-metrics">
          <div class="rec-metric">
            <span class="rec-metric-label">Volume Recovery</span>
            <span class="rec-metric-value">${escapeHtml(r.estimatedVolumeRecovery)}</span>
          </div>
          <div class="rec-metric">
            <span class="rec-metric-label">Est. ROI</span>
            <span class="rec-metric-value">${escapeHtml(r.estimatedROI)}</span>
          </div>
          <div class="rec-metric">
            <span class="rec-metric-label">Time to Impact</span>
            <span class="rec-metric-value">${escapeHtml(r.timeToImpact)}</span>
          </div>
        </div>
        <div class="rec-footer">
          <span>👤 ${escapeHtml(r.owner)}</span>
          <span class="effort-badge effort-${r.effort}">${r.effort} effort</span>
        </div>
      </div>`;
  });

  section.style.display = 'block';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
