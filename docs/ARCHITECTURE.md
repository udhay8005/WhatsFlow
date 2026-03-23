# WhatsFlow - Technical Architecture Documentation

**Version:** 1.0.1
**Last Updated:** March 2026
**Author:** Udhaya Chandra SA

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Design](#architecture-design)
3. [Technology Stack](#technology-stack)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Security Architecture](#security-architecture)
7. [Database Schema](#database-schema)
8. [API Design](#api-design)
9. [Message Queue System](#message-queue-system)
10. [Real-time Communication](#real-time-communication)

---

## 1. System Overview

### Purpose
WhatsFlow is a desktop application for sending bulk WhatsApp messages via the WhatsApp Business API. It runs locally on Windows as an Electron application with an embedded Express.js backend.

### Key Features
- **Bulk Messaging:** Send messages to multiple contacts using approved templates
- **Contact Management:** Import contacts via Excel/CSV with standardised 5-column format
  (`phone`, `email`, `name`, `amount`, `date`)
- **Campaign Tracking:** Real-time progress monitoring
- **Template Support:** Dynamic parameter substitution — consistent variable convention:
  `{{1}}`=name, `{{2}}`=amount (or auto-built donation table for Multiple templates), `{{3}}`=date
- **Duplicate Handling Modes:** `Separate Messages` (keep), `Combine List` (list), `Sum Total` (sum)
  — controlled by `contactProcessor.ts` before campaign creation
- **Media Uploads:** Support for images and videos
- **Email Fallback:** Automatic email notifications on failures
- **Webhook Integration:** Receive delivery status updates
- **Runtime Tunnel Management:** Start/stop LocalTunnel directly from the Settings UI
- **Offline-First:** Works without constant internet (except for sending)

### Architecture Type
**Monolithic Desktop Application** with:
- Electron (Desktop Shell)
- Express.js (Backend API)
- React (Frontend UI)
- SQLite (Embedded Database)

---

## 2. Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Electron Main Process                       │
│  ┌────────────────────────────────────────────────┐    │
│  │         Express.js Backend Server              │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │         HTTP Server (Port 3000)          │ │    │
│  │  │  - REST API Routes                       │ │    │
│  │  │  - Webhook Endpoint                      │ │    │
│  │  │  - Static File Serving                   │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │         Socket.IO Server                 │ │    │
│  │  │  - Real-time Event Broadcasting          │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │         Message Queue Worker             │ │    │
│  │  │  - Background Processing                 │ │    │
│  │  │  - Rate Limiting (1-100 TPS)             │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │         SQLite Database                  │ │    │
│  │  │  - Campaigns, Messages, Config           │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Electron Renderer Process              │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │         React Application (UI)           │ │    │
│  │  │  - Dashboard, Campaigns, History         │ │    │
│  │  │  - Blacklist, Settings                   │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │         Socket.IO Client                 │ │    │
│  │  │  - Listen for real-time updates          │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
        External Services (Internet)
        ┌────────────────────────────┐
        │  WhatsApp Business API     │
        │  - Send Messages           │
        │  - Upload Media            │
        │  - Get Templates           │
        └────────────────────────────┘
        ┌────────────────────────────┐
        │  Meta Webhooks             │
        │  - Delivery Status         │
        │  - Read Receipts           │
        └────────────────────────────┘
        ┌────────────────────────────┐
        │  LocalTunnel Relay         │
        │  - Public HTTPS URL        │
        │  - Started at runtime      │
        └────────────────────────────┘
        ┌────────────────────────────┐
        │  SMTP Server (Optional)    │
        │  - Email Fallback          │
        └────────────────────────────┘
```

### Process Architecture

#### Development Mode
```
Terminal 1: npm run server      → Express.js (Port 3000)
Terminal 2: npm run frontend    → Vite Dev Server (Port 5173)
Terminal 3: electron .          → Electron loads localhost:5173
```

#### Production Mode
```
Built Executable: WhatsFlow Setup 1.0.1.exe
  └─ Electron Main Process
      ├─ Sets NODE_ENV=production
      ├─ Requires backend/server.js (embedded)
      ├─ Serves frontend/dist via Express static
      └─ SPA catch-all route for React Router

Development: npm run start:prod
  └─ Same as above but from source
```

---

## 3. Technology Stack

### Frontend Layer
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.x | UI framework with dark-mode aware charts via useTheme() |
| **React Router** | 7.x | Client-side routing (SPA navigation) |
| **Vite** | 8.x | Build tool and dev server (HMR) |
| **Tailwind CSS** | 4.x | Utility-first styling framework |
| **Axios** | latest | HTTP client for API requests |
| **Socket.IO Client** | 4.8.x | WebSocket client for real-time updates |
| **Recharts** | 3.x | Charting library for analytics |
| **read-excel-file** | latest | Excel file parsing for contact import |
| **Lucide React** | latest | Icon library |

### Backend Layer
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | JavaScript runtime (required) |
| **Express.js** | 4.x | Web framework and API server |
| **Socket.IO** | 4.8.x | WebSocket server for real-time events |
| **SQLite3** | 6.0.1 | Embedded relational database |
| **Helmet** | 8.x | Security headers middleware |
| **CORS** | 2.x | Cross-origin resource sharing |
| **Compression** | 1.x | Response compression (gzip) |
| **Winston** | 3.x | Logging framework |
| **Nodemailer** | 6.x | Email client for fallback notifications |
| **Multer** | 2.x | Multipart/form-data file upload handler |
| **Express Validator** | 7.x | Input validation and sanitization |
| **Express Rate Limit** | 8.x | API rate limiting middleware |
| **Node Cron** | 4.x | Scheduled task manager |
| **LocalTunnel** | latest | Runtime HTTPS tunnel for webhook testing |

### Desktop Layer
| Technology | Version | Purpose |
|------------|---------|---------|
| **Electron** | 36.9.5 | Desktop application wrapper (Chromium + Node.js) |
| **Electron Builder** | 26.x | Build and package for distribution |

### Testing & Development
| Technology | Version | Purpose |
|------------|---------|---------|
| **Jest** | 30.x | Unit and integration testing framework |
| **Supertest** | 7.x | HTTP endpoint testing |
| **Playwright** | 1.x | End-to-end UI testing |
| **Vitest** | 4.x | Frontend unit testing (Vite-native) |
| **Concurrently** | 9.x | Run multiple npm scripts in parallel |

**Test counts (current):** Backend — 13 suites, 60 tests passing. Frontend — 3 suites, 26 tests passing.

---

## 4. Component Details

### Backend Components

#### 4.1 Server (`backend/server.js`)
**Responsibilities:**
- Initialize Express application
- Configure middleware (CORS, Helmet, Compression, Rate Limiting)
- Register API routes
- Create HTTP and Socket.IO servers
- Start message queue worker
- Schedule cron jobs
- Serve frontend in production
- EADDRINUSE error handling (logs error + `process.exit(1)` — prevents ghost instances)
- SPA catch-all route (React Router support for all paths)
- Publishes `process.env.WHATSFLOW_UPLOADS_DIR` so media.js and settings.js share a single canonical uploads path

**Key Middleware:**
```javascript
// Security
app.use(helmet())              // Set security headers
app.use(cors({ origin: false })) // Disable CORS (Electron only)

// Performance
app.use(compression())         // Gzip responses

// Body Parsing — rawBody captured for HMAC validation
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => { req.rawBody = buf }
}))
app.use(express.urlencoded({ extended: true }))

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100                    // 100 requests per window
})
app.use('/api/', apiLimiter)
```

#### 4.2 Database (`backend/database.js`)
**Technology:** SQLite with WAL (Write-Ahead Logging) mode

**Dual-connection architecture:**
- `db` — shared reader connection used by worker, stats, settings, and contacts routes.
- `dbWriter` — dedicated writer connection used exclusively by `routes/campaigns.js` for `BEGIN/COMMIT/ROLLBACK` transactions. Exported as `module.exports.dbWriter`. Prevents cross-request transaction bleeding where unrelated writes from the worker are absorbed into an open campaign transaction and rolled back with it.

**Configuration:**
- **Location (development):** `database.test.sqlite` (tests) or `<project-root>/database.sqlite` (local dev)
- **Location (packaged app):** `app.getPath('userData')` — e.g. `C:\Users\<name>\AppData\Roaming\WhatsFlow\database.sqlite`. Avoids `EPERM` in read-only install directories.
- **Mode:** WAL — multiple concurrent readers, one writer
- **PRAGMAs (both connections):** `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000` (waits up to 5 s for write locks instead of throwing `SQLITE_BUSY` immediately)

**Schema:**
- `app_config` — Application settings (sensitive values encrypted with AES-256-GCM)
- `campaigns` — Campaign metadata
- `messages` — Individual message records with status lifecycle
- `contacts` — Phone/email registry with `UNIQUE(phone_number)` constraint
- `blacklist` — Blocked phone numbers

#### 4.3 Routes

##### `/webhook` - Webhook Handler
- **GET:** Verification endpoint for Meta
- **POST:** Receive delivery status updates
- **Security:** HMAC-SHA256 signature validation against raw request body buffer

##### `/api/settings` - Configuration
- **GET `/config`:** Retrieve app configuration
- **POST `/config`:** Save WhatsApp/SMTP credentials
- **GET `/tunnel`:** Get current tunnel status and URL
- **POST `/tunnel/start`:** Start LocalTunnel at runtime (no server restart required)
- **POST `/tunnel/stop`:** Stop the active LocalTunnel connection

##### `/api/campaigns` - Campaign Management
- **GET `/`:** List all campaigns
- **GET `/templates`:** Fetch WhatsApp templates (returns `200 + { data: [], status: 'unconfigured' }` when credentials are absent)
- **POST `/`:** Create new campaign — wrapped in `withWriteLock` mutex and `dbWriter` transaction to prevent concurrent campaign creation conflicts
- **PATCH `/:id/status`:** Toggle campaign active/paused
- **PUT `/:id`:** Update existing campaign — uses `ON CONFLICT(phone_number) DO UPDATE SET email` to upsert contacts (preserving updated emails)

##### `/api/media` - Media Uploads
- **POST `/upload`:** Upload image/video to WhatsApp

##### `/api/stats` - Analytics
- **GET `/dashboard`:** Aggregate statistics
- **GET `/trend`:** 7-day sending trend
- **GET `/status-distribution`:** Message status breakdown

#### 4.4 Services

##### `whatsappService.js`
**Methods:**
- `getTemplates()` - Fetch approved templates from WABA
- `sendMessage(phone, templateName, params, mediaId)` - Send templated message
- `uploadMedia(filePath, mimeType)` - Upload media to WhatsApp CDN

**API Integration:**
```
Base URL: https://graph.facebook.com/v18.0
Authentication: Bearer {access_token}
```

##### `emailService.js`
**Purpose:** Fallback notification when WhatsApp fails

**Configuration:**
- SMTP Host, Port, User, Password (from database)
- Sends HTML email with campaign details

##### `cryptoService.js`
**Purpose:** Encrypt/decrypt sensitive config (tokens, passwords)

**Algorithm:** AES-256-GCM (authenticated encryption — detects tampering)
**Key management:**
- Primary: Electron `safeStorage` (OS-level credential store, used when available)
- Fallback: AES-256-GCM with a per-installation 32-byte random key stored as `encryption.key` in the user data directory. Key file creation is atomic (write to `.tmp` + `fs.renameSync`). Corrupted keys (wrong byte length) are auto-detected, deleted, and regenerated.
- Legacy: `DEV_ENC:` Base64 prefix (read-only — values are decrypted and re-encrypted on next save)
**Format:** `AES_ENC:<iv_hex>:<authTag_hex>:<ciphertext_b64>`

#### 4.5 Worker (`backend/worker.js`)
**Purpose:** Background message queue processor

**Flow:**
1. Poll database for `queued` messages
2. Check rate limit (TPS from config)
2a. Check blacklist (fail-closed — a database error backs off rather than assuming safe)
3. Send via `whatsappService.sendMessage()`
4. Update status: `processing` → `sent` or `failed`
4a. Network calls wrapped with `withTimeout(30 000 ms)` — prevents hung API connections from stalling the worker indefinitely
5. On failure: Attempt email fallback
6. Repeat every 1 second

**Concurrency:** Single-threaded sequential processing; campaign creation transactions serialised by `withWriteLock` Promise-chain mutex on `dbWriter`
**Rate Limiting:** Configurable 1-100 TPS

#### 4.6 Cron (`backend/cron.js`)
**Scheduled Tasks:**
- Campaign status monitoring (every hour)
- Cleanup old logs (daily at midnight)
- Health checks (every 5 minutes)

---

## 5. Data Flow

### Campaign Creation Flow

```
User (Frontend)
    │
    ├─ 1. Upload Excel file
    │     ↓
    ├─ 2. Parse contacts (read-excel-file library)
    │     ↓
    ├─ 3. Select template
    │     ↓
    ├─ 4. Map parameters to columns
    │     ↓
    └─ 5. POST /api/campaigns
          ↓
    Backend (server.js)
          │
          ├─ 6. Validate input (express-validator)
          │     ↓
          ├─ 7. Start DB transaction
          │     ↓
          ├─ 8. INSERT INTO campaigns (...)
          │     ↓
          ├─ 9. Batch INSERT INTO messages (Promise.all)
          │     ↓
          ├─ 10. COMMIT transaction
          │     ↓
          └─ 11. Emit Socket.IO event 'campaign_created'
                ↓
    Worker (worker.js)
          │
          ├─ 12. Poll: SELECT * FROM messages WHERE status = 'queued'
          │     ↓
          ├─ 13. Check rate limit
          │     ↓
          ├─ 14. whatsappService.sendMessage()
          │     ↓
          ├─ 15. UPDATE messages SET status = 'sent', wa_message_id = '...'
          │     ↓
          └─ 16. Emit Socket.IO event 'message_sent'
                ↓
    Frontend (Dashboard)
          │
          └─ 17. Update progress bar in real-time
```

### Webhook Status Update Flow

```
Meta Servers
    │
    └─ POST /webhook
       {
         "object": "whatsapp_business_account",
         "entry": [{
           "changes": [{
             "value": {
               "statuses": [{
                 "id": "wamid.HBg...",
                 "status": "delivered",
                 "timestamp": "1234567890"
               }]
             }
           }]
         }]
       }
          ↓
    Backend (webhook.js)
          │
          ├─ 1. Validate signature (HMAC-SHA256 on req.rawBody)
          │     ↓
          ├─ 2. Extract status update
          │     ↓
          ├─ 3. UPDATE messages SET status = 'delivered' WHERE wa_message_id = '...'
          │     ↓
          └─ 4. Emit Socket.IO event 'status_update'
                ↓
    Frontend (History)
          │
          └─ 5. Update status badge color in real-time
```

---

## 6. Security Architecture

### 6.1 SQL Injection Prevention
**Method:** Parameterized queries
```javascript
// UNSAFE — never do this
db.run(`UPDATE campaigns SET status = '${status}'`)

// SAFE — always use parameterized queries
db.run('UPDATE campaigns SET status = ?', [status])
```

### 6.2 Webhook Security
**Method:** HMAC-SHA256 signature validation with timing-safe comparison

```javascript
// rawBody is captured by express.json() verify callback — exact bytes Meta signed
const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)  // Buffer — exact bytes Meta signed
    .digest('hex')

// Timing-safe comparison (prevents timing attacks)
crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
)
```

**Important:** `req.rawBody` must be the raw buffer from the `verify` callback of
`express.json()`. If it is unavailable, the request is rejected with `400 Bad Request`.
Using `JSON.stringify(req.body)` is not acceptable because re-serialization can alter
whitespace and key order, producing a different byte sequence than what Meta signed.

**Production Enforcement:**
```javascript
if (!appSecret && process.env.NODE_ENV === 'production') {
    return res.sendStatus(403) // Reject if no secret configured
}
```

### 6.3 Input Validation
**Library:** `express-validator`

```javascript
body('name').trim().isLength({ min: 1, max: 100 }),
body('contacts').isArray({ min: 1 }),
body('contacts.*.phone').matches(/^\+[1-9]\d{1,14}$/), // E.164 format
```

### 6.4 Rate Limiting
**Global API Limit:** 100 requests per 15 minutes per IP
**Webhook Limit:** 100KB body size

### 6.5 Credential Encryption
**Storage:** All tokens/passwords encrypted before DB storage
**Algorithm:** AES-256-GCM (primary: Electron safeStorage; fallback: per-installation key file)
**Key storage:** `encryption.key` in `app.getPath('userData')` — never in the install directory
**Storage:** Encrypted values stored in `app_config.value`

### 6.6 CORS Policy
**Production:** Disabled (Electron app, no cross-origin requests)
**Development:** Allowed from `localhost:5173` (Vite dev server)

### 6.7 Auth Middleware
**Mechanism:** 256-bit random session key issued at server startup via `GET /auth/token`.
**Enforcement:** Localhost-only (requests from non-localhost IPs are rejected).
**Rotation:** Key rotates on every server restart.

---

## 7. Database Schema

### `app_config`
```sql
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT,        -- Encrypted for sensitive values
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Keys:**
- `wa_phone_number_id` - WhatsApp Phone Number ID
- `wa_access_token` - Permanent access token (encrypted)
- `wa_app_secret` - App secret for webhook validation (encrypted)
- `webhook_verify_token` - Custom verify token (encrypted)
- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass` - Email config

### `campaigns`
```sql
CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    template_name TEXT NOT NULL,
    status TEXT DEFAULT 'active',  -- active | paused | completed
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE INDEX idx_campaigns_status ON campaigns(status);
```

### `messages`
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    template_params TEXT,      -- JSON array
    media_id TEXT,
    status TEXT DEFAULT 'queued', -- queued | processing | sent | delivered | read | failed
    wa_message_id TEXT UNIQUE,
    error_message TEXT,
    sent_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
)

CREATE INDEX idx_messages_status_campaign ON messages(status, campaign_id);
```

---

## 8. API Design

### RESTful Principles
- **Resource-based URLs:** `/api/campaigns`, `/api/media`
- **HTTP verbs:** GET (read), POST (create), PATCH (update), DELETE (remove)
- **Status codes:** 200 (OK), 201 (Created), 400 (Bad Request), 403 (Forbidden), 500 (Server Error)

### Response Format
```json
{
  "success": true,
  "data": { },
  "error": "Error message"
}
```

### Error Handling
**Middleware:** `errorHandler.js`
```javascript
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "stack": "..." // Development only
}
```

---

## 9. Message Queue System

### Architecture Pattern
**Type:** Single-threaded sequential processor (not multi-worker)

**Why?**
- Simple, predictable rate limiting
- No race conditions
- Sufficient for localhost use case (1-100 TPS)

### Queue Processing Algorithm
```javascript
async function processQueue() {
    while (isRunning) {
        const messages = await getQueuedMessages(batchSize)

        for (const msg of messages) {
            await rateLimit() // Enforce TPS

            try {
                const result = await whatsappService.sendMessage(...)
                await markSent(msg.id, result.id)
            } catch (error) {
                await markFailed(msg.id, error.message)
                await sendEmailFallback(msg)
            }
        }

        await sleep(1000) // Poll every second
    }
}
```

### Rate Limiting
**Configurable:** 1-100 Transactions Per Second (TPS)
**Implementation:**
```javascript
const delay = 1000 / tps // milliseconds between sends
await new Promise(resolve => setTimeout(resolve, delay))
```

---

## 10. Real-time Communication

### Socket.IO Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `campaign_created` | Server → Client | `{ id, name }` | Notify UI of new campaign |
| `message_sent` | Server → Client | `{ campaignId, count }` | Update progress bar |
| `status_update` | Server → Client | `{ id, status }` | Update message status |
| `campaign_progress` | Server → Client | `{ campaignId, sent, failed }` | Real-time stats |

### Connection Management
**Client (React):**
```javascript
const socket = io('http://localhost:3000')

socket.on('status_update', (data) => {
    // Update UI
})
```

**Server (Express):**
```javascript
io.on('connection', (socket) => {
    logger.info('Client connected: ' + socket.id)
})

// Broadcast from anywhere
io.emit('campaign_created', { id: 1, name: 'Test' })
```

---

## Conclusion

WhatsFlow is a well-architected desktop application that balances simplicity with
production-grade features. The monolithic design is appropriate for a localhost application,
while the modular codebase allows for future scaling if needed.

**Key Strengths:**
- Clean separation of concerns (routes, services, workers)
- Robust error handling and validation
- Security-first design (encryption, raw-body HMAC validation)
- Runtime tunnel management without server restarts
- Real-time user feedback via Socket.IO
- Comprehensive test coverage (60 backend + 26 frontend tests passing)
- Standardised template variable convention (`{{1}}`=name, `{{2}}`=amount/table, `{{3}}`=date)
  means one Excel contact sheet works for all 8 supported template types
- React inline modal pattern (no `window.confirm()`) for all destructive confirmations

**For detailed usage instructions, see [USER_GUIDE.md](./USER_GUIDE.md)**
