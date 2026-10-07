# mondlift.de

Private Fan-Hommage an den Mondlift, ein Huss Enterprise auf Reisen.
Die Seite ist **inoffiziell** und hat keine Verbindung zum Betreiber oder
Hersteller des Fahrgeschäfts.

Technisch: ein Cloudflare Worker mit Static Assets. Kein Framework, kein
Build-Schritt, keine Laufzeit-Abhängigkeiten. HTML, CSS und JavaScript liegen
fertig in `public/`, TypeScript gibt es nur im Worker.

## Aufbau

```
public/                 ausgelieferte Dateien (keine Build-Ausgabe)
  index.html            Startseite mit der Animation
  impressum.html        § 5 DDG
  datenschutz.html      Entwurf, noch nicht rechtlich geprüft
  404.html  robots.txt  sitemap.xml  favicon.svg
  assets/css/style.css  gemeinsames Stylesheet
  assets/js/enterprise.js  Canvas-Animation
src/
  index.ts              Worker: Routing, www-Redirect, Fehlerfälle
  headers.ts            Security-Header inkl. CSP
  site-config.ts        setzt site.config.json per HTMLRewriter in die Seiten
site.config.json        einzige Stelle mit Name, Anschrift und E-Mail
wrangler.jsonc          Worker-Konfiguration
```

### Warum ein Worker vor den Assets

`run_worker_first` steht auf `true`. Dadurch läuft der Worker vor jeder
Auslieferung und kann drei Dinge tun, die rein statisch nicht gingen:

1. **Security-Header** auf jede Antwort legen, auch auf CSS, JS und Bilder.
2. **`www.mondlift.de`** dauerhaft auf die Apex-Domain umleiten.
3. **Personendaten einsetzen.** Name, Anschrift und E-Mail stehen nur in
   `site.config.json`. Die HTML-Dateien enthalten Platzhalter
   (`<span data-site="owner.name">`), die der HTMLRewriter serverseitig
   füllt. Es läuft also kein Client-JavaScript dafür — das Impressum ist
   auch mit abgeschaltetem JavaScript vollständig.

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

Rücksicht auf das Gerät:

- Auflösung skaliert mit `devicePixelRatio`, gedeckelt bei 2.
- Bleiben die Bildzeiten dauerhaft über rund 32 ms, wird die Zeichenfläche
  automatisch eine Stufe kleiner (`QUALITY_STEPS`).
- Im versteckten Tab läuft keine Schleife.
- Bei `prefers-reduced-motion: reduce` wird ein Standbild gezeichnet und gar
  nicht erst animiert.

Ein Hinweis zur Zeichengeschwindigkeit, falls jemand daran weiterbaut: Die
Glühbirnen werden **unskaliert** aus vorgerenderten Sprites gestempelt. Ein
skaliertes `drawImage` lässt den Browser jedes Mal neu filtern und kostete in
der Messung rund 50 ms pro Bild — bei über 140 Lampen ist das der Unterschied
zwischen 12 und 60 Bildern pro Sekunde. Deshalb gibt es die Größenleiter in
`buildGlowSprites()`.

## Entwicklung

Voraussetzung: Node 20 oder neuer.

```bash
npm install
npm run dev        # wrangler dev, http://127.0.0.1:8787
npm run typecheck  # erzeugt die Binding-Typen und prüft den Worker
```

`worker-configuration.d.ts` wird von `wrangler types` erzeugt und ist
absichtlich nicht eingecheckt. `npm run typecheck` erzeugt die Datei vorher
selbst, es ist also kein zusätzlicher Schritt nötig.

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

| Name | Phase | Zweck |
|------|-------|-------|
| `TURNSTILE_SECRET_KEY` | 2 | serverseitige Prüfung des Turnstile-Tokens |
| `CONTACT_TO_EMAIL` | 2 | verifizierte Zieladresse des Kontaktformulars |
| `CONTACT_FROM_EMAIL` | 2 | Absenderadresse auf der eigenen Domain |

Der **Site Key** von Turnstile ist öffentlich und darf im Code stehen — der
**Secret Key** nicht. Das ist der häufigste Fehler an der Stelle.

Aktuell (Phase 1) wird kein einziges Secret benötigt.

## Cloudflare Email Routing einrichten (für Phase 2)

Das geht nur im Dashboard, nicht über Wrangler:

1. Dashboard → Zone `mondlift.de` → **Email** → **Email Routing** → aktivieren.
   Cloudflare legt die nötigen MX- und TXT-Einträge selbst an.
2. Unter **Destination addresses** die private Zieladresse eintragen und die
   Bestätigungsmail anklicken. Ohne diesen Schritt nimmt Cloudflare keine
   Zustellung an.
3. Unter **Routing rules** eine Regel `kontakt@mondlift.de` → diese
   Zieladresse anlegen. Damit funktioniert der E-Mail-Empfang.
4. Für den Versand aus dem Worker heraus in `wrangler.jsonc` das
   `send_email`-Binding aktivieren (steht dort auskommentiert bereit) und die
   Zieladresse als Secret setzen:
   ```bash
   npx wrangler secret put CONTACT_TO_EMAIL
   ```
   Das Binding darf nur an **verifizierte** Zieladressen senden.

## Stand

Phase 1 ist fertig: Startseite mit Animation, Impressum, Datenschutz-Entwurf,
404-Seite, Security-Header, robots.txt und sitemap.xml.

Phase 2 (Kontaktformular unter `/kontakt` mit Turnstile, Rate Limit und
`POST /api/contact`) ist noch nicht gebaut.

Die Datenschutzerklärung ist als **Entwurf** gekennzeichnet und noch nicht
rechtlich geprüft.
