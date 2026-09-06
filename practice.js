/* 日常體悟版入口。舊版資料與引擎留存，但不再啟動舊獎勵迴圈。 */
"use strict";
window.FerryPractice = (() => {
  const C = FerryCore;
  let lastRaw = null, blocked = false, view = "home", installPrompt = null;
  let installed = window.matchMedia?.("(display-mode: standalone)")?.matches === true || navigator.standalone === true;
  const agent = navigator.userAgent || "";
  const isiPhone = /iPhone|iPad|iPod/i.test(agent);
  const isAndroid = /Android/i.test(agent);
  const phrases = ["先看見，再決定。", "可以在意，也可以不急著下結論。", "說清楚能做的，也是一種照顧。", "做好這一步，不拿結果評斷自己。"];
  const paragraph = text => `<p>${esc(text)}</p>`;
  const button = (id, title, sub = "", primary = false) => `<button class="practice-button${primary ? " primary" : ""}" data-do="${id}"><span>${esc(title)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
  const progressOf = phase => {
    const current = phase === "intro" || phase === "observe" ? 0 : phase === "choose" ? 1 : phase === "act" ? 2 : phase === "effect" || phase === "release" ? 3 : 4;
    return `<div class="story-progress" aria-label="故事進度">${["情境與線索","選下一步","做出行動","看看結果","回到生活"].map((name,index)=>`<span class="${index===current ? "current" : index<current ? "passed" : ""}">${esc(name)}</span>`).join("")}</div>`;
  };
  const taskOf = (phase, replay, carryOpen) => ({
    intro:"讀完眼前發生的事，再去查看線索。",
    observe:"點開想看的線索；看夠了就選下一步。",
    choose:"選一個你願意承擔的做法，沒有標準答案。",
    act:"親手按下故事裡的具體動作。",
    effect:"看看你的行動改變了什麼，以及仍不能控制的部分。",
    release:"看看你的行動改變了什麼，以及仍不能控制的部分。",
    carry:replay ? "確認這段自由試玩完成。" : carryOpen ? "若願意，寫下生活中認得出的時刻和一小步。" : "故事已完成；選擇要不要留一個生活提醒。"
  })[phase];
  function paint(kicker, title, content, controls = [], back = true) {
    window.FerryRiver?.hide();
    idleBar.classList.add("hidden");
    overlay.className = "practice-overlay";
    overlay.innerHTML = `<main class="practice-panel" aria-labelledby="practiceTitle"><div class="practice-heading">${back ? '<button class="practice-back" data-do="home" aria-label="回到渡口，保留進度">← 渡口</button>' : '<span class="practice-seal">日常體悟版</span>'}<span>${esc(kicker)}</span></div><h1 id="practiceTitle" tabindex="-1">${esc(title)}</h1>${content}<div class="practice-actions">${controls.join("")}</div><p class="practice-foot">河有自己的去向，你有眼前的一步。</p></main>`;
    overlay.scrollTop = 0;
    $("practiceTitle").focus({preventScroll:true});
    overlay.querySelectorAll("[data-do]").forEach(el => el.addEventListener("click", () => dispatch(el.dataset.do)));
  }
  function error(message) {
    let banner = $("saveWarning");
    if (!banner) {banner = document.createElement("div"); banner.id = "saveWarning"; banner.setAttribute("role", "alert"); document.body.appendChild(banner);}
    banner.textContent = message;
  }
  function commit(next) {
    if (blocked) {error("目前存檔尚未恢復，沒有改寫你的資料。請保留此頁，先匯出備份。"); return false;}
    try {
      if (localStorage.getItem(SAVE_KEY) !== lastRaw) {
        blocked = true; error("另一個分頁更新了進度。此頁已暫停寫入；請重新整理，接續最新存檔。"); return false;
      }
      const raw = JSON.stringify(next);
      localStorage.setItem(SAVE_KEY, raw);
      if (localStorage.getItem(SAVE_KEY) !== raw) throw new Error("readback");
      lastRaw = raw; S = next;
      $("saveWarning")?.remove();
      return true;
    } catch (_) {error("這一步尚未儲存，進度沒有往前。請確認瀏覽器允許儲存、空間足夠，再試一次。也可先匯出備份。"); return false;}
  }
  function storyOf() {return PRACTICE_STORIES.find(x => x.id === S.dailyPractice.active?.story);}
  function updateFunctionMenu() {
    const b=$("btnMenuInstall");
    if(!b)return;
    const detail=installed ? "已可從主畫面直接開啟" : installPrompt ? "此瀏覽器已準備好直接安裝" : isiPhone ? "Safari 分享 → 加入主畫面" : isAndroid ? "使用 Chrome 安裝到主畫面" : "查看手機與電腦安裝步驟";
    b.innerHTML=`<span class="function-icon">▣</span><span><b>${installed ? "App 已安裝" : "安裝手機 App"}</b><small>${detail}</small></span><strong>${installed ? "完成" : installPrompt ? "可安裝" : "說明"}</strong>`;
    b.setAttribute("aria-label",installed ? "App 已安裝" : "安裝手機 App，"+detail);
  }
  function setFunctionMenu(open) {
    const panel=$("functionPanel"), trigger=$("btnMenu");
    panel.classList.toggle("hidden",!open);
    trigger.setAttribute("aria-expanded",open ? "true" : "false");
    if(open){updateFunctionMenu();$("functionClose").focus();}
    else trigger.focus();
  }
  function bindFunctionMenu() {
    $("btnMenu").addEventListener("click",()=>setFunctionMenu(true));
    $("functionClose").addEventListener("click",()=>setFunctionMenu(false));
    $("functionPanel").addEventListener("click",event=>{if(event.target.id==="functionPanel")setFunctionMenu(false);});
    $("btnMenuInstall").addEventListener("click",()=>{setFunctionMenu(false);installApp();});
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("functionPanel").classList.contains("hidden"))setFunctionMenu(false);});
    updateFunctionMenu();
  }
  function home(classic=false) {
    view = "home"; applySky(); renderWorld();
    $("dateLabel").textContent = ({dawn:"晨光初起",day:"日光在岸",dusk:"暮色漸近",night:"一盞夜渡"})[document.body.dataset.tod];
    if(window.FerryRiver && !classic && !new URLSearchParams(location.search).has("classic")) {
      window.FerryRiver.show({getState:()=>S,commit,open:dispatch,error,day:todayStr});return;
    }
    const p = S.dailyPractice, active = p.active;
    const unread = S.letters.some(x => !x.read);
    const next = PRACTICE_STORIES[p.completed.length % PRACTICE_STORIES.length];
    const ready = C.canBegin(S, todayStr());
    let content = `<div class="practice-lead">來渡口，歇一歇。<br>看清眼前，做一小步。</div><p class="practice-intro">一段水墨日常，約莫三分鐘。<br>不用答對，也不必先讓自己平靜。</p>`;
    if (p.anchor) content += `<blockquote>${esc(p.anchor)}</blockquote>`;
    if (p.pending.length) content += `<p class="practice-note">有一段後續留在河上。隔日再來，信匣會接住它。</p>`;
    const controls = [active ? button("resume","接著走",storyOf()?.title || "未完的故事",true) : ready ? button("start","走進今日故事",next.title,true) : button("replays","再玩一段","今天的正式故事完成了；可重玩任何故事，不影響每日進度。",true), button("help","渡我一下","把此刻帶回生活，不計進度。"), `<div class="practice-grid">${button("mail",unread ? "信匣 · 有信" : "信匣")}${button("life","留給生活")}${button("quotes","字帖")}${button("archive","回望長卷")}</div>`, button("about","關於渡")];
    if (ready && !active) controls.splice(2,0,button("replays","自由試玩","直接玩三段故事，不影響每日正式進度。"));
    if (S.chain && S.chain.lastDate < todayStr()) controls.splice(2,0,button("legacy","接續舊日故事","保留原版未完的篇章。"));
    paint("不趕路，也能往前", "渡", content, controls, false);
  }
  function renderStory() {
    view = "story";
    const a = S.dailyPractice.active, story = storyOf();
    if (!a || !story) {error("找不到這段故事；原存檔已保留，請匯出備份。"); return;}
    const action = story.actions.find(x => x.id === a.action);
    const label = a.replay ? "自由試玩 · 不影響每日進度" : story.theme;
    const next = title => button("next",title,"",true);
    let body = "", controls = [], title = story.title;
    if (a.phase === "intro") {body = `<aside class="practice-guide"><b>這一局要做什麼</b><span>先看清發生了什麼，再選一個你願意做的行動。這不是答題。</span></aside>${paragraph(story.opening)}`; controls = [next("查看眼前的線索")];}
    if (a.phase === "observe") {
      title = "先看看眼前"; body = paragraph(story.feeling);
      body += `<div class="practice-clues">${story.clues.map((clue,i) => `<section>${button("clue:"+i,clue[0],a.seen.includes(i) ? "已看見 · 可以再讀" : "輕觸查看")}${a.seen.includes(i) ? paragraph(clue[1]) : ""}</section>`).join("")}</div>`;
      controls = [next(a.seen.length ? "線索看夠了，選下一步" : "也可以直接選下一步")];
    }
    if (a.phase === "choose") {title = "此刻，你願意怎麼做？"; body = paragraph("不需要選一個比較像好人的答案。\n看看每個做法需要什麼，再選你願意承擔的一步。"); controls = story.actions.map(x => button("choose:"+x.id,x.label,x.detail));}
    if (a.phase === "act" && action) {title = "讓這一步發生"; body = `<blockquote>${esc(action.label)}</blockquote>${paragraph(action.detail)}<p class="practice-note">輕觸下方，完成故事裡的這個動作。</p>`; controls = [next(action.task)];}
    if (a.phase === "effect" && action) {title = "你做了這一步，事情繼續發展"; body = `<section class="effect-block"><b>眼前的變化</b>${paragraph(action.effect)}</section><section class="effect-block open"><b>仍不能控制的部分</b>${paragraph(story.release)}</section>`; if(a.replay)body+=`<section class="practice-letter"><span>這條路後來怎麼了 · 正式故事會在隔日來信</span>${paragraph(action.later)}</section>`; controls = [next("故事做完了，回到生活")];}
    if (a.phase === "release") {title = "你做了這一步，事情繼續發展"; body = action ? `<section class="effect-block"><b>眼前的變化</b>${paragraph(action.effect)}</section><section class="effect-block open"><b>仍不能控制的部分</b>${paragraph(story.release)}</section>` : paragraph(story.release); if (a.replay && action) body += `<section class="practice-letter"><span>這條路後來怎麼了 · 正式故事會在隔日來信</span>${paragraph(action.later)}</section>`; controls = [next("故事做完了，回到生活")];}
    if (a.phase === "carry") {
      if(a.replay){title="這段自由試玩完成";body=`<p>你看完了一種走法和它的後續。這不會改變今日正式進度，也不會建立生活紀錄。</p>`;controls=[button("finish:skip","完成這段試玩","",true)];}
      else if(!a.carryOpen){title="今日故事完成";body=`<p>你已經看清線索、選擇行動，也看見結果不全由自己控制。</p><blockquote>${esc(action?.label||"")}</blockquote><p>接下來不是作業。你可以留一個生活提醒，也可以直接結束。</p>`;controls=[button("carry:open","留一個生活提醒","",true),button("finish:skip","今天直接完成")];}
      else {title = "生活裡，也可以試一小步";body = `<p>不必交功課，也不用證明有用。<br>如果願意，留下一個你認得的時刻。</p><label class="practice-field">當什麼事情發生時<input id="lifeWhen" maxlength="90" value="${esc(a.draft?.when ?? story.context)}"></label><label class="practice-field">我願意先做的一小步<textarea id="lifeStep" maxlength="160" rows="3">${esc(a.draft?.step ?? story.step)}</textarea></label><p class="practice-note">只存在這個瀏覽器。請不要填入敏感個資。</p>`;controls = [button("finish:keep","保存提醒並完成","",true),button("finish:skip","不保存，直接完成")];}
    }
    body=progressOf(a.phase)+`<aside class="practice-task"><b>這一步要做什麼</b><span>${esc(taskOf(a.phase,a.replay,a.carryOpen))}</span></aside>`+body;
    paint(label,title,body,controls);
    if(a.phase === "carry"&&a.carryOpen) for(const id of ["lifeWhen","lifeStep"]) $(id).addEventListener("input",()=>{
      const next=C.migrate(S);
      if(next.dailyPractice.active?.phase!=="carry")return;
      next.dailyPractice.active.draft={when:$("lifeWhen").value,step:$("lifeStep").value};
      commit(next);
    });
  }
  function replays() {view="replays"; paint("自由試玩 · 不影響每日進度","選一段日常故事",paragraph("這裡可直接玩完整故事，後續也會立刻顯示。沒有答對獎勵，玩完不會占用今日正式故事。"),PRACTICE_STORIES.map(x=>button("replay:"+x.id,x.title,x.theme)));}
  function mail() {
    view="mail";
    let next = settleState(S);
    // 只結算識別得出的舊種子，不丟棄未知資料。
    next.seeds = next.seeds.filter(seed => {
      if (!seed.date || seed.date >= todayStr()) return true;
      let text = null;
      if (seed.type === "guest") {const g = GUESTS.find(x=>x.id===seed.gid), q = QUOTES.find(x=>x.id===seed.qid); if(g&&q) text=g.thanks.replace("{q}",q.text);}
      else {const old = SCENARIOS.find(x=>x.id===seed.sid); if(old) text=seed.choice==="calm" ? old.calmOpen : old.rushLuck;}
      if (!text) return true;
      next.letters.push({text,date:todayStr(),read:false,title:"舊日留下的回音"}); return false;
    });
    next.letters.forEach(x=>{x.read=true;});
    if (!commit(next)) return;
    paint("來信，不是成績單","河上有回音",S.letters.length ? S.letters.slice().reverse().map(x=>`<article class="practice-letter"><h2>${esc(x.title||"舊日來信")}</h2>${paragraph(x.text)}</article>`).join("") : paragraph("信匣還空著。正式故事完成後，隔日會有後續；不是每件事都會如願。"));
  }
  function life() {
    view="life";
    const body = S.dailyPractice.life.slice().reverse().map(x=>`<article class="practice-letter"><h2>${esc(x.when)}</h2>${paragraph(x.step)}${x.review ? `<p class="practice-note">你留下的回望：${esc(x.review)}</p>` : `<p class="practice-note">最近有遇到這個時刻嗎？任何回答都不影響渡口。</p><div class="practice-answers">${["有想起來，試了一步","有試，但事情還沒解決","當時忘了，現在才想起","還沒遇到這個時刻","暫時不想談"].map((r,i)=>button("reflect:"+x.id+":"+i,r)).join("")}</div>`}</article>`).join("");
    const legacy = S.lifeTrigger ? `<article class="practice-letter"><h2>以前留給生活的一句</h2>${paragraph(S.lifeTrigger.when + "\n" + S.lifeTrigger.line)}<p class="practice-note">原樣保留，不再以有沒有用上來給金點。</p></article>` : "";
    const night = S.nightSeed ? `<article class="practice-letter"><h2>以前寄放在夜裡的事</h2>${paragraph(S.nightSeed.text)}</article>` : "";
    paint("生活才是故事的延續","留給生活",body + legacy + night || paragraph("還沒有留下邀請，也沒關係。\n玩完一段今日故事，可以選擇帶一小步回去。"));
  }
  function quotes() {
    view="quotes";
    const old = QUOTES.filter(x=>S.quotes.includes(x.id)).map(x=>x.text);
    const all = [...new Set([...phrases,...old])];
    paint("不用答對，就能翻開","字帖",`<p class="practice-note">前面的短句是本版原創提醒；以前收集的句子也留在這裡。</p>${all.map((q,i)=>`<article class="practice-letter">${paragraph(q)}${button("anchor:"+i,S.dailyPractice.anchor===q ? "已隨身 · 放回字帖" : "帶在渡口")}</article>`).join("")}`);
  }
  function archive() {
    view="archive";
    const p=S.dailyPractice;
    let body=p.completed.slice().reverse().map(x=>`<article class="practice-letter"><h2>${esc(x.title)}</h2>${paragraph(x.action)}</article>`).join("");
    if(S.history.length) body+=`<article class="practice-letter"><h2>舊日的長卷</h2><p>從前走過的日子與收集紀錄都保留在存檔裡。這裡不再把急與靜畫成好壞分數。</p><div class="practice-river" aria-label="曾經來過的足跡">${S.history.map(()=>"<span>﹏</span>").join("")}</div></article>`;
    paint("留下足跡，不排高低","回望長卷",body||paragraph("長卷還留白。\n來過、離開、再回來，都不需要補進度。"));
  }
  function help(stage=0) {
    view="help";
    const rows=[ ["先讓自己在這裡","你不必馬上把情緒消掉。\n感覺腳下的支撐；呼吸照自己的節奏。","現在，事實是什麼？"], ["把事實與猜測分開","試著說一句：我現在確定知道的是……\n再說一句：我擔心、但還不知道的是……","有哪一步是我做得到的？"], ["只挑一個小動作","問清楚一句話、暫停回覆、說明界線，或找人幫忙。\n如果沒有餘力，也可以先休息。","讓結果保留空間"], ["允許此刻還沒解決","你可以採取行動，也可以稍後改變做法。\n不必把結果當成自己夠不夠好的證明。","回到生活"] ];
    const row=rows[stage];
    paint("隨時可以離開 · 不用等待",row[0],paragraph(row[1]),[button(stage===3?"home":"help:"+(stage+1),row[2],"",true)]);
  }
  function about() {
    view="about";
    paint("一個可以帶回日常的小遊戲","把渡口放在身邊",`<p>《渡》以相信真我、回歸平靜、做好當下、允許成真為創作方向。你仍能在不平靜時照顧自己、做出選擇；遊戲不保證願望實現。</p><h2>任何人都能玩</h2><p>免帳號、免商店下載，分享這個網址就能開始。安裝後會有主畫面圖示，並以獨立 App 視窗開啟。</p><h2>安裝到手機</h2><p>點右上角「⚙ 功能」→「安裝手機 App」。支援直接安裝的瀏覽器會顯示系統安裝視窗；iPhone 則會顯示 Safari 的正確步驟。</p><h2>離線遊玩</h2><p>第一次請保持連線，等離線版本準備完成。之後沒有網路也能進入遊戲；重新連線或回到 App 時會自動檢查更新。</p><h2>你的紀錄留在這裡</h2><p>沒有伺服器存檔，不會在裝置間同步；換瀏覽器、清除網站資料或無痕視窗結束，可能失去進度。公開的是遊戲，不是你的生活紀錄。網站主機仍可能保有一般連線紀錄。</p><p class="practice-note" id="offlineStatus">${"serviceWorker" in navigator && navigator.serviceWorker.controller ? "離線版本已接管此頁。" : "首次造訪請保持連線，離線版本準備好後會在這裡顯示。"}</p><p>這是日常覺察的原創遊戲，不是治療，也不是課程原文。需要協助時，可以找信任的人或合適的專業人員。</p>`,[button("share","分享遊戲網址"),button("export","匯出這台裝置的存檔備份")]);
    if("serviceWorker" in navigator) navigator.serviceWorker.ready.then(()=>{if(view==="about"&&$("offlineStatus")) $("offlineStatus").textContent="離線版本已準備好。回到 App 時會檢查更新，也可從右上「功能」手動檢查。";});
  }
  async function installApp() {
    if (installed) {
      paint("已經在主畫面上", "《渡》已安裝", paragraph("現在可以像其他 App 一樣，從手機主畫面的「渡」圖示開啟。遊戲進度仍只保存在這台裝置的這個 App 裡。"), [button("home","回到渡口","",true)]);
      return;
    }
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      try {
        const directChoice = await prompt.prompt();
        const choice = directChoice?.outcome ? directChoice : await prompt.userChoice;
        if (choice?.outcome === "accepted") {
          installed = true;
          paint("已放到裝置上", "安裝完成", paragraph("主畫面上現在有「渡」的圖示。以後可以直接點它，像 App 一樣開啟。"), [button("home","回到渡口","",true)]);
        } else {
          paint("隨時都能再安裝", "這次沒有安裝", paragraph("遊戲仍可在瀏覽器繼續玩。若想安裝，重新進入「安裝成手機 App」，或使用瀏覽器選單的安裝功能。"), [button("home","回到渡口","",true)]);
        }
      } catch (_) {
        installGuide();
      }
      return;
    }
    installGuide();
  }
  function installGuide() {
    view="install";
    const ios = `<ol class="install-steps"><li>用 <strong>Safari</strong> 開啟《渡》的公開網址。</li><li>點工具列的「分享」圖示；若使用新版配置，也可能要先點「更多」，再選「分享」。</li><li>往下找到並點「加入主畫面」。若沒看到，先點最下方「編輯動作」加入它。</li><li>開啟「以網頁 App 打開」，再點右上角「加入」。</li></ol>`;
    const android = `<ol class="install-steps"><li>建議用 <strong>Chrome</strong> 開啟《渡》的公開網址。</li><li>點右上角選單。</li><li>選「安裝應用程式」；部分版本會顯示「加到主畫面」。</li><li>確認安裝，回到主畫面點「渡」即可開啟。</li></ol>`;
    const desktop = `<p>若要安裝到手機，請先在手機開啟這個網址。Android 建議使用 Chrome；iPhone 請使用 Safari。</p><p>電腦版 Chrome 或 Edge 通常可從網址列右側的安裝圖示，或瀏覽器選單安裝。</p>`;
    paint("安裝後不占用商店帳號", isiPhone ? "iPhone 安裝方式" : isAndroid ? "Android 安裝方式" : "安裝《渡》", isiPhone ? ios : isAndroid ? android : desktop, [button("share","把網址傳到手機"),button("home","回到渡口","",true)]);
  }
  function legacy() {
    const ch=S.chain, source=CHAINS.find(x=>x.id===ch?.id);
    if(!source||ch.lastDate>=todayStr()) return home();
    if(ch.stage===2) {
      const next=C.migrate(S); next.letters.push({title:"舊日篇章的結尾",text:source.endings["calm"+ch.calmHits]||source.endings.calm1,date:todayStr(),read:false}); next.usedChains ||= []; if(!next.usedChains.includes(ch.id))next.usedChains.push(ch.id);next.chain=null;
      if(commit(next))mail(); return;
    }
    paint("原版未完篇章 · 保留原文",source.title||"河流的下一頁",paragraph(source.d2.text)+paragraph("以下接續原版分支，不增加新版獎勵或評分。"),[button("legacy:rush",source.d2.rush),button("legacy:calm",source.d2.calm)]);
  }
  async function dispatch(key) {
    if(key==="home")return home();
    if(key==="classic")return home(true);
    if(key==="about")return about();
    if(key==="install")return installApp();
    if(key==="export") {
      let raw;try{raw=localStorage.getItem(SAVE_KEY)||lastRaw||JSON.stringify(S);}catch(_){raw=lastRaw||JSON.stringify(S);}
      const url=URL.createObjectURL(new Blob([raw],{type:"application/json"})), a=document.createElement("a");a.href=url;a.download="渡-本機存檔.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
    }
    if(blocked){error("已暫停改寫存檔。請先匯出備份，或重新整理接續最新進度。");return;}
    if(key==="start"||key.startsWith("replay:")) {
      if(S.dailyPractice.active) return renderStory();
      const id=key==="start"?PRACTICE_STORIES[S.dailyPractice.completed.length%PRACTICE_STORIES.length].id:key.slice(7);
      if(!PRACTICE_STORIES.some(x=>x.id===id)) return;
      if(commit(C.begin(S,id,todayStr(),key!=="start"))) {if(S.dailyPractice.active)renderStory();else home();}return;
    }
    if(key==="resume")return renderStory();
    if(key==="next") {let next=C.advance(S);if(S.dailyPractice.active?.phase==="effect")next=C.advance(next);if(commit(next))renderStory();return;}
    if(key.startsWith("clue:")){if(commit(C.observe(S,Number(key.slice(5)))))renderStory();return;}
    if(key.startsWith("choose:")){if(storyOf()?.actions.some(x=>x.id===key.slice(7))&&commit(C.choose(S,key.slice(7))))renderStory();return;}
    if(key==="carry:open"){const next=C.migrate(S);if(next.dailyPractice.active?.phase==="carry")next.dailyPractice.active.carryOpen=true;if(commit(next))renderStory();return;}
    if(key.startsWith("finish:")) {
      const keep=key==="finish:keep", invitation=keep?{when:$("lifeWhen").value.trim(),step:$("lifeStep").value.trim()}:null;
      if(keep&&(!invitation.when||!invitation.step)){error("若想帶回生活，請留下情境和一小步；也可以選「今天先不帶」。");return;}
      if(commit(C.finish(S,todayStr(),storyOf(),invitation))) {view="done";paint("故事已完成 · 進度已保存","船已靠岸",paragraph("不用等心情變好才離開。\n下一次在生活裡想起一小步，就從那裡開始。"),[button("home","回到渡口","",true),button("replays","自由試玩另一段")]);}return;
    }
    if(key.startsWith("reflect:")) {
      const parts=key.slice(8).split(":"), i=Number(parts.pop()), id=parts.join(":"), responses=["有想起來，試了一步","有試，但事情還沒解決","當時忘了，現在才想起","還沒遇到這個時刻","暫時不想談"];
      if(responses[i]&&commit(C.reflect(S,id,responses[i],todayStr())))life();return;
    }
    if(key.startsWith("anchor:")) {const all=[...new Set([...phrases,...QUOTES.filter(x=>S.quotes.includes(x.id)).map(x=>x.text)])], q=all[Number(key.slice(7))]; const next=C.migrate(S);next.dailyPractice.anchor=next.dailyPractice.anchor===q?null:q;if(commit(next))quotes();return;}
    if(key.startsWith("help:"))return help(Number(key.slice(5)));
    if(key.startsWith("legacy:")){const next=C.migrate(S);if(next.chain?.stage!==1)return;next.chain.stage=2;next.chain.lastDate=todayStr();if(key==="legacy:calm")next.chain.calmHits++;if(commit(next))home();return;}
    if(key==="share") {
      const url="https://chifon2025.github.io/ferry/";
      try{if(navigator.share)await navigator.share({title:"渡｜把一小步帶回生活",url});else {await navigator.clipboard.writeText(url);error("遊戲網址已複製；分享的內容不包含你的存檔。");}}catch(e){if(e.name!=="AbortError")error("可複製瀏覽器網址分享；你的存檔不會包含在網址裡。");}return;
    }
    const routes={replays,mail,life,quotes,archive,help,about,legacy};routes[key]?.();
  }
  function init() {
    bindFunctionMenu();
    try {
      lastRaw=localStorage.getItem(SAVE_KEY);
      const source=lastRaw?JSON.parse(lastRaw):defaultState();
      const next=C.migrate(source);
      if(lastRaw&&!source.dailyPractice) {
        const backup=SAVE_KEY+"_before_daily_v1";
        if(!localStorage.getItem(backup)){localStorage.setItem(backup,lastRaw);if(localStorage.getItem(backup)!==lastRaw)throw new Error("backup");}
      }
      S=Object.assign(defaultState(),next);
      if(!commit(settleState(S))) {blocked=true;throw new Error("storage");}
      home();
      try {
        if(sessionStorage.getItem("du_ferry_update_resume")==="story") {
          sessionStorage.removeItem("du_ferry_update_resume");
          if(S.dailyPractice.active)renderStory();
        }
      } catch(_) { /* 暫存不可用仍可從「接著走」繼續。 */ }
      if(new URLSearchParams(location.search).has("ferry"))help();
    } catch(_) {
      blocked=true;
      paint("存檔保護","先把原來的渡口留好",paragraph("目前無法安全讀取或儲存進度，沒有覆寫舊存檔。可能是儲存空間、瀏覽器權限，或存檔格式問題。請先匯出原始資料，再確認設定或尋求協助。"),[button("export","匯出原始存檔備份")],false);
    }
  }
  function settleState(state) {
    const next=C.settle(state,todayStr());
    return window.RiverCore ? window.RiverCore.settle(next,todayStr()) : next;
  }
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!blocked&&view==="home"){if(commit(settleState(S)) && !window.FerryRiver?.isVisible())home();}});
  window.addEventListener("storage",event=>{if(event.key===SAVE_KEY){blocked=true;error("另一個分頁更新了進度。此頁已暫停寫入，請重新整理接續。");}});
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    installPrompt=event;
    updateFunctionMenu();
    if(view==="home"&&!window.FerryRiver?.isVisible())home(); else if(view==="about")about();
  });
  window.addEventListener("appinstalled",()=>{
    installPrompt=null; installed=true;
    updateFunctionMenu();
    if(view==="home"&&!window.FerryRiver?.isVisible())home(); else if(view==="about"||view==="install")about();
  });
  function prepareUpdate() {
    if(blocked || $("saveWarning"))return false;
    // 表單未離開前不自動重載，包括未保存的「渡我一下」文字。
    if(window.FerryRiver && !window.FerryRiver.prepareUpdate())return false;
    if(!overlay.classList.contains("hidden") && overlay.querySelector("input, textarea"))return false;
    try {
      if(view==="story")sessionStorage.setItem("du_ferry_update_resume","story");
      else sessionStorage.removeItem("du_ferry_update_resume");
    } catch(_) { /* 更新後仍可由首頁接續已保存的故事。 */ }
    return true;
  }
  return {home,init,installApp,prepareUpdate};
})();
FerryPractice.init();
