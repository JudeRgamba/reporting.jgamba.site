/* dashboard.js — SPA router + all views */
'use strict';

// API Fetch
async function apiFetch(url) {
    const res = await fetch(url, {
        credentials: 'include',
        cache: 'no-store', // prevents caching data stored
        headers: {
            'Content-Type': 'application/json',
            'X-User-Role': window.SESSION_ROLE || 'viewer',
            'X-User-Sections': JSON.stringify(window.SESSION_SECTIONS || []),
            'X-User-Id': String(window.SESSION_USER_ID || ''),
        },
    });
    if (res.status === 401) {
        window.location.href = '/login.php';
        return null;
    }
    if (res.status === 403) {
        showError('You do not have permission to view this section.');
        return null;
    }
    return res.json();
}

// API Request — for POST, PUT, DELETE
async function apiRequest(url, method, body = null) {
    const opts = {
        method,
        credentials: 'include',
        headers: {
            'Content-Type':    'application/json',
            'X-User-Role':     window.SESSION_ROLE     || 'viewer',
            'X-User-Sections': JSON.stringify(window.SESSION_SECTIONS || []),
            'X-User-Id':       String(window.SESSION_USER_ID || ''),
        },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (res.status === 401) { window.location.href = '/login.php'; return null; }
    if (res.status === 403) { showError('You do not have permission to perform this action.'); return null; }
    return res.json();
}

// Date Range
function getDateRange() {
    return {
        start: document.getElementById('date-start').value,
        end: document.getElementById('date-end').value,
    };
}

function initDatePicker() {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const start = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
    document.getElementById('date-start').value = start;
    document.getElementById('date-end').value = end;
    document.getElementById('date-start').addEventListener('change', route);
    document.getElementById('date-end').addEventListener('change', route);
}

// Loading Skeleton
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

// Router
function route() {
    const hash = window.location.hash || '#/overview';
    const path = hash.replace('#', '');

    // Viewers always land on reports — redirect and stop
    if (window.SESSION_ROLE === 'viewer' && path !== '/reports') {
        window.location.hash = '#/reports';
        return; // ← stops current route() execution
    }

    switch (path) {
        case '/overview':
            if (!canAccess('overview')) {
                showError('You are not assigned to the Overview section.');
                return;
            }
            const { start: s1, end: e1 } = getDateRange();
            renderOverview(s1, e1);
            break;
        case '/performance':
            if (!canAccess('performance')) {
                showError('You are not assigned to the Performance section.');
                return;
            }
            const { start: s2, end: e2 } = getDateRange();
            renderPerformance(s2, e2);
            break;
        case '/errors':
            if (!canAccess('errors')) {
                showError('You are not assigned to the Errors section.');
                return;
            }
            const { start: s3, end: e3 } = getDateRange();
            renderErrors(s3, e3);
            break;
        case '/rawdata':
            if (!canAccess('rawdata')) {
                showError('You are not assigned to the Raw Data section.');
                return;
            }
            renderRawData();
            break;
        case '/reports':
            renderReports();
            break;
        case '/admin':
            if (window.SESSION_ROLE !== 'super_admin') {
                showError('Super admin access required.');
                return;
            }
            renderAdmin();
            break;
        default:
            if (window.SESSION_ROLE === 'viewer') {
                window.location.hash = '#/reports';
            } else {
                const { start, end } = getDateRange();
                renderOverview(start, end);
            }
    }
}

// Charts.js Line Chart
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

        // Guard against undefined/empty data
    if (!data || !Array.isArray(data) || data.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#7d8590';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available for this period', canvas.width / 2, 60);
        return;
    }

    const labels = data.map((d) => String(d[xKey]).slice(5)); // trim year from date
    const values = data.map((d) => Number(d[yKey]));

    chartInstances[canvasId] = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    data: values,
                    borderColor: color,
                    backgroundColor: color + '22',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: color,
                    fill: true,
                    tension: 0.3,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    ticks: {
                        color: '#7d8590',
                        font: { family: 'JetBrains Mono', size: 10 },
                    },
                    grid: { color: '#21262d' },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#7d8590',
                        font: { family: 'JetBrains Mono', size: 10 },
                    },
                    grid: { color: '#21262d' },
                },
            },
        },
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
            datasets: [
                {
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 4,
                    borderSkipped: false,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    ticks: {
                        color: '#7d8590',
                        font: { family: 'JetBrains Mono', size: 11 },
                    },
                    grid: { color: '#21262d' },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#7d8590',
                        font: { family: 'JetBrains Mono', size: 10 },
                    },
                    grid: { color: '#21262d' },
                },
            },
        },
    });
}

//  Vitals helpers
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

// Access Helper Functions
function canAccess(section) {
    if (window.SESSION_ROLE === 'super_admin') return true;
    if (window.SESSION_ROLE === 'analyst') {
        return (window.SESSION_SECTIONS || []).includes(section);
    }
    // viewers can only access reports/briefing
    return section === 'reports';
}

function showError(msg) {
    const content = document.getElementById('content');
    content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:300px;">
      <div style="text-align:center;color:var(--text-dim);">
        <div style="font-size:48px;margin-bottom:16px;">🔒</div>
        <div style="font-size:18px;margin-bottom:8px;">Access Restricted</div>
        <div style="font-size:14px;">${msg}</div>
      </div>
    </div>`;
}

// View: Overview
async function renderOverview(start, end) {
    showLoading();
    const [summary, pv] = await Promise.all([
        apiFetch('/api/dashboard?start=' + start + '&end=' + end),
        apiFetch('/api/pageviews?start=' + start + '&end=' + end),
    ]);

    if (!summary || !pv) return;

    const s = summary.data;
    const byDay = pv.data.byDay || [];
    const topPages = pv.data.topPages || [];

    const content = document.getElementById('content');
    content.innerHTML = `
    <div class="page-title">Overview</div>
    <div class="cards-grid" id="cards"></div>
    <div class="panel">
      <div class="panel-header">Pageviews Over Time</div>
      <div class="panel-body" style="position:relative;width:100%;min-height:200px;">
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
        { label: 'Pageviews', value: Number(s.total_pageviews || 0).toLocaleString() },
        { label: 'Sessions', value: Number(s.total_sessions || 0).toLocaleString() },
        { label: 'Avg Load', value: Math.round(s.avg_load_time_ms || 0) + ' ms' },
        { label: 'JS Errors', value: Number(s.total_errors || 0).toLocaleString() },
    ];
    const cardsEl = document.getElementById('cards');
    cards.forEach((c) => {
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
    drawLineChart('pv-chart', byDay, 'day', 'views', '#58a6ff');

    // Top pages table
    const topEl = document.getElementById('top-pages');
    if (topPages.length === 0) {
        topEl.innerHTML = '<div class="empty-state">No pageview data yet</div>';
        return;
    }
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = '<thead><tr><th>URL</th><th>Views</th></tr></thead>';
    const tbody = document.createElement('tbody');
    topPages.forEach((p) => {
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
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);
    topEl.appendChild(wrap);
}

// View: Performance
async function renderPerformance(start, end) {
    showLoading();
    const data = await apiFetch('/api/performance?start=' + start + '&end=' + end);
    if (!data) return;

    const byPage = data.data?.byPage || [];

    // Compute weighted site-wide averages
    let totalLcp = 0,
        totalCls = 0,
        totalInp = 0,
        totalSamples = 0;
    byPage.forEach((r) => {
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
        <div class="panel-body" style="position:relative;width:100%;min-height:200px;">
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
        { name: 'INP', key: 'inp', value: avgInp, display: Math.round(avgInp) + 'ms' },
    ];
    const vitalsEl = document.getElementById('vitals');
    vitals.forEach((v) => {
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
    byPage.forEach((r) => {
        const tr = document.createElement('tr');
        if (Number(r.avg_load_ms) > 3000) tr.classList.add('row-slow');
        const fields = [
            { val: r.url, isUrl: true },
            { val: r.avg_load_ms },
            { val: r.avg_ttfb_ms },
            { val: r.avg_lcp },
            { val: Number(r.avg_cls).toFixed(3) },
            { val: r.samples },
        ];
        fields.forEach((f) => {
            const td = document.createElement('td');
            td.textContent = f.val ?? '—';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);
    tableEl.appendChild(wrap);
}

// View: Errors
async function renderErrors(start, end) {
    showLoading();
    const data = await apiFetch('/api/errors?start=' + start + '&end=' + end);
    if (!data) return;

    const byMessage = data.data?.byMessage || [];
    const trend = data.data?.trend || [];
    const total = byMessage.reduce((s, r) => s + Number(r.occurrences), 0);

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
      <div class="panel-body" style="position:relative;width:100%;min-height:200px;">
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
    byMessage.forEach((r) => {
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
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);
    tableEl.appendChild(wrap);
}

// View: Raw Data
async function renderRawData() {
    showLoading();
    const data = await apiFetch('/api/events');
    if (!data) return;

    const events = data.data || data;
    const content = document.getElementById('content');

    content.innerHTML = `
    <div class="page-title">Raw Event Data</div>
    <div class="panel">
      <div class="panel-header">Last 100 Events — unprocessed from database</div>
      <div style="overflow-x:auto;">
        <table class="data-table" id="raw-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Session</th>
              <th>Type</th>
              <th>URL</th>
              <th>Timestamp</th>
              <th>LCP</th>
              <th>CLS</th>
              <th>INP</th>
              <th>Load (ms)</th>
              <th>TTFB</th>
            </tr>
          </thead>
          <tbody id="raw-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

    const tbody = document.getElementById('raw-tbody');

    if (!events || events.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-dim)">No events found</td></tr>';
        return;
    }

    events.forEach((e) => {
        const tr = document.createElement('tr');

        const fields = [
            e.id,
            e.session_id ? String(e.session_id).slice(0, 12) + '…' : '—',
            e.url ? String(e.url).replace('https://test.jgamba.site', '') || '/' : '—',
            e.server_ts ? String(e.server_ts).slice(0, 19) : '—',
            e.lcp ?? '—',
            e.cls ?? '—',
            e.inp ?? '—',
            e.load_event ?? '—',
            e.ttfb ?? '—',
        ];

        // Append ID and session first
        fields.slice(0, 2).forEach((val) => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        });

        // ── Event type badge goes here (3rd column) ──
        const typeTd = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = e.event_type;
        const colors = {
            pageview: '#58a6ff',
            vitals: '#3fb950',
            error: '#f85149',
            click: '#d29922',
            scroll_depth: '#a371f7',
            scroll_final: '#a371f7',
        };
        const c = colors[e.event_type] || '#7d8590';
        badge.style.background = c + '22';
        badge.style.color = c;
        typeTd.appendChild(badge);
        tr.appendChild(typeTd);

        // ── Remaining fields after event type ──
        fields.slice(2).forEach((val) => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// View: Reports
async function renderReports() {
    showLoading();
    const data = await apiFetch('/api/reports');
    if (!data) return;

    const reports = data.data || [];
    const isViewer = window.SESSION_ROLE === 'viewer';
    const canCreate = window.SESSION_ROLE === 'super_admin' || window.SESSION_ROLE === 'analyst';
    const content = document.getElementById('content');

    content.innerHTML = `
        <div class="page-title">${isViewer ? 'Stakeholder Briefings' : 'Reports'}</div>

        ${canCreate ? `
        <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
            <button id="create-report-btn" class="btn-primary">
                + Create Report
            </button>
        </div>` : ''}

        <div class="panel">
            <div class="panel-header">
                ${isViewer ? 'Reports shared with you' : 'Your saved reports'}
            </div>

            ${reports.length === 0 ? `
            <div style="text-align:center;padding:60px;color:var(--text-dim);">
                <div style="font-size:40px;margin-bottom:12px;">📋</div>
                <div style="font-size:16px;margin-bottom:8px;">
                    ${isViewer ? 'No reports have been shared with you yet.' : 'No reports yet.'}
                </div>
                ${canCreate ? '<div style="font-size:13px;">Click "+ Create Report" to build your first report.</div>' : ''}
            </div>` : `
            <div id="reports-list">
                ${reports.map(r => renderReportCard(r, isViewer)).join('')}
            </div>`}
        </div>
    `;

    // Attach create button
    if (canCreate) {
        document.getElementById('create-report-btn')
            ?.addEventListener('click', () => openReportBuilder(null));
    }

    // Attach view/delete buttons
    reports.forEach(r => {
        document.getElementById(`view-report-${r.id}`)
            ?.addEventListener('click', () => openReportBriefing(r));

        if (canCreate) {
            document.getElementById(`delete-report-${r.id}`)
                ?.addEventListener('click', () => deleteReport(r.id, r.title));

            document.getElementById(`edit-report-${r.id}`)
                ?.addEventListener('click', () => openReportBuilder(r));
        }
    });
}

function renderReportCard(r, isViewer) {
    const snapshot = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
    const dateRange = r.date_start
        ? `${r.date_start} → ${r.date_end}`
        : 'All time';
    const sectionColors = {
        overview:    '#58a6ff',
        performance: '#3fb950',
        errors:      '#f85149',
        rawdata:     '#a371f7'
    };
    const sectionColor = sectionColors[r.section] || '#7d8590';

    return `
        <div class="report-card" style="
            border:1px solid var(--border);
            border-radius:8px;
            padding:20px;
            margin-bottom:12px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:16px;
        ">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                    <span style="
                        background:${sectionColor}22;
                        color:${sectionColor};
                        font-size:11px;
                        font-weight:600;
                        padding:2px 8px;
                        border-radius:4px;
                        text-transform:uppercase;
                        letter-spacing:0.5px;
                    ">${r.section}</span>
                    <span style="color:var(--text-dim);font-size:12px;">${dateRange}</span>
                </div>
                <div style="font-size:16px;font-weight:600;margin-bottom:4px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${escapeHtml(r.title)}
                </div>
                <div style="font-size:13px;color:var(--text-dim);">
                    Prepared by ${escapeHtml(r.created_by_name || 'Unknown')} ·
                    ${new Date(r.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                    })}
                </div>
                ${snapshot?.takeaway ? `
                <div style="
                    margin-top:8px;
                    font-size:13px;
                    color:var(--text-muted);
                    font-style:italic;
                    overflow:hidden;
                    text-overflow:ellipsis;
                    white-space:nowrap;
                ">"${escapeHtml(snapshot.takeaway)}"</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button id="view-report-${r.id}" class="btn-secondary" style="font-size:13px;">
                    View
                </button>
                ${!isViewer ? `
                <button id="edit-report-${r.id}" class="btn-secondary" style="font-size:13px;">
                    Edit
                </button>
                <button id="delete-report-${r.id}" class="btn-danger" style="font-size:13px;">
                    Delete
                </button>` : ''}
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function deleteReport(id, title) {
    if (!confirm(`Delete report "${title}"? This cannot be undone.`)) return;
    const data = await apiRequest(`/api/reports/${id}`, 'DELETE');
    if (!data) return;
    if (data.success) {
        renderReports();
    } else {
        alert('Failed to delete report: ' + data.error);
    }
}

// openReportBuilder in report-builder.js

// opemReportBriefing in report-briefing.js

// View: Admin
async function renderAdmin() {
    showLoading();
    const res = await apiFetch('/users-admin.php');
    if (!res) return;

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
              <option value="analyst">Analyst</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div class="form-group" id="sections-group" style="display:none;">
              <label>Assigned Sections</label>
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
                  <label style="text-transform:none;font-size:13px;">
                      <input type="checkbox" value="overview"> Overview
                  </label>
                  <label style="text-transform:none;font-size:13px;">
                      <input type="checkbox" value="performance"> Performance
                  </label>
                  <label style="text-transform:none;font-size:13px;">
                      <input type="checkbox" value="errors"> Errors
                  </label>
                  <label style="text-transform:none;font-size:13px;">
                      <input type="checkbox" value="rawdata"> Raw Data
                  </label>
              </div>
          </div>
        </div>
        <button class="btn btn-primary btn-full" id="add-user-btn">Add User</button>
        <div id="add-user-msg" style="margin-top:10px;font-family:var(--font-mono);font-size:12px;"></div>
      </div>
    </div>
  `;

    renderUsersTable(res.data || []);

    document.getElementById('add-user-btn').addEventListener('click', async () => {
        const username = document.getElementById('new-username').value.trim();
        const email = document.getElementById('new-email').value.trim();
        const display = document.getElementById('new-display').value.trim();
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;
        const msgEl = document.getElementById('add-user-msg');

        const sections = role === 'analyst'
          ? [...document.querySelectorAll('#sections-group input:checked')]
              .map(cb => cb.value)
          : [];

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
                body: JSON.stringify({ username, email, display_name: display, password, role, sections }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                msgEl.style.color = 'var(--accent2)';
                msgEl.textContent = 'User created successfully.';
                document.getElementById('new-username').value = '';
                document.getElementById('new-email').value = '';
                document.getElementById('new-display').value = '';
                document.getElementById('new-password').value = '';
                // Refresh table
                const updated = await apiFetch('/users-admin.php');
                if (updated) renderUsersTable(updated.data || []);
            } else {
                msgEl.style.color = 'var(--danger)';
                msgEl.textContent = data.error || 'Failed to create user.';
            }
        } catch (err) {
            msgEl.style.color = 'var(--danger)';
            msgEl.textContent = 'Network error.';
        }
    });
    document.getElementById('new-role').addEventListener('change', (e) => {
      document.getElementById('sections-group').style.display =
          e.target.value === 'analyst' ? 'block' : 'none';
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
    users.forEach((u) => {
        const tr = document.createElement('tr');

        [
            u.username,
            u.email,
            u.display_name || '—',
            u.role,
            u.last_login ? String(u.last_login).slice(0, 10) : 'Never',
        ].forEach((val) => {
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
            const res = await fetch(
                '/users-admin.php?id=' + u.id + '&self=' + window.SESSION_USER_ID,
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );
            const data = await res.json();
            if (data.success) {
                const updated = await apiFetch('/users-admin.php');
                if (updated) renderUsersTable(updated.data || []);
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
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);
    el.appendChild(wrap);
}

// Init
function init() {
    initDatePicker();

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/logout.php', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.php';
    });

    document.getElementById('hamburger')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });

    window.addEventListener('hashchange', route);

    // For viewers, force reports immediately before any routing
    if (window.SESSION_ROLE === 'viewer') {
        window.location.hash = '#/reports';
        renderReports();
        return;
    }

    route();
}

document.addEventListener('DOMContentLoaded', init);
