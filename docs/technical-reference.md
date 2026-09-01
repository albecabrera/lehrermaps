# LehrerMaps Technical Reference

LehrerMaps is a private teaching-material workspace. The browser client is React/Vite; the server is Node.js/Express with SQLite and local file storage.

## Repository map

| Path | Responsibility |
| --- | --- |
| `client/src/` | React application, styles, hooks, contexts, and UI components. |
| `client/public/` | Public PWA files, icons, service worker, and brand assets. |
| `client/public/brand/` | Canonical LehrerMaps logo family: SVG and transparent PNG variants. |
| `server/` | Express application, SQLite initialization, middleware, API modules, and file handling. |
| `server/routes/` | API route modules, grouped by product capability. |
| `server/uploads/` | Local uploaded teaching materials. |
| `server/edit-copies/` | Local working copies for versioned file editing. |
| `scripts/` | Smoke, PWA, responsive, and feature-specific verification scripts. |
| `docs/` | Project decisions, phase records, and technical documentation. |

## Brand and visual system

### Colors

| Role | Light token | Dark token |
| --- | --- | --- |
| Primary | Navy `#173B66` | Light navy `#8CBCEB` |
| Secondary | Turquoise `#0F9E9A` | Turquoise `#48C7C1` |
| Accent | Orange `#E87824` | Orange `#FFAE6B` |
| Success | Green `#25845D` | Green `#58C491` |
| Warning | Yellow `#B77905` | Yellow `#F5C85C` |
| Error | Red `#C83E4D` | Red `#FF8D99` |

The semantic CSS tokens are defined in `client/src/index.css`. Components should consume tokens such as `--c-bg`, `--c-surface`, `--c-text`, `--c-border`, and `--c-focus`, not hard-coded appearance values.

### Typography, spacing, and shape

- Primary font: Inter; Apple devices fall back to the locally installed SF Pro system font.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, and 64 px.
- Radius: 8 px controls, 12 px cards/dialogs, 16 px shared modal surfaces.
- Motion: short purposeful transitions, with `prefers-reduced-motion` support.
- Icons: familiar outline symbols; critical or unfamiliar controls also receive a text label.

### Logo and icons

`client/public/brand/` contains the selected map-and-route logo family:

| Variant | SVG | PNG |
| --- | --- | --- |
| Full color | `lehrermaps-mark.svg` | `lehrermaps-mark.png` |
| Monochrome | `lehrermaps-mark-mono.svg` | `lehrermaps-mark-mono.png` |
| Light background | `lehrermaps-mark-light.svg` | `lehrermaps-mark-light.png` |
| Dark background | `lehrermaps-mark-dark.svg` | `lehrermaps-mark-dark.png` |

`BrandMark.jsx` is the in-app entry point for the logo. Existing PWA icon files remain under `client/public/assets/icons/` and are declared by the current manifest.

## Frontend

### Components

| Area | Main modules |
| --- | --- |
| Authentication | `pages/LoginPanel.jsx`, `components/BrandMark.jsx` |
| Workspace shell | `pages/App.jsx`, `components/Sidebar.jsx`, `components/MobileNav.jsx` |
| Materials | `FileTable.jsx`, `FilePreview.jsx`, `FolderGallery.jsx`, upload and link modals |
| Teaching | `TeachingMode.jsx`, `LessonDashboard.jsx`, `AnnualPlanning.jsx` |
| Search and notes | `GlobalSearch.jsx`, `SearchModal.jsx`, notebook and canvas modules |
| Documents | `PdfAnnotationViewer.jsx`, worksheet and presentation-related modules |

Shared component rules live in `client/src/index.css`: dialogs, popups, inputs, lists, tables, PDF controls, media surfaces, downloads, favorites, focus states, and reduced-motion behavior share the same token system.

### JavaScript and loading

`client/src/main.jsx` lazy-loads the authenticated application. `pages/App.jsx` lazy-loads feature-heavy screens such as schedule, notes, annual planning, canvas, focus mode, and exam board. QR, terminal, and related optional libraries are also loaded dynamically.

`client/vite.config.js` defines production chunks for React, editor, PDF, terminal, and other vendor code. CSS code splitting is enabled.

## Backend and API

The backend is Node.js/Express. There is no PHP runtime and no `.php` source file in this repository.

| API prefix | Capability |
| --- | --- |
| `/api/login` | Teacher authentication. |
| `/api/folders` | Folder hierarchy, ordering, favorites, notes, colors, and moves. |
| `/api/files` | Upload, preview, download, versioning, roles, zip export, and file search. |
| `/api/links` | Folder-linked external resources. |
| `/api/schedule` | Weekly schedule. |
| `/api/plans`, `/api/plan-archives` | Annual plans, entries, materials, exports, and imports. |
| `/api/lesson-sessions` | Teaching sessions, phases, display state, and canvas data. |
| `/api/notebooks`, `/api/sections`, `/api/pages`, `/api/blocks` | Notebooks and rich content. |
| `/api/search` | Global search. |
| `/api/ai` | AI status and document/worksheet generation. |
| `/api/exams`, `/api/today-dashboard`, `/api/bug-checklist`, `/api/backups` | Supporting teacher workflows. |
| `/api/files/:fileId/annotations` | Document annotations and annotation history. |
| `/api/health` | Health check. |

Route modules are mounted in `server/index.js`. Protected mutations use the teacher authorization middleware where applicable.

## PWA

| File | Responsibility |
| --- | --- |
| `client/public/manifest.json` | App identity, standalone display, start URL, scope, colors, and declared icons. |
| `client/public/service-worker.js` | Versioned app-shell cache, navigation fallback, and stale-while-revalidate handling for same-origin GET assets. |
| `client/index.html` | Manifest link, Apple web-app metadata, startup theme color, and font loading. |

The service-worker cache is currently `lehrermaps-v15` and caches the production brand SVG alongside the existing PWA files. Any asset change in the app shell requires a cache-version update.

## Verification

- `npm run test:pwa` checks manifest, icons, service worker, cache headers, API health, and distribution integrity against `LEHRERMAPS_URL` or local port 8090.
- `node scripts/lehrermaps-responsive-launch.mjs` verifies responsive browser-launch configuration.
- Feature-specific scripts are listed in the root `package.json`.

Runtime and Lighthouse results require a reachable local, staging, or production URL. See `docs/design-phases.md` for the current phase records and outstanding checks.
