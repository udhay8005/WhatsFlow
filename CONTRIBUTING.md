# Contributing to WhatsFlow

Thank you for investing your time in improving WhatsFlow!
This guide covers everything you need to contribute effectively.

---

## Table of Contents

1. [Development Setup](#1-development-setup)
2. [Branch Strategy](#2-branch-strategy)
3. [Commit Message Convention](#3-commit-message-convention)
4. [Pull Request Process](#4-pull-request-process)
5. [Code Style Standards](#5-code-style-standards)
6. [Testing](#6-testing)
7. [Releasing](#7-releasing)

---

## 1. Development Setup

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | `^20.19.0` |
| npm | `^10` |
| Git | `^2.40` |

### Clone & Install

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/whatsflow.git
cd whatsflow

# 2. Install root dependencies (Electron + backend)
npm install

# 3. Install frontend dependencies
cd frontend && npm install && cd ..

# 4. Copy the environment template
cp .env.template .env
#    → Fill in your WhatsApp credentials in .env

# 5. Start in development mode (hot-reload)
npm run dev
```

### Environment Variables

All required variables are documented in `.env.template`.
**Never commit your `.env` file.** It is excluded by `.gitignore`.

---

## 2. Branch Strategy

WhatsFlow uses a simplified **GitHub Flow** branching model.

```
main  ←── stable releases only (tagged vX.Y.Z)
  └── develop  ←── integration branch
        ├── feature/add-contact-pagination
        ├── fix/campaign-stuck-processing
        ├── chore/update-dependencies
        └── release/1.1.0
```

### Branch Naming

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New feature or enhancement | `feature/template-variables` |
| `fix/` | Bug fix | `fix/eaddrinuse-crash` |
| `chore/` | Tooling, deps, config (no production change) | `chore/update-electron-36` |
| `docs/` | Documentation only | `docs/api-reference-update` |
| `refactor/` | Code restructure (no behaviour change) | `refactor/extract-crypto-service` |
| `perf/` | Performance improvement | `perf/batch-db-writes` |
| `test/` | Tests only | `test/add-worker-unit-tests` |
| `release/` | Release preparation | `release/1.1.0` |
| `hotfix/` | Critical fix directly against `main` | `hotfix/security-xss-patch` |

### Rules

- **Never commit directly to `main`** — always use a PR.
- Branch from `develop` for regular work; branch from `main` for hotfixes.
- Delete your branch after it is merged.

---

## 3. Commit Message Convention

WhatsFlow uses **[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**.
The `commit-msg` hook enforces this automatically.

### Format

```
<type>(<optional-scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | A new feature visible to end users |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Code formatting (no logic change) |
| `refactor` | Code restructure (no feature/bug change) |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or external dependencies |
| `ci` | CI/CD configuration |
| `chore` | Other maintenance tasks |
| `revert` | Reverts a previous commit |

### Scopes (optional)

Use the area of the app: `campaigns`, `contacts`, `blacklist`, `settings`,
`worker`, `scheduler`, `electron`, `charts`, `auth`, `api`, `db`, `docs`.

### Examples

```bash
# ✅ Good
feat(campaigns): add message template variable substitution
fix(worker): handle ECONNRESET during media upload
chore: upgrade electron to 36.9.5
docs: update API_REFERENCE with new /health endpoint
perf(db): batch INSERT contacts instead of per-row writes

# ❌ Bad — vague, wrong case, no type
Updated stuff
fix Bug
WIP
```

### Breaking Changes

Append `!` after the type and add a `BREAKING CHANGE:` footer:

```
feat(api)!: require Authorization header on all /api routes

BREAKING CHANGE: unauthenticated requests to /api/* now return 401.
Update your .env with API_KEY before upgrading.
```

---

## 4. Pull Request Process

1. **Create a branch** from `develop` (or `main` for hotfixes).
2. **Make your changes** following the code style below.
3. **Write / update tests** — new features need unit tests.
4. **Run the full suite locally** before pushing:
   ```bash
   npm run test:unit          # backend unit tests
   npm run build:frontend     # ensure frontend builds
   ```
5. **Push and open a PR** against `develop`.
6. **Fill in the PR template** — description, screenshots, test plan, checklist.
7. **Wait for CI** — all checks must be green before merging.
8. **Request a review** — at least 1 approval is required.
9. **Squash-merge** into `develop` (keep history clean).

---

## 5. Code Style Standards

Every source file **must** follow these standards:

### File Header (all `.js`, `.jsx`, `.ts`, `.tsx` files)

```js
/**
 * @file filename.js
 * @description One-line description of the module's purpose.
 * @module path/to/module
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */
```

### Function Documentation

```js
/**
 * @function sendMessage
 * @description Sends a WhatsApp message via the Cloud API.
 * @param {string} to - Recipient phone number in E.164 format.
 * @param {string} body - Message text content.
 * @returns {Promise<object>} WhatsApp API response payload.
 * @throws {Error} If the API returns a non-2xx status.
 */
```

### General Rules

- **No `console.log`** in production code — use `logger.info()` / `logger.error()`.
- **No `alert()`** in frontend — use the `useToast()` hook.
- **No hardcoded credentials** — read from `process.env` / encrypted settings.
- Modular: one concern per file.
- Maximum function length: ~50 lines. Extract helpers where needed.
- Use `async/await` — no raw `.then()` callback chains.

---

## 6. Testing

```bash
# Backend unit tests (Jest)
npm run test:unit

# Full test suite with coverage
npm test

# Frontend component tests (Vitest)
cd frontend && npm test

# Watch mode
npm run test:watchAll
```

### Writing Tests

- Unit tests live in `backend/__tests__/`.
- Frontend tests live next to the component (`Component.test.jsx`).
- Use `supertest` to test Express routes.
- Mock external services (WhatsApp API, email) — never hit real APIs in tests.

---

## 7. Releasing

Releases are created by maintainers only.

```bash
# 1. Update CHANGELOG.md — move [Unreleased] items to a new version section
# 2. Bump the version in package.json
# 3. Commit with:
git commit -m "chore(release): bump version to 1.1.0"

# 4. Tag the release
git tag -a v1.1.0 -m "Release v1.1.0"

# 5. Push tag — GitHub Actions will build and publish the release automatically
git push origin v1.1.0
```

The **Release** GitHub Actions workflow (`.github/workflows/release.yml`) picks up
the tag, builds the Windows exe, and creates a GitHub Release with the artifacts.

---

*Questions? Open a [Discussion](https://github.com/UdhayaChandraSA/whatsflow/discussions).*
