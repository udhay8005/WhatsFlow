# WhatsFlow - User Guide

## 🚀 Getting Started

### 1. Installation
WhatsFlow is a desktop application.
1. Download the latest installer from the releases page (or build from source).
2. Run the installer (`.exe` on Windows).
3. Logic takes you to the initial configuration screen.

### 2. First-Time Setup
Before sending messages, you need to configure your WhatsApp API credentials:
1. Go to **Settings** (⚙️ icon in sidebar).
2. Enter your **WhatsApp Phone ID**, **WABA ID**, and **System User Access Token**.
   - These can be found in your [Meta App Dashboard](https://developers.facebook.com/).
3. (Optional) Configure **SMTP Settings** for email fallback.
4. Click **Save Settings**.

---

## 📨 Creating a Campaign

### Step 1: Campaign Details
- **Name**: Give your campaign a descriptive name (e.g., "Jan Newsletter").
- **Template**: Select an **APPROVED** WhatsApp template from the dropdown. 
  - *Note: Only templates approved in Meta Business Manager will appear here.*
- **Media**: (Optional) Upload an image/video if your template has a media header.

### Step 2: Upload Contacts
- Click **Upload Excel/CSV**.
- Your file must have at least a `Phone` column.
- Supported headers: `Phone`, `Name`, `Email`.
- **Validation**: The system automatically validates phone numbers. Invalid numbers will be flagged.

### Step 3: Review & Schedule
- Review the total count and valid/invalid numbers.
- **Send Now**: Starts processing immediately.
- **Schedule**: Pick a future date/time. The system will auto-start sending at that time (app must be running).

---

## 📊 Analytics Dashboard

The Home page provides real-time insights:
- **Total Campaigns**: Number of campaigns created.
- **Messages Sent**: Successfully delivered WhatsApp messages.
- **Failed**: Messages that could not be delivered.
- **Pending**: Messages waiting in queue.
- **Success Rate**: Visual chart of delivery performance.

---

## ❓ Troubleshooting

### "Invalid Credentials" Error
- Verify your Access Token hasn't expired. System User tokens are recommended for permanence.
- Ensure your Phone ID matches the one in Meta Dashboard.

### Messages Stuck in "Queued"
- Check if the **Worker** is running (green indicator in logs/status).
- Check your **TPS (Transactions Per Second)** setting in Settings. If set too low, sending will be slow.

### "Template Not Found"
- Ensure the template is **APPROVED** in Meta.
- Verify the template language matches (default is `en_US`).
- Click "Refresh Templates" or reload the page to fetch the latest list.
