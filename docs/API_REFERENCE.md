# WhatsFlow - API Reference

Base URL: `http://localhost:3000/api`

## Authentication
Currently, the API runs locally within the Electron environment and does not require external authentication tokens for local requests.

---

## 📌 Campaigns

### Create Campaign
**POST** `/campaigns`

Creates a new bulk messaging campaign.

**Request Body**
```json
{
  "name": "Winter Sale",
  "templateName": "winter_offer_v1",
  "contacts": [
    {
      "phone": "1234567890",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "scheduledAt": "2024-12-25T10:00:00.000Z", // Optional (ISO 8601)
  "mediaId": "123456", // Optional (WhatsApp Media ID)
  "mediaType": "image" // Optional ('image' | 'video')
}
```

**Response**
- `201 Created`: Campaign successfully queued.
- `400 Bad Request`: Validation failed (e.g., missing phone numbers).

### Get Campaigns
**GET** `/campaigns`

Returns a list of all campaigns with summary stats.

**Response**
```json
[
  {
    "id": 1,
    "name": "Winter Sale",
    "status": "completed",
    "total_count": 100,
    "success_count": 98,
    "failed_count": 2,
    "created_at": "..."
  }
]
```

---

## ⚙️ Settings

### Update Settings
**POST** `/settings`

Updates application configuration.

**Request Body**
```json
{
  "wa_phone_id": "...",
  "wa_waba_id": "...",
  "wa_access_token": "...",
  "smtp_host": "...",
  "smtp_user": "...",
  "max_tps": 10
}
```

**Response**
- `200 OK`: Settings saved.

---

## 🏥 Health Check

### System Status
**GET** `/health`

Quick check to see if server is running.

**Response**
```json
{
  "status": "ok",
  "uptime": 12345
}
```
