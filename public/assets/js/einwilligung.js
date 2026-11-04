/*
 * Einwilligung für Google Analytics.
 *
 * Dieses Skript bindet der Worker nur ein, wenn in wrangler.jsonc eine
 * GA4-Mess-ID gesetzt ist (siehe src/analytics.ts). Die ID steht dann in
 * <meta name="ga-measurement-id">.
 *
 * Ablauf:
 *  - Ohne gespeicherte Wahl erscheint unten ein Banner mit zwei gleich
 *    gewichteten Knöpfen: „Ablehnen" und „Zulassen".
 *  - gtag.js wird erst nach „Zulassen" geladen. Vorher geht keine einzige
 *    Anfrage an Google.
 *  - Die Wahl liegt im localStorage (das ist für die Einwilligung selbst
 *    zulässig, § 25 Abs. 2 TDDDG) und gilt zwölf Monate.
 *  - Jedes Element mit data-einwilligung-oeffnen öffnet das Banner erneut,
 *    etwa der Knopf in der Datenschutzerklärung. Wer dort widerruft, dessen
 *    GA-Cookies werden gelöscht.
 */
(function () {
  "use strict";

  var meta = document.querySelector('meta[name="ga-measurement-id"]');
  var gaId = meta && meta.getAttribute("content");
  if (!gaId || !/^G-[A-Z0-9]{4,16}$/.test(gaId)) return;

  var SCHLUESSEL = "mondlift-einwilligung";
  var VERSION = 1;
  var GUELTIG_MS = 365 * 24 * 60 * 60 * 1000;

  function lesen() {
    try {
      var roh = window.localStorage.getItem(SCHLUESSEL);
      if (!roh) return null;
      var wahl = JSON.parse(roh);
      if (!wahl || wahl.v !== VERSION) return null;
      if (typeof wahl.t !== "number" || Date.now() - wahl.t > GUELTIG_MS) return null;
      if (wahl.analytics !== true && wahl.analytics !== false) return null;
      return wahl.analytics;
    } catch (e) {
      return null;
    }
  }

  function speichern(analytics) {
    try {
      window.localStorage.setItem(
        SCHLUESSEL,
        JSON.stringify({ v: VERSION, t: Date.now(), analytics: analytics }),
      );
    } catch (e) {
      /* Ohne Speicher gilt die Wahl nur für diesen Seitenaufruf. */
    }
  }

  var geladen = false;

  function gtagLaden() {
    if (geladen) return;
    geladen = true;
    window["ga-disable-" + gaId] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    // Consent Mode: Analyse ja, alles rund um Werbung nein.
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", gaId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId);
    document.head.appendChild(script);
  }

  /** Löscht die Cookies, die GA4 setzt (_ga, _ga_<ID>, _gid). */
  function gaCookiesLoeschen() {
    var host = window.location.hostname;
    var domains = ["", host, "." + host];
    var teile = host.split(".");
    if (teile.length > 2) domains.push("." + teile.slice(-2).join("."));
    document.cookie.split(";").forEach(function (eintrag) {
      var name = eintrag.split("=")[0].trim();
      if (!/^_ga($|_)|^_gid$|^_gat/.test(name)) return;
      domains.forEach(function (domain) {
        document.cookie =
          name +
          "=; Max-Age=0; Path=/" +
          (domain ? "; Domain=" + domain : "") +
          "; SameSite=Lax";
      });
    });
  }

  var banner = null;

  function bannerBauen() {
    var box = document.createElement("section");
    box.className = "einwilligung";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-labelledby", "einwilligung-titel");
    box.setAttribute("aria-describedby", "einwilligung-text");
    box.hidden = true;

    var titel = document.createElement("h2");
    titel.id = "einwilligung-titel";
    titel.className = "einwilligung__titel";
    titel.textContent = "Darf ich zählen, wie die Seite genutzt wird?";

    var text = document.createElement("p");
    text.id = "einwilligung-text";
    text.className = "einwilligung__text";
    text.appendChild(
      document.createTextNode(
        "Mit Ihrer Einwilligung lädt diese Seite Google Analytics. Dabei werden " +
          "Cookies gesetzt und Nutzungsdaten an Google übermittelt, auch in die USA. " +
          "Ohne Einwilligung passiert nichts davon, und die Seite funktioniert genauso. " +
          "Sie können Ihre Wahl jederzeit in der ",
      ),
    );
    var link = document.createElement("a");
    link.href = "/datenschutz#analytics";
    link.textContent = "Datenschutzerklärung";
    text.appendChild(link);
    text.appendChild(document.createTextNode(" ändern."));

    var knoepfe = document.createElement("div");
    knoepfe.className = "einwilligung__knoepfe";

    function knopf(beschriftung, analytics) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn einwilligung__knopf";
      b.textContent = beschriftung;
      b.addEventListener("click", function () {
        entscheiden(analytics);
      });
      return b;
    }

    knoepfe.appendChild(knopf("Ablehnen", false));
    knoepfe.appendChild(knopf("Zulassen", true));

    box.appendChild(titel);
    box.appendChild(text);
    box.appendChild(knoepfe);
    document.body.appendChild(box);
    return box;
  }

  /**
   * Beim ersten Besuch ohne Fokuswechsel, damit Tastatur und Screenreader
   * nicht mitten aus der Seite gerissen werden. Öffnet jemand das Banner
   * selbst, springt der Fokus hinein.
   */
  function bannerZeigen(fokus) {
    if (!banner) banner = bannerBauen();
    banner.hidden = false;
    if (fokus) {
      var erster = banner.querySelector("button");
      if (erster) erster.focus({ preventScroll: true });
    }
  }

  function bannerSchliessen() {
    if (banner) banner.hidden = true;
  }

  function entscheiden(analytics) {
    var vorher = lesen();
    speichern(analytics);
    bannerSchliessen();
    if (analytics) {
      gtagLaden();
    } else {
      window["ga-disable-" + gaId] = true;
      gaCookiesLoeschen();
      // War gtag.js schon geladen, hilft nur ein Neuladen, um es loszuwerden.
      if (geladen || vorher === true) window.location.reload();
    }
    statusAnzeigen();
  }

  /** Zeigt in der Datenschutzerklärung die aktuelle Wahl an. */
  function statusAnzeigen() {
    var wahl = lesen();
    var text =
      wahl === true
        ? "Aktuell: Google Analytics ist zugelassen."
        : wahl === false
          ? "Aktuell: Google Analytics ist abgelehnt."
          : "Aktuell: Sie haben noch keine Wahl getroffen.";
    document.querySelectorAll("[data-einwilligung-status]").forEach(function (el) {
      el.textContent = text;
    });
  }

  function start() {
    document.querySelectorAll("[data-einwilligung-oeffnen]").forEach(function (el) {
      el.hidden = false;
      el.addEventListener("click", function (event) {
        event.preventDefault();
        bannerZeigen(true);
      });
    });
    statusAnzeigen();

    var wahl = lesen();
    if (wahl === true) gtagLaden();
    else if (wahl === null) bannerZeigen(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
