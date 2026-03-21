# WhatsFlow - User Guide

**Version:** 1.0.1
**Author:** Udhaya Chandra SA
**Last Updated:** March 2026

---

## Getting Started

### Installation

**Option A: Using the Installer (Recommended)**
1. Run `WhatsFlow Setup 1.0.1.exe` from the `dist/` folder.
2. The app installs automatically and creates a desktop shortcut.
3. Launch **WhatsFlow** from the desktop or Start Menu.

**Option B: Portable**
1. Run `WhatsFlow 1.0.1.exe` directly — no installation needed.

---

### First-Time Setup

Before sending messages, configure your WhatsApp API credentials:

1. Navigate to **Settings** (gear icon in sidebar).
2. Under **WhatsApp API**, enter:
   - **Access Token** — from Meta Business System User (permanent token recommended)
   - **Phone Number ID** — from Meta Developer Console -> WhatsApp -> API Setup
   - **WABA ID** — WhatsApp Business Account ID
   - **App Secret** — from Meta App Settings -> Basic (required for webhook security)
   - **Verify Token** — any strong custom string you choose
3. Click **Save Configuration**. Green checkmarks confirm each field.
4. *(Optional)* Configure **Email Fallback** (SMTP) under the Email tab.

---

## Creating a Campaign

### Step 1: Campaign Details
- **Campaign Name** — descriptive label (e.g., "March Newsletter").
- **Template** — select an APPROVED WhatsApp template from the dropdown. Only approved templates from your WABA appear.
- **Media** *(optional)* — upload an image (JPG/PNG) or video (MP4) up to 16MB if your template has a media header.

### Step 2: Upload Contacts
- Click **Upload Excel/CSV**.
- File must have at least a `Phone` column (E.164 format recommended: `+911234567890`).
- Supported columns: `Phone`, `Email`, and dynamic parameter columns mapped to `{{1}}`, `{{2}}`, etc.
- Invalid phone numbers are flagged and skipped automatically.

### Step 3: Review & Schedule
- Review valid/invalid contact count.
- Preview individual messages using the eye icon.
- **Send Now** — starts processing immediately.
- **Schedule for later** — pick a future date/time. The app must be running at that time.
- Click **Launch Campaign** -> **Confirm & Launch**.

---

## Analytics Dashboard

The Dashboard provides real-time insights:
- **Total Campaigns** — all campaigns created.
- **Messages Sent** — successfully sent to WhatsApp.
- **Failed** — delivery failures.
- **Pending** — messages waiting in queue.
- **Delivery Trend** — 7-day line chart (dark/light mode adaptive).
- **Status Distribution** — pie chart of message statuses.

---

## Campaign History

The History page lists all campaigns with:
- Status badge (Draft, Active, Paused, Processing, Completed, Failed)
- Progress bar for active/paused campaigns
- Pause / Resume controls for running campaigns
- Delete button (with confirmation)
- Expandable row showing per-message delivery status (Phone, Status, Channel, Error)

---

## Blacklist Management

Prevent specific numbers from receiving future messages:
1. Navigate to **Blacklist** in the sidebar.
2. Enter the phone number and an optional reason, then click **Block**.
3. Blocked numbers are automatically skipped during campaign eligibility checks.
4. Remove a number from the blacklist using the trash icon.

---

## Settings

### WhatsApp API Tab
- Configure Meta credentials (encrypted at rest).
- View tunnel webhook URL (when running with `npm run start:tunnel` or production + tunnel mode).

### Email Fallback Tab
- Configure SMTP credentials for automatic email delivery when WhatsApp fails.

### Operations Tab
- **Worker TPS** — Transactions Per Second (1-100). Start at 5-10, increase gradually.
- **Clear Logs** — deletes `backend/logs/*.log`.
- **Clean App** — clears uploaded media files.
- **Clear History** — deletes all campaigns and messages from database.

---

## Troubleshooting

### "Invalid Credentials" / Templates Not Loading
- Verify the Access Token hasn't expired. Use a permanent System User token.
- Ensure Phone Number ID and WABA ID are exact (copy from Meta Developer Console).
- Re-enter credentials in Settings and save.

### Messages Stuck in "Queued"
- Increase TPS in Settings -> Operations (default is 1).
- Check that your WhatsApp credentials are valid — failed sends stay queued.

### "Template Not Found"
- Template must be **APPROVED** in Meta Business Manager.
- Template name is case-sensitive.
- Click refresh (re-navigate to New Campaign) to fetch latest template list.

### Webhook Not Receiving Updates (Statuses Stuck at "Sent")
- Start the app with `npm run start:tunnel` or using the tunnel-enabled Electron mode.
- Copy the webhook URL from Settings -> WhatsApp API tab.
- Paste it in Meta Developer Console -> Your App -> WhatsApp -> Configuration -> Webhook.
- Subscribe to the `messages` field.

### Port 3000 Already in Use
- Another instance of WhatsFlow (or dev server) is running.
- Close all other instances, then relaunch.

---

**For configuration details, see [CONFIGURATION.md](./CONFIGURATION.md)**
**For technical issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
