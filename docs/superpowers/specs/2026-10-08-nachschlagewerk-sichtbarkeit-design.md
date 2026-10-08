# Entwurf: Nachschlagewerk und Sichtbarkeit

Stand: 8.10.2026 · abgestimmt im Gespräch, Umsetzung im selben Zug

## Ziel

mondlift.de soll gefunden werden und als **Quelle** taugen — für Menschen
über die Suche und für Sprachmodelle, die eine Antwort belegen wollen. Der
Weg dahin ist nicht Technik, sondern Inhalt: die Seite hat bisher vier
Seiten, davon zwei rechtliche, und auf der Startseite steht außer Titel und
Tagline kein Satz. Es gibt also nichts, wofür sie ranken oder was jemand
zitieren könnte.

Das Fundament ist dagegen in Ordnung und bleibt unberührt: Sitemap aus der
Config, IndexNow, ETag auf den erzeugten Dateien, enge CSP, keine
Fremdabrufe außer Turnstile.

## Was den Unterschied macht

Die Recherche zum Gerät und zum Typ Enterprise hat an mehreren Stellen
**widersprüchliche Angaben** ergeben: das Baujahr des Mondlifts (1976 oder
1978), die Stückzahl der von Huss gebauten Enterprise (74, rund 50 oder
rund 64), die Drehzahl (14 oder bis 17 U/min), die Wiesn-Teilnahme nach dem
Besitzerwechsel 2023.

Diese Widersprüche offen zu benennen, statt eine Zahl auszuwählen und als
Tatsache hinzuschreiben, ist der eigentliche Hebel. Eine Seite, die sagt
„hier gehen die Quellen auseinander, und zwar so", ist für ein Modell
wertvoller als eine, die sich sicher gibt — und sie ist die einzige Art von
Fanseite, die man guten Gewissens zitieren kann.

Daraus folgt eine Regel für alle Inhalte: **jede Zahl bekommt ihre Quelle,
und strittige Zahlen bleiben strittig.**

## Seiten

| Pfad | Suchabsicht | Inhalt |
|------|-------------|--------|
| `/` | „mondlift" | Hero bleibt; darunter ein kurzer indexierbarer Block und die Navigation |
| `/mondlift` | „mondlift fahrgeschäft", „mondlift höhe" | Das Gerät: Steckbrief, Besitzergeschichte, Besonderheiten |
| `/enterprise` | „enterprise fahrgeschäft", „huss enterprise" | Der Typ: Herkunft, Funktionsweise, Hersteller, Varianten, Stückzahlen |
| `/glossar` | „überkopffahrgeschäft", „radkranz" | Begriffe rund um Gerät und Kirmes, als Nachschlagewerk |
| `/fragen` | Fragen in Frageform | FAQ und die Quellen- und Methodenseite |

Fünf Seiten statt einer langen: jede hat eine eigene Suchabsicht, und
Querverweise zwischen ihnen tragen mehr als Absätze in einem Block.

Links nach außen gehören dazu und werden nicht gespart: Wikipedia zu
Enterprise und zu Huss, der Hersteller selbst, Wikimedia Commons für
Bilder. Eine Seite, die nur auf sich selbst zeigt, wirkt wie eine
Sackgasse — für Leser und für Crawler.

## Technische Entscheidungen

### Strukturierte Daten trotz enger CSP

Das BACKLOG hatte JSON-LD abgelehnt, weil `script-src 'self'` keine
Inline-Skripte erlaubt und ein sha256-Hash in der CSP bei jeder Änderung
von Hand nachgezogen werden müsste — sonst verschwinden die Daten
stillschweigend.

Der Einwand war richtig, die Schlussfolgerung nicht nötig: der Worker
erzeugt den Block **und** berechnet dessen Hash. Beide kommen aus derselben
Zeichenkette, also kann der Hash nicht veralten. Die CSP bleibt eng, kein
`'unsafe-inline'`, und der Hash steht nirgends von Hand im Repo.

### Der Steckbrief steht in der Config

Die Daten des Geräts kommen nach `site.config.json` unter `ride` und
werden an zwei Stellen eingesetzt: in die Tabelle im HTML über die schon
vorhandenen `data-site`-Platzhalter und in die strukturierten Daten. Eine
Zahl, zwei Ausgaben, keine Pflege an zwei Orten — dieselbe Regel, nach der
Anschrift und Sitemap schon arbeiten.

### Glossar und FAQ sind Daten, nicht Prosa

Beide sind Listen, und von beiden gibt es eine maschinenlesbare Fassung
(`DefinedTermSet`, `FAQPage`). Sie stehen deshalb als Daten in `src/` und
werden serverseitig sowohl ins HTML als auch in die strukturierten Daten
gerendert. Zwei Fassungen desselben Textes, die auseinanderlaufen, wären
sonst sicher — und bei FAQ-Daten verlangt Google ausdrücklich, dass die
sichtbare und die ausgezeichnete Fassung übereinstimmen.

Prosaseiten bleiben normales HTML in `public/`.

### llms.txt und die KI-Crawler

`robots.txt` nennt GPTBot, ClaudeBot, PerplexityBot und die übrigen
ausdrücklich als erlaubt. Erlaubt waren sie durch `User-agent: *` schon
vorher; der Unterschied ist, dass es jetzt dasteht.

Dazu `/llms.txt`, aus derselben Seitenliste erzeugt wie die Sitemap: ein
kurzer Index in Markdown, der einem Modell sagt, was auf der Seite steht
und was die Seite nicht ist. Kostet eine Datei und keine Pflege.

### Link-Vorschau

Das Standbild für `og:image` wird einmalig aus der bestehenden Animation
gerendert (Chromium, 1200×630) und als PNG eingecheckt — der im BACKLOG
beschriebene Weg, nur eben automatisiert statt von Hand. Das Skript bleibt
im Repo, damit das Bild nach einem Umbau der Animation neu entstehen kann.

## Nicht in diesem Schritt

**Google Analytics.** Wird als Vorschlag aufgeschrieben, nicht eingebaut.
Die Abwägung ist nicht technisch: GA4 setzt Cookies und braucht damit einen
Consent-Banner, der die Seite verändert und die Messung gleich wieder
verzerrt. Cloudflare Web Analytics misst ohne Cookies.

**Die Optik der Animation.** Steht als oberster Punkt im BACKLOG und bleibt
dort.
