/* 《渡》主邏輯 —— 一天一局；靜坐片刻可加開；無數字；後果隔日揭曉 */
"use strict";

const SAVE_KEY = "du_ferry_save_v1";

/* ---------- 存檔 ---------- */
function defaultState() {
  return {
    firstDay: todayStr(),
    lastSeenDate: null,
    lastRoundDate: null,   // 今日主局是否已完成
    totalRounds: 0,
    calmCount: 0,
    seeds: [],             // {sid, choice, date} 或 {type:"guest", gid, qid, date}
    quotes: [],            // 已拾得金句 id
    letters: [],           // {text, date, read}
    usedScenarios: [],
    usedGuests: [],
    usedChains: [],
    chain: null,           // 三日連環 {id, stage, calmHits, lastDate}
    nightSeed: null,       // 夜渡 {text, date}
    carryQuote: null,      // 今日隨身句 quote id
    history: [],           // 長卷 {d, c:"calm"|"rush"|null, q:bool}
    flags: {}
  };
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return Object.assign(defaultState(), JSON.parse(raw));   // 舊檔補新欄位
  } catch (e) { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}
let S = load() || defaultState();

/* ---------- 日期 ---------- */
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function dateLabel() {
  const d = new Date();
  return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const overlay = $("overlay");
const fog = $("fog");
const dusk = $("dusk");
const idleBar = $("idleBar");

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* 顯示一張卡，回傳被按下的按鈕 id */
function showCard(html, buttons) {
  return new Promise((resolve) => {
    overlay.classList.remove("hidden");
    const acts = buttons.map((b) =>
      b.div
        ? `<div class="between">${b.html}</div>`
        : `<button class="btn ${b.cls || "center"}" data-k="${b.k}">${b.html || esc(b.label)}</button>`
    ).join("");
    overlay.innerHTML = `<div class="card">${html}${acts ? `<div class="acts">${acts}</div>` : ""}</div>`;
    overlay.querySelectorAll("[data-k]").forEach((el) => {
      el.addEventListener("click", () => resolve(el.dataset.k), { once: true });
    });
  });
}
function hideCard() {
  overlay.classList.add("hidden");
  overlay.innerHTML = "";
}
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------- 世界樣貌 ---------- */
function renderWorld() {
  for (const m of MILESTONES) {
    const el = $("g-" + m.flag);
    if (el && S.flags[m.flag]) el.classList.add("shown");
  }
  if (S.flags.lantern) {
    $("lampGlow").style.opacity = "0.22";
    $("lampBox").setAttribute("fill", "#b6512f");
  }
}

/* 平靜的選擇累積 → 渡口自己變好（不顯示任何數字） */
function checkMilestones() {
  const notes = [];
  for (const m of MILESTONES) {
    if (S.calmCount >= m.at && !S.flags[m.flag]) {
      S.flags[m.flag] = true;
      notes.push(m.note);
    }
  }
  return notes;
}

/* ---------- 隨機 ---------- */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function pickScenario() {
  let pool = SCENARIOS.filter((s) => !S.usedScenarios.includes(s.id));
  if (pool.length === 0) { S.usedScenarios = []; pool = SCENARIOS.slice(); }
  return pick(pool);
}

/* ---------- 天色與天氣（畫面不單調的底：每天一象，每時一色） ---------- */
function applySky() {
  const h = new Date().getHours();
  document.body.dataset.tod =
    h >= 5 && h < 8 ? "dawn" :
    h >= 8 && h < 16 ? "day" :
    h >= 16 && h < 19 ? "dusk" : "night";
  const r = hashStr(todayStr() + "weather") % 100;
  document.body.dataset.weather =
    r < 45 ? "sun" : r < 70 ? "cloud" : r < 90 ? "rain" : "mist";
}

function dailyChores() {
  // 以日期為種子，讓同一天看到同三件事
  let seed = hashStr(todayStr());
  const pool = CHORES.filter((c) => !c.needs || S.flags[c.needs]);
  const out = [];
  const used = new Set();
  while (out.length < 3 && used.size < pool.length) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const idx = seed % pool.length;
    if (!used.has(idx)) { used.add(idx); out.push(pool[idx]); }
  }
  return out;
}

/* ---------- 局流程 ---------- */
async function runRound(kind) {
  idleBar.classList.add("hidden");
  hideCard();
  dusk.classList.remove("on");

  // 一、霧散（什麼都不用按，平靜自己回來）
  fog.classList.add("on");
  fog.classList.remove("lifting");
  await wait(600);
  fog.classList.add("lifting");
  await wait(kind === "main" ? 5200 : 2600);
  fog.classList.remove("on", "lifting");

  const today = todayStr();

  if (kind === "main") {
    // 二、缺席歸來（留白，不是罪）
    if (S.absenceGift) {
      const letter = pick(LETTERS);
      S.letters.push({ text: letter, date: today, read: false });
      S.absenceGift = false;
      save();
      await showCard(
        `<h2>你回來了</h2><p>這些日子，河自己流著，渡口自己靜著。\n棚下有人留了信。</p>`,
        [{ k: "ok", label: "看看渡口" }]
      );
      hideCard();
      await wait(400);
    }

    // 三、昨日種下的因——揭曉
    const due = S.seeds.filter((sd) => sd.date < today);
    S.seeds = S.seeds.filter((sd) => sd.date >= today);
    for (const sd of due) {
      if (sd.type === "guest") {
        // 旅人捎來回音
        const g = GUESTS.find((x) => x.id === sd.gid);
        const q = QUOTES.find((x) => x.id === sd.qid);
        if (!g || !q) continue;
        const letter = g.thanks.replace("{q}", q.text);
        S.letters.push({ text: letter, date: today, read: false });
        await showCard(
          `<h2>旅人捎來回音</h2><p>${esc(letter)}</p><p class="muted" style="margin-top:10px">信已收進信匣。</p>`,
          [{ k: "ok", label: "好" }]
        );
        hideCard();
        await wait(300);
        continue;
      }
      const sc = SCENARIOS.find((s) => s.id === sd.sid);
      if (!sc) continue;
      let text;
      if (sd.choice === "calm") {
        text = Math.random() < 0.6 ? sc.calmWin : sc.calmOpen;
      } else {
        text = Math.random() < 0.6 ? sc.rushMess : sc.rushLuck;
      }
      await showCard(
        `<h2>前日的事，有了下文</h2><p class="muted">${esc(sc.title)}</p><p>${esc(text)}</p>`,
        [{ k: "ok", label: "知道了" }]
      );
      hideCard();
      await wait(300);
    }

    // 三之二、連環的尾聲（第三日：看兩日裡靜了幾回）
    if (S.chain && S.chain.stage === 2 && S.chain.lastDate < today) {
      const ch = CHAINS.find((c) => c.id === S.chain.id);
      if (ch) {
        const end = ch.endings["calm" + S.chain.calmHits] || ch.endings.calm1;
        await showCard(
          `<h2>${esc(ch.title)}・尾聲</h2><p>${esc(end)}</p>`,
          [{ k: "ok", label: "知道了" }]
        );
        hideCard();
        await wait(300);
      }
      S.usedChains.push(S.chain.id);
      S.chain = null;
    }

    // 三之三、夜渡——昨夜自己種下的事，只輕輕問一句
    if (S.nightSeed && S.nightSeed.date < today) {
      const k = await showCard(
        `<h2>${NIGHT_ASK}</h2><p>「${esc(S.nightSeed.text)}」</p><p class="muted" style="margin-top:12px">${NIGHT_Q}</p>`,
        [
          { k: "rush", cls: "voice rush", html: `<span class="who">急</span>它還在心裡滾。` },
          { k: "calm", cls: "voice calm", html: `<span class="who">靜</span>它靜下來了。` }
        ]
      );
      hideCard();
      await wait(300);
      await showCard(`<p>${esc(NIGHT_RESP[k])}</p>`, [{ k: "ok", label: "嗯" }]);
      hideCard();
      await wait(300);
      S.nightSeed = null;
    }
    save();

    // 四、今日事（做好當下）
    await choresPhase();
  }

  // 五、亂流（主局：連環第二日＞新連環＞旅人問渡＞尋常亂流；靜坐加開的一局是尋常亂流）
  let quoteDrop = null;
  let notes = [];
  let dayChoice = null;   // 記進長卷
  let handled = false;

  // 連環・第二日
  if (kind === "main" && S.chain && S.chain.stage === 1 && S.chain.lastDate < today) {
    const ch = CHAINS.find((c) => c.id === S.chain.id);
    if (ch) {
      const choice = await voiceCard(ch.title + "・第二日", ch.d2.text, ch.d2.rush, ch.d2.calm);
      S.chain.stage = 2;
      S.chain.lastDate = today;
      dayChoice = choice;
      if (choice === "calm") { S.chain.calmHits++; S.calmCount++; notes = checkMilestones(); quoteDrop = maybeQuote(); }
      save();
      await wait(350);
      await showCard(
        `<p class="muted">你照著${choice === "calm" ? "靜" : "急"}的聲音，做了。</p><p>這件事還沒完——尾聲，明日再看。</p>`,
        [{ k: "ok", label: "好" }]
      );
      hideCard();
      handled = true;
    } else { S.chain = null; }
  }

  // 連環・第一日（新的三日連環悄悄開場）
  if (!handled && kind === "main" && !S.chain && Math.random() < 0.18) {
    const rest = CHAINS.filter((c) => !S.usedChains.includes(c.id));
    if (rest.length) {
      const ch = pick(rest);
      const choice = await voiceCard(ch.title, ch.d1.text, ch.d1.rush, ch.d1.calm);
      S.chain = { id: ch.id, stage: 1, calmHits: choice === "calm" ? 1 : 0, lastDate: today };
      dayChoice = choice;
      if (choice === "calm") { S.calmCount++; notes = checkMilestones(); quoteDrop = maybeQuote(); }
      save();
      await wait(350);
      await showCard(
        `<p class="muted">你照著${choice === "calm" ? "靜" : "急"}的聲音，做了。</p><p>水還在流——這件事，明日還有下文。</p>`,
        [{ k: "ok", label: "好" }]
      );
      hideCard();
      handled = true;
    }
  }

  // 旅人問渡（角色反轉：拾得三句以上才會遇到）
  if (!handled && kind === "main" && S.quotes.length >= 3 && Math.random() < 0.25) {
    const rest = GUESTS.filter((g) => !S.usedGuests.includes(g.id));
    if (rest.length) {
      const g = pick(rest);
      S.usedGuests.push(g.id);
      const owned = QUOTES.filter((q) => S.quotes.includes(q.id));
      const opts = [];
      const cp = owned.slice();
      while (opts.length < 3 && cp.length) opts.push(cp.splice(Math.floor(Math.random() * cp.length), 1)[0]);
      const chosen = await showCard(
        `<h2>旅人問渡・${esc(g.who)}</h2><p>${esc(g.text)}</p><p class="muted" style="margin-top:10px">這回，換你當那個靜的聲音。送他字帖裡的哪一句？</p>`,
        opts.map((q) => ({ k: q.id, cls: "voice calm", html: esc(q.text) }))
      );
      hideCard();
      S.seeds.push({ type: "guest", gid: g.id, qid: chosen, date: today });
      save();
      await wait(350);
      await showCard(
        `<p class="muted">他把那句話收進袖裡，上了船。</p><p>後來如何——等他捎信來。</p>`,
        [{ k: "ok", label: "好" }]
      );
      hideCard();
      handled = true;
    }
  }

  // 尋常亂流
  if (!handled && (kind === "extra" || S.totalRounds === 0 || Math.random() < 0.75)) {
    const sc = pickScenario();
    S.usedScenarios.push(sc.id);
    const choice = await voiceCard(sc.title, sc.text, sc.rush, sc.calm);
    S.seeds.push({ sid: sc.id, choice, date: today });
    dayChoice = choice;
    if (choice === "calm") { S.calmCount++; notes = checkMilestones(); quoteDrop = maybeQuote(); }
    save();
    await wait(350);
    await showCard(
      `<p class="muted">你照著${choice === "calm" ? "靜" : "急"}的聲音，做了。</p><p>結果如何——明日再看。</p>`,
      [{ k: "ok", label: "好" }]
    );
    hideCard();
  }

  // 六、拾得金句
  if (quoteDrop) {
    await wait(300);
    await showCard(
      `<h2>拾得一句</h2><p class="quote-text">${esc(quoteDrop.text)}</p>` +
      `<p class="quote-src">${quoteDrop.src === "補" ? "（補）" : "——《順流成真》"}</p>`,
      [{ k: "ok", label: "收進字帖" }]
    );
    hideCard();
  }

  // 七、渡口的變化
  for (const n of notes) {
    renderWorld();
    await wait(400);
    await showCard(`<p>${esc(n)}</p>`, [{ k: "ok", label: "嗯" }]);
    hideCard();
  }

  // 八、吹燈收尾（可種一件自己的事進夜裡——夜渡）
  await wait(300);
  const closer = pick(CLOSERS);
  await new Promise((resolve) => {
    overlay.classList.remove("hidden");
    overlay.innerHTML =
      `<div class="card"><h2>今日已種下</h2><p class="muted">明日再看。</p>` +
      (closer ? `<p style="margin-top:14px">${esc(closer)}</p><p class="muted" style="margin-top:6px">不用回答。放著就好。</p>` : "") +
      `<textarea id="nightBox" class="night-input" rows="2" maxlength="60"
        placeholder="今天現實裡，有件事卡著嗎？寫一句，種進夜裡（可不寫）"></textarea>` +
      `<div class="acts"><button class="btn center" id="lampOut">吹燈</button></div></div>`;
    $("lampOut").addEventListener("click", () => {
      const v = $("nightBox").value.trim();
      if (v) S.nightSeed = { text: v.slice(0, 60), date: today };
      resolve();
    }, { once: true });
  });
  hideCard();

  S.totalRounds++;
  if (kind === "main") S.lastRoundDate = today;
  S.history.push({ d: today, c: dayChoice, q: !!quoteDrop });
  if (S.history.length > 400) S.history = S.history.slice(-400);
  save();

  dusk.classList.add("on");
  await wait(2600);
  dusk.classList.remove("on");
  enterIdle();
}

/* 亂流卡：急上、靜下，中間一句主公親擬的橋 */
async function voiceCard(title, text, rushLine, calmLine) {
  const btns = [
    { k: "rush", cls: "voice rush", html: `<span class="who">急的聲音</span>${esc(rushLine)}` },
    { div: true, html: "別急，只看事實要怎麼處理。" },
    { k: "calm", cls: "voice calm", html: `<span class="who">靜的聲音</span>${esc(calmLine)}` }
  ];
  const choice = await showCard(
    `<h2>${esc(title)}</h2><p>${esc(text)}</p><p class="muted" style="margin-top:10px">心裡響起兩個聲音——</p>`,
    btns
  );
  hideCard();
  return choice;
}

/* 金句：稀有掉落，做對了才拾得 */
function maybeQuote() {
  if (Math.random() >= 0.4) return null;
  const owned = new Set(S.quotes);
  const rest = QUOTES.filter((q) => !owned.has(q.id));
  if (!rest.length) return null;
  const q = pick(rest);
  S.quotes.push(q.id);
  return q;
}

/* 今日事 */
async function choresPhase() {
  const chores = dailyChores();
  const done = new Set();
  await new Promise((resolve) => {
    overlay.classList.remove("hidden");
    const items = chores.map((c, i) =>
      `<button class="btn chore" data-i="${i}"><span class="mark">未</span>${esc(c.name)}</button>`
    ).join("");
    overlay.innerHTML =
      `<div class="card"><h2>今日事</h2>` +
      `<p class="muted">不必全做。做一件，就是一件。</p>` +
      `<div class="acts">${items}</div>` +
      `<div class="chore-line" id="choreLine"></div>` +
      `<div class="acts"><button class="btn center hidden" id="choreGo">今日事，畢</button></div></div>`;
    overlay.querySelectorAll(".chore").forEach((el) => {
      el.addEventListener("click", () => {
        const i = Number(el.dataset.i);
        if (done.has(i)) return;
        done.add(i);
        el.classList.add("done");
        el.querySelector(".mark").textContent = "畢";
        $("choreLine").textContent = chores[i].line;
        $("choreGo").classList.remove("hidden");
      });
    });
    $("choreGo").addEventListener("click", resolve, { once: true });
  });
  hideCard();
}

/* ---------- 靜坐片刻（30 秒，頁面離開就暫停） ---------- */
async function meditate() {
  idleBar.classList.add("hidden");
  overlay.classList.remove("hidden");
  overlay.innerHTML =
    `<div class="card"><div class="sit-wrap">` +
    `<div class="pond">` +
    `<span class="ripple r1"></span><span class="ripple r2"></span><span class="ripple r3"></span>` +
    `<div class="core"></div>` +
    `<div class="breath-label"><span class="in">吸</span><span class="out">呼</span></div>` +
    `</div>` +
    `<div class="sit-hint" id="sitHint">什麼都不用做。跟著水紋，呼吸。</div>` +
    `<button class="btn small ghost" id="sitQuit">先不坐了</button>` +
    `</div></div>`;

  const need = 30000;
  let acc = 0;
  let last = performance.now();
  let quit = false;
  $("sitQuit").addEventListener("click", () => { quit = true; }, { once: true });

  await new Promise((resolve) => {
    const tick = setInterval(() => {
      const now = performance.now();
      if (!document.hidden) acc += now - last;
      last = now;
      if (quit || acc >= need) { clearInterval(tick); resolve(); }
    }, 250);
  });

  if (quit) { hideCard(); enterIdle(); return; }

  $("sitHint").textContent = "心，靜了一些。";
  $("sitQuit").classList.add("hidden");
  await wait(1400);
  hideCard();
  runRound("extra");
}

/* ---------- 渡我一下（30 秒緊急法：不算局，隨時的救生圈） ---------- */
async function ferryMe() {
  idleBar.classList.add("hidden");
  for (const line of EMERGENCY) {
    await new Promise((resolve) => {
      overlay.classList.remove("hidden");
      overlay.innerHTML =
        `<div class="card"><div class="sit-wrap">` +
        `<div class="pond"><span class="ripple r1"></span><span class="ripple r2"></span><span class="ripple r3"></span><div class="core"></div></div>` +
        `<div class="ferry-line">${esc(line)}</div>` +
        `<div class="sit-hint">跟著唸。點一下，下一句。</div>` +
        `</div></div>`;
      const t = setTimeout(resolve, 6000);
      overlay.addEventListener("click", () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
  await showCard(
    `<p class="quote-text" style="text-align:center">${esc(EMERGENCY_CLOSE)}</p>`,
    [{ k: "ok", label: "回去" }]
  );
  hideCard();
  enterIdle();
}

/* ---------- 長卷（無數字的成長軌跡：平緩是靜，折波是急，朱點是句子） ---------- */
async function showScroll() {
  const hs = S.history;
  let body;
  if (hs.length) {
    const w = 60 + hs.length * 30;
    let x = 26;
    let d = `M${x},60`;
    let marks = "";
    for (const h of hs) {
      if (h.c === "rush") d += " l7,-11 l8,19 l8,-13 l7,5";
      else if (h.c === "calm") d += " q15,-8 30,0";
      else d += " q15,4 30,0";
      x += 30;
      if (h.q) marks += `<circle cx="${x - 15}" cy="38" r="3.4" fill="#b6512f"/>`;
    }
    body =
      `<div class="scroll-wrap"><svg width="${w + 40}" height="110" viewBox="0 0 ${w + 40} 110">` +
      `<path d="${d}" fill="none" stroke="#26221e" stroke-width="2" opacity="0.8" stroke-linecap="round"/>` +
      marks +
      `<text x="${x + 10}" y="65" font-size="13" fill="#5c554c">流</text>` +
      `</svg></div>` +
      `<p class="muted">一天一段河：平緩是靜，折波是急，朱點是拾得的句子。</p>`;
  } else {
    body = `<p class="muted">河，還沒開始畫。\n開過局，這裡就會多一段。</p>`;
  }
  await showCard(`<h2>長卷</h2>${body}`, [{ k: "ok", label: "闔上" }]);
  hideCard(); enterIdle();
}

/* ---------- 今日隨身句 ---------- */
function renderCarry() {
  const el = $("carry");
  const q = S.carryQuote ? QUOTES.find((x) => x.id === S.carryQuote) : null;
  if (q) {
    el.textContent = "「" + q.text + "」";
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

/* ---------- 字帖／信匣／設定 ---------- */
async function showQuotes() {
  const owned = QUOTES.filter((q) => S.quotes.includes(q.id));
  await new Promise((resolve) => {
    overlay.classList.remove("hidden");
    const body = owned.length
      ? `<div class="scroll-list">` + owned.map((q) =>
          `<div class="item"><button class="hang${S.carryQuote === q.id ? " on" : ""}" data-q="${q.id}">${S.carryQuote === q.id ? "已隨身" : "隨身"}</button>${esc(q.text)}${q.src === "補" ? ` <span class="src">（補）</span>` : ""}</div>`
        ).join("") + `</div><p class="muted" style="margin-top:8px">點「隨身」，把一句掛在渡口，作今日的心錨。</p>`
      : `<p class="muted">還沒有拾得半句。\n句子不求，遇上了自然會來。</p>`;
    overlay.innerHTML = `<div class="card"><h2>字帖</h2>${body}<div class="acts"><button class="btn center" id="qClose">闔上</button></div></div>`;
    overlay.querySelectorAll(".hang").forEach((el) => {
      el.addEventListener("click", () => {
        S.carryQuote = S.carryQuote === el.dataset.q ? null : el.dataset.q;
        save();
        overlay.querySelectorAll(".hang").forEach((h) => {
          const on = S.carryQuote === h.dataset.q;
          h.classList.toggle("on", on);
          h.textContent = on ? "已隨身" : "隨身";
        });
        renderCarry();
      });
    });
    $("qClose").addEventListener("click", resolve, { once: true });
  });
  hideCard(); enterIdle();
}
async function showMail() {
  const body = S.letters.length
    ? `<div class="scroll-list">` + S.letters.slice().reverse().map((l) =>
        `<div class="item">${esc(l.text)}</div>`
      ).join("") + `</div>`
    : `<p class="muted">信匣空著。\n有旅人路過，自然會留下什麼。</p>`;
  S.letters.forEach((l) => { l.read = true; });
  save();
  await showCard(`<h2>信匣</h2>${body}`, [{ k: "ok", label: "闔上" }]);
  hideCard(); enterIdle();
}
async function showSettings() {
  const k = await showCard(
    `<h2>渡</h2><p class="muted">一天一局，約莫三分鐘。\n種下的因，明日揭曉。\n幾日不來也無妨——缺席是留白，不是罪。</p>`,
    [{ k: "reset", label: "重起爐灶（清除一切）", cls: "center" }, { k: "ok", label: "闔上" }]
  );
  hideCard();
  if (k === "reset") {
    const k2 = await showCard(
      `<p>渡口的一切——字帖、信、種下的因，都會化為白紙。\n真的要重來？</p>`,
      [{ k: "no", label: "留著" }, { k: "yes", label: "化為白紙" }]
    );
    hideCard();
    if (k2 === "yes") {
      S = defaultState();
      save();
      document.querySelectorAll(".hidden-part").forEach((el) => el.classList.remove("shown"));
      $("lampGlow").style.opacity = "0";
      $("lampBox").setAttribute("fill", "#26221e");
      boot(true);
      return;
    }
  }
  enterIdle();
}

/* ---------- 閒時 ---------- */
function enterIdle() {
  hideCard();
  idleBar.classList.remove("hidden");
  const played = S.lastRoundDate === todayStr();
  $("btnRound").textContent = played ? "靜坐片刻" : "開今日一局";
  $("mailDot").classList.toggle("hidden", !S.letters.some((l) => !l.read));
}

/* ---------- 開機 ---------- */
async function boot(isReset) {
  $("dateLabel").textContent = dateLabel();
  applySky();
  renderWorld();
  renderCarry();

  const today = todayStr();
  if (!isReset && S.lastSeenDate && daysBetween(S.lastSeenDate, today) >= 2) {
    S.absenceGift = true;   // 留白的禮物，開局時揭曉
  }
  S.lastSeenDate = today;
  save();

  const firstEver = S.totalRounds === 0 && S.quotes.length === 0 && !S.lastRoundDate;
  if (firstEver) {
    fog.classList.add("on");
    await wait(400);
    await showCard(`<p class="quote-text" style="text-align:center">這是你的渡口。</p>`, [{ k: "ok", label: "嗯" }]);
    await showCard(`<p>河會自己流。\n你只要做好今天的事。</p>`, [{ k: "ok", label: "上工" }]);
    hideCard();
    runRound("main");
    return;
  }

  if (S.lastRoundDate !== today) {
    enterIdle();   // 讓「開今日一局」等著，主動權在人
  } else {
    enterIdle();
  }
}

$("btnRound").addEventListener("click", () => {
  if (S.lastRoundDate === todayStr()) meditate();
  else runRound("main");
});
$("btnQuotes").addEventListener("click", () => { idleBar.classList.add("hidden"); showQuotes(); });
$("btnMail").addEventListener("click", () => { idleBar.classList.add("hidden"); showMail(); });
$("btnScroll").addEventListener("click", () => { idleBar.classList.add("hidden"); showScroll(); });
$("btnSet").addEventListener("click", () => { idleBar.classList.add("hidden"); showSettings(); });
$("btnHelp").addEventListener("click", () => { ferryMe(); });

boot(false);
