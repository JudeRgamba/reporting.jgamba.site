/* dashboard.js — SPA router + all views */
'use strict';

// ─── API Fetch ────────────────────────────────────────────────────────────────
async function apiFetch(url) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/login.php';
      return null;
    }
    if (!res.ok) throw new Error('API error: ' + res.status);
    const json = await res.json();
    return json.data ?? json;
  } catch (err) {
    document.getElementById('content').innerHTML =
      '<div class="error-state">Failed to load data: ' + err.message + '</div>';
    return null;
  }
}

// ─── Date Range ───────────────────────────────────────────────────────────────
function getDateRange() {
  return {
    start: document.getElementById('date-start').value,
    end:   document.getElementById('date-end').value
  };
}

function initDatePicker() {
  const now   = new Date();
  const end   = now.toISOString().slice(0, 10);
  const start = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
  document.getElementById('date-start').value = start;
  document.getElementById('date-end').value   = end;
  document.getElementById('date-start').addEventListener('change', route);
  document.getElementById('date-end').addEventListener('change',   route);
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function showLoading() {
  document.getElementById('content').innerHTML = `
    <div class="skeleton-cards">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </div>
    <div class="skeleton skeleton-chart"></div>
    <div class="skeleton skeleton-table"></div>
  `;
}

// ─── Router ───────────────────────────────────────────────────────────────────
function route() {
  const hash = window.location.hash || '#/overview';
  const path = hash.replace('#', '').split('?')[0];
  const { start, end } = getDateRange();

  // Highlight active nav link
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + path);
  });

  // Close mobile sidebar on nav
  document.getElementById('sidebar').classList.remove('open');

  switch (path) {
    case '/overview':    renderOverview(start, end);    break;
    case '/performance': renderPerformance(start, end); break;
    case '/errors':      renderErrors(start, end);      break;
    case '/admin': 
        if (window.SESSION_USER_ROLE === 'viewer') {
            window.location.hash = '#/overview';
            return;
        }      
        renderAdmin();                 
        break;
    default:             renderOverview(start, end);
  }
}

// ─── Charts.js Line Chart ───────────────────────────────────────────────────────
// Store chart instances so we can destroy them before redrawing
const chartInstances = {};

function drawLineChart(canvasId, data, xKey, yKey, color) {
  // Destroy existing chart on this canvas if it exists
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = data.map(d => String(d[xKey]).slice(5)); // trim year from date
  const values = data.map(d => Number(d[yKey]));

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: color,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: {
            color: '#7d8590',
            font: { family: 'JetBrains Mono', size: 10 }
          },
          grid: { color: '#21262d' }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#7d8590',
            font: { family: 'JetBrains Mono', size: 10 }
          },
          grid: { color: '#21262d' }
        }
      }
    }
  });
}

function drawBarChart(canvasId, labels, values, colors) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: {
            color: '#7d8590',
            font: { family: 'JetBrains Mono', size: 11 }
          },
          grid: { color: '#21262d' }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#7d8590',
            font: { family: 'JetBrains Mono', size: 10 }
          },
          grid: { color: '#21262d' }
        }
      }
    }
  });
}

// ─── Vitals helpers ───────────────────────────────────────────────────────────
function vitalColor(metric, value) {
  const t = { lcp: [2500, 4000], cls: [0.1, 0.25], inp: [200, 500] }[metric];
  if (!t || value == null) return '#7d8590';
  if (value < t[0]) return '#3fb950';
  if (value < t[1]) return '#d29922';
  return '#f85149';
}

function vitalLabel(metric, value) {
  const t = { lcp: [2500, 4000], cls: [0.1, 0.25], inp: [200, 500] }[metric];
  if (!t || value == null) return 'N/A';
  if (value < t[0]) return 'Good';
  if (value < t[1]) return 'Needs Work';
  return 'Poor';
}

// ─── View: Overview ───────────────────────────────────────────────────────────
async function renderOverview(start, end) {
  showLoading();
  const [summary, pv] = await Promise.all([
    apiFetch('/api/dashboard?start=' + start + '&end=' + end),
    apiFetch('/api/pageviews?start=' + start + '&end=' + end)
  ]);
  if (!summary || !pv) return;

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-title">Overview</div>
    <div class="cards-grid" id="cards"></div>
    <div class="panel">
      <div class="panel-header">Pageviews Over Time</div>
      <div class="panel-body">
        <canvas id="pv-chart"></canvas>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header">Top Pages</div>
      <div id="top-pages"></div>
    </div>
  `;

  // Cards
  const cards = [
    { label: 'Pageviews',    value: Number(summary.total_pageviews  || 0).toLocaleString() },
    { label: 'Sessions',     value: Number(summary.total_sessions   || 0).toLocaleString() },
    { label: 'Avg Load',     value: Math.round(summary.avg_load_time_ms || 0) + ' ms' },
    { label: 'JS Errors',    value: Number(summary.total_errors     || 0).toLocaleString() }
  ];
  const cardsEl = document.getElementById('cards');
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    const label = document.createElement('div');
    label.className = 'metric-label';
    label.textContent = c.label;
    const val = document.createElement('div');
    val.className = 'metric-value';
    val.textContent = c.value;
    card.appendChild(label);
    card.appendChild(val);
    cardsEl.appendChild(card);
  });

  // Chart
  drawLineChart('pv-chart', pv.byDay, 'day', 'views', '#58a6ff');

  // Top pages table
  const topEl = document.getElementById('top-pages');
  if (!pv.topPages || pv.topPages.length === 0) {
    topEl.innerHTML = '<div class="empty-state">No pageview data yet</div>';
    return;
  }
  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = '<thead><tr><th>URL</th><th>Views</th></tr></thead>';
  const tbody = document.createElement('tbody');
  pv.topPages.forEach(p => {
    const tr = document.createElement('tr');
    const tdUrl = document.createElement('td');
    tdUrl.textContent = p.url;
    const tdViews = document.createElement('td');
    tdViews.textContent = Number(p.views).toLocaleString();
    tr.appendChild(tdUrl);
    tr.appendChild(tdViews);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  topEl.appendChild(table);
}

// ─── View: Performance ────────────────────────────────────────────────────────
async function renderPerformance(start, end) {
  showLoading();
  const data = await apiFetch('/api/performance?start=' + start + '&end=' + end);
  if (!data) return;

  const byPage = data.byPage || [];

  // Compute weighted site-wide averages
  let totalLcp = 0, totalCls = 0, totalInp = 0, totalSamples = 0;
  byPage.forEach(r => {
    const s = Number(r.samples) || 0;
    totalLcp += (Number(r.avg_lcp) || 0) * s;
    totalCls += (Number(r.avg_cls) || 0) * s;
    totalInp += (Number(r.avg_inp) || 0) * s;
    totalSamples += s;
  });
  const avgLcp = totalSamples ? totalLcp / totalSamples : 0;
  const avgCls = totalSamples ? totalCls / totalSamples : 0;
  const avgInp = totalSamples ? totalInp / totalSamples : 0;

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-title">Performance</div>
    <div class="vitals-grid" id="vitals"></div>
    <div class="panel">
        <div class="panel-header">Web Vitals Comparison</div>
        <div class="panel-body">
            <canvas id="vitals-chart"></canvas>
        </div>
    </div>
    <div class="panel">
      <div class="panel-header">Per-Page Breakdown</div>
      <div id="perf-table"></div>
    </div>
  `;

  // Vitals cards
  const vitals = [
    { name: 'LCP', key: 'lcp', value: avgLcp, display: Math.round(avgLcp) + 'ms' },
    { name: 'CLS', key: 'cls', value: avgCls, display: avgCls.toFixed(3) },
    { name: 'INP', key: 'inp', value: avgInp, display: Math.round(avgInp) + 'ms' }
  ];
  const vitalsEl = document.getElementById('vitals');
  vitals.forEach(v => {
    const color = vitalColor(v.key, v.value);
    const label = vitalLabel(v.key, v.value);
    const card = document.createElement('div');
    card.className = 'vital-card';
    card.innerHTML = `
      <div class="vital-name">${v.name}</div>
      <div class="vital-value" style="color:${color}">${v.display}</div>
      <span class="vital-badge" style="background:${color}22;color:${color}">${label}</span>
    `;
    vitalsEl.appendChild(card);
  });

  drawBarChart(
  'vitals-chart',
  ['LCP (ms)', 'INP (ms)', 'CLS ×1000'],
  [Math.round(avgLcp), Math.round(avgInp), Math.round(avgCls * 1000)],
  [vitalColor('lcp', avgLcp), vitalColor('inp', avgInp), vitalColor('cls', avgCls)]
    );

  // Per-page table
  const tableEl = document.getElementById('perf-table');
  if (byPage.length === 0) {
    tableEl.innerHTML = '<div class="empty-state">No performance data yet</div>';
    return;
  }
  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>URL</th>
        <th>Load (ms)</th>
        <th>TTFB (ms)</th>
        <th>LCP (ms)</th>
        <th>CLS</th>
        <th>Samples</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  byPage.forEach(r => {
    const tr = document.createElement('tr');
    if (Number(r.avg_load_ms) > 3000) tr.classList.add('row-slow');
    const fields = [
      { val: r.url, isUrl: true },
      { val: r.avg_load_ms },
      { val: r.avg_ttfb_ms },
      { val: r.avg_lcp },
      { val: Number(r.avg_cls).toFixed(3) },
      { val: r.samples }
    ];
    fields.forEach(f => {
      const td = document.createElement('td');
      td.textContent = f.val ?? '—';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableEl.appendChild(table);
}

// ─── View: Errors ─────────────────────────────────────────────────────────────
async function renderErrors(start, end) {
  showLoading();
  const data = await apiFetch('/api/errors?start=' + start + '&end=' + end);
  if (!data) return;

  const byMessage = data.byMessage || [];
  const trend     = data.trend     || [];
  const total     = byMessage.reduce((s, r) => s + Number(r.occurrences), 0);

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-title">Errors</div>
    <div class="cards-grid" style="grid-template-columns:repeat(1,260px)">
      <div class="metric-card">
        <div class="metric-label">Total Errors</div>
        <div class="metric-value" style="color:var(--danger)">${total.toLocaleString()}</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header">Error Trend</div>
      <div class="panel-body">
        <canvas id="err-chart"></canvas>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header">Errors by Message — click to expand</div>
      <div id="err-table"></div>
    </div>
  `;

  drawLineChart('err-chart', trend, 'day', 'error_count', '#f85149');

  const tableEl = document.getElementById('err-table');
  if (byMessage.length === 0) {
    tableEl.innerHTML = '<div class="empty-state">No errors recorded 🎉</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr><th>Message</th><th>Count</th><th>Last Seen</th></tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  byMessage.forEach(r => {
    // Summary row
    const tr = document.createElement('tr');
    tr.className = 'clickable';

    const tdMsg = document.createElement('td');
    const short = String(r.error_message || '(unknown)').slice(0, 80);
    tdMsg.textContent = short + (r.error_message && r.error_message.length > 80 ? '…' : '');

    const tdCount = document.createElement('td');
    tdCount.textContent = Number(r.occurrences).toLocaleString();

    const tdDate = document.createElement('td');
    tdDate.textContent = r.last_seen || '—';

    tr.appendChild(tdMsg);
    tr.appendChild(tdCount);
    tr.appendChild(tdDate);

    // Detail row
    const detailTr = document.createElement('tr');
    detailTr.className = 'detail-row';
    const detailTd = document.createElement('td');
    detailTd.colSpan = 3;
    detailTd.className = 'detail-cell';
    detailTd.textContent = r.error_message || '(no message)';
    detailTr.appendChild(detailTd);

    tr.addEventListener('click', () => detailTr.classList.toggle('open'));

    tbody.appendChild(tr);
    tbody.appendChild(detailTr);
  });
  table.appendChild(tbody);
  tableEl.appendChild(table);
}

// ─── View: Admin ──────────────────────────────────────────────────────────────
async function renderAdmin() {
  showLoading();
  const users = await apiFetch('/users-admin.php');
  if (!users) return;

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-title">Admin — User Management</div>
    <div class="panel">
      <div class="panel-header">All Users</div>
      <div id="users-table"></div>
    </div>
    <div class="panel">
      <div class="panel-header">Add New User</div>
      <div class="panel-body">
        <div class="form-grid" id="add-user-form">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="new-username" placeholder="username">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="new-email" placeholder="user@example.com">
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" id="new-display" placeholder="Display Name">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="new-password" placeholder="password">
          </div>
          <div class="form-group">
            <label>Role</label>
            <select id="new-role">
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-full" id="add-user-btn">Add User</button>
        <div id="add-user-msg" style="margin-top:10px;font-family:var(--font-mono);font-size:12px;"></div>
      </div>
    </div>
  `;

  renderUsersTable(users);

  document.getElementById('add-user-btn').addEventListener('click', async () => {
    const username = document.getElementById('new-username').value.trim();
    const email    = document.getElementById('new-email').value.trim();
    const display  = document.getElementById('new-display').value.trim();
    const password = document.getElementById('new-password').value;
    const role     = document.getElementById('new-role').value;
    const msgEl    = document.getElementById('add-user-msg');

    if (!username || !email || !password) {
      msgEl.style.color = 'var(--danger)';
      msgEl.textContent = 'Username, email and password are required.';
      return;
    }

    try {
      const res = await fetch('/users-admin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, display_name: display, password, role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        msgEl.style.color = 'var(--accent2)';
        msgEl.textContent = 'User created successfully.';
        document.getElementById('new-username').value = '';
        document.getElementById('new-email').value    = '';
        document.getElementById('new-display').value  = '';
        document.getElementById('new-password').value = '';
        // Refresh table
        const updated = await apiFetch('/users-admin.php');
        if (updated) renderUsersTable(updated);
      } else {
        msgEl.style.color = 'var(--danger)';
        msgEl.textContent = data.error || 'Failed to create user.';
      }
    } catch (err) {
      msgEl.style.color = 'var(--danger)';
      msgEl.textContent = 'Network error.';
    }
  });
}

function renderUsersTable(users) {
  const el = document.getElementById('users-table');
  if (!el) return;
  if (!users || users.length === 0) {
    el.innerHTML = '<div class="empty-state">No users found</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Username</th>
        <th>Email</th>
        <th>Display Name</th>
        <th>Role</th>
        <th>Last Login</th>
        <th>Actions</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  users.forEach(u => {
    const tr = document.createElement('tr');

    [u.username, u.email, u.display_name || '—', u.role,
     u.last_login ? String(u.last_login).slice(0, 10) : 'Never'].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    const actionsTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
    if (!confirm('Delete user ' + u.username + '?')) return;
        const res = await fetch('/users-admin.php?id=' + u.id + '&self=' + window.SESSION_USER_ID, {
            method: 'DELETE',
            credentials: 'include'
        });
      const data = await res.json();
      if (data.success) {
        const updated = await apiFetch('/users-admin.php');
        if (updated) renderUsersTable(updated);
      } else {
        alert(data.error || 'Could not delete user.');
      }
    });
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  el.innerHTML = '';
  el.appendChild(table);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  initDatePicker();

  if (window.SESSION_USER_ROLE === 'viewer') {
    document.querySelector('a[href="#/admin"]').style.display = 'none';
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/logout.php', { method: 'POST', credentials: 'include' });
    window.location.href = '/login.php';
  });

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  window.addEventListener('hashchange', route);
  route();
}

document.addEventListener('DOMContentLoaded', init);