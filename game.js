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
    history: [],           // 長卷 {d, c:"calm"|"rush"|null, q:bool, g:bool}
    lifeTrigger: null,     // 生活扳機 {when, line, setDate}
    lastTriggerOfferRound: 0,
    lastReviewRound: 0,    // 七日回望
    pendingGold: false,    // 生活裡用上了句子，今日長卷落金點
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

    // 二之二、七日回望（每滿七局，回頭看一眼自己的河）
    if (S.totalRounds >= 7 && S.totalRounds % 7 === 0 && S.lastReviewRound !== S.totalRounds) {
      S.lastReviewRound = S.totalRounds;
      save();
      const last7 = S.history.slice(-7);
      const calm = last7.filter((h) => h.c === "calm").length;
      const rush = last7.filter((h) => h.c === "rush").length;
      const hasQ = last7.some((h) => h.q);
      const hasG = last7.some((h) => h.g);
      let lines = [];
      if (calm > rush) lines.push("這七日，河多半是平的。");
      else if (calm === rush) lines.push("這七日，有平有波——都是河。");
      else lines.push("這七日，浪多了些。浪，也是水。");
      if (hasQ) lines.push("途中，拾得了句子。");
      if (hasG) lines.push("更難得的是——有那麼一刻，你在生活裡，把句子說了出來。");
      lines.push("你回來得，比從前快了。");
      await showCard(
        `<h2>七日回望</h2><p>${lines.join("\n")}</p>`,
        [{ k: "ok", label: "繼續渡" }]
      );
      hideCard();
      await wait(300);
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

    // 三之四、扳機的回音（立過生活扳機，隔兩日輕輕問一次）
    if (S.lifeTrigger && daysBetween(S.lifeTrigger.setDate, today) >= 2) {
      const tg = S.lifeTrigger;
      const k = await showCard(
        `<h2>扳機的回音</h2><p class="muted">你立過一個扳機——</p>` +
        `<p>「${esc(tg.when)}，先說：『${esc(tg.line)}』」</p>` +
        `<p class="muted" style="margin-top:12px">那個時刻，來過了嗎？</p>`,
        [
          { k: "hit", cls: "voice calm", html: `<span class="who">來過</span>句子，出來了。` },
          { k: "miss", cls: "voice rush", html: `<span class="who">來過</span>但當下忘了說。` },
          { k: "wait", label: "那一刻還沒來" }
        ]
      );
      hideCard();
      await wait(300);
      if (k === "hit") {
        S.pendingGold = true;
        S.lifeTrigger = null;
        S.lastTriggerOfferRound = 0;   // 今晚可再立新的
        await showCard(`<p>好。\n渡口，已經跟著你走出去了。\n今日的長卷，落一枚金點。</p>`, [{ k: "ok", label: "嗯" }]);
      } else if (k === "miss") {
        tg.setDate = today;
        await showCard(`<p>沒關係。\n看見「忘了」，就是「記得」的開始。\n弦，再上一次。</p>`, [{ k: "ok", label: "好" }]);
      } else {
        tg.setDate = today;
        await showCard(`<p>不急。扳機不趕時間。</p>`, [{ k: "ok", label: "好" }]);
      }
      hideCard();
      await wait(300);
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
      await showTalk(null, `你照著${choice === "calm" ? "靜" : "急"}的聲音，做了。\n這件事還沒完——尾聲，明日再看。`, [{ k: "ok", label: "好" }]);
      hideTalk();
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
      await showTalk(null, `你照著${choice === "calm" ? "靜" : "急"}的聲音，做了。\n水還在流——這件事，明日還有下文。`, [{ k: "ok", label: "好" }]);
      hideTalk();
      handled = true;
    }
  }

  // 旅人問渡（角色反轉：拾得三句以上才會遇到）
  if (!handled && kind === "main" && S.quotes.length >= 3 && Math.random() < 0.25) {
    const rest = GUESTS.filter((g) => !S.usedGuests.includes(g.id));
    if (rest.length) {
      const g = pick(rest);
      S.usedGuests.push(g.id);
      // 旅人的身影，走上棧橋
      $("g-guest").classList.add("shown");
      await wait(1200);
      const owned = QUOTES.filter((q) => S.quotes.includes(q.id));
      const opts = [];
      const cp = owned.slice();
      while (opts.length < 3 && cp.length) opts.push(cp.splice(Math.floor(Math.random() * cp.length), 1)[0]);
      const chosen = await showTalk(
        `旅人問渡・${g.who}`,
        `${esc(g.text)}<div class="muted-line">這回，換你當那個靜的聲音。送他字帖裡的哪一句？</div>`,
        opts.map((q) => ({ k: q.id, cls: "voice calm", html: esc(q.text) }))
      );
      hideTalk();
      S.seeds.push({ type: "guest", gid: g.id, qid: chosen, date: today });
      save();
      await wait(350);
      await showTalk(null, `他把那句話收進袖裡，上了船。\n後來如何——等他捎信來。`, [{ k: "ok", label: "好" }]);
      hideTalk();
      $("g-guest").classList.remove("shown");
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
    await showTalk(null, `你照著${choice === "calm" ? "靜" : "急"}的聲音，做了。\n結果如何——明日再看。`, [{ k: "ok", label: "好" }]);
    hideTalk();
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

  // 七之二、立一個生活的扳機（若Ｘ則Ｙ：讓句子綁上真實的時刻）
  if (kind === "main" && !S.lifeTrigger && S.totalRounds >= 1 &&
      S.totalRounds - S.lastTriggerOfferRound >= 3) {
    S.lastTriggerOfferRound = S.totalRounds;
    const carryQ = S.carryQuote ? QUOTES.find((x) => x.id === S.carryQuote) : null;
    const line = carryQ ? carryQ.text : "別急，只看事實要怎麼處理。";
    const pool = TRIGGERS.slice();
    const opts = [];
    while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const k = await showCard(
      `<h2>立一個扳機</h2>` +
      `<p class="muted">把一句話，綁上生活裡真實的一刻——下次它來，句子自己會跳出來。</p>` +
      `<p style="margin-top:10px">「下次______，我先說：『${esc(line)}』」</p>`,
      opts.map((w, i) => ({ k: "t" + i, cls: "voice calm", html: esc(w) }))
        .concat([{ k: "skip", label: "這次先不立" }])
    );
    hideCard();
    if (k !== "skip") {
      const when = opts[Number(k.slice(1))];
      S.lifeTrigger = { when, line, setDate: today };
      save();
      await wait(300);
      await showCard(
        `<p>立好了。\n「${esc(when)}，先說：『${esc(line)}』」\n過兩日，我再問你那一刻來過沒有。</p>`,
        [{ k: "ok", label: "好" }]
      );
      hideCard();
    }
    await wait(300);
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
  S.history.push({ d: today, c: dayChoice, q: !!quoteDrop, g: S.pendingGold });
  S.pendingGold = false;
  if (S.history.length > 400) S.history = S.history.slice(-400);
  save();

  ZenAudio.toll();   // 吹燈，遠處一聲鐘
  dusk.classList.add("on");
  await wait(2600);
  dusk.classList.remove("on");
  enterIdle();
}

/* 事件入景：對話浮在河面（無卡框） */
function showTalk(title, textHtml, buttons) {
  return new Promise((resolve) => {
    overlay.classList.remove("hidden");
    overlay.classList.add("scene");
    const acts = buttons.map((b) =>
      b.div
        ? `<div class="between">${b.html}</div>`
        : `<button class="btn ${b.cls || "center"}" data-k="${b.k}">${b.html || esc(b.label)}</button>`
    ).join("");
    overlay.innerHTML =
      `<div class="talk">` +
      (title ? `<div class="talk-title">${esc(title)}</div>` : "") +
      (textHtml ? `<div class="talk-text">${textHtml}</div>` : "") +
      `<div class="acts">${acts}</div></div>`;
    overlay.querySelectorAll("[data-k]").forEach((el) => {
      el.addEventListener("click", () => resolve(el.dataset.k), { once: true });
    });
  });
}
function hideTalk() {
  overlay.classList.remove("scene");
  hideCard();
}

/* 亂流：河面躁動、對話入景；急上、靜下，中間一句主公親擬的橋 */
async function voiceCard(title, text, rushLine, calmLine) {
  document.body.classList.add("trouble");
  const btns = [
    { k: "rush", cls: "voice rush", html: `<span class="who">急的聲音</span>${esc(rushLine)}` },
    { div: true, html: "別急，只看事實要怎麼處理。" },
    { k: "calm", cls: "voice calm", html: `<span class="who">靜的聲音</span>${esc(calmLine)}` }
  ];
  const choice = await showTalk(
    title,
    `${esc(text)}<div class="muted-line">心裡響起兩個聲音——</div>`,
    btns
  );
  document.body.classList.remove("trouble");
  hideTalk();
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

/* 今日事：場景即介面——小事就長在渡口上，點一點 */
const SVGNS = "http://www.w3.org/2000/svg";
async function choresPhase() {
  const chores = dailyChores();
  const anchors = [[150, 596], [72, 664], [298, 646]];   // 棧橋、蘆葦岸、燈柱下
  const hint = $("sceneHint");
  const go = $("sceneGo");
  hint.textContent = "今日事——渡口上有幾件小事，點一點。不必全做，做一件，就是一件。";
  hint.classList.remove("hidden");

  const layer = document.createElementNS(SVGNS, "g");
  layer.setAttribute("id", "choreLayer");
  chores.forEach((c, i) => {
    const [x, y] = anchors[i] || anchors[0];
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "spot");
    g.setAttribute("transform", `translate(${x},${y})`);
    g.innerHTML =
      `<circle class="spot-ring" r="9"></circle>` +
      `<circle class="spot-dot" r="4.5"></circle>` +
      `<text class="spot-name" x="13" y="5">${esc(c.name)}</text>`;
    g.addEventListener("click", () => {
      if (g.classList.contains("done")) return;
      g.classList.add("done");
      hint.textContent = c.line;
      ZenAudio.tick();
      go.classList.remove("hidden");
    });
    layer.appendChild(g);
  });
  $("scene").appendChild(layer);

  await new Promise((resolve) => go.addEventListener("click", resolve, { once: true }));
  go.classList.add("hidden");
  hint.classList.add("hidden");
  layer.remove();
}

/* ---------- 靜坐片刻（沉浸式：天地全暗、一息十秒半、河聲、可選入定聲） ---------- */
async function meditate() {
  idleBar.classList.add("hidden");
  overlay.classList.remove("hidden");
  overlay.classList.add("deep");

  let bin = false;
  try { bin = localStorage.getItem("du_ferry_binaural") === "1"; } catch (e) {}

  overlay.innerHTML =
    `<div class="deep-wrap">` +
    `<div class="pond">` +
    `<span class="ripple r1"></span><span class="ripple r2"></span><span class="ripple r3"></span>` +
    `<div class="core"></div>` +
    `<div class="breath-label"><span class="in">吸</span><span class="out">呼</span></div>` +
    `</div>` +
    `<div class="sit-hint" id="sitHint">什麼都不用做。跟著水紋，慢慢呼吸。</div>` +
    `<div class="deep-acts">` +
    `<button class="btn small ghost" id="binToggle">入定聲${bin ? "・開" : ""}</button>` +
    `<button class="btn small ghost" id="sitQuit">先不坐了</button>` +
    `<button class="btn small hidden" id="sitGo">起身，開一局</button>` +
    `</div>` +
    `<div class="sit-note">入定聲要戴耳機——有人覺得更容易靜，聽聽看就好。</div>` +
    `</div>`;

  // 音場：河聲漲上來；入定聲照上回偏好
  ZenAudio.deepIn();
  if (bin) ZenAudio.startBinaural();

  // 手機微震隨呼吸起點（一息 10.5 秒，可無感略過）
  const buzz = setInterval(() => {
    try { if (navigator.vibrate && !document.hidden) navigator.vibrate(15); } catch (e) {}
  }, 10500);

  $("binToggle").addEventListener("click", () => {
    bin = !bin;
    try { localStorage.setItem("du_ferry_binaural", bin ? "1" : "0"); } catch (e) {}
    if (bin) ZenAudio.startBinaural(); else ZenAudio.stopBinaural();
    $("binToggle").textContent = "入定聲" + (bin ? "・開" : "");
  });

  const cleanup = () => {
    clearInterval(buzz);
    ZenAudio.deepOut();
    ZenAudio.stopBinaural();
    overlay.classList.remove("deep");
  };

  // 至少坐滿三十秒（頁面離開就暫停計時）；之後想坐多久都可以
  const need = 30000;
  let acc = 0;
  let last = performance.now();
  let action = null;
  $("sitQuit").addEventListener("click", () => { action = "quit"; }, { once: true });
  $("sitGo").addEventListener("click", () => { action = "go"; }, { once: true });

  await new Promise((resolve) => {
    let ripe = false;
    const tick = setInterval(() => {
      const now = performance.now();
      if (!document.hidden) acc += now - last;
      last = now;
      if (!ripe && acc >= need) {
        ripe = true;
        $("sitHint").textContent = "心，靜了一些。想坐多久，都可以。";
        $("sitGo").classList.remove("hidden");
      }
      if (action) { clearInterval(tick); resolve(); }
    }, 250);
  });

  cleanup();
  hideCard();
  if (action === "go") runRound("extra");
  else enterIdle();
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
      if (h.g) marks += `<circle cx="${x - 15}" cy="24" r="4.2" fill="#c9a227"/>`;
    }
    body =
      `<div class="scroll-wrap"><svg width="${w + 40}" height="110" viewBox="0 0 ${w + 40} 110">` +
      `<path d="${d}" fill="none" stroke="#26221e" stroke-width="2" opacity="0.8" stroke-linecap="round"/>` +
      marks +
      `<text x="${x + 10}" y="65" font-size="13" fill="#5c554c">流</text>` +
      `</svg></div>` +
      `<p class="muted">一天一段河：平緩是靜，折波是急，朱點是拾得的句子，金點是你在生活裡把句子說出來的那一刻。</p>`;
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

/* ---------- 贈人：把句子畫成水墨圖卡，用手機原生分享送給真實的朋友 ---------- */
async function shareQuote(q, btnEl) {
  const W = 1080, H = 1080;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  // 宣紙
  c.fillStyle = "#f4efe6"; c.fillRect(0, 0, W, H);
  // 遠山淡墨
  c.fillStyle = "rgba(74,81,88,0.10)";
  c.beginPath(); c.moveTo(0, 800);
  c.quadraticCurveTo(260, 660, 520, 770);
  c.quadraticCurveTo(800, 870, 1080, 750);
  c.lineTo(1080, 1080); c.lineTo(0, 1080); c.closePath(); c.fill();
  // 水痕
  c.strokeStyle = "rgba(63,74,82,0.18)"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(160, 930); c.quadraticCurveTo(260, 916, 380, 930); c.stroke();
  // 朱砂月
  c.fillStyle = "rgba(182,81,47,0.25)";
  c.beginPath(); c.arc(866, 206, 62, 0, 7); c.fill();
  // 句子（自動換行、置中）
  c.fillStyle = "#26221e";
  c.font = '58px "Noto Serif TC", "PMingLiU", serif';
  c.textAlign = "center";
  const maxW = 780;
  const lines = [];
  let line = "";
  for (const ch of q.text) {
    line += ch;
    if (c.measureText(line).width > maxW) { lines.push(line.slice(0, -1)); line = ch; }
  }
  if (line) lines.push(line);
  const lh = 100;
  const y0 = 470 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => c.fillText(l, W / 2, y0 + i * lh));
  // 落款
  c.fillStyle = "#5c554c"; c.font = '30px "Noto Serif TC", serif';
  c.fillText("—— 順流成真 ——", W / 2, y0 + lines.length * lh + 40);
  // 朱印
  c.fillStyle = "#b6512f"; c.fillRect(936, 936, 92, 92);
  c.fillStyle = "#f4efe6"; c.font = '62px "Noto Serif TC", serif';
  c.fillText("渡", 982, 1002);

  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const shareText = q.text + "\n——《渡》 https://chifon2025.github.io/ferry/";
  try {
    const file = blob ? new File([blob], "du-quote.png", { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: q.text + "——《渡》" });
    } else if (navigator.share) {
      await navigator.share({ text: shareText });
    } else {
      await navigator.clipboard.writeText(shareText);
      if (btnEl) btnEl.textContent = "已抄下";
    }
  } catch (e) { /* 使用者取消分享，無妨 */ }
}

/* ---------- 字帖／信匣／設定 ---------- */
async function showQuotes() {
  const owned = QUOTES.filter((q) => S.quotes.includes(q.id));
  await new Promise((resolve) => {
    overlay.classList.remove("hidden");
    const body = owned.length
      ? `<div class="scroll-list">` + owned.map((q) =>
          `<div class="item">` +
          `<button class="hang give" data-s="${q.id}">贈人</button>` +
          `<button class="hang${S.carryQuote === q.id ? " on" : ""}" data-q="${q.id}">${S.carryQuote === q.id ? "已隨身" : "隨身"}</button>` +
          `${esc(q.text)}${q.src === "補" ? ` <span class="src">（補）</span>` : ""}</div>`
        ).join("") + `</div><p class="muted" style="margin-top:8px">「隨身」掛在渡口作心錨；「贈人」把句子送給一個真實的朋友。</p>`
      : `<p class="muted">還沒有拾得半句。\n句子不求，遇上了自然會來。</p>`;
    overlay.innerHTML = `<div class="card"><h2>字帖</h2>${body}<div class="acts"><button class="btn center" id="qClose">闔上</button></div></div>`;
    overlay.querySelectorAll(".hang[data-q]").forEach((el) => {
      el.addEventListener("click", () => {
        S.carryQuote = S.carryQuote === el.dataset.q ? null : el.dataset.q;
        save();
        overlay.querySelectorAll(".hang[data-q]").forEach((h) => {
          const on = S.carryQuote === h.dataset.q;
          h.classList.toggle("on", on);
          h.textContent = on ? "已隨身" : "隨身";
        });
        renderCarry();
      });
    });
    overlay.querySelectorAll(".hang[data-s]").forEach((el) => {
      el.addEventListener("click", () => {
        const q = QUOTES.find((x) => x.id === el.dataset.s);
        if (q) shareQuote(q, el);
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

  // 圖示捷徑「渡我一下」：長按 App 圖示直達 30 秒緊急法
  if (new URLSearchParams(location.search).has("ferry")) {
    history.replaceState(null, "", location.pathname);
    ferryMe();
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
