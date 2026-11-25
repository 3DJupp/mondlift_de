/**
 * Die Begriffe des Glossars - einmal als Daten, je Sprache eine Liste.
 *
 * Warum nicht als HTML in public/: von dieser Liste gibt es zwei Fassungen,
 * die sichtbare Definitionsliste und die strukturierten Daten
 * (`DefinedTermSet`). Zwei Fassungen desselben Textes laufen auseinander,
 * sobald jemand nur eine davon anfasst. Deshalb steht der Text hier, und
 * beide Fassungen entstehen daraus - das HTML serverseitig im
 * HTMLRewriter, die strukturierten Daten in structured-data.ts.
 *
 * Reihenfolge: vom Gerät nach außen zum Betrieb, nicht alphabetisch. Wer
 * einen einzelnen Begriff sucht, nimmt die Suche des Browsers; wer sich
 * einliest, liest der Sache nach. Beide Sprachen haben dieselbe
 * Reihenfolge, damit sich die Listen nebeneinander pflegen lassen.
 */

import { escapeHtml, slug } from "./html";
import type { Lang } from "./pages";

export interface Term {
  /** Das Stichwort, wie es in der Liste steht. */
  term: string;
  /** Erklärung in einem bis drei Sätzen. Nur Text, kein HTML. */
  definition: string;
  /** Weiterführender Verweis, intern oder nach außen. */
  link?: { text: string; href: string };
}

export const GLOSSARY: Record<Lang, Term[]> = {
  de: [
    {
      term: "Fahrgeschäft",
      definition:
        "Eine Anlage, die Fahrgäste zum Vergnügen bewegt — vom Kinderkarussell bis zur Achterbahn. Der Begriff stammt aus dem Schaustellergewerbe und meint immer beides: die Maschine und das Geschäft, das jemand damit betreibt.",
    },
    {
      term: "Reisegeschäft",
      definition:
        "Ein Fahrgeschäft, das nach jedem Volksfest abgebaut, auf Trailer verladen und am nächsten Ort wieder aufgebaut wird. Das Gegenstück ist die stationäre Anlage im Freizeitpark, die einmal gegründet wird und stehen bleibt. Reisegeschäfte müssen deshalb zerlegbar, straßentauglich und in ein bis zwei Tagen aufbaubar sein — das prägt ihre ganze Bauweise.",
    },
    {
      term: "Enterprise",
      definition:
        "Die Bauform, zu der der Mondlift gehört: ein Rad mit frei schwenkenden Zwei-Personen-Gondeln am Kranz, das sich während der Fahrt aus der Waagerechten in die Senkrechte aufrichtet. Zuerst 1972 von Anton Schwarzkopf gebaut, ab 1975 von Huss in überarbeiteter Form.",
      link: { text: "Der Typ im Einzelnen", href: "/enterprise" },
    },
    {
      term: "Überkopffahrgeschäft",
      definition:
        "Ein Fahrgeschäft, bei dem Fahrgäste kopfüber geführt werden. Beim Enterprise passiert das am oberen Punkt des aufgerichteten Rades. Dass dabei niemand herausfällt, liegt nicht an einem Bügel, sondern daran, dass die Fliehkraft größer ist als die Schwerkraft.",
    },
    {
      term: "Rundfahrgeschäft",
      definition:
        "Sammelbegriff für Anlagen, die Fahrgäste im Kreis führen — Karussells, Kettenflieger, Break Dance, Enterprise. Die Abgrenzung ist das Hochfahrgeschäft, bei dem die Höhe den Reiz macht. Das Enterprise ist beides und wird deshalb in beide Listen einsortiert.",
    },
    {
      term: "Gondel",
      definition:
        "Der einzelne Wagen, in dem die Fahrgäste sitzen. Beim Mondlift sind es zwanzig, jede mit zwei Plätzen. Sie hängen beweglich am Radkranz und stellen sich von selbst in die Richtung, aus der die Kraft kommt — angetrieben wird daran nichts.",
    },
    {
      term: "Radkranz",
      definition:
        "Der äußere Ring des Rades, an dem die Gondeln hängen. Beim Mondlift hat er einen Durchmesser von etwa 22 Metern. Beim Original ist er doppelt ausgeführt: zwei Ringe mit Querstreben dazwischen, dazu die Lampenkette auf der Außenseite.",
    },
    {
      term: "Nabe",
      definition:
        "Die Mitte des Rades, in der die Drehachse und der Antrieb sitzen. Beim Aufrichten steigt die Nabe des Mondlifts von gut zweieinhalb auf rund zehn Meter — sie ist der Punkt, an dem man die Kippbewegung am besten sieht.",
    },
    {
      term: "Ausleger",
      definition:
        "Der tragende Arm zwischen Unterbau und Nabe. Er nimmt das ganze Rad auf und wird hydraulisch angehoben; dabei kippt das Rad um seine hintere Kante aus der Waagerechten in die Senkrechte.",
    },
    {
      term: "Fachwerk",
      definition:
        "Eine Tragkonstruktion aus Stäben, die zu Dreiecken verstrebt sind. Dreiecke lassen sich nicht verformen, ohne dass ein Stab länger oder kürzer wird — deshalb trägt ein Fachwerk viel bei wenig Gewicht. Das Rad eines Enterprise ist genau das und keine Scheibe mit Speichen.",
    },
    {
      term: "Zentrifugalkraft",
      definition:
        "Die Kraft, die einen Körper in einer Drehung nach außen zu drücken scheint. Physikalisch ist sie eine Trägheitskraft: der Körper will geradeaus weiter, das Rad zwingt ihn auf die Kreisbahn. Für die Fahrgäste im Enterprise ist sie das, was sie in den Sitz presst.",
      link: {
        text: "Zentrifugalkraft bei Wikipedia",
        href: "https://de.wikipedia.org/wiki/Zentrifugalkraft",
      },
    },
    {
      term: "Resultierende Kraft",
      definition:
        "Die Summe aller Kräfte, die auf einen Körper wirken, als eine einzige Kraft gedacht. Eine Gondel spürt zwei: die Schwerkraft nach unten und die Fliehkraft nach außen. Sie stellt sich in die Richtung der Summe — langsam und flach hängt sie nach unten, schnell und steil steht sie radial ab. Genau deshalb braucht die Animation auf der Startseite keine Sonderfälle.",
    },
    {
      term: "g-Kraft",
      definition:
        "Maß für Beschleunigung, angegeben in Vielfachen der Erdbeschleunigung. 1 g ist das gewohnte Gewicht im Stehen, bei 3 g fühlt sich ein Körper dreimal so schwer an. Für das Enterprise nennt die englische Wikipedia 3 g; die Angabe stammt aus einem einzelnen Steckbrief und gilt nicht für jede Anlage.",
      link: {
        text: "g-Kraft bei Wikipedia",
        href: "https://de.wikipedia.org/wiki/G-Kraft",
      },
    },
    {
      term: "Rückhaltesystem",
      definition:
        "Bügel, Gurte oder Schalen, die Fahrgäste im Sitz halten. Das Enterprise hat keine: die Gondel ist ein Käfig, dessen Gittertür während der Fahrt verriegelt ist, und gehalten wird der Körper allein von der Beschleunigung. Das ist der Grund, warum das Rad erst dreht und dann kippt — nie umgekehrt.",
    },
    {
      term: "Anschlusswert",
      definition:
        "Die elektrische Leistung, die ein Geschäft am Platz braucht, in Kilowatt. Für den Mondlift werden 90 kW angegeben. Für Schausteller und Veranstalter ist das eine der wichtigsten Zahlen überhaupt, weil davon abhängt, welcher Stellplatz überhaupt in Frage kommt.",
    },
    {
      term: "Trailer",
      definition:
        "Der Sattelauflieger, auf dem ein Reisegeschäft fährt — und bei vielen Anlagen gleichzeitig das Fundament, auf dem sie steht. Der Unterbau bleibt dabei auf dem Fahrzeug, es wird nur abgestützt und ausgerichtet.",
    },
    {
      term: "Rüstzeit",
      definition:
        "Die Zeit für Aufbau oder Abbau. Sie entscheidet darüber, wie viele Volksfeste eine Saison hergibt: je kürzer die Rüstzeit, desto mehr Plätze lassen sich in derselben Zeit beschicken.",
    },
    {
      term: "Beschickung",
      definition:
        "Die Bewerbung eines Schaustellers um einen Platz auf einem Volksfest und die Zuteilung durch den Veranstalter. Ob ein Geschäft im nächsten Jahr wieder dabei ist, entscheidet sich hier — und deshalb lassen sich künftige Standorte nie zuverlässig vorhersagen.",
    },
    {
      term: "Schausteller",
      definition:
        "Wer ein Fahrgeschäft, einen Stand oder ein Schaugeschäft auf Volksfesten betreibt — meist als Familienbetrieb über Generationen. Der Mondlift war von 1981 bis 2023 in der Hand der Münchener Familie Zehle und gehört seither der Zettl Enterprises KG.",
      link: {
        text: "Schausteller bei Wikipedia",
        href: "https://de.wikipedia.org/wiki/Schausteller",
      },
    },
    {
      term: "Volksfest",
      definition:
        "Die Veranstaltung, auf der Fahrgeschäfte stehen; regional auch Kirmes, Dult, Rummel, Messe oder Markt. Die größten in Deutschland sind das Münchener Oktoberfest, die Cranger Kirmes und der Hamburger Dom.",
      link: {
        text: "Volksfest bei Wikipedia",
        href: "https://de.wikipedia.org/wiki/Volksfest",
      },
    },
  ],
  en: [
    {
      term: "Fairground ride",
      definition:
        "A machine that moves riders for fun, from a children's roundabout to a roller coaster. The German word Fahrgeschäft comes from the showmen's trade and always means both things at once: the machine and the business someone runs with it.",
    },
    {
      term: "Travelling ride",
      definition:
        "A ride that is taken down after every funfair, loaded onto trailers and built up again at the next place. Its counterpart is the fixed installation in an amusement park, which is put on foundations once and stays. Travelling rides therefore have to come apart, be fit for the road and go up in one or two days, and that shapes their whole design.",
    },
    {
      term: "Enterprise",
      definition:
        "The ride type the Mondlift belongs to: a wheel with freely swinging two-seat gondolas on its rim that tilts from horizontal to vertical during the ride. First built by Anton Schwarzkopf in 1972, from 1975 by Huss in a revised form.",
      link: { text: "The type in detail", href: "/en/enterprise" },
    },
    {
      term: "Inverting ride",
      definition:
        "A ride that turns its riders upside down. On an Enterprise this happens at the top of the raised wheel. Nobody falls out, and that is not down to a lap bar but to the centrifugal force being greater than gravity.",
    },
    {
      term: "Rotating ride",
      definition:
        "Umbrella term for rides that take their riders round in a circle: roundabouts, chair swings, Break Dance, Enterprise. The contrast is the height ride, whose appeal is altitude. The Enterprise is both, which is why it turns up in both lists.",
    },
    {
      term: "Gondola",
      definition:
        "The single car the riders sit in. The Mondlift has twenty, each with two seats. They hang freely from the wheel rim and turn by themselves towards the direction the force comes from; nothing on them is driven.",
    },
    {
      term: "Wheel rim",
      definition:
        "The outer ring of the wheel that carries the gondolas. On the Mondlift it is about 22 metres across. On the original it is built double: two rings with cross bracing between them, plus the chain of lights on the outside.",
    },
    {
      term: "Hub",
      definition:
        "The centre of the wheel, where the axle and the drive sit. As the Mondlift tilts up, its hub rises from a good two and a half metres to about ten. It is the point where the tilting movement is easiest to see.",
    },
    {
      term: "Boom",
      definition:
        "The load-bearing arm between the base and the hub. It carries the whole wheel and is raised hydraulically, tipping the wheel about its rear edge from horizontal to vertical.",
    },
    {
      term: "Truss",
      definition:
        "A load-bearing structure made of members braced into triangles. A triangle cannot change shape unless one of its members gets longer or shorter, so a truss carries a lot for little weight. The wheel of an Enterprise is exactly that, not a disc with spokes.",
    },
    {
      term: "Centrifugal force",
      definition:
        "The force that seems to push a body outwards when it turns. Physically it is an inertial force: the body wants to carry on in a straight line, and the wheel forces it onto a circle. For the riders of an Enterprise it is what presses them into the seat.",
      link: {
        text: "Centrifugal force on Wikipedia",
        href: "https://en.wikipedia.org/wiki/Centrifugal_force",
      },
    },
    {
      term: "Resultant force",
      definition:
        "The sum of all forces acting on a body, thought of as one single force. A gondola feels two: gravity downwards and centrifugal force outwards. It lines up with their sum. Slow and flat, it hangs down; fast and steep, it stands out radially. That is why the animation on the home page needs no special cases.",
    },
    {
      term: "g-force",
      definition:
        "A measure of acceleration, given in multiples of the acceleration due to gravity. 1 g is your normal weight standing up; at 3 g a body feels three times as heavy. The English Wikipedia gives 3 g for the Enterprise; the figure comes from a single fact sheet and does not apply to every ride.",
      link: {
        text: "g-force on Wikipedia",
        href: "https://en.wikipedia.org/wiki/G-force",
      },
    },
    {
      term: "Restraint",
      definition:
        "Lap bars, belts or shoulder harnesses that keep riders in their seat. The Enterprise has none: the gondola is a cage whose mesh door is locked during the ride, and the body is held in place by acceleration alone. That is why the wheel always spins first and tilts second, never the other way round.",
    },
    {
      term: "Connected load",
      definition:
        "The electrical power a ride needs on site, in kilowatts. For the Mondlift the figure given is 90 kW. For showmen and organisers it is one of the most important numbers of all, because it decides which pitch is possible in the first place.",
    },
    {
      term: "Trailer",
      definition:
        "The semi-trailer a travelling ride moves on, and on many rides also the foundation it stands on. The base stays on the vehicle; it is only jacked up and levelled.",
    },
    {
      term: "Build-up time",
      definition:
        "The time it takes to put a ride up or take it down. It decides how many funfairs a season can hold: the shorter the build-up time, the more pitches can be played in the same period.",
    },
    {
      term: "Pitch allocation",
      definition:
        "A showman's application for a place at a funfair and the organiser's decision on it (in German: Beschickung). Whether a ride is back next year is decided here, which is why future locations can never be predicted reliably.",
    },
    {
      term: "Showman",
      definition:
        "Someone who runs a ride, a stall or a show at funfairs, usually as a family business over generations. The Mondlift was owned by the Zehle family from Munich from 1981 to 2023 and has belonged to Zettl Enterprises KG since.",
      link: {
        text: "Showman on Wikipedia",
        href: "https://en.wikipedia.org/wiki/Showman",
      },
    },
    {
      term: "Funfair",
      definition:
        "The event where rides stand; in German regionally Volksfest, Kirmes, Dult, Rummel, Messe or Markt. The largest in Germany are the Munich Oktoberfest, the Cranger Kirmes and the Hamburger Dom.",
      link: {
        text: "Funfair on Wikipedia",
        href: "https://en.wikipedia.org/wiki/Funfair",
      },
    },
  ],
};

/**
 * Die Definitionsliste als HTML. Jedes Stichwort bekommt eine Sprungmarke,
 * damit sich ein einzelner Begriff verlinken lässt - von den anderen Seiten
 * und von außen.
 */
export function glossaryHtml(lang: Lang): string {
  const entries = GLOSSARY[lang].map((entry) => {
    const id = slug(entry.term);
    const link = entry.link
      ? ` <a class="term__more" href="${escapeHtml(entry.link.href)}">${escapeHtml(entry.link.text)}</a>`
      : "";
    return [
      `<dt id="${escapeHtml(id)}">${escapeHtml(entry.term)}</dt>`,
      `<dd>${escapeHtml(entry.definition)}${link}</dd>`,
    ].join("\n");
  });

  return `<dl class="glossary">\n${entries.join("\n")}\n</dl>`;
}
