# LehrerMaps

LehrerMaps es una aplicación web para docentes que necesitan organizar, preparar y compartir material de clase sin depender de carpetas sueltas, enlaces perdidos o unidades compartidas caóticas.

La idea es simple: **materia → grupo → carpeta → archivos, enlaces, notas y planificación**. El docente trabaja en un panel privado y el alumnado accede solo al material marcado como compartido.

La versión actual añade un flujo docente más claro: **material por roles de clase**, **modo de enseñanza para mostrar una hora**, y **versionado local para editar copias sin romper el original**.

---

## Qué problema resuelve

Un docente no necesita otro “drive bonito”. Necesita una herramienta que acompañe su flujo real de aula:

- preparar material por clase, tema o unidad;
- guardar PDFs, presentaciones, vídeos, imágenes, código y enlaces;
- tomar notas de preparación sin salir de la app;
- compartir material con estudiantes de forma controlada;
- abrir rápidamente lo importante durante la clase;
- usar la app también en móvil como PWA.

LehrerMaps intenta convertir esa estructura docente en una interfaz clara, rápida y práctica.

---

## Funcionalidades principales

- **Organización por materias y grupos**: carpetas jerárquicas, colores, favoritos y orden manual.
- **Gestión de archivos**: subida de archivos, vista previa, descarga, renombrado, eliminación y movimiento entre carpetas.
- **Material por roles de clase**: etiquetas como inicio, desarrollo, cierre, tarea, solución o examen para ordenar mejor una hora.
- **Modo de enseñanza**: vista limpia para proyectar la clase y ocultar soluciones hasta que el docente las muestre.
- **Versionado local**: abrir una copia de trabajo, editarla fuera de la app y convertirla luego en una nueva versión sin perder el original.
- **Previsualización integrada**: soporte para PDF, imágenes, vídeo, audio, Markdown, DOCX y otros formatos comunes.
- **Vista para estudiantes**: acceso separado con rol `student`; solo muestra contenido compartido.
- **Links por carpeta**: guarda recursos externos junto al material de clase.
- **QR de acceso**: genera códigos QR para compartir enlaces con el alumnado.
- **Notas y cuadernos**: editor enriquecido con Tiptap, notebooks, secciones y páginas.
- **Horario semanal**: planificación de clases y vinculación con carpetas/materiales.
- **Búsqueda global**: acceso rápido a carpetas, archivos y contenido relevante.
- **PWA instalable**: usable como app en móvil/escritorio cuando se sirve por HTTPS.
- **Terminal integrada para docente**: acceso protegido por JWT mediante Socket.io + xterm.js.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18 + Vite |
| Estilos | Tailwind CSS |
| Editor | Tiptap / ProseMirror |
| Drag & Drop | dnd-kit |
| Backend | Node.js + Express |
| Base de datos | MySQL / MariaDB |
| Auth | JWT con roles `lehrer` y `student` |
| Uploads | Multer + filesystem local |
| Versionado | Copias locales + nuevas versiones en DB |
| Tiempo real | Socket.io |
| Terminal | xterm.js + node-pty |
| PWA | Manifest + Service Worker |

---

## Estructura del proyecto

```txt
lehrermaps/
├── client/                 # Frontend React/Vite
│   ├── public/             # Manifest, service worker e iconos PWA
│   └── src/
│       ├── components/     # UI: modales, tabla de archivos, navegación, notas
│       ├── constants/      # Traducciones y configuración visual
│       ├── contexts/       # Theme, idioma y estado compartido
│       ├── hooks/          # Hooks de carpetas, archivos, responsive, etc.
│       ├── lib/api.js      # Cliente Axios + token
│       └── pages/          # App docente, login y vista estudiante
├── server/
│   ├── routes/             # Endpoints de auth, folders, files, links, schedule, etc.
│   ├── db.js               # Pool MySQL + initSchema()
│   ├── index.js            # Express + Socket.io + servidor estático
│   ├── uploads/            # Archivos subidos localmente
│   └── edit-copies/        # Copias de trabajo para editar y versionar
├── deploy/nginx.conf       # Ejemplo de reverse proxy para producción
├── schema.sql              # Schema base
├── start.sh                # Arranque asistido local
├── start-server.sh         # Arranque del backend
├── DEPLOY.md               # Guía de despliegue
└── README.md
```

---

## Requisitos

- Node.js 18+
- npm 9+
- MySQL 8 o MariaDB 10.6+
- macOS o Linux

---

## Instalación

```bash
npm run install:all
```

Crear la base de datos:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS lehrermaps CHARACTER SET utf8mb4;"
mysql -u root -p lehrermaps < schema.sql
```

Crear la configuración del servidor:

```bash
cp server/env.txt server/.env
```

Ejemplo de `server/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=lehrermaps
JWT_SECRET=cambia_esto_por_un_secreto_largo
APP_PASSWORD=lehrer
STUDENT_PASSWORD=contraseña_estudiante
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
```

IMPORTANTE: en producción no uses los valores por defecto. Cambiá `JWT_SECRET`, `APP_PASSWORD` y `STUDENT_PASSWORD`.

---

## Arranque local

Arranque recomendado:

```bash
./start.sh
```

Arranque manual:

```bash
# Terminal 1
cd server
node index.js

# Terminal 2
cd client
npm run dev
```

URLs locales habituales:

| Rol | URL |
| --- | --- |
| Docente | `http://localhost:5173` |
| Estudiante | `http://localhost:5173/?student` |
| API backend | `http://localhost:3001/api/health` |

---

## Scripts npm

Desde la raíz:

```bash
npm run dev          # frontend + backend con concurrently
npm run build        # build del frontend
npm run build:watch  # actualiza client/dist automáticamente al guardar cambios
npm run dev:8090     # watcher del bundle + backend para la app servida por XAMPP en 8090
npm run install:all  # instala raíz, client y server
```

Los launchers `scripts/start-xampp-docker.sh` y `scripts/start-xampp-local.sh` inician también el watcher del frontend. Así, la app que XAMPP sirve en `http://localhost:8090` recibe automáticamente cada cambio guardado en `client/src`, sin tener que regenerar el bundle manualmente.

> Nota para agentes: no ejecutar build automáticamente después de cambios. Este proyecto lo prohíbe en sus instrucciones.

---

## Modelo de datos principal

La app inicializa/migra tablas desde `server/db.js`:

- `folders`: carpetas por materia, grupo, padre, color, favorito, deadline y notas.
- `files`: archivos subidos, metadatos, visibilidad, token público, deadline, rol de material y datos de versión.
- `file_edit_copies`: copias de trabajo temporales para editar antes de crear una nueva versión.
- `links`: recursos externos asociados a carpetas.
- `schedule`: planificación semanal.
- `notebooks`, `sections`, `pages`, `blocks`: sistema de notas/cuadernos.
- `quick_notes`: notas rápidas.
- `exams`: planificación o gestión de exámenes.

---

## API principal

### Autenticación

```http
POST /api/login
POST /api/login-student
GET  /api/health
```

### Carpetas

```http
GET    /api/folders
POST   /api/folders
PUT    /api/folders/:id
PUT    /api/folders/reorder
PUT    /api/folders/:id/notes
PUT    /api/folders/:id/favorite
PUT    /api/folders/:id/color
PUT    /api/folders/:id/deadline
DELETE /api/folders/:id
```

### Archivos

```http
GET    /api/files/:folder_id
POST   /api/files/upload
GET    /api/files/view/:id
GET    /api/files/download/:id
GET    /api/files/zip/:folder_id
PUT    /api/files/:id
PUT    /api/files/:id/share
PUT    /api/files/:id/public
PUT    /api/files/:id/deadline
PUT    /api/files/:id/folder
PUT    /api/files/:id           # también acepta material_role, rename o folder_id
PUT    /api/files/roles/bulk
GET    /api/files/:id/versions
POST   /api/files/:id/edit-copy
POST   /api/files/:id/versions/commit
DELETE /api/files/:id
```

También existen rutas para `links`, `schedule`, `notebooks`, `search`, `exams` y `ai` bajo `/api`.

---

## Seguridad

- Autenticación con JWT.
- Roles separados: `lehrer` y `student`.
- La vista estudiante no debe modificar datos.
- Los archivos no se sirven por nombre original, sino por rutas controladas.
- Las copias de trabajo para editar quedan fuera de `uploads/` y se ignoran en Git.
- Los enlaces públicos usan token.
- CORS se limita mediante `ALLOWED_ORIGIN`.
- `JWT_SECRET` debe ser largo y único en producción.

---

## Producción y entorno local

El backend puede servir el frontend compilado desde `client/dist` si existe. Para despliegue real:

1. Configurar `.env` seguro.
2. Levantar MySQL/MariaDB.
3. Ejecutar el backend con PM2, systemd o Docker.
4. Poner Nginx delante con HTTPS.
5. Configurar proxy para `/api` y `/ws`.

En macOS con XAMPP Docker, la app puede quedar detrás de Apache y el backend corre en un contenedor propio de LehrerMaps dentro de la red Docker compartida. El repo ya contiene un helper en `deploy/xampp-apache-vhost.conf` con el bloque listo para pegar.
La URL estable de LehrerMaps queda en `http://localhost:8090` y el panel de XAMPP queda en `8080`.
Si querés automatizar el arranque sin tocar las configuraciones base, ejecutá `./scripts/start-xampp-docker.sh`.

Ver detalles en [`DEPLOY.md`](DEPLOY.md), [`deploy/nginx.conf`](deploy/nginx.conf) y [`deploy/xampp-apache-vhost.conf`](deploy/xampp-apache-vhost.conf).

## Flujo docente recomendado

1. Elegí la materia y el grupo.
2. Abrí la carpeta de la unidad o la hora.
3. Clasificá materiales con roles de clase.
4. Usá **Stunde zeigen / Mostrar clase** para proyectar solo lo necesario.
5. Si vas a revisar un documento, abrí una copia de trabajo y guardá una nueva versión cuando esté lista.

---

## Filosofía del proyecto

LehrerMaps no está pensada como una demo técnica. Está pensada como una herramienta docente: menos ruido, más estructura, acceso rápido y control claro sobre qué ve cada grupo.

La arquitectura debe proteger esa idea. Primero el flujo del profesor. Después la tecnología.
