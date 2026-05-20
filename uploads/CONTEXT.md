# LehrerMaps – Kontext & Spezifikation

Dieses Dokument dient als vollständige Referenz für Claude Code (oder jede andere Claude-Instanz) um die **LehrerMaps**-App weiterzuentwickeln. Lies dieses Dokument vollständig bevor du Code schreibst.

---

## 1. Projektübersicht

**LehrerMaps** ist eine Unterrichtsmaterial-Verwaltungsapp für einen Lehrer in NRW (Bonn), der die Fächer **Spanisch**, **Informatik** und **Sport** sowie eine **Klassenleitung** betreut.

### Kernziele
- Unterrichtsmaterialien strukturiert speichern, finden und verwalten
- Multiplattform: Desktop, Tablet, Mobil (PWA)
- Eigenes Hosting auf Hostinger
- Keine externe KI-API – keine laufenden Zusatzkosten
- Claude Code-freundlicher Stack: gut lesbar, modular, erweiterbar

---

## 2. Tech Stack

| Schicht | Technologie | Begründung |
|---|---|---|
| Frontend | React (Vite) | Multiplattform, PWA-fähig, Claude Code kennt es gut |
| Styling | TailwindCSS | Utility-first, schnell anpassbar |
| Backend | Node.js + Express | Einfach, auf Hostinger lauffähig |
| Datenbank | MySQL | Hostinger-Standard, günstig |
| Dateispeicher | Lokales Filesystem / Hostinger | Keine Cloud-Abhängigkeit |
| Auth | JWT (einfach, single-user) | Lehrer-App = 1 Nutzer |
| Deployment | SFTP → Hostinger | Bestehender Workflow des Nutzers |

---

## 3. Ordnerstruktur der App (Fächer & Ordner)

```
Spanisch  (Akzentfarbe: #E8472A)
├── Klasse 9
│   ├── Vokabeltests
│   ├── Arbeitsblätter
│   ├── Hörverstehen
│   └── Noten
├── Klasse 12
│   ├── Abiturvorb.
│   ├── Literatur
│   ├── Mündliche Prüfung
│   └── Noten
└── Gemeinsame Ressourcen
    ├── Grammatik-Tabellen
    ├── Medien
    └── Spiele

Informatik  (Akzentfarbe: #2563EB)
├── WP Klasse 6–7
│   ├── Scratch
│   ├── HTML Basics
│   ├── Arbeitsblätter
│   └── Roblox
├── WP Klasse 8–10
│   ├── Python
│   ├── Datenbanken
│   ├── Netzwerke
│   └── Projekte
└── Projekte & Tools
    ├── Schüler-Repos
    ├── Vorlagen
    └── Links

Sport  (Akzentfarbe: #16A34A)
├── Theorie
│   ├── Regelkunde
│   ├── Sportbiologie
│   └── Klausuren
├── Praxis / Stunden
│   ├── Stundenplanungen
│   ├── Materialien
│   └── Bewertung
└── Q2 Tanz
    ├── Choreografien
    ├── Selbsteinschätzung
    └── Videos

Klassenleitung  (Akzentfarbe: #9333EA)
├── Formulare
│   ├── Entschuldigungen
│   ├── Ausflüge
│   └── Datenschutz
├── Elternkommunikation
│   ├── Briefe
│   ├── Protokolle
│   └── Kontaktliste
└── Dokumentation
    ├── Notizen
    ├── Vorfälle
    └── Jahresplanung
```

---

## 4. Features (Priorisiert)

### Phase 1 – MVP (jetzt bauen)
- [ ] Ordner-Navigation (3 Ebenen: Fach → Gruppe → Unterordner)
- [ ] Dateien hochladen (PDF, DOCX, HTML, Bilder, Videos)
- [ ] Dateien anzeigen / herunterladen / löschen
- [ ] Volltext-Suche über Dateinamen
- [ ] Login (einfaches JWT, single-user)
- [ ] PWA-Manifest (offline-fähig)

### Phase 2 – Erweiterungen
- [ ] Vorschau: PDF inline, DOCX als Text, Bilder direkt
- [ ] Favoriten / Zuletzt geöffnet
- [ ] Drag & Drop Upload
- [ ] Ordner umbenennen / löschen
- [ ] Tags pro Datei
- [ ] Notizen direkt in der App erstellen (Markdown-Editor)

### Phase 3 – Nice to have
- [ ] Volltextsuche im Inhalt von Dokumenten
- [ ] Erinnerungen / Terminverknüpfung
- [ ] Export-Funktion (ZIP eines Ordners)

---

## 5. Design-System

### Farben
```css
--color-bg:       #F8F9FB;
--color-surface:  #FFFFFF;
--color-border:   #E5E7EB;
--color-text:     #111827;
--color-muted:    #6B7280;
--color-subtle:   #9CA3AF;

/* Fach-Akzentfarben (dynamisch je nach aktivem Fach) */
--accent-spanisch:     #E8472A;
--accent-informatik:   #2563EB;
--accent-sport:        #16A34A;
--accent-klassenltg:   #9333EA;
```

### Typografie
- Font: `DM Sans` (Google Fonts) – Display & UI
- Mono: `DM Mono` – Datei-Badges, Code
- Schriftgrößen: 11px (labels), 12px (meta), 13px (UI), 14px (body), 17px (h2), 22px (h1)

### Spacing
- Basis-Unit: 4px
- Container-Padding: 24px
- Card-Padding: 16px
- Border-Radius Cards: 10–12px
- Border-Radius Inputs: 7–8px

### Komponenten-Muster
- **Sidebar**: 220px, weiß, linker Border als aktiver Indikator
- **Header**: 56px, sticky, weiß, 1px border-bottom
- **Cards**: weiß, 1px border, hover → box-shadow
- **Buttons primär**: Akzentfarbe, weiß Text, 600 weight
- **Buttons sekundär**: #F3F4F6, #374151 Text
- **Modals**: Overlay rgba(0,0,0,0.4), Card 380px max, shadow-xl

---

## 6. Projektstruktur (Dateisystem)

```
lehrermaps/
├── client/                  # React Frontend (Vite)
│   ├── public/
│   │   ├── manifest.json    # PWA
│   │   └── icons/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── FolderGrid.jsx
│   │   │   ├── FileTable.jsx
│   │   │   ├── UploadModal.jsx
│   │   │   ├── NewFolderModal.jsx
│   │   │   └── Breadcrumb.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── App.jsx
│   │   ├── hooks/
│   │   │   ├── useFiles.js
│   │   │   └── useFolders.js
│   │   ├── lib/
│   │   │   └── api.js       # Axios-Wrapper für alle API-Calls
│   │   ├── constants/
│   │   │   └── structure.js # Fächer-Struktur (aus Abschnitt 3)
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                  # Node.js + Express Backend
│   ├── routes/
│   │   ├── auth.js          # POST /api/login
│   │   ├── folders.js       # GET/POST/DELETE /api/folders
│   │   └── files.js         # GET/POST/DELETE /api/files
│   ├── middleware/
│   │   └── auth.js          # JWT-Prüfung
│   ├── uploads/             # Hochgeladene Dateien (gitignore)
│   ├── db.js                # MySQL-Verbindung
│   └── index.js             # Server-Entry
│
├── .env.example             # DB_HOST, DB_USER, DB_PASS, JWT_SECRET
├── package.json
└── README.md
```

---

## 7. Datenbank-Schema (MySQL)

```sql
-- Fächer (fix, aus constants/structure.js)
-- Werden nicht in DB gespeichert, nur hardcoded

CREATE TABLE folders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  subject     VARCHAR(50)  NOT NULL,   -- 'Spanisch', 'Informatik', etc.
  group_name  VARCHAR(100) NOT NULL,   -- 'Klasse 9', 'WP Klasse 6–7', etc.
  name        VARCHAR(100) NOT NULL,   -- 'Vokabeltests', 'Python', etc.
  created_at  DATETIME DEFAULT NOW()
);

CREATE TABLE files (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  folder_id    INT NOT NULL REFERENCES folders(id),
  original_name VARCHAR(255) NOT NULL,
  stored_name  VARCHAR(255) NOT NULL,   -- UUID-basierter Dateiname
  mime_type    VARCHAR(100),
  size_bytes   INT,
  uploaded_at  DATETIME DEFAULT NOW()
);
```

---

## 8. API-Endpunkte

```
POST   /api/login              Body: { password }  → { token }

GET    /api/folders             → Liste aller Ordner
POST   /api/folders             Body: { subject, group_name, name }
DELETE /api/folders/:id

GET    /api/files/:folder_id    → Dateien in einem Ordner
POST   /api/files/upload        Multipart: folder_id + file
GET    /api/files/download/:id  → Datei-Stream
DELETE /api/files/:id
```

---

## 9. Prototyp-Referenz

Ein vollständiger React-Prototyp (single-file, ohne Backend) existiert bereits als:
`unterricht-app.jsx`

Dieser Prototyp zeigt:
- Komplette Navigationstruktur (3 Ebenen)
- Design-System mit Akzentfarben pro Fach
- Dateiliste mit Badges
- Upload- und Ordner-Modals
- Suchfunktion
- Sidebar ein-/ausblendbar

**Beim Bauen des echten Projekts**: Komponenten aus dem Prototyp extrahieren und in die Dateistruktur aus Abschnitt 6 überführen. Styles von inline → TailwindCSS migrieren.

---

## 10. Deployment (Hostinger)

- Node.js-App über Hostinger hPanel aktivieren
- `uploads/`-Ordner außerhalb des Web-Roots oder mit .htaccess absichern
- `.env` niemals committen
- Build-Befehl: `npm run build` → `client/dist/` per SFTP hochladen
- Server starten mit PM2: `pm2 start server/index.js --name lehrermaps`

---

## 11. Entwicklungshinweise für Claude Code

- Immer mobile-first entwickeln (min-width: 320px)
- Akzentfarbe nie hardcoden – immer aus `constants/structure.js` lesen
- Datei-Upload: max. 50 MB pro Datei
- Erlaubte MIME-Types: `application/pdf`, `application/vnd.openxmlformats-officedocument.*`, `text/html`, `image/*`, `video/mp4`
- Fehler immer als `{ error: "Nachricht" }` zurückgeben
- Kein TypeScript nötig – plain JavaScript reicht
- Keine UI-Library (kein MUI, kein shadcn) – eigene Komponenten nach Design-System

---

*Zuletzt aktualisiert: Mai 2026*
