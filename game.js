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
    u.rate = 0.92;
    u.pitch = 1.15;
    window.speechSynthesis.speak(u);
  }

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
          setTimeout(nextRound, 700);
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
      setTimeout(nextRound, 650);
    } else {
      el.classList.add("wrong");
      setFeedback("Try again", "bad");
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
  $("#btn-intro-go").addEventListener("click", beginStagePlay);
  $("#btn-how").addEventListener("click", () => els.how.showModal());
  $("#btn-again").addEventListener("click", startAdventure);

  saveStars();
  showScreen("home");
})();
