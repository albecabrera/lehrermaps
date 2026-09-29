# Koffer oder Müllkorb?

The authenticated reflection board is available at `#reflection` inside the existing Lehrermaps workspace. It stores one active board per authenticated teacher role in SQLite and keeps its metadata, cards, question, and anonymous support counts private behind the existing teacher-authenticated API.

PDF export is provided by the already-installed server-side PDFKit dependency. PNG export is intentionally not included: adding a reliable raster export would require a new dependency, so it remains an open product/technical point.
