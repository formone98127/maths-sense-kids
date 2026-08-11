(() => {
  /**
   * Stage path: perceptual → attributes → subitizing → 1:1 count → pattern/shape →
   * numeral link → order → recognition → join/take → conservation
   */
  const STAGES = [
    { id: "more", name: "More", say: "Tap the side with more.", rounds: 2, max: 5, icon: "more" },
    { id: "size", name: "Size", say: "Tap the bigger one.", rounds: 2, max: 5, icon: "size" },
    { id: "sort", name: "Sort", say: "Put each with its match.", rounds: 2, max: 5, icon: "sort" },
    { id: "burst", name: "Flash", say: "Look carefully. How many?", rounds: 2, max: 5, icon: "flash" },
    { id: "count", name: "Count", say: "Tap each one.", rounds: 2, max: 5, icon: "count" },
    { id: "pattern", name: "Pattern", say: "What comes next?", rounds: 2, max: 5, icon: "pattern" },
    { id: "shape", name: "Shape", say: "Find the same shape.", rounds: 2, max: 5, icon: "shape" },
    { id: "match", name: "Match", say: "Match the same amount.", rounds: 2, max: 5, icon: "match" },
    { id: "order", name: "Order", say: "Small to big.", rounds: 2, max: 5, icon: "order" },
    { id: "pond", name: "Find", say: "Listen. Tap the number.", rounds: 2, max: 5, icon: "find" },
    { id: "join", name: "Join", say: "Put together. How many?", rounds: 2, max: 5, icon: "join" },
    { id: "take", name: "Take", say: "Some go away. How many left?", rounds: 2, max: 5, icon: "take" },
    { id: "same", name: "Same", say: "Do they match? Tap the equal sign.", rounds: 2, max: 5, icon: "same" },
  ];

  const TOTAL_ROUNDS = STAGES.reduce((n, s) => n + s.rounds, 0);
  const WORD = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const COLORS = ["#3d5a56", "#6b7c8a", "#8a6b5b"];
  const SHAPES = ["circle", "square", "triangle"];

  const state = {
    stars: Number(localStorage.getItem("cg_stars") || 0),
    screen: "home",
    stageIndex: 0,
    roundInStage: 0,
    roundsDone: 0,
    correct: 0,
    locked: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const screens = {
    home: $("#screen-home"),
    intro: $("#screen-intro"),
    game: $("#screen-game"),
    done: $("#screen-done"),
  };

  const els = {
    gameStars: $("#game-stars"),
    title: $("#game-title"),
    stageSub: $("#stage-sub"),
    prompt: $("#game-prompt"),
    cue: $("#game-cue"),
    stage: $("#game-stage"),
    feedback: $("#feedback"),
    bar: $("#progress-bar"),
    pips: $("#stage-pips"),
    introDots: $("#intro-dots"),
    introVisual: $("#intro-visual"),
    doneTitle: $("#done-title"),
    doneMsg: $("#done-msg"),
    doneScore: $("#done-score"),
    soundBtn: $("#btn-sound"),
  };

  function currentStage() {
    return STAGES[state.stageIndex];
  }

  function saveStars() {
    localStorage.setItem("cg_stars", String(state.stars));
    els.gameStars.textContent = String(state.stars);
  }

  function showScreen(name) {
    state.screen = name;
    Object.entries(screens).forEach(([key, el]) => {
      const on = key === name;
      el.hidden = !on;
      el.classList.toggle("active", on);
    });
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function uniqueChoices(answer, count, max) {
    const set = new Set([answer]);
    while (set.size < Math.min(count, max)) set.add(randInt(1, max));
    return shuffle([...set]);
  }

  function speak(text) {
    if (!window.speechSynthesis || !Sound.isEnabled()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = 0.88;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  function sayNumber(n) {
    speak(WORD[n] || String(n));
  }

  const Sound = (() => {
    let ctx = null;
    let master = null;
    let enabled = localStorage.getItem("cg_sound") !== "0";
    let unlockPromise = null;

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.45;
        master.connect(ctx.destination);
      }
      return ctx;
    }

    function unlock() {
      const c = ensure();
      if (!c) return Promise.resolve(false);
      if (c.state === "running") return Promise.resolve(true);
      if (!unlockPromise) {
        unlockPromise = c
          .resume()
          .then(() => true)
          .catch(() => false)
          .finally(() => {
            unlockPromise = null;
          });
      }
      return unlockPromise;
    }

    function tone(freq, when, dur, type = "sine", gain = 0.35) {
      const c = ensure();
      if (!c || !enabled || c.state !== "running") return;
      const t0 = c.currentTime + Math.max(0, when);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
      g.gain.linearRampToValueAtTime(gain * 0.7, t0 + dur * 0.45);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    function play(fn) {
      if (!enabled) return;
      unlock().then((ok) => {
        if (!ok || !enabled) return;
        fn();
      });
    }

    return {
      unlock,
      setEnabled(on) {
        enabled = !!on;
        localStorage.setItem("cg_sound", enabled ? "1" : "0");
      },
      isEnabled() {
        return enabled;
      },
      ok() {
        play(() => {
          tone(392, 0, 0.35, "sine", 0.32);
          tone(523.25, 0.1, 0.45, "sine", 0.28);
        });
      },
      soft() {
        play(() => tone(440, 0, 0.2, "sine", 0.22));
      },
      no() {
        play(() => {
          tone(220, 0, 0.35, "sine", 0.24);
          tone(196, 0.06, 0.3, "sine", 0.16);
        });
      },
      stage() {
        play(() => {
          tone(329.63, 0, 0.35, "sine", 0.24);
          tone(415.3, 0.16, 0.4, "sine", 0.22);
          tone(523.25, 0.32, 0.5, "sine", 0.2);
        });
      },
      done() {
        play(() => {
          tone(349.23, 0, 0.4, "sine", 0.24);
          tone(440, 0.2, 0.45, "sine", 0.22);
          tone(523.25, 0.4, 0.55, "sine", 0.2);
          tone(659.25, 0.58, 0.7, "sine", 0.16);
        });
      },
    };
  })();

  function setFeedback(kind) {
    els.feedback.className = `feedback show ${kind || ""}`;
    els.feedback.innerHTML =
      kind === "good"
        ? `<span class="fb-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8-8 1.4 1.4-9.4 9.4z"/></svg></span>`
        : kind === "bad"
          ? `<span class="fb-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path fill="currentColor" d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg></span>`
          : "";
  }

  function updateProgress() {
    els.bar.style.width = `${(state.roundsDone / TOTAL_ROUNDS) * 100}%`;
  }

  function award(n = 1) {
    state.stars += n;
    state.correct += 1;
    saveStars();
  }

  function renderPips() {
    els.pips.innerHTML = STAGES.map(
      (_, i) => `<span class="pip${i === state.stageIndex ? " on" : i < state.stageIndex ? " done" : ""}"></span>`
    ).join("");
  }

  function updateChrome() {
    const s = currentStage();
    els.title.textContent = `Stage ${state.stageIndex + 1}`;
    els.stageSub.textContent = s.name;
    saveStars();
    updateProgress();
    renderPips();
  }

  function dotsHtml(n, cls = "dot") {
    return Array.from({ length: n }, () => `<span class="${cls}"></span>`).join("");
  }

  function shapeEl(kind, color) {
    return `<span class="shape ${kind}" style="--c:${color || "currentColor"}"></span>`;
  }

  function setCue(kind) {
    const icons = {
      more: `<svg viewBox="0 0 72 40" width="78" height="42"><circle cx="14" cy="20" r="4" fill="currentColor"/><circle cx="48" cy="12" r="4" fill="currentColor"/><circle cx="60" cy="20" r="4" fill="currentColor"/><circle cx="48" cy="28" r="4" fill="currentColor"/><path d="M28 20h8" stroke="currentColor" stroke-width="2"/><path d="M34 14l8 6-8 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      size: `<svg viewBox="0 0 64 40" width="70" height="42"><circle cx="16" cy="22" r="8" fill="currentColor" opacity=".45"/><circle cx="46" cy="20" r="14" fill="currentColor"/></svg>`,
      sort: `<svg viewBox="0 0 64 40" width="70" height="42"><circle cx="14" cy="14" r="6" fill="currentColor" opacity=".35"/><circle cx="14" cy="28" r="6" fill="currentColor"/><rect x="40" y="8" width="14" height="14" rx="2" fill="currentColor" opacity=".35"/><rect x="40" y="24" width="14" height="14" rx="2" fill="currentColor"/></svg>`,
      flash: `<svg viewBox="0 0 56 40" width="64" height="42"><ellipse cx="28" cy="20" rx="18" ry="12" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="28" cy="20" r="5" fill="currentColor"/></svg>`,
      count: `<svg viewBox="0 0 72 40" width="78" height="42"><circle cx="14" cy="20" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="36" cy="20" r="6" fill="currentColor"/><circle cx="58" cy="20" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M36 8v6" stroke="currentColor" stroke-width="2"/></svg>`,
      pattern: `<svg viewBox="0 0 80 40" width="86" height="42"><circle cx="12" cy="20" r="7" fill="currentColor"/><rect x="28" y="13" width="14" height="14" fill="currentColor"/><circle cx="56" cy="20" r="7" fill="currentColor"/><text x="74" y="25" font-size="16" fill="currentColor">?</text></svg>`,
      shape: `<svg viewBox="0 0 64 40" width="70" height="42"><circle cx="16" cy="20" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M38 28L48 10l10 18H38z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      match: `<svg viewBox="0 0 64 40" width="72" height="42"><circle cx="14" cy="20" r="10" fill="none" stroke="currentColor" stroke-width="2"/><text x="14" y="25" text-anchor="middle" font-size="14" font-family="Instrument Serif, serif" fill="currentColor">2</text><path d="M28 20h8" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="14" r="3" fill="currentColor"/><circle cx="50" cy="26" r="3" fill="currentColor"/></svg>`,
      order: `<svg viewBox="0 0 72 40" width="80" height="42"><text x="8" y="26" font-size="16" font-family="Instrument Serif, serif" fill="currentColor">1</text><text x="28" y="26" font-size="16" font-family="Instrument Serif, serif" fill="currentColor">2</text><text x="48" y="26" font-size="16" font-family="Instrument Serif, serif" fill="currentColor">3</text><path d="M52 12l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      find: `<svg viewBox="0 0 48 40" width="56" height="42"><path d="M10 14v12h6l8 6V8l-8 6H10z" fill="currentColor"/><path d="M30 12a8 8 0 0 1 0 16" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      join: `<svg viewBox="0 0 72 40" width="78" height="42"><circle cx="12" cy="20" r="4" fill="currentColor"/><circle cx="24" cy="20" r="4" fill="currentColor"/><text x="36" y="25" font-size="16" fill="currentColor">+</text><circle cx="50" cy="20" r="4" fill="currentColor"/><text x="64" y="25" font-size="16" fill="currentColor">?</text></svg>`,
      take: `<svg viewBox="0 0 72 40" width="78" height="42"><circle cx="12" cy="20" r="4" fill="currentColor"/><circle cx="24" cy="20" r="4" fill="currentColor"/><circle cx="36" cy="20" r="4" fill="currentColor" opacity=".25"/><text x="50" y="25" font-size="16" fill="currentColor">→</text><circle cx="64" cy="20" r="4" fill="currentColor"/></svg>`,
      same: `<svg viewBox="0 0 72 40" width="78" height="42"><circle cx="12" cy="14" r="3" fill="currentColor"/><circle cx="22" cy="14" r="3" fill="currentColor"/><circle cx="32" cy="14" r="3" fill="currentColor"/><circle cx="12" cy="28" r="3" fill="currentColor"/><circle cx="28" cy="28" r="3" fill="currentColor"/><circle cx="44" cy="28" r="3" fill="currentColor"/><text x="60" y="24" font-size="18" fill="currentColor">=</text></svg>`,
    };
    els.cue.innerHTML = icons[kind] || "";
  }

  function stageIconSvg(kind) {
    return (
      {
        more: `<div class="viz-more"><span class="pile small">${dotsHtml(2, "seed")}</span><span class="viz-arrow"></span><span class="pile">${dotsHtml(4, "seed")}</span></div>`,
        size: `<div class="viz-size"><span class="size-dot sm"></span><span class="size-dot lg"></span></div>`,
        sort: `<div class="viz-sort"><span class="bin" style="--c:${COLORS[0]}"></span><span class="bin" style="--c:${COLORS[1]}"></span></div>`,
        flash: `<div class="viz-flash"><span class="viz-eye"></span><span class="viz-dots blink"><i></i><i></i><i></i><i></i></span></div>`,
        count: `<div class="viz-count"><span class="tap-dot"></span><span class="tap-dot on"></span><span class="tap-dot"></span></div>`,
        pattern: `<div class="viz-pattern">${shapeEl("circle")}${shapeEl("square")}${shapeEl("circle")}<span class="q">?</span></div>`,
        shape: `<div class="viz-shape">${shapeEl("triangle")}</div>`,
        match: `<div class="viz-match"><span class="viz-num">3</span><span class="viz-arrow"></span><span class="viz-dots"><i></i><i></i><i></i></span></div>`,
        order: `<div class="viz-order"><span>1</span><span>2</span><span>3</span><span>4</span></div>`,
        find: `<div class="viz-find"><span class="viz-ear"></span><span class="viz-num big">2</span></div>`,
        join: `<div class="viz-join"><span class="pile">${dotsHtml(2, "seed")}</span><span class="plus">+</span><span class="pile">${dotsHtml(3, "seed")}</span></div>`,
        take: `<div class="viz-join"><span class="pile">${dotsHtml(4, "seed")}</span><span class="plus">−</span><span class="pile">${dotsHtml(1, "seed")}</span></div>`,
        same: `<div class="viz-same"><span class="pile tight">${dotsHtml(3, "seed")}</span><span class="plus">=</span><span class="pile spread">${dotsHtml(3, "seed")}</span></div>`,
      }[kind] || ""
    );
  }

  function startAdventure() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.stageIndex = 0;
    state.roundInStage = 0;
    state.roundsDone = 0;
    state.correct = 0;
    state.locked = false;
    Sound.unlock().then(() => showStageIntro());
  }

  function showStageIntro() {
    const s = currentStage();
    els.introDots.innerHTML = STAGES.map(
      (_, i) => `<span class="pip${i === state.stageIndex ? " on" : i < state.stageIndex ? " done" : ""}"></span>`
    ).join("");
    els.introVisual.innerHTML = stageIconSvg(s.icon);
    Sound.stage();
    setTimeout(() => speak(s.say), 280);
    showScreen("intro");
  }

  function beginStagePlay() {
    state.roundInStage = 0;
    state.locked = false;
    showScreen("game");
    updateChrome();
    nextRound();
  }

  function finishAdventure() {
    els.doneTitle.textContent = "Complete";
    els.doneMsg.textContent = `${state.correct} of ${TOTAL_ROUNDS}`;
    els.doneScore.textContent = String(state.stars);
    Sound.done();
    speak("Well done.");
    showScreen("done");
  }

  function nextRound() {
    const s = currentStage();
    state.roundInStage += 1;

    if (state.roundInStage > s.rounds) {
      state.stageIndex += 1;
      if (state.stageIndex >= STAGES.length) {
        finishAdventure();
        return;
      }
      showStageIntro();
      return;
    }

    state.roundsDone += 1;
    state.locked = false;
    setFeedback("");
    updateChrome();
    setCue(s.icon);

    (
      {
        more: renderMore,
        size: renderSize,
        sort: renderSort,
        burst: renderBurst,
        count: renderCount,
        pattern: renderPattern,
        shape: renderShape,
        match: renderMatch,
        order: renderOrder,
        pond: renderPond,
        join: renderJoin,
        take: renderTake,
        same: renderSame,
      }[s.id] || renderMatch
    )();
  }

  /* 1 MORE / LESS — magnitude */
  function renderMore() {
    const max = currentStage().max;
    let a = randInt(1, max);
    let b = randInt(1, max);
    while (a === b) b = randInt(1, max);
    const leftMore = a > b;
    els.prompt.textContent = "More";
    speak("Which has more?");
    els.stage.innerHTML = `
      <div class="compare-row invite">
        <button type="button" class="pile-btn" data-side="L" aria-label="Left group">${dotsHtml(a, "seed")}</button>
        <button type="button" class="pile-btn" data-side="R" aria-label="Right group">${dotsHtml(b, "seed")}</button>
      </div>`;
    $$(".pile-btn", els.stage).forEach((btn) => {
      btn.addEventListener("click", () => {
        const ok = (btn.dataset.side === "L") === leftMore;
        judge(btn, ok);
      });
    });
  }

  /* SIZE — qualitative comparison */
  function renderSize() {
    const leftBig = Math.random() < 0.5;
    els.prompt.textContent = "Bigger";
    speak("Tap the bigger one.");
    els.stage.innerHTML = `
      <div class="compare-row invite size-row">
        <button type="button" class="size-btn" data-big="${leftBig}" aria-label="Left">
          <span class="size-dot ${leftBig ? "lg" : "sm"}"></span>
        </button>
        <button type="button" class="size-btn" data-big="${!leftBig}" aria-label="Right">
          <span class="size-dot ${leftBig ? "sm" : "lg"}"></span>
        </button>
      </div>`;
    $$(".size-btn", els.stage).forEach((btn) => {
      btn.addEventListener("click", () => judge(btn, btn.dataset.big === "true"));
    });
  }

  /* 2 SORT — attributes (color) */
  function renderSort() {
    const cA = COLORS[0];
    const cB = COLORS[1];
    const items = shuffle([
      { id: 1, color: cA },
      { id: 2, color: cA },
      { id: 3, color: cB },
      { id: 4, color: cB },
    ]);
    const placed = {};
    els.prompt.textContent = "Sort";
    speak("Match the colors.");
    els.stage.innerHTML = `
      <div class="sort-layout">
        <div class="bins">
          <button type="button" class="bin-drop" data-bin="A" style="--c:${cA}" aria-label="Bin A"></button>
          <button type="button" class="bin-drop" data-bin="B" style="--c:${cB}" aria-label="Bin B"></button>
        </div>
        <div class="sort-pool invite" role="group"></div>
      </div>`;
    const pool = $(".sort-pool", els.stage);
    let selected = null;
    let activeBin = null;

    items.forEach((it) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sort-chip";
      chip.style.setProperty("--c", it.color);
      chip.dataset.color = it.color;
      chip.dataset.id = String(it.id);
      chip.addEventListener("click", () => {
        if (state.locked) return;
        $$(".sort-chip", pool).forEach((c) => c.classList.remove("selected"));
        chip.classList.add("selected");
        selected = chip;
        tryPlace();
      });
      pool.appendChild(chip);
    });

    $$(".bin-drop", els.stage).forEach((bin) => {
      bin.addEventListener("click", () => {
        if (state.locked) return;
        $$(".bin-drop", els.stage).forEach((b) => b.classList.remove("selected"));
        bin.classList.add("selected");
        activeBin = bin;
        tryPlace();
      });
    });

    function tryPlace() {
      if (!selected || !activeBin) return;
      const want = activeBin.dataset.bin === "A" ? cA : cB;
      const ok = selected.dataset.color === want;
      if (!ok) {
        selected.classList.add("wrong");
        activeBin.classList.add("wrong");
        setFeedback("bad");
        Sound.no();
        setTimeout(() => {
          selected.classList.remove("wrong", "selected");
          activeBin.classList.remove("wrong", "selected");
          selected = null;
          activeBin = null;
          setFeedback("");
        }, 400);
        return;
      }
      const ghost = document.createElement("span");
      ghost.className = "sort-chip in-bin";
      ghost.style.setProperty("--c", selected.dataset.color);
      activeBin.appendChild(ghost);
      placed[selected.dataset.id] = true;
      selected.remove();
      selected = null;
      activeBin.classList.remove("selected");
      activeBin = null;
      Sound.soft();
      if (Object.keys(placed).length === items.length) {
        state.locked = true;
        award(2);
        setFeedback("good");
        Sound.ok();
        setTimeout(nextRound, 700);
      }
    }
  }

  /* 3 FLASH — subitize */
  function renderBurst() {
    const max = Math.min(currentStage().max, 5);
    const answer = randInt(1, max);
    const choices = uniqueChoices(answer, 4, max);
    const flashMs = answer <= 3 ? 900 : 1200;
    const stageId = currentStage().id;

    els.prompt.textContent = "Watch";
    speak("Look.");
    els.stage.innerHTML = `
      <div class="burst-layout">
        <div class="watch-cue pulse" aria-hidden="true">
          <svg viewBox="0 0 56 40" width="64" height="44"><ellipse cx="28" cy="20" rx="18" ry="12" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="28" cy="20" r="5" fill="currentColor"/></svg>
        </div>
        <div class="seed-field is-flashing" aria-label="Dots"></div>
        <div class="num-pad is-disabled" role="group" aria-label="Choose count" hidden></div>
      </div>`;

    const field = $(".seed-field", els.stage);
    const pad = $(".num-pad", els.stage);
    const watch = $(".watch-cue", els.stage);
    field.innerHTML = dotsHtml(answer, "seed");

    choices.forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num-key";
      btn.textContent = n;
      btn.disabled = true;
      btn.addEventListener("click", () => judge(btn, n === answer));
      pad.appendChild(btn);
    });

    state.locked = true;
    setTimeout(() => {
      if (state.screen !== "game" || currentStage().id !== stageId) return;
      watch.hidden = true;
      field.classList.add("is-hidden");
      pad.hidden = false;
      pad.classList.remove("is-disabled");
      pad.classList.add("invite");
      $$(".num-key", pad).forEach((b) => {
        b.disabled = false;
      });
      speak("How many?");
      state.locked = false;
    }, flashMs + 400);
  }

  /* 4 PATTERN — AB extend */
  function renderPattern() {
    const pair = shuffle([
      { a: "circle", b: "square" },
      { a: "square", b: "triangle" },
      { a: "circle", b: "triangle" },
    ])[0];
    const seq = [pair.a, pair.b, pair.a, pair.b, pair.a];
    const answer = pair.b;
    const distractors = SHAPES.filter((s) => s !== answer);
    const options = shuffle([answer, ...distractors]);

    els.prompt.textContent = "Next";
    speak("What comes next?");
    els.stage.innerHTML = `
      <div class="pattern-layout">
        <div class="pattern-row" aria-label="Pattern">${seq.map((s) => shapeEl(s)).join("")}<span class="shape-slot pulse">?</span></div>
        <div class="shape-choices invite" role="group"></div>
      </div>`;
    const box = $(".shape-choices", els.stage);
    options.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shape-btn";
      btn.innerHTML = shapeEl(s);
      btn.setAttribute("aria-label", s);
      btn.addEventListener("click", () => judge(btn, s === answer));
      box.appendChild(btn);
    });
  }

  /* 5 SHAPE — visual geometry */
  function renderShape() {
    const answer = SHAPES[randInt(0, SHAPES.length - 1)];
    const options = shuffle([...SHAPES]);
    els.prompt.textContent = "Same shape";
    speak("Find the same shape.");
    els.stage.innerHTML = `
      <div class="match-layout">
        <div class="target-card pulse">${shapeEl(answer)}</div>
        <div class="hint-arrow" aria-hidden="true"></div>
        <div class="shape-choices invite" role="group"></div>
      </div>`;
    const box = $(".shape-choices", els.stage);
    options.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shape-btn";
      btn.innerHTML = shapeEl(s);
      btn.addEventListener("click", () => judge(btn, s === answer));
      box.appendChild(btn);
    });
  }

  /* 6 MATCH — numeral ↔ quantity */
  function renderMatch() {
    const max = currentStage().max;
    const mode = Math.random() < 0.5 ? "numToQty" : "qtyToNum";
    const answer = randInt(1, max);
    const options = uniqueChoices(answer, 3, max);

    if (mode === "numToQty") {
      els.prompt.textContent = `Find ${answer} dots`;
      speak(`Find ${WORD[answer]}.`);
      els.stage.innerHTML = `
        <div class="match-layout">
          <div class="target-card pulse"><div class="big-num">${answer}</div><div class="hint-arrow"></div></div>
          <div class="stones invite" role="group"></div>
        </div>`;
      const box = $(".stones", els.stage);
      options.forEach((n) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stone qty";
        btn.innerHTML = `<span class="mini-dots">${"<i></i>".repeat(n)}</span>`;
        btn.addEventListener("click", () => judge(btn, n === answer));
        box.appendChild(btn);
      });
    } else {
      els.prompt.textContent = "Which number?";
      speak("How many?");
      els.stage.innerHTML = `
        <div class="match-layout">
          <div class="target-card pulse"><div class="dots-board">${dotsHtml(answer)}</div><div class="hint-arrow"></div></div>
          <div class="stones invite" role="group"></div>
        </div>`;
      const box = $(".stones", els.stage);
      options.forEach((n) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stone";
        btn.textContent = n;
        btn.addEventListener("click", () => judge(btn, n === answer));
        box.appendChild(btn);
      });
    }
  }

  /* 7 ORDER — stable order */
  function renderOrder() {
    const max = currentStage().max;
    const len = 4;
    const start = randInt(1, max - len + 1);
    const seq = Array.from({ length: len }, (_, i) => start + i);
    const pool = shuffle(seq);

    els.prompt.textContent = "Order";
    speak("Small to big.");
    els.stage.innerHTML = `
      <div class="order-layout">
        <div class="order-rail"><span class="rail-arrow"></span></div>
        <div class="slots"></div>
        <div class="pool invite"></div>
      </div>`;

    const slotsEl = $(".slots", els.stage);
    const poolEl = $(".pool", els.stage);
    const filled = [];

    seq.forEach(() => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slotsEl.appendChild(slot);
    });
    slotsEl.children[0].classList.add("next");

    pool.forEach((n) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "slot-chip";
      chip.textContent = n;
      if (n === seq[0]) chip.classList.add("hint");
      chip.addEventListener("click", () => {
        if (state.locked) return;
        const expect = seq[filled.length];
        if (n !== expect) {
          chip.classList.add("wrong");
          setFeedback("bad");
          Sound.no();
          setTimeout(() => chip.classList.remove("wrong"), 350);
          return;
        }
        chip.remove();
        filled.push(n);
        const slot = slotsEl.children[filled.length - 1];
        slot.classList.remove("next");
        slot.classList.add("filled");
        slot.textContent = n;
        if (filled.length < seq.length) {
          slotsEl.children[filled.length].classList.add("next");
          $$(".slot-chip", poolEl).forEach((c) => c.classList.remove("hint"));
          const nextChip = $$(".slot-chip", poolEl).find((c) => Number(c.textContent) === seq[filled.length]);
          if (nextChip) nextChip.classList.add("hint");
          setFeedback("good");
          Sound.soft();
          setTimeout(() => setFeedback(""), 280);
        } else {
          state.locked = true;
          award(2);
          setFeedback("good");
          Sound.ok();
          setTimeout(nextRound, 700);
        }
      });
      poolEl.appendChild(chip);
    });
  }

  /* 8 FIND — numeral recognition */
  function renderPond() {
    const max = currentStage().max;
    const answer = randInt(1, max);
    const fishNums = uniqueChoices(answer, Math.min(5, max), max);

    els.prompt.textContent = `Find ${answer}`;
    els.stage.innerHTML = `
      <div class="match-layout" style="width:100%">
        <button type="button" class="speak-btn pulse" id="hear-num" aria-label="Hear again">
          <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M4 9v6h3l5 4V5L7 9H4zm11.5 3a3.5 3.5 0 0 0-1.5-2.9v5.8A3.5 3.5 0 0 0 15.5 12z"/></svg>
        </button>
        <div class="pond invite" role="group"></div>
      </div>`;

    const playAnswer = () => sayNumber(answer);
    playAnswer();
    $("#hear-num", els.stage).addEventListener("click", playAnswer);

    const pond = $(".pond", els.stage);
    fishNums.forEach((n) => {
      const f = document.createElement("button");
      f.type = "button";
      f.className = "fish";
      f.textContent = n;
      f.addEventListener("click", () => judge(f, n === answer));
      pond.appendChild(f);
    });
  }

  /* 9 JOIN — part–whole / early addition */
  function renderJoin() {
    const max = currentStage().max;
    let left = randInt(1, 3);
    let right = randInt(1, Math.min(3, max - left));
    if (left + right < 2) right = 2;
    const answer = left + right;
    const choices = uniqueChoices(answer, 4, Math.min(max + 2, 8));

    els.prompt.textContent = "Join";
    speak("How many altogether?");
    els.stage.innerHTML = `
      <div class="join-layout">
        <div class="join-sets pulse">
          <div class="pile-card">${dotsHtml(left, "seed")}</div>
          <span class="plus" aria-hidden="true">+</span>
          <div class="pile-card">${dotsHtml(right, "seed")}</div>
        </div>
        <div class="num-pad invite" role="group"></div>
      </div>`;
    const pad = $(".num-pad", els.stage);
    choices.forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num-key";
      btn.textContent = n;
      btn.addEventListener("click", () => judge(btn, n === answer));
      pad.appendChild(btn);
    });
  }

  /* COUNT — one-to-one + cardinality */
  function renderCount() {
    const n = randInt(3, Math.min(currentStage().max, 5));
    let tapped = 0;
    els.prompt.textContent = "Count";
    speak("Tap each one.");
    els.stage.innerHTML = `
      <div class="count-layout">
        <div class="count-field invite" role="group" aria-label="Tap each"></div>
        <div class="count-total" id="count-total" aria-live="polite"></div>
      </div>`;
    const field = $(".count-field", els.stage);
    const total = $("#count-total", els.stage);

    for (let i = 0; i < n; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "count-dot";
      btn.setAttribute("aria-label", "item");
      btn.addEventListener("click", () => {
        if (state.locked || btn.classList.contains("on")) return;
        btn.classList.add("on");
        tapped += 1;
        total.textContent = String(tapped);
        sayNumber(tapped);
        Sound.soft();
        if (tapped === n) {
          state.locked = true;
          award(1);
          setFeedback("good");
          Sound.ok();
          setTimeout(() => speak(WORD[n] || String(n)), 200);
          setTimeout(nextRound, 900);
        }
      });
      field.appendChild(btn);
    }
  }

  /* TAKE — separating / early subtraction */
  function renderTake() {
    const max = currentStage().max;
    const start = randInt(3, max);
    const remove = randInt(1, start - 1);
    const answer = start - remove;
    const choices = uniqueChoices(answer, 4, max);

    els.prompt.textContent = "Take";
    speak("How many left?");
    els.stage.innerHTML = `
      <div class="join-layout">
        <div class="take-board" aria-label="Objects">
          ${Array.from({ length: start }, (_, i) =>
            `<span class="seed take-seed${i >= answer ? "" : ""}" data-i="${i}"></span>`
          ).join("")}
        </div>
        <div class="num-pad invite" role="group"></div>
      </div>`;

    const seeds = $$(".take-seed", els.stage);
    state.locked = true;
    setTimeout(() => {
      seeds.forEach((s, i) => {
        if (i >= answer) s.classList.add("gone");
      });
      state.locked = false;
    }, 700);

    const pad = $(".num-pad", els.stage);
    choices.forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num-key";
      btn.textContent = n;
      btn.addEventListener("click", () => judge(btn, n === answer));
      pad.appendChild(btn);
    });
  }

  /* SAME — conservation of number */
  function renderSame() {
    const n = randInt(3, 5);
    const equal = Math.random() < 0.75;
    const left = n;
    let right = equal ? n : n + (Math.random() < 0.5 ? 1 : -1);
    if (right < 2) right = 2;
    if (!equal && right === left) right = left + 1;
    const answer = left === right ? "eq" : left > right ? "L" : "R";

    els.prompt.textContent = "Same?";
    speak(left === right ? "Are they the same?" : "Which has more?");
    els.stage.innerHTML = `
      <div class="same-layout">
        <div class="compare-row">
          <button type="button" class="pile-btn tight-pack" data-pick="L" aria-label="Left">${dotsHtml(left, "seed")}</button>
          <button type="button" class="pile-btn spread-pack" data-pick="R" aria-label="Right">${dotsHtml(right, "seed")}</button>
        </div>
        <button type="button" class="eq-btn pulse" data-pick="eq" aria-label="Same">=</button>
      </div>`;

    $$("[data-pick]", els.stage).forEach((btn) => {
      btn.addEventListener("click", () => judge(btn, btn.dataset.pick === answer));
    });
  }

  function judge(el, ok) {
    if (state.locked) return;
    state.locked = true;
    if (ok) {
      el.classList.add("correct");
      award(1);
      setFeedback("good");
      Sound.ok();
      setTimeout(nextRound, 650);
    } else {
      el.classList.add("wrong");
      setFeedback("bad");
      Sound.no();
      setTimeout(() => {
        el.classList.remove("wrong");
        setFeedback("");
        state.locked = false;
      }, 450);
    }
  }

  document.body.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (!go) return;
    if (go.dataset.go === "home") {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      showScreen("home");
    }
  });

  $("#btn-play").addEventListener("click", startAdventure);
  $("#btn-intro-go").addEventListener("click", () => {
    Sound.unlock().then(() => beginStagePlay());
  });
  $("#btn-again").addEventListener("click", startAdventure);

  function syncSoundBtn() {
    const on = Sound.isEnabled();
    els.soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
    const onIco = $(".ico-on", els.soundBtn);
    const offIco = $(".ico-off", els.soundBtn);
    if (onIco) onIco.hidden = !on;
    if (offIco) offIco.hidden = on;
  }
  els.soundBtn.addEventListener("click", () => {
    Sound.unlock();
    Sound.setEnabled(!Sound.isEnabled());
    syncSoundBtn();
    if (Sound.isEnabled()) Sound.soft();
  });
  syncSoundBtn();

  saveStars();
  showScreen("home");
})();
