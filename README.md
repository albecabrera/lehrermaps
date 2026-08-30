# LehrerMaps

LehrerMaps es una aplicación web para docentes que necesitan organizar, preparar material de clase sin depender de carpetas sueltas, enlaces perdidos o unidades compartidas caóticas.

La idea es simple: **materia → grupo → carpeta → archivos, enlaces, notas y planificación**. LehrerMaps is a private workspace for teaching staff.

La versión actual añade un flujo docente más claro: **planificación anual por hora lectiva**, **material por roles de clase**, **modo de enseñanza para mostrar una hora**, **panel diario persistente** y **versionado local para editar copias sin romper el original**.

---

## Qué problema resuelve

Un docente no necesita otro “drive bonito”. Necesita una herramienta que acompañe su flujo real de aula:

- preparar material por clase, tema o unidad;
- guardar PDFs, presentaciones, vídeos, imágenes, código y enlaces;
- tomar notas de preparación sin salir de la app;
- abrir rápidamente lo importante durante la clase;
- usar la app también en móvil como PWA.

LehrerMaps intenta convertir esa estructura docente en una interfaz clara, rápida y práctica.

---

## Libros click & teach de Informatik

La aplicación crea automáticamente un enlace externo en la carpeta raíz de cada grupo de Informatik:

| Grupo | Libro |
| --- | --- |
| Klasse 6 | [click & teach – Klasse 6](https://www.click-and-teach.de/Player/id/1280/page/21) |
| WP 7 | [click & teach – WP 7](https://www.click-and-teach.de/Player/id/1259/page/10) |
| WP 8 | [click & teach – WP 8](https://www.click-and-teach.de/Player/id/1259/page/10) |
| WP 9 | [click & teach – WP 9](https://www.click-and-teach.de/Player/id/1259/page/10) |
| WP 10 | [click & teach – WP 10](https://www.click-and-teach.de/Player/id/1259/page/10) |

Die Links öffnen den click-&-teach-Player in einem neuen Browser-Tab und bleiben dauerhaft in der jeweiligen Gruppe verfügbar. Die Zielseite ist öffentlich erreichbar, die vollständige Nutzung kann jedoch von einer Anmeldung oder Lizenz beim Anbieter abhängen. Eine direkte Einbettung in LehrerMaps ist wegen der `SAMEORIGIN`-Sicherheitsrichtlinie des Anbieters nicht möglich.

---

## Funcionalidades principales

- **Organización por materias y grupos**: carpetas jerárquicas, colores, favoritos y orden manual.
- **Gestión de archivos**: subida de archivos, vista previa, descarga, renombrado, eliminación y movimiento entre carpetas.
- **Material por roles de clase**: etiquetas como inicio, desarrollo, cierre, tarea, solución o examen para ordenar mejor una hora.
- **Modo de enseñanza**: vista limpia para proyectar la clase y ocultar soluciones hasta que el docente las muestre.
- **Versionado local**: abrir una copia de trabajo, editarla fuera de la app y convertirla luego en una nueva versión sin perder el original.
- **Previsualización integrada**: soporte para PDF, imágenes, vídeo, audio, Markdown, DOCX y otros formatos comunes.
- **Links por carpeta**: guarda recursos externos junto al material de clase.
- **Libros click & teach preconfigurados**: los grupos de Informatik tienen acceso directo a los libros correspondientes para Klasse 6, WP 7, WP 8, WP 9 y WP 10.
- **QR para enlaces externos**: genera códigos QR para abrir recursos externos durante la clase.
- **Notas y cuadernos**: editor enriquecido con Tiptap, notebooks, secciones y páginas.
- **Horario semanal**: planificación de clases y vinculación con carpetas/materiales.
- **Planificación anual**: crea planes por curso escolar y materia, añade horas lectivas, fechas, temas/títulos, notas, tipos de actividad y materiales vinculados.
- **Arbeitsblätter por hora**: cada hora de la planificación anual puede reunir directamente hojas de trabajo, presentaciones, recuadros de resumen y otros recursos; se admiten formatos habituales como `.png`, `.jpeg`, `.doc`, `.docx`, `.pdf`, `.txt`, `.xls`, `.xlsx`, `.ppt` y `.pptx`.
- **Acceso desde la planificación**: las horas planificadas pueden abrirse en el modo de enseñanza con sus materiales y contenidos preparados.
- **Panel diario persistente**: tareas y notas del día se guardan en el backend y permanecen disponibles después de recargar o volver a iniciar sesión.
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
| Base de datos | SQLite integrada |
| Auth | JWT for the teacher workspace |
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
│       └── pages/          # App docente, login
├── server/
│   ├── routes/             # Endpoints de auth, folders, files, links, schedule, etc.
│   ├── db.js               # SQLite local + initSchema()
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

- npm 9+
- Node.js 22.5+ (incluye SQLite integrado)
- macOS o Linux

---

## Instalación

```bash
npm run install:all
```

Crear la configuración del servidor:

```bash
cp server/env.txt server/.env
```

Ejemplo de `server/.env`:

```env
SQLITE_PATH=./data/lehrermaps.sqlite
JWT_SECRET=cambia_esto_por_un_secreto_largo
APP_PASSWORD=lehrer
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
```

IMPORTANTE: en producción no uses los valores por defecto. Cambiá `JWT_SECRET` y `APP_PASSWORD`.

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

| Servicio | URL |
| --- | --- |
| Workspace docente | `http://localhost:5173` |
| API backend | `http://localhost:3001/api/health` |

---

## Scripts npm

Desde la raíz:

```bash
npm run dev          # frontend + backend con concurrently
npm run build        # build del frontend
npm run build:watch  # actualiza client/dist automáticamente al guardar cambios
npm run dev:8090     # watcher del bundle + backend para la app servida por XAMPP en 8090
npm run test:pwa     # auditoría de manifest, service worker, headers, API y dist
npm run test:smoke   # smoke test funcional completo con datos temporales
npm run install:all  # instala raíz, client y server
```

Los launchers `scripts/start-xampp-docker.sh` y `scripts/start-xampp-local.sh` inician también el watcher del frontend. Así, la app que XAMPP sirve en `http://localhost:8090` recibe automáticamente cada cambio guardado en `client/src`, sin tener que regenerar el bundle manualmente.

> Nota para agentes: no ejecutar build automáticamente después de cambios. Este proyecto lo prohíbe en sus instrucciones.

---

## Publicar como PWA

LehrerMaps está preparada para desplegarse como PWA detrás de **Nginx + HTTPS**, con Node.js y SQLite integrada. La guía completa está en [`DEPLOY.md`](./DEPLOY.md).

Requisitos importantes para producción:

- HTTPS válido: los service workers no funcionan en dominios HTTP normales.
- `JWT_SECRET` y `APP_PASSWORD` deben ser valores propios y seguros.
- `ALLOWED_ORIGIN` debe coincidir exactamente con la URL HTTPS pública.
- Nginx debe reenviar `/api/` al backend y `/ws` al WebSocket de Socket.IO.
- `server/uploads` debe existir y ser escribible por el proceso Node.

Después de configurar el servidor, ejecutar la auditoría contra el dominio real:

```bash
LEHRERMAPS_URL=https://tu-dominio.example npm run test:pwa
```

La auditoría comprueba el manifest, los iconos, el service worker, los headers de actualización, la API y la integridad de `client/dist`. Después conviene confirmar en Chrome DevTools que el service worker aparece como `activated and running` y probar la carga offline de la app-shell.

---

## Modelo de datos principal

La app inicializa/migra tablas desde `server/db.js`:

- `folders`: carpetas por materia, grupo, padre, color, favorito, deadline y notas.
- `files`: archivos subidos, metadatos, deadline, rol de material y datos de versión.
- `file_edit_copies`: copias de trabajo temporales para editar antes de crear una nueva versión.
- `links`: recursos externos asociados a carpetas.
- `schedule`: planificación semanal.
- `notebooks`, `sections`, `pages`, `blocks`: sistema de notas/cuadernos.
- `quick_notes`: notas rápidas.
- `exams`: planificación o gestión de exámenes.
- `annual_plans`, `annual_plan_entries`, `annual_plan_materials`: planificación anual por materia, hora y curso escolar, con enlaces a archivos y carpetas.
- `today_dashboard`: tareas y notas rápidas persistentes del panel diario.

---

## API principal

### Autenticación

```http
POST /api/login
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
2. Ejecutar el backend o `docker compose --profile standalone -f docker-compose.backend.yml up -d`; SQLite se inicializa sola.
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
