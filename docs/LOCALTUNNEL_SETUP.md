# LocalTunnel Setup Guide

**Version:** 1.0.1
**Author:** Udhaya Chandra SA
**Last Updated:** March 2026

## What is LocalTunnel?

LocalTunnel exposes your local WhatsFlow backend to the internet with a public HTTPS URL so
that Meta can send webhook delivery-status events to your machine.

**Benefits:**
- Free forever
- No account or sign-up required
- HTTPS out of the box
- Can be started and stopped directly from the Settings UI — no terminal needed
- Auto-stops when the app closes

---

## Method 1: Start via Settings UI (Recommended)

This is the simplest approach. No terminal commands or `.env` file required.

1. Open WhatsFlow and navigate to **Settings** (gear icon in the sidebar).
2. Click the **WhatsApp API** tab.
3. Scroll down to the **Webhook Configuration** section — it is always visible.
4. In the **Tunnel Subdomain** field, type a unique name (e.g. `yourname-whatsflow`).
   - This sets a consistent URL so you only need to configure Meta once.
   - Leave it blank if you don't mind a different URL each time.
   - Only lowercase letters, numbers, and hyphens are accepted.
5. Click **Start Tunnel**.
   - The button shows a loading spinner while the tunnel connects (usually 3-10 seconds).
   - Once connected, the status card turns green (**Active**) and the full webhook URL appears.
   - The subdomain is saved to the database automatically — it will be pre-filled next time.
6. Click the **Copy** button next to the URL to copy it to your clipboard.
7. Paste the URL into Meta as described in the "Configure Meta Webhook" section below.

To stop the tunnel, click **Stop Tunnel** in the same section.

To refresh the displayed URL after a restart, click the **Refresh** button.

---

## Method 2: Start via Command Line (Alternative)

If you prefer the terminal, or need to start the tunnel before the Electron window opens:

```powershell
npm run start:tunnel
```

**Expected output:**
```
Starting internal backend server...
Server running on http://localhost:3000
Cron jobs scheduled
LocalTunnel started: https://whatsflow-yourname.loca.lt
Public webhook URL: https://whatsflow-yourname.loca.lt/webhook
```

Copy the webhook URL from the terminal output, then follow the Meta configuration steps below.

---

## Configure Meta Webhook

Perform these steps once after the tunnel is active and you have the webhook URL.

1. Go to [Meta Developer Console](https://developers.facebook.com/).
2. Select your app.
3. Navigate to **WhatsApp** → **Configuration**.
4. In the **Webhook** section:
   - **Callback URL:** paste your tunnel URL — it must end in `/webhook`
     ```
     https://whatsflow-yourname.loca.lt/webhook
     ```
   - **Verify Token:** copy the value from WhatsFlow Settings → WhatsApp API → Verify Token
5. Click **Verify and Save**.
6. Under **Webhook Fields**, enable: `messages`

Meta will call your tunnel URL immediately to verify it. The verification passes as long as
the tunnel is active and the Verify Token matches.

---

## About URL Stability

### Using the Subdomain input (recommended)

Type your preferred subdomain directly in the **Tunnel Subdomain** field inside
**Settings → WhatsApp API → Webhook Configuration**. The value is saved to the database
automatically and pre-filled the next time you open the Settings page — no `.env` file or
server restart needed.

If you prefer the environment variable approach (e.g. for automated deployments), you can
still set `TUNNEL_SUBDOMAIN` in `.env`:

```
TUNNEL_SUBDOMAIN=yourname-whatsflow
```

The subdomain priority is: **UI input → database → `TUNNEL_SUBDOMAIN` env var → random**.

This means the URL `https://yourname-whatsflow.loca.lt/webhook` will be the same every time
you start the tunnel, so you only need to configure Meta once.

### Important caveat — subdomains are not permanently reserved

LocalTunnel subdomains are **first-come, first-served**. The subdomain is not owned by you
between sessions. If another user requests the same subdomain while your tunnel is closed,
your next start attempt will either receive a different URL or fail with a "subdomain in use"
error.

In practice, a distinctive subdomain (e.g., `acme-corp-whatsflow`) is unlikely to be claimed
by others, but it is not guaranteed. If the URL changes, update the Callback URL in Meta and
re-verify.

Without `TUNNEL_SUBDOMAIN`, LocalTunnel assigns a random subdomain on every start — you
would need to update Meta each time.

### Choosing a subdomain

Rules:
- Lowercase letters, numbers, and hyphens only
- No spaces or special characters
- Should be distinctive to reduce collision risk

Examples:
- `acme-whatsflow` → `https://acme-whatsflow.loca.lt/webhook`
- `johnsmith-wa` → `https://johnsmith-wa.loca.lt/webhook`

---

## Troubleshooting

### "Subdomain already taken"

**Error:** Tunnel starts but the status card shows an error, or the terminal shows
`Subdomain is already in use`.

**Solution:** Type a different name in the **Tunnel Subdomain** field in
Settings → WhatsApp API → Webhook Configuration (e.g. `yourname-whatsflow-2`),
then click **Start Tunnel** again. The new subdomain is saved automatically.

---

### "Tunnel closes immediately"

**Symptoms:** Status card briefly shows "Connecting" then returns to "Not Running".

**Solutions:**
1. Check that port 3000 is not blocked by a firewall.
2. Verify the backend is running — check the sidebar status indicator.
3. Try stopping and restarting the tunnel from the Settings UI.
4. Check `backend/logs/combined.log` for more detail.

---

### "Webhook verification failed in Meta"

**Symptoms:** Meta shows "Failed to verify webhook" after clicking Verify and Save.

**Diagnosis steps:**

1. Confirm the tunnel is **Active** in Settings → WhatsApp API → Webhook Configuration.
2. Confirm the Verify Token in Settings matches exactly what you entered in Meta.
3. Test the endpoint manually:
   ```powershell
   curl "https://whatsflow-yourname.loca.lt/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
   ```
   The response should be: `test123`
4. Check backend logs for `info: Webhook verified`.

---

### Slow or delayed webhook events

**Cause:** LocalTunnel routes through a shared relay server; latency is typically 1-5 seconds
but can be higher during peak usage.

**Options:**
1. Accept the delay — events still arrive and statuses update correctly.
2. Switch to [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (free, generally faster).
3. Use [ngrok](https://ngrok.com/) ($8/month for a stable reserved subdomain and better latency).

---

## FAQ

**Q: Do I still need to run `npm run start:tunnel` to use webhooks?**
A: No. You can start and stop the tunnel directly from Settings → WhatsApp API → Webhook
Configuration. The command-line option remains available as an alternative.

**Q: Does the URL change every time I restart the tunnel?**
A: It depends on whether you have a subdomain set. If you typed a name in the
**Tunnel Subdomain** field (or set `TUNNEL_SUBDOMAIN` in `.env`), the same subdomain is
requested on every start and the URL stays consistent. Without any subdomain, a random one
is assigned each time. Either way, subdomains are not permanently reserved — see
"About URL Stability" above.

**Q: What if someone else claims my subdomain while my tunnel is off?**
A: You will receive a different URL on the next start. Update the Callback URL in Meta and
re-verify. Using a distinctive subdomain name minimizes this risk.

**Q: Can I use a custom domain (e.g., whatsapp.mydomain.com)?**
A: Not with LocalTunnel. Use ngrok ($8/month) or Cloudflare Tunnel (free) if you need a
custom domain.

**Q: Does this expose my entire PC to the internet?**
A: No. Only port 3000 (the WhatsFlow backend) is tunnelled. Nothing else on your machine is
accessible through the tunnel.

**Q: Is this secure?**
A: Yes. LocalTunnel uses HTTPS. WhatsFlow validates all incoming webhook payloads using
HMAC-SHA256 (computed against the raw request body) before processing them.

**Q: Can I use this for a real business?**
A: Yes. LocalTunnel is reliable enough for small-to-medium volumes. For enterprise use or
high-reliability requirements, consider deploying WhatsFlow to a cloud server with a fixed IP
and a proper domain.

---

**For more help, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
