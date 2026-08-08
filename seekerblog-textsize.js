/* Text size: single shared control for the toolbar A-/A+, the landscape
   bar's A-/A+, and the settings sheet's "Text size" slider. All three
   read/write the same persisted S.size and drive --scale via the per-page
   engine's own applySize() (that <script> is deliberately not IIFE-wrapped
   so S / store / applySize resolve here as bare identifiers, same trick
   seekerblog-continuous.js and seekerblog-landscape.js already use). */
(function(){
  "use strict";

  if(typeof S === "undefined" || typeof store === "undefined" || typeof applySize !== "function") return;

  var MIN = 70, MAX = 165, STEP = 10;

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
