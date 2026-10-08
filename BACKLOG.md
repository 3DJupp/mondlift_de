# Backlog

## Optik der Enterprise-Animation

Die Bewegung stimmt — das Kippen um die hintere Felgenkante und die
Gondelstellung aus der resultierenden Kraft entsprechen dem echten Gerät.
Das **Aussehen** tut es noch nicht. Nach Abgleich mit Referenzfotos eines
Huss Enterprise sind das die Unterschiede, von oben nach unten sortiert
nach Wirkung:

### 1. Das Rad ist ein Fachwerk, keine Speichen

Aktuell gehen 20 glatte Linien von der Nabe zur Felge. Das echte Rad ist
ein Tragwerk aus mehreren Lagen:

- radiale Hauptträger von der Nabe nach außen,
- ein **innerer Ring** auf etwa halbem Radius,
- dazwischen eine durchgehende **Dreiecksverstrebung** im Zickzack, die
  zwischen je zwei Hauptträgern Dreiecke und Rauten bildet,
- eine **doppelte Felge**: zwei konzentrische Ringe mit Querstreben
  dazwischen.

Das ist der mit Abstand größte Unterschied. Das Rad wirkt dadurch wie
Stahlbau statt wie ein Wagenrad.

Variante bei manchen Geräten: statt dicker Träger viele **dünne
Zugstangen**, etwa zwei pro Gondel in V-Form, was eher wie ein
Fahrradlaufrad aussieht. Beide Bauarten kommen vor; das Fachwerk ist die
häufigere und die optisch reizvollere.

### 2. Die Gondeln sind Käfige, keine Platten

Aktuell: ein flaches Viereck mit einem warmen Streifen. Tatsächlich:

- ein **Dach** über dem Wagen, deutlich abgesetzt,
- eine geschlossene, farbige **Außenschale** (die Seite, die nach außen
  zeigt),
- **offene Seiten mit Gitterstäben** in hellem Metall,
- Sitzschale innen, sichtbar durch das Gitter.

Die Gondeln hängen an einem Drehpunkt an der Felge und öffnen sich nach
innen zur Nabe hin.

### 3. Nabe und Unterbau

- Die Nabe ist beim Original eine große, glatte **Kappe** oder ein
  kantiges Gehäuse, nicht eine simple Kugel.
- Der Unterbau ist je nach Gerät entweder ein **kräftiger schräger
  Ausleger** oder ein **hoher rechteckiger Mast** bis zur Nabe, montiert
  auf einem Trailer mit Plattform. Der aktuelle dünne Hydraulikzylinder
  ist zu zierlich.

### 4. Farbe

Die Originale sind kräftig gefärbt: rote Gondeln auf blauem Stahl, oder
jede Gondel in einer anderen Farbe (blau, grün, gelb, pink). Das Briefing
verlangt ein dunkles Schema mit warmem Gelb und Orange für die Lichter,
also keine Kirmesbuntheit — aber ein zurückhaltender Farbakzent auf den
Gondelschalen wäre drin und würde dem Bild viel geben.

### 5. Lampen

Beim Original sitzen die Lampen **dicht an dicht** als durchgehende Kette
auf der Felge und rund um die Nabenscheibe. Aktuell ist es eine Lampe je
Ausleger. Dichter wäre näher am Original.

### Hinweis zur Umsetzung

Mehr Streben heißen mehr Zeichenbefehle pro Bild. Die Messung aus der
Entwicklung gilt weiter: unskalierte Sprites sind billig, skalierte sind
teuer. Zusätzliche Linien sind dagegen günstig — das Fachwerk sollte sich
ohne Einbruch der Bildrate zeichnen lassen. Vor und nach dem Umbau messen.

## Sichtbarkeit: zwei bewusst offene Punkte

Beim Nachsehen der Sitemap sind zwei Dinge aufgefallen, die nicht
umgesetzt wurden. Beide sind Abwägungen, keine Versäumnisse.

### Link-Vorschau (`og:image`)

Die Seiten haben `og:type`, `og:title`, `og:description`, `og:url` und
`og:locale`, aber kein `og:image`. Wer den Link in einem Messenger oder
einem Netzwerk teilt, bekommt deshalb eine Textkarte ohne Bild.

Was fehlt, ist ein Rasterbild von etwa 1200×630 px. SVG nimmt dort fast
niemand an, und der Worker kann kein PNG erzeugen — es gibt im Repo keinen
Encoder und für einen gäbe es keinen zweiten Verwendungszweck. Es bliebe
also eine Datei in `public/assets/`, einmal von Hand gebaut: ein Standbild
der Enterprise-Animation wäre das Naheliegende. Das ist die eine Stelle,
an der die Regel „alles aus `site.config.json`" nicht trägt.

### Strukturierte Daten (JSON-LD)

Üblich wäre ein `<script type="application/ld+json">` mit `WebSite` und
`Person`. Die CSP der Seite erlaubt mit `script-src 'self'` keine Inline-
Skripte, und das gilt auch für JSON-LD. Es ginge nur mit einem
sha256-Hash des Blocks in der CSP — und der müsste bei jeder Änderung des
Blocks mitgezogen werden, sonst verschwinden die Daten stillschweigend.

Für vier Seiten ohne Produkte, Veranstaltungen oder Artikel ist der
Gewinn gering: Google baut daraus kein Rich Result, das es hier nicht
ohnehin schon gibt. Die enge CSP ist dagegen jeden Tag etwas wert.
Deshalb bleibt es so — nicht weil es nicht ginge.
