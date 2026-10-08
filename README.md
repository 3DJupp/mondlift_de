# mondlift.de

Private Fan-Hommage an den Mondlift, ein Huss Enterprise auf Reisen.
Die Seite ist **inoffiziell** und hat keine Verbindung zum Betreiber oder
Hersteller des Fahrgeschäfts.

Technisch: ein Cloudflare Worker mit Static Assets. Kein Framework, kein
Build-Schritt, keine Laufzeit-Abhängigkeiten. HTML, CSS und JavaScript liegen
fertig in `public/`, TypeScript gibt es nur im Worker.

## Aufbau

```
public/                     ausgelieferte Dateien (keine Build-Ausgabe)
  index.html                Startseite mit der Animation
  kontakt.html              Kontaktformular
  impressum.html            § 5 DDG
  datenschutz.html
  404.html  robots.txt  favicon.svg
  assets/css/style.css      gemeinsames Stylesheet
  assets/js/enterprise.js   Canvas-Animation
  assets/js/kontakt.js      Formular, schrittweise Verbesserung
src/
  index.ts                  Routing, www-Redirect, Fehlerfälle
  headers.ts                Security-Header inkl. CSP
  site-config.ts            setzt site.config.json per HTMLRewriter ein
  sitemap.ts                erzeugt /sitemap.xml
  indexnow.ts               liefert die IndexNow-Schlüsseldatei
  anschrift.ts              zeichnet /anschrift.svg
  anschrift-glyphen.ts      Zeichenumrisse dafür (erzeugt)
  contact.ts                POST /api/contact
  turnstile.ts              serverseitige Token-Prüfung
  validation.ts             Feldprüfung und Längengrenzen
  env.d.ts                  Typen der Secrets
scripts/
  indexnow.mjs              meldet Änderungen an die Suchmaschinen
  glyphs.py                 erzeugt anschrift-glyphen.ts (läuft selten)
site.config.json            Name, Anschrift, E-Mail, Seitenliste, IndexNow-Key
wrangler.jsonc              Worker-Konfiguration
```

`sitemap.xml` liegt bewusst **nicht** in `public/`: sie wird aus
`site.config.json` erzeugt, siehe unten.

### Warum ein Worker vor den Assets

`run_worker_first` steht auf `true`. Dadurch läuft der Worker vor jeder
Auslieferung und kann vier Dinge tun, die rein statisch nicht gingen:

1. **Security-Header** auf jede Antwort legen, auch auf CSS, JS und Bilder.
2. **`www.mondlift.de`** dauerhaft auf die Apex-Domain umleiten.
3. **Personendaten einsetzen.** Name, Anschrift und E-Mail stehen nur in
   `site.config.json`. Die HTML-Dateien enthalten Platzhalter
   (`<span data-site="owner.name">`), die der HTMLRewriter serverseitig
   füllt. Es läuft also kein Client-JavaScript dafür — das Impressum ist
   auch mit abgeschaltetem JavaScript vollständig.
4. **Die Rückmeldung des Formulars rendern**, ebenfalls ohne JavaScript.
5. **`sitemap.xml`, die IndexNow-Schlüsseldatei und das Anschrift-Bild
   erzeugen**, alle drei aus derselben `site.config.json`.

Wer die Anschrift ändern will, ändert `site.config.json` und sonst nichts.
Für eine neue Seite gilt dasselbe: ein Eintrag in `pages`, und Sitemap wie
IndexNow-Meldung kennen sie.

### Die Animation

`public/assets/js/enterprise.js` zeichnet ein Huss Enterprise auf Canvas 2D,
ohne Libraries. Gerechnet wird in Metern im Weltsystem, projiziert mit einer
leichten Zentralprojektion und einer Kamera, die etwas von oben schaut.

Zwei Dinge sind bewusst physikalisch statt nach Gefühl gelöst:

- **Das Kippen.** Das Rad dreht sich um eine waagerechte Achse an seiner
  hinteren Felgenkante. Genau so hebt sich das echte Fahrgeschäft aus der
  Waagerechten in die Senkrechte, und die Nabe steigt dabei von rund 2,6 m
  auf gut 10 m.
- **Die Gondelstellung.** Jede Gondel zeigt in Richtung der resultierenden
  Kraft aus Zentrifugalkraft und Schwerkraft. Daraus ergibt sich von selbst
  das richtige Bild: flach und langsam hängen die Gondeln nach unten, steil
  und schnell stehen sie radial ab. Es gibt dafür keine Sonderfälle im Code.

Rücksicht auf das Gerät: Auflösung skaliert mit `devicePixelRatio` (gedeckelt
bei 2), bei dauerhaft langsamen Bildern wird die Zeichenfläche eine Stufe
kleiner, im versteckten Tab läuft keine Schleife, und bei
`prefers-reduced-motion: reduce` wird nur ein Standbild gezeichnet.

Ein Hinweis für alle, die daran weiterbauen: Die Glühbirnen werden
**unskaliert** aus vorgerenderten Sprites gestempelt. Ein skaliertes
`drawImage` lässt den Browser jedes Mal neu filtern und kostete in der
Messung rund 50 ms pro Bild — bei über 140 Lampen ist das der Unterschied
zwischen 12 und 60 Bildern pro Sekunde. Deshalb gibt es die Größenleiter in
`buildGlowSprites()`. Offene Punkte zur Optik stehen in [BACKLOG.md](BACKLOG.md).

### Das Kontaktformular

`POST /api/contact` nimmt Name, E-Mail und Nachricht entgegen. Der Ablauf:
Rate Limit, Feldprüfung, Turnstile, Zustellung per Mail. Fehlermeldungen
sind bewusst allgemein gehalten und verraten nichts über die Innereien.

Vier Sperren gegen Spam:

| Sperre | Wirkung |
|--------|---------|
| Honigtopf-Feld | für Besucher unsichtbar; ausgefüllt heißt abgewiesen |
| Rate Limit pro IP | 3 Einsendungen je Minute |
| Strenges Rate Limit | 1 je Minute, nur ohne Turnstile-Token |
| Cloudflare Turnstile | serverseitig geprüft, inklusive Aktion und Hostname |

Zwei Entscheidungen, die man kennen sollte:

**Turnstile und der Weg ohne JavaScript schließen sich aus.** Turnstile
braucht JavaScript, um überhaupt ein Token zu erzeugen. Damit das Formular
trotzdem ohne JavaScript funktioniert, gibt es zwei Wege: mit Token wird
streng geprüft, ohne Token greift stattdessen das strenge Rate Limit.
Wer das nicht möchte, setzt `REQUIRE_TURNSTILE` in `src/contact.ts` auf
`true` — dann werden Einsendungen ohne gültiges Token abgewiesen und der
Weg ohne JavaScript ist zu.

**Die Absenderadresse ist immer die eigene Domain**, niemals die des
Besuchers. Sonst sähe die Mail wie eine Fälschung aus und würde an SPF und
DMARC scheitern. Die Adresse des Besuchers steht in `Reply-To`, man kann
also einfach antworten.

Das Rate-Limiting-Binding kennt nur Zeitfenster von 10 oder 60 Sekunden.
Längere Fenster, etwa „fünf pro Stunde", bräuchten KV oder ein Durable
Object — für diese Seite wäre das überdimensioniert.

## Sitemap

`GET /sitemap.xml` wird vom Worker aus `site.config.json` erzeugt. Die
Seitenliste steht dort unter `pages`, die Domain unter `site.url`:

```json
"pages": [
  {
    "path": "/",
    "lastmod": "2026-10-07",
    "changefreq": "monthly",
    "priority": "1.0"
  }
]
```

Eine fertige Datei in `public/` wäre die zweite Stelle im Repo, an der
Seitenliste, Domain und Datum stehen — und die läuft mit der Zeit
auseinander. So gibt es nur eine, und `scripts/indexnow.mjs` liest dieselbe
Liste.

Von den drei Angaben je Seite wertet Google nur `lastmod` aus; `changefreq`
und `priority` ignoriert es seit Jahren. Sie stehen trotzdem drin, weil
andere Suchmaschinen sie weiterhin lesen und sie nichts kosten.

### Warum das Datum pro Seite steht

Hier stand vorher ein Datum für alle vier Seiten, `site.lastUpdated`, mit
der Begründung: vier Seiten werden gemeinsam deployt, ein zweites Datum je
Seite wäre Buchhaltung ohne Nutzen. Die Annahme stimmt nicht. Die vier
Seiten ändern sich nicht gemeinsam — Startseite und Kontakt zuletzt am
7.10., Impressum und Datenschutz am 8.10. Mit einem gemeinsamen Datum
behauptet die Sitemap bei jeder Textänderung irgendwo, alle vier Seiten
seien neu.

Das ist nicht nur ungenau, es kostet die Angabe ihre Wirkung: Google
benutzt `lastmod` nur so lange, wie es dem Verhalten der Seiten entspricht,
und verwirft das Feld, wenn es sich als unzuverlässig erweist. Ein Datum,
das für alle Seiten gleichzeitig springt, ist genau dieser Fall.

Deshalb hat jede Seite ihr eigenes `lastmod`. Die Regel dafür ist
unverändert: **Datum der letzten inhaltlichen Änderung**. Wer den Text einer
Seite ändert, zieht deren Datum mit; wer nur an der Technik schraubt, lässt
alle stehen. Fehlt der Eintrag bei einer Seite, nimmt der Worker
`site.lastUpdated` als Rückfall.

`site.lastUpdated` bleibt dafür und für seine zweite Aufgabe: es steht als
„Stand:“ unter Impressum und Datenschutz.

`priority` ist absichtlich als Zeichenkette notiert. Als Zahl würde `1.0`
beim Serialisieren zu `1`, und das ist ein unnötiger Unterschied zwischen
Config und ausgelieferter Datei.

### ETag für die erzeugten Dateien

Sitemap, Anschriftsbild und IndexNow-Schlüsseldatei entstehen im Worker und
ändern sich nur mit einem Deploy. Sie bekommen deshalb in `src/cache.ts`
einen ETag über ihren Inhalt, und ein passendes `If-None-Match` beantwortet
der Worker mit `304` ohne Rumpf.

Das zahlt sich vor allem bei der Sitemap aus, die Googlebot regelmäßig
nachsieht, und beim Anschriftsbild, das bei jedem Besuch des Impressums
geladen wird. Nebeneffekt: der Inhalt wird einmal je Isolate erzeugt statt
einmal pro Anfrage — die Glyphenumrisse der Anschrift werden also nicht
mehr bei jedem Aufruf zusammengesetzt.

Der ETag ist ein FNV-1a-Hash über den Inhalt mit der Byte-Länge davor, als
schwacher ETag (`W/"…"`) ausgezeichnet. Keine Kryptografie, und das ist
richtig so: ein ETag muss sich ändern, wenn sich der Inhalt ändert, und
nicht fälschungssicher sein.

## IndexNow

IndexNow ist ein Protokoll, mit dem man Suchmaschinen aktiv mitteilt, dass
sich eine Adresse geändert hat, statt auf den nächsten Crawl zu warten.
Teilnehmer sind unter anderem Bing, Yandex, Seznam und Naver — **Google
nicht**; dort zählt weiter die Sitemap.

Zwei Teile:

**Die Schlüsseldatei.** Das Protokoll verlangt einen Nachweis, dass man die
Domain kontrolliert: der Schlüssel muss unter
`https://mondlift.de/<schlüssel>.txt` abrufbar sein und genau den Schlüssel
enthalten. Der Worker beantwortet diesen einen Pfad; der Schlüssel steht in
`site.config.json` unter `indexNow.key`.

Er gehört **nicht** in `wrangler secret put`. Er ist öffentlich — jede
Suchmaschine lädt die Datei — und als Secret oder `vars`-Eintrag stünde
derselbe Wert zweimal im Repo, einmal für den Worker und einmal für das
Skript. Geheim muss er nicht sein, nur schwer zu erraten; deshalb eine
Zufallsfolge. Wechseln heißt: neuen Wert eintragen, deployen, neu melden.
Erlaubt sind 8 bis 128 Zeichen aus `a-z`, `A-Z`, `0-9` und Bindestrich.

**Die Meldung.** Nach einem Deploy, der Inhalte geändert hat:

```bash
npm run indexnow                      # alle Seiten aus der Config
npm run indexnow -- /kontakt          # nur diese Seite
npm run indexnow -- --dry-run         # nur zeigen, was gesendet würde
```

Das Skript prüft zuerst, ob die Schlüsseldatei live erreichbar ist und den
richtigen Wert enthält — der häufigste Fehler ist ein Melden vor dem
Deploy, und ohne diese Prüfung sieht man das erst am `403` der
Suchmaschine. Danach geht eine Anfrage an `api.indexnow.org`, die an alle
teilnehmenden Suchmaschinen verteilt. `200` heißt angenommen, `202` heißt
angenommen und der Schlüssel wird noch geprüft — beides ist Erfolg.

Der richtige Zeitpunkt ist ein Deploy **mit** Inhaltsänderung, nicht jeder
Deploy. IndexNow ist dafür gedacht, Änderungen zu melden; eine unveränderte
Seite erneut zu melden bringt nichts.

Deshalb gibt es auch keinen Cron im Worker: ein Cron ohne Gedächtnis kann
nicht wissen, ob sich seit dem letzten Lauf etwas geändert hat, und würde
entweder immer melden oder nie. Ein Zustand dafür bräuchte KV oder ein
Durable Object — für vier Seiten wäre das überdimensioniert. Der Deploy
weiß es, also hängt die Meldung daran.

### Die Alternative ohne Code

Cloudflare kann das auch selbst: **Crawler Hints** im Dashboard unter
Caching → Configuration meldet IndexNow für die ganze Zone, ohne Schlüssel
und ohne Skript. Das ist weniger genau — Cloudflare entscheidet, was als
Änderung gilt — aber es kostet nichts und läuft von allein. Beides
gleichzeitig schadet nicht.

## Die Anschrift als Bild

Im Impressum steht die Anschrift nicht als Text, sondern als Bild unter
`/anschrift.svg`. Grund ist Adresshandel: Programme durchsuchen Impressen
nach Anschriften, und was dort als Text steht, landet in Adresslisten.

Drei Dinge, die man dazu wissen sollte.

**Es sind Umrisse, kein `<text>` im SVG.** Text in einem SVG ist genauso
auslesbar wie Text in HTML — der Umweg wäre sonst wirkungslos. Der Worker
setzt jeden Buchstaben als Pfad zusammen; in der ausgelieferten Datei kommt
die Anschrift als Zeichenfolge nicht vor. Die Umrisse stehen in
`src/anschrift-glyphen.ts`.

**Die Anschrift steht weiter nur in `site.config.json`.** Ein fertiges Bild
im Repo wäre die zweite Stelle mit der Adresse, und eine Änderung müsste
jemand in einem Grafikprogramm nachziehen. Es bleibt also dabei: wer die
Anschrift ändert, ändert `site.config.json` und sonst nichts.

**Barrierefreiheit ist eingeschränkt, und das ist eine Abwägung.** Wer das
Bild nicht sehen kann, liest die Anschrift nicht. Der `alt`-Text nennt sie
deshalb bewusst nicht — er würde sie den Sammelprogrammen gleich wieder
servieren. Stattdessen steht unter dem Bild, dass es die Anschrift auf
Anfrage als Text gibt, und E-Mail-Adresse wie Kontaktformular bleiben
durchgehend Text. Niemand ist also vom Kontakt abgeschnitten.

Wer das anders gewichtet, setzt die Anschrift in den `alt`-Text des `<img>`
in `public/impressum.html`. Dann ist die Seite barrierefrei und der Schutz
praktisch dahin — beides gleichzeitig geht hier nicht.

In der Datenschutzerklärung steht die Anschrift nicht noch einmal: Abschnitt
1 nennt Name und E-Mail-Adresse und verweist für die Anschrift auf das
Impressum.

### Farbe und Größe

Die Farbe ist in `src/anschrift.ts` als `#b3bdd1` eingetragen und entspricht
`--ink-soft` in `style.css`. `currentColor` geht nicht: ein per `<img>`
eingebundenes SVG erbt die Farbe der Seite nicht, sondern löst gegen Schwarz
auf — auf dem dunklen Hintergrund also unsichtbar. Wer die Farbe im
Stylesheet ändert, ändert sie dort mit.

Breite und Höhe rechnet der Worker aus und schreibt sie ins SVG, das `<img>`
im HTML braucht deshalb keine Maße und die Seite springt beim Laden nicht.

### Die Zeichenumrisse

`src/anschrift-glyphen.ts` ist **erzeugt** und wird nicht von Hand
geändert. Darin stehen 134 Zeichen: Buchstaben, Ziffern und die Satzzeichen,
die in Namen und Anschriften vorkommen, dazu die Buchstaben des
Latin-1-Nachtrags für Umlaute und Akzente. Zeichen wie `$ % # @` fehlen
absichtlich — sie haben die größten Pfade und kommen in keiner Adresse vor.

Fehlt ein Zeichen doch, zeichnet der Worker ein leeres Kästchen an seine
Stelle und schreibt es in die Workers Logs. Lieber sichtbar falsch als
stillschweigend verschluckt: ein fehlender Buchstabe in einer Anschrift
fällt sonst niemandem auf.

Neu erzeugen muss man die Datei nur, wenn Schrift oder Zeichenvorrat
wechseln sollen. Dafür braucht es Python und fontTools, beides sonst
nirgends im Projekt:

```bash
pip install fonttools
python3 scripts/glyphs.py
```

Die Schrift ist DejaVu Sans; der Lizenzhinweis steht im Kopf der erzeugten
Datei.

## Entwicklung

Voraussetzung: Node 20 oder neuer.

```bash
npm install
cp .dev.vars.example .dev.vars   # lokale Secrets, ist in .gitignore
npm run dev                      # http://127.0.0.1:8787
npm run typecheck                # erzeugt Binding-Typen und prüft den Worker
```

`worker-configuration.d.ts` wird von `wrangler types` erzeugt und ist
absichtlich nicht eingecheckt. `npm run typecheck` erzeugt die Datei vorher
selbst, es ist also kein zusätzlicher Schritt nötig.

Für lokales Arbeiten am Formular reichen die Turnstile-Testschlüssel:
Site Key `1x00000000000000000000AA` und Secret Key
`1x0000000000000000000000000000000AA`.

## Deployment

```bash
npm run deploy
```

Einmalig im Cloudflare-Dashboard nötig:

1. Die Zone `mondlift.de` muss im Account liegen.
2. Beim ersten `wrangler deploy` legt Wrangler die Custom Domains
   `mondlift.de` und `www.mondlift.de` an und trägt die DNS-Einträge ein.
3. Account-ID bei Bedarf über die Umgebungsvariable `CLOUDFLARE_ACCOUNT_ID`
   setzen. Sie steht bewusst nicht in `wrangler.jsonc`, weil das Repo
   öffentlich ist.

## Variablen und Secrets

Es gibt drei Orte, und welcher es ist, entscheidet eine Frage: *Ist der Wert
geheim, und gehört er zum Inhalt oder zum Betrieb?*

| Wert | Ort | Nötig für |
|------|-----|-----------|
| `site.*`, `contact.*` | `site.config.json` | Impressum, Datenschutz, Titel |
| `owner.*` | `site.config.json` | Impressum und das Anschrift-Bild |
| `pages` | `site.config.json` | Sitemap und IndexNow-Meldung |
| `indexNow.key` | `site.config.json` | Schlüsseldatei, öffentlich |
| `TURNSTILE_SITE_KEY` | `wrangler.jsonc` → `vars` | Turnstile-Widget im Formular |
| `TURNSTILE_SECRET_KEY` | `wrangler secret put` | Prüfung des Turnstile-Tokens |
| `CONTACT_TO_EMAIL` | `wrangler secret put` | Zustellung des Formulars |
| `CONTACT_FROM_EMAIL` | `wrangler secret put` | Absenderadresse der Mail |

Dazu kommen die Bindings aus `wrangler.jsonc`, die Wrangler selbst anlegt:
`ASSETS`, `CONTACT_RATE_LIMIT`, `CONTACT_RATE_LIMIT_STRICT` und
`CONTACT_MAILER`. Für die ist nichts einzutragen.

Alles ist optional typisiert und der Worker kommt mit fehlenden Werten
zurecht, statt beim Start umzufallen — er schaltet dann die betroffene
Funktion ab:

| Fehlt | Folge |
|-------|-------|
| `TURNSTILE_SITE_KEY` | kein Widget, kein Turnstile-Skript; das Formular läuft über Honigtopf und das strenge Rate Limit |
| `TURNSTILE_SECRET_KEY` | ein eintreffendes Token kann nicht geprüft werden, die Einsendung wird abgewiesen |
| `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL` | das Formular nimmt an, stellt aber nicht zu und meldet einen Fehler |
| `indexNow.key` (ungültig) | keine Schlüsseldatei; `npm run indexnow` bricht mit einer Meldung ab |

### Secrets

Im Repo steht **nichts** Geheimes. Secrets kommen über
`wrangler secret put <NAME>` in die Produktion und lokal in `.dev.vars`
(von Git ausgeschlossen). `.dev.vars.example` zeigt die nötigen Namen.

| Name | Zweck |
|------|-------|
| `TURNSTILE_SECRET_KEY` | serverseitige Prüfung des Turnstile-Tokens |
| `CONTACT_TO_EMAIL` | verifizierte Zieladresse des Kontaktformulars |
| `CONTACT_FROM_EMAIL` | Absenderadresse auf der eigenen Domain |

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put CONTACT_TO_EMAIL
npx wrangler secret put CONTACT_FROM_EMAIL
```

### Der Site Key

Der **Site Key** von Turnstile ist öffentlich und steht als `vars`-Eintrag
in `wrangler.jsonc` — der **Secret Key** gehört dort nicht hin. Das ist der
häufigste Fehler an dieser Stelle.

In der Produktion steht der Site Key des angelegten Widgets:
`0x4AAAAAAFRtdEHO2PO0lLFd`. Der `previews`-Block trägt dagegen weiter den
offiziellen Testschlüssel `1x00000000000000000000AA` — ein Preview soll
nicht am echten Widget drehen, und ohne gesetztes Secret prüft es ohnehin
kein Token.

Ist `TURNSTILE_SITE_KEY` leer, entfernt der Worker sowohl das Widget als
auch das Turnstile-Skript aus der Seite. Das Formular funktioniert dann
weiter, nur eben ohne diese Prüfung — und die Seite lädt überhaupt nichts
von fremden Servern.

## Turnstile einrichten

Das Widget ist angelegt, der Site Key steht in `wrangler.jsonc`. Es fehlt
nur noch der Secret Key:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Den Wert zeigt das Dashboard unter **Turnstile** → Widget → **Settings**,
oder `npx wrangler turnstile widget get 0x4AAAAAAFRtdEHO2PO0lLFd`. Er gehört
nicht ins Repo und nicht in `wrangler.jsonc`.

Beim Widget selbst sind zwei Dinge wichtig:

- **Hostnames**: `mondlift.de` und `www.mondlift.de`. `localhost` nur
  hinzufügen, wenn lokal mit dem echten Widget getestet werden soll — für
  die Produktion ist es nicht nötig und besser, es wegzulassen. Fehlt ein
  Hostname, liefert Siteverify `success: false`, und das Formular antwortet
  mit `spam`.
- **Widget Mode**: **Managed**.

Ein neues Widget wird im Dashboard über **Turnstile** → **Add widget**
angelegt; danach Site Key in `wrangler.jsonc` unter `vars` eintragen und
den Secret Key wie oben setzen.

Der Worker prüft nicht nur `success`, sondern auch, dass die Aktion
`kontakt` lautet und der Hostname zu dem passt, unter dem die Seite
ausgeliefert wurde. Ein Token, das auf einer anderen Seite desselben
Widgets erzeugt wurde, lässt sich hier also nicht einlösen.

## Cloudflare Email Routing einrichten

Das geht nur im Dashboard, nicht über Wrangler:

1. Dashboard → **Compute** → **Email Service** → **Email Routing** →
   aktivieren. Cloudflare legt die nötigen MX- und TXT-Einträge selbst an.
2. Unter **Destination addresses** die private Zieladresse eintragen und die
   Bestätigungsmail anklicken. Ohne diesen Schritt nimmt Cloudflare keine
   Zustellung an.
3. Unter **Routing rules** eine Regel `kontakt@mondlift.de` → diese
   Zieladresse anlegen. Damit funktioniert der E-Mail-Empfang.
4. Dieselbe verifizierte Adresse als `CONTACT_TO_EMAIL` setzen.

Das `send_email`-Binding darf nur an **verifizierte Zieladressen** des
Accounts senden. Das genügt für ein Kontaktformular, das an das eigene
Postfach geht, und ist auf allen Plänen kostenlos. Was damit nicht geht,
ist eine automatische Empfangsbestätigung an den Absender — dafür bräuchte
es Email Sending auf einem bezahlten Plan oder einen externen Dienst.
