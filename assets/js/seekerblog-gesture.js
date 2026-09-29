/* Hands-free chant control via hand gestures picked up by the camera, for
   reciters who keep the phone propped up and away rather than in hand.

   An open palm toggles the chant between play and pause. A deliberate hand wave moves between
   verses: left/right in portrait, up/down in landscape. Raising a palm
   triggers one action after a short hold. A held palm fires once, then
   locks until the hand is lowered; this prevents a lingering hand from
   repeatedly toggling playback or reversing a verse swipe while returning
   to its starting position.

   Uses Google's MediaPipe Tasks Vision GestureRecognizer: a pre-trained,
   on-device WASM classifier. All video processing happens locally in the
   page -- no frame, landmark or classification result is ever uploaded,
   recorded or logged anywhere.

   Like seekerblog-continuous.js, this wraps nothing in the per-page engine.
   It only ever calls the page's own bare start()/stop()/step() functions
   (function declarations, hence reachable without a window. prefix from
   this sibling classic <script>) and reads/writes the bare `playing`/S/store
   bindings that live in the page's un-IIFE'd top-level scope.

   Never auto-arms: the camera is only ever acquired from a real click, on
   every visit, matching the drone flag's rule in the host page ("never
   auto-starts: browsers require a gesture"). A remembered "on" from a
   previous session only changes the toolbar button's hint styling.

   Assumes the front camera (facingMode:"user"), the phone propped up
   facing the reciter, and a secure context (https/localhost). Wired into
   vishnu-sahasranamam.html only, as a prototype. */
(function () {
  "use strict";

  if (
    typeof S === "undefined" ||
    typeof store === "undefined" ||
    typeof start !== "function" ||
    typeof stop !== "function" ||
    typeof step !== "function"
  ) return;

  var supported = !!(
    window.isSecureContext &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );

  /* ── tuning ──────────────────────────────────────────────────── */
  var MP_VER = "1.0.1";
  var MP_ESM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MP_VER + "/vision_bundle.mjs";
  var MP_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MP_VER + "/wasm";
  var MP_MODEL = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

  var GESTURE = "Open_Palm";

  var INFER_MS = 67;             /* follow the requested 15 fps camera stream; quick waves need every frame */
  var CONF = 0.60;                /* confidence floor to count as a candidate */
  var HOLD_MS = 200;               /* palm play/pause fires after this long raised ... */
  var HOLD_MIN_SAMPLES = 2;        /* ... and at least this many qualifying samples */
  var RELEASE_SAMPLES = 3;        /* consecutive non-qualifying samples before a raise is considered dropped */
  var WAVE_RELEASE_SAMPLES = 3;   /* no-hand samples required before another verse wave may fire */
  var WAVE_WINDOW_MS = 600;       /* maximum time for one deliberate sweep */
  var WAVE_DISTANCE = 0.12;       /* normalized camera-frame travel to count as a wave */
  var WAVE_STILL_DISTANCE = 0.04; /* movement above this postpones the palm pause */
  var WAVE_COOLDOWN_MS = 400;     /* one navigation action per sweep */
  var HIDE_RELEASE_MS = 1000;     /* deferred camera release after tab hides */
  var MAX_INFER_ERRORS = 5;       /* consecutive throws before self-disarming */
  var FIRED_FLASH_MS = 1000;
  var STATUS_AUTOHIDE_MS = 5000;

  /* ── persisted preference (never an auto-start) ─────────────────── */
  S.gest = store.get("gest", "off") === "on" ? "on" : "off";

  /* ── module state ────────────────────────────────────────────── */
  var armed = false, booting = false, suspended = false;
  var bootToken = 0;
  var stream = null, video = null, recognizer = null, enginePromise = null;
  var rafId = null, lastInferAt = 0, lastVideoTime = -1, inferErrors = 0;
  var wakeLock = null;
  var releaseTO = null, autohideTO = null, firedTO = null;

  var raised = false, raiseSince = 0, qualifyingSamples = 0, raisedAction = "";
  var fireCount = 0, clearSamples = 0;
  var wristTrail = [], waveCooldownUntil = 0;
  var waveLocked = false, waveClearSamples = 0;

  var btn = null, statusEl = null, statusTxt = null;

  function $(id) { return document.getElementById(id); }

  /* ── lazy MediaPipe bootstrap (first arm only) ──────────────────
     A dynamic import() *expression* is legal inside a classic script --
     only static import/export statements require type="module" -- which
     is what lets this file stay a plain <script src> and keep bare access
     to playing/start/stop/S/store. */
  function loadEngine() {
    if (enginePromise) return enginePromise;
    enginePromise = (async function () {
      var mp = await import(MP_ESM);
      var fileset = await mp.FilesetResolver.forVisionTasks(MP_WASM);
      var opts = function (delegate) {
        return {
          baseOptions: { modelAssetPath: MP_MODEL, delegate: delegate },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        };
      };
      try {
        return await mp.GestureRecognizer.createFromOptions(fileset, opts("GPU"));
      } catch (e) {
        return await mp.GestureRecognizer.createFromOptions(fileset, opts("CPU"));
      }
    })();
    enginePromise.catch(function () { enginePromise = null; }); /* let a later tap retry */
    return enginePromise;
  }

  /* ── camera ──────────────────────────────────────────────────── */
  function ensureVideoEl() {
    if (video) return video;
    video = document.createElement("video");
    video.className = "sbg-cam";
    video.muted = true;
    video.autoplay = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    document.body.appendChild(video);
    return video;
  }

  async function acquireCamera() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 15 }
      }
    });
    ensureVideoEl();
    video.srcObject = stream;
    await video.play();
    await new Promise(function (resolve) {
      if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
      video.addEventListener("loadeddata", function onLD() {
        video.removeEventListener("loadeddata", onLD);
        resolve();
      });
    });
  }

  function releaseTracks() {
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  /* ── screen wake lock ────────────────────────────────────────────
     The host page only requests one inside start() (see its wakeLock
     line). If the screen sleeps while armed, visibilitychange would
     release the camera and gestures would stop responding -- silently
     defeating the whole point. So gesture mode holds its own lock for as
     long as it's armed, independent of playback state. */
  async function acquireWakeLock() {
    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() {
    try { if (wakeLock) wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }

  /* ── hold state machine ──────────────────────────────────────────
     One continuous raised palm fires at most once. The lock clears only
     after RELEASE_SAMPLES non-palm frames, so a hand held in view cannot
     repeatedly toggle playback or interfere with verse navigation. */
  function resetDebounce() {
    raised = false; raiseSince = 0; qualifyingSamples = 0; raisedAction = "";
    fireCount = 0; clearSamples = 0;
    wristTrail = []; waveCooldownUntil = 0;
    waveLocked = false; waveClearSamples = 0;
  }

  function fire(action) {
    if (action === "previous") {
      step(-1);
      flashFired("previous");
      return;
    }
    if (action === "next") {
      step(1);
      flashFired("next");
      return;
    }
    if (playing) {
      stop();
      flashFired("pause");
    } else {
      start();
      flashFired("play");
    }
  }

  function flashFired(kind) {
    setState("fired", kind);
    clearTimeout(firedTO);
    firedTO = setTimeout(function () { if (armed) setState("live"); }, FIRED_FLASH_MS);
  }

  /* Gesture direction follows the reader layout, rather than the camera's
     reported rotation (which is inconsistent across mobile browsers):
     portrait uses left/right; landscape uses up/back and down/forward. */
  var landscapeMedia = matchMedia("(orientation: landscape)");

  function readerRelativeWaveDelta(wrist, origin) {
    return landscapeMedia.matches ? origin.y - wrist.y : wrist.x - origin.x;
  }

  /* Track the wrist over a short window. Any smaller movement delays the
     palm action, so beginning a wave cannot accidentally toggle playback
     before the sweep completes. After a wave fires, require the hand to
     leave the frame before accepting another one; its return journey must
     never be interpreted as the opposite swipe. */
  function consumeWave(res, now) {
    var landmarks = res && res.landmarks && res.landmarks[0];
    var wrist = landmarks && landmarks[0];
    if (!wrist || typeof wrist.x !== "number") {
      wristTrail = [];
      if (waveLocked && ++waveClearSamples >= WAVE_RELEASE_SAMPLES) {
        waveLocked = false;
        waveClearSamples = 0;
      }
      return waveLocked;
    }

    waveClearSamples = 0;
    if (waveLocked) {
      setState("waveLocked");
      return true;
    }

    wristTrail.push({ x: wrist.x, y: wrist.y, t: now });
    while (wristTrail.length && now - wristTrail[0].t > WAVE_WINDOW_MS) wristTrail.shift();
    if (wristTrail.length < 2) return false;

    var dx = readerRelativeWaveDelta(wrist, wristTrail[0]);
    if (now < waveCooldownUntil) return true;
    if (Math.abs(dx) < WAVE_DISTANCE) {
      if (Math.abs(dx) > WAVE_STILL_DISTANCE) {
        raised = false; qualifyingSamples = 0; raisedAction = ""; fireCount = 0;
        return true;
      }
      return false;
    }

    /* A front camera sees the reciter's left as camera-right, hence invert
       the reader-relative direction so a physical left wave means previous. */
    step(dx > 0 ? -1 : 1);
    flashFired(dx > 0 ? "previous" : "next");
    wristTrail = [];
    waveCooldownUntil = now + WAVE_COOLDOWN_MS;
    waveLocked = true;
    waveClearSamples = 0;
    raised = false; qualifyingSamples = 0; raisedAction = ""; fireCount = 0;
    return true;
  }

  function consume(res) {
    var g = "None", s = 0;
    if (res && res.gestures && res.gestures[0] && res.gestures[0][0]) {
      g = res.gestures[0][0].categoryName;
      s = res.gestures[0][0].score;
    }
    var now = performance.now();
    var waveInProgress = consumeWave(res, now);
    if (waveInProgress) return;
    var action = !waveInProgress && g === GESTURE && s >= CONF ? "playPause" : "";

    if (!action) {
      clearSamples++;
      if (clearSamples >= RELEASE_SAMPLES) {
        raised = false; qualifyingSamples = 0; raisedAction = ""; fireCount = 0;
        if (!res || !res.landmarks || !res.landmarks[0]) wristTrail = [];
      }
      setState("live");
      return;
    }

    clearSamples = 0;
    if (!raised || raisedAction !== action) {
      raised = true; raisedAction = action; raiseSince = now; qualifyingSamples = 1;
      fireCount = 0;
    } else {
      qualifyingSamples++;
    }

    if (fireCount === 0) {
      if (qualifyingSamples >= HOLD_MIN_SAMPLES && now - raiseSince >= HOLD_MS) {
        fire(action);
        fireCount = 1;
        return;
      }
      setState("hold", action, (now - raiseSince) / HOLD_MS);
      return;
    }

    /* The raised palm has already fired; wait until it drops. */
    setState("live");
  }

  /* ── inference loop ──────────────────────────────────────────────
     A single rAF loop gated by a timestamp comparison, not full-rate --
     continuous ML inference at 60fps for a 20-40 minute session is an
     unnecessary battery/thermal cost. */
  function tick(now) {
    if (!armed) return;
    rafId = requestAnimationFrame(tick);
    if (now - lastInferAt < INFER_MS) return;
    lastInferAt = now;
    if (!video || video.readyState < 2) return;
    if (video.currentTime === lastVideoTime) return; /* no new decoded frame */
    lastVideoTime = video.currentTime;
    try {
      var res = recognizer.recognizeForVideo(video, performance.now());
      inferErrors = 0;
      consume(res);
    } catch (e) {
      inferErrors++;
      if (inferErrors >= MAX_INFER_ERRORS) hardStop("error");
    }
  }

  /* ── arm / disarm / lifecycle ────────────────────────────────── */
  async function arm() {
    if (armed || booting) return;
    if (!supported) { setState("unsupported"); return; }
    booting = true;
    var myToken = ++bootToken;
    try {
      setState("loading");
      var eng = await loadEngine();
      if (myToken !== bootToken) return;
      recognizer = eng;

      setState("requesting");
      await acquireCamera();
      if (myToken !== bootToken) { releaseTracks(); return; }

      await acquireWakeLock();
      if (myToken !== bootToken) { releaseTracks(); releaseWakeLock(); return; }

      armed = true; booting = false; suspended = false;
      S.gest = "on"; store.set("gest", "on");
      resetDebounce();
      lastInferAt = 0; lastVideoTime = -1; inferErrors = 0;
      setState("live");
      rafId = requestAnimationFrame(tick);
    } catch (err) {
      booting = false;
      if (myToken !== bootToken) return; /* superseded by a disarm/re-arm */
      var reason = "error";
      if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) reason = "denied";
      hardStop(reason);
    }
  }

  /* Full teardown without touching the persisted preference -- used for
     an involuntary stop (inference errors, a failed resume-from-hidden),
     as opposed to the user explicitly disarming. */
  function hardStop(nextState) {
    bootToken++; /* invalidate any in-flight arm() */
    armed = false; booting = false; suspended = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    clearTimeout(releaseTO); releaseTO = null;
    releaseTracks();
    releaseWakeLock();
    resetDebounce();
    setState(nextState);
  }

  function userDisarm() {
    hardStop("off");
    S.gest = "off";
    store.set("gest", "off");
  }

  /* ── visibility ──────────────────────────────────────────────────
     Never touches `playing` on either transition -- coming back from a
     locked screen must not start or stop the chant on its own. */
  function onVisibilityChange() {
    if (!armed) return;
    if (document.hidden) {
      suspended = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      wakeLock = null; /* the browser already force-released it on hide */
      clearTimeout(releaseTO);
      releaseTO = setTimeout(releaseTracks, HIDE_RELEASE_MS);
    } else {
      suspended = false;
      clearTimeout(releaseTO); releaseTO = null;
      resetDebounce();
      lastInferAt = 0; lastVideoTime = -1;
      resumeFromVisible();
    }
  }

  async function resumeFromVisible() {
    try {
      if (!stream) await acquireCamera();
      if (!armed) { releaseTracks(); return; } /* disarmed mid-resume */
      await acquireWakeLock();
      if (!armed) { releaseTracks(); releaseWakeLock(); return; }
      setState("live");
      rafId = requestAnimationFrame(tick);
    } catch (err) {
      if (armed) hardStop("denied");
    }
  }

  function onPageHide() {
    if (armed || suspended) hardStop("off");
    if (recognizer) { try { recognizer.close(); } catch (e) {} recognizer = null; }
  }

  /* ── UI ───────────────────────────────────────────────────────── */
  var STATE_TEXT = {
    loading: "Loading gesture model, first time only…",
    requesting: "Allow camera access…",
    live: "Watching · ✋ raise an open hand to play or pause",
    waveLocked: "Verse changed — lower your hand before the next wave",
    denied: "⚠ Camera blocked — check site permissions",
    error: "⚠ Gesture control unavailable",
    unsupported: "⚠ Camera not available here"
  };
  STATE_TEXT.live = "Watching: palm plays/pauses; wave left/right or up/down for verses";
  var ACTIVE_STATES = { loading: 1, requesting: 1, live: 1, hold: 1, fired: 1, waveLocked: 1 };

  function setState(name, extra, frac) {
    if (!statusEl) return;
    statusEl.dataset.s = name;
    clearTimeout(autohideTO);

    /* "live" (armed, idle, watching) is the state the reciter spends
       nearly all of a session in -- it's already shown by the toolbar
       button turning gold, so the pill stays hidden for it and only
       surfaces for states that need attention: loading, a permission
       prompt, a gesture mid-hold, a brief post-fire confirmation, or an
       error. Keeps the bottom of the page from permanently carrying a
       fourth stacked bar on top of the mala strip, transport and toolbar. */
    if (name === "off" || name === "live") {
      statusEl.hidden = true;
      statusTxt.textContent = "";
    } else {
      statusEl.hidden = false;
      if (name === "hold" && extra) {
        statusTxt.textContent = "Holding for " + (extra === "previous" ? "previous verse" : extra === "next" ? "next verse" : playing ? "pause" : "play") + "... " + Math.round(Math.min(1, frac || 0) * 100) + "%";
      } else if (name === "hold") {
        statusTxt.textContent = "✋ holding… " + Math.round(Math.min(1, frac || 0) * 100) + "%";
      } else if (name === "fired" && (extra === "previous" || extra === "next")) {
        statusTxt.textContent = extra === "previous" ? "Previous verse" : "Next verse";
      } else if (name === "fired") {
        statusTxt.textContent = extra === "play" ? "▶ Playing" : "⏸ Paused";
      } else {
        statusTxt.textContent = STATE_TEXT[name] || "";
      }
      if (name === "denied" || name === "error") {
        autohideTO = setTimeout(function () { statusEl.hidden = true; }, STATUS_AUTOHIDE_MS);
      }
    }

    if (btn) {
      btn.classList.toggle("active", !!ACTIVE_STATES[name]);
      btn.setAttribute("aria-pressed", String(!!ACTIVE_STATES[name]));
    }
  }

  function buildUI() {
    if ($("btnGesture")) return;
    var toolbar = $("readerToolbar");
    if (!toolbar) return;

    var divider = document.createElement("div");
    divider.className = "toolbar-divider";

    var group = document.createElement("div");
    group.className = "toolbar-group";

    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btnGesture";
    btn.className = "toolbar-btn";
    btn.setAttribute("aria-pressed", "false");
    btn.title = "Hands-free: palm plays/pauses; wave left/right in portrait or up/down in landscape";
    btn.innerHTML =
      '<span class="toolbar-btn-icon">✋</span>' +
      '<span class="toolbar-btn-text-full">Gesture</span>';
    if (S.gest === "on") btn.classList.add("sbg-hint");
    if (!supported) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.title = "Camera not available in this browser";
    }

    btn.addEventListener("click", function () {
      btn.classList.remove("sbg-hint");
      if (armed || booting) userDisarm(); else arm();
      btn.blur(); /* the page's Space-bar handler would otherwise re-hit this button */
    });

    group.appendChild(btn);
    toolbar.appendChild(divider);
    toolbar.appendChild(group);

    statusEl = document.createElement("div");
    statusEl.id = "sbgStatus";
    statusEl.className = "sbg-status";
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");
    statusEl.hidden = true;
    statusEl.innerHTML = '<span class="sbg-dot"></span><span class="sbg-txt"></span>';
    document.body.appendChild(statusEl);
    statusTxt = statusEl.querySelector(".sbg-txt");

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else buildUI();
})();
