# WhatsFlow - API Reference

**Version:** 1.0.1
**Author:** Udhaya Chandra SA
**Last Updated:** March 2026

Base URL: `http://localhost:3000`

---

## Authentication

All `/api/*` routes require a session API key sent as the `X-API-Key` header.

**Get API key (no auth needed):**
```
GET /auth/token
```
Response:
```json
{ "apiKey": "session-key-here" }
```

The frontend `api.ts` axios client handles this automatically — it fetches the key on startup and attaches it to every request via an interceptor.

---

## Health Check

### System Status
**GET** `/health`

Returns server and database health. Used by Electron to detect when the backend is ready, and by the sidebar "Status" indicator in the UI.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-03-21T11:25:12.000Z"
}
```

---

## Campaigns

### List Campaigns
**GET** `/api/campaigns`

Returns all campaigns with summary stats.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Winter Sale",
    "template_name": "winter_offer_v1",
    "status": "completed",
    "total_count": 100,
    "success_count": 98,
    "failed_count": 2,
    "scheduled_at": null,
    "created_at": "2026-03-21T10:00:00.000Z"
  }
]
```

### Get Campaign Details
**GET** `/api/campaigns/:id`

Returns campaign metadata + all individual message records.

### Create Campaign
**POST** `/api/campaigns`

Creates a new bulk messaging campaign and queues all messages.

**Request Body:**
```json
{
  "name": "Winter Sale",
  "templateName": "winter_offer_v1",
  "contacts": [
    {
      "phone": "+911234567890",
      "email": "john@example.com",
      "params": ["John", "50%"]
    }
  ],
  "mediaId": "123456",
  "mediaType": "image",
  "scheduledAt": "2026-04-01T10:00:00.000Z"
}
```

**Response:** `201 Created`

### Pause Campaign
**POST** `/api/campaigns/:id/pause`

### Resume Campaign
**POST** `/api/campaigns/:id/resume`

### Delete Campaign
**DELETE** `/api/campaigns/:id`

Deletes campaign and all associated messages (CASCADE).

---

## Templates

### Get Templates
**GET** `/api/campaigns/templates`

Fetches all approved WhatsApp templates from the WABA via Meta API.

**Response:**
```json
{
  "data": [
    {
      "name": "hello_world",
      "language": "en_US",
      "status": "APPROVED",
      "category": "MARKETING",
      "components": []
    }
  ]
}
```

---

## Settings

### Get Config Status
**GET** `/api/settings/config`

Returns which fields are configured (boolean flags, not the actual values).

### Save Config
**POST** `/api/settings/config`

Saves WhatsApp API and SMTP credentials (encrypted before storage).

**Request Body:**
```json
{
  "wa_access_token": "EAAB...",
  "wa_phone_id": "123456789",
  "wa_waba_id": "987654321",
  "webhook_verify_token": "my_token",
  "wa_app_secret": "abc123...",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": "587",
  "smtp_user": "user@gmail.com",
  "smtp_pass": "password",
  "smtp_secure": "false",
  "max_tps": "10"
}
```

### Get Tunnel Status
**GET** `/api/settings/tunnel`

**Response:**
```json
{
  "active": true,
  "url": "https://whatsflow-yourname.loca.lt"
}
```

### Clear Logs
**POST** `/api/settings/clear-logs`

### Clean App (Clear Uploads)
**POST** `/api/settings/clean-app`

### Clear History
**POST** `/api/settings/clear-history`

Deletes all campaigns and messages from the database.

---

## Contacts / Blacklist

### Check Eligibility
**POST** `/api/contacts/check-eligibility`

Checks which contacts are blacklisted before campaign creation.

### Get Blacklist
**GET** `/api/contacts/blacklist`

### Add to Blacklist
**POST** `/api/contacts/blacklist`

```json
{ "phone": "+911234567890", "reason": "Opted out" }
```

### Remove from Blacklist
**DELETE** `/api/contacts/blacklist/:phone`

---

## Media

### Upload Media
**POST** `/api/media/upload`

Uploads image or video to WhatsApp CDN and returns a `mediaId`.

**Content-Type:** `multipart/form-data`
**Field:** `media` (file)

**Response:**
```json
{
  "mediaId": "12345678901234",
  "mediaType": "image"
}
```

---

## Statistics

### Dashboard Stats
**GET** `/api/stats/dashboard`

Returns aggregate counts for the dashboard cards.

### Delivery Trend
**GET** `/api/stats/trend`

Returns 7-day delivery trend data for the line chart.

### Status Distribution
**GET** `/api/stats/status-distribution`

Returns message status breakdown for the pie chart.

---

## Webhooks

### Verify Webhook
**GET** `/webhook`

Meta calls this to verify your webhook endpoint. Returns the challenge token on success.

### Receive Webhook Events
**POST** `/webhook`

Receives delivery status updates (sent, delivered, read, failed) from Meta. Validates HMAC-SHA256 signature using App Secret. Updates message status in database and emits `campaign_progress` via Socket.IO.

---

## Socket.IO Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `campaign_progress` | Server -> Client | `{ id, type: 'success'\|'failed' }` | Real-time campaign progress |

---

**For configuration, see [CONFIGURATION.md](./CONFIGURATION.md)**
