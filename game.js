(() => {
  const STAGES = [
    {
      id: "match",
      name: "Match",
      blurb: "Connect each numeral with its quantity.",
      rounds: 4,
      max: 5,
    },
    {
      id: "order",
      name: "Order",
      blurb: "Place the numbers from smallest to largest.",
      rounds: 3,
      max: 5,
    },
    {
      id: "pond",
      name: "Find",
      blurb: "Listen, then select the number you hear.",
      rounds: 4,
      max: 5,
    },
    {
      id: "burst",
      name: "Flash",
      blurb: "A set appears briefly. Remember how many.",
      rounds: 3,
      max: 5,
    },
  ];

  const TOTAL_ROUNDS = STAGES.reduce((n, s) => n + s.rounds, 0);

  const state = {
    stars: Number(localStorage.getItem("cg_stars") || 0),
    screen: "home",
    stageIndex: 0,
    roundInStage: 0,
    roundsDone: 0,
    correct: 0,
    locked: false,
    pendingAdvance: null,
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
    stage: $("#game-stage"),
    feedback: $("#feedback"),
    bar: $("#progress-bar"),
    how: $("#how-dialog"),
    introKicker: $("#intro-kicker"),
    introTitle: $("#intro-title"),
    introMsg: $("#intro-msg"),
    doneTitle: $("#done-title"),
    doneMsg: $("#done-msg"),
    doneScore: $("#done-score"),
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
    while (set.size < count) set.add(randInt(1, max));
    return shuffle([...set]);
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = 0.9;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  /* Calm procedural tones — soft sine, low gain */
  const Sound = (() => {
    let ctx = null;
    let master = null;
    let enabled = localStorage.getItem("cg_sound") !== "0";

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.18;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone(freq, when, dur, type = "sine", gain = 0.22) {
      const c = ensure();
      if (!c || !enabled) return;
      const t0 = c.currentTime + when;
      const osc = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      f.type = "lowpass";
      f.frequency.setValueAtTime(1400, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(f);
      f.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    return {
      unlock() {
        ensure();
      },
      setEnabled(on) {
        enabled = on;
        localStorage.setItem("cg_sound", on ? "1" : "0");
      },
      isEnabled() {
        return enabled;
      },
      ok() {
        // soft major third
        tone(392, 0, 0.28, "sine", 0.16);
        tone(493.88, 0.08, 0.38, "sine", 0.14);
      },
      soft() {
        tone(440, 0, 0.16, "sine", 0.1);
      },
      no() {
        // calm low note — not a buzz
        tone(196, 0, 0.32, "sine", 0.12);
        tone(185, 0.05, 0.28, "triangle", 0.05);
      },
      stage() {
        tone(329.63, 0, 0.3, "sine", 0.12);
        tone(415.3, 0.14, 0.36, "sine", 0.11);
        tone(523.25, 0.28, 0.45, "sine", 0.1);
      },
      done() {
        tone(349.23, 0, 0.35, "sine", 0.12);
        tone(440, 0.18, 0.4, "sine", 0.11);
        tone(523.25, 0.36, 0.55, "sine", 0.1);
        tone(659.25, 0.52, 0.7, "sine", 0.08);
      },
    };
  })();

  function setFeedback(msg, kind) {
    els.feedback.textContent = msg;
    els.feedback.className = `feedback ${kind || ""}`;
  }

  function updateProgress() {
    els.bar.style.width = `${(state.roundsDone / TOTAL_ROUNDS) * 100}%`;
  }

  function award(n = 1) {
    state.stars += n;
    state.correct += 1;
    saveStars();
  }

  function updateChrome() {
    const s = currentStage();
    els.title.textContent = `Stage ${state.stageIndex + 1} of ${STAGES.length}`;
    els.stageSub.textContent = s.name;
    saveStars();
    updateProgress();
  }

  function startAdventure() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    Sound.unlock();
    state.stageIndex = 0;
    state.roundInStage = 0;
    state.roundsDone = 0;
    state.correct = 0;
    state.locked = false;
    showStageIntro();
  }

  function showStageIntro() {
    const s = currentStage();
    els.introKicker.textContent = `Stage ${state.stageIndex + 1} of ${STAGES.length}`;
    els.introTitle.textContent = s.name;
    els.introMsg.textContent = s.blurb;
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
    const pct = state.correct / TOTAL_ROUNDS;
    els.doneTitle.textContent = pct === 1 ? "Exact" : "Complete";
    els.doneMsg.textContent = `${state.correct} of ${TOTAL_ROUNDS} correct.`;
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

    const runners = {
      match: renderMatch,
      order: renderOrder,
      pond: renderPond,
      burst: renderBurst,
    };
    runners[s.id]();
  }

  /* ---------- MATCH ---------- */
  function renderMatch() {
    const max = currentStage().max;
    const mode = Math.random() < 0.5 ? "numToQty" : "qtyToNum";
    const answer = randInt(1, max);
    const options = uniqueChoices(answer, 3, max);

    if (mode === "numToQty") {
      els.prompt.textContent = `Find ${answer} dots`;
      els.stage.innerHTML = `
        <div class="match-layout">
          <div class="big-num" aria-hidden="true">${answer}</div>
          <div class="stones" role="group" aria-label="Choose quantity"></div>
        </div>`;
      const box = $(".stones", els.stage);
      options.forEach((n) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stone qty";
        btn.setAttribute("aria-label", `${n} dots`);
        btn.innerHTML = `<span class="mini-dots">${"<i></i>".repeat(n)}</span>`;
        btn.addEventListener("click", () => judge(btn, n === answer));
        box.appendChild(btn);
      });
    } else {
      els.prompt.textContent = "Which number matches?";
      els.stage.innerHTML = `
        <div class="match-layout">
          <div class="dots-board" aria-label="${answer} dots">${'<span class="dot"></span>'.repeat(answer)}</div>
          <div class="stones" role="group" aria-label="Choose number"></div>
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

  /* ---------- ORDER ---------- */
  function renderOrder() {
    const max = currentStage().max;
    const len = 4;
    const start = randInt(1, max - len + 1);
    const seq = Array.from({ length: len }, (_, i) => start + i);
    const pool = shuffle(seq);

    els.prompt.textContent = "Place in order";
    els.stage.innerHTML = `
      <div class="order-layout">
        <div class="slots" aria-label="Number path"></div>
        <div class="pool" role="group" aria-label="Numbers to place"></div>
      </div>`;

    const slotsEl = $(".slots", els.stage);
    const poolEl = $(".pool", els.stage);
    const filled = [];

    seq.forEach((_, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.textContent = i === 0 ? "start" : "";
      slotsEl.appendChild(slot);
    });

    pool.forEach((n) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "slot-chip";
      chip.textContent = n;
      chip.addEventListener("click", () => {
        if (state.locked) return;
        const expect = seq[filled.length];
        if (n !== expect) {
          chip.classList.add("wrong");
          setFeedback("Not yet", "bad");
          Sound.no();
          setTimeout(() => chip.classList.remove("wrong"), 350);
          return;
        }
        chip.remove();
        filled.push(n);
        const slot = slotsEl.children[filled.length - 1];
        slot.classList.add("filled");
        slot.textContent = n;
        setFeedback("Yes", "good");
        if (filled.length === seq.length) {
          state.locked = true;
          award(2);
          setFeedback("Complete", "good");
          Sound.ok();
          setTimeout(nextRound, 700);
        } else {
          Sound.soft();
        }
      });
      poolEl.appendChild(chip);
    });
  }

  /* ---------- CATCH ---------- */
  function renderPond() {
    const max = currentStage().max;
    const answer = randInt(1, max);
    const fishNums = uniqueChoices(answer, Math.min(5, max), max);

    els.prompt.textContent = `Find ${answer}`;
    els.stage.innerHTML = `
      <div class="match-layout" style="width:100%">
        <button type="button" class="speak-btn" id="hear-num">Hear again</button>
        <div class="pond" role="group" aria-label="Numbers"></div>
      </div>`;

    speak(answer);
    $("#hear-num", els.stage).addEventListener("click", () => speak(answer));

    const pond = $(".pond", els.stage);
    fishNums.forEach((n) => {
      const f = document.createElement("button");
      f.type = "button";
      f.className = "fish";
      f.textContent = n;
      f.setAttribute("aria-label", `Number ${n}`);
      f.addEventListener("click", () => judge(f, n === answer));
      pond.appendChild(f);
    });
  }

  /* ---------- FLASH ---------- */
  function renderBurst() {
    const max = Math.min(currentStage().max, 5);
    const answer = randInt(1, max);
    const choices = uniqueChoices(answer, 4, max);
    const flashMs = answer <= 3 ? 700 : 1100;
    const stageId = currentStage().id;

    els.prompt.textContent = "Watch";
    els.stage.innerHTML = `
      <div class="burst-layout">
        <div class="seed-field is-flashing" aria-label="Dots about to flash"></div>
        <p class="flash-hint" id="flash-hint"></p>
        <div class="num-pad is-disabled" role="group" aria-label="Choose count" hidden></div>
      </div>`;

    const field = $(".seed-field", els.stage);
    const hint = $("#flash-hint", els.stage);
    const pad = $(".num-pad", els.stage);

    for (let i = 0; i < answer; i++) {
      const seed = document.createElement("span");
      seed.className = "seed";
      seed.style.animationDelay = `${i * 0.03}s`;
      field.appendChild(seed);
    }

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
      hint.textContent = "";
      field.classList.add("is-hidden");
      field.setAttribute("aria-hidden", "true");
      pad.hidden = false;
      pad.classList.remove("is-disabled");
      $$(".num-key", pad).forEach((b) => {
        b.disabled = false;
      });
      els.prompt.textContent = "How many?";
      state.locked = false;
    }, flashMs + 280);
  }

  function judge(el, ok) {
    if (state.locked) return;
    state.locked = true;
    if (ok) {
      el.classList.add("correct");
      award(1);
      setFeedback(pickPraise(), "good");
      Sound.ok();
      setTimeout(nextRound, 650);
    } else {
      el.classList.add("wrong");
      setFeedback("Try again", "bad");
      Sound.no();
      setTimeout(() => {
        el.classList.remove("wrong");
        state.locked = false;
      }, 400);
    }
  }

  function pickPraise() {
    return shuffle(["Yes", "Good", "Right"])[0];
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
    Sound.unlock();
    beginStagePlay();
  });
  $("#btn-how").addEventListener("click", () => els.how.showModal());
  $("#btn-again").addEventListener("click", startAdventure);

  const soundBtn = $("#btn-sound");
  function syncSoundBtn() {
    const on = Sound.isEnabled();
    soundBtn.textContent = on ? "Sound on" : "Sound off";
    soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  soundBtn.addEventListener("click", () => {
    Sound.unlock();
    Sound.setEnabled(!Sound.isEnabled());
    syncSoundBtn();
    if (Sound.isEnabled()) Sound.soft();
  });
  syncSoundBtn();

  saveStars();
  showScreen("home");
})();
