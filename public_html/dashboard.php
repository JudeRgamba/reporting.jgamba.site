<?php
require_once 'includes/auth.php';

$username     = htmlspecialchars($_SESSION['username']);
$display_name = htmlspecialchars($_SESSION['display_name'] ?? $_SESSION['username']);
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Dashboard</title>
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
  <style>
    /* ── Reset & Variables ─────────────────────────────── */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --bg: #080c10;
      --surface: #0d1117;
      --surface2: #161b22;
      --border: #21262d;
      --border2: #30363d;
      --text: #e6edf3;
      --text-muted: #7d8590;
      --text-dim: #484f58;
      --accent: #58a6ff;
      --accent2: #3fb950;
      --warn: #d29922;
      --danger: #f85149;
      --sidebar-w: 220px;
      --header-h: 56px;
      --radius: 6px;
      --font-mono: 'JetBrains Mono', monospace;
      --font-sans: 'Syne', sans-serif;
    }

    html,
    body {
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
    }

    /* ── Layout Shell ──────────────────────────────────── */
    .shell {
      display: grid;
      grid-template-columns: var(--sidebar-w) 1fr;
      grid-template-rows: var(--header-h) 1fr;
      grid-template-areas:
        "header header"
        "sidebar content";
      min-height: 100vh;
    }

    /* ── Header ────────────────────────────────────────── */
    .header {
      grid-area: header;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-logo {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 13px;
      color: var(--accent);
      letter-spacing: 0.05em;
      text-decoration: none;
      white-space: nowrap;
    }

    .header-logo span {
      color: var(--text-muted);
    }

    .header-divider {
      width: 1px;
      height: 20px;
      background: var(--border2);
    }

    .date-range {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      font-size: 12px;
    }

    .date-range label {
      color: var(--text-muted);
    }

    .date-range input[type="date"] {
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: var(--radius);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 4px 8px;
      outline: none;
      cursor: pointer;
    }

    .date-range input[type="date"]:focus {
      border-color: var(--accent);
    }

    .header-spacer {
      flex: 1;
    }

    .header-user {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
    }

    .header-user strong {
      color: var(--text);
    }

    .btn-logout {
      background: transparent;
      border: 1px solid var(--border2);
      border-radius: var(--radius);
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 5px 12px;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }

    .btn-logout:hover {
      border-color: var(--danger);
      color: var(--danger);
    }

    /* ── Sidebar ───────────────────────────────────────── */
    .sidebar {
      grid-area: sidebar;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 16px 0;
      position: sticky;
      top: var(--header-h);
      height: calc(100vh - var(--header-h));
      overflow-y: auto;
    }

    .nav-section {
      padding: 0 12px;
      margin-bottom: 4px;
    }

    .nav-label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 8px 8px 4px;
      display: block;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 8px;
      border-radius: var(--radius);
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.15s, color 0.15s;
      cursor: pointer;
    }

    .nav-link:hover {
      background: var(--surface2);
      color: var(--text);
    }

    .nav-link.active {
      background: rgba(88, 166, 255, 0.1);
      color: var(--accent);
    }

    .nav-icon {
      font-size: 14px;
      width: 18px;
      text-align: center;
    }

    /* ── Content ───────────────────────────────────────── */
    .content {
      grid-area: content;
      padding: 28px 32px;
      overflow-y: auto;
      min-height: calc(100vh - var(--header-h));
    }

    /* ── Shared UI Components ──────────────────────────── */
    .page-title {
      font-size: 20px;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 24px;
      letter-spacing: -0.02em;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }

    .metric-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      transition: border-color 0.15s;
    }

    .metric-card:hover {
      border-color: var(--border2);
    }

    .metric-label {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .metric-value {
      font-family: var(--font-mono);
      font-size: 28px;
      font-weight: 600;
      color: var(--text);
      line-height: 1;
    }

    .metric-sub {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-dim);
      margin-top: 4px;
    }

    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin-bottom: 20px;
      overflow: hidden;
    }

    .panel-header {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .panel-body {
      padding: 20px;
    }

    /* ── Tables ────────────────────────────────────────── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-mono);
      font-size: 12px;
    }

    .data-table th {
      text-align: left;
      padding: 8px 16px;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 11px;
      border-bottom: 1px solid var(--border);
    }

    .data-table td {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }

    .data-table tr:last-child td {
      border-bottom: none;
    }

    .data-table tr:hover td {
      background: var(--surface2);
    }

    /* ── Vitals Cards ──────────────────────────────────── */
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }

    .vital-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      text-align: center;
    }

    .vital-name {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
    }

    .vital-value {
      font-family: var(--font-mono);
      font-size: 32px;
      font-weight: 600;
      line-height: 1;
      margin-bottom: 8px;
    }

    .vital-badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ── Skeleton Loading ──────────────────────────────── */
    .skeleton {
      background: linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius);
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }

      100% {
        background-position: -200% 0;
      }
    }

    .skeleton-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }

    .skeleton-card {
      height: 88px;
    }

    .skeleton-chart {
      height: 280px;
      margin-bottom: 20px;
    }

    .skeleton-table {
      height: 200px;
    }

    /* ── Error State ───────────────────────────────────── */
    .error-state {
      background: rgba(248, 81, 73, 0.08);
      border: 1px solid rgba(248, 81, 73, 0.3);
      border-radius: var(--radius);
      padding: 20px;
      color: var(--danger);
      font-family: var(--font-mono);
      font-size: 13px;
    }

    /* ── Empty State ───────────────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: var(--text-dim);
      font-family: var(--font-mono);
      font-size: 13px;
    }

    .badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }

    /* ── Slow row highlight ────────────────────────────── */
    .row-slow td:first-child {
      border-left: 3px solid var(--danger);
    }

    /* ── Admin Form ────────────────────────────────────── */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .form-group input,
    .form-group select {
      background: var(--bg);
      border: 1px solid var(--border2);
      border-radius: var(--radius);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 13px;
      padding: 8px 12px;
      outline: none;
      transition: border-color 0.15s;
    }

    .form-group input:focus,
    .form-group select:focus {
      border-color: var(--accent);
    }

    .btn {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: var(--radius);
      border: none;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .btn:hover {
      opacity: 0.85;
    }

    .btn-primary {
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .btn-primary:hover {
      opacity: 0.85;
    }

    .btn-secondary {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: border-color 0.15s;
    }

    .btn-secondary:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .btn-danger {
      background: transparent;
      color: #f85149;
      border: 1px solid #f8514944;
      border-sradius: 6px;
      padding: 6px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-danger:hover {
      background: #f8514922;
    }

    .btn-full {
      width: 100%;
      margin-top: 6px;
      padding: 10px;
    }

    /* ── Expandable error rows ─────────────────────────── */
    .detail-row {
      display: none;
    }

    .detail-row.open {
      display: table-row;
    }

    .detail-cell {
      background: var(--bg) !important;
      font-family: var(--font-mono);
      font-size: 11px;
      white-space: pre-wrap;
      color: var(--text-muted);
      padding: 12px 16px !important;
    }

    .clickable {
      cursor: pointer;
    }

    .clickable:hover td {
      background: var(--surface2);
    }

    /* ── Hamburger (mobile) ────────────────────────────── */
    .hamburger {
      display: none;
      background: none;
      border: none;
      color: var(--text);
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
    }

    /* ── Responsive ────────────────────────────────────── */
    @media (max-width: 768px) {
      .shell {
        grid-template-columns: 1fr;
        grid-template-areas: "header" "content";
      }

      .sidebar {
        display: none;
        position: fixed;
        top: var(--header-h);
        left: 0;
        width: 240px;
        height: calc(100vh - var(--header-h));
        z-index: 200;
        box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
      }

      .sidebar.open {
        display: block;
      }

      .hamburger {
        display: block;
      }

      .cards-grid {
        grid-template-columns: 1fr 1fr;
      }

      .vitals-grid {
        grid-template-columns: 1fr;
      }

      .content {
        padding: 16px;
      }

      .date-range label {
        display: none;
      }
    }
  </style>
</head>

<body>
  <div class="shell">

    <!-- Header -->
    <header class="header">
      <button class="hamburger" id="hamburger">☰</button>
      <a class="header-logo" href="#/overview">jgamba<span>.analytics</span></a>
      <div class="header-divider"></div>
      <div class="date-range">
        <label for="date-start">From</label>
        <input type="date" id="date-start">
        <label for="date-end">To</label>
        <input type="date" id="date-end">
      </div>
      <div class="header-spacer"></div>
      <div class="header-user">signed in as <strong><?= $display_name ?></strong></div>
      <button class="btn-logout" id="logout-btn">Sign out</button>
    </header>

    <!-- Sidebar -->
    <nav>
      <?php if ($_SESSION['role'] !== 'viewer'): ?>

        <?php if (in_array('overview', $_SESSION['sections'] ?? []) || $_SESSION['role'] === 'super_admin'): ?>
          <a class="nav-link" href="#/overview">
            <span class="nav-icon">◈</span> Overview
          </a>
        <?php endif; ?>

        <?php if (in_array('performance', $_SESSION['sections'] ?? []) || $_SESSION['role'] === 'super_admin'): ?>
          <a class="nav-link" href="#/performance">
            <span class="nav-icon">◎</span> Performance
          </a>
        <?php endif; ?>

        <?php if (in_array('errors', $_SESSION['sections'] ?? []) || $_SESSION['role'] === 'super_admin'): ?>
          <a class="nav-link" href="#/errors">
            <span class="nav-icon">⚠</span> Errors
          </a>
        <?php endif; ?>

        <?php if (in_array('rawdata', $_SESSION['sections'] ?? []) || $_SESSION['role'] === 'super_admin'): ?>
          <a class="nav-link" href="#/rawdata">
            <span class="nav-icon">◫</span> Raw Data
          </a>
        <?php endif; ?>

      <?php endif; ?>

      <!-- Everyone gets reports/briefing -->
      <a class="nav-link" href="#/reports">
        <span class="nav-icon">📋</span>
        <?= $_SESSION['role'] === 'viewer' ? 'Briefings' : 'Reports' ?>
      </a>

      <?php if ($_SESSION['role'] === 'super_admin'): ?>
        <a class="nav-link" href="#/admin">
          <span class="nav-icon">⚙</span> Admin
        </a>
      <?php endif; ?>
    </nav>

    <!-- Content -->
    <main class="content" id="content">
      <!-- JavaScript renders all views here -->
    </main>

  </div>
  <script src="assets/js/dashboard.js"></script>
  <script>
    window.SESSION_USER_ID = <?= (int)$_SESSION['user_id'] ?>;
    window.SESSION_ROLE = <?= json_encode($_SESSION['role'] ?? 'viewer') ?>;
    window.SESSION_SECTIONS = <?= json_encode($_SESSION['sections'] ?? []) ?>;
    window.SESSION_NAME = <?= json_encode($_SESSION['display_name'] ?? '') ?>;
  </script>
</body>

</html>