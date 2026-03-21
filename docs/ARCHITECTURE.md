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
- **Contact Management:** Import contacts via Excel/CSV
- **Campaign Tracking:** Real-time progress monitoring
- **Template Support:** Dynamic parameter substitution
- **Media Uploads:** Support for images and videos
- **Email Fallback:** Automatic email notifications on failures
- **Webhook Integration:** Receive delivery status updates
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
| **React** | 19.2.0 | UI framework with dark-mode aware charts via useTheme() |
| **React Router** | 7.12.0 | Client-side routing (SPA navigation) |
| **Vite** | 7.2.4 | Build tool and dev server (HMR) |
| **Tailwind CSS** | 4.1.18 | Utility-first styling framework |
| **Axios** | 1.13.2 | HTTP client for API requests |
| **Socket.IO Client** | 4.8.3 | WebSocket client for real-time updates |
| **Recharts** | 3.6.0 | Charting library for analytics |
| **XLSX** | 0.18.5 | Excel file parsing for contact import |
| **Lucide React** | 0.562.0 | Icon library |

### Backend Layer
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime |
| **Express.js** | 4.18.0 | Web framework and API server |
| **Socket.IO** | 4.7.0 | WebSocket server for real-time events |
| **SQLite3** | 5.1.0 | Embedded relational database |
| **Helmet** | 8.1.0 | Security headers middleware |
| **CORS** | 2.8.5 | Cross-origin resource sharing |
| **Compression** | 1.8.1 | Response compression (gzip) |
| **Winston** | 3.19.0 | Logging framework |
| **Nodemailer** | 6.9.0 | Email client for fallback notifications |
| **Multer** | 2.0.2 | Multipart/form-data file upload handler |
| **Express Validator** | 7.3.1 | Input validation and sanitization |
| **Express Rate Limit** | 8.2.1 | API rate limiting middleware |
| **Node Cron** | 4.2.1 | Scheduled task manager |

### Desktop Layer
| Technology | Version | Purpose |
|------------|---------|---------|
| **Electron** | 33.0.0 | Desktop application wrapper (Chromium + Node.js) |
| **Electron Builder** | 26.4.0 | Build and package for distribution |

### Testing & Development
| Technology | Version | Purpose |
|------------|---------|---------|
| **Jest** | 30.2.0 | Unit and integration testing framework |
| **Supertest** | 7.2.2 | HTTP endpoint testing |
| **Playwright** | 1.57.0 | End-to-end UI testing |
| **Vitest** | 4.0.17 | Frontend unit testing (Vite-native) |
| **Concurrently** | 9.2.1 | Run multiple npm scripts in parallel |

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
- EADDRINUSE error handling (graceful log, no crash)
- SPA catch-all route (React Router support for all paths)

**Key Middleware:**
```javascript
// Security
app.use(helmet())              // Set security headers
app.use(cors({ origin: false })) // Disable CORS (Electron only)

// Performance
app.use(compression())         // Gzip responses

// Body Parsing
app.use(express.json({ limit: '10mb' }))
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

**Configuration:**
- **Location:** `./database.sqlite`
- **Mode:** WAL (improves concurrent read/write performance)
- **Encryption:** AES-256-CBC for sensitive config values

**Schema:**
- `app_config` - Application settings (encrypted)
- `campaigns` - Campaign metadata
- `messages` - Individual message records
- `contacts` - Imported contact list (transient)

#### 4.3 Routes

##### `/webhook` - Webhook Handler
- **GET:** Verification endpoint for Meta
- **POST:** Receive delivery status updates
- **Security:** HMAC-SHA256 signature validation

##### `/api/settings` - Configuration
- **GET `/config`:** Retrieve app configuration
- **POST `/config`:** Save WhatsApp/SMTP credentials

##### `/api/campaigns` - Campaign Management
- **GET `/`:** List all campaigns
- **GET `/templates`:** Fetch WhatsApp templates
- **POST `/`:** Create new campaign (bulk insert)
- **PATCH `/:id/status`:** Toggle campaign active/paused

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

**Algorithm:** AES-256-CBC
**Key Derivation:** PBKDF2 with SHA256
**Storage:** Encrypted values stored in `app_config.value`

#### 4.5 Worker (`backend/worker.js`)
**Purpose:** Background message queue processor

**Flow:**
1. Poll database for `queued` messages
2. Check rate limit (TPS from config)
3. Send via `whatsappService.sendMessage()`
4. Update status: `processing` → `sent` or `failed`
5. On failure: Attempt email fallback
6. Repeat every 1 second

**Concurrency:** Single-threaded sequential processing
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
    ├─ 2. Parse contacts (xlsx library)
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
          ├─ 1. Validate signature (HMAC-SHA256)
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
// ❌ UNSAFE
db.run(`UPDATE campaigns SET status = '${status}'`)

// ✅ SAFE
db.run('UPDATE campaigns SET status = ?', [status])
```

### 6.2 Webhook Security
**Method:** HMAC-SHA256 signature validation with timing-safe comparison

```javascript
const receivedSignature = req.headers['x-hub-signature-256']
const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(JSON.stringify(req.body))
    .digest('hex')

// Timing-safe comparison (prevents timing attacks)
crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
)
```

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
**Algorithm:** AES-256-CBC
**Key:** 32-byte key derived from environment-specific salt

### 6.6 CORS Policy
**Production:** Disabled (Electron app, no cross-origin requests)
**Development:** Allowed from `localhost:5173` (Vite dev server)

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
  "data": { ... },
  "error": "Error message" // Only on failure
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

WhatsFlow is a well-architected desktop application that balances simplicity with production-grade features. The monolithic design is appropriate for a localhost application, while the modular codebase allows for future scaling if needed.

**Key Strengths:**
- ✅ Clean separation of concerns (routes, services, workers)
- ✅ Robust error handling and validation
- ✅ Security-first design (encryption, signature validation)
- ✅ Real-time user feedback via Socket.IO
- ✅ Comprehensive test coverage

**For detailed usage instructions, see [USER_GUIDE.md](./USER_GUIDE.md)**
