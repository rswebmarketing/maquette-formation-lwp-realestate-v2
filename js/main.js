/* Larkline · Prototype v2 · small enhancements, no dependencies.
   Every feature checks for its own markup, so one file serves all pages. */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     1. Mobile menu: close after choosing a link
     ------------------------------------------------------------------ */
  var toggle = document.getElementById("nav-toggle");
  if (toggle) {
    document.querySelectorAll(".nav-menu a").forEach(function (a) {
      a.addEventListener("click", function () { toggle.checked = false; });
    });
  }

  /* ------------------------------------------------------------------
     2. Carousel arrows (horizontal scroller)
     ------------------------------------------------------------------ */
  document.querySelectorAll("[data-carousel-prev], [data-carousel-next]").forEach(function (btn) {
    var scroller = document.getElementById(btn.getAttribute("aria-controls"));
    if (!scroller) return;
    var dir = btn.hasAttribute("data-carousel-next") ? 1 : -1;
    function step() {
      var card = scroller.firstElementChild;
      var gap = parseFloat(getComputedStyle(scroller).columnGap) || 0;
      return card ? card.getBoundingClientRect().width + gap : scroller.clientWidth;
    }
    function update() {
      var max = scroller.scrollWidth - scroller.clientWidth - 2;
      btn.disabled = dir < 0 ? scroller.scrollLeft <= 2 : scroller.scrollLeft >= max;
    }
    btn.addEventListener("click", function () {
      scroller.scrollBy({ left: dir * step(), behavior: reduceMotion ? "auto" : "smooth" });
    });
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  /* ------------------------------------------------------------------
     3. Count-up numbers ([data-count])
     The final value stays in the HTML; the script reads it, counts from 0
     with an ease-out, then puts the original markup back.
     ------------------------------------------------------------------ */
  function parseNumber(text) {
    var m = text.match(/\d[\d\s  .,]*\d|\d/);
    if (!m) return null;
    var raw = m[0];
    var dec = null, decimals = 0, decDigits = "";
    var last = raw.match(/[.,](\d+)$/);
    if (last && last[1].length !== 3) { dec = raw.charAt(raw.length - last[1].length - 1); decimals = last[1].length; decDigits = last[1]; }
    var intPart = dec ? raw.slice(0, raw.length - decimals - 1) : raw;
    var g = intPart.match(/[^\d]/);
    return {
      prefix: text.slice(0, m.index),
      suffix: text.slice(m.index + raw.length),
      value: parseFloat(intPart.replace(/\D/g, "") + (dec ? "." + decDigits : "")),
      decimals: decimals,
      dec: dec || ",",
      group: g ? g[0] : ""
    };
  }
  function format(n, p) {
    var parts = n.toFixed(p.decimals).split(".");
    var i = parts[0];
    if (p.group) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, p.group);
    return p.prefix + i + (parts[1] ? p.dec + parts[1] : "") + p.suffix;
  }
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  if (counters.length && !reduceMotion && "IntersectionObserver" in window) {
    counters.forEach(function (el) {
      var original = el.innerHTML;
      var finalText = el.textContent.trim();
      var p = parseNumber(finalText);
      if (!p) return;
      var group = el.closest("ul, ol, [data-count-group]") || el.parentNode;
      var siblings = Array.prototype.slice.call(group.querySelectorAll("[data-count]"));
      el.setAttribute("aria-label", finalText);
      el._count = { original: original, p: p, index: siblings.indexOf(el) };
      el.innerHTML = '<span class="sr-only">' + finalText + '</span><span aria-hidden="true">' + format(0, p) + "</span>";
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var c = el._count;
        if (!c) return;
        var display = el.querySelector('[aria-hidden="true"]');
        var duration = 1600, start = null;
        setTimeout(function () {
          requestAnimationFrame(function tick(t) {
            if (start === null) start = t;
            var k = Math.min((t - start) / duration, 1);
            var eased = 1 - Math.pow(1 - k, 3); // ease-out
            display.textContent = format(c.p.value * eased, c.p);
            if (k < 1) requestAnimationFrame(tick);
            else el.innerHTML = c.original; // back to the original, editable markup
          });
        }, c.index * 150);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { if (el._count) io.observe(el); });
  }

  /* ------------------------------------------------------------------
     4. Filters (listings page and journal)
     ------------------------------------------------------------------ */
  var list = document.querySelector("[data-filter-list]");
  if (list) {
    var items = Array.prototype.slice.call(list.children);
    var selects = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
    var chips = Array.prototype.slice.call(document.querySelectorAll("[data-filter-chip]"));
    var countEl = document.querySelector("[data-filter-count]");
    var empty = document.querySelector("[data-filter-empty]");
    var params = new URLSearchParams(location.search);
    selects.forEach(function (s) {
      var v = params.get(s.getAttribute("data-filter"));
      if (v && s.querySelector('option[value="' + v + '"]')) s.value = v;
    });
    function apply() {
      var active = {};
      selects.forEach(function (s) { if (s.value) active[s.getAttribute("data-filter")] = s.value; });
      chips.forEach(function (c) { if (c.getAttribute("aria-pressed") === "true" && c.value) active[c.getAttribute("data-filter-chip")] = c.value; });
      var shown = 0;
      items.forEach(function (it) {
        var ok = Object.keys(active).every(function (k) {
          var v = active[k];
          if (k === "statut" && v === "dispo") return it.dataset.statut !== "vendu";
          return it.dataset[k] === v;
        });
        it.hidden = !ok;
        if (ok) shown++;
      });
      if (countEl) countEl.textContent = shown + (shown > 1 ? " " + countEl.dataset.plural : " " + countEl.dataset.singular);
      if (empty) empty.hidden = shown !== 0;
    }
    selects.forEach(function (s) { s.addEventListener("change", apply); });
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        chips.filter(function (o) { return o.getAttribute("data-filter-chip") === c.getAttribute("data-filter-chip"); })
             .forEach(function (o) { o.setAttribute("aria-pressed", o === c ? "true" : "false"); });
        apply();
      });
    });
    var reset = document.querySelector("[data-filter-reset]");
    if (reset) reset.addEventListener("click", function () {
      selects.forEach(function (s) { s.value = s.getAttribute("data-default") || ""; });
      apply();
    });
    apply();
  }

  /* ------------------------------------------------------------------
     5. Home step 1 → estimation page (keeps the answers in this tab)
     ------------------------------------------------------------------ */
  var prefill = document.querySelector("[data-prefill-form]");
  if (prefill) {
    prefill.addEventListener("submit", function (ev) {
      if (!prefill.checkValidity()) return;
      ev.preventDefault();
      try {
        var data = {};
        new FormData(prefill).forEach(function (v, k) { data[k] = v; });
        sessionStorage.setItem("larkline-estimation", JSON.stringify(data));
      } catch (err) { /* storage unavailable: the next page simply starts at step 1 */ }
      location.href = "estimation.html?etape=2";
    });
  }

  /* ------------------------------------------------------------------
     6. Multi-step estimation form
     ------------------------------------------------------------------ */
  var form = document.querySelector("[data-steps]");
  if (form) {
    var steps = Array.prototype.slice.call(form.querySelectorAll("[data-step]"));
    var pills = Array.prototype.slice.call(document.querySelectorAll("[data-step-pill]"));
    var label = document.querySelector("[data-step-label]");
    var bar = document.querySelector("[data-step-bar]");
    var current = 0;

    function show(i, focus) {
      current = i;
      steps.forEach(function (s, k) { s.hidden = k !== i; });
      pills.forEach(function (p, k) {
        if (k === i) p.setAttribute("aria-current", "step"); else p.removeAttribute("aria-current");
        p.classList.toggle("is-done", k < i);
      });
      if (label) label.textContent = "Étape " + (i + 1) + " sur " + steps.length;
      if (bar) bar.style.width = ((i + 1) / steps.length * 100) + "%";
      if (focus) { var first = steps[i].querySelector("input, select"); if (first) first.focus(); }
    }
    function fieldError(field, msg) {
      var wrap = field.closest(".field, .consent, fieldset");
      var err = wrap && wrap.querySelector(".field-error");
      if (msg) {
        field.setAttribute("aria-invalid", "true");
        if (!err && wrap) {
          err = document.createElement("p");
          err.className = "field-error";
          err.id = (field.id || field.name) + "-error";
          wrap.appendChild(err);
        }
        if (err) { err.textContent = msg; field.setAttribute("aria-describedby", err.id); }
      } else {
        field.removeAttribute("aria-invalid");
        if (err) err.remove();
      }
    }
    function validate(step) {
      var ok = true, firstBad = null;
      step.querySelectorAll("input, select").forEach(function (f) {
        if (f.type === "radio" || (f.type === "checkbox" && !f.required)) return;
        var msg = "";
        if (f.validity.valueMissing) msg = f.dataset.msg || "Ce champ est nécessaire pour estimer votre bien.";
        else if (f.validity.typeMismatch && f.type === "email") msg = "Vérifiez l'adresse e-mail, par exemple prenom@exemple.fr.";
        else if (f.validity.patternMismatch) msg = f.dataset.msg || "Vérifiez ce champ.";
        else if (f.validity.rangeUnderflow) msg = "La surface semble trop petite.";
        fieldError(f, msg);
        if (msg) { ok = false; if (!firstBad) firstBad = f; }
      });
      if (firstBad) firstBad.focus();
      return ok;
    }
    form.addEventListener("click", function (ev) {
      var next = ev.target.closest("[data-next]"), prev = ev.target.closest("[data-prev]");
      if (next) { ev.preventDefault(); if (validate(steps[current])) show(current + 1, true); }
      if (prev) { ev.preventDefault(); show(current - 1, true); }
    });
    form.addEventListener("input", function (ev) {
      if (ev.target.getAttribute("aria-invalid") === "true") fieldError(ev.target, "");
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!validate(steps[current])) return;
      var submit = form.querySelector('[type="submit"]');
      if (submit.disabled) return; // no double submit
      submit.disabled = true;
      submit.textContent = "Envoi en cours…";
      try { sessionStorage.removeItem("larkline-estimation"); } catch (err) {}
      setTimeout(function () { location.href = form.getAttribute("action"); }, 600);
    });

    // Prefill from the home page (step 1 already answered)
    var start = 0;
    try {
      var saved = JSON.parse(sessionStorage.getItem("larkline-estimation") || "null");
      var q = new URLSearchParams(location.search);
      var source = saved || {};
      ["adresse", "type", "surface"].forEach(function (k) { if (!source[k] && q.get(k)) source[k] = q.get(k); });
      Object.keys(source).forEach(function (k) { var f = form.elements[k]; if (f && source[k]) f.value = source[k]; });
      if (q.get("etape") === "2" && form.elements.adresse.value && form.elements.type.value && form.elements.surface.value) start = 1;
    } catch (err) {}
    form.setAttribute("novalidate", "");
    show(start, false);
  }
})();
