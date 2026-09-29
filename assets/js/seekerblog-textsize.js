/* Text size: single shared control for the toolbar A-/A+, the landscape
   bar's A-/A+, and the settings sheet's "Text size" slider. All three
   read/write the same persisted S.size and drive --scale via the per-page
   engine's own applySize() (that <script> is deliberately not IIFE-wrapped
   so S / store / applySize resolve here as bare identifiers, same trick
   seekerblog-continuous.js and seekerblog-landscape.js already use). */
(function(){
  "use strict";

  if(typeof S === "undefined" || typeof store === "undefined" || typeof applySize !== "function") return;

  var MIN = 70, MAX = 190, STEP = 10;

  function get(){ return S.size; }

  function clampVal(v){ return Math.max(MIN, Math.min(MAX, v)); }

  function set(v){
    v = clampVal(v);
    S.size = v;
    store.set("size", v);
    applySize();
    var slider = document.getElementById("size");
    if(slider) slider.value = v;
    sync();
    document.dispatchEvent(new CustomEvent("sb:textsize", { detail: { size: v } }));
  }

  function step(dir){ set(get() + dir * STEP); }

  function addSettingsShortcut(){
    var toolbar = document.getElementById("readerToolbar");
    var settings = document.getElementById("setBtn");
    if(!toolbar || !settings || toolbar.closest("#sheet") || document.getElementById("btnReaderSettings")) return;

    var divider = document.createElement("div");
    divider.className = "toolbar-divider";
    divider.setAttribute("aria-hidden", "true");

    var group = document.createElement("div");
    group.className = "toolbar-group";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "toolbar-btn";
    button.id = "btnReaderSettings";
    button.title = "Reading settings";
    button.setAttribute("aria-label", "Open reading settings");
    button.innerHTML = '<span class="toolbar-btn-icon" aria-hidden="true">⚙</span><span class="toolbar-btn-text-full">Settings</span>';
    button.addEventListener("click", function(e){
      e.stopPropagation();
      settings.click();
    });

    group.appendChild(button);
    toolbar.appendChild(divider);
    toolbar.appendChild(group);
  }

  function labelWarmIvoryTheme(){
    var leafTheme = document.querySelector('#segTheme [data-v="leaf"]');
    if(!leafTheme) return;
    leafTheme.textContent = "Warm ivory";
    leafTheme.title = "Warm ivory reading theme";
  }

  function addEditionNote(){
    var sheet = document.getElementById("sheet");
    if(!sheet || document.getElementById("readerEditionNote")) return;

    var row = document.createElement("div");
    row.className = "row reader-edition-note";
    row.id = "readerEditionNote";
    row.innerHTML = '<span class="rowhead">Text &amp; edition</span><p class="note">This library presents a digital reading edition of the traditional text for chanting and study. It is not tied to one printed edition; script renderings, transliteration, meanings, spelling, punctuation, and verse divisions are editorial aids and may differ from a regional or print edition.</p>';
    sheet.appendChild(row);
  }

  function sync(){
    var v = get();
    var atMin = v <= MIN, atMax = v >= MAX;
    ["btnFontDec", "lsFontDec"].forEach(function(id){
      var b = document.getElementById(id);
      if(b) b.disabled = atMin;
    });
    ["btnFontInc", "lsFontInc"].forEach(function(id){
      var b = document.getElementById(id);
      if(b) b.disabled = atMax;
    });
  }

  window.sbTextSize = { MIN: MIN, MAX: MAX, STEP: STEP, get: get, set: set, step: step, sync: sync };

  function wire(){
    labelWarmIvoryTheme();
    addEditionNote();
    addSettingsShortcut();
    var dec = document.getElementById("btnFontDec");
    var inc = document.getElementById("btnFontInc");
    if(dec) dec.addEventListener("click", function(e){ e.stopPropagation(); step(-1); });
    if(inc) inc.addEventListener("click", function(e){ e.stopPropagation(); step(1); });

    var slider = document.getElementById("size");
    if(slider) slider.addEventListener("input", function(){
      sync();
      document.dispatchEvent(new CustomEvent("sb:textsize", { detail: { size: get() } }));
    });

    sync();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wire);
  } else wire();
})();
