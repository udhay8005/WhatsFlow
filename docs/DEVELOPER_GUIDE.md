# WhatsFlow - Developer Guide

**Version:** 1.0.1
**Author:** Udhaya Chandra SA
**Last Updated:** March 2026
**Target Audience:** Developers contributing to or maintaining WhatsFlow

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Code Standards](#code-standards)
5. [Testing Guide](#testing-guide)
6. [Debugging](#debugging)
7. [Common Development Tasks](#common-development-tasks)
8. [Build and Distribution](#build-and-distribution)
9. [Troubleshooting](#troubleshooting)

---

## 1. Development Environment Setup

### Prerequisites
- **Node.js:** 18.x or higher
- **npm:** 9.x or higher
- **Windows:** 10/11 (primary platform)
- **Git:** For version control

### Initial Setup

```powershell
# 1. Clone repository
git clone https://github.com/your-repo/whatsflow.git
cd whatsflow

# 2. Install root dependencies
npm install

# 3. Install frontend dependencies
cd frontend
npm install
cd ..

# 4. Verify installation
npm run test
```

### Environment Variables

Create `.env` file in root (optional, for development):
```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

### IDE Setup (VS Code Recommended)

**Recommended Extensions:**
- ESLint
- Prettier
- SQLite Viewer
- Thunder Client (API testing)

**Settings (`.vscode/settings.json`):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## 2. Project Structure

```
whatsflow/
├── backend/                    # Express.js Backend
│   ├── __tests__/             # Backend unit tests
│   │   ├── integration/       # Integration tests
│   │   ├── services/          # Service tests
│   │   ├── campaigns.test.js
│   │   ├── webhook.test.js
│   │   ├── stats.test.js
│   │   ├── media.test.js
│   │   └── errorHandler.test.js
│   ├── middleware/            # Express middleware
│   │   ├── auth.js           # API key authentication
│   │   ├── errorHandler.js   # Global error handler
│   │   └── validators.js     # Input validation rules
│   ├── routes/                # API endpoints
│   │   ├── campaigns.js
│   │   ├── contacts.js
│   │   ├── media.js
│   │   ├── settings.js
│   │   ├── stats.js
│   │   └── webhook.js
│   ├── services/              # Business logic
│   │   ├── cryptoService.js  # AES-256 encryption/decryption
│   │   ├── emailService.js   # SMTP email fallback
│   │   └── whatsappService.js # WhatsApp Business API
│   ├── utils/                 # Utilities
│   │   └── logger.js         # Winston logger
│   ├── cron.js                # Scheduled tasks
│   ├── database.js            # SQLite setup & schema
│   ├── server.js              # Express + Socket.IO app
│   ├── tunnelManager.js       # LocalTunnel management
│   └── worker.js              # Message queue processor
│
├── frontend/                   # React 19 Frontend
│   ├── src/
│   │   ├── assets/            # Static assets
│   │   ├── components/        # Reusable components
│   │   │   ├── Layout.jsx    # App shell (sidebar, header, backend status)
│   │   │   ├── AppWrapper.jsx
│   │   │   ├── Toast.tsx     # Toast notification system
│   │   │   └── campaign/     # Campaign wizard steps
│   │   │       ├── CampaignDetailsStep.jsx
│   │   │       ├── ContactUploadStep.jsx
│   │   │       └── CampaignReviewStep.jsx
│   │   ├── charts/            # Recharts components (dark-mode aware)
│   │   │   ├── DeliveryTrendChart.jsx
│   │   │   └── StatusDistributionChart.jsx
│   │   ├── contexts/          # React Context API
│   │   │   ├── ThemeContext.jsx  # Dark/light mode (no debug logs)
│   │   │   └── SocketContext.jsx # Socket.IO singleton
│   │   ├── pages/             # Route components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── NewCampaign.jsx
│   │   │   ├── History.jsx
│   │   │   ├── Blacklist.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/          # API client
│   │   │   └── api.ts        # Axios with X-API-Key interceptor
│   │   └── utils/             # Frontend utilities
│   │       ├── contactProcessor.ts
│   │       └── excelParser.ts
│   ├── public/
│   │   └── logo.png          # App icon (also copied to dist/)
│   └── vite.config.js         # Bundler + dev proxy (/api, /health, /auth, /webhook)
│
├── electron/                   # Electron Main Process
│   ├── main.js                # Entry: sets NODE_ENV, starts backend, creates window
│   └── preload.js             # Context bridge
│
├── docs/                       # Documentation
├── tests/                      # E2E Tests (Playwright)
│   └── e2e/
│       └── campaign_flow.spec.js
│
├── .env.template               # Environment variable template
├── jest.config.js              # Jest configuration
├── package.json                # Root dependencies + electron-builder config
└── README.md
```

---

## 3. Development Workflow

### Starting Development Environment

```powershell
# Method 1: All-in-one (recommended)
npm run dev
# Runs concurrently: backend (3000) + Vite dev server (5173) + Electron

# Method 2: Separate terminals
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend (with Vite proxy to backend)
npm run frontend

# Terminal 3: Electron (loads localhost:5173)
npm start
```

### Hot Module Replacement (HMR)
- **Frontend:** Vite provides instant HMR (changes reflect immediately)
- **Backend:** No HMR - restart `npm run server` after changes
- **Electron:** Restart `npm start` after changes to `electron/`

### Making Changes

#### Backend Changes
1. Edit files in `backend/`
2. Restart server: `Ctrl+C` → `npm run server`
3. Test via Thunder Client or frontend

#### Frontend Changes
1. Edit files in `frontend/src/`
2. Changes auto-reload in browser (HMR)
3. Check browser console for errors

#### Database Changes
1. Modify schema in `backend/database.js`
2. Delete `database.sqlite` (will be recreated)
3. Restart backend

---

## 4. Code Standards

### JavaScript Style Guide

**General Rules:**
- Use ES6+ features (`const`, `let`, arrow functions, async/await)
- No `var` declarations
- Use semicolons
- 4-space indentation
- Single quotes for strings
- **No `window.confirm()` or `window.alert()`** in frontend — use the `useToast()` hook for
  notifications and an inline React modal overlay for destructive confirmations. Native browser
  dialogs block the React update cycle. See `Blacklist.jsx` for the reference pattern
  (`confirmDelete` state + Tailwind overlay with Cancel / Confirm buttons).

**Naming Conventions:**
```javascript
// Variables & Functions: camelCase
const userName = 'John'
function getUserData() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3

// Classes: PascalCase
class CampaignService {}

// Files: camelCase.js or PascalCase.jsx (React components)
// excelParser.js, Dashboard.jsx
```

**Error Handling:**
```javascript
// ✅ Always use try-catch for async operations
try {
    const result = await service.doSomething()
} catch (error) {
    logger.error('Operation failed:', error)
    // Handle error appropriately
}

// ✅ Use custom AppError for business logic errors
throw new AppError('Invalid input', 400, 'VALIDATION_ERROR')
```

**Database Queries:**
```javascript
// ✅ Always use parameterized queries
db.run('UPDATE campaigns SET status = ? WHERE id = ?', [status, id])

// ❌ Never concatenate user input
db.run(`UPDATE campaigns SET status = '${status}'`) // SQL INJECTION!
```

### React Best Practices

**Component Structure:**
```jsx
// 1. Imports
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 2. Component definition
export default function MyComponent({ prop1, prop2 }) {
    // 3. Hooks
    const [state, setState] = useState('')
    const navigate = useNavigate()
    
    // 4. Effects
    useEffect(() => {
        // Side effects
    }, [])
    
    // 5. Handlers
    const handleClick = () => {
        // Logic
    }
    
    // 6. Render
    return (
        <div>...</div>
    )
}
```

**State Management:**
- Use `useState` for component state
- Use `useContext` for global state (Theme, Toast)
- Avoid prop drilling (use Context)

---

## 5. Testing Guide

### Running Tests

```powershell
# Run all tests with coverage
npm run test

# Run tests in watch mode
npm run test:watchAll

# Run specific test file
npx jest backend/__tests__/webhook.test.js

# Run backend tests only
npm run test:unit

# Run E2E tests (requires dev server running)
npx playwright test
```

### Writing Unit Tests

**Structure:**
```javascript
describe('Feature Name', () => {
    beforeAll(() => {
        // Setup once before all tests
    })
    
    afterEach(() => {
        // Cleanup after each test
        jest.clearAllMocks()
    })
    
    describe('Specific Behavior', () => {
        it('should do something specific', () => {
            // Arrange
            const input = { ... }
            
            // Act
            const result = myFunction(input)
            
            // Assert
            expect(result).toBe(expected)
        })
    })
})
```

**Mocking Dependencies:**
```javascript
// Mock database
jest.mock('../database', () => ({
    get: jest.fn(),
    run: jest.fn(),
}))

// Use mock
const db = require('../database')
db.get.mockImplementation((sql, params, cb) => {
    cb(null, { id: 1, name: 'Test' })
})
```

> **Note:** If your route under test uses `db.dbWriter` (i.e. `routes/campaigns.js` or `routes/drafts.js`), you must also attach `dbWriter` to the mock:
> ```javascript
> jest.mock('../database', () => {
>     const mockDb = {
>         get: jest.fn(),
>         run: jest.fn((sql, params, cb) => { if (cb) cb(null); }),
>         all: jest.fn(),
>     };
>     mockDb.dbWriter = {
>         get: jest.fn(),
>         run: jest.fn((sql, params, cb) => { if (cb) cb(null); }),
>         all: jest.fn(),
>     };
>     return mockDb;
> });
> ```
> For `worker.test.js`, call `worker.stopWorker()` in `beforeEach` to reset the `isRunning` flag, and mock the startup `db.run("UPDATE messages SET status='queued'...")` call at the start of each test.

### Test Coverage Goals
- **Target:** 70%+ overall
- **Critical paths:** 90%+ (auth, payment, security)
- **Current:** 70.3% ✅ — Backend: 13 suites, 60 tests. Frontend: 3 suites, 26 tests.

---

## 6. Debugging

### Backend Debugging

**Method 1: VS Code Debugger**

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/backend/server.js",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

**Method 2: Console Logging**
```javascript
const logger = require('./utils/logger')

logger.debug('Variable value:', myVar)
logger.info('Process started')
logger.warn('Potential issue')
logger.error('Critical error', error)
```

**Method 3: Node Inspector**
```powershell
node --inspect backend/server.js
# Open chrome://inspect in Chrome
```

### Frontend Debugging

**Method 1: React DevTools**
- Install Chrome extension
- Inspect component state/props

**Method 2: Browser Console**
```javascript
console.log('[MyComponent] State:', state)
```

**Method 3: Vite Debug Mode**
```powershell
DEBUG=vite:* npm run frontend
```

### Database Debugging

**View Database:**
```powershell
# Install SQLite CLI
# https://www.sqlite.org/download.html

sqlite3 database.sqlite
.tables
SELECT * FROM campaigns;
.schema messages
.exit
```

**VS Code Extension:**
- Install "SQLite Viewer"
- Right-click `database.sqlite` → Open with SQLite Viewer

---

## 7. Common Development Tasks

### Adding a New API Endpoint

1. **Create route handler** (`backend/routes/myroute.js`):
```javascript
const express = require('express')
const router = express.Router()

router.get('/my-endpoint', (req, res) => {
    res.json({ message: 'Success' })
})

module.exports = router
```

2. **Register route** (`backend/server.js`):
```javascript
app.use('/api/myroute', require('./routes/myroute'))
```

3. **Add validation** (if needed):
```javascript
const { body, validationResult } = require('express-validator')

router.post('/my-endpoint',
    body('field').notEmpty(),
    (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        // Process
    }
)
```

4. **Write tests** (`backend/__tests__/myroute.test.js`):
```javascript
const request = require('supertest')
const app = require('../server').app

describe('My Route', () => {
    it('should return success', async () => {
        const response = await request(app)
            .get('/api/myroute/my-endpoint')
            .expect(200)
        
        expect(response.body.message).toBe('Success')
    })
})
```

### Adding a New React Page

1. **Create component** (`frontend/src/pages/MyPage.jsx`):
```jsx
import React from 'react'

export default function MyPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">My Page</h1>
        </div>
    )
}
```

2. **Add route** (`frontend/src/App.jsx`):
```jsx
import MyPage from './pages/MyPage'

<Routes>
    <Route path="/my-page" element={<MyPage />} />
</Routes>
```

3. **Add navigation** (`frontend/src/components/Layout.jsx`):
```jsx
<NavItem to="/my-page" icon={<IconName />} label="My Page" />
```

### Modifying Database Schema

1. **Update schema** (`backend/database.js`):
```javascript
db.run(`CREATE TABLE IF NOT EXISTS my_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
)`)
```

2. **Delete old database:**
```powershell
# Development: database is at project root
Remove-Item database.sqlite

# In packaged app: database is in user data directory
# e.g. C:\Users\<name>\AppData\Roaming\WhatsFlow\database.sqlite
```

3. **Restart backend** - new schema will be created

---

## 8. Build and Distribution

### Frontend Production Build

```powershell
# Build optimized frontend
npm run build:frontend

# Output: frontend/dist/
```

### Electron Build

```powershell
# Build frontend + package Electron (single command)
npm run build

# Output in dist/:
#   WhatsFlow 1.0.1.exe           (portable)
#   WhatsFlow Setup 1.0.1.exe     (installer with desktop shortcut)
```

**Build Configuration** (`package.json`):
```json
{
  "build": {
    "appId": "com.whatsflow.app",
    "productName": "WhatsFlow",
    "asar": false,
    "files": [
      "electron/**/*",
      "backend/**/*",
      "frontend/dist/**/*",
      "package.json"
    ],
    "win": {
      "target": ["portable", "nsis"],
      "icon": "frontend/public/logo.png"
    }
  }
}
```

---

## 9. Troubleshooting

### Common Issues

#### Issue: "Module not found" error
**Solution:**
```powershell
rm -rf node_modules package-lock.json
npm install
```

#### Issue: Port 3000 already in use

Port 3000 is already in use when starting packaged app → error is logged and the process exits cleanly (`process.exit(1)`). Close other instances of WhatsFlow, then relaunch.

#### Issue: Database locked error
**Solution:**
Stop all running processes accessing the database, then:
```powershell
rm database.sqlite-wal database.sqlite-shm
```

#### Issue: Frontend not loading in Electron
**Solution:**
1. Check if frontend is built: `ls frontend/dist`
2. Rebuild: `npm run build:frontend`
3. Check Electron console (View → Toggle Developer Tools)

#### Issue: Tests failing with "open handles"
**Solution:**
Close database connections properly:
```javascript
afterAll(() => {
    db.close()
})
```

---

## Tips for Contributors

1. **Always write tests** for new features
2. **Update documentation** when changing APIs
3. **Use descriptive commit messages:** "feat: Add media upload", "fix: SQL injection in campaigns"
4. **Check test coverage** before committing: `npm run test`
5. **Run linter:** `npm run lint` (if configured)

---

**For deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)**  
**For architecture details, see [ARCHITECTURE.md](./ARCHITECTURE.md)**
