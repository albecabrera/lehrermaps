# LehrerMaps

Unterrichtsmaterial-Verwaltung für Lehrer in NRW.
React + Vite + TailwindCSS · Node.js + Express · MariaDB/MySQL · JWT · PWA

---

## Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js ESM + Express |
| Datenbank | MariaDB / MySQL |
| Auth | JWT (Single-User, 30 Tage) |
| Dateispeicher | Lokales Filesystem (`server/uploads/`) |
| Deployment | SFTP → Hostinger, PM2 |

---

## Voraussetzungen

- Node.js 18+
- MariaDB / MySQL (lokal oder Docker)
- npm

---

## Setup

### 1. Dependencies installieren

```bash
cd lehrermaps
npm install --prefix client
npm install --prefix server
```

### 2. Datenbank erstellen

```bash
# Option A — lokale MariaDB/MySQL
mysql -u root -p < schema.sql

# Option B — Docker (XAMPP wie lokal eingerichtet)
docker exec -i xampp-mariadb mysql -u root < schema.sql
```

### 3. `.env` anlegen

```bash
cp server/env.txt server/.env
```

Dann `server/.env` anpassen:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=lehrermaps
JWT_SECRET=cadena_aleatoria_mindestens_32_zeichen
APP_PASSWORD=dein_sicheres_passwort
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
```

> **Wichtig:** `JWT_SECRET` und `APP_PASSWORD` vor dem Deployment ändern.

---

## Entwicklung

Zwei Terminals:

```bash
# Terminal 1 — Backend
cd server && node index.js

# Terminal 2 — Frontend
cd client && npm run dev
```

App öffnet sich auf `http://localhost:5173`.

**Login-Passwort:** Wert aus `APP_PASSWORD` in `.env` (Standard: `lehrer123`)

---

## Lokale Umgebung (getestet)

- MariaDB 10.4 via Docker (`xampp-mariadb`) auf Port `3306`
- Kein Passwort für `root` (`MYSQL_ALLOW_EMPTY_PASSWORD=yes`)
- Backend Port: `3001`
- Frontend Port: `5173` (Vite Proxy → `/api` → `3001`)

---

## API-Endpunkte

Alle Endpunkte außer Login erfordern `Authorization: Bearer <token>`.

```
POST   /api/login                    { password } → { token }

GET    /api/folders                  → Alle Ordner (mit file_count)
POST   /api/folders                  { subject, group_name, name } → Ordner
DELETE /api/folders/:id

GET    /api/files/:folder_id         → Dateien in Ordner
POST   /api/files/upload             multipart: folder_id + file → Datei
GET    /api/files/download/:id       → Datei-Stream
DELETE /api/files/:id
```

---

## Datenbankschema

```sql
CREATE TABLE folders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  subject     VARCHAR(50)  NOT NULL,   -- 'spanisch' | 'informatik' | 'sport' | 'klasse'
  group_name  VARCHAR(100) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  DATETIME DEFAULT NOW()
);

CREATE TABLE files (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  folder_id     INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,  -- UUID-Dateiname auf Disk
  mime_type     VARCHAR(100),
  size_bytes    INT,
  uploaded_at   DATETIME DEFAULT NOW(),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
```

---

## Fächer & Akzentfarben

| Fach | ID | Farbe |
|------|----|-------|
| Spanisch | `spanisch` | `#E8472A` |
| Informatik | `informatik` | `#2563EB` |
| Sport | `sport` | `#16A34A` |
| Klassenleitung | `klasse` | `#9333EA` |

---

## Deployment (Hostinger)

```bash
# 1. Frontend bauen
cd client && npm run build
# → dist/ per SFTP auf Hostinger hochladen

# 2. Server starten mit PM2
cd server && pm2 start index.js --name lehrermaps

# 3. .env auf Server anpassen
ALLOWED_ORIGIN=https://deine-domain.de
```

> `server/uploads/` außerhalb des Web-Roots ablegen oder mit `.htaccess` schützen.

---

## Datei-Limits

- Max. **50 MB** pro Datei
- Erlaubt: PDF, DOCX, PPTX, XLSX, ODT, ODS, HTML, TXT, MD, Bilder, MP4, MP3, ZIP, Python, JSON, u. v. m.

---

## Projektstruktur

```
lehrermaps/
├── client/                  # React Frontend (Vite)
│   ├── public/
│   │   ├── manifest.json    # PWA
│   │   └── icons/           # icon-192.png, icon-512.png
│   └── src/
│       ├── components/      # FileBadge, FileTable, FilePreview, Sidebar, ...
│       ├── constants/       # structure.js — Fächer, Farben, MIME-Typen
│       ├── hooks/           # useFiles.js, useFolders.js
│       ├── lib/             # api.js — Axios-Wrapper
│       └── pages/           # Login.jsx, App.jsx
├── server/                  # Node.js Backend
│   ├── routes/              # auth.js, folders.js, files.js
│   ├── middleware/          # auth.js — JWT-Prüfung
│   ├── uploads/             # Hochgeladene Dateien (gitignore)
│   ├── db.js                # MariaDB Pool + initSchema()
│   ├── index.js             # Server-Entry
│   └── env.txt              # Vorlage → kopieren als .env
├── schema.sql               # DB-Setup
├── .gitignore
└── README.md
```
