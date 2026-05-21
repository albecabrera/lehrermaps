# LehrerMaps

Unterrichtsmaterial-Verwaltung für Lehrer — verwalte Dateien, Links, Notizen und Stundenplan nach Fächern.

**Stack:** React 18 + Vite · Node.js ESM + Express · MariaDB/MySQL · JWT · PWA

---

## Inhaltsverzeichnis

- [Features](#features)
- [Stack](#stack)
- [Voraussetzungen](#voraussetzungen)
- [Setup](#setup)
- [Entwicklung](#entwicklung)
- [Architektur](#architektur)
- [Projektstruktur](#projektstruktur)
- [API-Endpunkte](#api-endpunkte)
- [Datenbankschema](#datenbankschema)
- [Tastaturkürzel](#tastaturkürzel)
- [Fächer & Akzentfarben](#fächer--akzentfarben)
- [i18n](#i18n)
- [Deployment](#deployment)
- [Sicherheitshinweise](#sicherheitshinweise)

---

## Features

### Datei-Management

- **Upload** per Drag & Drop direkt in die Dateiliste oder per Modal (Mehrfachauswahl, Ordner-Upload)
- **Abbruch-Unterstützung** — Upload kann während des Hochladens abgebrochen werden (AbortController)
- **Bulk-Aktionen** — mehrere Dateien gleichzeitig herunterladen, teilen, Freigabe entfernen, verschieben oder löschen
- **Undo-Fenster bei Löschen** — 5 Sekunden Rückgängig-Möglichkeit nach dem Löschen
- **Drag & Drop zum Verschieben** — Dateien per Drag in einen anderen Ordner in der Sidebar bewegen
- **Sortierung** — nach Name, Datum oder Größe (auf- und absteigend)
- **Typfilter-Chips** — schnell nach PDF / Bild / Dokument / Video / Audio filtern
- **Galerie-Ansicht** — Bildordner als visuelles Grid statt Liste
- **Öffentliche Links** — Dateien per öffentlichem Token ohne Login teilen (`/api/files/public/:token`)
- **Schüler-Freigabe** — Dateien gezielt für die Schüler-Ansicht freischalten
- **Deadlines** — Frist auf Ordner- und Dateiebene (wird in Schüler-Ansicht angezeigt)
- **ZIP-Download** — alle Dateien eines Ordners als ZIP herunterladen
- **Umbenennen per Doppelklick** — Dateinamen direkt durch Doppelklick auf die Karte umbenennen
- **Vorschau** mit Inline-Viewer für PDF, Bilder, Video, Audio, Text, Markdown und Office-Dokumente

### Ordner-Management

- Ordner nach Fach und Gruppe strukturiert
- **Drag & Drop Sortierung** der Ordner in der Sidebar
- **Favoriten** — Ordner als Favorit markieren (erscheinen oben in der Sidebar)
- **Ordnerfarben** — individuelle Akzentfarbe pro Ordner
- **Thumbnail** — erstes Bild im Ordner erscheint automatisch als Cover-Vorschau auf der Startseite
- **Unterordner** — verschachtelte Ordnerstruktur
- Zuletzt geöffnete Ordner in der Sidebar (max. 5)

### Notizen-Editor

- **Rich-Text-Editor** (contentEditable) mit Toolbar:
  - Fett, Kursiv, Unterstrichen, Durchgestrichen, Inline-Code
  - Textfarbe (7 Farben) und Textmarkierung (6 Farben)
  - Aufzählungs- und nummerierte Listen
  - Link einfügen (⌘K)
  - Weiteres per `···`-Overflow: Ausrichtung, Einrücken, Checkbox, Trennlinie, Format entfernen, Drucken
- **Inline-Markdown** — `**text**`, `*text*`, `` `code` `` etc. werden beim Tippen konvertiert
- **Block-Markdown** — `#↩`, `-↩`, `>↩`, `---↩` für Überschriften, Listen, Zitat, Trennlinie
- **Auto-Save** mit 1,5 s Debounce; zeigt „vor N Sek. gespeichert" nach dem Speichern
- **Drucken** mit sauberem Print-Layout

### Links & QR

- Links mit Titel + URL pro Ordner speichern
- **QR-Modal** — QR-Code für den Schüler-Zugang generieren und als Bild oder Link teilen

### Stundenplan

- Wochenplan-Ansicht mit Stunden und Wochentagen
- Ordner an Stunden verknüpfen und direkt öffnen
- Export als `.ics` (für Kalender-Apps)
- Filteransicht nach Fach

### Globale Suche

- Dateien, Ordner und Notiztexte durchsuchen (`⌘K`)
- Zeigt Treffer-Kontext aus Notizen
- Klick navigiert direkt zur Datei / zum Ordner

### Schüler-Ansicht

- Separater Login mit eigenem Passwort (`STUDENT_PASSWORD` in `.env`)
- Zeigt nur freigegebene Dateien je Fach
- Suchleiste mit Live-Dateianzahl
- Vorschau-Panel für ausgewählte Dateien
- Dark Mode + Logout

### UX & Zuverlässigkeit

- **Dark Mode** (System-Erkennung + manuell umschaltbar)
- **Skeleton-Loader** beim Laden von Ordnern und Dateien
- **Toast-Benachrichtigungen** für alle Aktionen (Upload, Löschen, Verschieben, Deadline)
- **Zuletzt geöffnete Dateien** in der Sidebar (max. 6, per localStorage)
- **Tastaturnavigation** — `j`/`k` oder Pfeiltasten durch Dateiliste, `Delete` löscht, `?` öffnet Hilfe
- PWA-fähig (App-Shell, Service Worker, `manifest.json`)
- Resizeable Sidebar und Vorschau-Panel

---

## Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | React 18 + Vite |
| Backend | Node.js 18 ESM + Express |
| Datenbank | MariaDB / MySQL |
| Auth | JWT (Single-User 30 d, Student-Rolle) |
| Dateispeicher | Lokales Filesystem (`server/uploads/`) |
| i18n | Eigenes `useLang`-Hook (DE/ES) |
| Deployment | Build → SFTP → Hostinger, PM2 |

---

## Voraussetzungen

- Node.js 18+
- MariaDB oder MySQL (lokal oder Docker)
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

# Option B — Docker (z. B. XAMPP-Container)
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
JWT_SECRET=<mindestens_32_zufaellige_zeichen>
APP_PASSWORD=<sicheres_lehrer_passwort>
STUDENT_PASSWORD=<sicheres_schueler_passwort>
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
```

> `JWT_SECRET`, `APP_PASSWORD` und `STUDENT_PASSWORD` **vor dem Deployment** ändern.

---

## Entwicklung

Zwei Terminals parallel:

```bash
# Terminal 1 — Backend
cd server && node index.js

# Terminal 2 — Frontend
cd client && npm run dev
```

App öffnet sich auf `http://localhost:5173`.

| Rolle | URL | Passwort |
|-------|-----|---------|
| Lehrer | `http://localhost:5173` | `APP_PASSWORD` aus `.env` |
| Schüler | `http://localhost:5173/?student` | `STUDENT_PASSWORD` aus `.env` |

---

## Architektur

```
Browser
  │
  ├─ Vite Dev Server (:5173)   ←→   client/src/
  │     └─ /api/* → Proxy      →    Express (:3001)
  │                                   ├─ auth.js       JWT-Login
  │                                   ├─ folders.js    CRUD + Notizen + Farbe + Deadline
  │                                   ├─ files.js      Upload + Download + Share + Public
  │                                   ├─ links.js      Links pro Ordner
  │                                   └─ schedule.js   Stundenplan
  │
  └─ MariaDB (:3306)
       ├─ folders
       ├─ files
       ├─ links
       └─ schedule
```

**Auth-Flow:**
1. `POST /api/login` → JWT mit `role: 'lehrer'` (30 d)
2. `POST /api/login-student` → JWT mit `role: 'student'` (30 d)
3. Alle anderen Endpunkte: `Authorization: Bearer <token>` → Middleware prüft und setzt `req.user`
4. Schüler-spezifische Endpunkte prüfen `req.user.role === 'lehrer'`

**Upload-Flow:**
1. `UploadModal` baut `FormData` + `AbortController`
2. `POST /api/files/upload` → Multer speichert unter UUID-Name in `uploads/`
3. DB-Eintrag mit `original_name`, `stored_name`, `mime_type`, `size_bytes`
4. Response → `useFiles` Hook aktualisiert lokalen State (kein Re-Fetch nötig)

---

## Projektstruktur

```
lehrermaps/
├── client/                        # React Frontend (Vite)
│   ├── public/
│   │   ├── manifest.json          # PWA-Manifest
│   │   ├── service-worker.js      # Offline-Fallback
│   │   └── icons/                 # icon-192.png, icon-512.png
│   └── src/
│       ├── components/
│       │   ├── AddLinkModal.jsx   # Link + QR-Code hinzufügen
│       │   ├── Breadcrumb.jsx     # Fach › Gruppe › Ordner
│       │   ├── BulkMoveModal.jsx  # Ordner-Auswahl für Bulk-Move
│       │   ├── ConfirmModal.jsx   # Bestätigungs-Dialog
│       │   ├── DeadlineModal.jsx  # Deadline-Datepicker
│       │   ├── ErrorBoundary.jsx  # React Error Boundary
│       │   ├── FileBadge.jsx      # Dateityp-Badge (Farbe + Kürzel)
│       │   ├── FilePreview.jsx    # Inline-Vorschau (PDF/Bild/Video/Text/…)
│       │   ├── FileTable.jsx      # Dateiliste mit Sortierung, Filter-Chips, Bulk
│       │   ├── FolderGallery.jsx  # Bildordner als visuelles Grid
│       │   ├── FolderIcon.jsx     # SVG-Ordner-Icon
│       │   ├── GlobalSearch.jsx   # ⌘K-Suchoverlay
│       │   ├── KeyboardHelp.jsx   # Tastaturkürzel-Modal (?)
│       │   ├── LinkPreview.jsx    # Link-Vorschau mit URL
│       │   ├── NewFolderModal.jsx # Neuer Ordner (Fach, Gruppe, Name)
│       │   ├── NotesEditor.jsx    # Rich-Text-Editor mit Toolbar + Auto-Save
│       │   ├── QRModal.jsx        # QR-Code-Generator für Schüler-Zugang
│       │   ├── RenameFolderModal.jsx
│       │   ├── Schedule.jsx       # Stundenplan-Komponente
│       │   ├── Sidebar.jsx        # Ordner-Baum, Favoriten, Zuletzt geöffnet
│       │   └── UploadModal.jsx    # Drag & Drop Upload mit Fortschrittsbalken
│       ├── constants/
│       │   ├── structure.js       # SUBJECTS, EXT_TO_KIND, detectKind, fileKindColor
│       │   └── translations.js    # DE/ES Texte (useLang-Hook)
│       ├── contexts/
│       │   ├── LangContext.jsx    # Sprache (DE/ES), t()-Funktion mit {{vars}}
│       │   └── ThemeContext.jsx   # Dark/Light Mode, CSS-Variablen
│       ├── hooks/
│       │   ├── useFiles.js        # CRUD Dateien + Share/Public/Deadline
│       │   ├── useFolders.js      # CRUD Ordner + Sortierung + Favoriten
│       │   ├── useLinks.js        # CRUD Links
│       │   ├── useRecentFiles.js  # Zuletzt geöffnete Dateien (localStorage)
│       │   └── useRecents.js      # Zuletzt geöffnete Ordner (localStorage)
│       ├── lib/
│       │   └── api.js             # Axios-Wrapper, Token-Handling
│       └── pages/
│           ├── App.jsx            # Lehrer-Hauptansicht
│           ├── Login.jsx          # Lehrer-Login
│           ├── StudentApp.jsx     # Schüler-Dateiansicht
│           └── StudentLogin.jsx   # Schüler-Login
├── server/
│   ├── middleware/
│   │   └── auth.js               # JWT-Prüfung → req.user
│   ├── routes/
│   │   ├── auth.js               # /login, /login-student
│   │   ├── files.js              # Upload, Download, Share, Public, Suche
│   │   ├── folders.js            # CRUD, Notizen, Farbe, Deadline, Reorder
│   │   ├── links.js              # Links pro Ordner
│   │   └── schedule.js           # Stundenplan GET/PUT
│   ├── uploads/                  # Hochgeladene Dateien (in .gitignore)
│   ├── db.js                     # MariaDB-Pool + initSchema() (Auto-Migrationen)
│   ├── index.js                  # Express-Server-Entry, CORS, Multer
│   └── env.txt                   # Vorlage für .env
├── schema.sql                    # Initiales DB-Schema
├── .gitignore
└── README.md
```

---

## API-Endpunkte

Alle Endpunkte außer Login und `/api/files/public/:token` erfordern `Authorization: Bearer <token>`.

### Auth

```
POST   /api/login                    { password }         → { token }
POST   /api/login-student            { password }         → { token }
```

### Ordner

```
GET    /api/folders                  → Alle Ordner mit file_count, total_size_bytes, thumbnail_file_id
POST   /api/folders                  { subject, group_name, name, parent_id? } → Ordner
PUT    /api/folders/reorder          { items: [{id, sort_order}] }
PUT    /api/folders/:id              { name }
PUT    /api/folders/:id/notes        { content }          (HTML-String)
PUT    /api/folders/:id/favorite     →  Favorit umschalten
PUT    /api/folders/:id/color        { color | null }
PUT    /api/folders/:id/deadline     { due_at | null }    (nur Lehrer)
DELETE /api/folders/:id              → Cascade auf Dateien
```

### Dateien

```
GET    /api/files/:folder_id         → Dateien im Ordner
POST   /api/files/upload             multipart: folder_id + file → Datei
GET    /api/files/view/:id           → Inline-Ansicht (Content-Disposition: inline)
GET    /api/files/preview/:id        → Vorschau (für PDFs, Bilder)
GET    /api/files/download/:id       → Datei-Stream (Content-Disposition: attachment)
GET    /api/files/open/:id           → Datei in System-App öffnen (Desktop)
GET    /api/files/zip/:folder_id     → ZIP aller Dateien im Ordner
GET    /api/files/zip-selected?ids=1,2,3
GET    /api/files/search?q=...       → Globale Suche (Dateien + Ordner + Notizen)
GET    /api/files/public/:token      → Öffentliche Datei ohne Login
PUT    /api/files/:id/share          → is_shared umschalten
PUT    /api/files/:id/public         → is_public + public_token umschalten
PUT    /api/files/:id/deadline       { due_at | null }
PUT    /api/files/:id                { original_name }    → Umbenennen
PUT    /api/files/:id/folder         { folder_id }        → Ordner wechseln
DELETE /api/files/:id
```

### Links

```
GET    /api/links/:folder_id         → Links im Ordner
POST   /api/links                    { folder_id, title, url } → Link
DELETE /api/links/:id
```

### Stundenplan

```
GET    /api/schedule                 → Aktueller Stundenplan (JSON)
PUT    /api/schedule                 { data } → Stundenplan speichern
```

---

## Datenbankschema

Die Tabellen werden von `server/db.js` per `initSchema()` beim Start automatisch angelegt. `schema.sql` enthält das vollständige initiale Schema.

```sql
CREATE TABLE folders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  subject     VARCHAR(50)  NOT NULL,         -- 'spanisch' | 'informatik' | 'sport' | 'klasse'
  group_name  VARCHAR(100) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  parent_id   INT NULL,
  sort_order  INT DEFAULT 0,
  notes       LONGTEXT DEFAULT NULL,         -- HTML-Inhalt des Notiz-Editors
  is_favorite TINYINT(1) DEFAULT 0,
  color       VARCHAR(20) NULL,              -- z. B. '#E8472A'
  due_at      DATETIME NULL,
  created_at  DATETIME DEFAULT NOW(),
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE files (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  folder_id     INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,       -- UUID-Dateiname auf Disk
  mime_type     VARCHAR(100),
  size_bytes    INT,
  is_shared     TINYINT(1) DEFAULT 0,        -- in Schüler-Ansicht sichtbar
  is_public     TINYINT(1) DEFAULT 0,        -- öffentlicher Link aktiv
  public_token  VARCHAR(64) NULL,            -- Token für /public/:token
  due_at        DATETIME NULL,
  uploaded_at   DATETIME DEFAULT NOW(),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE links (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  folder_id  INT NOT NULL,
  title      VARCHAR(255) NOT NULL,
  url        TEXT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE schedule (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  data       LONGTEXT NOT NULL,             -- JSON-Blob des Stundenplans
  updated_at DATETIME DEFAULT NOW()
);
```

> `db.js` führt beim Start automatisch `ALTER TABLE`-Migrationen aus, falls Spalten fehlen (idempotent).

---

## Tastaturkürzel

| Kürzel | Aktion |
|--------|--------|
| `⌘K` / `Ctrl+K` | Globale Suche öffnen |
| `j` / `↓` | Nächste Datei auswählen |
| `k` / `↑` | Vorherige Datei auswählen |
| `Space` | Vorschau umschalten |
| `Delete` | Aktive Datei löschen |
| `?` | Tastaturhilfe anzeigen |
| `⌘K` (im Notiz-Editor) | Link einfügen |
| `Ctrl+B/I/U` | Fett / Kursiv / Unterstrichen |
| `Ctrl+Z/Y` | Rückgängig / Wiederholen |

---

## Fächer & Akzentfarben

| Fach | ID | Farbe |
|------|----|-------|
| Spanisch | `spanisch` | `#E8472A` |
| Informatik | `informatik` | `#2563EB` |
| Sport | `sport` | `#16A34A` |
| Klassenleitung | `klasse` | `#9333EA` |

Neue Fächer: `client/src/constants/structure.js` → `SUBJECTS`-Array erweitern.

---

## i18n

Die App unterstützt **Deutsch (DE)** und **Spanisch (ES)**. Sprache per Klick auf `DE`/`ES` im Header umschaltbar.

- Texte: `client/src/constants/translations.js`
- Hook: `useLang()` → `t('schluessel')` oder `t('schluessel', { variable: wert })`
- Neue Sprache: weiteres Objekt im `translations`-Export hinzufügen und `LangContext` anpassen.

---

## Deployment

### Frontend

```bash
cd client && npm run build
# dist/ per SFTP auf Webroot hochladen
```

### Backend (Hostinger / VPS)

```bash
# Server starten mit PM2
cd server && pm2 start index.js --name lehrermaps --watch

# Neustart nach Änderungen
pm2 restart lehrermaps
```

### `.env` auf dem Server

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=lehrermaps
DB_PASS=<sicheres_datenbankpasswort>
DB_NAME=lehrermaps
JWT_SECRET=<mindestens_32_zufaellige_zeichen>
APP_PASSWORD=<sicheres_lehrer_passwort>
STUDENT_PASSWORD=<sicheres_schueler_passwort>
PORT=3001
ALLOWED_ORIGIN=https://deine-domain.de
```

### Nginx-Beispiel (Reverse Proxy)

```nginx
server {
    listen 443 ssl;
    server_name deine-domain.de;

    # Frontend (statische Dateien)
    root /var/www/lehrermaps/dist;
    index index.html;
    try_files $uri $uri/ /index.html;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        client_max_body_size 300m;
    }
}
```

> `server/uploads/` liegt außerhalb des Web-Roots oder wird per Nginx/`.htaccess` vor Direktzugriff geschützt.

---

## Sicherheitshinweise

- JWT-Token: 30 Tage Laufzeit, im `localStorage` gespeichert
- `JWT_SECRET` mindestens 32 Zeichen, kein Default übernehmen
- `APP_PASSWORD` und `STUDENT_PASSWORD` unterschiedlich wählen
- Uploads werden unter UUID-Namen gespeichert — kein direkter Zugriff über Original-Dateinamen
- Öffentliche Token (`public_token`) sind zufällige 32-Byte-Hex-Strings
- Schüler-Rolle hat keinen Schreibzugriff: Upload, Delete, Share-Toggle → 403

---

## Datei-Limits

| Parameter | Wert |
|-----------|------|
| Max. Dateigröße | 300 MB |
| Gleichzeitige Uploads | 1 (sequentiell) |
| Dateitypen | PDF, DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, TXT, MD, PNG, JPG, GIF, SVG, MP4, MP3, WAV, ZIP, PY, JS, TS, JSON, CSV, EPUB, H5P und weitere |

Erlaubte MIME-Typen und Erweiterungen: `client/src/constants/structure.js` → `EXT_TO_KIND`
