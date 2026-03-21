# WhatsFlow - WhatsApp Bulk Messaging

**Version:** 1.0.0  
**Platform:** Windows Desktop (Electron)  
**License:** Proprietary

---

## Overview

WhatsFlow is a localhost-based WhatsApp bulk messaging application that enables sending template-based messages to multiple contacts with support for dynamic media attachments (images/videos).

### Key Features

✅ **Template Messaging** - Use Meta-approved WhatsApp templates  
✅ **Dynamic Media** - Attach campaign-specific images/videos  
✅ **Bulk Sending** - Send to hundreds of contacts  
✅ **Email Fallback** - Automatic email delivery if WhatsApp fails  
✅ **Excel Import** - Import contacts from Excel files  
✅ **Real-time Tracking** - Monitor message delivery status  
✅ **Webhook Integration** - Receive status updates from WhatsApp  
✅ **Dark/Light Theme** - Modern UI with theme switching

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **WhatsApp Business Account** with API access
- **Meta Business Manager** account
- **Windows 10/11**

### Quick Start

```powershell
# 1. Install dependencies
npm install

# 2. Set your unique subdomain (one-time)
$env:TUNNEL_SUBDOMAIN="whatsflow-yourname"

# 3. Start the app
npm run start:prod
```

The app will open in an Electron window.

### First-Time Setup

1. **Configure WhatsApp API:**
   - Go to **Settings** → **WhatsApp API**
   - Enter: Access Token, Phone ID, WABA ID, App Secret
   - Click **Save Settings**

2. **Configure Email Fallback (Optional):**
   - Go to **Settings** → **Email Fallback**
   - Enter SMTP credentials
   - Click **Save Settings**

3. **Create Campaign:**
   - Go to **New Campaign**
   - Select approved template
   - Upload contacts (Excel)
   - Optionally attach media
   - Launch campaign

---

## Production Deployment

See **DEPLOYMENT.md** for detailed deployment instructions.

**Quick Deploy:**
```bash
# 1. Check readiness
.\CHECK_DEPLOYMENT.bat

# 2. Configure credentials in Settings
# 3. Test with small campaign
# 4. Monitor logs in backend/logs/
```

---

## Configuration

### WhatsApp API Setup

1. Create WhatsApp Business App in Meta Business Manager
2. Get API credentials from App Dashboard
3. Configure webhook URL for status updates
4. Approve message templates

### Environment Variables

- `NODE_ENV=production` - Required for production mode

### Database

SQLite database auto-created at: `database.sqlite`

**Backup:**
```bash
.\BACKUP_DATABASE.bat
```

---

## Architecture

```
whatsflow/
├── backend/          # Express server + worker
│   ├── services/     # WhatsApp, Email, Crypto
│   ├── routes/       # API endpoints
│   ├── middleware/   # Error handling
│   └── logs/         # Application logs
├── frontend/         # React UI
│   └── src/
│       ├── pages/    # Main pages
│       └── components/
├── electron/         # Electron main process
└── database.sqlite   # SQLite database
```

---

## Features

### Campaign Management
- Create campaigns with approved templates
- Upload contacts via Excel
- Map columns (Phone, Email, Parameters)
- Real-time progress tracking

### Media Support
- Upload images (JPG, PNG)
- Upload videos (MP4)
- Max file size: 16MB
- Dynamic header injection

### Message Queue
- Background worker processing
- Rate limiting (1 msg/sec)
- Automatic retry (3 attempts)
- Email fallback on failure

### Monitoring
- Real-time status updates
- Campaign statistics
- Error logging
- Webhook integration

---

## Security

✅ **Encryption** - AES-256 via Electron safeStorage  
✅ **Webhook Validation** - HMAC SHA-256 signatures  
✅ **Rate Limiting** - API and worker protection  
✅ **Input Validation** - All user inputs sanitized  
✅ **SQL Injection Prevention** - Parameterized queries

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watchAll

# Unit tests only
npm run test:unit
```

**Coverage:** ~67%

---

## Troubleshooting

### Templates Not Loading
- Verify WhatsApp credentials in Settings
- Check Meta Business Manager for approved templates
- Review `backend/logs/error.log`

### Messages Failing
- Check Meta account status and limits
- Verify phone numbers are valid
- Check rate limiting settings

### Webhook Not Working
- Verify webhook URL is accessible
- Check App Secret is configured
- Review signature validation logs

### Database Locked
- Ensure only one instance is running
- WAL mode should prevent locks
- Restart application if needed

---

## Support

**Check Logs:**
- Error log: `backend/logs/error.log`
- Combined log: `backend/logs/combined.log`

**Before Reporting Issues:**
1. Check logs for errors
2. Verify credentials
3. Test with approved templates
4. Run `npm test`
5. Check Meta Business Manager

---

## License

Proprietary - All rights reserved

---

## Credits

Built with: Electron, React, Express, SQLite, Socket.IO

**Version:** 1.0.0  
**Last Updated:** 2026-01-19
