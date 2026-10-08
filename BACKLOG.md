# Backlog

Offen, nach Wichtigkeit: die Optik der Animation, danach die Entscheidung
zur Reichweitenmessung. Die Optik bleibt der oberste Punkt — die Bewegung
stimmt, das Bild noch nicht.

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

## Reichweite messen: Vorschlag für den nächsten Schritt

Die Seite hat jetzt Inhalte, die ranken können — damit wird zum ersten Mal
interessant, ob das auch passiert. Gewünscht war ausdrücklich eine Anregung
zu Google Analytics; hier steht sie, zusammen mit den Alternativen, weil die
Abwägung nicht technisch ist.

### Zuerst: die zwei Werkzeuge ohne Code und ohne Einwilligung

Beide gehören eingerichtet, bevor über Analytics überhaupt geredet wird. Sie
beantworten genau die Fragen, um die es hier geht, und kosten weder eine
Zeile Code noch einen Banner.

- **Google Search Console.** Zeigt, für welche Suchbegriffe die Seite
  erscheint, auf welcher Position, wie oft geklickt wird, welche Seiten
  indexiert sind und wo Google beim Crawlen hängt. Für eine Seite, die
  gefunden werden will, ist das die wichtigste Quelle überhaupt. Der
  Nachweis läuft über einen DNS-TXT-Eintrag in der Cloudflare-Zone, es
  kommt also nichts in den Code. Die Sitemap lässt sich dort direkt
  einreichen.
- **Bing Webmaster Tools.** Dasselbe für Bing — und damit für Copilot und
  alle, die den Bing-Index benutzen. Die Daten aus der Search Console lassen
  sich beim Anlegen importieren.

Dazu kommt ohne jede Einrichtung die **Analyse im Cloudflare-Dashboard**:
Anfragen, Besucher, Länder, Statuscodes, alles serverseitig gezählt. Kein
Skript im Browser, keine Cookies, keine Einwilligung, keine Lücke durch
Werbeblocker.

### Dann erst: Besucherverhalten

Wenn darüber hinaus interessiert, *wie* sich Besucher auf der Seite bewegen,
stehen drei Wege zur Wahl.

| Weg | Was es kostet |
|-----|---------------|
| **Cloudflare Web Analytics** | Ein Skript von `static.cloudflareinsights.com`, also eine Zeile mehr in der CSP und der erste Fremdabruf außerhalb von Turnstile. Ohne Cookies, ohne geräteübergreifende Wiedererkennung. Kostenlos. |
| **Google Analytics 4** | Cookies, damit Einwilligung nach § 25 TTDSG — also ein Banner vor der Seite, ein neuer Abschnitt in der Datenschutzerklärung und eine Vereinbarung zur Auftragsverarbeitung. Dazu: Ein Banner verzerrt die Messung, die er ermöglichen soll, weil ein erheblicher Teil ablehnt. |
| **Selbst zählen im Worker** | Kein Fremdskript, keine Cookies, volle Kontrolle — aber Workers Analytics Engine oder KV als Speicher, eine Auswertung von Hand, und ein Stück Code, das gepflegt werden will. |

**Empfehlung:** Search Console und Bing Webmaster Tools einrichten, die
Cloudflare-Analyse mitlesen, und erst wenn danach eine konkrete Frage offen
bleibt, Cloudflare Web Analytics dazunehmen. Google Analytics lohnt sich für
vier Inhaltsseiten ohne Konversionsziel nicht — es bringt Funktionen, die
hier niemand braucht, und kostet dafür den Cookie-Banner, der als erstes
auf der Seite steht.

Wenn GA4 trotzdem gewünscht ist, ist der Weg klar und machbar: Banner mit
echter Ablehnmöglichkeit, Skript erst nach Einwilligung nachladen, CSP um
`googletagmanager.com` und `google-analytics.com` erweitern, Datenschutz-
erklärung um Zweck, Rechtsgrundlage, Empfänger und Speicherdauer ergänzen.
Es ist eine Entscheidung, keine Fleißarbeit — deshalb steht sie hier und
nicht im Code.

## Erledigt

Zwei Punkte aus diesem Backlog sind umgesetzt und stehen nur noch als
Hinweis, wo die Begründung nachzulesen ist.

- **Link-Vorschau (`og:image`).** Es gibt jetzt ein Standbild unter
  `/assets/og/mondlift.png`, gerendert aus der Animation selbst mit
  `scripts/og-image.mjs`. Die Annahme von damals — „der Worker kann kein
  PNG erzeugen" — stimmt weiter; erzeugt wird es nicht im Worker, sondern
  einmalig beim Entwickeln.
- **Strukturierte Daten (JSON-LD).** Der Einwand war die CSP und ein Hash,
  der von Hand nachgezogen werden müsste. Der Worker rechnet ihn jetzt
  selbst über denselben Block, den er ausliefert — siehe
  `src/strukturierte-daten.ts` und den Abschnitt im README.
