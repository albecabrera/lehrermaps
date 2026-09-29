Du arbeitest direkt in meinem bestehenden Projekt **Lehrermaps** auf meinem Plesk-Server.

## Ziel

Erweitere Lehrermaps um ein neues interaktives Unterrichtsmodul:

# „Koffer oder Müllkorb?“

Dieses Modul dient der gemeinsamen Reflexion am Ende einer Unterrichtsstunde.

Die Lehrkraft sammelt Aussagen der Schülerinnen und Schüler darüber,

- was hilfreich war,
- was sie aus der Stunde mitnehmen,
- was verständlich war,
- was weniger hilfreich war,
- was noch unklar ist,
- und was beim nächsten Mal verbessert werden könnte.

Die Anwendung wird hauptsächlich am **Smartboard**, aber auch auf **MacBook, iPad, Tablet und Smartphone** genutzt.

---

# WICHTIG: ZUERST DAS BESTEHENDE PROJEKT ANALYSIEREN

Beginne NICHT sofort mit der Implementierung.

Untersuche zunächst vollständig die bestehende Lehrermaps-Codebasis.

Analysiere insbesondere:

1. Projektstruktur
2. verwendete Technologien
3. Frontend-Struktur
4. Backend-Struktur
5. Routing
6. Navigation
7. vorhandene UI-Komponenten
8. CSS / Designsystem
9. Dark Mode
10. Authentifizierung
11. bestehende Speicherung / Datenbank
12. vorhandene JavaScript-Struktur
13. bestehende PHP-Struktur, falls vorhanden
14. vorhandene API-Endpunkte
15. responsive Komponenten
16. bestehende Modal-/Dialog-Komponenten
17. vorhandene Exportfunktionen
18. vorhandene Teststruktur

Suche nach Komponenten, die wiederverwendet werden können.

Erstelle **keine zweite Architektur parallel zur bestehenden Anwendung**.

Das neue Modul muss sich so anfühlen, als wäre es von Anfang an Bestandteil von Lehrermaps gewesen.

---

# 1. Modulname

Der neue Bereich heißt:

**Koffer oder Müllkorb?**

Untertitel:

**Was nehmen wir aus der heutigen Stunde mit?**

---

# 2. Grundaufbau

Die Anwendung soll wie eine moderne digitale Reflexionstafel aussehen.

Auf Desktop und Smartboard stehen zwei große Bereiche nebeneinander:

## 🧳 Koffer

Überschrift:

**Das nehme ich mit**

Hier landen Aussagen wie:

- Das habe ich heute verstanden.
- Das war hilfreich.
- Das möchte ich mir merken.
- Das hat mir beim Lernen geholfen.
- Das hat gut funktioniert.

---

## 🗑️ Müllkorb

Überschrift:

**Das können wir verbessern**

Hier landen Aussagen wie:

- Das war schwierig.
- Das war nicht hilfreich.
- Das hat mich verwirrt.
- Das könnten wir nächstes Mal anders machen.
- Das hat mir beim Lernen wenig gebracht.

Wichtig:

Der Müllkorb darf nicht aggressiv oder negativ wirken.

Es geht nicht um:

„Das war schlecht.“

Sondern um:

„Das brauchen wir so beim nächsten Mal nicht.“

oder:

„Das können wir beim nächsten Mal verbessern.“

---

# 3. Optional dritte Kategorie

Wenn es sich sinnvoll in das Layout integrieren lässt, implementiere zusätzlich:

## 💡 Noch unklar

Hier können Aussagen landen wie:

- Das habe ich noch nicht verstanden.
- Dazu habe ich noch eine Frage.
- Das möchte ich noch einmal erklärt bekommen.

Diese Kategorie soll visuell kleiner sein als Koffer und Müllkorb.

Sie darf das Hauptkonzept nicht überladen.

Falls eine dritte Kategorie die Benutzeroberfläche unnötig komplex macht, priorisiere zunächst Koffer und Müllkorb.

---

# 4. Smartboard-optimierte Oberfläche

Die Anwendung soll insbesondere auf großen Smartboards sehr gut funktionieren.

Anforderungen:

- große Schrift
- große Touch-Flächen
- klare Struktur
- wenig Ablenkung
- keine kleinen Menüs
- hoher Kontrast
- aus mehreren Metern Entfernung lesbar
- Touch-Bedienung
- schnelle Eingabe

Auf Desktop/Smartboard:

Koffer und Müllkorb nebeneinander.

Auf kleineren Geräten:

untereinander.

---

# 5. Beiträge hinzufügen

In beiden Bereichen gibt es einen großen Button:

**+ Beitrag**

Alternativ soll direkt auf den Koffer bzw. Müllkorb getippt werden können.

Danach öffnet sich ein Eingabefeld oder Modal.

Es enthält:

## Beitrag

Textarea oder Textinput.

Beispiel:

„Die Arbeit mit Kara hat mir geholfen, Zustandsübergänge besser zu verstehen.“

Danach:

- Koffer
- Müllkorb
- optional Noch unklar

Button:

**Hinzufügen**

Nach dem Hinzufügen erscheint die Aussage sofort als Karte.

---

# 6. Extrem schnelle Eingabe

Der wichtigste Workflow ist:

1. Schüler äußert einen Gedanken.
2. Lehrkraft tippt auf Koffer oder Müllkorb.
3. Eingabefeld öffnet sich sofort.
4. Lehrkraft schreibt die Aussage.
5. Enter.
6. Karte erscheint.

Die Technik darf das Unterrichtsgespräch möglichst wenig unterbrechen.

Deshalb:

- Autofokus auf Eingabefeld
- Enter bestätigt
- Escape schließt
- möglichst wenige Klicks
- keine unnötigen Zwischenschritte

Bei mehrzeiligen Textfeldern:

- Enter kann hinzufügen
- Shift + Enter erzeugt neue Zeile

---

# 7. Karten / Post-its

Jeder Beitrag erscheint als gut lesbare Karte.

Beispiel:

```text
┌────────────────────────────┐
│ Zustandsdiagramme haben    │
│ mir heute beim Verständnis │
│ geholfen.                  │
│                            │
│ 👍 5                    ⋯  │
└────────────────────────────┘
```

Anforderungen:

- automatische Zeilenumbrüche
- große Schrift
- sauberer Abstand
- responsive Breite
- längere Aussagen dürfen das Layout nicht zerstören

Die Karten dürfen leicht wie Post-its wirken, sollen aber modern bleiben.

Keine verspielte oder kindische Optik.

---

# 8. Karten-Menü

Über ein dezentes Menü `⋯` kann die Lehrkraft:

- Beitrag bearbeiten
- Beitrag löschen
- Beitrag verschieben

Beispielsweise:

- In Koffer verschieben
- In Müllkorb verschieben
- In „Noch unklar“ verschieben

Vor dem endgültigen Löschen ggf. kurze Bestätigung.

---

# 9. Drag & Drop

Beiträge sollen zwischen den Bereichen verschoben werden können.

Beispiel:

Ein Beitrag liegt zunächst im Müllkorb.

Nach einer Diskussion entscheidet die Klasse:

„Das nehmen wir doch mit.“

Dann zieht die Lehrkraft die Karte in den Koffer.

Drag & Drop muss nach Möglichkeit funktionieren auf:

- Maus
- Touch
- Smartboard
- Tablet

Wichtig:

Drag & Drop darf NICHT die einzige Möglichkeit sein.

Zusätzlich muss das Verschieben über das Karten-Menü möglich sein.

---

# 10. Zustimmung der Klasse

Jede Karte kann optional eine Zustimmung erhalten.

Beispiel:

👍 0

Beim Tippen:

👍 1

usw.

Damit kann sichtbar werden, welche Aussage von mehreren Schülerinnen und Schülern geteilt wird.

Die Anzahl darf aber nicht dominieren.

Verhindere nach Möglichkeit versehentliche Mehrfachklicks.

---

# 11. Reflexionsfragen

Baue einen Button ein:

**💡 Reflexionsfrage**

Beim Anklicken erscheint zufällig eine Frage.

Fragen:

- Was hast du heute neu gelernt?
- Was war heute besonders hilfreich?
- Was möchtest du dir merken?
- Was war heute schwierig?
- Wo hattest du ein Aha-Erlebnis?
- Was sollten wir nächstes Mal anders machen?
- Welche Aufgabe hat dir geholfen?
- Welche Erklärung war verständlich?
- Wo brauchst du noch Unterstützung?
- Was hat heute besonders gut funktioniert?
- Was kannst du jetzt, was du vorher noch nicht konntest?
- Was würdest du einem Mitschüler aus der heutigen Stunde erklären können?

Die aktuelle Reflexionsfrage soll deutlich sichtbar oberhalb der Tafel erscheinen.

---

# 12. Präsentationsmodus

Implementiere einen Präsentationsmodus für Smartboard und Beamer.

Im Präsentationsmodus verschwinden möglichst:

- Hauptnavigation
- administrative Funktionen
- Bearbeitungselemente, die nicht benötigt werden
- unnötige Bedienelemente

Sichtbar bleiben:

- Titel
- Unterrichtsinformationen
- Reflexionsfrage
- Koffer
- Müllkorb
- optional Noch unklar
- Karten

Ein kleiner Button soll den Präsentationsmodus wieder verlassen können.

Nutze keine Lösung, die den Browser unnötig in echtes Fullscreen zwingt, wenn das bestehende Projekt dafür keine Struktur besitzt.

---

# 13. Unterrichtsinformationen

Optional können folgende Informationen hinterlegt werden:

## Fach

Beispiel:

Informatik

## Klasse / Kurs

Beispiel:

WP8 Informatik

## Thema

Beispiel:

Endliche Automaten mit Kara

## Datum

Standardmäßig aktuelles Datum.

Anzeige beispielsweise:

**WP8 Informatik · Endliche Automaten mit Kara · 29.09.2026**

Die Informationen sollen dezent oberhalb der Reflexion stehen.

---

# 14. Neue Reflexion

Es gibt einen Button:

**Neue Reflexion**

Dieser löscht nicht sofort alles.

Zeige zunächst eine Bestätigung:

„Möchtest du wirklich eine neue Reflexion starten?“

Danach:

- Beiträge zurücksetzen
- Likes zurücksetzen
- Reflexionsfrage zurücksetzen

Unterrichtsinformationen können optional übernommen werden.

---

# 15. Speicherung

Die aktuelle Reflexion darf bei einem Reload nicht verloren gehen.

Untersuche dafür zuerst die bestehende Lehrermaps-Speicherlogik.

Wenn Lehrermaps bereits:

- Datenbank
- Benutzerkonten
- Backend
- API
- Projekte
- Materialobjekte
- Local Storage
- serverseitige Speicherung

verwendet, integriere dich in die bestehende Architektur.

KEINE unnötige parallele Datenhaltung aufbauen.

Falls zunächst nur eine lokale Persistenz technisch sinnvoll ist, kann Local Storage als Fallback verwendet werden.

Strukturiere den Code aber so, dass später problemlos serverseitige Speicherung möglich ist.

---

# 16. Reflexion abschließen

Implementiere:

**Reflexion abschließen**

Danach soll eine übersichtliche Zusammenfassung erscheinen.

Beispiel:

## 🧳 Das nehmen wir mit

- Zustandsdiagramme besser verstanden
- Kara hat geholfen
- Zustandsübergänge verstanden

## 🗑️ Das können wir verbessern

- mehr Zeit für Aufgabe 3
- Aufgabenstellung genauer erklären
- mehr Beispiele

## 💡 Noch unklar

- Unterschied Zustand / Endzustand

Zusätzlich:

**Häufig unterstützte Aussagen**

z. B. anhand der Likes.

---

# 17. Export

Prüfe zuerst, ob Lehrermaps bereits eine Exportfunktion besitzt.

Falls vorhanden:

integriere das Modul dort.

Wenn technisch ohne große zusätzliche Abhängigkeit möglich, ermögliche:

- PDF-Export
- PNG-Export

Der Export soll die Reflexion optisch sauber dokumentieren.

Wichtig:

Führe keine große neue PDF- oder Screenshot-Library ein, wenn das bestehende Projekt bereits eine Lösung besitzt.

---

# 18. Animationen

Animationen nur dezent.

Beispielsweise:

- neue Karte blendet weich ein
- Verschieben hat eine kurze Transition
- Drop-Zone reagiert visuell
- Reflexionsfrage blendet weich ein

Keine übertriebenen Effekte.

Berücksichtige:

`prefers-reduced-motion`

---

# 19. Dark Mode

Falls Lehrermaps bereits Dark Mode unterstützt:

Das komplette Modul muss diesen automatisch übernehmen.

Keine separate Dark-Mode-Implementierung erstellen.

Nutze bestehende:

- CSS-Variablen
- Klassen
- Tokens
- Themes

---

# 20. Barrierefreiheit

Orientiere dich an WCAG 2.1 AA.

Insbesondere:

- ausreichende Kontraste
- Tastaturbedienung
- sichtbarer Fokus
- sinnvolle ARIA-Labels
- Buttons statt klickbarer DIVs
- große Touch-Ziele
- Drag & Drop nicht als einzige Bedienmöglichkeit
- verständliche Beschriftungen

---

# 21. Responsive Design

Teste mindestens:

## Großer Bildschirm / Smartboard

Zwei große Spalten.

## Desktop / MacBook

Zwei Spalten.

## iPad / Tablet

Je nach Breite zwei Spalten oder sinnvolle Umstellung.

## Smartphone

Bereiche untereinander.

Es darf kein ungewolltes horizontales Scrollen geben.

Lange Texte dürfen das Layout nicht sprengen.

---

# 22. Performance

Das Modul soll auch mit vielen Karten flüssig bleiben.

Teste beispielhaft:

- 0 Karten
- 5 Karten
- 20 Karten
- 50 Karten

Vermeide unnötiges Re-Rendering und unnötige Dependencies.

---

# 23. Bestehende Architektur respektieren

Sehr wichtig:

Dieses Feature gehört zu meinem bestehenden **Lehrermaps-Projekt**.

NICHT:

- neue eigenständige App erstellen
- zweites CSS-System einführen
- zweites Routing-System einführen
- unnötige npm-Pakete installieren
- bestehende Navigation ersetzen
- bestehende Authentifizierung umgehen

Stattdessen:

- bestehende Komponenten verwenden
- bestehende CSS-Struktur verwenden
- bestehende Navigation erweitern
- bestehende Datenhaltung verwenden
- vorhandene Hilfsfunktionen nutzen
- Projektkonventionen respektieren

---

# 24. Sicherheit

Da dies eine bestehende produktive Anwendung ist:

- keine bestehenden Daten löschen
- keine bestehende DB-Struktur unkontrolliert verändern
- keine Zugangsdaten im Code speichern
- keine Secrets ausgeben
- keine `.env`-Dateien überschreiben
- bestehende Authentifizierung respektieren
- Benutzereingaben sicher behandeln
- XSS verhindern
- serverseitige Daten validieren, falls Backend beteiligt ist

---

# 25. Vorgehensweise

Arbeite in dieser Reihenfolge.

## Phase 1 – Analyse

Analysiere das gesamte relevante Projekt.

Dokumentiere intern:

- relevante Dateien
- bestehende Architektur
- passende Komponenten
- Speicherstrategie
- Routing
- Styling

## Phase 2 – Implementierungsplan

Erstelle einen kurzen konkreten Plan.

Zum Beispiel:

1. Navigation ergänzen
2. neue Reflexionsansicht erstellen
3. bestehende Modal-Komponente verwenden
4. Kartenmodell implementieren
5. Speicherung anbinden
6. Responsive Design
7. Tests

## Phase 3 – Implementierung

Implementiere das Feature vollständig.

Nicht nach jedem kleinen Schritt auf meine Bestätigung warten.

Arbeite die Aufgabe selbstständig bis zu einem sinnvoll abgeschlossenen Zustand durch.

## Phase 4 – Tests

Prüfe:

- Anwendung lädt
- keine JavaScript-Fehler
- keine PHP-Fehler
- keine Build-Fehler
- bestehende Anwendung funktioniert weiterhin

Teste insbesondere:

- Beitrag hinzufügen
- bearbeiten
- löschen
- verschieben
- Likes
- Reload
- neue Reflexion
- Präsentationsmodus
- Dark Mode
- responsive Layouts
- Tastatur
- Touch-nahe Bedienung

Falls automatisierte Tests vorhanden sind:

Führe sie aus.

## Phase 5 – Abschluss

Gib mir am Ende eine kurze Übersicht:

### Geänderte Dateien

Welche Dateien wurden geändert oder neu erstellt?

### Implementierte Funktionen

Was funktioniert jetzt?

### Tests

Welche Tests oder Prüfungen wurden durchgeführt?

### Offene Punkte

Nur wenn tatsächlich noch etwas offen ist.

---

# WICHTIGE REGEL

Bestehende Funktionen von Lehrermaps dürfen durch das neue Feature nicht beschädigt werden.

Wenn du zwischen einer komplett neuen technischen Lösung und der Wiederverwendung einer vorhandenen Lehrermaps-Komponente wählen kannst:

**verwende die bestehende Komponente.**

Das Ergebnis soll produktionsreif sein.
