/* Report builder modal */
'use strict';

async function openReportBuilder(existingReport) {
    const { start, end } = getDateRange();
    const isEdit = !!existingReport;

    const snap = existingReport
        ? (typeof existingReport.snapshot === 'string'
            ? JSON.parse(existingReport.snapshot)
            : existingReport.snapshot)
        : null;

    // ── Loading overlay ───────────────────────────────────
    const loadingModal = document.createElement('div');
    loadingModal.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;
        z-index:1000;
    `;
    loadingModal.innerHTML = `
        <div style="
            background:var(--surface);border:1px solid var(--border);
            border-radius:12px;padding:40px 60px;
            text-align:center;color:var(--text-dim);font-size:14px;
        ">
            <div style="font-size:24px;margin-bottom:12px;">⏳</div>
            Loading report data...
        </div>
    `;
    document.body.appendChild(loadingModal);

    // ── Fetch all section data ────────────────────────────
    const sections = window.SESSION_SECTIONS || [];
    const canSee = s => window.SESSION_ROLE === 'super_admin' || sections.includes(s);

    const [
        overviewData, pvData, eventTypesData,
        perfData, distData,
        errData, byTypeData, byPageData, byElementData, rateData,
        bounceData, pagesData, sourcesData, devicesData, sessionData,
        viewerData
    ] = await Promise.all([
        canSee('overview')     ? apiFetch(`/api/dashboard?start=${start}&end=${end}`)                    : null,
        canSee('overview')     ? apiFetch(`/api/pageviews?start=${start}&end=${end}`)                    : null,
        canSee('overview')     ? apiFetch(`/api/event-types?start=${start}&end=${end}`)                  : null,
        canSee('performance')  ? apiFetch(`/api/performance?start=${start}&end=${end}`)                  : null,
        canSee('performance')  ? apiFetch(`/api/performance/distribution?start=${start}&end=${end}`)     : null,
        canSee('errors')       ? apiFetch(`/api/errors?start=${start}&end=${end}`)                       : null,
        canSee('errors')       ? apiFetch(`/api/errors/by-type?start=${start}&end=${end}`)               : null,
        canSee('errors')       ? apiFetch(`/api/errors/by-page?start=${start}&end=${end}`)               : null,
        canSee('errors')       ? apiFetch(`/api/errors/by-element?start=${start}&end=${end}`)            : null,
        canSee('errors')       ? apiFetch(`/api/errors/rate?start=${start}&end=${end}`)                  : null,
        canSee('behavior')     ? apiFetch(`/api/behavior/bounce-rate?start=${start}&end=${end}`)         : null,
        canSee('behavior')     ? apiFetch(`/api/behavior/pages-per-session?start=${start}&end=${end}`)   : null,
        canSee('behavior')     ? apiFetch(`/api/behavior/traffic-sources?start=${start}&end=${end}`)     : null,
        canSee('behavior')     ? apiFetch(`/api/behavior/devices?start=${start}&end=${end}`)             : null,
        canSee('behavior')     ? apiFetch(`/api/behavior/session-lengths?start=${start}&end=${end}`)     : null,
        fetch('/api/viewers', {
            credentials: 'include',
            headers: {
                'Content-Type':    'application/json',
                'X-User-Role':     window.SESSION_ROLE,
                'X-User-Sections': JSON.stringify(window.SESSION_SECTIONS || []),
                'X-User-Id':       String(window.SESSION_USER_ID),
            },
        }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    loadingModal.remove();

    // ── Unpack data ───────────────────────────────────────
    const ov      = overviewData?.data      || {};
    const pv      = pvData?.data            || {};
    const etypes  = eventTypesData?.data    || [];
    const perf    = perfData?.data          || {};
    const dist    = distData?.data          || [];
    const err     = errData?.data           || {};
    const byType  = byTypeData?.data        || [];
    const byPage  = byPageData?.data        || [];
    const byEl    = byElementData?.data     || [];
    const rate    = rateData?.data          || [];
    const bounce  = bounceData?.data        || [];
    const pages   = pagesData?.data         || [];
    const sources = sourcesData?.data       || [];
    const devices = devicesData?.data?.devices     || [];
    const conns   = devicesData?.data?.connections || [];
    const sessLen = sessionData?.data       || [];
    const viewers = viewerData?.data        || [];

    // Compute perf averages for vitals
    const byPageArr = perf.byPage || [];
    let totalLcp = 0, totalCls = 0, totalInp = 0, totalSamp = 0;
    byPageArr.forEach(r => {
        const s = Number(r.samples) || 0;
        totalLcp += (Number(r.avg_lcp) || 0) * s;
        totalCls += (Number(r.avg_cls) || 0) * s;
        totalInp += (Number(r.avg_inp) || 0) * s;
        totalSamp += s;
    });
    const avgLcp = totalSamp ? totalLcp / totalSamp : 0;
    const avgCls = totalSamp ? totalCls / totalSamp : 0;
    const avgInp = totalSamp ? totalInp / totalSamp : 0;

    // ── Viewer access ─────────────────────────────────────
    const existingAccess = existingReport
        ? (await apiFetch(`/api/reports/${existingReport.id}/access`).catch(() => null))?.data || []
        : [];
    const accessIds = existingAccess.map(u => u.id);

    // ── Define all available charts per section ───────────
    const allChartDefs = [
        // Overview
        {
            key: 'pageviews_sessions', section: 'overview',
            label: 'Pageviews & Sessions Over Time',
            type: 'line_dual',
            data: pv.byDay || [],
            enabled: snap?.charts?.pageviews_sessions?.enabled !== false,
        },
        {
            key: 'top_pages_bar', section: 'overview',
            label: 'Top Pages (Bar)',
            type: 'bar_horizontal',
            data: pv.topPages || [],
            enabled: snap?.charts?.top_pages_bar?.enabled !== false,
        },
        {
            key: 'event_types', section: 'overview',
            label: 'Event Type Breakdown',
            type: 'bar_horizontal',
            data: etypes,
            enabled: snap?.charts?.event_types?.enabled !== false,
        },
        // Performance
        {
            key: 'lcp_chart', section: 'performance',
            label: 'LCP (Largest Contentful Paint)',
            type: 'vital',
            data: [{ metric: 'LCP', value: Math.round(avgLcp), unit: 'ms', thresholds: [2500, 4000] }],
            enabled: snap?.charts?.lcp_chart?.enabled !== false,
        },
        {
            key: 'cls_chart', section: 'performance',
            label: 'CLS (Cumulative Layout Shift)',
            type: 'vital',
            data: [{ metric: 'CLS', value: parseFloat(avgCls.toFixed(4)), unit: '', thresholds: [0.1, 0.25] }],
            enabled: snap?.charts?.cls_chart?.enabled !== false,
        },
        {
            key: 'inp_chart', section: 'performance',
            label: 'INP (Interaction to Next Paint)',
            type: 'vital',
            data: [{ metric: 'INP', value: Math.round(avgInp), unit: 'ms', thresholds: [200, 500] }],
            enabled: snap?.charts?.inp_chart?.enabled !== false,
        },
        {
            key: 'speed_distribution', section: 'performance',
            label: 'Page Speed Distribution',
            type: 'bar',
            data: dist,
            enabled: snap?.charts?.speed_distribution?.enabled !== false,
        },
        {
            key: 'ttfb_scatter', section: 'performance',
            label: 'TTFB vs Load Time (Scatter)',
            type: 'scatter',
            data: byPageArr.filter(r => r.avg_ttfb_ms && r.avg_load_ms).map(r => ({
                x: Number(r.avg_ttfb_ms),
                y: Number(r.avg_load_ms),
                label: r.url.replace('https://test.jgamba.site', '') || '/',
            })),
            enabled: snap?.charts?.ttfb_scatter?.enabled !== false,
        },
        // Errors
        {
            key: 'error_trend', section: 'errors',
            label: 'Error Trend Over Time',
            type: 'line',
            data: err.trend || [],
            enabled: snap?.charts?.error_trend?.enabled !== false,
        },
        {
            key: 'error_rate', section: 'errors',
            label: 'Error Rate (% of Pageviews)',
            type: 'line',
            data: rate,
            enabled: snap?.charts?.error_rate?.enabled !== false,
        },
        {
            key: 'errors_by_type', section: 'errors',
            label: 'Errors by Type',
            type: 'bar_horizontal',
            data: byType,
            enabled: snap?.charts?.errors_by_type?.enabled !== false,
        },
        {
            key: 'errors_by_page', section: 'errors',
            label: 'Errors by Page',
            type: 'bar_horizontal',
            data: byPage,
            enabled: snap?.charts?.errors_by_page?.enabled !== false,
        },
        {
            key: 'errors_by_element', section: 'errors',
            label: 'Errors by Element',
            type: 'bar_horizontal',
            data: byEl,
            enabled: snap?.charts?.errors_by_element?.enabled !== false,
        },
        // Behavior
        {
            key: 'bounce_rate', section: 'behavior',
            label: 'Bounce Rate Over Time',
            type: 'line',
            data: bounce,
            enabled: snap?.charts?.bounce_rate?.enabled !== false,
        },
        {
            key: 'pages_per_session', section: 'behavior',
            label: 'Pages Per Session',
            type: 'bar',
            data: pages,
            enabled: snap?.charts?.pages_per_session?.enabled !== false,
        },
        {
            key: 'traffic_sources', section: 'behavior',
            label: 'Traffic Sources',
            type: 'bar_horizontal',
            data: sources,
            enabled: snap?.charts?.traffic_sources?.enabled !== false,
        },
        {
            key: 'device_breakdown', section: 'behavior',
            label: 'Device Breakdown',
            type: 'bar',
            data: devices,
            enabled: snap?.charts?.device_breakdown?.enabled !== false,
        },
        {
            key: 'connection_types', section: 'behavior',
            label: 'Connection Types',
            type: 'bar_horizontal',
            data: conns,
            enabled: snap?.charts?.connection_types?.enabled !== false,
        },
        {
            key: 'session_durations', section: 'behavior',
            label: 'Session Duration Distribution',
            type: 'bar',
            data: sessLen,
            enabled: snap?.charts?.session_durations?.enabled !== false,
        },
    ].filter(c => canSee(c.section) && c.data.length > 0);

    // ── Define all available metrics ─────────────────────
    const allMetricDefs = [
        { key: 'total_pageviews',  section: 'overview',     label: 'Total Pageviews',    value: ov.total_pageviews  ?? null },
        { key: 'total_sessions',   section: 'overview',     label: 'Total Sessions',     value: ov.total_sessions   ?? null },
        { key: 'avg_load_time',    section: 'performance',  label: 'Avg Load Time',      value: ov.avg_load_time_ms ? Math.round(ov.avg_load_time_ms) + 'ms' : null },
        { key: 'total_errors',     section: 'errors',       label: 'Total Errors',       value: ov.total_errors     ?? null },
        { key: 'avg_lcp',          section: 'performance',  label: 'Avg LCP',            value: avgLcp ? Math.round(avgLcp) + 'ms' : null },
        { key: 'avg_cls',          section: 'performance',  label: 'Avg CLS',            value: avgCls ? avgCls.toFixed(4) : null },
        { key: 'avg_inp',          section: 'performance',  label: 'Avg INP',            value: avgInp ? Math.round(avgInp) + 'ms' : null },
        { key: 'top_error_type',   section: 'errors',       label: 'Top Error Type',     value: byType[0]?.error_type ?? null },
        { key: 'top_device',       section: 'behavior',     label: 'Top Device',         value: devices[0]?.device_type ?? null },
        { key: 'avg_bounce_rate',  section: 'behavior',     label: 'Avg Bounce Rate',    value: bounce.length ? Math.round(bounce.reduce((a,b) => a + b.bounce_rate, 0) / bounce.length) + '%' : null },
    ].filter(m => canSee(m.section) && m.value !== null);

    // Group charts by section for the UI
    const sectionNames = { overview: 'Overview', performance: 'Performance', errors: 'Errors', behavior: 'Behavior' };
    const chartsBySect = {};
    allChartDefs.forEach(c => {
        if (!chartsBySect[c.section]) chartsBySect[c.section] = [];
        chartsBySect[c.section].push(c);
    });

    const metricsBySect = {};
    allMetricDefs.forEach(m => {
        if (!metricsBySect[m.section]) metricsBySect[m.section] = [];
        metricsBySect[m.section].push(m);
    });

    // ── Build modal ───────────────────────────────────────
    const modal = document.createElement('div');
    modal.id = 'report-builder-modal';
    modal.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;
        z-index:1000;padding:20px;
    `;

    const sectionColor = { overview: '#58a6ff', performance: '#3fb950', errors: '#f85149', behavior: '#a371f7' };

    modal.innerHTML = `
        <div style="
            background:var(--surface);border:1px solid var(--border);
            border-radius:12px;width:100%;max-width:700px;
            max-height:90vh;overflow-y:auto;padding:32px;
        ">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                <div style="font-size:20px;font-weight:700;">
                    ${isEdit ? 'Edit Report' : 'Build Report'}
                </div>
                <button id="builder-close" style="
                    background:none;border:none;color:var(--text-dim);
                    font-size:20px;cursor:pointer;padding:4px 8px;
                ">✕</button>
            </div>

            <!-- Title -->
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.5px;
                    color:var(--text-dim);margin-bottom:6px;">Report Title</label>
                <input id="builder-title" type="text"
                    value="${escapeHtml(snap?.title || existingReport?.title || '')}"
                    placeholder="e.g. Weekly Performance Briefing"
                    style="width:100%;padding:10px 14px;background:var(--bg);
                        border:1px solid var(--border);border-radius:6px;
                        color:var(--text);font-size:14px;outline:none;">
            </div>

            <!-- Takeaway -->
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.5px;
                    color:var(--text-dim);margin-bottom:6px;">
                    Headline Takeaway
                    <span style="font-weight:400;text-transform:none;font-size:11px;">
                        — one sentence for stakeholders
                    </span>
                </label>
                <input id="builder-takeaway" type="text"
                    value="${escapeHtml(snap?.takeaway || '')}"
                    placeholder="e.g. Site performance improved 18% this month."
                    style="width:100%;padding:10px 14px;background:var(--bg);
                        border:1px solid var(--border);border-radius:6px;
                        color:var(--text);font-size:14px;outline:none;">
            </div>

            <!-- Summary -->
            <div style="margin-bottom:24px;">
                <label style="display:block;font-size:12px;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.5px;
                    color:var(--text-dim);margin-bottom:6px;">
                    Explanatory Summary
                    <span style="font-weight:400;text-transform:none;font-size:11px;">
                        — plain English for non-technical readers
                    </span>
                </label>
                <textarea id="builder-summary" rows="3"
                    placeholder="e.g. Visitors are spending more time on product pages..."
                    style="width:100%;padding:10px 14px;background:var(--bg);
                        border:1px solid var(--border);border-radius:6px;
                        color:var(--text);font-size:14px;outline:none;
                        resize:vertical;font-family:inherit;"
                >${escapeHtml(snap?.summary || '')}</textarea>
            </div>

            <!-- Metrics by section -->
            <div style="margin-bottom:24px;">
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.5px;color:var(--text-dim);margin-bottom:12px;">
                    Metrics to Include
                </div>
                ${Object.entries(metricsBySect).map(([sect, mets]) => `
                    <div style="margin-bottom:12px;">
                        <div style="
                            font-size:11px;font-weight:600;
                            color:${sectionColor[sect] || '#7d8590'};
                            text-transform:uppercase;letter-spacing:0.5px;
                            margin-bottom:6px;
                        ">${sectionNames[sect] || sect}</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                            ${mets.map(m => `
                                <label style="display:flex;align-items:center;gap:8px;
                                    padding:8px 12px;border:1px solid var(--border);
                                    border-radius:6px;cursor:pointer;font-size:13px;">
                                    <input type="checkbox" data-metric="${m.key}"
                                        ${snap?.metrics?.[m.key]?.enabled !== false ? 'checked' : ''}>
                                    <span>${m.label}</span>
                                    <span style="margin-left:auto;color:var(--text-dim);
                                        font-family:var(--font-mono);font-size:11px;">
                                        ${m.value}
                                    </span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Charts by section -->
            <div style="margin-bottom:24px;">
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.5px;color:var(--text-dim);margin-bottom:4px;">
                    Charts to Include
                </div>
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:12px;">
                    Toggle entire sections or individual charts
                </div>
                ${Object.entries(chartsBySect).map(([sect, charts]) => `
                    <div style="margin-bottom:16px;">
                        <!-- Section toggle -->
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                                <input type="checkbox"
                                    class="section-toggle"
                                    data-section="${sect}"
                                    ${charts.every(c => c.enabled) ? 'checked' : ''}
                                    style="cursor:pointer;">
                                <span style="
                                    font-size:12px;font-weight:600;
                                    color:${sectionColor[sect] || '#7d8590'};
                                    text-transform:uppercase;letter-spacing:0.5px;
                                ">${sectionNames[sect] || sect}</span>
                            </label>
                            <span style="font-size:11px;color:var(--text-dim);">
                                (${charts.length} charts)
                            </span>
                        </div>
                        <!-- Individual chart checkboxes -->
                        <div class="section-charts-${sect}" style="
                            display:flex;flex-direction:column;gap:6px;
                            padding-left:20px;
                        ">
                            ${charts.map(c => `
                                <label style="display:flex;align-items:center;gap:8px;
                                    padding:8px 12px;border:1px solid var(--border);
                                    border-radius:6px;cursor:pointer;font-size:13px;">
                                    <input type="checkbox"
                                        class="chart-checkbox-${sect}"
                                        data-chart="${c.key}"
                                        ${c.enabled ? 'checked' : ''}>
                                    <span>${c.label}</span>
                                    <span style="margin-left:auto;color:var(--text-dim);font-size:11px;">
                                        ${c.data.length} pts
                                    </span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Share with viewers -->
            ${viewers.length > 0 ? `
            <div style="margin-bottom:24px;">
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.5px;color:var(--text-dim);margin-bottom:12px;">
                    Share With
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    ${viewers.map(v => `
                        <label style="display:flex;align-items:center;gap:8px;
                            padding:10px 12px;border:1px solid var(--border);
                            border-radius:6px;cursor:pointer;font-size:13px;">
                            <input type="checkbox" data-viewer="${v.id}"
                                ${accessIds.includes(v.id) ? 'checked' : ''}>
                            <span>${escapeHtml(v.display_name || v.username)}</span>
                            <span style="margin-left:auto;color:var(--text-dim);font-size:11px;">
                                viewer
                            </span>
                        </label>
                    `).join('')}
                </div>
            </div>` : ''}

            <!-- Actions -->
            <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;">
                <button id="builder-cancel" class="btn-secondary">Cancel</button>
                <button id="builder-save" class="btn-primary">
                    ${isEdit ? 'Update Report' : 'Save Report'}
                </button>
            </div>
            <div id="builder-msg"
                style="margin-top:12px;font-size:13px;text-align:center;">
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // ── Section toggle logic ──────────────────────────────
    modal.querySelectorAll('.section-toggle').forEach(toggle => {
        toggle.addEventListener('change', () => {
            const sect = toggle.dataset.section;
            modal.querySelectorAll(`.chart-checkbox-${sect}`)
                .forEach(cb => cb.checked = toggle.checked);
        });
    });

    // Update section toggle when individual charts change
    Object.keys(chartsBySect).forEach(sect => {
        modal.querySelectorAll(`.chart-checkbox-${sect}`).forEach(cb => {
            cb.addEventListener('change', () => {
                const allChecked = [...modal.querySelectorAll(`.chart-checkbox-${sect}`)]
                    .every(c => c.checked);
                modal.querySelector(`.section-toggle[data-section="${sect}"]`).checked = allChecked;
            });
        });
    });

    // ── Close handlers ────────────────────────────────────
    document.getElementById('builder-close').addEventListener('click', () => modal.remove());
    document.getElementById('builder-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    // ── Save handler ──────────────────────────────────────
    document.getElementById('builder-save').addEventListener('click', async () => {
        const title    = document.getElementById('builder-title').value.trim();
        const takeaway = document.getElementById('builder-takeaway').value.trim();
        const summary  = document.getElementById('builder-summary').value.trim();
        const msgEl    = document.getElementById('builder-msg');

        if (!title) {
            msgEl.style.color = 'var(--danger)';
            msgEl.textContent = 'Please enter a report title.';
            return;
        }

        // Build metrics snapshot
        const metricsSnapshot = {};
        allMetricDefs.forEach(m => {
            const cb = modal.querySelector(`input[data-metric="${m.key}"]`);
            metricsSnapshot[m.key] = {
                enabled: cb?.checked || false,
                label:   m.label,
                value:   m.value,
            };
        });

        // Build charts snapshot
        const chartsSnapshot = {};
        allChartDefs.forEach(c => {
            const cb = modal.querySelector(`input[data-chart="${c.key}"]`);
            chartsSnapshot[c.key] = {
                enabled: cb?.checked || false,
                key:     c.key,
                label:   c.label,
                type:    c.type,
                section: c.section,
                data:    c.data,
            };
        });

        // Build viewer access list
        const viewerIds = viewers
            .filter(v => modal.querySelector(`input[data-viewer="${v.id}"]`)?.checked)
            .map(v => v.id);

        // Determine primary section from first enabled chart
        const firstEnabledChart = allChartDefs.find(c =>
            modal.querySelector(`input[data-chart="${c.key}"]`)?.checked
        );
        const primarySection = firstEnabledChart?.section || 'overview';

        const snapshot = {
            title,
            takeaway,
            summary,
            date_range:      { start, end },
            metrics:         metricsSnapshot,
            charts:          chartsSnapshot,
            created_by_name: window.SESSION_NAME || 'Unknown',
            created_at:      new Date().toISOString(),
        };

        msgEl.style.color = 'var(--text-dim)';
        msgEl.textContent = 'Saving...';

        try {
            let reportId = existingReport?.id;

            if (isEdit) {
                const data = await apiRequest(`/api/reports/${reportId}`, 'PUT', { title, snapshot });
                if (!data?.success) throw new Error(data?.error || 'Failed to update');
            } else {
                const data = await apiRequest('/api/reports', 'POST', {
                    title,
                    section:    primarySection,
                    date_start: start,
                    date_end:   end,
                    snapshot,
                });
                if (!data?.success) throw new Error(data?.error || 'Failed to create');
                reportId = data.id;
            }

            // Update viewer access
            await apiRequest(`/api/reports/${reportId}/access`, 'PUT', { viewer_ids: viewerIds });

            modal.remove();
            renderReports();

        } catch (err) {
            msgEl.style.color = 'var(--danger)';
            msgEl.textContent = 'Failed to save: ' + err.message;
        }
    });
}