# Backlog

Offen, nach Wichtigkeit: die Sichtbarkeit außerhalb des Codes, danach die
Entscheidung zur Reichweitenmessung.

## Sichtbarkeit außerhalb des Codes

Was im Code geht, ist getan: Inhalte mit Quellen, strukturierte Daten,
llms.txt, Markdown-Fassungen, Zitiervorschlag, IndexNow. Ob die Seite
tatsächlich gefunden und von Sprachmodellen zitiert wird, entscheidet sich
ab hier vor allem außerhalb des Repos. Nach Wirkung sortiert:

1. **Bing Webmaster Tools.** ChatGPT-Suche und Copilot greifen auf den
   Bing-Index zurück. Eine Seite, die Bing nicht kennt, zitiert dort
   niemand. Sitemap einreichen, IndexNow läuft schon.
2. **Google Search Console.** Für Google-Suche und die KI-Übersichten.
   Sitemap einreichen, prüfen, ob alle fünf Inhaltsseiten indexiert sind.
3. **Erwähnungen von außen.** Modelle zitieren, was andere zitieren. Die
   wirksamsten Stellen für dieses Thema: ein Einzelnachweis im
   Wikipedia-Artikel „Enterprise (Fahrgeschäft)" an einer Stelle, die die
   Seite wirklich belegt (etwa die strittigen Stückzahlen), Beiträge in
   Kirmes- und Freizeitpark-Foren, Fotos auf Wikimedia Commons mit Verweis
   in der Beschreibung.
4. **Wikidata.** Ein Eintrag für den Mondlift als Exemplar von
   der Bauform „Enterprise" mit Hersteller, Betreiber und `described at URL` auf
   mondlift.de. Wikidata ist eine der Quellen, aus denen Modelle und
   Suchmaschinen Entitäten zusammensetzen. Danach gehört die Wikidata-
   Adresse in `sameAs` des Geräts in `src/strukturierte-daten.ts`.
5. **Prüfen, nicht raten.** Alle paar Wochen dieselben Fragen an ChatGPT,
   Perplexity, Claude und Gemini stellen („Was ist der Mondlift?", „Gibt
   es noch ein reisendes Enterprise in Deutschland?", „War der Mondlift
   auf dem Oktoberfest?") und notieren, ob und wie die Seite genannt wird.

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

Diese Punkte aus dem Backlog sind umgesetzt und stehen nur noch als
Hinweis, wo die Begründung nachzulesen ist.

- **Optik der Animation.** Fachwerkrad mit doppelter Felge, Gondeln als
  Käfige mit farbiger Schale, Nabenkappe, Kastenträger mit
  Hydraulikzylindern, dichte Lampenketten; die Kamera steht jetzt vor dem
  aufgerichteten Rad. Beschrieben im README unter „Die Animation". Die
  Variante mit dünnen Zugstangen statt Fachwerk ist nicht umgesetzt.
- **Markdown-Fassungen, llms-full.txt, Zitiervorschlag.** Siehe README
  unter „llms.txt und die KI-Crawler".

- **Link-Vorschau (`og:image`).** Es gibt jetzt ein Standbild unter
  `/assets/og/mondlift.png`, gerendert aus der Animation selbst mit
  `scripts/og-image.mjs`. Die Annahme von damals — „der Worker kann kein
  PNG erzeugen" — stimmt weiter; erzeugt wird es nicht im Worker, sondern
  einmalig beim Entwickeln.
- **Lesbare Sitemap.** `/sitemap.xml` bleibt reines XML, daneben steht
  `/sitemap` als normale Seite aus derselben Liste. Der übliche Weg über
  ein XSLT-Stylesheet fällt weg, weil Chrome XSLT am 17. November 2026
  entfernt — Begründung im README.
- **Altlasten der Domain.** Die Adressen des WordPress, das vor dieser
  Seite unter der Domain lief, beantwortet der Worker mit `410 Gone` statt
  `404`, damit sie schneller aus dem Index fallen. Siehe
  `src/altlasten.ts` und den Abschnitt im README.
- **IndexNow beim Deploy.** `npm run deploy` meldet über den npm-Hook
  `postdeploy` die kürzlich geänderten Seiten selbst.
- **Strukturierte Daten (JSON-LD).** Der Einwand war die CSP und ein Hash,
  der von Hand nachgezogen werden müsste. Der Worker rechnet ihn jetzt
  selbst über denselben Block, den er ausliefert — siehe
  `src/strukturierte-daten.ts` und den Abschnitt im README.
