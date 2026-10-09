/**
 * Die Begriffe des Glossars - einmal als Daten.
 *
 * Warum nicht als HTML in public/: von dieser Liste gibt es zwei Fassungen,
 * die sichtbare Definitionsliste und die strukturierten Daten
 * (`DefinedTermSet`). Zwei Fassungen desselben Textes laufen auseinander,
 * sobald jemand nur eine davon anfasst. Deshalb steht der Text hier, und
 * beide Fassungen entstehen daraus - das HTML serverseitig im
 * HTMLRewriter, die strukturierten Daten in strukturierte-daten.ts.
 *
 * Reihenfolge: vom Gerät nach außen zum Betrieb, nicht alphabetisch. Wer
 * einen einzelnen Begriff sucht, nimmt die Suche des Browsers; wer sich
 * einliest, liest der Sache nach.
 */

import { escapeHtml, slug } from "./html";

export interface Begriff {
  /** Das Stichwort, wie es in der Liste steht. */
  wort: string;
  /** Erklärung in einem bis drei Sätzen. Nur Text, kein HTML. */
  erklaerung: string;
  /** Weiterführender Verweis, intern oder nach außen. */
  verweis?: { text: string; href: string };
}

export const BEGRIFFE: Begriff[] = [
  {
    wort: "Fahrgeschäft",
    erklaerung:
      "Eine Anlage, die Fahrgäste zum Vergnügen bewegt — vom Kinderkarussell bis zur Achterbahn. Der Begriff stammt aus dem Schaustellergewerbe und meint immer beides: die Maschine und das Geschäft, das jemand damit betreibt.",
  },
  {
    wort: "Reisegeschäft",
    erklaerung:
      "Ein Fahrgeschäft, das nach jedem Volksfest abgebaut, auf Trailer verladen und am nächsten Ort wieder aufgebaut wird. Das Gegenstück ist die stationäre Anlage im Freizeitpark, die einmal gegründet wird und stehen bleibt. Reisegeschäfte müssen deshalb zerlegbar, straßentauglich und in ein bis zwei Tagen aufbaubar sein — das prägt ihre ganze Bauweise.",
  },
  {
    wort: "Enterprise",
    erklaerung:
      "Die Bauform, zu der der Mondlift gehört: ein Rad mit frei schwenkenden Zwei-Personen-Gondeln am Kranz, das sich während der Fahrt aus der Waagerechten in die Senkrechte aufrichtet. Zuerst 1972 von Anton Schwarzkopf gebaut, ab 1975 von Huss in überarbeiteter Form.",
    verweis: { text: "Der Typ im Einzelnen", href: "/enterprise" },
  },
  {
    wort: "Überkopffahrgeschäft",
    erklaerung:
      "Ein Fahrgeschäft, bei dem Fahrgäste kopfüber geführt werden. Beim Enterprise passiert das am oberen Punkt des aufgerichteten Rades. Dass dabei niemand herausfällt, liegt nicht an einem Bügel, sondern daran, dass die Fliehkraft größer ist als die Schwerkraft.",
  },
  {
    wort: "Rundfahrgeschäft",
    erklaerung:
      "Sammelbegriff für Anlagen, die Fahrgäste im Kreis führen — Karussells, Kettenflieger, Break Dance, Enterprise. Die Abgrenzung ist das Hochfahrgeschäft, bei dem die Höhe den Reiz macht. Das Enterprise ist beides und wird deshalb in beide Listen einsortiert.",
  },
  {
    wort: "Gondel",
    erklaerung:
      "Der einzelne Wagen, in dem die Fahrgäste sitzen. Beim Mondlift sind es zwanzig, jede mit zwei Plätzen. Sie hängen beweglich am Radkranz und stellen sich von selbst in die Richtung, aus der die Kraft kommt — angetrieben wird daran nichts.",
  },
  {
    wort: "Radkranz",
    erklaerung:
      "Der äußere Ring des Rades, an dem die Gondeln hängen. Beim Mondlift hat er einen Durchmesser von etwa 22 Metern. Beim Original ist er doppelt ausgeführt: zwei Ringe mit Querstreben dazwischen, dazu die Lampenkette auf der Außenseite.",
  },
  {
    wort: "Nabe",
    erklaerung:
      "Die Mitte des Rades, in der die Drehachse und der Antrieb sitzen. Beim Aufrichten steigt die Nabe des Mondlifts von gut zweieinhalb auf rund zehn Meter — sie ist der Punkt, an dem man die Kippbewegung am besten sieht.",
  },
  {
    wort: "Ausleger",
    erklaerung:
      "Der tragende Arm zwischen Unterbau und Nabe. Er nimmt das ganze Rad auf und wird hydraulisch angehoben; dabei kippt das Rad um seine hintere Kante aus der Waagerechten in die Senkrechte.",
  },
  {
    wort: "Fachwerk",
    erklaerung:
      "Eine Tragkonstruktion aus Stäben, die zu Dreiecken verstrebt sind. Dreiecke lassen sich nicht verformen, ohne dass ein Stab länger oder kürzer wird — deshalb trägt ein Fachwerk viel bei wenig Gewicht. Das Rad eines Enterprise ist genau das und keine Scheibe mit Speichen.",
  },
  {
    wort: "Zentrifugalkraft",
    erklaerung:
      "Die Kraft, die einen Körper in einer Drehung nach außen zu drücken scheint. Physikalisch ist sie eine Trägheitskraft: der Körper will geradeaus weiter, das Rad zwingt ihn auf die Kreisbahn. Für die Fahrgäste im Enterprise ist sie das, was sie in den Sitz presst.",
    verweis: {
      text: "Zentrifugalkraft bei Wikipedia",
      href: "https://de.wikipedia.org/wiki/Zentrifugalkraft",
    },
  },
  {
    wort: "Resultierende Kraft",
    erklaerung:
      "Die Summe aller Kräfte, die auf einen Körper wirken, als eine einzige Kraft gedacht. Eine Gondel spürt zwei: die Schwerkraft nach unten und die Fliehkraft nach außen. Sie stellt sich in die Richtung der Summe — langsam und flach hängt sie nach unten, schnell und steil steht sie radial ab. Genau deshalb braucht die Animation auf der Startseite keine Sonderfälle.",
  },
  {
    wort: "g-Kraft",
    erklaerung:
      "Maß für Beschleunigung, angegeben in Vielfachen der Erdbeschleunigung. 1 g ist das gewohnte Gewicht im Stehen, bei 3 g fühlt sich ein Körper dreimal so schwer an. Für das Enterprise nennt die englische Wikipedia 3 g; die Angabe stammt aus einem einzelnen Steckbrief und gilt nicht für jede Anlage.",
    verweis: {
      text: "g-Kraft bei Wikipedia",
      href: "https://de.wikipedia.org/wiki/G-Kraft",
    },
  },
  {
    wort: "Rückhaltesystem",
    erklaerung:
      "Bügel, Gurte oder Schalen, die Fahrgäste im Sitz halten. Das Enterprise hat keine: die Gondel ist ein Käfig, dessen Gittertür während der Fahrt verriegelt ist, und gehalten wird der Körper allein von der Beschleunigung. Das ist der Grund, warum das Rad erst dreht und dann kippt — nie umgekehrt.",
  },
  {
    wort: "Anschlusswert",
    erklaerung:
      "Die elektrische Leistung, die ein Geschäft am Platz braucht, in Kilowatt. Für den Mondlift werden 90 kW angegeben. Für Schausteller und Veranstalter ist das eine der wichtigsten Zahlen überhaupt, weil davon abhängt, welcher Stellplatz überhaupt in Frage kommt.",
  },
  {
    wort: "Trailer",
    erklaerung:
      "Der Sattelauflieger, auf dem ein Reisegeschäft fährt — und bei vielen Anlagen gleichzeitig das Fundament, auf dem sie steht. Der Unterbau bleibt dabei auf dem Fahrzeug, es wird nur abgestützt und ausgerichtet.",
  },
  {
    wort: "Rüstzeit",
    erklaerung:
      "Die Zeit für Aufbau oder Abbau. Sie entscheidet darüber, wie viele Volksfeste eine Saison hergibt: je kürzer die Rüstzeit, desto mehr Plätze lassen sich in derselben Zeit beschicken.",
  },
  {
    wort: "Beschickung",
    erklaerung:
      "Die Bewerbung eines Schaustellers um einen Platz auf einem Volksfest und die Zuteilung durch den Veranstalter. Ob ein Geschäft im nächsten Jahr wieder dabei ist, entscheidet sich hier — und deshalb lassen sich künftige Standorte nie zuverlässig vorhersagen.",
  },
  {
    wort: "Schausteller",
    erklaerung:
      "Wer ein Fahrgeschäft, einen Stand oder ein Schaugeschäft auf Volksfesten betreibt — meist als Familienbetrieb über Generationen. Der Mondlift war von 1981 bis 2023 in der Hand der Münchener Familie Zehle und gehört seither der Zettl Enterprises KG.",
    verweis: {
      text: "Schausteller bei Wikipedia",
      href: "https://de.wikipedia.org/wiki/Schausteller",
    },
  },
  {
    wort: "Volksfest",
    erklaerung:
      "Die Veranstaltung, auf der Fahrgeschäfte stehen; regional auch Kirmes, Dult, Rummel, Messe oder Markt. Die größten in Deutschland sind das Münchener Oktoberfest, die Cranger Kirmes und der Hamburger Dom.",
    verweis: {
      text: "Volksfest bei Wikipedia",
      href: "https://de.wikipedia.org/wiki/Volksfest",
    },
  },
];

/**
 * Die Definitionsliste als HTML. Jedes Stichwort bekommt eine Sprungmarke,
 * damit sich ein einzelner Begriff verlinken lässt - von den anderen Seiten
 * und von außen.
 */
export function glossarHtml(): string {
  const eintraege = BEGRIFFE.map((begriff) => {
    const id = slug(begriff.wort);
    const verweis = begriff.verweis
      ? ` <a class="begriff__mehr" href="${escapeHtml(begriff.verweis.href)}">${escapeHtml(begriff.verweis.text)}</a>`
      : "";
    return [
      `<dt id="${escapeHtml(id)}">${escapeHtml(begriff.wort)}</dt>`,
      `<dd>${escapeHtml(begriff.erklaerung)}${verweis}</dd>`,
    ].join("\n");
  });

  return `<dl class="glossar">\n${eintraege.join("\n")}\n</dl>`;
}
