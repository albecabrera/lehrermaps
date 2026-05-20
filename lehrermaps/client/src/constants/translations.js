export const translations = {
  de: {
    // Subjects
    'subject.spanisch': 'Spanisch',
    'subject.informatik': 'Informatik',
    'subject.sport': 'Sport',
    'subject.klasse': 'Klassenleitung',

    // Common actions
    'cancel': 'Abbrechen',
    'save': 'Speichern',
    'saving': 'Speichern…',
    'create': 'Erstellen',
    'creating': 'Erstelle…',
    'delete': 'Löschen',
    'rename': 'Umbenennen',
    'download': 'Herunterladen',
    'open': 'Öffnen',
    'open_browser': 'Im Browser öffnen',
    'open_in_preview': 'In Vorschau öffnen',
    'open_in_word': 'In Word öffnen',
    'open_in_impress': 'In Impress öffnen',
    'open_in_writer': 'In Writer öffnen',
    'open_in_pptx': 'In PowerPoint öffnen',
    'opening': 'Öffne…',
    'app_not_found': 'App nicht gefunden',
    'copy_url': 'URL kopieren',
    'copied': '✓ Kopiert',
    'loading': 'Lädt…',
    'converting': 'Wird konvertiert…',

    // Login
    'login.subtitle': 'Unterrichtsmaterial-Verwaltung',
    'login.password': 'Passwort',
    'login.placeholder': 'Dein Passwort eingeben',
    'login.button': 'Anmelden',
    'login.loading': 'Anmelden…',
    'login.error': 'Falsches Passwort. Bitte erneut versuchen.',
    'login.footer': 'LehrerMaps · Bonn · NRW',

    // App shell
    'app.upload': 'Hochladen',
    'app.logout': 'Abmelden',
    'app.search': 'suchen…',
    'app.search_placeholder': 'In {{subject}} suchen…',
    'app.theme_dark': 'Dunkelmodus',
    'app.theme_light': 'Hellmodus',
    'app.lang_de': 'Deutsch',
    'app.lang_es': 'Español',
    'folders.overview_hint': '{{n}} Ordner — Einen auswählen oder neu erstellen.',

    // Sidebar
    'sidebar.new_folder': 'Neuer Ordner',
    'sidebar.create_in': 'Ordner in {{group}} erstellen',
    'sidebar.expand': 'Sidebar ausklappen',
    'sidebar.collapse': 'Sidebar einklappen',
    'sidebar.drop_to_move': 'Datei hierhin bewegen',

    // File table
    'table.col_size': 'Größe',
    'table.col_date': 'Datum',
    'table.empty_title': 'Dieser Ordner ist leer',
    'table.empty_hint': 'Lade die erste Datei hoch.',
    'table.upload_file': 'Datei hochladen',
    'table.no_results': 'Keine Ergebnisse',
    'table.no_results_hint': 'Keine Dateien für „{{q}}" gefunden.',
    'table.links_section': 'Links & QR-Codes',
    'table.add_link': 'Link hinzufügen',
    'table.ctx_download': 'Herunterladen',
    'table.ctx_open_browser': 'Im Browser öffnen',
    'table.ctx_copy_url': 'URL kopieren',
    'table.selected_count': '{{n}} ausgewählt',
    'table.clear_selection': 'Auswahl löschen',
    'table.public_link_on': 'Public-Link aktivieren',
    'table.public_link_off': 'Public-Link deaktivieren',
    'table.deadline': 'Deadline',
    'table.gallery': 'Galerie',
    'table.list': 'Liste',
    'table.no_images': 'Keine Bilddateien in diesem Ordner.',

    // Folders
    'folders.count': '{{n}} Ordner',
    'folders.no_folders_title': 'Noch keine Ordner',
    'folders.no_folders_hint': 'Erstelle den ersten Ordner für {{subject}}.',
    'folders.create': 'Ordner erstellen',
    'folders.new_folder_btn': 'Neuer Ordner',
    'folders.files': '{{n}} Dateien',

    // File count
    'files.count_one': '{{n}} Datei',
    'files.count_many': '{{n}} Dateien',
    'files.filter': '{{filtered}} von {{total}} Dateien · Filter: „{{q}}"',

    // Preview
    'preview.select': 'Datei auswählen\nzum Anzeigen',
    'preview.unavailable': 'Vorschau nicht verfügbar',
    'preview.no_browser': 'Keine Browser-Vorschau',
    'preview.download_to_open': 'Zum Öffnen herunterladen',
    'preview.loading': 'Lädt…',
    'preview.qr_scan': 'QR-Code scannen zum Öffnen',
    'preview.conversion_failed': 'Konvertierung fehlgeschlagen',

    // Notes
    'notes.tab': 'Notizen',
    'notes.files_tab': 'Dateien',
    'notes.placeholder': 'Notizen hier eingeben…',
    'notes.saved': 'Gespeichert',
    'notes.saving': 'Speichern…',
    'notes.format_normal': 'Normal',
    'notes.format_h1': 'Überschrift 1',
    'notes.format_h2': 'Überschrift 2',
    'notes.format_h3': 'Überschrift 3',

    // Modals
    'modal.new_folder.title': 'Neuer Ordner',
    'modal.new_folder.subject_label': 'Gruppe',
    'modal.new_folder.name_label': 'Ordnername',
    'modal.new_folder.name_placeholder': 'z. B. Klausuren Q2',
    'modal.new_folder.in': 'in',

    'modal.rename.title': 'Umbenennen',

    'modal.add_link.title': 'Link hinzufügen',
    'modal.add_link.subtitle': 'URL + QR-Code speichern',
    'modal.add_link.name_label': 'Bezeichnung',
    'modal.add_link.name_placeholder': 'z.B. Arbeitsblatt online',
    'modal.add_link.url_label': 'URL',

    'modal.upload.title': 'Datei hochladen',
    'modal.upload.target': 'Ziel',
    'modal.upload.active_folder': 'Aktiver Ordner',
    'modal.upload.drop': 'Dateien hier ablegen',
    'modal.upload.drop_active': 'Loslassen zum Hochladen',
    'modal.upload.browse': 'Dateien auswählen',
    'modal.upload.browse_folder': 'Ordner auswählen',
    'modal.upload.progress': '{{n}}% hochgeladen…',
    'modal.upload.formats': 'Unterstützte Formate',
    'modal.upload.max': 'Max. 50 MB pro Datei · alle Daten bleiben lokal',
    'modal.deadline.folder_title': 'Ordner-Deadline',
    'modal.deadline.file_title': 'Datei-Deadline',
    'modal.deadline.hint': 'Leer lassen, um die Deadline zu entfernen.',
    'modal.deadline.clear': 'Deadline entfernen',

    // Global search
    'search.placeholder': 'Dateien, Ordner suchen…',
    'search.no_results': 'Keine Ergebnisse',
    'search.files_section': 'Dateien',
    'search.folders_section': 'Ordner',
    'search.notes_match': 'Treffer in Notizen',
    'search.hint': 'Tippe um zu suchen',

    // Confirm modal
    'confirm.delete': 'Löschen bestätigen',
    'confirm.delete_file_msg': 'Möchtest du „{{name}}" löschen?',
    'confirm.delete_folder_msg': 'Möchtest du den Ordner „{{name}}" löschen?',
    'confirm.folder_cascade': 'Dieser Ordner enthält {{n}} Datei(en) — sie werden ebenfalls gelöscht.',

    // Sidebar extras
    'sidebar.favorites': 'Favoriten',
    'sidebar.recents': 'Zuletzt geöffnet',
    'sidebar.pin': 'Als Favorit markieren',
    'sidebar.unpin': 'Aus Favoriten entfernen',

    // Presentation & print
    'preview.fullscreen': 'Vollbild',
    'preview.fullscreen_exit': 'Vollbild beenden',
    'notes.print': 'Drucken',

    // ZIP
    'folder.download_zip': 'Alle als ZIP',

    // Stundenplan
    'schedule.title': 'Stundenplan',
    'schedule.period': 'Std.',
    'schedule.link': 'Ordner verknüpfen',
    'schedule.unlink': 'Verknüpfung entfernen',
    'schedule.pick_folder': 'Ordner auswählen',
    'schedule.navigate': 'Öffnen',
    'schedule.export_ics': 'Als .ics exportieren',

    // Student view
    'student.view': 'Schüler-Ansicht',
    'student.login_title': 'Schüler-Zugang',
    'student.password': 'Schüler-Passwort',
    'student.placeholder': 'Passwort eingeben',
    'student.button': 'Einloggen',
    'student.loading': 'Einloggen…',
    'student.error': 'Falsches Passwort.',
    'student.share_toggle': 'Für Schüler freigeben',
    'student.unshare': 'Freigabe entfernen',
    'student.shared_badge': 'Freigegeben',
    'student.copy_link': 'Schüler-Link kopieren',
    'student.exit': 'Lehrer-Modus',
    'toast.upload_error': 'Upload fehlgeschlagen.',
    'toast.drop_done': '{{n}} Datei(en) hochgeladen.',
    'toast.drop_done_error': '{{done}}/{{total}} hochgeladen · {{failed}} Fehler',
    'toast.file_moved': 'Datei verschoben nach {{folder}}.',
    'toast.file_move_error': 'Datei konnte nicht verschoben werden.',
    'toast.deadline_saved': 'Deadline gespeichert.',
    'toast.deadline_error': 'Deadline konnte nicht gespeichert werden.',
    'prompt.folder_deadline': 'Ordner-Deadline (YYYY-MM-DD). Leer zum Entfernen:',
    'prompt.file_deadline': 'Datei-Deadline (YYYY-MM-DD). Leer zum Entfernen:',
  },

  es: {
    // Subjects
    'subject.spanisch': 'Español',
    'subject.informatik': 'Informática',
    'subject.sport': 'Deporte',
    'subject.klasse': 'Tutoría',

    // Common actions
    'cancel': 'Cancelar',
    'save': 'Guardar',
    'saving': 'Guardando…',
    'create': 'Crear',
    'creating': 'Creando…',
    'delete': 'Eliminar',
    'rename': 'Renombrar',
    'download': 'Descargar',
    'open': 'Abrir',
    'open_browser': 'Abrir en navegador',
    'open_in_preview': 'Abrir en Vista Previa',
    'open_in_word': 'Abrir en Word',
    'open_in_impress': 'Abrir en Impress',
    'open_in_writer': 'Abrir en Writer',
    'open_in_pptx': 'Abrir en PowerPoint',
    'opening': 'Abriendo…',
    'app_not_found': 'App no encontrada',
    'copy_url': 'Copiar URL',
    'copied': '✓ Copiado',
    'loading': 'Cargando…',
    'converting': 'Convirtiendo…',

    // Login
    'login.subtitle': 'Gestión de material didáctico',
    'login.password': 'Contraseña',
    'login.placeholder': 'Ingresá tu contraseña',
    'login.button': 'Iniciar sesión',
    'login.loading': 'Iniciando…',
    'login.error': 'Contraseña incorrecta. Intentá de nuevo.',
    'login.footer': 'LehrerMaps · Bonn · NRW',

    // App shell
    'app.upload': 'Subir',
    'app.logout': 'Cerrar sesión',
    'app.search': 'buscar…',
    'app.search_placeholder': 'Buscar en {{subject}}…',
    'app.theme_dark': 'Modo oscuro',
    'app.theme_light': 'Modo claro',
    'app.lang_de': 'Deutsch',
    'app.lang_es': 'Español',
    'folders.overview_hint': '{{n}} carpetas — Elegí una o creá una nueva.',

    // Sidebar
    'sidebar.new_folder': 'Nueva carpeta',
    'sidebar.create_in': 'Crear carpeta en {{group}}',
    'sidebar.expand': 'Expandir barra lateral',
    'sidebar.collapse': 'Contraer barra lateral',
    'sidebar.drop_to_move': 'Mover archivo aquí',

    // File table
    'table.col_size': 'Tamaño',
    'table.col_date': 'Fecha',
    'table.empty_title': 'Esta carpeta está vacía',
    'table.empty_hint': 'Subí el primer archivo.',
    'table.upload_file': 'Subir archivo',
    'table.no_results': 'Sin resultados',
    'table.no_results_hint': 'No hay archivos para "{{q}}".',
    'table.links_section': 'Enlaces & Códigos QR',
    'table.add_link': 'Agregar enlace',
    'table.ctx_download': 'Descargar',
    'table.ctx_open_browser': 'Abrir en navegador',
    'table.ctx_copy_url': 'Copiar URL',
    'table.selected_count': '{{n}} seleccionados',
    'table.clear_selection': 'Limpiar selección',
    'table.public_link_on': 'Activar link público',
    'table.public_link_off': 'Desactivar link público',
    'table.deadline': 'Fecha límite',
    'table.gallery': 'Galería',
    'table.list': 'Lista',
    'table.no_images': 'No hay imágenes en esta carpeta.',

    // Folders
    'folders.count': '{{n}} carpetas',
    'folders.no_folders_title': 'Sin carpetas',
    'folders.no_folders_hint': 'Creá la primera carpeta para {{subject}}.',
    'folders.create': 'Crear carpeta',
    'folders.new_folder_btn': 'Nueva carpeta',
    'folders.files': '{{n}} archivos',

    // File count
    'files.count_one': '{{n}} archivo',
    'files.count_many': '{{n}} archivos',
    'files.filter': '{{filtered}} de {{total}} archivos · Filtro: "{{q}}"',

    // Preview
    'preview.select': 'Seleccionar archivo\npara ver',
    'preview.unavailable': 'Vista previa no disponible',
    'preview.no_browser': 'Sin vista previa en navegador',
    'preview.download_to_open': 'Descargar para abrir',
    'preview.loading': 'Cargando…',
    'preview.qr_scan': 'Escanear código QR para abrir',
    'preview.conversion_failed': 'Error al convertir',

    // Notes
    'notes.tab': 'Notas',
    'notes.files_tab': 'Archivos',
    'notes.placeholder': 'Escribí tus notas aquí…',
    'notes.saved': 'Guardado',
    'notes.saving': 'Guardando…',
    'notes.format_normal': 'Normal',
    'notes.format_h1': 'Encabezado 1',
    'notes.format_h2': 'Encabezado 2',
    'notes.format_h3': 'Encabezado 3',

    // Modals
    'modal.new_folder.title': 'Nueva carpeta',
    'modal.new_folder.subject_label': 'Grupo',
    'modal.new_folder.name_label': 'Nombre de carpeta',
    'modal.new_folder.name_placeholder': 'Ej. Exámenes Q2',
    'modal.new_folder.in': 'en',

    'modal.rename.title': 'Renombrar',

    'modal.add_link.title': 'Agregar enlace',
    'modal.add_link.subtitle': 'Guardar URL + código QR',
    'modal.add_link.name_label': 'Nombre',
    'modal.add_link.name_placeholder': 'Ej. Hoja de trabajo online',
    'modal.add_link.url_label': 'URL',

    'modal.upload.title': 'Subir archivo',
    'modal.upload.target': 'Destino',
    'modal.upload.active_folder': 'Carpeta activa',
    'modal.upload.drop': 'Arrastrar archivos aquí',
    'modal.upload.drop_active': 'Soltar para subir',
    'modal.upload.browse': 'Seleccionar archivos',
    'modal.upload.browse_folder': 'Seleccionar carpeta',
    'modal.upload.progress': '{{n}}% subido…',
    'modal.upload.formats': 'Formatos admitidos',
    'modal.upload.max': 'Máx. 50 MB por archivo · todos los datos son locales',
    'modal.deadline.folder_title': 'Fecha límite de carpeta',
    'modal.deadline.file_title': 'Fecha límite de archivo',
    'modal.deadline.hint': 'Dejá vacío para quitar la fecha límite.',
    'modal.deadline.clear': 'Quitar fecha límite',

    // Global search
    'search.placeholder': 'Buscar archivos, carpetas…',
    'search.no_results': 'Sin resultados',
    'search.files_section': 'Archivos',
    'search.folders_section': 'Carpetas',
    'search.notes_match': 'Coincidencia en notas',
    'search.hint': 'Escribí para buscar',

    // Confirm modal
    'confirm.delete': 'Confirmar eliminación',
    'confirm.delete_file_msg': '¿Eliminar "{{name}}"?',
    'confirm.delete_folder_msg': '¿Eliminar la carpeta "{{name}}"?',
    'confirm.folder_cascade': 'Esta carpeta contiene {{n}} archivo(s) — también se eliminarán.',

    // Sidebar extras
    'sidebar.favorites': 'Favoritos',
    'sidebar.recents': 'Recientes',
    'sidebar.pin': 'Marcar como favorito',
    'sidebar.unpin': 'Quitar de favoritos',

    // Presentation & print
    'preview.fullscreen': 'Pantalla completa',
    'preview.fullscreen_exit': 'Salir de pantalla completa',
    'notes.print': 'Imprimir',

    // ZIP
    'folder.download_zip': 'Todo como ZIP',

    // Stundenplan
    'schedule.title': 'Horario',
    'schedule.period': 'H.',
    'schedule.link': 'Vincular carpeta',
    'schedule.unlink': 'Eliminar vínculo',
    'schedule.pick_folder': 'Elegir carpeta',
    'schedule.navigate': 'Abrir',
    'schedule.export_ics': 'Exportar como .ics',

    // Student view
    'student.view': 'Vista alumno',
    'student.login_title': 'Acceso alumnos',
    'student.password': 'Contraseña alumno',
    'student.placeholder': 'Ingresá la contraseña',
    'student.button': 'Entrar',
    'student.loading': 'Entrando…',
    'student.error': 'Contraseña incorrecta.',
    'student.share_toggle': 'Compartir con alumnos',
    'student.unshare': 'Dejar de compartir',
    'student.shared_badge': 'Compartido',
    'student.copy_link': 'Copiar link alumnos',
    'student.exit': 'Modo docente',
    'toast.upload_error': 'Error al subir archivos.',
    'toast.drop_done': '{{n}} archivo(s) subidos.',
    'toast.drop_done_error': '{{done}}/{{total}} subidos · {{failed}} error(es)',
    'toast.file_moved': 'Archivo movido a {{folder}}.',
    'toast.file_move_error': 'No se pudo mover el archivo.',
    'toast.deadline_saved': 'Fecha límite guardada.',
    'toast.deadline_error': 'No se pudo guardar la fecha límite.',
    'prompt.folder_deadline': 'Fecha límite carpeta (YYYY-MM-DD). Vacío para quitar:',
    'prompt.file_deadline': 'Fecha límite archivo (YYYY-MM-DD). Vacío para quitar:',
  },
};
