/* Continuous recitation: when the end of a section is reached, roll
   straight into the next one instead of stopping.

   Off by default and controlled by a "Continuous" flag added to the
   settings sheet, stored per text under that page's own localStorage
   namespace (each page defines its own NS, so the flag does not leak
   between texts).

   Behaviour depends on what is selected:
     - a single section, on a text that has several  -> advance to the
       next section in ORDER, wrapping past the last one back to the first
     - "all" / full pāṛāyaṇa, or a text with only one section -> loop back
       to the first verse

   Wraps step() from the per-page engine, whose <script> is deliberately
   not IIFE-wrapped. MUST be loaded BEFORE seekerblog-landscape.js: that
   file also wraps step(), and its page-flip check has to run first so a
   long verse still walks its pages before a section boundary is taken. */
(function(){
  "use strict";

  if(typeof S === "undefined" || typeof step !== "function") return;

  var secs = (typeof ORDER !== "undefined" && ORDER) ? ORDER : [];
  var multiSection = secs.length > 1;

  /* ── the flag ────────────────────────────────────────── */
  var stored = store.get("cont", "off");
  S.cont = (stored === "on") ? "on" : "off";

  /* ── settings row, injected after the existing Section row ── */
  function buildRow(){
    var secBox = document.getElementById("segSection");
    var anchor = secBox ? secBox.closest(".row") : null;
    if(!anchor || document.getElementById("segCont")) return;

    var row = document.createElement("div");
    row.className = "row";
    row.innerHTML =
      '<span class="rowhead">Continuous</span>' +
      '<div class="seg" id="segCont">' +
        '<button data-v="off">Off</button><button data-v="on">On</button>' +
      '</div>' +
      '<p class="note">' + (multiSection
        ? 'At the end of a section, carry on into the next one instead of stopping. Past the last section it returns to the first.'
        : 'At the end of the text, return to the first verse instead of stopping.') +
      '</p>';
    anchor.insertAdjacentElement("afterend", row);

    var box = document.getElementById("segCont");
    function sync(){
      [].forEach.call(box.children, function(b){
        b.setAttribute("aria-pressed", String(b.dataset.v === String(S.cont)));
      });
    }
    box.addEventListener("click", function(e){
      var b = e.target.closest ? e.target.closest("button") : null;
      if(!b) return;
      S.cont = b.dataset.v;
      store.set("cont", S.cont);
      sync();
    });
    sync();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", buildRow);
  } else buildRow();

  /* keep the Section control honest when we change S.section ourselves */
  function syncSectionSeg(){
    var box = document.getElementById("segSection");
    if(!box) return;
    [].forEach.call(box.children, function(b){
      b.setAttribute("aria-pressed", String(b.dataset.v === String(S.section)));
    });
  }

  /* ── rolling over a boundary ─────────────────────────── */
  function roll(dir){
    if(S.section === "all" || !multiSection){
      /* nothing to advance into — loop the list we already have */
      S.i = dir > 0 ? 0 : list.length - 1;
    } else {
      var cur = secs.indexOf(S.section);
      if(cur < 0) cur = 0;
      S.section = secs[(cur + dir + secs.length) % secs.length];
      store.set("section", S.section);
      buildList();               /* rebuilds `list`, mala and the header label */
      syncSectionSeg();
      S.i = dir > 0 ? 0 : Math.max(0, list.length - 1);
    }
    rep = 0;
    paint(true);
    if(playing) schedule();
  }

  var originalStep = window.step;
  window.step = function(dir, auto){
    if(S.cont === "on" && list && list.length){
      /* verse 108 and friends carry a fixed liturgical repeat; let the
         engine finish those rounds before any boundary is considered */
      var fixed = list[S.i] && list[S.i].rep;
      var midRepeat = dir > 0 && fixed && rep < fixed - 1;
      if(!midRepeat){
        if(dir > 0 && S.i + dir >= list.length) return roll(1);
        if(dir < 0 && S.i + dir < 0) return roll(-1);
      }
    }
    return originalStep(dir, auto);
  };
})();
