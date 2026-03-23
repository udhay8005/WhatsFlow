# WhatsFlow - Configuration Reference

**Version:** 1.0.1
**Author:** Udhaya Chandra SA
**Last Updated:** March 2026
**Purpose:** Complete reference for all configuration options

---

## Table of Contents

1. [WhatsApp API Configuration](#whatsapp-api-configuration)
2. [SMTP Email Configuration](#smtp-email-configuration)
3. [Webhook Configuration](#webhook-configuration)
4. [Worker Configuration](#worker-configuration)
5. [Environment Variables](#environment-variables)
6. [Security Settings](#security-settings)
7. [Database Configuration](#database-configuration)

---

## 1. WhatsApp API Configuration

### Required Fields

#### Phone Number ID
**Location:** Settings → WhatsApp API → Phone Number ID
**Type:** String
**Example:** `123456789012345`
**How to get:**
1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Your App → WhatsApp → API Setup
3. Copy **Phone Number ID** from "From" dropdown

**Validation:** Must be 15 digits

---

#### WABA ID (WhatsApp Business Account ID)
**Location:** Settings → WhatsApp API → WABA ID
**Type:** String
**Example:** `109876543210987`
**How to get:**
1. Go to [Meta Business Manager](https://business.facebook.com/)
2. WhatsApp Accounts → View Details
3. Copy the ID from the URL: `business.facebook.com/wa/.../home/?business_id=WABA_ID`

**Validation:** Must be numeric

---

#### Access Token
**Location:** Settings → WhatsApp API → Access Token
**Type:** String (encrypted in storage)
**Example:** `EAABCxyz...` (starts with EAAB)
**How to get:**

**Option 1: Temporary Token (24 hours)**
1. Meta Developer Console → WhatsApp → API Setup
2. Copy token from "Temporary access token"
3. Expires in 24 hours — **NOT recommended for production**

**Option 2: Permanent Token (recommended)**
1. Go to [Meta Business Settings](https://business.facebook.com/settings/)
2. System Users → Add
3. Name: "WhatsFlow Bot", Role: "Admin"
4. Generate New Token
5. Select App: Your WhatsApp App
6. Permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
7. Copy token immediately (shown only once)

**Validation:**
- Starts with `EAAB`
- Length: 200+ characters
- No spaces or special characters

---

#### App Secret
**Location:** Settings → WhatsApp API → App Secret
**Type:** String (encrypted in storage)
**Example:** `abc123def456...` (32 characters hex)
**How to get:**
1. Meta Developer Console → Settings → Basic
2. Click "Show" next to App Secret
3. Copy the value

**Purpose:** Validates webhook signatures to prevent spoofing

**CRITICAL:** Required in production mode. Without this, webhooks will be rejected.

**Validation:** 32 characters, hexadecimal

---

#### Verify Token
**Location:** Settings → WhatsApp API → Verify Token
**Type:** String (encrypted in storage)
**Example:** `my_custom_verify_token_123`
**Custom Value:** You choose this yourself

**Purpose:** Meta uses this to verify your webhook endpoint during setup

**Recommendations:**
- Use a strong, random string
- Minimum 16 characters
- Alphanumeric + underscores
- Example generator: `openssl rand -hex 16`

---

### Testing Configuration

**Verify all credentials:**
```powershell
# Test access token
curl "https://graph.facebook.com/v18.0/me" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Expected response:
# { "id": "...", "name": "Your App Name" }

# Test templates fetch
curl "https://graph.facebook.com/v18.0/YOUR_WABA_ID/message_templates" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Expected response:
# { "data": [ { "name": "hello_world", "status": "APPROVED" } ] }
```

---

## 2. SMTP Email Configuration

**Purpose:** Send email notifications when WhatsApp message fails

### Configuration Fields

#### Enable Email Fallback
**Location:** Settings → Email Settings → Enable Email Fallback
**Type:** Checkbox
**Default:** Unchecked (disabled)

**When to enable:**
- You want email backup for failed messages
- You have SMTP credentials configured

---

#### SMTP Host
**Type:** String
**Examples:**
- Gmail: `smtp.gmail.com`
- Outlook: `smtp-mail.outlook.com`
- Custom: `mail.yourdomain.com`

---

#### SMTP Port
**Type:** Integer
**Common Values:**
- `587` - TLS (recommended)
- `465` - SSL
- `25` - Unencrypted (not recommended)

**Recommendation:** Use `587` with TLS

---

#### SMTP Username
**Type:** String
**Example:** `your-email@gmail.com`

**Gmail Users:**
You cannot use your regular Gmail password directly. You must create an "App Password":
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification (required)
3. App Passwords → Select "Mail" → Generate
4. Use the 16-character password here

---

#### SMTP Password
**Type:** String (encrypted in storage)
**Security:** Encrypted with AES-256-GCM before saving

---

#### From Email
**Type:** Email address
**Example:** `whatsflow-notifications@yourdomain.com`

**Purpose:** The "From" address recipients see

---

### Testing SMTP

Use the **Test SMTP** button in **Settings → Email Fallback** tab. This sends a test email
using the configured credentials and reports success or failure inline.

---

## 3. Webhook Configuration

### Webhook Configuration UI

WhatsFlow includes a built-in tunnel manager accessible from **Settings → WhatsApp API →
Webhook Configuration**. You do not need the command line to set up or use webhooks.

The section contains:
- **Tunnel Subdomain** input — type a unique name (e.g. `yourname-whatsflow`) to get a
  consistent URL every time. Saved to the database automatically; pre-filled on return visits.
  Only lowercase letters, numbers, and hyphens are accepted. Leave blank for a random URL.
- **Status card** — displays current tunnel state: Not Running, Connecting, or Active.
- **Start Tunnel** button — starts LocalTunnel and displays the public webhook URL.
- **Stop Tunnel** button — stops the active tunnel.
- **Refresh** button — re-queries the backend for current tunnel status.
- **Webhook URL** — the full URL to paste into Meta (only shown when Active), with a Copy button.
- **Quick Setup Guide** — five inline steps for first-time Meta webhook configuration.

### Webhook URL

**Format:** `https://<subdomain>.loca.lt/webhook`

**Examples:**
- LocalTunnel: `https://yourname-whatsflow.loca.lt/webhook`
- ngrok: `https://abc123.ngrok.io/webhook`
- Production server: `https://whatsapp.example.com/webhook`

Meta requires `https://`. LocalTunnel provides HTTPS automatically.

### TUNNEL_SUBDOMAIN

Set this in `.env` to request the same subdomain on every tunnel start:

```
TUNNEL_SUBDOMAIN=yourname-whatsflow
```

The subdomain is **best-effort, not permanently reserved**. LocalTunnel subdomains are
first-come, first-served. If another user claims the subdomain while your tunnel is closed,
the URL may change on the next start. A distinctive name minimises this risk.

Without `TUNNEL_SUBDOMAIN`, a random subdomain is assigned on every start.

---

### Configuring in Meta

1. Start the tunnel from Settings → WhatsApp API → Webhook Configuration → Start Tunnel.
2. Copy the displayed webhook URL.
3. Go to [Meta Developer Console](https://developers.facebook.com/) → Your App → WhatsApp → Configuration.
4. Webhook section:
   - **Callback URL:** paste the webhook URL
   - **Verify Token:** same value as Settings → WhatsApp API → Verify Token
5. Click "Verify and Save"
6. Subscribe to fields: `messages` (required for status updates)

---

### Webhook Events

**Supported Events:**
- `sent` - Message sent to WhatsApp servers
- `delivered` - Message delivered to recipient's phone
- `read` - Recipient opened the message
- `failed` - Message delivery failed

**Event Processing:**
- Updates `messages` table in database
- Emits Socket.IO event to frontend
- Real-time status update in UI

---

## 4. Worker Configuration

### Message Processing TPS

**Location:** Settings → Worker → TPS (Transactions Per Second)
**Type:** Integer
**Range:** 1 - 100
**Default:** 5 (conservative starting value; increase as needed)
**Recommended:**
- Testing: 1-5 TPS
- Light use: 10-20 TPS
- Heavy use: 50-80 TPS

**WhatsApp Limits:**
- Official limit: 80 messages/second
- Exceeding may result in rate limit errors
- Start conservative and increase gradually

**How it works:**
```javascript
const delayMs = 1000 / tps
// TPS = 5  → delay = 200ms between sends
// TPS = 20 → delay = 50ms between sends
```

---

## 5. Environment Variables

### Available Variables

#### NODE_ENV
**Type:** String
**Values:** `development`, `production`
**Default:** `development`
**Effect:**
- **Development:**
  - Detailed error stack traces
  - CORS enabled
  - Webhook signature optional
  - Verbose logging
- **Production:**
  - Minimal error details
  - CORS disabled (Electron only)
  - Webhook signature required
  - Error logging only

**Set in PowerShell:**
```powershell
$env:NODE_ENV="production"
npm run start:prod
```

---

#### PORT
**Type:** Integer
**Default:** 3000
**Purpose:** HTTP server port

**Change if port conflict:**
```powershell
$env:PORT=3001
npm run server
```

---

#### LOG_LEVEL
**Type:** String
**Values:** `error`, `warn`, `info`, `debug`
**Default:** `info`
**Purpose:** Control log verbosity

**Set for debugging:**
```powershell
$env:LOG_LEVEL="debug"
npm run server
```

---

##### TUNNEL_SUBDOMAIN
**Type:** String
**Example:** `yourname-whatsflow`
**Purpose:** Request a consistent subdomain from LocalTunnel on every start.

**Preferred method:** Type the subdomain directly in the **Tunnel Subdomain** field inside
Settings → WhatsApp API → Webhook Configuration. It is saved to the database automatically —
no `.env` file or server restart needed.

**Alternative (env var):** Set in your `.env` file:
```
TUNNEL_SUBDOMAIN=yourname-whatsflow
```

Subdomain resolution priority: **UI input → database → `TUNNEL_SUBDOMAIN` env var → random**.

The resulting webhook URL will be `https://yourname-whatsflow.loca.lt/webhook`. This is
best-effort — the subdomain is not permanently reserved. See Section 3 for details.

---

## 6. Security Settings

### Encryption

**Encrypted Fields:**
- `wa_access_token`
- `wa_app_secret`
- `webhook_verify_token`
- `smtp_password`

**Algorithm:** AES-256-GCM (authenticated encryption — detects data tampering)
**Key management:** Per-installation 32-byte random key stored as `encryption.key` in the user data directory (`app.getPath('userData')`). Electron `safeStorage` is used as the primary store where available. The key file is created atomically and auto-regenerated if corrupted.
**Storage:** Database column `app_config.value`; format: `AES_ENC:<iv_hex>:<authTag_hex>:<ciphertext_b64>`

**Implementation:**
```javascript
// Encrypt before saving
const encrypted = cryptoService.encrypt(plainText)
db.run('INSERT INTO app_config (key, value) VALUES (?, ?)', ['wa_access_token', encrypted])

// Decrypt on retrieval
const decrypted = cryptoService.decrypt(row.value)
```

---

### Webhook Signature Validation

**Method:** HMAC-SHA256
**Header:** `x-hub-signature-256`
**Format:** `sha256=<hex_signature>`

**Validation:**
```javascript
// req.rawBody is the raw Buffer captured by the express.json() verify callback
const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)  // exact bytes Meta signed
    .digest('hex')

// Timing-safe comparison
crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
)
```

**Important:** The HMAC is computed against the raw request body buffer, not a
re-serialized JSON string. If `req.rawBody` is unavailable, the request is rejected
with `400 Bad Request`.

**Security:**
- Prevents webhook spoofing
- Mandatory in production
- Optional in development (for testing)

---

### Input Validation

**Phone Numbers:**
- Format: E.164 (`+1234567890`)
- Regex: `/^\+[1-9]\d{1,14}$/`
- Min: 8 digits (excluding +)
- Max: 15 digits (excluding +)

**Campaign Names:**
- Min: 1 character
- Max: 100 characters
- Trimmed automatically

**Template Parameters:**
- Type: Array of strings
- Max: limited by template definition

---

## 7. Database Configuration

### Path

**Location:**
- **Development:** `<project-root>/database.sqlite`
- **Packaged app:** `%APPDATA%\WhatsFlow\database.sqlite` (i.e. `app.getPath('userData')`)
  This is set via `process.env.WHATSFLOW_USER_DATA` which `electron/main.js` publishes before requiring the backend.

> Do not attempt to find the database in the install directory (`C:\Program Files\WhatsFlow\`) — it is read-only. All mutable state (database, logs, uploads, encryption key) lives in the user data directory.

---

### WAL Mode (Write-Ahead Logging)

**Status:** Enabled
**Purpose:** Improve concurrent read/write performance

**Settings:**
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

**Benefits:**
- Multiple readers, one writer
- Better performance
- Automatic checkpointing

---

### Indexes

**Defined indexes:**
```sql
CREATE INDEX idx_messages_status_campaign ON messages(status, campaign_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

**Purpose:** Speed up common queries (campaign progress, message filtering)

---

### Manual Backup
Copy `database.sqlite` while the app is **not running** (to avoid copying mid-write WAL state).

```powershell
# Stop the app first, then:
Copy-Item database.sqlite "database_backup_$(Get-Date -Format 'yyyyMMdd').sqlite"
```

> **Note:** The `BACKUP_DATABASE.bat` script in the project root can also be used for automated backups via Windows Task Scheduler.

---

## Configuration Checklist

### Pre-Production

- [ ] WhatsApp Phone Number ID configured
- [ ] WABA ID configured
- [ ] **Permanent** Access Token (not temporary)
- [ ] App Secret configured (critical for security)
- [ ] Verify Token set
- [ ] Templates loading successfully (green checkmark in Settings)
- [ ] SMTP configured (optional, but recommended)
- [ ] Worker TPS set appropriately (start with 5-10)
- [ ] Tunnel started from Settings → WhatsApp API → Webhook Configuration
- [ ] Webhook URL configured in Meta and verified successfully
- [ ] Test campaign sent successfully to verify end-to-end flow

### Security Checklist

- [ ] `NODE_ENV=production` when deploying
- [ ] App Secret configured (enforces webhook signature validation)
- [ ] Access Token is permanent (not temporary 24h token)
- [ ] Verify Token is strong (16+ random characters)
- [ ] SMTP password encrypted (automatic)
- [ ] Port forwarding secured (if using localhost)
- [ ] Firewall rules configured (allow port 3000)

---

**For setup instructions, see [USER_GUIDE.md](./USER_GUIDE.md)**
**For deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md)**
