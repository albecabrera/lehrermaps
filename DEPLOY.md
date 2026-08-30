# Deploy-Checkliste — LehrerMaps als PWA

Reihenfolge zum Livegang auf deinem Server. **Kritisch für PWA: HTTPS** — ohne
gültiges Zertifikat registriert der Browser den Service Worker nicht, die App
ist dann weder installierbar noch offline-fähig.

## 1. Code auf den Server
```bash
git clone https://github.com/albecabrera/lehrermaps.git /var/www/lehrermaps
cd /var/www/lehrermaps
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
- `APP_PASSWORD` (teacher workspace)
- `SQLITE_PATH=./data/lehrermaps.sqlite` (opcional), `PORT=3001`
- `BIND_HOST=127.0.0.1` for a host reverse proxy (`0.0.0.0` only inside an isolated container network)
- `ALLOWED_ORIGIN=https://DEIN-DOMAIN.de`

SQLite se crea automáticamente al iniciar, sin servidor, credenciales ni permisos
adicionales. Los directorios de datos y uploads deben ser escribibles:
`mkdir -p server/data server/uploads && chmod 775 server/data server/uploads`.

Para un despliegue con Docker, SQLite se persiste automáticamente en un volumen:

```bash
docker compose --profile standalone -f docker-compose.backend.yml up -d --build
```

## 3. Proceso persistente (systemd)
```bash
install -d -o www-data -g www-data -m 775 server/data server/uploads server/previews server/edit-copies
cp deploy/lehrermaps.service /etc/systemd/system/lehrermaps.service
systemctl daemon-reload
systemctl enable --now lehrermaps
systemctl status lehrermaps
```
El servicio solo escucha en `127.0.0.1:3001` mediante el proxy. En producción,
`NODE_ENV=production` y `ENABLE_TERMINAL=false` son obligatorios: el backend se
niega a arrancar sin secretos y no publica `/ws`, terminal ni apertura local de apps.

## 4. Nginx + HTTPS  ← der PWA-Gate
```bash
cp /var/www/lehrermaps/lehrermaps/deploy/nginx.conf /etc/nginx/sites-available/lehrermaps
# Ajustar dominio y ruta. Para este hosting: lehrermaps.albertocabrera.de.
ln -s /etc/nginx/sites-available/lehrermaps /etc/nginx/sites-enabled/
apt install certbot python3-certbot-nginx
certbot --nginx -d DEIN-DOMAIN.de -d www.DEIN-DOMAIN.de   # holt + verdrahtet TLS
nginx -t && systemctl reload nginx
```

## 5. Abnahme (PWA wirklich aktiv?)
Auf `https://DEIN-DOMAIN.de`:
- `LEHRERMAPS_URL=https://DEIN-DOMAIN.de npm run test:pwa` — statische PWA- und API-Audit-Prüfung.
- Chrome DevTools → **Application → Manifest**: „Installable", Icons + maskable da.
- **Application → Service Workers**: „activated and running".
- **Lighthouse → PWA**: grün.
- iPhone (Safari): Teilen → „Zum Home-Bildschirm" → startet ohne Browser-Leiste,
  Bottom-Nav sitzt in der Safe-Area.
- Offline-Probe: einmal online laden, dann Flugmodus + neu laden → App-Shell lädt.

## Updates ausrollen
```bash
git pull
cd client && npm ci && npm run build
# Build first, then atomically sync static assets before restarting the API.
test -f dist/index.html && test -f dist/service-worker.js
rsync -a --delete --delay-updates dist/ /var/www/lehrermaps/client/dist/
systemctl restart lehrermaps  # solo si cambió el backend
```
Never restart before the static sync completes: mixed HTML/hashed assets cause a
temporary broken application shell. Plan ZIP imports additionally require the
system `unzip` executable. Run `npm run storage:reconcile --prefix server` first
in dry-run mode before any storage cleanup; normal orphan blobs are never deleted.
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
