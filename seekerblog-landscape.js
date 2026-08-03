/* Landscape reading mode: verse + verse number only, paged when a verse
   is too tall for the viewport. Wraps globals exposed by the per-page
   verse engine (S, el, list, devaToks, step, setWord, syncWalker) —
   that engine's <script> is intentionally not IIFE-wrapped so this file
   can hook it without touching any of the 10 per-page copies. */
(function(){
  "use strict";

  var mq = matchMedia("(orientation:landscape) and (max-height:600px)");
  var pages = [];      // array of {lines:[.vline...]}
  var pageIdx = 0;
  var pendingLastPage = false;
  var resizeTO = null;
  var hideTO = null;
  var barBuilt = false;

  function activate(on){
    var was = document.documentElement.dataset.ls === "1";
    if(on === was) return;
    if(on){
      document.documentElement.dataset.ls = "1";
      buildOverlay();
      layoutPages();
      showBar();
    } else {
      delete document.documentElement.dataset.ls;
      clearPaging();
      hideBar(true);
    }
  }

  function onMqChange(){ activate(mq.matches); }
  mq.addEventListener ? mq.addEventListener("change", onMqChange) : mq.addListener(onMqChange);
  onMqChange();

  addEventListener("resize", function(){
    clearTimeout(resizeTO);
    resizeTO = setTimeout(function(){
      onMqChange();
      if(document.documentElement.dataset.ls === "1") layoutPages();
    }, 120);
  });
  document.addEventListener("fullscreenchange", function(){
    onMqChange();
    if(document.documentElement.dataset.ls === "1") layoutPages();
  });
  if(window.visualViewport){
    visualViewport.addEventListener("resize", function(){
      clearTimeout(resizeTO);
      resizeTO = setTimeout(function(){
        if(document.documentElement.dataset.ls === "1") layoutPages();
      }, 120);
    });
  }

  /* ── paging ──────────────────────────────────────────── */
  function clearPaging(){
    var deva = document.getElementById("deva");
    if(!deva) return;
    delete deva.dataset.paged;
    pages = []; pageIdx = 0;
    [].forEach.call(deva.querySelectorAll(".vline"), function(v){ v.classList.remove("ls-on"); });
  }

  function showPage(idx){
    if(!pages.length) return;
    pageIdx = Math.max(0, Math.min(idx, pages.length - 1));
    pages.forEach(function(p, i){
      p.lines.forEach(function(v){ v.classList.toggle("ls-on", i === pageIdx); });
    });
    updateMarker();
  }

  function updateMarker(){
    var mkNum = document.getElementById("mkNum");
    if(!mkNum) return;
    var existing = mkNum.parentNode.querySelector(".ls-pageind");
    if(existing) existing.remove();
    if(pages.length > 1){
      var span = document.createElement("span");
      span.className = "ls-pageind";
      span.textContent = " · " + (pageIdx + 1) + "/" + pages.length;
      mkNum.parentNode.appendChild(span);
    }
  }

  function layoutPages(){
    var deva = document.getElementById("deva");
    var stageWrap = document.getElementById("stageWrap");
    if(!deva || !stageWrap) return;

    delete deva.dataset.paged;
    var lines = [].slice.call(deva.querySelectorAll(".vline"));
    [].forEach.call(lines, function(v){ v.classList.remove("ls-on"); });
    if(!lines.length){ pages = []; return; }

    var avail = stageWrap.clientHeight;
    var totalHeight = 0;
    var heights = lines.map(function(v){
      var h = v.getBoundingClientRect().height;
      totalHeight += h;
      return h;
    });

    if(totalHeight <= avail){
      pages = [{ lines: lines }];
      showPage(0);
      return;
    }

    deva.dataset.paged = "1";
    var pageCount = Math.max(2, Math.ceil(totalHeight / avail));
    var linesPerPage = Math.ceil(lines.length / pageCount);
    if(linesPerPage % 2 !== 0 && linesPerPage < lines.length) linesPerPage++;

    var built = [];
    var cur = { lines: [] };
    var curH = 0;
    for(var i = 0; i < lines.length; i++){
      var wouldOverflow = curH + heights[i] > avail && cur.lines.length > 0;
      var hitEvenSplit = cur.lines.length >= linesPerPage;
      if(wouldOverflow || hitEvenSplit){
        built.push(cur);
        cur = { lines: [] };
        curH = 0;
      }
      cur.lines.push(lines[i]);
      curH += heights[i];
    }
    if(cur.lines.length) built.push(cur);

    pages = built;
    showPage(pendingLastPage ? pages.length - 1 : 0);
    pendingLastPage = false;
  }

  /* ── navigation wrap ─────────────────────────────────── */
  var originalStep = window.step;
  if(typeof originalStep === "function"){
    window.step = function(dir, auto){
      if(document.documentElement.dataset.ls === "1" && pages.length > 1 && !auto){
        if(dir > 0 && pageIdx < pages.length - 1){ showPage(pageIdx + 1); return; }
        if(dir < 0 && pageIdx > 0){ showPage(pageIdx - 1); return; }
        if(dir < 0 && pageIdx === 0){ pendingLastPage = true; }
      }
      return originalStep(dir, auto);
    };
  }

  var originalSetWord = window.setWord;
  if(typeof originalSetWord === "function"){
    window.setWord = function(k){
      originalSetWord(k);
      if(document.documentElement.dataset.ls !== "1" || pages.length <= 1) return;
      /* devaToks is declared with `let` in the per-page engine, so it is
         a shared top-level lexical binding, not a window property — this
         function itself lives in that same script-scope chain, so the
         bare identifier below resolves to the live array. */
      var toks = typeof devaToks !== "undefined" ? devaToks : null;
      if(!toks || !toks[k]) return;
      var line = toks[k].closest ? toks[k].closest(".vline") : null;
      if(!line) return;
      for(var i = 0; i < pages.length; i++){
        if(pages[i].lines.indexOf(line) !== -1){
          if(i !== pageIdx) showPage(i);
          break;
        }
      }
    };
  }

  var originalSyncWalker = window.syncWalker;
  if(typeof originalSyncWalker === "function"){
    window.syncWalker = function(){
      if(document.documentElement.dataset.ls === "1") layoutPages();
      return originalSyncWalker();
    };
  }

  /* ── overlay control bar ─────────────────────────────── */
  function buildOverlay(){
    if(barBuilt) return;
    barBuilt = true;
    var bar = document.createElement("div");
    bar.className = "ls-bar";
    bar.id = "lsBar";
    bar.innerHTML =
      '<button class="ls-btn" id="lsPrev" aria-label="Previous verse">' +
        '<svg viewBox="0 0 24 24"><path d="M8 5h2v14H8zM19 5v14l-9-7z"/></svg></button>' +
      '<button class="ls-btn" id="lsPlay" aria-label="Play/pause">' +
        '<svg viewBox="0 0 24 24"><path id="lsPlayIcon" d="M7 4l13 8-13 8z"/></svg></button>' +
      '<button class="ls-btn" id="lsNext" aria-label="Next verse">' +
        '<svg viewBox="0 0 24 24"><path d="M14 5h2v14h-2zM5 5l9 7-9 7z"/></svg></button>' +
      '<button class="ls-btn" id="lsSettings" aria-label="Settings">' +
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg></button>';
    document.body.appendChild(bar);

    bar.addEventListener("click", function(e){ e.stopPropagation(); });
    bar.addEventListener("pointerdown", function(e){ e.stopPropagation(); });

    document.getElementById("lsPrev").addEventListener("click", function(){
      var b = document.getElementById("prev"); if(b) b.click();
    });
    document.getElementById("lsNext").addEventListener("click", function(){
      var b = document.getElementById("next"); if(b) b.click();
    });
    document.getElementById("lsPlay").addEventListener("click", function(){
      var b = document.getElementById("play"); if(b) b.click();
    });
    document.getElementById("lsSettings").addEventListener("click", function(){
      var b = document.getElementById("setBtn"); if(b) b.click();
      showBar();
    });

    /* keep the play icon in sync with the real button's icon */
    var origPlayIcon = document.getElementById("playIcon");
    if(origPlayIcon){
      var mo = new MutationObserver(function(){
        var lsIcon = document.getElementById("lsPlayIcon");
        if(lsIcon) lsIcon.setAttribute("d", origPlayIcon.getAttribute("d"));
      });
      mo.observe(origPlayIcon, { attributes: true, attributeFilter: ["d"] });
    }

    /* while the settings sheet is open, keep the bar visible and pause
       the auto-hide timer; resume the timer once it closes */
    var sheet = document.getElementById("sheet");
    if(sheet){
      var sheetMO = new MutationObserver(function(){
        if(sheet.classList.contains("open")){
          clearTimeout(hideTO);
          bar.classList.add("show");
        } else {
          showBar();
        }
      });
      sheetMO.observe(sheet, { attributes: true, attributeFilter: ["class"] });
    }
  }

  function sheetIsOpen(){
    var sheet = document.getElementById("sheet");
    return !!(sheet && sheet.classList.contains("open"));
  }

  function showBar(){
    var bar = document.getElementById("lsBar");
    if(!bar) return;
    bar.classList.add("show");
    clearTimeout(hideTO);
    if(sheetIsOpen()) return;
    hideTO = setTimeout(function(){
      if(sheetIsOpen()) return;
      bar.classList.remove("show");
    }, 2500);
  }
  function hideBar(immediate){
    var bar = document.getElementById("lsBar");
    if(!bar) return;
    clearTimeout(hideTO);
    if(immediate) bar.classList.remove("show");
  }

  document.addEventListener("pointerdown", function(){
    if(document.documentElement.dataset.ls === "1") showBar();
  });
})();
