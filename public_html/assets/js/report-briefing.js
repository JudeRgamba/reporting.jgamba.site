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

    // Destroy existing instance if any
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }

    // Determine chart type and data shape based on key
    if (chart.key === 'pageviews_over_time' || chart.key === 'error_trend') {
        // Line chart
        const xKey = chart.key === 'error_trend' ? 'day' : 'day';
        const yKey = chart.key === 'error_trend' ? 'error_count' : 'views';
        const color = chart.key === 'error_trend' ? '#f85149' : '#58a6ff';

        const labels = chart.data.map(d => String(d[xKey]).slice(5, 10));
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
                    pointRadius: 4,
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

    } else if (chart.key === 'top_pages') {
        // Horizontal bar — top pages
        const labels = chart.data.map(d =>
            String(d.url).replace('https://test.jgamba.site', '') || '/'
        );
        const values = chart.data.map(d => Number(d.views));

        chartInstances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: '#58a6ff44',
                    borderColor: '#58a6ff',
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
                    y: { ticks: { color: '#7d8590', font: { size: 11 } }, grid: { display: false } },
                },
            },
        });

    } else if (chart.key === 'performance_by_page') {
        // Bar chart — avg load time per page
        const labels = chart.data.map(d =>
            String(d.url).replace('https://test.jgamba.site', '') || '/'
        );
        const values = chart.data.map(d => Number(d.avg_load_ms) || 0);
        const colors = values.map(v =>
            v > 3000 ? '#f85149' : v > 1500 ? '#d29922' : '#3fb950'
        );

        chartInstances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 4,
                }],
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#7d8590', font: { size: 11 } }, grid: { color: '#21262d' } },
                    y: { beginAtZero: true, ticks: { color: '#7d8590' }, grid: { color: '#21262d' } },
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