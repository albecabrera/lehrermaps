# LehrerMaps

Aplicación web para que docentes organicen y compartan material didáctico por materia y grupo. Centraliza archivos, enlaces, notas y horario semanal en un panel privado con vista separada para estudiantes.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + Vite 5 |
| **Estilos** | Tailwind CSS 3 |
| **Editor de texto** | Tiptap / ProseMirror |
| **Drag & Drop** | dnd-kit |
| **Terminal integrada** | xterm.js + node-pty |
| **Comunicación en tiempo real** | Socket.io (WS) |
| **HTTP client** | Axios |
| **Backend** | Node.js 18 ESM + Express 4 |
| **Base de datos** | MySQL / MariaDB |
| **Autenticación** | JWT (30 días, roles: lehrer / student) |
| **Uploads** | Multer → filesystem local |
| **Generación de docs** | PDFKit · docx · pptxgenjs |
| **Empaquetado** | Archiver (ZIP) |
| **Proceso en producción** | PM2 |

---

## Razón de ser

Los docentes manejan material disperso: PDFs, presentaciones, videos, links y apuntes por materia, grupo y unidad. LehrerMaps estructura todo eso en carpetas navegables, permite previsualizar archivos sin descargarlos, y ofrece una vista de estudiante con solo el material publicado. Elimina el uso de unidades compartidas genéricas y centraliza el flujo en una sola herramienta.

---

## Funcionalidades principales

- **Gestión de archivos** — upload drag & drop, bulk actions, mover entre carpetas, ZIP, previsualización inline (PDF, imagen, video, audio, DOCX, Markdown)
- **Carpetas** — por materia y grupo, drag & drop para reordenar, favoritos, colores, deadlines, thumbnails automáticos, subcarpetas
- **Editor de notas** — Tiptap con Notebook → Sección → Página, auto-guardado, tablas, listas de tareas, imágenes
- **Links y QR** — guardar URLs por carpeta, generar QR para compartir con estudiantes
- **Horario semanal** — vincular carpetas a bloques horarios, exportar como `.ics`
- **Vista estudiante** — login separado, solo ve archivos marcados como compartidos
- **Búsqueda global** — ⌘K busca en archivos, carpetas y contenido de notas
- **Dark mode** — detección automática del sistema
- **PWA-ready** — manifest + service worker

---

## Arquitectura

```
Browser
  │
  ├─ Vite Dev Server (:5173)         client/src/
  │     └─ /api/* → proxy      →     Express (:3001)
  │     └─ /ws   → proxy ws    →       ├─ auth.js       JWT login / student login
  │                                     ├─ folders.js    CRUD + notas + color + deadline
  │                                     ├─ files.js      upload + download + share + public
  │                                     ├─ links.js      links por carpeta
  │                                     ├─ schedule.js   horario semanal
  │                                     ├─ notebooks.js  notebooks + secciones + páginas
  │                                     ├─ search.js     búsqueda global
  │                                     ├─ exams.js      generador de exámenes
  │                                     └─ ai.js         asistente IA
  │
  └─ MySQL / MariaDB (:3306)
       folders · files · links · schedule · notebooks · pages · sections · exams
```

**Auth flow:**
1. `POST /api/login` → JWT `role: lehrer` (30 d)
2. `POST /api/login-student` → JWT `role: student` (30 d)
3. Todos los endpoints protegidos: `Authorization: Bearer <token>`

**Upload flow:**
1. `UploadModal` construye `FormData` + `AbortController`
2. `POST /api/files/upload` → Multer guarda con nombre UUID en `server/uploads/`
3. Row en DB con `original_name`, `stored_name`, `mime_type`, `size_bytes`

---

## Estructura del proyecto

```
lehrermaps/
├── client/                   # Frontend React (Vite)
│   └── src/
│       ├── components/       # Componentes UI
│       ├── constants/        # SUBJECTS, traducciones, tipos de archivo
│       ├── contexts/         # Theme, Lang, Notebook
│       ├── hooks/            # useFiles, useFolders, useLinks, useRecentFiles
│       ├── lib/api.js        # Axios wrapper + token
│       └── pages/            # App, Login, StudentApp, StudentLogin
├── server/
│   ├── routes/               # auth, files, folders, links, schedule, notebooks, search, exams, ai
│   ├── middleware/auth.js    # Verificación JWT → req.user
│   ├── db.js                 # Pool MySQL + initSchema() (auto-migraciones)
│   ├── uploads/              # Archivos subidos (en .gitignore)
│   ├── index.js              # Entry point Express + Socket.io + node-pty
│   └── env.txt               # Plantilla de .env
├── schema.sql                # Schema inicial de BD
├── start.sh                  # Script de arranque automático
└── README.md
```

---

## Requisitos del sistema

- **Node.js 18+**
- **npm 9+**
- **MySQL 8** o **MariaDB 10.6+** corriendo localmente o en Docker
- macOS / Linux (el script `start.sh` detecta ambos)

---

## Setup inicial

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd lehrermaps
npm run install:all
```

### 2. Crear base de datos

```bash
# MySQL / MariaDB local
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS lehrermaps CHARACTER SET utf8mb4;"
mysql -u root -p lehrermaps < schema.sql

# O con Docker (XAMPP)
docker exec -i xampp-mariadb mysql -u root lehrermaps < schema.sql
```

### 3. Configurar variables de entorno

```bash
cp server/env.txt server/.env
```

Editar `server/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=lehrermaps
JWT_SECRET=cambia_esto_por_32_caracteres_random
APP_PASSWORD=contraseña_del_docente
STUDENT_PASSWORD=contraseña_del_alumno
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
```

> Cambiar `JWT_SECRET`, `APP_PASSWORD` y `STUDENT_PASSWORD` **antes de cualquier deploy**.

---

## Arranque rápido

```bash
./start.sh
```

El script verifica todos los requisitos, instala dependencias si faltan, levanta backend y frontend, y abre el navegador automáticamente en `http://localhost:5173`.

| Rol | URL | Contraseña |
|-----|-----|-----------|
| Docente | `http://localhost:5173` | `APP_PASSWORD` de `.env` |
| Estudiante | `http://localhost:5173/?student` | `STUDENT_PASSWORD` de `.env` |

---

## Arranque manual

```bash
# Terminal 1 — Backend
cd server && node index.js

# Terminal 2 — Frontend
cd client && npm run dev
```

---

## Deploy en producción

> **Guía paso a paso + checklist PWA:** [`DEPLOY.md`](DEPLOY.md) ·
> **Config Nginx completa (TLS, cabeceras de caché, `/ws`):** [`deploy/nginx.conf`](deploy/nginx.conf).
> HTTPS es obligatorio: sin certificado válido el navegador no registra el
> Service Worker y la app no es instalable ni offline.

### 1. Build del frontend

```bash
cd client && npm run build
# El directorio dist/ se sirve como archivos estáticos
```

### 2. Backend con PM2

```bash
cd server
npm install --omit=dev
pm2 start index.js --name lehrermaps
pm2 save
pm2 startup   # configura auto-start al reiniciar el servidor
```

### 3. Variables de entorno en servidor

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=lehrermaps_user
DB_PASS=contraseña_segura
DB_NAME=lehrermaps
JWT_SECRET=32_caracteres_random_aqui
APP_PASSWORD=contraseña_docente
STUDENT_PASSWORD=contraseña_alumno
PORT=3001
ALLOWED_ORIGIN=https://tu-dominio.com
```

### 4. Nginx (reverse proxy)

```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;

    root /var/www/lehrermaps/dist;
    index index.html;
    try_files $uri $uri/ /index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        client_max_body_size 300m;
    }

    # Socket.io / Terminal usa el path /ws (no /socket.io)
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

> Este bloque es mínimo. Para producción usa [`deploy/nginx.conf`](deploy/nginx.conf)
> — incluye redirección 80→443, rutas de certificado (certbot) y cabeceras de
> caché correctas para `service-worker.js` (si no, los updates no llegan).

---

## API — endpoints principales

### Auth
```
POST /api/login              { password }      → { token }
POST /api/login-student      { password }      → { token }
```

### Carpetas
```
GET    /api/folders
POST   /api/folders          { subject, group_name, name, parent_id? }
PUT    /api/folders/reorder  { items: [{id, sort_order}] }
PUT    /api/folders/:id
PUT    /api/folders/:id/notes
PUT    /api/folders/:id/favorite
PUT    /api/folders/:id/color
PUT    /api/folders/:id/deadline
DELETE /api/folders/:id
```

### Archivos
```
GET    /api/files/:folder_id
POST   /api/files/upload             multipart: folder_id + file
GET    /api/files/view/:id           inline
GET    /api/files/download/:id       attachment
GET    /api/files/zip/:folder_id     ZIP de carpeta
GET    /api/files/search?q=          búsqueda global
GET    /api/files/public/:token      sin autenticación
PUT    /api/files/:id/share
PUT    /api/files/:id/public
PUT    /api/files/:id/deadline
PUT    /api/files/:id                { original_name }
PUT    /api/files/:id/folder         { folder_id }
DELETE /api/files/:id
```

---

## Límites

| Parámetro | Valor |
|-----------|-------|
| Tamaño máximo por archivo | 300 MB |
| Tipos permitidos | PDF, DOCX, PPTX, XLSX, imágenes, video, audio, texto, código, ZIP, EPUB y más |

---

## Seguridad

- JWT almacenado en `localStorage`, expiración 30 días
- `JWT_SECRET` mínimo 32 caracteres — nunca usar el valor por defecto en producción
- Archivos guardados con nombre UUID — no hay acceso por nombre original
- Tokens públicos son hex aleatorio de 32 bytes
- Rol `student` no puede crear, eliminar ni modificar — solo leer archivos compartidos
