/* Stakeholder briefing view + PDF export */
'use strict';

function openReportBriefing(report) {
    const snapshot = typeof report.snapshot === 'string'
        ? JSON.parse(report.snapshot)
        : report.snapshot;

    const metrics = snapshot.metrics || {};
    const charts  = snapshot.charts  || {};
    const range   = snapshot.date_range || {};

    // Build enabled metrics list
    const enabledMetrics = Object.entries(metrics)
        .filter(([, m]) => m.enabled)
        .map(([, m]) => m);

    // Build enabled charts list
    const enabledCharts = Object.entries(charts)
        .filter(([, c]) => c.enabled && c.data?.length > 0)
        .map(([key, c]) => ({ key, ...c }));

    // Render into main content area instead of modal
    // so it feels like a full page and prints cleanly
    const content = document.getElementById('content');

    content.innerHTML = `
        <div id="briefing-view" style="max-width:800px;margin:0 auto;">

            <!-- Back button — hidden on print -->
            <div class="no-print" style="margin-bottom:24px;">
                <button id="briefing-back" class="btn-secondary">
                    ← Back to Reports
                </button>
                <button id="briefing-pdf" class="btn-primary"
                    style="margin-left:12px;">
                    Export as PDF
                </button>
            </div>

            <!-- Report Header -->
            <div style="
                border:1px solid var(--border);
                border-radius:12px;
                padding:32px;
                margin-bottom:24px;
                background:var(--surface);
            ">
                <div style="
                    font-size:11px;font-weight:600;
                    text-transform:uppercase;letter-spacing:1px;
                    color:var(--text-dim);margin-bottom:8px;
                ">
                    Analytics Briefing
                </div>
                <div style="font-size:28px;font-weight:700;margin-bottom:8px;">
                    ${escapeHtml(snapshot.title || report.title)}
                </div>
                <div style="font-size:14px;color:var(--text-dim);">
                    Prepared by ${escapeHtml(snapshot.created_by_name || report.created_by_name || 'Unknown')}
                    ${range.start ? ` · ${range.start} → ${range.end}` : ''}
                    · ${new Date(report.created_at).toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric'
                    })}
                </div>
            </div>

            <!-- Headline Takeaway -->
            ${snapshot.takeaway ? `
            <div style="
                border-left:4px solid var(--accent);
                padding:16px 20px;
                margin-bottom:24px;
                background:var(--surface);
                border-radius:0 8px 8px 0;
            ">
                <div style="
                    font-size:11px;font-weight:600;
                    text-transform:uppercase;letter-spacing:1px;
                    color:var(--accent);margin-bottom:6px;
                ">Key Takeaway</div>
                <div style="font-size:17px;font-weight:600;line-height:1.5;">
                    ${escapeHtml(snapshot.takeaway)}
                </div>
            </div>` : ''}

            <!-- Summary Text -->
            ${snapshot.summary ? `
            <div style="
                padding:20px 24px;
                margin-bottom:24px;
                background:var(--surface);
                border:1px solid var(--border);
                border-radius:8px;
                font-size:15px;
                line-height:1.7;
                color:var(--text);
            ">
                <div style="
                    font-size:11px;font-weight:600;
                    text-transform:uppercase;letter-spacing:1px;
                    color:var(--text-dim);margin-bottom:10px;
                ">What This Means</div>
                ${escapeHtml(snapshot.summary).replace(/\n/g, '<br>')}
            </div>` : ''}

            <!-- Metric Cards -->
            ${enabledMetrics.length > 0 ? `
            <div style="margin-bottom:24px;">
                <div style="
                    font-size:11px;font-weight:600;
                    text-transform:uppercase;letter-spacing:1px;
                    color:var(--text-dim);margin-bottom:12px;
                ">Numbers at a Glance</div>
                <div style="
                    display:grid;
                    grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));
                    gap:12px;
                ">
                    ${enabledMetrics.map(m => `
                        <div style="
                            background:var(--surface);
                            border:1px solid var(--border);
                            border-radius:8px;
                            padding:16px;
                            text-align:center;
                        ">
                            <div style="
                                font-size:24px;font-weight:700;
                                margin-bottom:4px;
                            ">${escapeHtml(String(m.value))}</div>
                            <div style="
                                font-size:12px;color:var(--text-dim);
                                text-transform:uppercase;letter-spacing:0.5px;
                            ">${escapeHtml(m.label)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            <!-- Charts -->
            ${enabledCharts.map((c, i) => `
            <div style="
                background:var(--surface);
                border:1px solid var(--border);
                border-radius:8px;
                padding:24px;
                margin-bottom:24px;
            ">
                <div style="
                    font-size:14px;font-weight:600;
                    margin-bottom:16px;
                ">${escapeHtml(c.label)}</div>
                <canvas id="briefing-chart-${i}"></canvas>
            </div>`).join('')}

            <!-- Footer -->
            <div style="
                text-align:center;
                padding:20px;
                font-size:12px;
                color:var(--text-dim);
                border-top:1px solid var(--border);
                margin-top:8px;
            ">
                This report was generated on
                ${new Date(snapshot.created_at || report.created_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                })}
                and reflects a snapshot of data at that time.
            </div>
        </div>
    `;

    // Draw charts after DOM is ready
    enabledCharts.forEach((c, i) => {
        drawBriefingChart(`briefing-chart-${i}`, c);
    });

    // Back button
    document.getElementById('briefing-back')
        .addEventListener('click', () => renderReports());

    // PDF export
    document.getElementById('briefing-pdf')
        .addEventListener('click', () => exportBriefingPdf(snapshot.title || report.title));
}

function drawBriefingChart(canvasId, chart) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !chart.data?.length) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }

    const type = chart.type || 'bar';

    // ── Line charts ───────────────────────────────────────
    if (type === 'line') {
        const xKey = chart.key === 'error_trend'   ? 'day' :
                     chart.key === 'error_rate'     ? 'day' :
                     chart.key === 'bounce_rate'    ? 'day' : 'day';
        const yKey = chart.key === 'error_trend'   ? 'error_count' :
                     chart.key === 'error_rate'     ? 'error_rate'  :
                     chart.key === 'bounce_rate'    ? 'bounce_rate'  : 'views';
        const color = chart.key === 'error_trend'  ? '#f85149' :
                      chart.key === 'error_rate'   ? '#d29922' :
                      chart.key === 'bounce_rate'  ? '#d29922' : '#58a6ff';

        const labels = chart.data.map(d => String(d[xKey]).slice(0,10).slice(5));
        const values = chart.data.map(d => Number(d[yKey]));
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
                    fill: true,
                    tension: 0.3,
                }],
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                },
            },
        });

    // ── Dual line (pageviews + sessions) ──────────────────
    } else if (type === 'line_dual') {
        const labels = chart.data.map(d => String(d.day).slice(0,10).slice(5));
        chartInstances[canvasId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Pageviews',
                        data: chart.data.map(d => Number(d.pageviews || d.views || 0)),
                        borderColor: '#58a6ff',
                        backgroundColor: '#58a6ff22',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: true,
                        tension: 0.3,
                    },
                    {
                        label: 'Sessions',
                        data: chart.data.map(d => Number(d.sessions || 0)),
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
                plugins: {
                    legend: { display: true, labels: { color: '#7d8590', font: { size: 11 } } }
                },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                },
            },
        });

    // ── Horizontal bar ────────────────────────────────────
    } else if (type === 'bar_horizontal') {
        const labelKey  = chart.key === 'top_pages_bar'    ? 'url' :
                          chart.key === 'event_types'       ? 'type' :
                          chart.key === 'errors_by_type'    ? 'error_type' :
                          chart.key === 'errors_by_page'    ? 'url' :
                          chart.key === 'errors_by_element' ? 'element_type' :
                          chart.key === 'traffic_sources'   ? 'source' :
                          chart.key === 'connection_types'  ? 'connection_type' : 'label';
        const valueKey  = chart.key === 'traffic_sources'  ? 'pageviews' :
                          chart.key === 'connection_types'  ? 'count' :
                          chart.key === 'errors_by_page'    ? 'count' :
                          chart.key === 'errors_by_type'    ? 'count' :
                          chart.key === 'errors_by_element' ? 'count' :
                          chart.key === 'event_types'       ? 'count' : 'views';
        const color     = chart.key.startsWith('error')    ? '#f85149' :
                          chart.key === 'event_types'       ? '#a371f7' : '#58a6ff';

        const labels = chart.data.slice(0,10).map(d =>
            String(d[labelKey] || '').replace('https://test.jgamba.site', '') || '/'
        );
        chartInstances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: chart.data.slice(0,10).map(d => Number(d[valueKey] || 0)),
                    backgroundColor: color + '44',
                    borderColor: color,
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 32,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#7d8590', stepSize: 1, callback: v => Number.isInteger(v) ? v : null }, grid: { color: '#21262d' } },
                    y: { ticks: { color: '#7d8590', font: { size: 10 } }, grid: { display: false } },
                },
            },
        });

    // ── Vertical bar ──────────────────────────────────────
    } else if (type === 'bar') {
        const labelKey = chart.key === 'speed_distribution'  ? 'bucket' :
                         chart.key === 'pages_per_session'    ? 'pages_in_session' :
                         chart.key === 'device_breakdown'     ? 'device_type' :
                         chart.key === 'session_durations'    ? 'duration_bucket' : 'label';
        const valueKey = chart.key === 'pages_per_session'   ? 'session_count' :
                         chart.key === 'device_breakdown'     ? 'sessions' :
                         chart.key === 'session_durations'    ? 'session_count' : 'count';
        const color    = chart.key === 'speed_distribution'  ? null : '#58a6ff';

        const bucketOrder = {
            speed_distribution: ['0-500ms','500ms-1s','1-2s','2-3s','3s+'],
            session_durations:  ['0-10s','10-30s','30-60s','1-3min','3-10min','10min+'],
        };
        const ordered = bucketOrder[chart.key]
            ? bucketOrder[chart.key].map(b =>
                chart.data.find(d => d[labelKey] === b) || { [labelKey]: b, [valueKey]: 0 }
              )
            : chart.data;

        const speedColors = ['#3fb950','#3fb950','#d29922','#f85149','#f85149'];

        chartInstances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ordered.map(d => String(d[labelKey])),
                datasets: [{
                    data: ordered.map(d => Number(d[valueKey] || 0)),
                    backgroundColor: chart.key === 'speed_distribution'
                        ? speedColors.map(c => c + '44')
                        : (color || '#58a6ff') + '44',
                    borderColor: chart.key === 'speed_distribution'
                        ? speedColors
                        : color || '#58a6ff',
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 48,
                }],
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { beginAtZero: true, ticks: { color: '#7d8590', stepSize: 1, callback: v => Number.isInteger(v) ? v : null }, grid: { color: '#21262d' } },
                },
            },
        });

    // ── Scatter ───────────────────────────────────────────
    } else if (type === 'scatter') {
        chartInstances[canvasId] = new Chart(canvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    data: chart.data,
                    backgroundColor: chart.data.map(d =>
                        d.y > 3000 ? '#f8514999' : d.y > 1500 ? '#d2992299' : '#3fb95099'
                    ),
                    pointRadius: 7,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => [ctx.raw.label, `TTFB: ${ctx.raw.x}ms`, `Load: ${ctx.raw.y}ms`]
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'TTFB (ms)', color: '#7d8590' }, ticks: { color: '#7d8590', callback: v => v + 'ms' }, grid: { color: '#21262d' } },
                    y: { title: { display: true, text: 'Load (ms)', color: '#7d8590' }, beginAtZero: true, ticks: { color: '#7d8590', callback: v => v + 'ms' }, grid: { color: '#21262d' } },
                },
            },
        });

    // ── Vital single bar with threshold context ───────────
    } else if (type === 'vital') {
        const d = chart.data[0];
        if (!d) return;
        const color = d.value < d.thresholds[0] ? '#3fb950' :
                      d.value < d.thresholds[1] ? '#d29922' : '#f85149';
        chartInstances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: [d.metric],
                datasets: [{
                    data: [d.value],
                    backgroundColor: color + '99',
                    borderColor: color,
                    borderWidth: 2,
                    borderRadius: 4,
                    barThickness: 60,
                }],
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#7d8590' }, grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        max: Math.max(d.value * 1.4, d.thresholds[1] * 1.3),
                        ticks: { color: '#7d8590', callback: v => v + d.unit },
                        grid: { color: '#21262d' },
                    },
                },
            },
        });
    }
}

function exportBriefingPdf(title) {
    // Hide no-print elements, trigger browser print dialog
    // which can save as PDF natively
    const style = document.createElement('style');
    style.id = 'print-style';
    style.textContent = `
        @media print {
            .no-print { display: none !important; }
            #sidebar   { display: none !important; }
            #topbar    { display: none !important; }
            #main      { margin: 0 !important; padding: 0 !important; }
            body       { background: white !important; color: black !important; }
            #briefing-view {
                max-width: 100% !important;
                color: black !important;
            }
            canvas { max-width: 100% !important; }
        }
    `;
    document.head.appendChild(style);

    window.print();

    // Clean up print style after dialog closes
    setTimeout(() => {
        document.getElementById('print-style')?.remove();
    }, 1000);
}