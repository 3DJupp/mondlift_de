/**
 * Die häufigen Fragen - einmal als Daten, je Sprache eine Liste.
 *
 * Aus derselben Liste entstehen der sichtbare Text auf /fragen bzw.
 * /en/faq und die strukturierten Daten (`FAQPage`). Das ist hier nicht nur
 * Bequemlichkeit: Google verlangt für FAQ-Daten ausdrücklich, dass die
 * ausgezeichnete und die sichtbare Fassung übereinstimmen. Mit zwei
 * Fassungen desselben Textes wäre das eine Frage der Disziplin, mit einer
 * ist es zugesichert.
 *
 * Antworten sind reiner Text, keine Auszeichnung. Was weiterführt, steht im
 * `link` und erscheint im HTML als Link hinter der Antwort.
 *
 * Die Regel für den Inhalt: Wo die Quellen auseinandergehen, sagt die
 * Antwort das - und nennt beide Zahlen. Eine Fanseite, die sich sicherer
 * gibt als ihre Quellen, ist als Quelle nichts wert.
 */

import { escapeHtml, slug } from "./html";
import type { Lang } from "./pages";

export interface FaqEntry {
  question: string;
  answer: string;
  link?: { text: string; href: string };
}

export const FAQ: Record<Lang, FaqEntry[]> = {
  de: [
    {
      question: "Was ist der Mondlift?",
      answer:
        "Ein reisendes Fahrgeschäft vom Typ Enterprise des Bremer Herstellers Huss. Ein Rad mit zwanzig frei schwenkenden Zwei-Personen-Gondeln dreht sich zunächst waagerecht wie ein Karussell und richtet sich dann bis fast in die Senkrechte auf, sodass die Gondeln über Kopf geführt werden. Es ist das einzige transportable Huss Enterprise, das in Deutschland noch im Einsatz ist.",
      link: { text: "Steckbrief und Geschichte", href: "/mondlift" },
    },
    {
      question: "Wer betreibt den Mondlift?",
      answer:
        "Seit dem Saisonende 2023 die Zettl Enterprises KG aus München. Davor gehörte das Geschäft von 1981 an der Münchener Schaustellerfamilie Zehle — zuerst Manfred, später Petra Zehle beziehungsweise die Mondlift GmbH. Der erste Besitzer war der niederländische Schausteller Michel Ropers, bei dem die Anlage noch unter dem englischen Namen Moonlift lief.",
    },
    {
      question: "Wie hoch ist der Mondlift?",
      answer:
        "Rund 22 Meter im aufgerichteten Zustand, bei einem Raddurchmesser von ebenfalls etwa 22 Metern. Der Platzbedarf wird mit 22 mal 22 Metern angegeben, der elektrische Anschlusswert mit 90 Kilowatt.",
    },
    {
      question: "Wann wurde der Mondlift gebaut?",
      answer:
        "Das ist nicht eindeutig belegt. Die Datenbanken nennen teils 1976, teils 1978; dieselbe Unsicherheit zieht sich durch die Angaben zur ersten Besitzzeit, die mal mit 1976 bis 1981 und mal mit 1978 bis 1981 angegeben wird. Als Seriennummer wird in Sammlerkreisen 31 053 genannt. Wer es genau wissen will, käme nur über die Unterlagen des Herstellers weiter.",
      link: { text: "Wo die Quellen auseinandergehen", href: "/fragen#streit" },
    },
    {
      question: "Wie viele Personen passen in den Mondlift?",
      answer:
        "Vierzig je Fahrt: zwanzig Gondeln mit jeweils zwei Plätzen. Die Stundenkapazität wird mit etwa 1.400 Personen angegeben — ein Wert, der neben der Fahrzeit vor allem vom Ein- und Aussteigen abhängt.",
    },
    {
      question: "Wie schnell dreht sich das Rad?",
      answer:
        "Für den Mondlift werden bis zu 14 Umdrehungen in der Minute genannt. Für den Typ Enterprise insgesamt gibt die deutsche Wikipedia 14 bis 17 Umdrehungen an. Bei 14 Umdrehungen in der Minute und 22 Metern Durchmesser legt eine Gondel gut 16 Meter in der Sekunde zurück, also etwa 58 Kilometer in der Stunde.",
    },
    {
      question: "Warum fällt im Enterprise niemand aus der Gondel?",
      answer:
        "Weil die Fliehkraft am oberen Punkt größer ist als die Schwerkraft. Der Körper wird nach außen in den Sitz gepresst, und außen ist am obersten Punkt oben. Deshalb ist die Reihenfolge der Fahrt keine Dramaturgie, sondern Technik: das Rad dreht erst auf Drehzahl und richtet sich dann auf. Angehalten wird in umgekehrter Reihenfolge.",
    },
    {
      question: "Gibt es Bügel oder Gurte?",
      answer:
        "Nein. Das Enterprise kommt ohne Rückhaltesystem aus — die Gondel ist ein Käfig, dessen Gittertür für die Fahrt verriegelt wird, und gehalten wird der Fahrgast allein von der Beschleunigung. Das ist bei Überkopffahrgeschäften die Ausnahme und einer der Gründe, warum die Bauform bis heute auffällt.",
    },
    {
      question: "Wer hat das Enterprise erfunden, Schwarzkopf oder Huss?",
      answer:
        "Beide haben Anteil. Gebaut hat es zuerst Anton Schwarzkopf, 1972, mit Premiere im August 1973 in Bad Kreuznach. Huss brachte 1975 eine technisch und optisch überarbeitete Fassung mit höherer Kapazität heraus — und hielt nach Angabe der englischen Wikipedia das Patent, obwohl die ursprüngliche Bauform nicht von dort kam. Eine Lizenzvereinbarung zwischen den beiden Firmen ist in den zugänglichen Quellen nicht belegt.",
      link: { text: "Die Geschichte des Typs", href: "/enterprise" },
    },
    {
      question: "Wie viele Enterprise wurden gebaut?",
      answer:
        "Die Zahlen widersprechen sich. Für Huss nennt DeWiki 74 Anlagen, ein Wikipedia-Spiegel rund 50 Auslieferungen; die englische Wikipedia führt für alle Hersteller zusammen etwa 64 Installationen. Für Schwarzkopf werden über 20 Geräte angegeben. Der Hersteller selbst sprach bei der Neuauflage der Bauform von mehr als 75 verkauften Exemplaren. Keine dieser Zahlen ließ sich gegen eine Primärquelle prüfen.",
    },
    {
      question: "Gibt es noch andere reisende Enterprise in Deutschland?",
      answer:
        "Nach derzeitigem Stand nicht. Der Mondlift gilt als das einzige transportable Huss Enterprise, das in Deutschland noch betrieben wird. In Freizeitparks steht die Bauform weiterhin an mehreren Orten, dort aber stationär — und der Hersteller bietet sie in neueren Ausführungen bis heute an.",
    },
    {
      question: "War der Mondlift auf dem Oktoberfest?",
      answer:
        "Ja, über viele Jahre. Nach ganz-muenchen.de stand er ab 1990 regelmäßig auf der Münchener Wiesn; danach gab es rund zehn Jahre lang kein Enterprise auf dem Oktoberfest, und ab 2005 war der Mondlift wieder dabei. Ob er nach dem Besitzerwechsel zur Zettl Enterprises KG im Herbst 2023 zurückkehrt, berichten die Quellen widersprüchlich. Welche Geschäfte auf der Wiesn stehen, legt die Stadt München jedes Jahr neu fest.",
      link: { text: "Wo er zu sehen war", href: "/mondlift#wo-er-zu-sehen-war" },
    },
    {
      question: "Wo steht der Mondlift gerade?",
      answer:
        "Diese Seite führt bewusst keinen Terminkalender. Wo ein Reisegeschäft in der nächsten Saison steht, entscheidet sich über die Beschickung, also die Bewerbung beim Veranstalter und dessen Zuteilung — verlässlich ist das immer erst kurz vorher. Belegt ist die Vergangenheit: auf dem Münchener Oktoberfest war der Mondlift von 1990 an regelmäßig, nach einer Pause wieder ab 2005, und er war mehrfach auf dem Hamburger Dom zu sehen. Ob er nach dem Besitzerwechsel auf die Wiesn zurückkehrt, berichten die Quellen widersprüchlich. Auskunft gibt der Veranstalter des jeweiligen Volksfestes.",
    },
    {
      question: "Ist diese Seite offiziell?",
      answer:
        "Nein. mondlift.de ist ein privates Hobbyprojekt und hat keine Verbindung zum Betreiber des Geschäfts oder zum Hersteller. Die Angaben sind zusammengetragen und mit Quelle versehen; Korrekturen sind ausdrücklich willkommen, besonders von Leuten, die es besser wissen müssen.",
      link: { text: "Korrektur schicken", href: "/kontakt" },
    },
  ],
  en: [
    {
      question: "What is the Mondlift?",
      answer:
        "A travelling fairground ride of the Enterprise type, made by the Bremen manufacturer Huss. A wheel with twenty freely swinging two-seat gondolas first turns flat like a roundabout and then tilts up almost to vertical, so the gondolas are carried upside down. It is the only transportable Huss Enterprise still in operation in Germany.",
      link: { text: "Fact sheet and history", href: "/en/mondlift" },
    },
    {
      question: "Who operates the Mondlift?",
      answer:
        "Since the end of the 2023 season, Zettl Enterprises KG from Munich. Before that, from 1981, the ride belonged to the Zehle family of showmen from Munich: first Manfred, later Petra Zehle and the Mondlift GmbH. The first owner was the Dutch showman Michel Ropers, under whom the ride still ran under the English name Moonlift.",
    },
    {
      question: "How tall is the Mondlift?",
      answer:
        "About 22 metres when raised, with a wheel diameter of roughly 22 metres as well. The space needed is given as 22 by 22 metres, the electrical connected load as 90 kilowatts.",
    },
    {
      question: "When was the Mondlift built?",
      answer:
        "That is not clearly documented. The databases give 1976 in some places and 1978 in others; the same uncertainty runs through the dates for the first ownership, given either as 1976 to 1981 or as 1978 to 1981. Collectors quote the serial number 31 053. Anyone who wants to know for certain would have to go through the manufacturer's records.",
      link: { text: "Where the sources disagree", href: "/en/faq#disputed" },
    },
    {
      question: "How many people fit in the Mondlift?",
      answer:
        "Forty per ride: twenty gondolas with two seats each. The hourly capacity is given as about 1,400 people, a figure that depends mainly on loading and unloading as well as on the length of the ride.",
    },
    {
      question: "How fast does the wheel turn?",
      answer:
        "For the Mondlift, up to 14 revolutions per minute are quoted. For the Enterprise type as a whole, the German Wikipedia gives 14 to 17. At 14 revolutions per minute and a diameter of 22 metres, a gondola covers a good 16 metres per second, or about 58 kilometres per hour.",
    },
    {
      question: "Why does nobody fall out of an Enterprise gondola?",
      answer:
        "Because at the top the centrifugal force is greater than gravity. The body is pressed outwards into the seat, and at the highest point outwards means up. That is why the order of the ride is engineering, not showmanship: the wheel first spins up to speed and only then tilts. Stopping happens in reverse order.",
    },
    {
      question: "Are there lap bars or belts?",
      answer:
        "No. The Enterprise has no restraint at all. The gondola is a cage whose mesh door is locked for the ride, and the rider is held in place by acceleration alone. Among inverting rides that is the exception and one of the reasons the design still stands out today.",
    },
    {
      question: "Who invented the Enterprise, Schwarzkopf or Huss?",
      answer:
        "Both played a part. Anton Schwarzkopf built it first, in 1972, with its premiere in August 1973 in Bad Kreuznach. Huss brought out a technically and visually revised version with higher capacity in 1975 and, according to the English Wikipedia, held the patent, even though the original design did not come from Huss. A licence agreement between the two companies is not documented in the available sources.",
      link: { text: "The history of the type", href: "/en/enterprise" },
    },
    {
      question: "How many Enterprise rides were built?",
      answer:
        "The figures contradict each other. For Huss, DeWiki gives 74 rides and a Wikipedia mirror about 50 deliveries; the English Wikipedia lists about 64 installations across all manufacturers. For Schwarzkopf, more than 20 are quoted. When the design was relaunched, the manufacturer itself spoke of more than 75 sold. None of these figures could be checked against a primary source.",
    },
    {
      question: "Are there other travelling Enterprise rides in Germany?",
      answer:
        "As things stand, no. The Mondlift is considered the only transportable Huss Enterprise still operated in Germany. The design can still be found at several amusement parks, but there it is fixed in place, and the manufacturer still offers it in newer versions today.",
    },
    {
      question: "Has the Mondlift been at the Oktoberfest?",
      answer:
        "Yes, for many years. According to ganz-muenchen.de it stood at the Munich Wiesn regularly from 1990; after that there was no Enterprise at the Oktoberfest for about ten years, and from 2005 the Mondlift was back. Whether it returns after the change of ownership to Zettl Enterprises KG in autumn 2023 is reported inconsistently. Which rides stand at the Wiesn is decided anew by the City of Munich every year.",
      link: { text: "Where it has been", href: "/en/mondlift#where-it-has-been" },
    },
    {
      question: "Where is the Mondlift right now?",
      answer:
        "This site deliberately keeps no calendar. Where a travelling ride stands next season is decided through pitch allocation, that is the application to the organiser and the organiser's decision, and that is only reliable shortly before. What is documented is the past: the Mondlift was at the Munich Oktoberfest regularly from 1990, again from 2005 after a break, and it appeared several times at the Hamburger Dom. Whether it returns to the Wiesn after the change of ownership is reported inconsistently. The organiser of each funfair can tell you.",
    },
    {
      question: "Is this site official?",
      answer:
        "No. mondlift.de is a private hobby project with no connection to the operator of the ride or to the manufacturer. The information has been collected and comes with sources; corrections are very welcome, especially from people who are in a position to know better.",
      link: { text: "Send a correction", href: "/en/contact" },
    },
  ],
};

/** Die Fragen als HTML, jede mit Sprungmarke. */
export function faqHtml(lang: Lang): string {
  return FAQ[lang].map((entry) => {
    const id = slug(entry.question);
    const link = entry.link
      ? `\n<p class="question__more"><a href="${escapeHtml(entry.link.href)}">${escapeHtml(entry.link.text)}</a></p>`
      : "";
    return [
      `<div class="question">`,
      `<h3 id="${escapeHtml(id)}">${escapeHtml(entry.question)}</h3>`,
      `<p>${escapeHtml(entry.answer)}</p>${link}`,
      `</div>`,
    ].join("\n");
  }).join("\n");
}
