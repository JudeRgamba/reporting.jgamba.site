/* Behavioral analytics view */
'use strict';

async function renderBehavior(start, end) {
    destroyAllCharts();
    showLoading();

    const [bounceData, pagesData, scrollData, sourcesData, devicesData, sessionData] =
        await Promise.all([
            apiFetch(`/api/behavior/bounce-rate?start=${start}&end=${end}`),
            apiFetch(`/api/behavior/pages-per-session?start=${start}&end=${end}`),
            apiFetch(`/api/behavior/scroll-depth?start=${start}&end=${end}`),
            apiFetch(`/api/behavior/traffic-sources?start=${start}&end=${end}`),
            apiFetch(`/api/behavior/devices?start=${start}&end=${end}`),
            apiFetch(`/api/behavior/session-lengths?start=${start}&end=${end}`),
        ]);

    const bounce   = bounceData?.data   || [];
    const pages    = pagesData?.data    || [];
    const scroll   = scrollData?.data   || [];
    const sources  = sourcesData?.data  || [];
    const devices  = devicesData?.data?.devices     || [];
    const conns    = devicesData?.data?.connections || [];
    const sessions = sessionData?.data  || [];

    // ── Summary metrics ──────────────────────────────────
    const totalSessions  = devices.reduce((a, d) => a + Number(d.sessions), 0);
    const avgBounce      = bounce.length
        ? Math.round(bounce.reduce((a, b) => a + b.bounce_rate, 0) / bounce.length)
        : 0;
    const avgPages       = pages.length
        ? (pages.reduce((a, p) => a + (p.pages_in_session * p.session_count), 0) /
           pages.reduce((a, p) => a + Number(p.session_count), 0)).toFixed(1)
        : 0;
    const dominantDevice = devices.length ? devices[0].device_type : '—';

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="page-title">Behavior</div>
        <div class="cards-grid" id="behavior-cards"></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" class="chart-row">
            <div class="panel">
                ${panelHeader('Bounce Rate Over Time', bounce, 'bounce-rate.csv')}
                <div class="panel-body" style="position:relative;min-height:200px;">
                    <canvas id="bounce-chart"></canvas>
                </div>
            </div>
            <div class="panel">
                ${panelHeader('Pages Per Session', pages, 'pages-per-session.csv')}
                <div class="panel-body" style="position:relative;min-height:200px;">
                    <canvas id="pages-chart"></canvas>
                </div>
            </div>
        </div>

        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('Traffic Sources', sources, 'traffic-sources.csv')}
            <div class="panel-body" style="position:relative;min-height:200px;">
                <canvas id="sources-chart"></canvas>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" class="chart-row">
            <div class="panel">
                ${panelHeader('Device Breakdown', devices, 'devices.csv')}
                <div class="panel-body" style="position:relative;min-height:200px;">
                    <canvas id="devices-chart"></canvas>
                </div>
            </div>
            <div class="panel">
                ${panelHeader('Connection Types', conns, 'connections.csv')}
                <div class="panel-body" style="position:relative;min-height:200px;">
                    <canvas id="connections-chart"></canvas>
                </div>
            </div>
        </div>

        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('Avg Load Time by Device', devices, 'device-performance.csv')}
            <div class="panel-body" style="position:relative;min-height:200px;">
                <canvas id="device-perf-chart"></canvas>
            </div>
        </div>

        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('Session Duration Distribution', sessions, 'session-durations.csv')}
            <div class="panel-body" style="position:relative;min-height:200px;">
                <canvas id="session-duration-chart"></canvas>
            </div>
        </div>

        <div class="panel" style="margin-bottom:20px;">
            ${panelHeader('Scroll Depth by Page', scroll, 'scroll-depth.csv')}
            <div id="scroll-table"></div>
        </div>
        <!-- Comments -->
        ${commentsHTML}
    `;

    // ── Summary Cards ────────────────────────────────────
    const cardData = [
        { label: 'Total Sessions',  value: totalSessions.toLocaleString() },
        { label: 'Avg Bounce Rate', value: avgBounce + '%'                },
        { label: 'Avg Pages/Session', value: avgPages                     },
        { label: 'Top Device',      value: dominantDevice                 },
    ];
    const cardsEl = document.getElementById('behavior-cards');
    cardData.forEach(c => {
        const card = document.createElement('div');
        card.className = 'metric-card';
        card.innerHTML = `
            <div class="metric-label">${c.label}</div>
            <div class="metric-value">${c.value}</div>
        `;
        cardsEl.appendChild(card);
    });

    // ── Bounce Rate Line Chart ───────────────────────────
    drawLineChart('bounce-chart', bounce, 'day', 'bounce_rate', '#d29922');

    // ── Pages Per Session Bar Chart ──────────────────────
    if (chartInstances['pages-chart']) {
        chartInstances['pages-chart'].destroy();
        delete chartInstances['pages-chart'];
    }
    const pagesCanvas = document.getElementById('pages-chart');
    if (pagesCanvas && pages.length > 0) {
        chartInstances['pages-chart'] = new Chart(pagesCanvas, {
            type: 'bar',
            data: {
                labels: pages.map(p => p.pages_in_session + (p.pages_in_session == 1 ? ' page' : ' pages')),
                datasets: [{
                    data: pages.map(p => Number(p.session_count)),
                    backgroundColor: pages.map((_, i) =>
                        i === 0 ? '#f8514944' : '#58a6ff44'
                    ),
                    borderColor: pages.map((_, i) =>
                        i === 0 ? '#f85149' : '#58a6ff'
                    ),
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
                            label: ctx => `${ctx.parsed.y} sessions`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                },
            },
        });
    }

    // ── Traffic Sources Horizontal Bar ───────────────────
    if (chartInstances['sources-chart']) {
        chartInstances['sources-chart'].destroy();
        delete chartInstances['sources-chart'];
    }
    const sourcesCanvas = document.getElementById('sources-chart');
    if (sourcesCanvas && sources.length > 0) {
        const sourceColors = {
            Direct:   '#58a6ff',
            Search:   '#3fb950',
            Social:   '#a371f7',
            Referral: '#d29922',
            Internal: '#7d8590',
        };
        chartInstances['sources-chart'] = new Chart(sourcesCanvas, {
            type: 'bar',
            data: {
                labels: sources.map(s => s.source),
                datasets: [{
                    label: 'Pageviews',
                    data: sources.map(s => Number(s.pageviews)),
                    backgroundColor: sources.map(s =>
                        (sourceColors[s.source] || '#7d8590') + '44'
                    ),
                    borderColor: sources.map(s =>
                        sourceColors[s.source] || '#7d8590'
                    ),
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
                            label: ctx => `${ctx.parsed.x.toLocaleString()} pageviews`
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { ticks: { color: '#7d8590' }, grid: { display: false } },
                },
            },
        });
    }

    // ── Device Breakdown Bar ─────────────────────────────
    const deviceColors = { Mobile: '#f85149', Tablet: '#d29922', Desktop: '#3fb950' };
    if (chartInstances['devices-chart']) {
        chartInstances['devices-chart'].destroy();
        delete chartInstances['devices-chart'];
    }
    const devCanvas = document.getElementById('devices-chart');
    if (devCanvas && devices.length > 0) {
        chartInstances['devices-chart'] = new Chart(devCanvas, {
            type: 'bar',
            data: {
                labels: devices.map(d => d.device_type),
                datasets: [{
                    data: devices.map(d => Number(d.sessions)),
                    backgroundColor: devices.map(d =>
                        (deviceColors[d.device_type] || '#7d8590') + '44'
                    ),
                    borderColor: devices.map(d =>
                        deviceColors[d.device_type] || '#7d8590'
                    ),
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                },
            },
        });
    }

    // ── Connection Types Horizontal Bar ──────────────────
    if (chartInstances['connections-chart']) {
        chartInstances['connections-chart'].destroy();
        delete chartInstances['connections-chart'];
    }
    const connCanvas = document.getElementById('connections-chart');
    if (connCanvas && conns.length > 0) {
        const connColors = ['#58a6ff', '#3fb950', '#d29922', '#a371f7', '#7d8590'];
        chartInstances['connections-chart'] = new Chart(connCanvas, {
            type: 'bar',
            data: {
                labels: conns.map(c => c.connection_type),
                datasets: [{
                    data: conns.map(c => Number(c.count)),
                    backgroundColor: conns.map((_, i) =>
                        connColors[i % connColors.length] + '44'
                    ),
                    borderColor: conns.map((_, i) =>
                        connColors[i % connColors.length]
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
    }

    // ── Performance by Device Bar ────────────────────────
    if (chartInstances['device-perf-chart']) {
        chartInstances['device-perf-chart'].destroy();
        delete chartInstances['device-perf-chart'];
    }
    const perfCanvas = document.getElementById('device-perf-chart');
    if (perfCanvas && devices.length > 0) {
        const loadValues = devices.map(d => Number(d.avg_load_ms) || 0);
        chartInstances['device-perf-chart'] = new Chart(perfCanvas, {
            type: 'bar',
            data: {
                labels: devices.map(d => d.device_type),
                datasets: [{
                    label: 'Avg Load (ms)',
                    data: loadValues,
                    backgroundColor: loadValues.map(v =>
                        v > 3000 ? '#f8514944' : v > 1500 ? '#d2992244' : '#3fb95044'
                    ),
                    borderColor: loadValues.map(v =>
                        v > 3000 ? '#f85149' : v > 1500 ? '#d29922' : '#3fb950'
                    ),
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
                            label: ctx => `${ctx.parsed.y}ms avg load`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#7d8590', callback: v => v + 'ms' },
                        grid: { color: '#21262d' },
                    },
                },
            },
        });
    }

    // ── Session Duration Bar ─────────────────────────────
    const bucketOrder = ['0-10s','10-30s','30-60s','1-3min','3-10min','10min+'];
    const sortedSessions = bucketOrder.map(b =>
        sessions.find(s => s.duration_bucket === b) || { duration_bucket: b, session_count: 0 }
    );
    if (chartInstances['session-duration-chart']) {
        chartInstances['session-duration-chart'].destroy();
        delete chartInstances['session-duration-chart'];
    }
    const durCanvas = document.getElementById('session-duration-chart');
    if (durCanvas) {
        chartInstances['session-duration-chart'] = new Chart(durCanvas, {
            type: 'bar',
            data: {
                labels: sortedSessions.map(s => s.duration_bucket),
                datasets: [{
                    data: sortedSessions.map(s => Number(s.session_count)),
                    backgroundColor: '#58a6ff44',
                    borderColor: '#58a6ff',
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
                            label: ctx => `${ctx.parsed.y} sessions`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                },
            },
        });
    }

    // ── Scroll Depth Table ───────────────────────────────
    makeFilterableTable('scroll-table', [
        { key: 'url',           label: 'Page',
        render: (td, val) => {
            td.textContent = val
                ? val.replace('https://test.jgamba.site', '') || '/'
                : '—';
        }
        },
        { key: 'total_sessions', label: 'Sessions',  mono: true },
        { key: 'pct_25',         label: '25%',       mono: true },
        { key: 'pct_50',         label: '50%',       mono: true },
        { key: 'pct_75',         label: '75%',       mono: true },
        { key: 'pct_100',        label: '100%',      mono: true },
    ], scroll.map(r => ({
        ...r,
        pct_25:  r.total_sessions > 0 ? Math.round((r.reached_25  / r.total_sessions) * 100) + '%' : '—',
        pct_50:  r.total_sessions > 0 ? Math.round((r.reached_50  / r.total_sessions) * 100) + '%' : '—',
        pct_75:  r.total_sessions > 0 ? Math.round((r.reached_75  / r.total_sessions) * 100) + '%' : '—',
        pct_100: r.total_sessions > 0 ? Math.round((r.reached_100 / r.total_sessions) * 100) + '%' : '—',
    })));
}