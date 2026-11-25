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
 *  - Die Texte gibt es auf Deutsch und Englisch; welche gilt, sagt das
 *    lang-Attribut der Seite.
 *  - Jedes Element mit data-consent-open öffnet das Banner erneut,
 *    etwa der Knopf in der Datenschutzerklärung. Wer dort widerruft, dessen
 *    GA-Cookies werden gelöscht.
 */
(function () {
  "use strict";

  var meta = document.querySelector('meta[name="ga-measurement-id"]');
  var gaId = meta && meta.getAttribute("content");
  if (!gaId || !/^G-[A-Z0-9]{4,16}$/.test(gaId)) return;

  var STORAGE_KEY = "mondlift-consent";
  var VERSION = 1;
  var VALID_MS = 365 * 24 * 60 * 60 * 1000;

  var EN = document.documentElement.lang === "en";
  var TEXT = EN
    ? {
        title: "May I count how the site is used?",
        body:
          "With your consent this site loads Google Analytics. Cookies are set and " +
          "usage data is sent to Google, including to the USA. Without consent none " +
          "of this happens, and the site works just the same. You can change your " +
          "choice at any time in the ",
        link: "privacy notice",
        href: "/en/privacy#analytics",
        after: ".",
        decline: "Decline",
        allow: "Allow",
        allowed: "Currently: Google Analytics is allowed.",
        declined: "Currently: Google Analytics is declined.",
        none: "Currently: you have not made a choice yet.",
      }
    : {
        title: "Darf ich zählen, wie die Seite genutzt wird?",
        body:
          "Mit Ihrer Einwilligung lädt diese Seite Google Analytics. Dabei werden " +
          "Cookies gesetzt und Nutzungsdaten an Google übermittelt, auch in die USA. " +
          "Ohne Einwilligung passiert nichts davon, und die Seite funktioniert genauso. " +
          "Sie können Ihre Wahl jederzeit in der ",
        link: "Datenschutzerklärung",
        href: "/datenschutz#analytics",
        after: " ändern.",
        decline: "Ablehnen",
        allow: "Zulassen",
        allowed: "Aktuell: Google Analytics ist zugelassen.",
        declined: "Aktuell: Google Analytics ist abgelehnt.",
        none: "Aktuell: Sie haben noch keine Wahl getroffen.",
      };

  function readChoice() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var choice = JSON.parse(raw);
      if (!choice || choice.v !== VERSION) return null;
      if (typeof choice.t !== "number" || Date.now() - choice.t > VALID_MS) return null;
      if (choice.analytics !== true && choice.analytics !== false) return null;
      return choice.analytics;
    } catch (e) {
      return null;
    }
  }

  function saveChoice(analytics) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: VERSION, t: Date.now(), analytics: analytics }),
      );
    } catch (e) {
      /* Ohne Speicher gilt die Wahl nur für diesen Seitenaufruf. */
    }
  }

  var loaded = false;

  function loadGtag() {
    if (loaded) return;
    loaded = true;
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
  function deleteGaCookies() {
    var host = window.location.hostname;
    var domains = ["", host, "." + host];
    var parts = host.split(".");
    if (parts.length > 2) domains.push("." + parts.slice(-2).join("."));
    document.cookie.split(";").forEach(function (entry) {
      var name = entry.split("=")[0].trim();
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

  function buildBanner() {
    var box = document.createElement("section");
    box.className = "consent";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-labelledby", "consent-title");
    box.setAttribute("aria-describedby", "consent-text");
    box.hidden = true;

    var title = document.createElement("h2");
    title.id = "consent-title";
    title.className = "consent__title";
    title.textContent = TEXT.title;

    var text = document.createElement("p");
    text.id = "consent-text";
    text.className = "consent__text";
    text.appendChild(document.createTextNode(TEXT.body));
    var link = document.createElement("a");
    link.href = TEXT.href;
    link.textContent = TEXT.link;
    text.appendChild(link);
    text.appendChild(document.createTextNode(TEXT.after));

    var buttons = document.createElement("div");
    buttons.className = "consent__buttons";

    function button(label, analytics) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn consent__button";
      b.textContent = label;
      b.addEventListener("click", function () {
        decide(analytics);
      });
      return b;
    }

    buttons.appendChild(button(TEXT.decline, false));
    buttons.appendChild(button(TEXT.allow, true));

    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(buttons);
    document.body.appendChild(box);
    return box;
  }

  /**
   * Beim ersten Besuch ohne Fokuswechsel, damit Tastatur und Screenreader
   * nicht mitten aus der Seite gerissen werden. Öffnet jemand das Banner
   * selbst, springt der Fokus hinein.
   */
  function showBanner(focus) {
    if (!banner) banner = buildBanner();
    banner.hidden = false;
    if (focus) {
      var first = banner.querySelector("button");
      if (first) first.focus({ preventScroll: true });
    }
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function decide(analytics) {
    var before = readChoice();
    saveChoice(analytics);
    hideBanner();
    if (analytics) {
      loadGtag();
    } else {
      window["ga-disable-" + gaId] = true;
      deleteGaCookies();
      // War gtag.js schon geladen, hilft nur ein Neuladen, um es loszuwerden.
      if (loaded || before === true) window.location.reload();
    }
    showStatus();
  }

  /** Zeigt in der Datenschutzerklärung die aktuelle Wahl an. */
  function showStatus() {
    var choice = readChoice();
    var text =
      choice === true ? TEXT.allowed : choice === false ? TEXT.declined : TEXT.none;
    document.querySelectorAll("[data-consent-status]").forEach(function (el) {
      el.textContent = text;
    });
  }

  function start() {
    document.querySelectorAll("[data-consent-open]").forEach(function (el) {
      el.hidden = false;
      el.addEventListener("click", function (event) {
        event.preventDefault();
        showBanner(true);
      });
    });
    showStatus();

    var choice = readChoice();
    if (choice === true) loadGtag();
    else if (choice === null) showBanner(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
