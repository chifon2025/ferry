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
    seeds: [],             // {sid, choice, date}
    quotes: [],            // 已拾得金句 id
    letters: [],           // {text, date, read}
    usedScenarios: [],
    flags: {}
  };
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
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
function pickScenario() {
  let pool = SCENARIOS.filter((s) => !S.usedScenarios.includes(s.id));
  if (pool.length === 0) { S.usedScenarios = []; pool = SCENARIOS.slice(); }
  return pick(pool);
}
function dailyChores() {
  // 以日期為種子，讓同一天看到同三件事
  let seed = 0;
  const t = todayStr();
  for (let i = 0; i < t.length; i++) seed = (seed * 31 + t.charCodeAt(i)) >>> 0;
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
    save();

    // 四、今日事（做好當下）
    await choresPhase();
  }

  // 五、亂流（不是每天都有；靜坐加開的一局必有）
  const hasEvent = kind === "extra" || S.totalRounds === 0 || Math.random() < 0.75;
  let quoteDrop = null;
  let notes = [];
  if (hasEvent) {
    const sc = pickScenario();
    S.usedScenarios.push(sc.id);

    // 主公裁示：固定順序——急的聲音在上（先跳出來的總是它），靜的聲音在下
    const voices = [
      { k: "rush", who: "急的聲音", line: sc.rush, cls: "voice rush" },
      { k: "calm", who: "靜的聲音", line: sc.calm, cls: "voice calm" }
    ];

    const btns = voices.map((v) => ({
      k: v.k, cls: v.cls,
      html: `<span class="who">${v.who}</span>${esc(v.line)}`
    }));
    // 主公裁示：急與靜之間插一口氣——人性是急的先跳出來，停一下才聽得見靜的
    btns.splice(1, 0, { div: true, html: "停一口氣——現在，是誰在做決定？" });
    const choice = await showCard(
      `<h2>${esc(sc.title)}</h2><p>${esc(sc.text)}</p><p class="muted" style="margin-top:10px">心裡響起兩個聲音——</p>`,
      btns
    );
    hideCard();

    S.seeds.push({ sid: sc.id, choice, date: today });
    if (choice === "calm") {
      S.calmCount++;
      notes = checkMilestones();
      // 金句：稀有掉落，做對了才拾得
      if (Math.random() < 0.4) {
        const owned = new Set(S.quotes);
        const rest = QUOTES.filter((q) => !owned.has(q.id));
        if (rest.length) {
          quoteDrop = pick(rest);
          S.quotes.push(quoteDrop.id);
        }
      }
    }
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

  // 八、吹燈收尾
  await wait(300);
  const closer = pick(CLOSERS);
  await showCard(
    `<h2>今日已種下</h2><p class="muted">明日再看。</p>` +
    (closer ? `<p style="margin-top:14px">${esc(closer)}</p><p class="muted" style="margin-top:6px">不用回答。放著就好。</p>` : ""),
    [{ k: "ok", label: "吹燈" }]
  );
  hideCard();

  S.totalRounds++;
  if (kind === "main") S.lastRoundDate = today;
  save();

  dusk.classList.add("on");
  await wait(2600);
  dusk.classList.remove("on");
  enterIdle();
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
    `<div class="breath"></div>` +
    `<div class="sit-hint" id="sitHint">什麼都不用做。跟著圈，呼吸。</div>` +
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

/* ---------- 字帖／信匣／設定 ---------- */
async function showQuotes() {
  const owned = QUOTES.filter((q) => S.quotes.includes(q.id));
  const body = owned.length
    ? `<div class="scroll-list">` + owned.map((q) =>
        `<div class="item">${esc(q.text)}${q.src === "補" ? ` <span class="src">（補）</span>` : ""}</div>`
      ).join("") + `</div>`
    : `<p class="muted">還沒有拾得半句。\n句子不求，遇上了自然會來。</p>`;
  await showCard(`<h2>字帖</h2>${body}`, [{ k: "ok", label: "闔上" }]);
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
  renderWorld();

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
$("btnSet").addEventListener("click", () => { idleBar.classList.add("hidden"); showSettings(); });

boot(false);
