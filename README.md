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
  404.html  robots.txt  sitemap.xml  favicon.svg
  assets/css/style.css      gemeinsames Stylesheet
  assets/js/enterprise.js   Canvas-Animation
  assets/js/kontakt.js      Formular, schrittweise Verbesserung
src/
  index.ts                  Routing, www-Redirect, Fehlerfälle
  headers.ts                Security-Header inkl. CSP
  site-config.ts            setzt site.config.json per HTMLRewriter ein
  contact.ts                POST /api/contact
  turnstile.ts              serverseitige Token-Prüfung
  validation.ts             Feldprüfung und Längengrenzen
  env.d.ts                  Typen der Secrets
site.config.json            einzige Stelle mit Name, Anschrift und E-Mail
wrangler.jsonc              Worker-Konfiguration
```

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

Wer die Anschrift ändern will, ändert `site.config.json` und sonst nichts.

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

## Secrets

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

Der **Site Key** von Turnstile ist öffentlich und steht als `vars`-Eintrag
in `wrangler.jsonc` — der **Secret Key** gehört dort nicht hin. Das ist der
häufigste Fehler an dieser Stelle.

Ist `TURNSTILE_SITE_KEY` leer, entfernt der Worker sowohl das Widget als
auch das Turnstile-Skript aus der Seite. Das Formular funktioniert dann
weiter, nur eben ohne diese Prüfung — und die Seite lädt überhaupt nichts
von fremden Servern.

## Turnstile einrichten

1. Dashboard → **Turnstile** → **Add widget**.
2. Hostnames: `mondlift.de` und `www.mondlift.de`. `localhost` nur
   hinzufügen, wenn lokal mit einem echten Widget getestet werden soll —
   für die Produktion ist es nicht nötig und besser, es wegzulassen.
3. Widget Mode: **Managed**.
4. Den Site Key in `wrangler.jsonc` unter `vars.TURNSTILE_SITE_KEY`
   eintragen, den Secret Key per `wrangler secret put` setzen.

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
