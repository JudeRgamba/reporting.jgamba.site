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
      flex-shrink: 0;
    }

    .date-range {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      font-size: 12px;
    }

    .date-range-btn {
      display: none;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: var(--radius);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 5px 10px;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
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
      white-space: nowrap;
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
      white-space: nowrap;
      flex-shrink: 0;
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
      padding: 20px 8px;
      position: sticky;
      top: var(--header-h);
      height: calc(100vh - var(--header-h));
      overflow-y: auto;
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
      flex-shrink: 0;
    }

    #sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      top: var(--header-h);
      z-index: 199;
      /* just below sidebar */
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }

    #sidebar-overlay.visible {
      display: block;
    }

    /* ── Content ───────────────────────────────────────── */
    .content {
      grid-area: content;
      padding: 28px 32px;
      padding-top: 36px;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: calc(100vh - var(--header-h));
      max-width: 100%;
      box-sizing: border-box;
    }

    /* ── Shared UI Components ──────────────────────────── */
    .page-title {
      font-size: 20px;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 24px;
      letter-spacing: -0.02em;
    }

    /* ── Metric Cards ──────────────────────────────────── */
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

    /* ── Panels ────────────────────────────────────────── */
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
      overflow-x: hidden;
    }

    /* ── Charts ────────────────────────────────────────── */
    canvas {
      max-width: 100% !important;
      height: auto !important;
    }

    /* ── Tables ────────────────────────────────────────── */
    .table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .table-wrap .data-table {
      min-width: 480px;
    }

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

    .shell * {
      max-width: 100%;
    }

    /* Exception for tables inside scroll wrappers */
    .table-wrap * {
      max-width: none;
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

    /* ── Badge ─────────────────────────────────────────── */
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

    /* ── Buttons ───────────────────────────────────────── */
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
      border-radius: 6px;
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

    /* ── Hamburger ─────────────────────────────────────── */
    .hamburger {
      display: none;
      background: none;
      border: none;
      color: var(--text);
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      flex-shrink: 0;
    }

    /* ── Responsive: Large tablets ─────────────────────── */
    @media (max-width: 1024px) {
      .content {
        padding: 24px;
      }

      .cards-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .skeleton-cards {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* ── Responsive: Tablets ───────────────────────────── */
    @media (max-width: 768px) {
      .shell {
        grid-template-columns: 1fr;
        grid-template-areas:
          "header"
          "content";
      }

      .content {
        padding: 16px;
      }

      .sidebar {
        display: block;
        position: fixed;
        top: var(--header-h);
        left: 0;
        width: 240px;
        height: calc(100vh - var(--header-h));
        z-index: 200;
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.6);

        /* Translucent with blur */
        background: rgba(13, 17, 23, 0.88);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);

        /* Border radius on right edges only */
        border-radius: 0 10px 10px 0;
        border-right: 1px solid rgba(33, 38, 45, 0.6);

        /* Slide animation */
        transform: translateX(-100%);
        visibility: hidden;
        transition: transform 0.25s ease, visibility 0s linear 0.25s;
      }

      .sidebar.open {
        transform: translateX(0);
        visibility: visible;
        transition: transform 0.25s ease, visibility 0s linear 0s;
      }

      .hamburger {
        display: block;
      }

      .cards-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .vitals-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      .skeleton-cards {
        grid-template-columns: repeat(2, 1fr);
      }

      .date-range label {
        display: none;
      }

      .metric-value {
        font-size: 22px;
      }

      .vital-value {
        font-size: 24px;
      }

      .page-title {
        font-size: 18px;
      }
    }

    /* ── Responsive: Mobile (iPhone 15 Pro = 393px) ────── */
    @media (max-width: 480px) {
      .content {
        padding: 12px;
      }

      .panel-body canvas {
        max-height: 200px;
      }

      .cards-grid {
        grid-template-columns: 1fr;
        gap: 10px;
        margin-bottom: 16px;
      }

      .vitals-grid {
        grid-template-columns: 1fr;
        gap: 10px;
        margin-bottom: 16px;
      }

      .skeleton-cards {
        grid-template-columns: 1fr;
      }

      .metric-card {
        padding: 14px;
      }

      .metric-value {
        font-size: 20px;
      }

      .metric-label {
        font-size: 10px;
      }

      .vital-card {
        padding: 14px;
      }

      .vital-value {
        font-size: 22px;
      }

      .panel-header {
        font-size: 11px;
        padding: 10px 14px;
      }

      .panel-body {
        padding: 12px;
      }

      .page-title {
        font-size: 16px;
        margin-bottom: 16px;
      }

      .header {
        flex-wrap: nowrap;
        padding: 0px 12px;
        gap: 8px;
        height: var(--header-h);
        overflow: hidden;
      }

      .header-logo {
        font-size: 12px;
        flex-shrink: 0;
      }

      .header-divider {
        display: none;
      }

      .header-user {
        display: none;
      }

      .header-spacer {
        flex: 1;
      }

      .header-user {
        display: none;
      }

      .date-range input[type="date"] {
        flex: 1;
        font-size: 10px;
        padding: 3px 4px;
        min-width: 0;
      }

      .date-range {
        display: none;
      }

      .date-range-btn {
        display: block;
      }

      .date-range label {
        display: none;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .btn-primary,
      .btn-secondary,
      .btn-danger {
        font-size: 12px;
        padding: 6px 10px;
      }

      .btn-logout {
        font-size: 10px;
        padding: 4px 8px;
        flex-shrink: 0;
      }
    }

    /* ── Viewer: full width layout ─────────────────────── */
    <?php if ($_SESSION['role'] === 'viewer'): ?>.shell {
      grid-template-columns: 1fr !important;
      grid-template-areas:
        "header"
        "content" !important;
    }

    <?php endif; ?>
  </style>
</head>

<body>
  <div class="shell">

    <!-- Header -->
    <header class="header">
      <?php if ($_SESSION['role'] !== 'viewer'): ?>
        <button class="hamburger" id="hamburger">☰</button>
      <?php endif; ?>
      <a class="header-logo" href="#/overview">jgamba<span>.analytics</span></a>
      <div class="header-divider"></div>
      <div class="date-range">
        <label for="date-start">From</label>
        <input type="date" id="date-start">
        <label for="date-end">To</label>
        <input type="date" id="date-end">
      </div>
      <button class="date-range-btn" id="date-range-btn">📅 Set Date</button>
      <div class="header-spacer"></div>
      <div class="header-user">signed in as <strong><?= $display_name ?></strong></div>
      <button class="btn-logout" id="logout-btn">Sign out</button>
    </header>

    <!-- Sidebar -->
    <?php if ($_SESSION['role'] !== 'viewer'): ?>
      <nav class="sidebar" id="sidebar">
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

        <a class="nav-link" href="#/reports">
          <span class="nav-icon">📋</span> Reports
        </a>

        <?php if ($_SESSION['role'] === 'super_admin'): ?>
          <a class="nav-link" href="#/admin">
            <span class="nav-icon">⚙</span> Admin
          </a>
        <?php endif; ?>
      </nav>
    <?php endif; ?>
    <div id="sidebar-overlay"></div>

    <!-- Content -->
    <main class="content" class="main">
      <div id="content"></div>
    </main>

    <!-- Mobile date picker modal -->
    <div id="date-modal" style="
      display:none;
      position:fixed;
      inset:0;
      background:rgba(0,0,0,0.6);
      z-index:300;
      align-items:center;
      justify-content:center;
      padding:20px;
    ">
      <div style="
          background:var(--surface);
          border:1px solid var(--border);
          border-radius:12px;
          padding:24px;
          width:100%;
          max-width:320px;
      ">
        <div style="font-size:15px;font-weight:700;margin-bottom:20px;">
          Set Date Range
        </div>
        <div style="margin-bottom:14px;">
          <label style="
                  display:block;
                  font-family:var(--font-mono);
                  font-size:11px;
                  color:var(--text-muted);
                  text-transform:uppercase;
                  letter-spacing:0.06em;
                  margin-bottom:6px;
              ">From</label>
          <input type="date" id="modal-date-start" style="
                  width:100%;
                  padding:10px 12px;
                  background:var(--bg);
                  border:1px solid var(--border2);
                  border-radius:var(--radius);
                  color:var(--text);
                  font-family:var(--font-mono);
                  font-size:13px;
                  outline:none;
              ">
        </div>
        <div style="margin-bottom:20px;">
          <label style="
                  display:block;
                  font-family:var(--font-mono);
                  font-size:11px;
                  color:var(--text-muted);
                  text-transform:uppercase;
                  letter-spacing:0.06em;
                  margin-bottom:6px;
              ">To</label>
          <input type="date" id="modal-date-end" style="
                  width:100%;
                  padding:10px 12px;
                  background:var(--bg);
                  border:1px solid var(--border2);
                  border-radius:var(--radius);
                  color:var(--text);
                  font-family:var(--font-mono);
                  font-size:13px;
                  outline:none;
              ">
        </div>
        <div style="display:flex;gap:10px;">
          <button id="date-modal-cancel" class="btn-secondary" style="flex:1;">
            Cancel
          </button>
          <button id="date-modal-apply" class="btn-primary" style="flex:1;">
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.SESSION_USER_ID = <?= (int)$_SESSION['user_id'] ?>;
    window.SESSION_ROLE = <?= json_encode($_SESSION['role'] ?? 'viewer') ?>;
    window.SESSION_SECTIONS = <?= json_encode($_SESSION['sections'] ?? []) ?>;
    window.SESSION_NAME = <?= json_encode($_SESSION['display_name'] ?? '') ?>;
  </script>
  <script src="assets/js/dashboard.js"></script>
  <script src="assets/js/report-builder.js"></script>
  <script src="assets/js/report-briefing.js"></script>
</body>

</html>