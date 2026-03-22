# Changelog

All notable changes to **WhatsFlow** are documented here.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

> Changes on the `develop` branch not yet released.

---

## [1.0.1] — 2026-03-22

### Added
- **Webhook Configuration UI** — Settings → WhatsApp API tab now has an always-visible
  "Webhook Configuration" section containing: tunnel status card (Not Running / Connecting /
  Active), Start Tunnel / Stop Tunnel buttons with loading state, Refresh button, webhook URL
  display with one-click Copy button, and a 5-step Quick Setup Guide.
- **Runtime Tunnel API** — Two new endpoints `POST /api/settings/tunnel/start` and
  `POST /api/settings/tunnel/stop` allow starting and stopping LocalTunnel at runtime
  without restarting the app or using the command line.
- **`startTunnel` / `stopTunnel` API client methods** — Added to `frontend/src/services/api.ts`
  to support the Webhook Configuration UI.

### Fixed
- **Webhook rawBody validation** — Removed unreliable `JSON.stringify(req.body)` fallback;
  HMAC-SHA256 is now computed against the raw request buffer (`req.rawBody`) captured by the
  `express.json()` verify callback. Returns `400` if `rawBody` is unavailable.
- **`settings.js` safeSend guard** — Added double-response guard in async DB callbacks to
  prevent `Cannot set headers after they are sent` errors.
- **Auth.js single-use key guard removed** — The one-use key check was blocking Vite HMR
  (hot module reload) in development. Auth now enforces: localhost-only + 256-bit key +
  rotation on server restart.
- **Templates route 500 → 200** — `GET /api/campaigns/templates` now returns
  `200 + { data: [], status: 'unconfigured' }` when credentials are not yet configured,
  instead of a 500 error.
- **API client 403 retry loop** — Fixed infinite retry loop in `api.ts`; `apiKeyPromise` is
  now only reset for non-auth / non-token URLs, preventing indefinite retry cycles.
- **`BackendStatus` health check** — `BackendStatus` component now uses
  `apiService.checkHealth()` (which targets port 3000) instead of `fetch('/health')`, which
  resolved a silent failure when Vite dev server intercepted the request.
- **Charts mount guard** — Added container dimension guard to both `DeliveryTrendChart` and
  `StatusDistributionChart` to prevent the Recharts `-1 x -1` container size warning on
  initial mount.

### Chore
- **File cleanup** — Removed `dist/win-unpacked/` (325 MB), `coverage/`, stale build
  artifacts, rotated log files, and `database.test.sqlite` from the working tree.

---

## [1.0.1] — 2026-03-21

### Added
- **Git workflow** — `.github/` folder with CI workflow, release workflow, PR template,
  bug report & feature request issue templates.
- **Pre-commit hooks** — husky v9 + lint-staged: auto-lints staged frontend files before
  every commit.
- **Commit message linting** — `@commitlint/config-conventional` enforces Conventional
  Commits format via `commit-msg` hook.
- **CONTRIBUTING.md** — branch naming conventions, commit message guide, PR process,
  and local development setup instructions.
- **CHANGELOG.md** — this file; tracks all version history.
- **`.env.template`** — replaces `.env.example`; safe to commit, documents all env vars.

### Changed
- **All dependencies updated** to latest compatible versions:
  - `electron` 33 → **36.9.5** (latest Node 20–compatible version)
  - `sqlite3` 5 → **6.0.1**
  - `dotenv` 16 → **17.3.1**
  - `react` / `react-dom` 18 → **19.2.4**
  - `vite` 5 → **8.0.1** (requires Node `^20.19.0`)
  - `@vitejs/plugin-react` 4 → **6.0.1**
  - `socket.io` / `socket.io-client` → **4.8.x**
  - `lucide-react` → **0.577.0**
  - `react-router-dom` 6 → **7.13.1**
  - `recharts` 2 → **3.8.0**
  - All other packages updated to latest patch/minor versions.
- **`.gitignore`** — comprehensively expanded; excludes `.env.*`, `*.sqlite`, `*.db`,
  `*.pem`/`*.key`, `dist/`, `coverage/`, IDE folders, OS artefacts, and more.
- **App version** bumped `1.0.0` → **1.0.1** in `package.json`.
- **Author field** added to root `package.json`: `Udhaya Chandra SA`.
- **Code quality** — author headers, JSDoc, and inline comments added to every source
  file (backend, frontend, electron).
- **ThemeContext** — all debug `console.log` calls removed.
- **Layout** — `BackendStatus` now polls `/health` (unauthenticated) instead of
  `/api/settings/config`; removed `console.log` from theme toggle.
- **Blacklist** — replaced native `alert()` calls with `useToast()` for consistent UX.
- **Dashboard** `StatusBadge` — added `active` and `paused` colour styles.
- **Charts** (DeliveryTrendChart, StatusDistributionChart) — colours now adapt to
  dark / light mode using `useTheme()`.

### Fixed
- **"Cannot GET /"** error in packaged exe — static file serving corrected for
  `NODE_ENV=production` builds.
- **EADDRINUSE** crash on port 3000 — graceful error handler added to `server.listen()`.

---

## [1.0.0] — 2026-02-01

### Added
- Initial release of **WhatsFlow** — WhatsApp Bulk Sender desktop application.
- Electron 33 + Express 4 + React 18 + Vite 5 + SQLite 5 foundation.
- Campaign management: create, schedule, pause, and resume bulk WhatsApp campaigns.
- Contact management: CSV upload, manual add, blacklist support.
- WhatsApp Cloud API integration with media upload support.
- Real-time progress updates via Socket.IO.
- Dark / light mode with system-preference detection.
- Secure settings storage with AES-256-GCM encryption.
- Local tunnel support for webhook testing.
- Email fallback notifications via Nodemailer.
- Winston structured logging.
- Node-cron campaign scheduler.
- Comprehensive REST API with Helmet, CORS, rate-limiting.
- Jest unit tests and Playwright e2e test scaffolding.

---

[Unreleased]: https://github.com/UdhayaChandraSA/whatsflow/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/UdhayaChandraSA/whatsflow/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/UdhayaChandraSA/whatsflow/releases/tag/v1.0.0
