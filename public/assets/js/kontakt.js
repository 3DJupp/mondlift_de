/*
 * Kontaktformular, schrittweise Verbesserung.
 *
 * Ohne diese Datei funktioniert das Formular weiterhin: es sendet dann ganz
 * normal per POST, und der Worker leitet mit ?status=... zurück. Hier wird
 * nur das Nachladen der Seite gespart und die Rückmeldung direkt angezeigt.
 */

(() => {
  "use strict";

  const form = document.querySelector("[data-contact-form]");
  const statusBox = document.querySelector("[data-status-box]");
  const button = document.querySelector("[data-submit]");
  if (!form || !statusBox || !button) return;

  const messages = statusBox.querySelectorAll("[data-status]");

  function show(status) {
    for (const el of messages) {
      el.hidden = el.dataset.status !== status;
    }
    statusBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /**
   * Ein Turnstile-Token lässt sich nur einmal einlösen. Bleibt die Seite
   * nach dem Absenden stehen - und genau das tut sie hier - muss das Widget
   * zurückgesetzt werden, sonst schlägt der zweite Versuch immer fehl.
   */
  function resetTurnstile() {
    if (window.turnstile && typeof window.turnstile.reset === "function") {
      try {
        window.turnstile.reset();
      } catch {
        // Kein Widget vorhanden, etwa weil kein Site Key gesetzt ist.
      }
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    button.disabled = true;
    const label = button.textContent;
    button.textContent = "Wird gesendet …";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { accept: "application/json" },
        body: new FormData(form),
      });

      let status = "fehler";
      try {
        const data = await response.json();
        if (data && typeof data.status === "string") status = data.status;
      } catch {
        // Keine verwertbare Antwort - bleibt bei "fehler".
      }

      show(status);
      if (status === "ok") form.reset();
    } catch {
      // Netzwerk weg oder Anfrage abgebrochen.
      show("fehler");
    } finally {
      resetTurnstile();
      button.disabled = false;
      button.textContent = label;
    }
  });
})();
