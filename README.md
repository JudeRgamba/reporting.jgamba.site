# Hole in One Analytics - Full-Stack Web Analytics Platform

A beginner web analytics pipeline built from scratch for CSE 135. Collects behavioral and performance data from a test site, stores it in MySQL, exposes it through a REST API, and visualizes it in a role-based SPA dashboard with PDF report generation.

---

## Live URLs

| Site | URL | Purpose |
|------|-----|---------|
| Test Site | https://test.jgamba.site | Wrecked Tech — the site being tracked |
| Collector | https://collector.jgamba.site | Receives beacons + serves the SDK |
| Dashboard | https://reporting.jgamba.site | Analytics SPA dashboard |

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure](#infrastructure)
3. [File Structure](#file-structure)
4. [Data Pipeline](#data-pipeline)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Dashboard Views](#dashboard-views)
8. [Authentication & Authorization](#authentication--authorization)
9. [Reports & PDF Export](#reports--pdf-export)
10. [Security](#security)
11. [How to Use the Dashboard](#how-to-use-the-dashboard)
12. [Tips & Troubleshooting](#tips--troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    test.jgamba.site                         │
│  Every page embeds:                                         │
│  1. consent.js    → ConsentManager (GPC + cookie banner)    │
│  2. collector.js  → analytics SDK                           │
│  3. pixel.php     → server-side tracking pixel (1x1 GIF)    │
└──────────────────────────┬──────────────────────────────────┘
                           │ user visits page
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 collector.js fires beacons                  │
│  Captures: pageview, vitals, error, click, scroll           │
│  Delivery: sendBeacon → fetch(keepalive) → fetch → retry    │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /collect
                           ▼
┌─────────────────────────────────────────────────────────────┐
│       collector.jgamba.site — endpoint.js (port 3005)       │
│  • Validates payload                                        │
│  • Adds server timestamp + IP                               │
│  • INSERTs row into MySQL analytics.events                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ MySQL INSERT
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              MySQL — analytics database                     │
│  Tables: events, users, reports, report_access,             │
│          analyst_sections, comments, export_tokens          │
└──────────────────────────┬──────────────────────────────────┘
                           │ SQL queries
                           ▼
┌─────────────────────────────────────────────────────────────┐
│      reporting.jgamba.site/api/* — reporting-api.js         │
│                        (port 3006)                          │
│  Aggregation endpoints, user management, reports,           │
│  comments, behavioral analytics, PDF export                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ JSON responses
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         reporting.jgamba.site — PHP + JavaScript SPA        │
│  login.php / auth.php / dashboard.php                       │
│  dashboard.js / behavior.js / report-builder.js /           │
│  report-briefing.js                                         │
└─────────────────────────────────────────────────────────────┘
```

### Three Data Streams

```
Stream 1: JS Beacons (collector.js)
  test site → POST /collect → endpoint.js → MySQL events table

Stream 2: Tracking Pixel (pixel.php)
  test site → GET pixel.php → logs to pixel-hits.jsonl

Stream 3: Apache Server Logs
  test site → Apache → access.log (includes _csid session cookie)

All three streams tied together via _csid session cookie
```

---

## Infrastructure

| Component | Details |
|-----------|---------|
| **Server** | DigitalOcean droplet — Ubuntu 24, 1 vCPU, 2GB RAM |
| **Web server** | Apache2 with mod_proxy (reverse proxies `/api` and `/collect` to Node) |
| **SSL** | Let's Encrypt via Certbot |
| **Database** | MySQL — `analytics` database, `collector` user |
| **Node apps** | Managed with PM2 (`pm2 startup` + `pm2 save`) |
| **Deployment** | GitHub Actions with `easingthemes/ssh-deploy` |

### PM2 Processes

| Name | File | Port |
|------|------|------|
| `collector` | `endpoint.js` | 3005 |
| `reporting` | `reporting-api.js` | 3006 |

### Key Commands

```bash
# Restart services
pm2 restart collector
pm2 restart reporting

# View logs
pm2 logs reporting --lines 20
pm2 logs collector --lines 20

# Check status
pm2 status

# Reload Apache after config changes
sudo apache2ctl configtest
sudo systemctl reload apache2

# Sync Apache logs for server error tracking
sudo cp /var/log/apache2/access.log \
  /var/www/reporting.jgamba.site/app/apache-access.log
```

---

## File Structure

```
/var/www/
├── collector.jgamba.site/
│   ├── public_html/
│   │   ├── collector.js          ← analytics SDK (runs on test site)
│   │   ├── consent.js            ← ConsentManager (GPC + cookie check)
│   │   └── pixel.php             ← tracking pixel (1x1 GIF)
│   └── app/
│       ├── endpoint.js           ← receives beacons, inserts to MySQL
│       └── node_modules/
│
├── reporting.jgamba.site/
│   ├── public_html/
│   │   ├── login.php             ← auth form + session creation
│   │   ├── logout.php            ← destroys session
│   │   ├── dashboard.php         ← SPA shell (auth protected)
│   │   ├── users-admin.php       ← PHP proxy for admin user management
│   │   ├── export-preview.php    ← PDF export rendering page
│   │   ├── exports/              ← generated PDF files
│   │   ├── includes/
│   │   │   ├── auth.php          ← session check, redirects to login
│   │   │   ├── admin-auth.php    ← role check for admin endpoints
│   │   │   └── db.php            ← PDO connection to MySQL
│   │   └── assets/js/
│   │       ├── dashboard.js      ← SPA router + all views + helpers
│   │       ├── behavior.js       ← behavioral analytics view
│   │       ├── report-builder.js ← report builder modal
│   │       └── report-briefing.js← stakeholder briefing + PDF export
│   └── app/
│       ├── reporting-api.js      ← REST API on port 3006
│       ├── apache-access.log     ← synced Apache log for error tracking
│       └── node_modules/
│
└── test.jgamba.site/
    └── public_html/              ← Wrecked Tech test site
        ├── index.html
        ├── products.html
        ├── product-detail.html
        └── cart.html
```

---

## Data Pipeline

### Collector Embed Snippet

Add to every page on `test.jgamba.site` inside `<head>`:

```html
<script src="https://collector.jgamba.site/consent.js"></script>
<script>
  window._cq = window._cq || [];
  _cq.push(['init', {
    endpoint: 'https://collector.jgamba.site/collect',
    debug: false,
    sampleRate: 1.0,
    respectConsent: true
  }]);
</script>
<script async src="https://collector.jgamba.site/collector.js"></script>
```

### What Gets Collected

| Event Type | Trigger | Key Data |
|------------|---------|----------|
| `pageview` | Page load | URL, referrer, timing, device info |
| `vitals` | Page hide/unload | LCP, CLS, INP scores |
| `error` | JS error, resource fail | Error type, element, message |
| `click` | User click | Element, coordinates |
| `scroll_depth` | Intersection Observer | Depth %, page |
| `scroll_final` | Page unload | Final scroll depth |

---

## Database Schema

### `events` — all collected analytics data

```sql
id, session_id, event_type, url, page_title, referrer,
user_agent, ip, timestamp, server_ts, language,
screen_width, screen_height, viewport_w, viewport_h,
device_memory, connection, timezone, touch,
ttfb, dom_complete, load_event, dns_lookup, tcp_connect,
lcp, lcp_score, cls, cls_score, inp, inp_score,
time_on_page, raw JSON
```

### `users` — dashboard users

```sql
id, username, email, password_hash, display_name,
role (super_admin | analyst | viewer),
created_at, last_login
```

### `analyst_sections` — section assignments per analyst

```sql
id, user_id, section
-- section: overview | performance | errors | rawdata | behavior | reports
```

### `reports` — saved stakeholder reports

```sql
id, title, section, created_by, date_start, date_end,
snapshot JSON,  -- full frozen data snapshot at save time
created_at, updated_at
```

### `report_access` — viewer access to reports

```sql
report_id, user_id
```

### `comments` — analyst notes per section/date range

```sql
id, section, date_start, date_end, user_id,
display_name, body, created_at
```

### `export_tokens` — short-lived tokens for PDF generation

```sql
id, token, report_id, user_id, expires_at
```

---

## API Reference

All endpoints require role headers set automatically by the dashboard:

```
X-User-Role: super_admin | analyst | viewer
X-User-Sections: ["overview","performance",...]
X-User-Id: 1
```

### Aggregation Endpoints (all accept `?start=&end=`)

| Endpoint | Section Required | Description |
|----------|-----------------|-------------|
| `GET /api/dashboard` | overview | Summary cards |
| `GET /api/pageviews` | overview | Pageviews by day + top pages |
| `GET /api/sessions-over-time` | overview | Pageviews + sessions per day |
| `GET /api/event-types` | overview | Event type counts |
| `GET /api/performance` | performance | Per-page vitals averages |
| `GET /api/performance/distribution` | performance | Load time histogram |
| `GET /api/errors` | errors | Error trend + grouped messages |
| `GET /api/errors/by-type` | errors | Errors by type |
| `GET /api/errors/by-page` | errors | Errors by page |
| `GET /api/errors/by-element` | errors | Errors by element |
| `GET /api/errors/detail` | errors | Full error log |
| `GET /api/errors/rate` | errors | Error rate % of pageviews |
| `GET /api/errors/server-logs` | errors | Apache HTTP errors |
| `GET /api/events` | rawdata | Last 100 raw events |

### Behavioral Analytics Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/behavior/bounce-rate` | Bounce rate over time |
| `GET /api/behavior/pages-per-session` | Session depth distribution |
| `GET /api/behavior/scroll-depth` | Scroll depth funnel per page |
| `GET /api/behavior/traffic-sources` | Referrer grouping |
| `GET /api/behavior/devices` | Device + connection breakdown |
| `GET /api/behavior/session-lengths` | Session duration distribution |

### Reports & Comments

| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/reports` | List / create reports |
| `GET/PUT/DELETE /api/reports/:id` | Get / update / delete report |
| `GET/PUT /api/reports/:id/access` | Manage viewer access |
| `POST /api/reports/:id/export` | Generate PDF |
| `GET /api/comments` | Get comments for section+date |
| `POST /api/comments` | Post a comment |
| `DELETE /api/comments/:id` | Delete a comment |

### User Management (super_admin only, via `/users-admin.php` proxy)

| Endpoint | Description |
|----------|-------------|
| `GET /api/users` | List all users with sections |
| `POST /api/users` | Create user |
| `PUT /api/users/:id` | Update role/display_name/sections |
| `PUT /api/users/:id/password` | Update password |
| `DELETE /api/users/:id` | Delete user |
| `GET /api/viewers` | List viewer-role users |

---

## Dashboard Views

| Route | View | Who Can Access |
|-------|------|----------------|
| `#/overview` | Pageviews, sessions, top pages, event breakdown | super_admin, assigned analyst |
| `#/performance` | LCP/CLS/INP vitals, scatter, histogram | super_admin, assigned analyst |
| `#/errors` | Error trends, by type/page/element, server logs | super_admin, assigned analyst |
| `#/rawdata` | Filterable raw events table | super_admin, assigned analyst |
| `#/behavior` | Bounce rate, scroll depth, devices, sessions | super_admin, assigned analyst |
| `#/reports` | Saved reports + builder | super_admin, analyst (create), viewer (read) |
| `#/admin` | User management | super_admin only |

---

## Authentication & Authorization

### Login Flow

```
Browser → POST /login.php
       → password_verify() against bcrypt hash
       → session_regenerate_id() (prevents session fixation)
       → $_SESSION set: role, sections, user_id, display_name
       → Redirect to /dashboard.php
       → PHP injects SESSION_ROLE + SESSION_SECTIONS as JS globals
       → dashboard.js router enforces section access client-side
       → Node API enforces role + section via X-User-* headers
```

### Role System

| Role | Sections | Reports | Admin |
|------|----------|---------|-------|
| `super_admin` | All sections | Create, share, view all | Full access |
| `analyst` | Assigned only | Create within assigned sections | No access |
| `viewer` | None | View shared reports only | No access |

### Three-Layer Security

1. **PHP session** — `auth.php` blocks all unauthenticated requests
2. **Role check** — `admin-auth.php` enforces super_admin for user management proxy
3. **Node middleware** — `requireRole()` and `requireSection()` validate every API call via headers

---

## Reports & PDF Export

### Report Snapshot

When a report is saved, a complete frozen snapshot is stored in JSON including all metric values, chart data, takeaway text, and summary. Nothing is re-queried when a viewer opens the report — the data is always the exact state at save time.

### PDF Generation Flow

```
Browser → POST /api/reports/:id/export
       → Node creates short-lived token in export_tokens table
       → Puppeteer launches headless Chromium
       → Navigates to /export-preview.php?token=...
       → PHP validates token, renders full HTML with Chart.js
       → JavaScript draws all charts, sets window.status = 'ready'
       → Puppeteer waits for ready signal, generates A4 PDF
       → PDF saved to /exports/report-{id}-{timestamp}.pdf
       → URL returned to browser, opens in new tab
```

---

## Web Vitals Thresholds

| Metric | Good | Needs Work | Poor |
|--------|:----:|:----------:|:----:|
| LCP | < 2500ms | 2500–4000ms | > 4000ms |
| CLS | < 0.1 | 0.1–0.25 | > 0.25 |
| INP | < 200ms | 200–500ms | > 500ms |

---

## How to Use the Dashboard

### As a Super Admin

1. Log in at `https://reporting.jgamba.site`
2. Set the date range using the From/To pickers in the header
3. Navigate sections using the left sidebar
4. Go to ⚙ **Admin** to create users, assign analyst sections, update roles and passwords
5. Go to 📋 **Reports** → **+ Create Report** to build stakeholder briefings
6. Use the **↓ CSV** button on any chart panel to download raw data
7. Use the **Analyst Notes** panel at the bottom of any view to annotate observations

### As an Analyst

1. Log in — only your assigned sections appear in the sidebar
2. Use the date range filter to explore data over time
3. Add notes in the **Analyst Notes** panel tied to the current date range
4. Build reports from your assigned sections and share with viewers
5. Open any report and click **Export as PDF** for a shareable document

### As a Viewer

1. Log in — you land directly on the **Briefings** page
2. Only reports explicitly shared with you are visible
3. Each report shows a headline takeaway, plain-English summary, metric cards, and charts
4. Click **Export as PDF** to save or share the report

---

## Tips & Troubleshooting

### Dashboard shows no data

```bash
pm2 status
pm2 logs collector --lines 10
# Look for ECONNREFUSED — means MySQL connection failed
mysql -u collector -p'password' analytics -e "SELECT COUNT(*) FROM events;"
```

### Charts disappear when navigating between views

`destroyAllCharts()` is called at the start of every render function. If charts disappear, confirm the function is called at the top of the affected render function in `dashboard.js`.

### PDF export shows blank charts

The PDF renderer relies on the `key` property being stored in each chart object in the snapshot. This is set in `report-builder.js`. Delete old reports and create a fresh one if charts are blank. Also check:

```bash
pm2 logs reporting --lines 20
# Look for Puppeteer errors
```

### API returns 403 on PUT/DELETE

ModSecurity may be blocking the request:

```bash
sudo tail -20 /var/log/apache2/error.log | grep security2
```

Add the blocking rule ID to `SecRuleRemoveById` in the Apache vhost config.

### Apache logs not updating in error view

The log is synced via cron every 5 minutes. Force a manual sync:

```bash
sudo cp /var/log/apache2/access.log \
  /var/www/reporting.jgamba.site/app/apache-access.log
```

### Session not reflecting new role/sections after user edit

Users must **log out and log back in** after role or section changes. Sessions are built at login time and cached for the duration of the session.

### Collector ECONNREFUSED in pm2 logs

MySQL connection failing. The host must be `127.0.0.1` not `localhost` (IPv6 issue):

```bash
grep "host" /var/www/collector.jgamba.site/app/endpoint.js
# Should show: host: '127.0.0.1'
```

---

## Maintenance

```bash
# Backup database
mysqldump -u collector -p'password' analytics > backup-$(date +%Y%m%d).sql

# Clean up PDF exports older than 7 days
find /var/www/reporting.jgamba.site/public_html/exports \
  -name "*.pdf" -mtime +7 -delete

# Renew SSL certificate
sudo certbot renew --dry-run
sudo certbot renew
sudo systemctl reload apache2

# Restore pm2 processes after server reboot
pm2 resurrect
```
