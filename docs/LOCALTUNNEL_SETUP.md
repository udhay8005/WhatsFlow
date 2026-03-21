# LocalTunnel Setup Guide

## What is LocalTunnel?

LocalTunnel exposes your local WhatsFlow app to the internet with a **permanent public URL** so Meta can send webhook events to your localhost.

**Benefits:**
- ✅ Free forever
- ✅ Permanent URL (never changes)
- ✅ Auto-starts with app
- ✅ Auto-stops when app closes
- ✅ No manual configuration needed

---

## Step 1: Choose Your Subdomain

Pick a unique subdomain name (like your company name or username):

**Examples:**
- `whatsflow-acme` → https://whatsflow-acme.loca.lt
- `whatsflow-john` → https://whatsflow-john.loca.lt
- `mybusiness-wa` → https://mybusiness-wa.loca.lt

**Rules:**
- Lowercase letters, numbers, hyphens only
- No spaces or special characters
- Must be unique (first-come, first-served)

---

## Step 2: Set Your Subdomain

**Option A: Via Environment Variable (recommended)**

```powershell
# Windows PowerShell
$env:TUNNEL_SUBDOMAIN="whatsflow-yourname"
npm run start:tunnel
```

**Option B: Edit Code (one-time setup)**

Edit `backend/tunnelManager.js`, line 12:
```javascript
async function startTunnel(port = 3000, subdomain = 'whatsflow-yourname') {
    // Change 'whatsflow-yourname' to your custom subdomain
```

Then run:
```powershell
npm run start:tunnel
```

---

## Step 3: Start the App

```powershell
npm run start:tunnel
```

**Expected Output:**
```
Starting internal backend server...
Waiting 3 seconds for backend server to start...
Server running on http://localhost:3000
🔌 Starting LocalTunnel...
✅ LocalTunnel started successfully!
📡 Public Webhook URL: https://whatsflow-yourname.loca.lt/webhook
   Forwarding to: http://localhost:3000

⚙️  Configure this URL in Meta Developer Console:
   1. Go to https://developers.facebook.com/
   2. Your App → WhatsApp → Configuration → Webhook
   3. Callback URL: https://whatsflow-yourname.loca.lt/webhook
   4. Verify Token: (from your Settings page)
```

**Copy the webhook URL shown!** (e.g., `https://whatsflow-yourname.loca.lt/webhook`)

---

## Step 4: Configure Meta Webhook

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Select your app
3. **WhatsApp** → **Configuration**
4. In the **Webhook** section:
   - **Callback URL:** Paste your tunnel URL + `/webhook`
     ```
     https://whatsflow-yourname.loca.lt/webhook
     ```
   - **Verify Token:** Copy from WhatsFlow Settings → Webhook → Verify Token
5. Click **"Verify and Save"**
6. Subscribe to field: ✅ **messages**

**✅ You're done!** This URL will work forever. You never need to update it.

---

## Step 5: Test Webhooks

1. Send a test campaign (1-2 contacts)
2. Open **History** page
3. Watch status change from "sent" → "delivered" in real-time
4. Check backend console for:
   ```
   info: Webhook received: whatsapp_business_account, entries: 1
   info: Message status update: delivered
   ```

---

## Troubleshooting

### Issue: "Subdomain already taken"

**Error message:**
```
LocalTunnel error: Subdomain is already in use
```

**Solution:** Choose a different subdomain name
```powershell
$env:TUNNEL_SUBDOMAIN="whatsflow-yourname2"
npm run start:tunnel
```

---

### Issue: "Tunnel closes immediately"

**Symptoms:** Tunnel starts then logo says "Tunnel closed"

**Solutions:**
1. Check if port 3000 is already in use:
   ```powershell
   Get-NetTCPConnection -LocalPort 3000
   ```
2. Restart your PC
3. Try a different port:
   ```powershell
   $env:PORT=3001
   npm run start:tunnel
   ```

---

### Issue: "Webhook verification failed in Meta"

**Symptoms:** Meta shows "Failed to verify webhook" error

**Solutions:**

**1. Check if app is running:**
```powershell
# Test manually
curl "https://whatsflow-yourname.loca.lt/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
# Should return: test
```

**2. Verify token matches:**
- WhatsFlow Settings → Webhook → Verify Token
- Must match exactly what you entered in Meta

**3. Check backend logs:**
```
info: Webhook verified
```

---

### Issue: Slow tunnel connection

**Symptoms:** Webhooks take 5-10 seconds to arrive

**Cause:** LocalTunnel can be slower than ngrok

**Solutions:**
1. **Accept it** - Still works, just delayed
2. **Upgrade to ngrok paid** ($8/mo for faster speeds)
3. **Use Cloudflare Tunnel** (free, faster)

---

## Daily Usage

### Starting App with Tunnel

```powershell
npm run start:tunnel
```

That's it! Always use this command instead of `npm run start:prod`.

### Starting App WITHOUT Tunnel

```powershell
npm run start:prod
```

Use this when you don't need webhooks (e.g., just sending messages locally).

---

## Advanced Configuration

### Custom Port

```powershell
$env:PORT=3001
$env:TUNNEL_SUBDOMAIN="whatsflow-yourname"
npm run start:tunnel
```

### Disable Tunnel

```powershell
# Just use regular start
npm run start:prod
```

### Check Tunnel Status

```javascript
// In browser console
fetch('/api/settings/tunnel/status').then(r => r.json())
```

---

## FAQ

**Q: Does the URL change when I restart the app?**  
A: No! As long as you use the same subdomain, it stays the same forever.

**Q: Can I use a custom domain (e.g., whatsapp.mydomain.com)?**  
A: Not with LocalTunnel free tier. Use ngrok ($8/mo) or Cloudflare Tunnel (free) for custom domains.

**Q: What if someone else uses my subdomain?**  
A: Subdomains are first-come, first-served. Once you claim "whatsflow-yourname", it's yours while your tunnel is active.

**Q: Does this expose my entire PC to the internet?**  
A: No, only port 3000 (the WhatsFlow backend). Nothing else on your PC is exposed.

**Q: Is this secure?**  
A: Yes. LocalTunnel uses HTTPS encryption. WhatsFlow validates all webhook signatures using HMAC-SHA256.

**Q: Can I use this for production (real business)?**  
A: Yes! LocalTunnel is reliable enough for small-to-medium businesses. For enterprise use, consider deploying to a cloud server.

---

**For more help, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
