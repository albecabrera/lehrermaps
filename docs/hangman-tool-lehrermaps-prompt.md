# Prompt: Hangman-Tool für LehrerMaps

Erstelle für meine bestehende Web-App **LehrerMaps** ein neues interaktives Unterrichtstool namens **„Hangman / Galgenmännchen“**.

Das Tool soll speziell für den Einsatz im Unterricht und am **Smartboard** optimiert sein. Die Bedienung muss deshalb mit Maus, Touch und Finger sehr gut funktionieren. Große Schaltflächen, klare Kontraste und eine übersichtliche Oberfläche sind wichtig.

## Ziel

Lehrkräfte sollen ein beliebiges Wort oder einen Begriff eingeben können. Anschließend wird das Wort verdeckt dargestellt und die Schülerinnen und Schüler versuchen, die Buchstaben zu erraten.

Das Spiel soll schnell startklar sein und sich sowohl für Fremdsprachen als auch für andere Fächer eignen, z. B. Informatik, Sport, Mathematik oder Sachunterricht.

## 1. Startansicht / Vorbereitung

Beim Öffnen des Tools soll zunächst ein kleines Lehrer-Menü erscheinen.

Dort gibt es:

- Eingabefeld **„Lösungswort“**
- optionales Eingabefeld **„Hinweis / Kategorie“**
- Button **„Spiel starten“**
- Button **„Zufallswort“**, falls später Wortlisten integriert werden
- Option **„Wort während der Eingabe anzeigen/verbergen“**

Beispiel:

Lösungswort:
`COMPUTER`

Hinweis:
`Hardware`

Nach dem Start soll das Lösungswort nicht mehr sichtbar sein.

## 2. Spielansicht

Das Spielfeld soll modern, übersichtlich und für ein Smartboard geeignet sein.

Oben:

**Hangman**

Darunter optional:

**Kategorie: Hardware**

In der Mitte wird das gesuchte Wort mit Platzhaltern dargestellt:

`_ _ _ _ _ _ _ _`

Bereits erratene Buchstaben werden automatisch eingesetzt.

Beispiel:

`C _ M P _ T E R`

## 3. Virtuelle Tastatur

Im unteren Bereich muss eine große Bildschirmtastatur angezeigt werden.

Deutsches Alphabet:

A B C D E F G H I J K L M<br>
N O P Q R S T U V W X Y Z

Zusätzlich:

Ä Ö Ü ß

Die Tastatur muss:

- große Touchflächen besitzen
- auf Smartboards gut bedienbar sein
- mindestens ca. 55–70 px hohe Buttons haben
- responsive sein
- bei kleineren Displays automatisch umbrechen

Ein Buchstabe darf nur einmal gewählt werden.

Nach dem Antippen:

### Richtiger Buchstabe

Der Button wird optisch als richtig markiert und deaktiviert.

Der entsprechende Buchstabe erscheint im Lösungswort.

### Falscher Buchstabe

Der Button wird optisch als falsch markiert und deaktiviert.

Der Hangman-Fortschritt wird um eine Stufe erhöht.

Die Farben sollen nicht die einzige Information sein. Zusätzlich können Symbole verwendet werden:

✓ richtig<br>
✕ falsch

## 4. Physische Tastatur

Zusätzlich zur Bildschirmtastatur soll auch die **echte Tastatur des Computers oder Smartboards** funktionieren.

Wenn beispielsweise die Taste `A` gedrückt wird, soll dies genauso behandelt werden wie ein Klick auf den virtuellen A-Button.

Unterstützt werden sollen:

A–Z<br>
Ä<br>
Ö<br>
Ü<br>
ß

Groß- und Kleinschreibung dürfen keinen Unterschied machen.

## 5. Hangman-Anzeige

Links oder oberhalb des Wortes befindet sich die visuelle Darstellung des Spiels.

Der Hangman soll Schritt für Schritt aufgebaut werden.

Beispielsweise:

1. Boden
2. Pfosten
3. Querbalken
4. Seil
5. Kopf
6. Körper
7. linker Arm
8. rechter Arm
9. linkes Bein
10. rechtes Bein

Die maximale Anzahl der Fehler sollte einstellbar sein, standardmäßig beispielsweise **8 Fehler**.

Die Grafik sollte idealerweise als SVG oder Canvas umgesetzt werden, damit sie auf großen Smartboards scharf dargestellt wird.

## 6. Alternative kinderfreundliche Darstellung

Da das Tool in der Schule eingesetzt wird, soll zusätzlich eine alternative Darstellung möglich sein.

Statt eines klassischen Galgenmännchens kann beispielsweise ein neutraler Fortschrittsindikator verwendet werden:

- Rakete
- Batterie
- Herzpunkte
- Puzzle
- Roboter
- Lebenspunkte

Im Einstellungsmenü:

**Darstellung**

- Klassisches Hangman
- Neutraler Fortschrittsmodus

Der neutrale Modus sollte standardmäßig empfohlen werden.

## 7. Spielstatus

Es soll deutlich angezeigt werden:

**Fehler: 3 / 8**

Zusätzlich:

**Bereits verwendete Buchstaben**

A · B · F · K

## 8. Gewonnen

Wenn das komplette Wort erraten wurde, erscheint eine große Erfolgsmeldung:

🎉 **Richtig!**

**Das Wort war: COMPUTER**

Darunter:

**Fehler: 2**

Buttons:

🔄 Neues Wort<br>
▶ Noch einmal<br>
🏠 Zurück zu LehrerMaps

Optional eine kleine Animation, beispielsweise Konfetti.

Die Animation darf nicht zu aufdringlich sein.

## 9. Verloren

Wenn die maximale Anzahl falscher Versuche erreicht wurde:

**Leider nicht geschafft.**

**Das gesuchte Wort war: COMPUTER**

Buttons:

🔄 Neues Wort<br>
▶ Noch einmal

## 10. Lehrer-Schnellfunktion

Während des Spiels soll es einen kleinen Button geben:

⚙️ **Lehrer**

Nach dem Anklicken öffnet sich ein kleines Menü.

Mögliche Funktionen:

- Lösung anzeigen
- Spiel neu starten
- neues Wort eingeben
- Fehlerzahl ändern
- Hinweis anzeigen/verbergen
- Ton ein/aus
- Vollbildmodus

Das Menü sollte nicht zu prominent sein, damit Schülerinnen und Schüler es nicht versehentlich bedienen.

## 11. Hinweise

Ein Hinweis kann optional eingeblendet werden.

Beispiel:

💡 Hinweis<br>
„Dieses Gerät verarbeitet Daten.“

Der Lehrer kann entscheiden, wann der Hinweis angezeigt wird.

Buttons:

**Hinweis zeigen**

oder

**Hinweis verbergen**

## 12. Wortlisten

Bereite die Architektur so vor, dass später Wortlisten eingebaut werden können.

Beispielsweise:

Spanisch<br>
Englisch<br>
Informatik<br>
Mathematik<br>
Biologie<br>
Sport

Eine Wortliste könnte im JSON-Format gespeichert werden:

```json
[
  {
    "word": "COMPUTER",
    "hint": "Hardware"
  },
  {
    "word": "TASTATUR",
    "hint": "Eingabegerät"
  }
]
```

Später soll ein Zufallswort aus einer Wortliste gewählt werden können.

## 13. Mehrwort-Begriffe

Das Spiel muss auch Begriffe mit mehreren Wörtern unterstützen.

Beispiel:

`KÜNSTLICHE INTELLIGENZ`

Darstellung:

`_ _ _ _ _ _ _ _ _ _   _ _ _ _ _ _ _ _ _ _ _`

Leerzeichen und Bindestriche gelten automatisch als sichtbar und müssen nicht erraten werden.

Auch folgende Zeichen sollten unterstützt werden:

- Leerzeichen
- Bindestrich
- Apostroph

## 14. Smartboard-Modus

Integriere einen speziellen Button:

🖥️ **Smartboard-Modus**

Dieser aktiviert:

- größere Tastatur
- größere Schrift
- größere Buttons
- reduzierte Bedienelemente
- Vollbildansicht
- besonders große Darstellung des Lösungswortes

Die wichtigsten Elemente sollen auch aus mehreren Metern Entfernung gut lesbar sein.

## 15. Responsive Design

Das Tool muss funktionieren auf:

- Smartboard
- Desktop-PC
- MacBook
- Laptop
- iPad
- Tablet
- Smartphone

Smartboard und Tablet sollen besonders berücksichtigt werden.

Nutze große Touchbereiche von mindestens ungefähr **44 × 44 px**, besser größer.

## 16. Design

Das Design soll zu einer modernen Lehrer-App passen:

- clean
- freundlich
- modern
- nicht verspielt
- große Karten
- abgerundete Ecken
- dezente Schatten
- klare Typografie
- große Abstände
- moderne Icons

Keine überladene Oberfläche.

Das Tool soll optisch wie ein Bestandteil von **LehrerMaps** wirken und nicht wie eine externe Webseite.

## 17. Bedienbarkeit

Das Spiel muss möglichst ohne Erklärung bedienbar sein.

Typischer Ablauf:

1. Lehrer öffnet Hangman.
2. Lehrer trägt Lösungswort ein.
3. Lehrer gibt optional einen Hinweis ein.
4. Lehrer klickt „Spiel starten“.
5. Schülerinnen und Schüler tippen Buchstaben über das Smartboard an.
6. Richtige Buchstaben werden eingesetzt.
7. Falsche Buchstaben erhöhen den Fehlerzähler.
8. Am Ende erscheint automatisch die Gewinn- oder Verlustmeldung.
9. Lehrer startet direkt eine neue Runde.

Der Wechsel zwischen zwei Spielen sollte nur wenige Sekunden dauern.

## 18. Datenschutz und Technik

Das Tool soll vollständig lokal innerhalb meiner LehrerMaps-Web-App funktionieren.

Keine externen Dienste.

Keine Anmeldung.

Keine Speicherung personenbezogener Schülerdaten.

Das Lösungswort muss nicht auf einem Server gespeichert werden.

Wenn Speicherung notwendig ist, verwende bevorzugt:

`localStorage`

## 19. Technische Umsetzung

Nutze:

- HTML5
- CSS3
- JavaScript

oder die bereits vorhandene Architektur meiner LehrerMaps-App.

Der Code soll:

- modular
- wartbar
- kommentiert
- responsive
- touchoptimiert
- barrierearm

sein.

Vermeide unnötige externe Libraries.

## 20. Sinnvolle Zusatzfunktion

Integriere einen **„Schnellrunde“-Modus**.

Nach Ende eines Spiels erscheint direkt:

**Nächstes Wort eingeben**

Der Lehrer kann ein neues Wort eintippen und mit Enter starten.

Dadurch kann das Tool beispielsweise für Vokabelwiederholungen sehr schnell genutzt werden.

## Ziel des gesamten Tools

Das Hangman-Tool soll kein eigenständiges großes Lernprogramm werden, sondern ein **schnelles Unterrichtswerkzeug innerhalb von LehrerMaps**.

Es soll genauso unkompliziert erreichbar sein wie beispielsweise:

- Timer
- Zufallsgenerator
- Koffer oder Müllkorb

Die wichtigste Priorität ist:

**öffnen → Wort eingeben → Spiel starten → am Smartboard spielen.**

Für deine LehrerMaps würde ich vor allem die Kombination aus **großer Bildschirmtastatur + echter Tastatur + Smartboard-Vollbildmodus** priorisieren. Damit könntest du das Tool tatsächlich spontan in praktisch jedem Fach einsetzen.
