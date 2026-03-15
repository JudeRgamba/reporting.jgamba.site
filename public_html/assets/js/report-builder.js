/* Report builder modal */
'use strict';

async function openReportBuilder(existingReport) {
        const { start, end } = getDateRange();
    const isEdit = !!existingReport;

    // Parse existing snapshot if editing
    const snap = existingReport
        ? (typeof existingReport.snapshot === 'string'
            ? JSON.parse(existingReport.snapshot)
            : existingReport.snapshot)
        : null;

    // Fetch all available data upfront
    const sections = window.SESSION_SECTIONS || [];
    const canSee = (s) => window.SESSION_ROLE === 'super_admin' || sections.includes(s);

    const loadingModal = document.createElement('div');
    loadingModal.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;
        z-index:1000;
    `;
    loadingModal.innerHTML = `
        <div style="
            background:var(--surface);
            border:1px solid var(--border);
            border-radius:12px;
            padding:40px 60px;
            text-align:center;
            color:var(--text-dim);
            font-size:14px;
        ">
            <div style="font-size:24px;margin-bottom:12px;">⏳</div>
            Loading report data...
        </div>
    `;
    document.body.appendChild(loadingModal);

    const [overviewData, pvData, perfData, errData, viewerData] = await Promise.all([
        canSee('overview')     ? apiFetch(`/api/dashboard?start=${start}&end=${end}`)   : null,
        canSee('overview')     ? apiFetch(`/api/pageviews?start=${start}&end=${end}`)   : null,
        canSee('performance')  ? apiFetch(`/api/performance?start=${start}&end=${end}`) : null,
        canSee('errors')       ? apiFetch(`/api/errors?start=${start}&end=${end}`)      : null,
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

    const ov   = overviewData?.data  || {};
    const pv   = pvData?.data        || {};
    const perf = perfData?.data      || {};
    const err  = errData?.data       || {};

    // Build viewer list for sharing
    const viewers   = viewerData?.data || [];

    const existingAccess = existingReport
        ? (await apiFetch(`/api/reports/${existingReport.id}/access`).catch(() => null))?.data || []
        : [];
    const accessIds = existingAccess.map(u => u.id);

    // Available metrics based on section access
    const allMetrics = [
        { key: 'total_pageviews',  label: 'Total Visitors',   value: ov.total_pageviews  ?? null, section: 'overview'     },
        { key: 'total_sessions',   label: 'Total Sessions',   value: ov.total_sessions   ?? null, section: 'overview'     },
        { key: 'avg_load_time_ms', label: 'Avg Load Time',    value: ov.avg_load_time_ms ? Math.round(ov.avg_load_time_ms) + 'ms' : null, section: 'performance' },
        { key: 'total_errors',     label: 'Total Errors',     value: ov.total_errors     ?? null, section: 'errors'       },
        { key: 'avg_lcp',          label: 'Avg LCP',          value: perf.byPage?.length ? Math.round(perf.byPage.reduce((a,r) => a + (Number(r.avg_lcp)||0), 0) / perf.byPage.length) + 'ms' : null, section: 'performance' },
        { key: 'avg_cls',          label: 'Avg CLS',          value: perf.byPage?.length ? (perf.byPage.reduce((a,r) => a + (Number(r.avg_cls)||0), 0) / perf.byPage.length).toFixed(3) : null, section: 'performance' },
    ].filter(m => canSee(m.section) && m.value !== null);

    const allCharts = [
        { key: 'pageviews_over_time', label: 'Pageviews Over Time', section: 'overview',     data: pv.byDay     || [] },
        { key: 'top_pages',           label: 'Top Pages',           section: 'overview',     data: pv.topPages  || [] },
        { key: 'performance_by_page', label: 'Performance by Page', section: 'performance',  data: perf.byPage  || [] },
        { key: 'error_trend',         label: 'Error Trend',         section: 'errors',       data: err.trend    || [] },
    ].filter(c => canSee(c.section) && c.data.length > 0);

    // Render modal
    const modal = document.createElement('div');
    modal.id = 'report-builder-modal';
    modal.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;
        z-index:1000;padding:20px;
    `;

    modal.innerHTML = `
        <div style="
            background:var(--surface);
            border:1px solid var(--border);
            border-radius:12px;
            width:100%;
            max-width:680px;
            max-height:90vh;
            overflow-y:auto;
            padding:32px;
        ">
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
            <div class="form-group" style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.5px;
                    color:var(--text-dim);margin-bottom:6px;">
                    Report Title
                </label>
                <input id="builder-title" type="text"
                    value="${escapeHtml(snap?.title || existingReport?.title || '')}"
                    placeholder="e.g. Weekly Performance Briefing"
                    style="width:100%;padding:10px 14px;background:var(--bg);
                        border:1px solid var(--border);border-radius:6px;
                        color:var(--text);font-size:14px;outline:none;">
            </div>

            <!-- Takeaway -->
            <div class="form-group" style="margin-bottom:16px;">
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
            <div class="form-group" style="margin-bottom:24px;">
                <label style="display:block;font-size:12px;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.5px;
                    color:var(--text-dim);margin-bottom:6px;">
                    Explanatory Summary
                    <span style="font-weight:400;text-transform:none;font-size:11px;">
                        — plain English context for non-technical readers
                    </span>
                </label>
                <textarea id="builder-summary" rows="3"
                    placeholder="e.g. Visitors are spending more time on product pages. Load times are well within acceptable ranges."
                    style="width:100%;padding:10px 14px;background:var(--bg);
                        border:1px solid var(--border);border-radius:6px;
                        color:var(--text);font-size:14px;outline:none;
                        resize:vertical;font-family:inherit;"
                >${escapeHtml(snap?.summary || '')}</textarea>
            </div>

            <!-- Metrics -->
            <div style="margin-bottom:24px;">
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.5px;color:var(--text-dim);margin-bottom:12px;">
                    Metrics to Include
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${allMetrics.map(m => `
                        <label style="display:flex;align-items:center;gap:8px;
                            padding:10px 12px;border:1px solid var(--border);
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

            <!-- Charts -->
            <div style="margin-bottom:24px;">
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.5px;color:var(--text-dim);margin-bottom:12px;">
                    Charts to Include
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    ${allCharts.map(c => `
                        <label style="display:flex;align-items:center;gap:8px;
                            padding:10px 12px;border:1px solid var(--border);
                            border-radius:6px;cursor:pointer;font-size:13px;">
                            <input type="checkbox" data-chart="${c.key}"
                                ${snap?.charts?.[c.key]?.enabled !== false ? 'checked' : ''}>
                            <span>${c.label}</span>
                            <span style="margin-left:auto;color:var(--text-dim);font-size:11px;">
                                ${c.data.length} data points
                            </span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <!-- Share with viewers -->
            ${viewers.length > 0 ? `
            <div style="margin-bottom:24px;">
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.5px;color:var(--text-dim);margin-bottom:12px;">
                    Share With
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
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
            <div id="builder-msg" style="margin-top:12px;font-size:13px;text-align:center;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    document.getElementById('builder-close').addEventListener('click', () => modal.remove());
    document.getElementById('builder-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Save handler
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
        allMetrics.forEach(m => {
            const cb = document.querySelector(`input[data-metric="${m.key}"]`);
            metricsSnapshot[m.key] = {
                enabled: cb?.checked || false,
                label:   m.label,
                value:   m.value,
            };
        });

        // Build charts snapshot
        const chartsSnapshot = {};
        allCharts.forEach(c => {
            const cb = document.querySelector(`input[data-chart="${c.key}"]`);
            chartsSnapshot[c.key] = {
                enabled: cb?.checked || false,
                label:   c.label,
                data:    c.data,
            };
        });

        // Build viewer access list
        const viewerIds = viewers
            .filter(v => document.querySelector(`input[data-viewer="${v.id}"]`)?.checked)
            .map(v => v.id);

        const snapshot = {
            title,
            takeaway,
            summary,
            date_range: { start, end },
            metrics:    metricsSnapshot,
            charts:     chartsSnapshot,
            created_by_name: window.SESSION_NAME || 'Unknown',
            created_at: new Date().toISOString(),
        };

        // Determine primary section
        const primarySection = allCharts.find(c =>
            document.querySelector(`input[data-chart="${c.key}"]`)?.checked
        )?.section || allMetrics[0]?.section || 'overview';

        msgEl.style.color = 'var(--text-dim)';
        msgEl.textContent = 'Saving...';

        try {
            let reportId = existingReport?.id;

            if (isEdit) {
                // Update existing report
                const data = await apiRequest(`/api/reports/${reportId}`, 'PUT', { title, snapshot });
                if (!data?.success) throw new Error(data?.error || 'Failed to update');
            } else {
                // Create new report
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
            msgEl.textContent = 'Failed to save report: ' + err.message;
        }
    });
};