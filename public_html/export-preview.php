<?php
session_start();
require_once 'includes/db.php';

$token = $_GET['token'] ?? '';
if (!$token) {
    http_response_code(403);
    exit('Access denied');
}

// Look up token
$stmt = $pdo->prepare(
    'SELECT * FROM export_tokens WHERE token = ? AND expires_at > NOW()'
);
$stmt->execute([$token]);
$tokenRow = $stmt->fetch();

if (!$tokenRow) {
    http_response_code(403);
    exit('Token expired or invalid');
}

// Get report
$stmt = $pdo->prepare(
    'SELECT r.*, u.display_name AS created_by_name
     FROM reports r JOIN users u ON r.created_by = u.id
     WHERE r.id = ?'
);
$stmt->execute([$tokenRow['report_id']]);
$report = $stmt->fetch();

if (!$report) {
    http_response_code(404);
    exit('Report not found');
}

$snapshot = json_decode($report['snapshot'], true);
$metrics  = $snapshot['metrics']    ?? [];
$charts   = $snapshot['charts']     ?? [];
$range    = $snapshot['date_range'] ?? [];

$enabledMetrics = array_filter($metrics, fn($m) => $m['enabled'] ?? false);
$enabledCharts  = array_filter($charts,  fn($c) => ($c['enabled'] ?? false) && !empty($c['data']));
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($report['title']) ?></title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: white;
            color: #111;
            font-size: 13px;
            line-height: 1.5;
            padding: 0;
        }

        .page {
            max-width: 100%;
            padding: 20px;
        }

        .report-header {
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }

        .report-title {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .report-meta {
            font-size: 12px;
            color: #666;
        }

        .takeaway {
            background: #f0f7ff;
            border-left: 4px solid #2563eb;
            padding: 12px 16px;
            margin-bottom: 16px;
            border-radius: 0 6px 6px 0;
        }

        .takeaway-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #2563eb;
            margin-bottom: 4px;
        }

        .takeaway-text {
            font-size: 15px;
            font-weight: 600;
        }

        .summary {
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 14px 16px;
            margin-bottom: 16px;
            font-size: 13px;
            line-height: 1.7;
        }

        .section-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #888;
            margin-bottom: 8px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        }

        .metric-card {
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 12px;
            text-align: center;
        }

        .metric-value {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 4px;
            font-family: monospace;
        }

        .metric-label {
            font-size: 10px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
        }

        .chart-panel {
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            overflow: hidden;
            page-break-inside: avoid;
        }

        .chart-panel.wide {
            grid-column: span 2;
        }

        .chart-title {
            padding: 10px 14px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #555;
        }

        .chart-body {
            padding: 14px;
        }

        .footer {
            text-align: center;
            padding: 16px;
            font-size: 11px;
            color: #aaa;
            border-top: 1px solid #e0e0e0;
            margin-top: 20px;
        }
    </style>
</head>

<body>
    <div class="page">

        <!-- Header -->
        <div class="report-header">
            <div class="report-title">
                <?= htmlspecialchars($report['title']) ?>
            </div>
            <div class="report-meta">
                Prepared by <?= htmlspecialchars($snapshot['created_by_name'] ?? 'Unknown') ?>
                <?php if (!empty($range['start'])): ?>
                    · <?= htmlspecialchars($range['start']) ?> → <?= htmlspecialchars($range['end']) ?>
                <?php endif; ?>
                · <?= date('F j, Y', strtotime($report['created_at'])) ?>
            </div>
        </div>

        <!-- Takeaway -->
        <?php if (!empty($snapshot['takeaway'])): ?>
            <div class="takeaway">
                <div class="takeaway-label">Key Takeaway</div>
                <div class="takeaway-text">
                    <?= htmlspecialchars($snapshot['takeaway']) ?>
                </div>
            </div>
        <?php endif; ?>

        <!-- Summary -->
        <?php if (!empty($snapshot['summary'])): ?>
            <div class="summary">
                <div class="section-label">What This Means</div>
                <?= nl2br(htmlspecialchars($snapshot['summary'])) ?>
            </div>
        <?php endif; ?>

        <!-- Metrics -->
        <?php if (!empty($enabledMetrics)): ?>
            <div style="margin-bottom:20px;">
                <div class="section-label">Numbers at a Glance</div>
                <div class="metrics-grid">
                    <?php foreach ($enabledMetrics as $m): ?>
                        <div class="metric-card">
                            <div class="metric-value">
                                <?= htmlspecialchars($m['value'] ?? '—') ?>
                            </div>
                            <div class="metric-label">
                                <?= htmlspecialchars($m['label'] ?? '') ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endif; ?>

        <!-- Charts -->
        <?php if (!empty($enabledCharts)): ?>
            <div class="section-label">Charts</div>
            <div class="charts-grid" id="charts-grid">
                <?php
                $vitalTypes   = ['vital'];
                $wideTypes    = ['line_dual', 'scatter'];
                $chartIndex   = 0;
                foreach ($enabledCharts as $key => $chart):
                    $isWide  = in_array($chart['type'] ?? '', $wideTypes) ||
                        ($chart['type'] === 'bar_horizontal' && count($chart['data']) > 6);
                    $height  = match ($chart['type'] ?? 'bar') {
                        'vital'          => 160,
                        'scatter'        => 240,
                        'line', 'line_dual' => 200,
                        'bar_horizontal' => max(120, min(count($chart['data']), 10) * 30 + 40),
                        default          => 180,
                    };
                ?>
                    <div class="chart-panel <?= $isWide ? 'wide' : '' ?>">
                        <div class="chart-title">
                            <?= htmlspecialchars($chart['label'] ?? $key) ?>
                        </div>
                        <div class="chart-body" style="height:<?= $height ?>px;position:relative;">
                            <canvas id="chart-<?= $chartIndex ?>"></canvas>
                        </div>
                    </div>
                <?php $chartIndex++;
                endforeach; ?>
            </div>
        <?php endif; ?>

        <!-- Footer -->
        <div class="footer">
            This report was generated on
            <?= date('F j, Y', strtotime($report['created_at'])) ?>
            and reflects a snapshot of data at that time.
        </div>
    </div>

    <script>
        const chartsData = <?= json_encode(array_values($enabledCharts)) ?>;
        const totalCharts = chartsData.length;
        let chartsRendered = 0;

        function chartDone() {
            chartsRendered++;
            if (chartsRendered >= totalCharts) {
                window.status = 'ready';
            }
        }

        if (totalCharts === 0) {
            window.status = 'ready';
        }

        const COLORS = {
            blue: '#2563eb',
            green: '#16a34a',
            red: '#dc2626',
            yellow: '#d97706',
            purple: '#7c3aed',
            gray: '#6b7280',
        };

        chartsData.forEach((chart, i) => {
            const canvas = document.getElementById('chart-' + i);
            if (!canvas || !chart.data?.length) {
                chartDone();
                return;
            }

            const type = chart.type || 'bar';

            if (type === 'line') {
                const xKey = 'day';
                const yKey = chart.key === 'error_trend' ? 'error_count' :
                    chart.key === 'error_rate' ? 'error_rate' :
                    chart.key === 'bounce_rate' ? 'bounce_rate' : 'views';
                const color = chart.key === 'error_trend' ? COLORS.red :
                    chart.key === 'error_rate' ? COLORS.yellow : COLORS.blue;

                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: chart.data.map(d => String(d[xKey]).slice(0, 10).slice(5)),
                        datasets: [{
                            data: chart.data.map(d => Number(d[yKey])),
                            borderColor: color,
                            backgroundColor: color + '22',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            pointRadius: 3,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            onComplete: chartDone
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: '#888',
                                    font: {
                                        size: 10
                                    }
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: '#888'
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                        },
                    },
                });

            } else if (type === 'line_dual') {
                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: chart.data.map(d => String(d.day).slice(0, 10).slice(5)),
                        datasets: [{
                                label: 'Pageviews',
                                data: chart.data.map(d => Number(d.pageviews || d.views || 0)),
                                borderColor: COLORS.blue,
                                backgroundColor: COLORS.blue + '22',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.3,
                                pointRadius: 3,
                            },
                            {
                                label: 'Sessions',
                                data: chart.data.map(d => Number(d.sessions || 0)),
                                borderColor: COLORS.green,
                                backgroundColor: COLORS.green + '22',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.3,
                                pointRadius: 3,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            onComplete: chartDone
                        },
                        plugins: {
                            legend: {
                                display: true,
                                labels: {
                                    font: {
                                        size: 11
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: '#888',
                                    font: {
                                        size: 10
                                    }
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: '#888'
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                        },
                    },
                });

            } else if (type === 'bar_horizontal') {
                const labelKey = chart.key === 'top_pages_bar' ? 'url' :
                    chart.key === 'event_types' ? 'type' :
                    chart.key === 'errors_by_type' ? 'error_type' :
                    chart.key === 'errors_by_page' ? 'url' :
                    chart.key === 'errors_by_element' ? 'element_type' :
                    chart.key === 'traffic_sources' ? 'source' :
                    chart.key === 'connection_types' ? 'connection_type' : 'label';
                const valueKey = chart.key === 'traffic_sources' ? 'pageviews' :
                    chart.key === 'connection_types' ? 'count' : ['errors_by_page', 'errors_by_type', 'errors_by_element'].includes(chart.key) ?
                    'count' :
                    chart.key === 'event_types' ? 'count' : 'views';
                const color = chart.key?.startsWith('error') ? COLORS.red : COLORS.blue;

                new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: chart.data.slice(0, 10).map(d =>
                            String(d[labelKey] || '').replace('https://test.jgamba.site', '') || '/'
                        ),
                        datasets: [{
                            data: chart.data.slice(0, 10).map(d => Number(d[valueKey] || 0)),
                            backgroundColor: color + '44',
                            borderColor: color,
                            borderWidth: 1,
                            borderRadius: 4,
                            maxBarThickness: 28,
                        }],
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            onComplete: chartDone
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                beginAtZero: true,
                                ticks: {
                                    color: '#888',
                                    stepSize: 1,
                                    callback: v => Number.isInteger(v) ? v : null
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                            y: {
                                ticks: {
                                    color: '#888',
                                    font: {
                                        size: 10
                                    }
                                },
                                grid: {
                                    display: false
                                }
                            },
                        },
                    },
                });

            } else if (type === 'bar') {
                const labelKey = chart.key === 'speed_distribution' ? 'bucket' :
                    chart.key === 'pages_per_session' ? 'pages_in_session' :
                    chart.key === 'device_breakdown' ? 'device_type' :
                    chart.key === 'session_durations' ? 'duration_bucket' : 'label';
                const valueKey = chart.key === 'pages_per_session' ? 'session_count' :
                    chart.key === 'device_breakdown' ? 'sessions' :
                    chart.key === 'session_durations' ? 'session_count' : 'count';

                const bucketOrder = {
                    speed_distribution: ['0-500ms', '500ms-1s', '1-2s', '2-3s', '3s+'],
                    session_durations: ['0-10s', '10-30s', '30-60s', '1-3min', '3-10min', '10min+'],
                };
                const ordered = bucketOrder[chart.key] ?
                    bucketOrder[chart.key].map(b =>
                        chart.data.find(d => d[labelKey] === b) || {
                            [labelKey]: b,
                            [valueKey]: 0
                        }
                    ) :
                    chart.data;

                const speedColors = ['#16a34a', '#16a34a', '#d97706', '#dc2626', '#dc2626'];

                new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: ordered.map(d => String(d[labelKey])),
                        datasets: [{
                            data: ordered.map(d => Number(d[valueKey] || 0)),
                            backgroundColor: chart.key === 'speed_distribution' ?
                                speedColors.map(c => c + '44') : COLORS.blue + '44',
                            borderColor: chart.key === 'speed_distribution' ?
                                speedColors : COLORS.blue,
                            borderWidth: 1,
                            borderRadius: 4,
                            maxBarThickness: 48,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            onComplete: chartDone
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: '#888'
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: '#888',
                                    stepSize: 1,
                                    callback: v => Number.isInteger(v) ? v : null
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                        },
                    },
                });

            } else if (type === 'scatter') {
                new Chart(canvas, {
                    type: 'scatter',
                    data: {
                        datasets: [{
                            data: chart.data,
                            backgroundColor: chart.data.map(d =>
                                d.y > 3000 ? '#dc262699' : d.y > 1500 ? '#d9770699' : '#16a34a99'
                            ),
                            pointRadius: 6,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            onComplete: chartDone
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: ctx => [ctx.raw.label, `TTFB: ${ctx.raw.x}ms`, `Load: ${ctx.raw.y}ms`]
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'TTFB (ms)',
                                    color: '#888'
                                },
                                ticks: {
                                    color: '#888',
                                    callback: v => v + 'ms'
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'Load (ms)',
                                    color: '#888'
                                },
                                beginAtZero: true,
                                ticks: {
                                    color: '#888',
                                    callback: v => v + 'ms'
                                },
                                grid: {
                                    color: '#eee'
                                }
                            },
                        },
                    },
                });

            } else if (type === 'vital') {
                const d = chart.data[0];
                if (!d) {
                    chartDone();
                    return;
                }
                const color = d.value < d.thresholds[0] ? '#16a34a' :
                    d.value < d.thresholds[1] ? '#d97706' : '#dc2626';
                new Chart(canvas, {
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
                        maintainAspectRatio: false,
                        animation: {
                            onComplete: chartDone
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: '#888'
                                },
                                grid: {
                                    display: false
                                }
                            },
                            y: {
                                beginAtZero: true,
                                max: Math.max(d.value * 1.4, d.thresholds[1] * 1.3),
                                ticks: {
                                    color: '#888',
                                    callback: v => v + d.unit
                                },
                                grid: {
                                    color: '#eee'
                                },
                            },
                        },
                    },
                });

            } else {
                // Unknown chart type — still count it
                chartDone();
            }
        });
    </script>
</body>

</html>