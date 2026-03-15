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
            'X-User-Name': window.SESSION_NAME || '',
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
            'X-User-Name': window.SESSION_NAME || '',
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
        case '/behavior':
            if (!canAccess('behavior')) {
                showError('You are not assigned to the Behavior section.');
                return;
            }
            const { start: s4, end: e4 } = getDateRange();
            renderBehavior(s4, e4);
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

function destroyAllCharts() {
    Object.keys(chartInstances).forEach(id => {
        try {
            chartInstances[id].destroy();
        } catch (e) {
            // ignore
        }
        delete chartInstances[id];
    });
}

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

    const labels = data.map((d) => {
    const raw = String(d[xKey]);
        // Handle both '2026-02-28' and '2026-02-28T00:00:00.000Z'
        const dateOnly = raw.slice(0, 10); // always gets YYYY-MM-DD
        return dateOnly.slice(5); // returns MM-DD
    });
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
    destroyAllCharts();
    showLoading();

    const [summary, pv, sessionOverTime, eventTypesRes] = await Promise.all([
        apiFetch(`/api/dashboard?start=${start}&end=${end}`),
        apiFetch(`/api/pageviews?start=${start}&end=${end}`),
        apiFetch(`/api/sessions-over-time?start=${start}&end=${end}`),
        apiFetch(`/api/event-types?start=${start}&end=${end}`),
    ]);

    if (!summary) return;

    const s        = summary.data;
    const byDay    = pv?.data?.byDay    || [];
    const topPages = pv?.data?.topPages || [];
    const sotData  = sessionOverTime?.data || [];

    // Event type breakdown from raw events
    const eventTypeData = eventTypesRes?.data || [];

    // Comments panel
    const commentsHTML = await renderCommentsPanel('overview', start, end);

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="page-title">Overview</div>

        <!-- Summary Cards -->
        <div class="cards-grid" id="cards"></div>

        <!-- Pageviews + Sessions dual line -->
        <div class="panel">
            ${panelHeader('Pageviews & Sessions Over Time', sotData, 'pageviews-sessions.csv')}
            <div class="panel-body" style="position:relative;min-height:220px;">
                <canvas id="pv-chart"></canvas>
            </div>
        </div>

        <!-- Top Pages + Event Types side by side -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" class="chart-row">
            <div class="panel">
                ${panelHeader('Top Pages', topPages, 'top-pages.csv')}
                <div class="panel-body" style="position:relative;min-height:220px;">
                    <canvas id="top-pages-chart"></canvas>
                </div>
            </div>
            <div class="panel">
                ${panelHeader('Event Type Breakdown', eventTypeData, 'event-types.csv')}
                <div class="panel-body" style="position:relative;min-height:220px;">
                    <canvas id="event-types-chart"></canvas>
                </div>
            </div>
        </div>

        <!-- Top Pages Table -->
        <div class="panel">
            ${panelHeader('Top Pages Detail', topPages, 'top-pages-detail.csv')}
            <div id="top-pages-table"></div>
        </div>

        <!-- Comments -->
        ${commentsHTML}
    `;

    // -- Summary Cards --
    const cards = [
        { label: 'Pageviews',    value: Number(s.total_pageviews  || 0).toLocaleString() },
        { label: 'Sessions',     value: Number(s.total_sessions   || 0).toLocaleString() },
        { label: 'Avg Load',     value: Math.round(s.avg_load_time_ms || 0) + ' ms'      },
        { label: 'JS Errors',    value: Number(s.total_errors     || 0).toLocaleString() },
    ];
    const cardsEl = document.getElementById('cards');
    cards.forEach(c => {
        const card = document.createElement('div');
        card.className = 'metric-card';
        card.innerHTML = `
            <div class="metric-label">${c.label}</div>
            <div class="metric-value">${c.value}</div>
        `;
        cardsEl.appendChild(card);
    });

    // -- Dual Line Chart: Pageviews + Sessions --
    if (chartInstances['pv-chart']) {
        chartInstances['pv-chart'].destroy();
        delete chartInstances['pv-chart'];
    }
    const pvCanvas = document.getElementById('pv-chart');
    if (pvCanvas && sotData.length > 0) {
        const labels = sotData.map(d => String(d.day).slice(0, 10).slice(5));
        chartInstances['pv-chart'] = new Chart(pvCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Pageviews',
                        data: sotData.map(d => Number(d.pageviews)),
                        borderColor: '#58a6ff',
                        backgroundColor: '#58a6ff22',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: true,
                        tension: 0.3,
                    },
                    {
                        label: 'Sessions',
                        data: sotData.map(d => Number(d.sessions)),
                        borderColor: '#3fb950',
                        backgroundColor: '#3fb95022',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: true,
                        tension: 0.3,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#7d8590', font: { size: 11 } }
                    },
                },
                scales: {
                    x: { ticks: { color: '#7d8590', font: { size: 10 } }, grid: { color: '#21262d' } },
                    y: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                },
            },
        });
    } else if (pvCanvas && byDay.length > 0) {
        // Fallback to single line if sessions-over-time endpoint not available
        drawLineChart('pv-chart', byDay, 'day', 'views', '#58a6ff');
    }

    // -- Top Pages Horizontal Bar --
    if (chartInstances['top-pages-chart']) {
        chartInstances['top-pages-chart'].destroy();
        delete chartInstances['top-pages-chart'];
    }
    const tpCanvas = document.getElementById('top-pages-chart');
    if (tpCanvas && topPages.length > 0) {
        const tpLabels = topPages.slice(0, 8).map(p =>
            p.url.replace('https://test.jgamba.site', '') || '/'
        );
        chartInstances['top-pages-chart'] = new Chart(tpCanvas, {
            type: 'bar',
            data: {
                labels: tpLabels,
                datasets: [{
                    data: topPages.slice(0, 8).map(p => Number(p.views)),
                    backgroundColor: '#58a6ff44',
                    borderColor: '#58a6ff',
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { ticks: { color: '#7d8590', font: { size: 10 } }, grid: { display: false } },
                },
            },
        });
    }

    // -- Event Type Breakdown Horizontal Bar 
    if (chartInstances['event-types-chart']) {
        chartInstances['event-types-chart'].destroy();
        delete chartInstances['event-types-chart'];
    }
    const etCanvas = document.getElementById('event-types-chart');
    if (etCanvas && eventTypeData.length > 0) {
        const etColors = {
            pageview:     '#58a6ff',
            vitals:       '#3fb950',
            error:        '#f85149',
            click:        '#d29922',
            scroll_depth: '#a371f7',
            scroll_final: '#a371f7',
        };
        chartInstances['event-types-chart'] = new Chart(etCanvas, {
            type: 'bar',
            data: {
                labels: eventTypeData.map(e => e.type),
                datasets: [{
                    data: eventTypeData.map(e => e.count),
                    backgroundColor: eventTypeData.map(e =>
                        (etColors[e.type] || '#7d8590') + '44'
                    ),
                    borderColor: eventTypeData.map(e =>
                        etColors[e.type] || '#7d8590'
                    ),
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { ticks: { color: '#7d8590', font: { size: 10 } }, grid: { display: false } },
                },
            },
        });
    }

    // -- Top Pages Table 
    const tableEl = document.getElementById('top-pages-table');
    if (!topPages || topPages.length === 0) {
        tableEl.innerHTML = '<div class="empty-state">No pageview data yet</div>';
    } else {
        const wrap  = document.createElement('div');
        wrap.className = 'table-wrap';
        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = '<thead><tr><th>URL</th><th>Views</th></tr></thead>';
        const tbody = document.createElement('tbody');
        topPages.forEach(p => {
            const tr    = document.createElement('tr');
            const tdUrl = document.createElement('td');
            tdUrl.textContent = p.url;
            const tdViews = document.createElement('td');
            tdViews.textContent = Number(p.views).toLocaleString();
            tr.appendChild(tdUrl);
            tr.appendChild(tdViews);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        tableEl.appendChild(wrap);
    }
}

// View: Performance
async function renderPerformance(start, end) {
    destroyAllCharts();
    showLoading();

    const [perfData, distData] = await Promise.all([
        apiFetch(`/api/performance?start=${start}&end=${end}`),
        apiFetch(`/api/performance/distribution?start=${start}&end=${end}`),
    ]);

    if (!perfData) return;

    const byPage   = perfData.data?.byPage || [];
    const distRows = distData?.data        || [];

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

    // Scatter data — one point per page
    const scatterData = byPage
        .filter(r => r.avg_ttfb_ms && r.avg_load_ms)
        .map(r => ({
            x:     Number(r.avg_ttfb_ms),
            y:     Number(r.avg_load_ms),
            label: r.url.replace('https://test.jgamba.site', '') || '/',
        }));

    // Comments panel
    const commentsHTML = await renderCommentsPanel('performance', start, end);

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="page-title">Performance</div>

        <!-- Vitals summary cards -->
        <div class="vitals-grid" id="vitals"></div>

        <!-- Small multiples — 3 separate vitals charts -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:20px;" class="chart-row-3">
            <div class="panel">
                ${panelHeader('LCP', [{ metric: 'LCP', value: Math.round(avgLcp), unit: 'ms' }], 'lcp.csv')}
                <div class="panel-body" style="position:relative;min-height:180px;">
                    <canvas id="lcp-chart"></canvas>
                </div>
            </div>
            <div class="panel">
                ${panelHeader('CLS', [{ metric: 'CLS', value: avgCls.toFixed(4) }], 'cls.csv')}
                <div class="panel-body" style="position:relative;min-height:180px;">
                    <canvas id="cls-chart"></canvas>
                </div>
            </div>
            <div class="panel">
                ${panelHeader('INP', [{ metric: 'INP', value: Math.round(avgInp), unit: 'ms' }], 'inp.csv')}
                <div class="panel-body" style="position:relative;min-height:180px;">
                    <canvas id="inp-chart"></canvas>
                </div>
            </div>
        </div>

        <!-- TTFB vs Load Scatter + Speed Distribution side by side -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" class="chart-row">
            <div class="panel">
                ${panelHeader('TTFB vs Load Time', scatterData.map(d => ({ page: d.label, ttfb_ms: d.x, load_ms: d.y })), 'ttfb-vs-load.csv')}
                <div class="panel-body" style="position:relative;min-height:240px;">
                    <canvas id="scatter-chart"></canvas>
                </div>
            </div>
            <div class="panel">
                ${panelHeader('Page Speed Distribution', distRows, 'speed-distribution.csv')}
                <div class="panel-body" style="position:relative;min-height:240px;">
                    <canvas id="dist-chart"></canvas>
                </div>
            </div>
        </div>

        <!-- Per-page breakdown table -->
        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('Per-Page Breakdown', byPage, 'performance-by-page.csv')}
            <div id="perf-table"></div>
        </div>

        <!-- Comments -->
        ${commentsHTML}
    `;

    // ── Vitals Summary Cards ──────────────────────────────
    const vitals = [
        { name: 'LCP', key: 'lcp', value: avgLcp, display: Math.round(avgLcp) + 'ms' },
        { name: 'CLS', key: 'cls', value: avgCls, display: avgCls.toFixed(3)          },
        { name: 'INP', key: 'inp', value: avgInp, display: Math.round(avgInp) + 'ms'  },
    ];
    const vitalsEl = document.getElementById('vitals');
    vitals.forEach(v => {
        const color = vitalColor(v.key, v.value);
        const label = vitalLabel(v.key, v.value);
        const card  = document.createElement('div');
        card.className = 'vital-card';
        card.innerHTML = `
            <div class="vital-name">${v.name}</div>
            <div class="vital-value" style="color:${color}">${v.display}</div>
            <span class="vital-badge" style="background:${color}22;color:${color}">${label}</span>
        `;
        vitalsEl.appendChild(card);
    });

    // ── Small Multiples — vitals with threshold bands ─────
    function drawVitalChart(canvasId, metric, value, thresholds, unit) {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
            delete chartInstances[canvasId];
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const color = vitalColor(metric, value);
        const label = vitalLabel(metric, value);
        const [good, poor] = thresholds;

        // Max axis value — give room above worst threshold
        const axisMax = Math.max(value * 1.4, poor * 1.3);

        chartInstances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: [metric.toUpperCase()],
                datasets: [
                    {
                        // Actual value bar
                        label: label,
                        data: [value],
                        backgroundColor: color + '99',
                        borderColor: color,
                        borderWidth: 2,
                        borderRadius: 4,
                        barThickness: 60,
                        order: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.parsed.y}${unit} — ${label}`
                        }
                    },
                    annotation: {
                        annotations: {
                            goodLine: {
                                type: 'line',
                                yMin: good,
                                yMax: good,
                                borderColor: '#3fb950',
                                borderWidth: 1,
                                borderDash: [4, 4],
                                label: {
                                    display: true,
                                    content: `Good < ${good}${unit}`,
                                    position: 'end',
                                    color: '#3fb950',
                                    font: { size: 10 },
                                    backgroundColor: 'transparent',
                                }
                            },
                            poorLine: {
                                type: 'line',
                                yMin: poor,
                                yMax: poor,
                                borderColor: '#f85149',
                                borderWidth: 1,
                                borderDash: [4, 4],
                                label: {
                                    display: true,
                                    content: `Poor > ${poor}${unit}`,
                                    position: 'end',
                                    color: '#f85149',
                                    font: { size: 10 },
                                    backgroundColor: 'transparent',
                                }
                            },
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#7d8590' },
                        grid:  { display: false },
                    },
                    y: {
                        beginAtZero: true,
                        max: axisMax,
                        ticks: {
                            color: '#7d8590',
                            callback: v => v + unit,
                        },
                        grid: { color: '#21262d' },
                    },
                },
            },
        });
    }

    // Chart.js annotation plugin — load it if not already loaded
    drawVitalChart('lcp-chart', 'lcp', avgLcp, [2500, 4000], 'ms');
    drawVitalChart('cls-chart', 'cls', avgCls, [0.1,  0.25], '');
    drawVitalChart('inp-chart', 'inp', avgInp, [200,  500],  'ms');

    // ── TTFB vs Load Scatter ──────────────────────────────
    if (chartInstances['scatter-chart']) {
        chartInstances['scatter-chart'].destroy();
        delete chartInstances['scatter-chart'];
    }
    const scatterCanvas = document.getElementById('scatter-chart');
    if (scatterCanvas && scatterData.length > 0) {
        chartInstances['scatter-chart'] = new Chart(scatterCanvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Pages',
                    data: scatterData,
                    backgroundColor: scatterData.map(d =>
                        d.y > 3000 ? '#f8514999' :
                        d.y > 1500 ? '#d2992299' : '#3fb95099'
                    ),
                    pointRadius: 7,
                    pointHoverRadius: 9,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const d = ctx.raw;
                                return [
                                    d.label,
                                    `TTFB: ${d.x}ms`,
                                    `Load: ${d.y}ms`,
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'TTFB (ms)',
                            color: '#7d8590',
                            font: { size: 11 },
                        },
                        ticks: { color: '#7d8590', callback: v => v + 'ms' },
                        grid:  { color: '#21262d' },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Load Time (ms)',
                            color: '#7d8590',
                            font: { size: 11 },
                        },
                        beginAtZero: true,
                        ticks: { color: '#7d8590', callback: v => v + 'ms' },
                        grid: { color: '#21262d' },
                    },
                },
            },
        });
    } else if (scatterCanvas) {
        scatterCanvas.parentElement.innerHTML =
            '<div class="empty-state">Not enough data for scatter plot</div>';
    }

    // ── Speed Distribution Histogram ──────────────────────
    if (chartInstances['dist-chart']) {
        chartInstances['dist-chart'].destroy();
        delete chartInstances['dist-chart'];
    }
    const distCanvas = document.getElementById('dist-chart');
    const bucketOrder = ['0-500ms', '500ms-1s', '1-2s', '2-3s', '3s+'];
    const sortedDist  = bucketOrder.map(b =>
        distRows.find(r => r.bucket === b) || { bucket: b, count: 0 }
    );
    if (distCanvas) {
        chartInstances['dist-chart'] = new Chart(distCanvas, {
            type: 'bar',
            data: {
                labels: sortedDist.map(r => r.bucket),
                datasets: [{
                    data: sortedDist.map(r => Number(r.count)),
                    backgroundColor: [
                        '#3fb95044', '#3fb95044',
                        '#d2992244',
                        '#f8514944', '#f8514944',
                    ],
                    borderColor: [
                        '#3fb950', '#3fb950',
                        '#d29922',
                        '#f85149', '#f85149',
                    ],
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.parsed.y} page loads`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#7d8590' },
                        grid: { color: '#21262d' },
                    },
                },
            },
        });
    }

    // ── Per-page Table ────────────────────────────────────
    const tableEl = document.getElementById('perf-table');
    if (byPage.length === 0) {
        tableEl.innerHTML = '<div class="empty-state">No performance data yet</div>';
    } else {
        const wrap  = document.createElement('div');
        wrap.className = 'table-wrap';
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
                    <th>INP (ms)</th>
                    <th>Samples</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');
        byPage.forEach(r => {
            const tr = document.createElement('tr');
            if (Number(r.avg_load_ms) > 3000) tr.classList.add('row-slow');
            [
                r.url.replace('https://test.jgamba.site', '') || '/',
                r.avg_load_ms  ?? '—',
                r.avg_ttfb_ms  ?? '—',
                r.avg_lcp      ?? '—',
                r.avg_cls != null ? Number(r.avg_cls).toFixed(3) : '—',
                r.avg_inp      ?? '—',
                r.samples,
            ].forEach(val => {
                const td = document.createElement('td');
                td.textContent = val;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        tableEl.appendChild(wrap);
    }
}

// View: Errors
async function renderErrors(start, end) {
    destroyAllCharts();
    showLoading();

    const [errData, byTypeData, byPageData, byElementData, detailData, rateData, serverLogsData] =
    await Promise.all([
        apiFetch(`/api/errors?start=${start}&end=${end}`),
        apiFetch(`/api/errors/by-type?start=${start}&end=${end}`),
        apiFetch(`/api/errors/by-page?start=${start}&end=${end}`),
        apiFetch(`/api/errors/by-element?start=${start}&end=${end}`),
        apiFetch(`/api/errors/detail?start=${start}&end=${end}`),
        apiFetch(`/api/errors/rate?start=${start}&end=${end}`),
        apiFetch(`/api/errors/server-logs?start=${start}&end=${end}`),
    ]);

    const serverLogs = serverLogsData?.data || null;

    const byMessage  = errData?.data?.byMessage  || [];
    const trend      = errData?.data?.trend       || [];
    const byType     = byTypeData?.data           || [];
    const byPage     = byPageData?.data           || [];
    const byElement  = byElementData?.data        || [];
    const detail     = detailData?.data           || [];
    const rateRows   = rateData?.data             || [];

    const total         = byMessage.reduce((s, r) => s + Number(r.occurrences), 0);
    const mostAffected  = byPage.length   ? byPage[0].url.replace('https://test.jgamba.site', '') || '/' : '—';
    const topErrorType  = byType.length   ? byType[0].error_type  : '—';
    const avgRate       = rateRows.length
        ? (rateRows.reduce((a, r) => a + Number(r.error_rate || 0), 0) / rateRows.length).toFixed(2)
        : '0';

    // Comments panel
    const commentsHTML = await renderCommentsPanel('errors', start, end);

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="page-title">Errors</div>

        <!-- Summary Cards -->
        <div class="cards-grid" id="error-cards"></div>

        <!-- Error Trend + Error Rate side by side -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" class="chart-row">
            <div class="panel">
                ${panelHeader('Error Trend', trend, 'error-trend.csv')}
                <div class="panel-body" style="position:relative;min-height:200px;">
                    <canvas id="err-chart"></canvas>
                </div>
            </div>
            <div class="panel">
                ${panelHeader('Error Rate (% of Pageviews)', rateRows, 'error-rate.csv')}
                <div class="panel-body" style="position:relative;min-height:200px;">
                    <canvas id="rate-chart"></canvas>
                </div>
            </div>
        </div>

        <!-- By Type + By Element side by side -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" class="chart-row">
            <div class="panel">
                ${panelHeader('Errors by Type', byType, 'errors-by-type.csv')}
                <div class="panel-body" style="position:relative;min-height:200px;">
                    <canvas id="type-chart"></canvas>
                </div>
            </div>
            <div class="panel">
                ${panelHeader('Errors by Element', byElement, 'errors-by-element.csv')}
                <div class="panel-body" style="position:relative;min-height:200px;">
                    <canvas id="element-chart"></canvas>
                </div>
            </div>
        </div>

        <!-- Errors by Page -->
        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('Errors by Page', byPage, 'errors-by-page.csv')}
            <div class="panel-body" style="position:relative;min-height:200px;">
                <canvas id="page-chart"></canvas>
            </div>
        </div>

        <!-- Detailed Error Log -->
        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('Error Detail Log', detail, 'error-detail.csv')}
            <div id="err-detail-table"></div>
        </div>

        <!-- Legacy grouped by message -->
        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('Errors by Message', byMessage, 'errors-by-message.csv')}
            <div id="err-table"></div>
        </div>

        <!-- Server Log Errors -->
        ${serverLogs ? `
        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('HTTP Server Errors', serverLogs.recent, 'server-errors.csv')}
            <div style="padding:14px 20px;border-bottom:1px solid var(--border);
                display:flex;gap:20px;flex-wrap:wrap;">
                <span style="font-family:var(--font-mono);font-size:12px;">
                    <span style="color:var(--danger);font-weight:600;">
                        ${serverLogs.real_errors}
                    </span>
                    <span style="color:var(--text-dim);"> real errors</span>
                </span>
                <span style="font-family:var(--font-mono);font-size:12px;">
                    <span style="color:var(--warn);font-weight:600;">
                        ${serverLogs.bot_scans}
                    </span>
                    <span style="color:var(--text-dim);"> bot scans filtered</span>
                </span>
                ${serverLogs.by_status.map(s => `
                <span style="font-family:var(--font-mono);font-size:12px;">
                    <span style="color:${s.status >= 500 ? 'var(--danger)' : 'var(--warn)'};
                        font-weight:600;">${s.status}</span>
                    <span style="color:var(--text-dim);"> ×${s.count}</span>
                </span>`).join('')}
            </div>
            <div id="server-log-table"></div>
        </div>` : ''}
        <!-- Comments -->
        ${commentsHTML}
    `;

    // ── Summary Cards ─────────────────────────────────────
    const cardData = [
        { label: 'Total Errors',    value: total.toLocaleString(),    color: 'var(--danger)' },
        { label: 'Avg Error Rate',  value: avgRate + '%',             color: 'var(--warn)'   },
        { label: 'Most Affected',   value: mostAffected,              color: null            },
        { label: 'Top Error Type',  value: topErrorType,              color: null            },
    ];
    const cardsEl = document.getElementById('error-cards');
    cardData.forEach(c => {
        const card = document.createElement('div');
        card.className = 'metric-card';
        card.innerHTML = `
            <div class="metric-label">${c.label}</div>
            <div class="metric-value" style="${c.color ? `color:${c.color}` : ''};
                font-size:${c.value.length > 12 ? '14px' : '28px'};">
                ${c.value}
            </div>
        `;
        cardsEl.appendChild(card);
    });

    // ── Error Trend Line ──────────────────────────────────
    drawLineChart('err-chart', trend, 'day', 'error_count', '#f85149');

    // ── Error Rate Line ───────────────────────────────────
    drawLineChart('rate-chart', rateRows, 'day', 'error_rate', '#d29922');

    // ── Errors by Type Horizontal Bar ────────────────────
    if (chartInstances['type-chart']) {
        chartInstances['type-chart'].destroy();
        delete chartInstances['type-chart'];
    }
    const typeCanvas = document.getElementById('type-chart');
    if (typeCanvas && byType.length > 0) {
        const typeColors = {
            'resource-error':       '#d29922',
            'js-error':             '#f85149',
            'unhandled-rejection':  '#a371f7',
            'unknown':              '#7d8590',
        };
        chartInstances['type-chart'] = new Chart(typeCanvas, {
            type: 'bar',
            data: {
                labels: byType.map(t => t.error_type),
                datasets: [{
                    data: byType.map(t => Number(t.count)),
                    backgroundColor: byType.map(t =>
                        (typeColors[t.error_type] || '#7d8590') + '44'
                    ),
                    borderColor: byType.map(t =>
                        typeColors[t.error_type] || '#7d8590'
                    ),
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { ticks: { color: '#7d8590' }, grid: { display: false } },
                },
            },
        });
    } else if (typeCanvas) {
        typeCanvas.parentElement.innerHTML =
            '<div class="empty-state">No error type data</div>';
    }

    // ── Errors by Element Horizontal Bar ──────────────────
    if (chartInstances['element-chart']) {
        chartInstances['element-chart'].destroy();
        delete chartInstances['element-chart'];
    }
    const elCanvas = document.getElementById('element-chart');
    if (elCanvas && byElement.length > 0) {
        chartInstances['element-chart'] = new Chart(elCanvas, {
            type: 'bar',
            data: {
                labels: byElement.map(e => e.element_type),
                datasets: [{
                    data: byElement.map(e => Number(e.count)),
                    backgroundColor: '#58a6ff44',
                    borderColor: '#58a6ff',
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { ticks: { color: '#7d8590' }, grid: { display: false } },
                },
            },
        });
    } else if (elCanvas) {
        elCanvas.parentElement.innerHTML =
            '<div class="empty-state">No element error data</div>';
    }

    // ── Errors by Page Horizontal Bar ─────────────────────
    if (chartInstances['page-chart']) {
        chartInstances['page-chart'].destroy();
        delete chartInstances['page-chart'];
    }
    const pageCanvas = document.getElementById('page-chart');
    if (pageCanvas && byPage.length > 0) {
        const pageLabels = byPage.map(p =>
            p.url.replace('https://test.jgamba.site', '') || '/'
        );
        chartInstances['page-chart'] = new Chart(pageCanvas, {
            type: 'bar',
            data: {
                labels: pageLabels,
                datasets: [{
                    label: 'Errors',
                    data: byPage.map(p => Number(p.count)),
                    backgroundColor: '#f8514944',
                    borderColor: '#f85149',
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.parsed.x} errors`
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { ticks: { color: '#7d8590', font: { size: 10 } }, grid: { display: false } },
                },
            },
        });
    } else if (pageCanvas) {
        pageCanvas.parentElement.innerHTML =
            '<div class="empty-state">No page error data</div>';
    }

    // ── Detail Error Log Table ────────────────────────────
    const detailEl = document.getElementById('err-detail-table');
    if (!detail || detail.length === 0) {
        detailEl.innerHTML = '<div class="empty-state">No errors recorded 🎉</div>';
    } else {
        const wrap  = document.createElement('div');
        wrap.className = 'table-wrap';
        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Element</th>
                    <th>Page</th>
                    <th>Detail</th>
                    <th>Session</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');
        detail.forEach(r => {
            const tr = document.createElement('tr');
            const typeColors = {
                'resource-error':      '#d29922',
                'js-error':            '#f85149',
                'unhandled-rejection': '#a371f7',
            };
            const tcolor = typeColors[r.error_type] || '#7d8590';

            // Time
            const tdTime = document.createElement('td');
            tdTime.style.fontFamily = 'var(--font-mono)';
            tdTime.style.fontSize   = '11px';
            tdTime.textContent = String(r.server_ts).slice(0, 19);
            tr.appendChild(tdTime);

            // Type badge
            const tdType = document.createElement('td');
            const badge  = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = r.error_type;
            badge.style.background = tcolor + '22';
            badge.style.color      = tcolor;
            tdType.appendChild(badge);
            tr.appendChild(tdType);

            // Element
            const tdEl = document.createElement('td');
            tdEl.textContent = r.element_type || '—';
            tr.appendChild(tdEl);

            // Page
            const tdPage = document.createElement('td');
            tdPage.textContent = r.url
                ? r.url.replace('https://test.jgamba.site', '') || '/'
                : '—';
            tr.appendChild(tdPage);

            // Detail
            const tdDetail = document.createElement('td');
            tdDetail.style.maxWidth   = '200px';
            tdDetail.style.overflow   = 'hidden';
            tdDetail.style.textOverflow = 'ellipsis';
            tdDetail.style.whiteSpace = 'nowrap';
            tdDetail.textContent = r.error_detail || '—';
            tr.appendChild(tdDetail);

            // Session
            const tdSess = document.createElement('td');
            tdSess.style.fontFamily = 'var(--font-mono)';
            tdSess.style.fontSize   = '11px';
            tdSess.textContent = r.session_id
                ? String(r.session_id).slice(0, 12) + '…'
                : '—';
            tr.appendChild(tdSess);

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        detailEl.appendChild(wrap);
    }

    // ── Legacy Grouped by Message Table ──────────────────
    const tableEl = document.getElementById('err-table');
    if (!byMessage || byMessage.length === 0) {
        tableEl.innerHTML = '<div class="empty-state">No grouped error data</div>';
    } else {
        const wrap  = document.createElement('div');
        wrap.className = 'table-wrap';
        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr><th>Message</th><th>Count</th><th>Last Seen</th></tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');
        byMessage.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'clickable';

            const tdMsg = document.createElement('td');
            const short = String(r.error_message || '(unknown)').slice(0, 80);
            tdMsg.textContent = short +
                (r.error_message && r.error_message.length > 80 ? '…' : '');

            const tdCount = document.createElement('td');
            tdCount.textContent = Number(r.occurrences).toLocaleString();

            const tdDate = document.createElement('td');
            tdDate.textContent = r.last_seen || '—';

            tr.appendChild(tdMsg);
            tr.appendChild(tdCount);
            tr.appendChild(tdDate);

            const detailTr = document.createElement('tr');
            detailTr.className = 'detail-row';
            const detailTd = document.createElement('td');
            detailTd.colSpan = 3;
            detailTd.className = 'detail-cell';
            detailTd.textContent = r.error_message || '(no message)';
            detailTr.appendChild(detailTd);

            tr.addEventListener('click', () =>
                detailTr.classList.toggle('open')
            );

            tbody.appendChild(tr);
            tbody.appendChild(detailTr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        tableEl.appendChild(wrap);
    }

    // ── Server Log Table ──────────────────────────────────
    if (serverLogs?.recent?.length > 0) {
        const serverEl = document.getElementById('server-log-table');
        if (serverEl) {
            const wrap  = document.createElement('div');
            wrap.className = 'table-wrap';
            const table = document.createElement('table');
            table.className = 'data-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Method</th>
                        <th>Path</th>
                        <th>IP</th>
                        <th>Referer</th>
                    </tr>
                </thead>
            `;
            const tbody = document.createElement('tbody');
            serverLogs.recent.forEach(r => {
                const tr = document.createElement('tr');
                const statusColor = r.status >= 500 ? '#f85149' :
                                    r.status >= 400 ? '#d29922' : '#7d8590';

                [
                    r.timestamp || '—',
                    null, // badge handled separately
                    r.method,
                    r.path,
                    r.ip,
                    r.referer || '—',
                ].forEach((val, i) => {
                    const td = document.createElement('td');
                    if (i === 0) {
                        td.style.fontFamily = 'var(--font-mono)';
                        td.style.fontSize   = '11px';
                        td.textContent = val;
                    } else if (i === 1) {
                        const badge = document.createElement('span');
                        badge.className = 'badge';
                        badge.textContent = r.status;
                        badge.style.background = statusColor + '22';
                        badge.style.color      = statusColor;
                        td.appendChild(badge);
                    } else {
                        td.style.fontFamily = 'var(--font-mono)';
                        td.style.fontSize   = '11px';
                        td.textContent = val;
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            wrap.appendChild(table);
            serverEl.appendChild(wrap);
        }
    }
}

// View: Raw Data
async function renderRawData() {
    destroyAllCharts();
    showLoading();
    const data = await apiFetch('/api/events');
    if (!data) return;

    const events = data.data || data;
    const content = document.getElementById('content');

    content.innerHTML = `
    <div class="page-title">Raw Event Data</div>
    <div class="panel">
        ${panelHeader('Last 100 Events', events, 'raw-events.csv')}
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
    destroyAllCharts();
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

// CSV Download Helper
function downloadCSV(filename, data) {
    if (!data || data.length === 0) {
        alert('No data to download.');
        return;
    }

    // Build headers from first row keys
    const headers = Object.keys(data[0]);
    const rows = [
        headers.join(','),
        ...data.map(row =>
            headers.map(h => {
                const val = row[h] ?? '';
                // Wrap in quotes if contains comma, quote, or newline
                const str = String(val);
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? `"${str.replace(/"/g, '""')}"`
                    : str;
            }).join(',')
        )
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Comments Panel
async function renderCommentsPanel(section, start, end) {
    // Only show for analysts and super_admin
    if (!['super_admin', 'analyst'].includes(window.SESSION_ROLE)) return '';

    const data = await apiFetch(
        `/api/comments?section=${section}&start=${start}&end=${end}`
    );
    const comments = data?.data || [];

    const canDelete = (commentUserId) =>
        window.SESSION_ROLE === 'super_admin' ||
        String(commentUserId) === String(window.SESSION_USER_ID);

    return `
        <div class="panel" id="comments-panel-${section}" style="margin-bottom:20px;">
            <div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;">
                <span>Analyst Notes</span>
                <span style="font-size:10px;color:var(--text-dim);">
                    ${start} → ${end}
                </span>
            </div>
            <div id="comments-list-${section}" style="padding:0;">
                ${comments.length === 0 ? `
                    <div style="
                        padding:20px 20px;
                        color:var(--text-dim);
                        font-family:var(--font-mono);
                        font-size:12px;
                    ">No notes yet for this date range.</div>
                ` : comments.map(c => `
                    <div class="comment-item" data-id="${c.id}" style="
                        padding:16px 20px;
                        border-bottom:1px solid var(--border);
                        display:flex;
                        gap:12px;
                        align-items:flex-start;
                    ">
                        <div style="
                            width:32px;height:32px;
                            border-radius:50%;
                            background:var(--accent)22;
                            border:1px solid var(--accent)44;
                            display:flex;align-items:center;justify-content:center;
                            font-size:13px;font-weight:700;color:var(--accent);
                            flex-shrink:0;
                        ">${escapeHtml((c.display_name || '?')[0].toUpperCase())}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="
                                display:flex;align-items:center;
                                gap:8px;margin-bottom:4px;
                            ">
                                <span style="font-weight:600;font-size:13px;">
                                    ${escapeHtml(c.display_name || 'Unknown')}
                                </span>
                                <span style="
                                    font-family:var(--font-mono);
                                    font-size:11px;color:var(--text-dim);
                                ">
                                    ${new Date(c.created_at).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </div>
                            <div style="
                                font-size:13px;line-height:1.6;
                                color:var(--text);white-space:pre-wrap;
                            ">${escapeHtml(c.body)}</div>
                        </div>
                        ${canDelete(c.user_id) ? `
                        <button class="comment-delete-btn"
                            data-id="${c.id}"
                            data-section="${section}"
                            data-start="${start}"
                            data-end="${end}"
                            style="
                                background:none;border:none;
                                color:var(--text-dim);font-size:14px;
                                cursor:pointer;padding:4px;
                                flex-shrink:0;
                                transition:color 0.15s;
                            "
                            onmouseover="this.style.color='var(--danger)'"
                            onmouseout="this.style.color='var(--text-dim)'"
                        >✕</button>` : ''}
                    </div>
                `).join('')}
            </div>

            <!-- Add comment form -->
            <div style="padding:16px 20px;border-top:1px solid var(--border);">
                <textarea
                    id="comment-input-${section}"
                    placeholder="Add a note about this data..."
                    rows="2"
                    style="
                        width:100%;padding:10px 12px;
                        background:var(--bg);
                        border:1px solid var(--border2);
                        border-radius:var(--radius);
                        color:var(--text);
                        font-family:var(--font-sans);
                        font-size:13px;
                        outline:none;
                        resize:vertical;
                        transition:border-color 0.15s;
                    "
                    onfocus="this.style.borderColor='var(--accent)'"
                    onblur="this.style.borderColor='var(--border2)'"
                ></textarea>
                <div style="
                    display:flex;justify-content:flex-end;
                    margin-top:8px;gap:8px;align-items:center;
                ">
                    <span id="comment-msg-${section}"
                        style="font-size:12px;font-family:var(--font-mono);flex:1;">
                    </span>
                    <button class="btn-primary comment-post-btn"
                        data-section="${section}"
                        data-start="${start}"
                        data-end="${end}"
                        style="font-size:12px;padding:6px 16px;"
                    >Post Note</button>
                </div>
            </div>
        </div>
    `;
}

// Comment event delegation — add once in init()
function initCommentListeners() {
    document.addEventListener('click', async (e) => {
        // Post comment
        if (e.target.classList.contains('comment-post-btn')) {
            const section = e.target.dataset.section;
            const start   = e.target.dataset.start;
            const end     = e.target.dataset.end;
            const input   = document.getElementById(`comment-input-${section}`);
            const msgEl   = document.getElementById(`comment-msg-${section}`);
            const body    = input?.value?.trim();

            if (!body) {
                msgEl.style.color = 'var(--danger)';
                msgEl.textContent = 'Note cannot be empty.';
                return;
            }

            msgEl.style.color = 'var(--text-dim)';
            msgEl.textContent = 'Posting...';

            const data = await apiRequest('/api/comments', 'POST', {
                section, date_start: start, date_end: end, body
            });

            if (data?.success) {
                input.value = '';
                msgEl.textContent = '';
                // Re-render just the comments list
                await refreshComments(section, start, end);
            } else {
                msgEl.style.color = 'var(--danger)';
                msgEl.textContent = data?.error || 'Failed to post.';
            }
        }

        // Delete comment
        if (e.target.classList.contains('comment-delete-btn')) {
            const id      = e.target.dataset.id;
            const section = e.target.dataset.section;
            const start   = e.target.dataset.start;
            const end     = e.target.dataset.end;

            if (!confirm('Delete this note?')) return;

            const data = await apiRequest(`/api/comments/${id}`, 'DELETE');
            if (data?.success) {
                await refreshComments(section, start, end);
            } else {
                alert(data?.error || 'Failed to delete.');
            }
        }
    });
}

async function refreshComments(section, start, end) {
    const data     = await apiFetch(
        `/api/comments?section=${section}&start=${start}&end=${end}`
    );
    const comments = data?.data || [];
    const listEl   = document.getElementById(`comments-list-${section}`);
    if (!listEl) return;

    const canDelete = (commentUserId) =>
        window.SESSION_ROLE === 'super_admin' ||
        String(commentUserId) === String(window.SESSION_USER_ID);

    if (comments.length === 0) {
        listEl.innerHTML = `
            <div style="
                padding:20px;color:var(--text-dim);
                font-family:var(--font-mono);font-size:12px;
            ">No notes yet for this date range.</div>
        `;
        return;
    }

    listEl.innerHTML = comments.map(c => `
        <div class="comment-item" data-id="${c.id}" style="
            padding:16px 20px;
            border-bottom:1px solid var(--border);
            display:flex;gap:12px;align-items:flex-start;
        ">
            <div style="
                width:32px;height:32px;border-radius:50%;
                background:var(--accent)22;border:1px solid var(--accent)44;
                display:flex;align-items:center;justify-content:center;
                font-size:13px;font-weight:700;color:var(--accent);flex-shrink:0;
            ">${escapeHtml((c.display_name || '?')[0].toUpperCase())}</div>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="font-weight:600;font-size:13px;">
                        ${escapeHtml(c.display_name || 'Unknown')}
                    </span>
                    <span style="
                        font-family:var(--font-mono);font-size:11px;color:var(--text-dim);
                    ">
                        ${new Date(c.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        })}
                    </span>
                </div>
                <div style="
                    font-size:13px;line-height:1.6;
                    color:var(--text);white-space:pre-wrap;
                ">${escapeHtml(c.body)}</div>
            </div>
            ${canDelete(c.user_id) ? `
            <button class="comment-delete-btn"
                data-id="${c.id}"
                data-section="${section}"
                data-start="${start}"
                data-end="${end}"
                style="
                    background:none;border:none;color:var(--text-dim);
                    font-size:14px;cursor:pointer;padding:4px;flex-shrink:0;
                    transition:color 0.15s;
                "
                onmouseover="this.style.color='var(--danger)'"
                onmouseout="this.style.color='var(--text-dim)'"
            >✕</button>` : ''}
        </div>
    `).join('');
}

// Panel header with optional CSV download button
function panelHeader(title, data, filename) {
    const id = 'dl-' + filename.replace(/[^a-z0-9]/gi, '-');
    // Store data reference for button click
    window._csvCache = window._csvCache || {};
    window._csvCache[id] = { data, filename };

    return `
        <div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;">
            <span>${title}</span>
            ${data && data.length > 0 ? `
            <button class="csv-download-btn" data-id="${id}"
                style="
                    background:transparent;
                    border:1px solid var(--border2);
                    border-radius:4px;
                    color:var(--text-muted);
                    font-family:var(--font-mono);
                    font-size:10px;
                    padding:3px 8px;
                    cursor:pointer;
                    transition:border-color 0.15s,color 0.15s;
                "
                onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text-muted)'"
            >↓ CSV</button>` : ''}
        </div>
    `;
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
    destroyAllCharts();
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

    // open sidebar and show overlay
    document.getElementById('hamburger')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
        document.getElementById('sidebar-overlay')?.classList.toggle('visible');
    });

    // Mobile date picker modal
    const dateRangeBtn   = document.getElementById('date-range-btn');
    const dateModal      = document.getElementById('date-modal');
    const modalStart     = document.getElementById('modal-date-start');
    const modalEnd       = document.getElementById('modal-date-end');
    const dateModalApply  = document.getElementById('date-modal-apply');
    const dateModalCancel = document.getElementById('date-modal-cancel');

    if (dateRangeBtn && dateModal) {
        // Open modal — pre-fill with current values
        dateRangeBtn.addEventListener('click', () => {
            modalStart.value = document.getElementById('date-start').value;
            modalEnd.value   = document.getElementById('date-end').value;
            dateModal.style.display = 'flex';
        });

        // Apply — sync values back to real inputs and re-route
        dateModalApply.addEventListener('click', () => {
            document.getElementById('date-start').value = modalStart.value;
            document.getElementById('date-end').value   = modalEnd.value;
            dateModal.style.display = 'none';
            route(); // re-render current view with new dates
        });

        // Cancel
        dateModalCancel.addEventListener('click', () => {
            dateModal.style.display = 'none';
        });

        // Click outside modal to close
        dateModal.addEventListener('click', (e) => {
            if (e.target === dateModal) dateModal.style.display = 'none';
        });
    }

    // Click outside sidebar to close it
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('visible');
    });

    // Close sidebar when a nav link is clicked on mobile
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.remove('open');
            document.getElementById('sidebar-overlay')?.classList.remove('visible');
        });
    });

    // CSV download — delegated listener on document
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('csv-download-btn')) {
            const id    = e.target.dataset.id;
            const cache = window._csvCache?.[id];
            if (cache) downloadCSV(cache.filename, cache.data);
        }
    });

    // Comments delegated listener
    initCommentListeners();

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
