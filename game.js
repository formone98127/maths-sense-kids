(() => {
  /**
   * Stage path: perceptual → attributes → subitizing → 1:1 count → pattern/shape →
   * numeral link → order → recognition → join/take → conservation
   * Easy mode: extreme contrasts, 2 choices, glowing hand guides.
   */
  const STAGES = [
    { id: "more", name: "More", say: "Tap the side with more.", rounds: 2, max: 5, icon: "more" },
    { id: "size", name: "Size", say: "Tap the bigger one.", rounds: 2, max: 5, icon: "size" },
    { id: "sort", name: "Sort", say: "Put each with its match.", rounds: 2, max: 5, icon: "sort" },
    { id: "burst", name: "Flash", say: "Look carefully. How many?", rounds: 2, max: 3, icon: "flash" },
    { id: "count", name: "Count", say: "Tap each one.", rounds: 2, max: 3, icon: "count" },
    { id: "pattern", name: "Pattern", say: "What comes next?", rounds: 2, max: 5, icon: "pattern" },
    { id: "shape", name: "Shape", say: "Find the same shape.", rounds: 2, max: 5, icon: "shape" },
    { id: "match", name: "Match", say: "Match the same amount.", rounds: 2, max: 4, icon: "match" },
    { id: "order", name: "Order", say: "Small to big.", rounds: 2, max: 3, icon: "order" },
    { id: "pond", name: "Find", say: "Listen. Tap the number.", rounds: 2, max: 3, icon: "find" },
    { id: "join", name: "Join", say: "Put together. How many?", rounds: 2, max: 4, icon: "join" },
    { id: "take", name: "Take", say: "Some go away. How many left?", rounds: 2, max: 4, icon: "take" },
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

  function handSvg() {
    return `<span class="hand" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M9 11V5a1 1 0 0 1 2 0v4h1V3a1 1 0 0 1 2 0v6h1V4a1 1 0 0 1 2 0v8h1V7a1 1 0 1 1 2 0v9a5 5 0 0 1-5 5h-2.2A5.8 5.8 0 0 1 8 15.2V11z"/></svg></span>`;
  }

  function guide(el) {
    el.classList.add("guide");
    if (!el.querySelector(".hand")) el.insertAdjacentHTML("beforeend", handSvg());
  }

  function clearGuides(root = els.stage) {
    root.querySelectorAll(".guide").forEach((el) => {
      el.classList.remove("guide");
      const h = el.querySelector(".hand");
      if (h) h.remove();
    });
  }

  function howHtml(kind) {
    /* Big visual “how” demos — no words required */
    const demos = {
      more: `
        <div class="how-demo">
          <div class="how-pair">
            <div class="how-pile">${dotsHtml(2, "seed")}</div>
            <div class="how-pile how-correct glow">${dotsHtml(5, "seed")}${handSvg()}</div>
          </div>
        </div>`,
      size: `
        <div class="how-demo">
          <div class="how-pair">
            <div class="how-box"><span class="size-dot sm"></span></div>
            <div class="how-box how-correct glow"><span class="size-dot lg"></span>${handSvg()}</div>
          </div>
        </div>`,
      sort: `
        <div class="how-demo how-sort-demo">
          <div class="how-bins">
            <div class="how-bin" style="--c:${COLORS[0]}"><span class="sort-chip in-bin" style="--c:${COLORS[0]}"></span></div>
            <div class="how-bin" style="--c:${COLORS[1]}"><span class="sort-chip in-bin" style="--c:${COLORS[1]}"></span></div>
          </div>
          <div class="how-fly">
            <span class="sort-chip fly-a" style="--c:${COLORS[0]}"></span>
            <span class="sort-chip fly-b" style="--c:${COLORS[1]}"></span>
          </div>
        </div>`,
      flash: `
        <div class="how-demo how-flash-demo">
          <div class="how-eye pulse"></div>
          <div class="how-flash-dots blink-set">${dotsHtml(3, "seed")}</div>
        </div>`,
      count: `
        <div class="how-demo how-count-demo">
          <span class="count-dot"></span>
          <span class="count-dot on"></span>
          <span class="count-dot how-next">${handSvg()}</span>
        </div>`,
      pattern: `
        <div class="how-demo">
          <div class="pattern-row how-pattern">
            ${shapeEl("circle")}${shapeEl("square")}${shapeEl("circle")}
            <span class="shape-slot glow">?</span>
          </div>
          <div class="how-answer">${shapeEl("square")}${handSvg()}</div>
        </div>`,
      shape: `
        <div class="how-demo">
          <div class="how-target">${shapeEl("triangle")}</div>
          <div class="hint-arrow"></div>
          <div class="how-pair">
            <div class="how-box">${shapeEl("circle")}</div>
            <div class="how-box how-correct glow">${shapeEl("triangle")}${handSvg()}</div>
          </div>
        </div>`,
      match: `
        <div class="how-demo">
          <div class="how-target"><span class="viz-num">3</span></div>
          <div class="hint-arrow"></div>
          <div class="how-pair">
            <div class="how-box">${dotsHtml(2, "seed")}</div>
            <div class="how-box how-correct glow">${dotsHtml(3, "seed")}${handSvg()}</div>
          </div>
        </div>`,
      order: `
        <div class="how-demo">
          <div class="how-order-track">
            <span class="how-slot filled">1</span>
            <span class="how-slot filled">2</span>
            <span class="how-slot next glow">3</span>
            <span class="how-slot"></span>
          </div>
          <div class="rail-arrow wide"></div>
          <div class="how-chips"><span class="slot-chip hint">3${handSvg()}</span><span class="slot-chip">4</span></div>
        </div>`,
      find: `
        <div class="how-demo how-find-demo">
          <div class="speak-waves pulse">
            <svg viewBox="0 0 24 24" width="40" height="40"><path fill="currentColor" d="M4 9v6h3l5 4V5L7 9H4zm11.5 3a3.5 3.5 0 0 0-1.5-2.9v5.8A3.5 3.5 0 0 0 15.5 12z"/></svg>
          </div>
          <div class="how-pair">
            <div class="fish how-dim">1</div>
            <div class="fish how-correct glow">3${handSvg()}</div>
            <div class="fish how-dim">5</div>
          </div>
        </div>`,
      join: `
        <div class="how-demo how-join-demo">
          <div class="how-pile">${dotsHtml(2, "seed")}</div>
          <span class="plus">+</span>
          <div class="how-pile">${dotsHtml(2, "seed")}</div>
          <span class="plus">→</span>
          <div class="how-pile how-correct glow">${dotsHtml(4, "seed")}</div>
        </div>`,
      take: `
        <div class="how-demo how-take-demo">
          <div class="take-board">
            <span class="seed"></span><span class="seed"></span><span class="seed"></span>
            <span class="seed gone"></span><span class="seed gone"></span>
          </div>
          <div class="how-answer"><span class="num-key how-correct">3${handSvg()}</span></div>
        </div>`,
      same: `
        <div class="how-demo">
          <div class="how-pair">
            <div class="how-pile tight">${dotsHtml(3, "seed")}</div>
            <div class="how-pile spread">${dotsHtml(3, "seed")}</div>
          </div>
          <div class="eq-btn how-correct glow">=${handSvg()}</div>
        </div>`,
    };
    return demos[kind] || "";
  }

  function setCue(kind) {
    els.cue.innerHTML = howHtml(kind);
  }

  function stageIconSvg(kind) {
    return howHtml(kind);
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

  /* 1 MORE — extreme contrast pairs */
  function renderMore() {
    const pairs = [
      [1, 5],
      [2, 5],
      [1, 4],
    ];
    const [lo, hi] = pairs[randInt(0, pairs.length - 1)];
    const leftMore = Math.random() < 0.5;
    const a = leftMore ? hi : lo;
    const b = leftMore ? lo : hi;

    els.prompt.textContent = "More";
    els.stage.innerHTML = `
      <div class="compare-row invite">
        <button type="button" class="pile-btn" data-side="L" aria-label="Left group">${dotsHtml(a, "seed")}</button>
        <div class="vs-mark" aria-hidden="true"><span class="vs-more"></span></div>
        <button type="button" class="pile-btn" data-side="R" aria-label="Right group">${dotsHtml(b, "seed")}</button>
      </div>`;

    const btns = $$(".pile-btn", els.stage);
    const correct = leftMore ? btns[0] : btns[1];
    guide(correct);

    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const ok = (btn.dataset.side === "L") === leftMore;
        judge(btn, ok);
      });
    });
  }

  /* SIZE — xl vs xs */
  function renderSize() {
    const leftBig = Math.random() < 0.5;
    els.prompt.textContent = "Bigger";
    els.stage.innerHTML = `
      <div class="compare-row invite size-row">
        <button type="button" class="size-btn" data-big="${leftBig}" aria-label="Left">
          <span class="size-dot ${leftBig ? "xl" : "xs"}"></span>
        </button>
        <div class="vs-mark" aria-hidden="true"><span class="vs-big"></span></div>
        <button type="button" class="size-btn" data-big="${!leftBig}" aria-label="Right">
          <span class="size-dot ${leftBig ? "xs" : "xl"}"></span>
        </button>
      </div>`;

    const btns = $$(".size-btn", els.stage);
    guide(btns.find((b) => b.dataset.big === "true"));

    btns.forEach((btn) => {
      btn.addEventListener("click", () => judge(btn, btn.dataset.big === "true"));
    });
  }

  /* SORT — 2 chips, one-tap auto-place into matching bin */
  function renderSort() {
    const cA = COLORS[0];
    const cB = COLORS[1];
    const items = shuffle([
      { id: 1, color: cA },
      { id: 2, color: cB },
    ]);
    const placed = {};

    els.prompt.textContent = "Sort";
    els.stage.innerHTML = `
      <div class="sort-layout">
        <div class="bins">
          <button type="button" class="bin-drop" data-bin="A" style="--c:${cA}" aria-label="Bin A"></button>
          <button type="button" class="bin-drop" data-bin="B" style="--c:${cB}" aria-label="Bin B"></button>
        </div>
        <div class="sort-pool invite" role="group"></div>
      </div>`;

    const pool = $(".sort-pool", els.stage);
    const binA = $(`.bin-drop[data-bin="A"]`, els.stage);
    const binB = $(`.bin-drop[data-bin="B"]`, els.stage);

    function guideNextChip() {
      clearGuides();
      const next = $$(".sort-chip", pool)[0];
      if (next) guide(next);
    }

    items.forEach((it) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sort-chip";
      chip.style.setProperty("--c", it.color);
      chip.dataset.color = it.color;
      chip.dataset.id = String(it.id);
      chip.addEventListener("click", () => {
        if (state.locked) return;
        const bin = chip.dataset.color === cA ? binA : binB;
        const ghost = document.createElement("span");
        ghost.className = "sort-chip in-bin";
        ghost.style.setProperty("--c", chip.dataset.color);
        bin.appendChild(ghost);
        placed[chip.dataset.id] = true;
        chip.remove();
        Sound.soft();
        if (Object.keys(placed).length === items.length) {
          clearGuides();
          state.locked = true;
          award(2);
          setFeedback("good");
          Sound.ok();
          setTimeout(nextRound, 700);
        } else {
          guideNextChip();
        }
      });
      pool.appendChild(chip);
    });

    guideNextChip();
  }

  /* FLASH — answer 1–3, 2 choices, 1400ms flash, guide after hide */
  function renderBurst() {
    const max = currentStage().max;
    const answer = randInt(1, max);
    const choices = uniqueChoices(answer, 2, max);
    const flashMs = 1400;
    const stageId = currentStage().id;

    els.prompt.textContent = "Watch";
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
      btn.dataset.n = String(n);
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
      const correct = $$(".num-key", pad).find((b) => Number(b.dataset.n) === answer);
      if (correct) guide(correct);
      state.locked = false;
    }, flashMs + 400);
  }

  /* PATTERN — circle-square-circle → square; 2 choices */
  function renderPattern() {
    const seq = ["circle", "square", "circle"];
    const answer = "square";
    const options = shuffle(["square", "triangle"]);

    els.prompt.textContent = "Next";
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
      btn.dataset.shape = s;
      btn.addEventListener("click", () => judge(btn, s === answer));
      box.appendChild(btn);
    });

    guide($$(".shape-btn", box).find((b) => b.dataset.shape === answer));
  }

  /* SHAPE — 2 choices */
  function renderShape() {
    const answer = SHAPES[randInt(0, SHAPES.length - 1)];
    const distractor = shuffle(SHAPES.filter((s) => s !== answer))[0];
    const options = shuffle([answer, distractor]);

    els.prompt.textContent = "Same shape";
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
      btn.dataset.shape = s;
      btn.addEventListener("click", () => judge(btn, s === answer));
      box.appendChild(btn);
    });

    guide($$(".shape-btn", box).find((b) => b.dataset.shape === answer));
  }

  /* MATCH — 2 choices */
  function renderMatch() {
    const max = currentStage().max;
    const mode = Math.random() < 0.5 ? "numToQty" : "qtyToNum";
    const answer = randInt(1, max);
    const options = uniqueChoices(answer, 2, max);

    if (mode === "numToQty") {
      els.prompt.textContent = `Find ${answer} dots`;
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
        btn.dataset.n = String(n);
        btn.innerHTML = `<span class="mini-dots">${"<i></i>".repeat(n)}</span>`;
        btn.addEventListener("click", () => judge(btn, n === answer));
        box.appendChild(btn);
      });
      guide($$(".stone", box).find((b) => Number(b.dataset.n) === answer));
    } else {
      els.prompt.textContent = "Which number?";
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
        btn.dataset.n = String(n);
        btn.addEventListener("click", () => judge(btn, n === answer));
        box.appendChild(btn);
      });
      guide($$(".stone", box).find((b) => Number(b.dataset.n) === answer));
    }
  }

  /* ORDER — always 1,2,3; guide next chip */
  function renderOrder() {
    const seq = [1, 2, 3];
    const pool = shuffle(seq);

    els.prompt.textContent = "Order";
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

    function guideNext() {
      clearGuides();
      const expect = seq[filled.length];
      const nextChip = $$(".slot-chip", poolEl).find((c) => Number(c.dataset.n) === expect);
      if (nextChip) guide(nextChip);
    }

    pool.forEach((n) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "slot-chip";
      chip.textContent = n;
      chip.dataset.n = String(n);
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
        clearGuides();
        chip.remove();
        filled.push(n);
        const slot = slotsEl.children[filled.length - 1];
        slot.classList.remove("next");
        slot.classList.add("filled");
        slot.textContent = n;
        if (filled.length < seq.length) {
          slotsEl.children[filled.length].classList.add("next");
          guideNext();
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

    guideNext();
  }

  /* FIND — 2 numbers; sayNumber; guide correct */
  function renderPond() {
    const max = currentStage().max;
    const answer = randInt(1, max);
    const fishNums = uniqueChoices(answer, 2, max);

    els.prompt.textContent = `Find ${answer}`;
    els.stage.innerHTML = `
      <div class="match-layout find-layout" style="width:100%">
        <button type="button" class="speak-btn speak-big pulse" id="hear-num" aria-label="Hear again">
          <span class="wave w1"></span><span class="wave w2"></span>
          <svg viewBox="0 0 24 24" width="36" height="36"><path fill="currentColor" d="M4 9v6h3l5 4V5L7 9H4zm11.5 3a3.5 3.5 0 0 0-1.5-2.9v5.8A3.5 3.5 0 0 0 15.5 12z"/></svg>
        </button>
        <div class="listen-then" aria-hidden="true"></div>
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
      f.dataset.n = String(n);
      f.addEventListener("click", () => judge(f, n === answer));
      pond.appendChild(f);
    });

    guide($$(".fish", pond).find((f) => Number(f.dataset.n) === answer));
  }

  /* JOIN — only [1,1][1,2][2,1][2,2]; 2 choices */
  function renderJoin() {
    const pairs = [
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ];
    const [left, right] = pairs[randInt(0, pairs.length - 1)];
    const answer = left + right;
    const max = Math.max(currentStage().max, answer);
    const choices = uniqueChoices(answer, 2, max);

    els.prompt.textContent = "Join";
    els.stage.innerHTML = `
      <div class="join-layout">
        <div class="join-sets merge-anim">
          <div class="pile-card left-in">${dotsHtml(left, "seed")}</div>
          <span class="plus" aria-hidden="true">+</span>
          <div class="pile-card right-in">${dotsHtml(right, "seed")}</div>
          <span class="plus join-to" aria-hidden="true">→</span>
          <div class="pile-card mystery pulse">?</div>
        </div>
        <div class="num-pad invite" role="group"></div>
      </div>`;

    const pad = $(".num-pad", els.stage);
    choices.forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num-key";
      btn.textContent = n;
      btn.dataset.n = String(n);
      btn.addEventListener("click", () => judge(btn, n === answer));
      pad.appendChild(btn);
    });

    guide($$(".num-key", pad).find((b) => Number(b.dataset.n) === answer));
  }

  /* COUNT — 2–3 dots; guide moves to next untapped */
  function renderCount() {
    const n = randInt(2, Math.min(currentStage().max, 3));
    let tapped = 0;

    els.prompt.textContent = "Count";
    els.stage.innerHTML = `
      <div class="count-layout">
        <div class="count-field invite" role="group" aria-label="Tap each"></div>
        <div class="count-total" id="count-total" aria-live="polite"></div>
      </div>`;

    const field = $(".count-field", els.stage);
    const total = $("#count-total", els.stage);

    function guideNext() {
      clearGuides();
      const next = $$(".count-dot:not(.on)", field)[0];
      if (next) guide(next);
    }

    for (let i = 0; i < n; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "count-dot";
      btn.setAttribute("aria-label", "item");
      btn.addEventListener("click", () => {
        if (state.locked || btn.classList.contains("on")) return;
        clearGuides();
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
          setTimeout(nextRound, 900);
        } else {
          guideNext();
        }
      });
      field.appendChild(btn);
    }

    guideNext();
  }

  /* TAKE — start 3 or 4; clear remove; 2 choices */
  function renderTake() {
    const start = Math.random() < 0.5 ? 3 : 4;
    const remove = start === 3 ? 1 : randInt(1, 2);
    const answer = start - remove;
    const max = currentStage().max;
    const choices = uniqueChoices(answer, 2, max);

    els.prompt.textContent = "Take";
    els.stage.innerHTML = `
      <div class="join-layout">
        <div class="take-board" aria-label="Objects">
          ${Array.from({ length: start }, (_, i) =>
            `<span class="seed take-seed" data-i="${i}"></span>`
          ).join("")}
        </div>
        <div class="num-pad invite" role="group"></div>
      </div>`;

    const seeds = $$(".take-seed", els.stage);
    const pad = $(".num-pad", els.stage);

    choices.forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num-key";
      btn.textContent = n;
      btn.dataset.n = String(n);
      btn.disabled = true;
      btn.addEventListener("click", () => judge(btn, n === answer));
      pad.appendChild(btn);
    });

    state.locked = true;
    setTimeout(() => {
      seeds.forEach((s, i) => {
        if (i >= answer) s.classList.add("gone");
      });
      $$(".num-key", pad).forEach((b) => {
        b.disabled = false;
      });
      guide($$(".num-key", pad).find((b) => Number(b.dataset.n) === answer));
      state.locked = false;
    }, 700);
  }

  /* SAME — always equal; only = is correct */
  function renderSame() {
    const n = randInt(2, 4);
    const left = n;
    const right = n;

    els.prompt.textContent = "Same?";
    els.stage.innerHTML = `
      <div class="same-layout">
        <div class="compare-row">
          <button type="button" class="pile-btn tight-pack" data-pick="L" aria-label="Left">${dotsHtml(left, "seed")}</button>
          <button type="button" class="pile-btn spread-pack" data-pick="R" aria-label="Right">${dotsHtml(right, "seed")}</button>
        </div>
        <button type="button" class="eq-btn pulse glow" data-pick="eq" aria-label="Same">=</button>
      </div>`;

    const rightPile = $(".spread-pack", els.stage);
    rightPile.classList.add("was-tight");
    setTimeout(() => rightPile.classList.remove("was-tight"), 600);

    const eqBtn = $(".eq-btn", els.stage);
    guide(eqBtn);

    $$("[data-pick]", els.stage).forEach((btn) => {
      btn.addEventListener("click", () => judge(btn, btn.dataset.pick === "eq"));
    });
  }

  function judge(el, ok) {
    if (state.locked) return;
    state.locked = true;
    if (ok) {
      clearGuides();
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
