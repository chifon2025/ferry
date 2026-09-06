/* 手機直式場景層：圖像、角色、場景熱點與短對話。 */
'use strict';
window.FerryRiver = (() => {
  const C=RiverCore;
  const stories={
    reply:{name:'等信的人',place:'信匣邊',title:'那封還沒到的信',text:'阿禾又往信匣看了一眼。\n「也沒什麼急事……只是想知道，他過得好不好。」',hint:'如果能自在地說說話，你想看見怎樣的一刻？',example:'彼此自在地說話，也能安心做自己的事。',later:'阿禾收到了一張短短的明信片。上面沒有回答所有的問題。他把卡片收好，去茶棚坐了一會兒。'},
    favor:{name:'歇腳的旅人',place:'渡船旁',title:'順路的請託',text:'旅人想請你順道送一只包裹。\n你也想在天黑以前，回家吃頓飯。',hint:'照顧彼此，也照顧自己，那會是怎樣的一刻？',example:'自在地說清楚，也好好照顧自己的生活。',later:'旅人後來找到另一班渡船。他仍有些趕路，臨走前跟你點了點頭。渡口的晚飯也照常開了。'},
    boat:{name:'渡口船家',place:'老棧橋',title:'今天，船先歇一歇',text:'船家把船擦得乾乾淨淨。\n等了一個下午，今天的渡船仍沒有坐滿。\n他放好船槳，抬頭看看天色。',hint:'若能放心地生活，你心裡浮現什麼畫面？',example:'踏實做喜歡的事，安穩過自己的日子。',later:'隔天的渡口仍有忙的時候，也有清靜的時候。船家補好一塊木板，留了把椅子給路過的人。'}
  };
  const icons={
    lamp:'<path d="M9 9h14l-2 16H11Z"/><path d="M7 9h18M12 5h8M8 26q8 5 16 0M16 11v10"/>',
    walk:'<path d="M6 27q7-9 12-7t8-7M9 6q4-4 8 0v6H9ZM13 12v8M9 16h8M10 24l3-4 5 5"/>',
    book:'<path d="M16 8q-6-4-12-2v20q6-2 12 2 6-4 12-2V6q-6-2-12 2Zm0 0v20"/>',
    tea:'<path d="M6 14h16v7a7 7 0 0 1-14 0ZM22 15h3a4 4 0 0 1-3 8M5 29h21M12 4q-3 3 0 6M19 3q-3 3 0 6"/>',
    mail:'<rect x="4" y="9" width="24" height="17" rx="2"/><path d="m4 10 12 9 12-9M16 4v3"/>',
    boat:'<path d="m3 22 26-1-6 7H9ZM16 3v17M16 5 26 17H16M4 30q5-3 10 0t14 0"/>',
    leaf:'<path d="M26 4C8 3 3 12 8 22c10 4 19-1 18-18ZM6 28 21 11"/>'
  };
  const icon=key=>`<svg viewBox="0 0 32 32" aria-hidden="true">${icons[key]||icons.leaf}</svg>`;
  const safe=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let host,api,screen='home',selected=null,autoResume=false,timer=null,drag=null,suppressedClick=false;
  const $=id=>document.getElementById(id);
  function journey(){return C.read(api.getState());}
  function save(next){return api.commit(next);}
  function buttons(items){return items.map(([action,label,sub,primary])=>`<button class="river-button${primary?' primary':''}" data-river="${action}"><span>${label}</span>${sub?`<small>${sub}</small>`:''}</button>`).join('');}
  function init() {
    if(host)return;
    host=document.createElement('main');host.id='riverStage';host.className='river-stage';host.setAttribute('aria-label','渡口');
    host.innerHTML=`<div class="river-world" id="riverWorld" aria-hidden="true"><div class="river-art"></div><div class="river-waterlight"></div><div class="river-haze"></div><div class="river-motes">${Array.from({length:7},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div><img class="river-ferryman" src="art/ferryman.webp" alt=""><div class="river-cat">${'<svg viewBox="0 0 70 45"><path d="M15 34q-19-2-9-19" fill="none" stroke="#e2b078" stroke-width="6" stroke-linecap="round"/><ellipse cx="32" cy="30" rx="21" ry="10" fill="#d6a675"/><path d="m43 22-2-16 11 7 10-9 2 20Z" fill="#ddb482"/><path d="m48 23 3 1m6-1 3-1" stroke="#493a2c" stroke-width="2"/><path d="M26 23v9m6-10v8" stroke="#966747" stroke-width="3"/></svg>'}</div><div class="river-floating" id="floatingLantern"></div><div id="riverRipple"></div></div>
      <section class="river-intro" id="riverIntro"></section><nav class="river-hotspots" id="riverHotspots" aria-label="渡口可以去的地方"></nav><section class="river-dock" id="riverDock" aria-live="polite"></section><div class="river-toast" id="riverToast" role="status"></div>`;
    document.body.appendChild(host);
    host.addEventListener('click',event=>{const button=event.target.closest('[data-river]');if(button)handle(button.dataset.river);});
    host.addEventListener('pointerdown',event=>{
      if(event.target.closest('#releaseLantern') && journey().active?.phase==='release') {
        drag={x:event.clientX,y:event.clientY,id:event.pointerId};event.target.closest('#releaseLantern').setPointerCapture(event.pointerId);
      }
    });
    host.addEventListener('pointermove',event=>{
      if(!drag || drag.id!==event.pointerId)return;
      const x=Math.max(-70,Math.min(70,event.clientX-drag.x)),y=Math.max(-90,Math.min(20,event.clientY-drag.y));
      $('releaseLantern').style.transform=`translate(${x}px,${y}px)`;
    });
    host.addEventListener('pointerup',event=>{
      if(!drag || drag.id!==event.pointerId)return;
      const moved=Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8;drag=null;
      if($('releaseLantern'))$('releaseLantern').style.transform='';
      if(moved){suppressedClick=true;release();setTimeout(()=>{suppressedClick=false;},100);}
    });
    host.addEventListener('pointercancel',()=>{drag=null;if($('releaseLantern'))$('releaseLantern').style.transform='';});
    document.addEventListener('visibilitychange',()=>{host.classList.toggle('asleep',document.hidden);});
    window.addEventListener('resize',keyboardLayout);
    window.visualViewport?.addEventListener('resize',keyboardLayout);
    host.addEventListener('focusin',keyboardLayout);host.addEventListener('focusout',()=>setTimeout(keyboardLayout,30));
  }
  function keyboardLayout(){if(!host)return;const keyboard=window.visualViewport && window.innerHeight-window.visualViewport.height>130;host.classList.toggle('keyboard-open',Boolean(keyboard));host.style.setProperty('--visible-height',`${window.visualViewport?.height||window.innerHeight}px`);}
  function show(options) {
    api=options;init();clearTimeout(timer);host.hidden=false;document.body.classList.add('river-mode');
    $('overlay').classList.add('hidden');$('idleBar').classList.add('hidden');
    try {journey();}catch(_){api.open('classic');api.error('這一趟的紀錄暫時無法讀取，原存檔已保留。');return;}
    if(autoResume && journey().active){autoResume=false;render(journey().active.phase);}else render('home');
    keyboardLayout();
  }
  function hide(){if(host)host.hidden=true;document.body.classList.remove('river-mode');clearTimeout(timer);}
  function toast(text){$('riverToast').textContent=text;$('riverToast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('riverToast')?.classList.remove('visible'),3600);}
  function setIntro(kicker,title,sub=''){$('riverIntro').innerHTML=`<span class="river-kicker">${kicker}</span><h1 id="riverTitle" tabindex="-1">${title}</h1>${sub?`<p>${sub}</p>`:''}`;}
  function setDock(html){$('riverDock').innerHTML=html;$('riverDock').scrollTop=0;}
  function scenePins(walking=false) {
    $('riverHotspots').innerHTML=`<button class="river-pin tea-pin" data-river="tea">${icon('tea')}<span>茶棚小坐</span></button><button class="river-pin mail-pin" data-river="story:reply">${icon('mail')}<span>信匣邊的人</span></button><button class="river-pin boat-pin" data-river="story:favor">${icon('boat')}<span>歇腳的旅人</span></button>${walking?`<button class="river-pin keeper-pin" data-river="story:boat"><span>聽船家說說</span></button>`:''}`;
  }
  function lantern(){return `<span class="lantern-art" aria-hidden="true"><i class="lantern-flame"></i><i class="lantern-paper"></i><i class="lantern-base"></i><i class="lantern-reflection"></i></span>`;}
  function render(next) {
    screen=next;host.dataset.screen=screen;$('riverHotspots').innerHTML='';$('riverToast').classList.remove('visible');
    $('floatingLantern').innerHTML='';$('floatingLantern').className='river-floating';
    const p=journey(),a=p.active,story=stories[a?.story];
    const back='<button class="river-back" data-river="home">‹ 渡口</button>';
    if(screen==='home') {
      setIntro('一方水岸 · 隨時可來','河一直在流','心裡有盼望，也可以歇一歇。');scenePins();
      setDock(`<div class="river-welcome"><span class="river-small-seal">渡</span><div><b>今天，想從哪裡開始？</b><small>點亮一盞燈，或聽聽渡口的故事。</small></div></div><div class="river-entry-grid">${buttons([[a?'resume':'begin',a?'接著這一趟':'心裡有件事',a?'上次停留的地方還在':'去河邊，放一盞燈',true],['walk','到渡口走走','遇見人，也遇見自己']])}</div><div class="river-bottom-links"><button data-river="book">${icon('book')}渡口小冊${api.getState().letters.some(x=>!x.read)?'<i class="river-new-dot"></i>':''}</button><span>河燈 · 人情 · 日常</span></div>`);
    } else if(screen==='walk') {
      setIntro('沿著水岸，慢慢走','渡口有人在','碰一下亮著的名字，聽一小段日常。');scenePins(true);
      setDock(`${back}<p class="river-dialogue">茶還溫著，船也靠岸了。<br>想先去哪裡看看？</p><div class="river-inline-actions">${buttons([['tea','喝口茶'],['story:reply','看看信匣'],['story:favor','走近旅人']])}</div>`);
    } else if(screen==='encounter') {
      const s=stories[selected];setIntro('渡口相遇',s.title);
      setDock(`${back}<div class="river-speaker">${selected==='boat'?'<span class="river-avatar"><img src="art/ferryman.webp" alt=""></span>':`<span class="river-small-seal">${selected==='reply'?'信':'旅'}</span>`}<span>${s.name}<small>${s.place}</small></span></div><p class="river-dialogue">${safe(s.text)}</p>${buttons([['storywish','看看心裡想要的','把這段故事，也帶到自己的生活',true],['walk','再走走']])}`);
    } else if(screen==='tea') {
      setIntro('茶棚 · 風來的地方','坐一會兒也好','這裡的茶，一直有你的位置。');
      setDock(`${back}<div class="river-tea-cup" aria-hidden="true">${icon('tea')}<i></i><i></i></div><p class="river-dialogue centered">風穿過茶棚，杯子握在手裡。<br>你可以待一會兒，也可以起身。</p><div class="river-inline-actions">${buttons([['sip','喝一口'],['home','回到渡口']])}</div>`);
    } else if(screen==='wish' && a) {
      setIntro('看見 · 心裡的畫面','你想看見<br>怎樣的一刻？');
      setDock(`${back}${story?`<p class="river-context">${safe(story.hint)}</p>`:''}<label class="river-field" for="riverWish">寫一句，或只在心裡看見<textarea id="riverWish" rows="2" maxlength="120" placeholder="例如：和家人自在地吃一頓飯">${safe(a.wish)}</textarea></label><p class="river-private">文字留在這台裝置，只用來接續這一趟。</p>${buttons([['see','心裡已有畫面','不寫字，也能繼續',true]])}`);
      $('riverWish').addEventListener('input',()=>{save(C.draft(api.getState(),$('riverWish').value));});
    } else if(screen==='see' && a) {
      setIntro('看見 · 隨你停留','讓這一刻<br>在心裡展開');
      $('riverHotspots').innerHTML=`<div class="river-vision">${a.wish?`<p>${safe(a.wish)}</p>`:'<div class="river-vision-light"></div><p>心裡的畫面，自己知道就好。</p>'}</div>`;
      setDock(`${back}<p class="river-dialogue centered">可以慢慢看，也可以帶著它往前。</p>${buttons([['ready','去河邊放燈','',true]])}`);
    } else if(screen==='release' && a) {
      setIntro('河燈 · 手心與水面','想放手時<br>就鬆開','拖一下燈再鬆手，或輕點它。');
      $('riverHotspots').innerHTML=`<button id="releaseLantern" class="release-lantern" data-river="release" aria-label="放開河燈，讓它順水漂行">${lantern()}</button>`;
      setDock(`${back}<p class="river-dialogue centered river-soft">河從一開始，就在流。</p>${buttons([['release','輕輕放開','點按也可以',true]])}`);
    } else if(screen==='shore' && a) {
      setIntro('回到 · 眼前的生活','心願往前<br>你在這裡','岸邊還有一杯茶，一個可以坐下的位置。');
      $('floatingLantern').innerHTML=lantern();$('floatingLantern').classList.add('arrived');
      setDock(`<p class="river-dialogue centered" id="shoreResponse">${a.shoreAction?shoreText(a.shoreAction):'此刻，想做一件什麼小事？'}</p><div class="river-inline-actions shore-actions">${buttons([['act:tea','喝口茶'],['act:greeting','問候船家'],['act:sit','坐一會兒']])}</div>${buttons([['finish','回到今天','隨時都能再來',true]])}<button class="river-text-button" data-river="note">想留一句話</button>`);
    } else if(screen==='note' && a) {
      setIntro('隨手記 · 給自己的話','留一句就好');
      setDock(`${back}<label class="river-field" for="riverNote">下次在生活裡，想記得什麼？<textarea id="riverNote" rows="3" maxlength="160" placeholder="隨你寫，也可以留白。">${safe(a.note||'')}</textarea></label>${buttons([['finishnote','收進小冊，回到今天','',true],['shore','先不寫']])}`);
      $('riverNote').addEventListener('input',()=>{const next=JSON.parse(JSON.stringify(api.getState()));next.riverJourney.active.note=$('riverNote').value;save(next);});
    } else if(screen==='done') {
      setIntro('渡口 · 隨時都在','回到你的今天','眼前的生活，慢慢來。');
      setDock(`<p class="river-dialogue centered">這一趟，到這裡就好。</p>${buttons([['home','留在渡口','',true],['walk','再走走']])}`);
    } else if(screen==='book') {
      setIntro('渡口小冊','把日子輕輕收好');
      setDock(`${back}<div class="river-book-grid">${buttons([['old:mail','信匣','渡口的人，後來的事'],['notes','隨手記','自己願意留下的話'],['old:quotes','字帖','慢慢讀一句'],['old:archive','舊日長卷','原來的經歷都在']])}</div><div class="river-bottom-links"><button data-river="old:classic">接續原版故事</button><button data-river="old:about">關於與存檔</button></div>`);
    } else if(screen==='notes') {
      setIntro('渡口小冊 · 隨手記','那些想留下的話');
      setDock(`${back}<div class="river-notes">${p.notes.length?p.notes.slice().reverse().map(n=>`<p>${safe(n.text)}</p>`).join(''):'<p>小冊還留著白。想寫的時候再寫就好。</p>'}</div>${buttons([['book','回到小冊'],['old:life','看看原來的生活紀錄']])}`);
    } else {render('home');return;}
    $('riverTitle')?.focus({preventScroll:true});keyboardLayout();
  }
  function shoreText(action){return {tea:'茶是溫的。你握著杯子，聽水聲慢慢過去。',greeting:'「今天辛苦了。」船家笑著點頭，往旁邊挪出一個位置。',sit:'你在岸邊坐下。小貓伸了個懶腰，河水繼續流。'}[action];}
  function release() {
    if(journey().active?.phase!=='release')return;
    if(!save(C.advance(api.getState(),'shore')))return;
    render('shore');$('floatingLantern').className='river-floating drifting';
  }
  function begin(story=null) {
    if(!save(C.begin(api.getState(),story,api.day())))return;
    render(journey().active.phase);
  }
  function handle(action) {
    if(action==='home'){render('home');return;}
    if(action==='resume'){render(journey().active?.phase||'home');return;}
    if(action==='begin'){begin();return;}
    if(action.startsWith('story:')){selected=action.slice(6);render('encounter');return;}
    if(action==='storywish'){begin(selected);return;}
    if(action==='see'){
      if(!save(C.draft(api.getState(),$('riverWish').value)))return;
      if(save(C.advance(api.getState(),'see')))render('see');return;
    }
    if(action==='ready'){if(save(C.advance(api.getState(),'release')))render('release');return;}
    if(action==='release'){if(!suppressedClick)release();return;}
    if(action.startsWith('act:')){const key=action.slice(4);if(save(C.act(api.getState(),key))){$('shoreResponse').textContent=shoreText(key);host.dataset.moment=key;}return;}
    if(action==='finish'||action==='finishnote'){
      const a=journey().active,note=action==='finishnote'?$('riverNote').value:null;
      if(save(C.finish(api.getState(),api.day(),note,stories[a?.story]?.later)))render('done');return;
    }
    if(action==='sip'){host.classList.toggle('sipping');toast('一口暖茶，水聲在旁。');return;}
    if(action.startsWith('old:')){api.open(action.slice(4));return;}
    if(['walk','tea','book','notes','note','shore'].includes(action))render(action);
  }
  function prepareUpdate() {
    if(!host || host.hidden)return true;
    if(host.querySelector('textarea'))return false;
    if(journey().active) {try{sessionStorage.setItem('du_ferry_river_resume','yes');}catch(_) {}}
    return true;
  }
  try{autoResume=sessionStorage.getItem('du_ferry_river_resume')==='yes';sessionStorage.removeItem('du_ferry_river_resume');}catch(_){}
  return {show,hide,prepareUpdate,isVisible:()=>Boolean(host&&!host.hidden)};
})();
