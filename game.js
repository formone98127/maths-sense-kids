(() => {
  const ROUNDS = 8;
  const state = {
    stars: Number(localStorage.getItem("cg_stars") || 0),
    screen: "home",
    game: null,
    round: 0,
    correct: 0,
    max: 10,
    locked: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const screens = {
    home: $("#screen-home"),
    hub: $("#screen-hub"),
    game: $("#screen-game"),
    done: $("#screen-done"),
  };

  const els = {
    hubStars: $("#hub-stars"),
    gameStars: $("#game-stars"),
    title: $("#game-title"),
    prompt: $("#game-prompt"),
    stage: $("#game-stage"),
    feedback: $("#feedback"),
    bar: $("#progress-bar"),
    level: $("#level"),
    how: $("#how-dialog"),
    doneTitle: $("#done-title"),
    doneMsg: $("#done-msg"),
    doneScore: $("#done-score"),
  };

  const titles = {
    match: "Match Dots",
    order: "Order Path",
    pond: "Pond Catch",
    burst: "Flash Count",
  };

  function saveStars() {
    localStorage.setItem("cg_stars", String(state.stars));
    els.hubStars.textContent = `★ ${state.stars}`;
    els.gameStars.textContent = `★ ${state.stars}`;
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
    els.bar.style.width = `${(state.round / ROUNDS) * 100}%`;
  }

  function award(n = 1) {
    state.stars += n;
    state.correct += 1;
    saveStars();
  }

  function endRound() {
    const pct = state.correct / ROUNDS;
    els.doneTitle.textContent =
      pct === 1 ? "Perfect patch!" : pct >= 0.6 ? "Growing strong!" : "Nice try, gardener!";
    els.doneMsg.textContent = `You got ${state.correct} of ${ROUNDS} right this round.`;
    els.doneScore.textContent = `★ ${state.stars}`;
    showScreen("done");
  }

  function nextRound() {
    state.round += 1;
    updateProgress();
    if (state.round > ROUNDS) {
      endRound();
      return;
    }
    state.locked = false;
    setFeedback("");
    const runners = {
      match: renderMatch,
      order: renderOrder,
      pond: renderPond,
      burst: renderBurst,
    };
    runners[state.game]();
  }

  function startGame(name) {
    state.game = name;
    state.round = 0;
    state.correct = 0;
    state.max = Number(els.level.value);
    els.title.textContent = titles[name];
    showScreen("game");
    nextRound();
  }

  /* ---------- MATCH DOTS ---------- */
  function renderMatch() {
    const mode = Math.random() < 0.5 ? "numToQty" : "qtyToNum";
    const answer = randInt(1, Math.min(state.max, 10));
    const distractors = uniqueChoices(answer, 3, Math.min(state.max, 10)).filter((n) => n !== answer);
    const options = shuffle([answer, ...distractors.slice(0, 2)]);

    if (mode === "numToQty") {
      els.prompt.textContent = `Find the stone with ${answer} dots`;
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
      els.prompt.textContent = "Which number matches the dots?";
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

  /* ---------- ORDER PATH ---------- */
  function renderOrder() {
    const len = state.max <= 5 ? 4 : state.max <= 10 ? 5 : 6;
    const start = randInt(1, Math.max(1, Math.min(state.max, 20) - len + 1));
    const seq = Array.from({ length: len }, (_, i) => start + i);
    const pool = shuffle(seq);

    els.prompt.textContent = "Tap the numbers in order";
    els.stage.innerHTML = `
      <div class="order-layout">
        <div class="slots" aria-label="Number path"></div>
        <div class="pool" role="group" aria-label="Numbers to place"></div>
      </div>`;

    const slotsEl = $(".slots", els.stage);
    const poolEl = $(".pool", els.stage);
    const filled = [];

    seq.forEach((_, i) => {
      const s = document.createElement("div");
      s.className = "slot";
      s.textContent = i + 1 === 1 ? "start" : "";
      s.dataset.index = String(i);
      slotsEl.appendChild(s);
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
          setFeedback("Almost — try the next number", "bad");
          setTimeout(() => chip.classList.remove("wrong"), 350);
          return;
        }
        chip.remove();
        filled.push(n);
        const slot = slotsEl.children[filled.length - 1];
        slot.classList.add("filled");
        slot.textContent = n;
        setFeedback("Yes!", "good");
        if (filled.length === seq.length) {
          state.locked = true;
          award(2);
          setFeedback("Path complete!", "good");
          setTimeout(nextRound, 700);
        }
      });
      poolEl.appendChild(chip);
    });
  }

  /* ---------- POND CATCH ---------- */
  function renderPond() {
    const answer = randInt(1, state.max);
    const fishNums = uniqueChoices(answer, Math.min(6, Math.max(4, Math.min(state.max, 6))), state.max);

    els.prompt.textContent = `Catch number ${answer}`;
    els.stage.innerHTML = `
      <div class="match-layout" style="width:100%">
        <button type="button" class="speak-btn" id="hear-num">Hear it again</button>
        <div class="pond" role="group" aria-label="Fish pond"></div>
      </div>`;

    speak(answer);
    $("#hear-num", els.stage).addEventListener("click", () => speak(answer));

    const pond = $(".pond", els.stage);
    fishNums.forEach((n, i) => {
      const f = document.createElement("button");
      f.type = "button";
      f.className = "fish";
      f.textContent = n;
      f.style.animationDelay = `${-i * 0.35}s`;
      f.setAttribute("aria-label", `Fish ${n}`);
      f.addEventListener("click", () => judge(f, n === answer));
      pond.appendChild(f);
    });
  }

  /* ---------- FLASH COUNT (subitise) ---------- */
  function renderBurst() {
    // Cap low so flash stays fair — this is subitising, not slow counting
    const answer = randInt(1, Math.min(state.max, 6));
    const choices = uniqueChoices(answer, 4, Math.min(Math.max(state.max, 6), 8));
    // Shorter flash for small sets, a beat longer for 5–6
    const flashMs = answer <= 3 ? 700 : 1100;

    els.prompt.textContent = "Watch the seeds…";
    els.stage.innerHTML = `
      <div class="burst-layout">
        <div class="seed-field is-flashing" aria-label="Seeds about to flash"></div>
        <p class="flash-hint" id="flash-hint">Get ready</p>
        <div class="num-pad is-disabled" role="group" aria-label="Choose count" hidden></div>
      </div>`;

    const field = $(".seed-field", els.stage);
    const hint = $("#flash-hint", els.stage);
    const pad = $(".num-pad", els.stage);

    for (let i = 0; i < answer; i++) {
      const s = document.createElement("span");
      s.className = "seed";
      s.style.animationDelay = `${i * 0.03}s`;
      field.appendChild(s);
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

    // Brief ready beat → show → hide → answer
    state.locked = true;
    setTimeout(() => {
      if (state.game !== "burst") return;
      hint.textContent = "How many were there?";
      field.classList.add("is-hidden");
      field.setAttribute("aria-hidden", "true");
      pad.hidden = false;
      pad.classList.remove("is-disabled");
      $$(".num-key", pad).forEach((b) => {
        b.disabled = false;
      });
      els.prompt.textContent = "How many seeds flashed?";
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
      setFeedback("Try again!", "bad");
      setTimeout(() => {
        el.classList.remove("wrong");
        state.locked = false;
      }, 400);
    }
  }

  function pickPraise() {
    return shuffle(["Great!", "Yes!", "Nice!", "Super!", "You got it!"])[0];
  }

  /* ---------- WIRING ---------- */
  document.body.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) {
      const dest = go.dataset.go;
      if (dest === "hub" || dest === "home") {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        showScreen(dest);
      }
      return;
    }
    const tile = e.target.closest("[data-game]");
    if (tile) startGame(tile.dataset.game);
  });

  $("#btn-how").addEventListener("click", () => els.how.showModal());
  $("#btn-again").addEventListener("click", () => startGame(state.game));
  els.level.addEventListener("change", () => {
    state.max = Number(els.level.value);
  });

  saveStars();
  showScreen("home");
})();
