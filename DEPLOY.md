# Deploying to your own VPS

**Architecture:** Supabase (Mumbai) holds data, auth, and file storage.
Your VPS runs only the Next.js app. Cloudflare sits in front of the VPS.

Do `SETUP.md` first — Supabase, env vars, migrations. This file is only
the server part.

---

## 0. Region — get this right first

Create the Supabase project in **South Asia (Mumbai)** (`ap-south-1`),
in the same country as the VPS. The region cannot be changed later.

A page render makes several *sequential* Supabase queries. They do not
run in parallel, so distance multiplies:

| App ↔ database | Per query | ~6 queries |
|---|---|---|
| Both in India | ~2 ms | ~12 ms |
| India → Frankfurt | ~110 ms | **~660 ms** |

Distance between app and database matters far more than distance between
visitor and app, because the visitor pays one round trip and Cloudflare
caches the static half.

Global visitors are handled by Cloudflare's edge, not by where you put
the origin. Serving worldwide from Mumbai is fine.

---

## 1. The box

**4 GB RAM is the floor.** `next build` runs out of memory on 2 GB and
the failure looks like an unexplained `Killed` mid-build with no error.
2 vCPU is plenty. 40 GB disk is plenty.

If it is your own hardware at home, also read §7.

**Before paying, read the provider's AUP** — search it for "adult",
"pornographic", "sexually explicit". You want it *permitted*, not merely
unmentioned. Termination after launch, with your data on their disks, is
the worst available outcome.

---

## 2. Base server

SSH in as root:

```bash
adduser sweetscene
usermod -aG sudo sweetscene
rsync --archive --chown=sweetscene:sweetscene ~/.ssh /home/sweetscene/
```

`/etc/ssh/sshd_config`:

```
PermitRootLogin no
PasswordAuthentication no
```

```bash
systemctl restart ssh
```

Firewall. Note there is **no rule for 80, 443, or 3000** — with
Cloudflare Tunnel nothing inbound is needed at all. That is the single
biggest security win of this design: there is no open port to attack.

```bash
ufw allow OpenSSH && ufw enable
```

```bash
apt update && apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 3. Node

Node 20+. Use nodesource — Debian and Ubuntu ship a Node too old for
Next.js 16.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs && node -v
```

---

## 4. Code and env

As `sweetscene`:

```bash
cd ~ && git clone <your-repo-url> sweetscene && cd sweetscene
npm ci
```

Create `.env.local` **on the server**. Do not copy your local one — it
holds the development encryption key.

```bash
openssl rand -hex 32     # production MESSAGE_ENCRYPTION_KEY
nano .env.local
```

Fill from `.env.example`. Two values differ from local:

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
MESSAGE_ENCRYPTION_KEY=<the new one>
```

`NEXT_PUBLIC_SITE_URL` is baked into the client bundle at build time —
changing it later needs a rebuild, not a restart.

```bash
chmod 600 .env.local
npm run build
```

---

## 5. systemd

`/etc/systemd/system/sweetscene.service`:

```ini
[Unit]
Description=sweetscene
After=network.target

[Service]
Type=simple
User=sweetscene
WorkingDirectory=/home/sweetscene/sweetscene
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/sweetscene/sweetscene/.next

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now sweetscene
journalctl -u sweetscene -f
```

`HOSTNAME=127.0.0.1` binds to loopback. Combined with the firewall, port
3000 is unreachable from outside by two independent mechanisms.

---

## 6. Cloudflare Tunnel

This replaces TLS certificates, port forwarding, dynamic DNS, and a
reverse proxy — all of it. `cloudflared` makes an **outbound** connection
to Cloudflare, so it works behind CGNAT, on a dynamic IP, and with ports
80/443 filtered by your ISP. It also hides the origin address.

**This is not optional, for a security reason.** The rate limiter reads
`CF-Connecting-IP`, which only Cloudflare can set. Exposed directly, the
fallback is `X-Forwarded-For` — which a client can forge, minting a fresh
rate-limit bucket per request and making the limiter decorative. Login
brute-force protection and message flood limits both depend on this.

1. Add your domain to Cloudflare, switch nameservers at the registrar.
2. On the server:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login
cloudflared tunnel create sweetscene
cloudflared tunnel route dns sweetscene your-domain.com
```

`/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL-ID from the create command>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

In the Cloudflare dashboard:

- **SSL/TLS → Full (strict)**. Not Flexible — Flexible sends plain HTTP
  on the last hop and the padlock becomes decorative.
- **WAF**: if you enable it, allowlist `/api/nowpayments/webhook`. A
  blocked IPN means payment taken and tokens never credited.
- Do **not** add security headers at Cloudflare. CSP and HSTS are set in
  `proxy.ts` so dev and prod match. Set in two places, they drift — and
  the one that drifts is the one you forget to check.

---

## 7. If the box is at home

Everything above still applies. These are additional.

**Isolate it.** This machine is internet-reachable and hosts an adult
platform. Put it on a separate VLAN or guest network so a compromise
cannot reach your personal devices, NAS, or router admin. Do not run it
on your daily-driver desktop.

**Power and internet.** A consumer connection has no uptime guarantee. A
UPS covers brief cuts; nothing covers a day-long outage. Decide now
whether that is acceptable, because it will happen.

**Upload bandwidth is what serving is.** 30/3 Mbps means 3 Mbps of
capacity. Cloudflare caching absorbs static assets; every AI reply and
page render still crosses your uplink.

**Check your ISP's terms.** Most Indian residential plans prohibit
running servers. A tunnel makes this invisible in practice, but it is
still a contract you are operating against, and the remedy is
disconnection.

**Backups leave the building.** A backup on the machine you are backing
up is not a backup. Neither is one in the same room.

---

## 8. Deploying an update

```bash
cd ~/sweetscene && git pull && npm ci && npm run build
sudo systemctl restart sweetscene
```

A few seconds of downtime. Fine at this stage. When it stops being fine,
run two instances on different ports and restart them one at a time.

---

## 9. Backups

Supabase free tier has **no** point-in-time recovery and pauses a project
after 7 days idle. Before real users, either move to a paid plan or take
your own:

```bash
pg_dump "$SUPABASE_DB_URL" | gzip > backup-$(date +%F).sql.gz
```

Store them off the server, ideally off-site. Restore one at least once —
an untested backup is a hope, not a backup.

---

## 10. Go-live checklist

Infrastructure:

- [ ] `curl http://<server-ip>:3000` from elsewhere — must fail
- [ ] `https://your-domain.com` serves a valid certificate
- [ ] `curl -I https://your-domain.com` shows CSP and HSTS
- [ ] `curl -sI https://your-domain.com | grep -i cf-ray` returns a value
      (confirms traffic is really going through Cloudflare — if it is not,
      the rate limiter is not protecting anything)
- [ ] `sudo systemctl restart sweetscene` — comes back unattended
- [ ] Reboot the server — both `sweetscene` and `cloudflared` return on their own

Application — `SETUP.md` §5, plus:

- [ ] All seven SQL migration blocks applied (`SETUP.md` header table)
- [ ] `MODERATION_PROVIDER=openai` with a key set
- [ ] `MESSAGE_ENCRYPTION_KEY` is **not** the dev value
- [ ] Upstash configured — without it rate limiting is per-process memory
- [ ] Supabase Auth redirect URLs list the production callback
- [ ] NOWPayments IPN points at the production webhook; send the same
      payload twice and confirm it credits once
