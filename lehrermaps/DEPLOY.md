# Deploy-Checkliste — LehrerMaps als PWA

Reihenfolge zum Livegang auf deinem Server. **Kritisch für PWA: HTTPS** — ohne
gültiges Zertifikat registriert der Browser den Service Worker nicht, die App
ist dann weder installierbar noch offline-fähig.

## 1. Code auf den Server
```bash
git clone https://github.com/albecabrera/lehrermaps.git /var/www/lehrermaps
cd /var/www/lehrermaps/lehrermaps
```
> `client/dist` ist bereits committet — kein Build auf dem Server nötig.
> (Alternativ selbst bauen: `cd client && npm ci && npm run build`.)

## 2. Backend
```bash
cd server
npm install --omit=dev
cp env.txt .env      # dann .env editieren — echte Werte:
```
`.env` — MUSS gesetzt/geändert sein:
- `JWT_SECRET` (≥32 zufällige Zeichen)
- `APP_PASSWORD` (Lehrer), `STUDENT_PASSWORD` (Schüler)
- `DB_*` (MySQL/MariaDB), `PORT=3001`
- `ALLOWED_ORIGIN=https://DEIN-DOMAIN.de`

MySQL/MariaDB muss laufen, DB `lehrermaps` existieren (Schema legt der Server
via `initSchema()` automatisch an). Upload-Ordner beschreibbar:
`mkdir -p server/uploads && chmod 775 server/uploads`.

## 3. Prozess dauerhaft (PM2)
```bash
npm i -g pm2
pm2 start index.js --name lehrermaps
pm2 save && pm2 startup   # Auto-Start nach Reboot
```

## 4. Nginx + HTTPS  ← der PWA-Gate
```bash
cp /var/www/lehrermaps/lehrermaps/deploy/nginx.conf /etc/nginx/sites-available/lehrermaps
# DEIN-DOMAIN.de + root-Pfad darin anpassen
ln -s /etc/nginx/sites-available/lehrermaps /etc/nginx/sites-enabled/
apt install certbot python3-certbot-nginx
certbot --nginx -d DEIN-DOMAIN.de -d www.DEIN-DOMAIN.de   # holt + verdrahtet TLS
nginx -t && systemctl reload nginx
```

## 5. Abnahme (PWA wirklich aktiv?)
Auf `https://DEIN-DOMAIN.de`:
- Chrome DevTools → **Application → Manifest**: „Installable", Icons + maskable da.
- **Application → Service Workers**: „activated and running".
- **Lighthouse → PWA**: grün.
- iPhone (Safari): Teilen → „Zum Home-Bildschirm" → startet ohne Browser-Leiste,
  Bottom-Nav sitzt in der Safe-Area.
- Offline-Probe: einmal online laden, dann Flugmodus + neu laden → App-Shell lädt.

## Updates ausrollen
```bash
git pull
# falls selbst gebaut: cd client && npm run build
pm2 restart lehrermaps        # nur bei Backend-Änderungen nötig
```
Nginx cacht `service-worker.js`/`manifest.json`/`index.html` mit `no-cache`
(siehe deploy/nginx.conf) → neuer Build wird beim nächsten Laden aktiv, der
SW (stale-while-revalidate, `skipWaiting`/`clients.claim`) übernimmt automatisch.

## Häufige Stolpersteine
- **Kein Install-Prompt / SW fehlt** → Seite läuft über `http` statt `https`
  (oder Zertifikat ungültig). Secure Context ist Pflicht.
- **Login schlägt fehl (CORS)** → `ALLOWED_ORIGIN` in `.env` ≠ tatsächliche Domain.
- **Terminal verbindet nicht** → Socket-Pfad ist `/ws` (nicht `/socket.io`);
  die mitgelieferte nginx.conf proxied bereits korrekt.
- **Alter Build klebt fest** → fehlende `no-cache`-Header auf `service-worker.js`;
  die mitgelieferte nginx.conf setzt sie.
