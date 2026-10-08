/**
 * Die häufigen Fragen - einmal als Daten.
 *
 * Aus derselben Liste entstehen der sichtbare Text auf /fragen und die
 * strukturierten Daten (`FAQPage`). Das ist hier nicht nur Bequemlichkeit:
 * Google verlangt für FAQ-Daten ausdrücklich, dass die ausgezeichnete und
 * die sichtbare Fassung übereinstimmen. Mit zwei Fassungen desselben
 * Textes wäre das eine Frage der Disziplin, mit einer ist es zugesichert.
 *
 * Antworten sind reiner Text, keine Auszeichnung. Was weiterführt, steht im
 * `verweis` und erscheint im HTML als Link hinter der Antwort.
 *
 * Die Regel für den Inhalt: Wo die Quellen auseinandergehen, sagt die
 * Antwort das - und nennt beide Zahlen. Eine Fanseite, die sich sicherer
 * gibt als ihre Quellen, ist als Quelle nichts wert.
 */

import { escapeHtml, slug } from "./html";

export interface Frage {
  frage: string;
  antwort: string;
  verweis?: { text: string; href: string };
}

export const FRAGEN: Frage[] = [
  {
    frage: "Was ist der Mondlift?",
    antwort:
      "Ein reisendes Fahrgeschäft vom Typ Enterprise des Bremer Herstellers Huss. Ein Rad mit zwanzig frei schwenkenden Zwei-Personen-Gondeln dreht sich zunächst waagerecht wie ein Karussell und richtet sich dann bis fast in die Senkrechte auf, sodass die Gondeln über Kopf geführt werden. Es ist das einzige transportable Huss Enterprise, das in Deutschland noch im Einsatz ist.",
    verweis: { text: "Steckbrief und Geschichte", href: "/mondlift" },
  },
  {
    frage: "Wer betreibt den Mondlift?",
    antwort:
      "Seit dem Saisonende 2023 die Zettl Enterprises KG aus München. Davor gehörte das Geschäft von 1981 an der Münchener Schaustellerfamilie Zehle — zuerst Manfred, später Petra Zehle beziehungsweise die Mondlift GmbH. Der erste Besitzer war der niederländische Schausteller Michel Ropers, bei dem die Anlage noch unter dem englischen Namen Moonlift lief.",
  },
  {
    frage: "Wie hoch ist der Mondlift?",
    antwort:
      "Rund 22 Meter im aufgerichteten Zustand, bei einem Raddurchmesser von ebenfalls etwa 22 Metern. Der Platzbedarf wird mit 22 mal 22 Metern angegeben, der elektrische Anschlusswert mit 90 Kilowatt.",
  },
  {
    frage: "Wann wurde der Mondlift gebaut?",
    antwort:
      "Das ist nicht eindeutig belegt. Die Datenbanken nennen teils 1976, teils 1978; dieselbe Unsicherheit zieht sich durch die Angaben zur ersten Besitzzeit, die mal mit 1976 bis 1981 und mal mit 1978 bis 1981 angegeben wird. Als Seriennummer wird in Sammlerkreisen 31 053 genannt. Wer es genau wissen will, käme nur über die Unterlagen des Herstellers weiter.",
    verweis: { text: "Wo die Quellen auseinandergehen", href: "/fragen#streit" },
  },
  {
    frage: "Wie viele Personen passen in den Mondlift?",
    antwort:
      "Vierzig je Fahrt: zwanzig Gondeln mit jeweils zwei Plätzen. Die Stundenkapazität wird mit etwa 1.400 Personen angegeben — ein Wert, der neben der Fahrzeit vor allem vom Ein- und Aussteigen abhängt.",
  },
  {
    frage: "Wie schnell dreht sich das Rad?",
    antwort:
      "Für den Mondlift werden bis zu 14 Umdrehungen in der Minute genannt. Für den Typ Enterprise insgesamt gibt die deutsche Wikipedia 14 bis 17 Umdrehungen an. Bei 14 Umdrehungen in der Minute und 22 Metern Durchmesser legt eine Gondel gut 16 Meter in der Sekunde zurück, also etwa 58 Kilometer in der Stunde.",
  },
  {
    frage: "Warum fällt im Enterprise niemand aus der Gondel?",
    antwort:
      "Weil die Fliehkraft am oberen Punkt größer ist als die Schwerkraft. Der Körper wird nach außen in den Sitz gepresst, und außen ist am obersten Punkt oben. Deshalb ist die Reihenfolge der Fahrt keine Dramaturgie, sondern Technik: das Rad dreht erst auf Drehzahl und richtet sich dann auf. Angehalten wird in umgekehrter Reihenfolge.",
  },
  {
    frage: "Gibt es Bügel oder Gurte?",
    antwort:
      "Nein. Das Enterprise kommt ohne Rückhaltesystem aus — die Gondel ist ein Käfig, dessen Gittertür für die Fahrt verriegelt wird, und gehalten wird der Fahrgast allein von der Beschleunigung. Das ist bei Überkopffahrgeschäften die Ausnahme und einer der Gründe, warum die Bauform bis heute auffällt.",
  },
  {
    frage: "Wer hat das Enterprise erfunden, Schwarzkopf oder Huss?",
    antwort:
      "Beide haben Anteil. Gebaut hat es zuerst Anton Schwarzkopf, 1972, mit Premiere im August 1973 in Bad Kreuznach. Huss brachte 1975 eine technisch und optisch überarbeitete Fassung mit höherer Kapazität heraus — und hielt nach Angabe der englischen Wikipedia das Patent, obwohl die ursprüngliche Bauform nicht von dort kam. Eine Lizenzvereinbarung zwischen den beiden Firmen ist in den zugänglichen Quellen nicht belegt.",
    verweis: { text: "Die Geschichte des Typs", href: "/enterprise" },
  },
  {
    frage: "Wie viele Enterprise wurden gebaut?",
    antwort:
      "Die Zahlen widersprechen sich. Für Huss nennt DeWiki 74 Anlagen, ein Wikipedia-Spiegel rund 50 Auslieferungen; die englische Wikipedia führt für alle Hersteller zusammen etwa 64 Installationen. Für Schwarzkopf werden über 20 Geräte angegeben. Der Hersteller selbst sprach bei der Neuauflage der Bauform von mehr als 75 verkauften Exemplaren. Keine dieser Zahlen ließ sich gegen eine Primärquelle prüfen.",
  },
  {
    frage: "Gibt es noch andere reisende Enterprise in Deutschland?",
    antwort:
      "Nach derzeitigem Stand nicht. Der Mondlift gilt als das einzige transportable Huss Enterprise, das in Deutschland noch betrieben wird. In Freizeitparks steht die Bauform weiterhin an mehreren Orten, dort aber stationär — und der Hersteller bietet sie in neueren Ausführungen bis heute an.",
  },
  {
    frage: "Wo steht der Mondlift gerade?",
    antwort:
      "Diese Seite führt bewusst keinen Terminkalender. Wo ein Reisegeschäft in der nächsten Saison steht, entscheidet sich über die Beschickung, also die Bewerbung beim Veranstalter und dessen Zuteilung — verlässlich ist das immer erst kurz vorher. Belegt ist die Vergangenheit: auf dem Münchener Oktoberfest war der Mondlift von 1990 an regelmäßig, nach einer Pause wieder ab 2005, und er war mehrfach auf dem Hamburger Dom zu sehen. Ob er nach dem Besitzerwechsel auf die Wiesn zurückkehrt, berichten die Quellen widersprüchlich. Auskunft gibt der Veranstalter des jeweiligen Volksfestes.",
  },
  {
    frage: "Ist diese Seite offiziell?",
    antwort:
      "Nein. mondlift.de ist ein privates Hobbyprojekt und hat keine Verbindung zum Betreiber des Geschäfts oder zum Hersteller. Die Angaben sind zusammengetragen und mit Quelle versehen; Korrekturen sind ausdrücklich willkommen, besonders von Leuten, die es besser wissen müssen.",
    verweis: { text: "Korrektur schicken", href: "/kontakt" },
  },
];

/** Die Fragen als HTML, jede mit Sprungmarke. */
export function fragenHtml(): string {
  return FRAGEN.map((eintrag) => {
    const id = slug(eintrag.frage);
    const verweis = eintrag.verweis
      ? `\n<p class="frage__mehr"><a href="${escapeHtml(eintrag.verweis.href)}">${escapeHtml(eintrag.verweis.text)}</a></p>`
      : "";
    return [
      `<div class="frage">`,
      `<h3 id="${escapeHtml(id)}">${escapeHtml(eintrag.frage)}</h3>`,
      `<p>${escapeHtml(eintrag.antwort)}</p>${verweis}`,
      `</div>`,
    ].join("\n");
  }).join("\n");
}
