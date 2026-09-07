(() => {
  'use strict';
  const C=window.FerryCardsCore,L=window.FerryCardLayout,$=id=>document.getElementById(id),KEY='du_ferry_cards_v1';
  let state=C.create(Math.random()<.5?0:1),selected=null,lastRaw=null,writable=true,conflict=false,installPrompt=null,turnTimer=0;
  let baseScene=null,readerText='',pages=[{text:'',start:0}],pageIndex=0,layoutTimer=0,practice=null;
  function paintPage(){
    $('storyText').textContent=pages[pageIndex].text;
    $('pageCount').textContent=(pageIndex+1)+' / '+pages.length;
    $('pagePrev').disabled=pageIndex===0;$('pageNext').disabled=pageIndex===pages.length-1;
  }
  function fitReader(){
    if($('sceneWrap').hidden)return;
    const height=$('reader').clientHeight;if(!height)return;
    const offset=pages[pageIndex]?.start||0;
    pages=L.paginate(readerText,text=>{$('storyText').textContent=text;return $('storyText').scrollHeight<=height;});
    pageIndex=L.pageAt(pages,offset);paintPage();
  }
  function showReader(scene,detail=false){
    readerText=scene.text;pages=[{text:readerText,start:0}];pageIndex=0;
    $('sceneTitle').textContent=scene.title;$('backStory').hidden=!detail;
    $('cardType').textContent=scene.type||(detail?'牌面詳情 · 尚未打出':'故事');
    paintPage();fitReader();
  }
  function showBase(){if(practice){closePractice();return;}showReader(baseScene);}
  function scheduleLayout(){clearTimeout(layoutTimer);layoutTimer=setTimeout(fitReader,30);}
  function read(){try{return localStorage.getItem(KEY);}catch(_){writable=false;return null;}}
  function restore(){
    lastRaw=read();if(!lastRaw)return;
    try{const parsed=JSON.parse(lastRaw);if(!C.valid(parsed))throw new Error('unknown');state=parsed;}
    catch(_){writable=false;$('saveStatus').textContent='原有進度格式暫時無法讀取；本次可試玩，但不會覆寫那份資料。';}
  }
  function save(next){
    if(!writable){state=next;return true;}
    try{
      if(localStorage.getItem(KEY)!==lastRaw){conflict=true;$('saveStatus').textContent='另一個分頁已改變進度。先讀取那一頁，再繼續。';$('loadLatest').hidden=false;return false;}
      const raw=JSON.stringify(next);localStorage.setItem(KEY,raw);lastRaw=raw;state=next;return true;
    }catch(_){writable=false;state=next;$('saveStatus').textContent='這台裝置暫時無法保存；你仍可以完成這段故事。';return true;}
  }
  function drawChoices(cards,type){
    const hand=$('hand');hand.replaceChildren();hand.dataset.count=String(cards.length);
    for(const card of cards){
      const button=document.createElement('button');button.type='button';button.className='choice';button.setAttribute('aria-pressed','false');
      const mark=document.createElement('span');mark.className='mark';mark.setAttribute('aria-hidden','true');mark.textContent=card.mark||'願';
      const title=document.createElement('b');title.textContent=card.title;
      button.setAttribute('aria-label',card.title+'。'+card.text);button.append(mark,title);
      button.addEventListener('click',()=>{
        if(conflict)return;selected={type,id:card.id};
        for(const peer of hand.children)peer.setAttribute('aria-pressed',String(peer===button));
        $('confirm').disabled=false;$('confirm').textContent=type==='wish'?'帶著這張心願，翻開故事':(type==='inner'?'選擇「':'打出「')+card.title+'」';
        $('choicePreview').textContent=card.preview||'';$('choicePreview').hidden=!card.preview;
        showReader({title:card.title,text:card.text+(card.preview?'\n\n'+card.preview:'')},true);
      });hand.append(button);
    }
    $('confirm').disabled=true;$('confirm').textContent='先選一張牌';
    $('choicePreview').textContent='';$('choicePreview').hidden=true;
  }
  function thought(){
    $('thought').setAttribute('aria-pressed',String(!!practice));
    $('thoughtText').textContent=practice?'回到故事，不必完成練習':'想要與不想要 · 翻開心裡的兩面';
    $('thoughtHint').textContent='看看想抓住的，也看看想推開的。可隨時離開，不影響故事結果。';
    $('thought').setAttribute('aria-label',$('thoughtText').textContent+'。'+$('thoughtHint').textContent);
  }
  function showPractice(){
    const p=C.reflectionFor(state),step=practice.step;
    $('sceneWrap').hidden=false;$('deck').hidden=true;$('choicesArea').hidden=false;$('endingActions').hidden=true;
    $('game').classList.add('inner-view');$('stageLabel').textContent='留一點空間';
    let scene,cards;
    if(step==='check'){
      scene={title:'此刻，有沒有不一樣？',type:'不需要答對',text:'兩面都看過了。\n\n'+(practice.held?'剛才有一面還不想碰，也可以。':'不必確認自己是否真的放下。')+'沒有變化不是失敗，也不用再做一次才准離開。\n\n接下來，你仍然可以選擇小禾眼前能做的事。'};
      cards=[{id:'lighter',title:'有鬆一點',text:'只是此刻的感覺，不必把它留住。'},{id:'same',title:'還是一樣',text:'不改答案，也不勉強自己再試。'},{id:'stop',title:'先到這裡',text:'不需要形容，直接回到故事。'}];
    }else{
      const want=step==='want';
      scene={title:want?'這一面，想抓住什麼？':'另一面，想推開什麼？',type:want?'內心卡 · 想要':'內心卡 · 不想要',text:'小禾心裡可能有一句：\n「'+p[step]+'」\n\n'+(practice.held?'剛才還不想鬆，也沒關係。\n\n':'')+p.question+'\n\n如果這句話也碰到你，只留意此刻的感覺。不需要分析出原因；不符合你，就陪小禾看看。\n\n能不能暫時鬆開一點「非得如此」？不是放棄心願，也不是把感覺趕走。'};
      cards=[{id:'loosen',title:'試著鬆一點',text:'讓這個念頭待著，暫時不用抓緊它或趕走它。'},{id:'keep',title:'現在還不行',text:'如實承認現在的感受，不需要逼自己放下。'},{id:'exit',title:'回到故事',text:'不完成練習也能繼續原本的選擇。'}];
    }
    drawChoices(cards,'inner');showReader(scene,true);$('backStory').textContent='回故事';thought();
    $('sceneTitle').focus({preventScroll:true});$('announcement').textContent=scene.title;
  }
  function closePractice(note){
    const previous=practice?.previous;practice=null;render();
    if(previous){
      const cards=previous.type==='wish'?C.wishes:previous.type==='action'?C.actionsFor(state):C.repliesFor(state);
      const index=cards.findIndex(c=>c.id===previous.id);
      if(index>=0){selected=previous;$('hand').children[index].setAttribute('aria-pressed','true');$('confirm').disabled=false;$('confirm').textContent='打出「'+cards[index].title+'」';$('choicePreview').textContent=cards[index].preview||'';$('choicePreview').hidden=!cards[index].preview;}
    }
    if(note&&state.phase!=='sealed')showReader(note,true);
    (state.phase==='sealed'?$('deck'):$('sceneTitle')).focus({preventScroll:true});
  }
  function advancePractice(id){
    if(!practice||conflict)return;
    if(id==='exit'){closePractice();return;}
    if(practice.step==='check'){
      const text=id==='lighter'?'留意這一點變化就好，不必保持它，也不代表事情一定照期待發展。':id==='same'?'感覺還是一樣，也能繼續。你不需要換答案或逼自己平靜。':'這次先到這裡，不必替自己的感受下結論。';
      closePractice({title:'帶著現在的自己，繼續',type:'回到眼前',text:text+'\n\n'+C.reflectionFor(state).carry+'\n\n故事與原本選的行動都還在。'});return;
    }
    practice.held=practice.held||id==='keep';practice.step=practice.step==='want'?'avoid':'check';showPractice();
  }
  function render(focus=false){
    practice=null;$('game').classList.remove('inner-view');
    selected=null;$('game').classList.toggle('story-end',state.phase==='ending');
    $('kept').hidden=!state.wish||state.phase==='ending';$('thought').hidden=!state.wish||state.phase==='ending';
    $('sceneWrap').hidden=state.phase==='sealed';$('deck').hidden=state.phase!=='sealed';
    $('choicesArea').hidden=['sealed','ending'].includes(state.phase);$('endingActions').hidden=state.phase!=='ending';$('restNote').hidden=true;
    $('afterText').hidden=true;$('footerNote').textContent=writable?'選牌，再翻開後續。隨時可以離開，進度留在這台裝置。':'本次暫不保存進度，仍然可以繼續試玩。';
    $('carried').hidden=true;$('playedPath').hidden=true;$('nextChapter').hidden=true;
    const chapter=C.chapterFor(state);$('chapterName').textContent=(C.chapters.indexOf(C.chapterId(state))+1)+' / '+C.chapters.length+' · '+chapter.title;document.title='渡 · '+chapter.title;
    if(state.wish)$('wishTag').textContent='心願 · '+C.wishes.find(c=>c.id===state.wish).title;
    thought();
    if(state.phase==='opening'){
      $('stageLabel').textContent='心願';$('cardType').textContent='心願牌';$('sceneTitle').textContent=chapter.opening.title;
      $('storyText').textContent=chapter.opening.text;
      $('instruction').textContent='選一張心願牌，陪小禾開始這一天。';drawChoices(C.wishes,'wish');
    }else if(state.phase==='action'){
      $('stageLabel').textContent='遇見變化';$('cardType').textContent='事件牌';$('sceneTitle').textContent=chapter.event.title;
      $('storyText').textContent=chapter.event.text;
      $('instruction').textContent='眼前可以先做什麼？選一張行動牌。';drawChoices(C.actionsFor(state),'action');
    }else if(state.phase==='sealed'){
      $('stageLabel').textContent='行動之後';$('instruction').textContent='';
      $('footerNote').textContent='你做了一個選擇。接下來的事情，還要翻開才知道。';
    }else if(state.phase==='response'){
      const next=C.aftermath(state);$('stageLabel').textContent='再看眼前';$('cardType').textContent='後續牌';$('sceneTitle').textContent=next.title;$('storyText').textContent=next.text;
      if(next.clue){$('carried').textContent=next.clue;$('carried').hidden=false;}
      $('instruction').textContent='這一步帶來了新的選擇。接下來怎麼做？';drawChoices(C.repliesFor(state),'reply');
    }else{
      const end=C.ending(state);$('stageLabel').textContent='今天先到這裡';$('cardType').textContent='這一頁的後來';$('sceneTitle').textContent=end.title;$('storyText').textContent=end.text;
      $('afterText').textContent=end.after+'\n\n帶回日常 · '+C.reflectionFor(state).carry;$('afterText').hidden=false;$('footerNote').textContent='心願還在。今天的安排，可以和原先想的不一樣。';
      $('playedPath').textContent='你走的這一段 · '+C.actionsFor(state).find(c=>c.id===state.action).title+' → '+C.repliesFor(state).find(c=>c.id===state.reply).title;$('playedPath').hidden=false;
      const next=C.nextChapter(state);$('nextChapter').hidden=!next;
      if(next)$('nextChapter').textContent='下一章 · '+C.chapterFor(next).title;
    }
    if(state.phase!=='sealed'){
      const extra=state.phase==='ending'?[$('afterText').textContent,$('playedPath').textContent,$('wishTag').textContent]:state.phase==='response'?[$('carried').hidden?'':$('carried').textContent]:state.phase==='action'?['心裡冒出一句：「'+chapter.thought+'」']:[];
      baseScene={title:$('sceneTitle').textContent,type:$('cardType').textContent,text:[$('storyText').textContent,...extra].filter(Boolean).join('\n\n')};showBase();
    }
    if(focus){
      $('announcement').textContent=state.phase==='sealed'?'行動已送出，點下一張牌看後續。':$('sceneTitle').textContent;
      (state.phase==='sealed'?$('deck'):$('sceneTitle')).focus({preventScroll:true});
      window.scrollTo({top:0,behavior:'instant'});
      clearTimeout(turnTimer);$('game').classList.remove('turning');void $('game').offsetWidth;$('game').classList.add('turning');
      turnTimer=setTimeout(()=>$('game').classList.remove('turning'),300);
    }
  }
  function dispatch(event){if(conflict)return;const next=C.transition(state,event);if(next!==state&&save(next))render(true);}
  $('confirm').addEventListener('click',()=>{if(selected){if(practice)advancePractice(selected.id);else dispatch(selected);}});
  $('deck').addEventListener('click',()=>dispatch({type:'reveal'}));
  $('thought').addEventListener('click',()=>{
    if(conflict||!state.wish||state.phase==='ending')return;
    if(practice){closePractice();return;}
    practice={step:'want',held:false,previous:selected};showPractice();
  });
  $('replay').addEventListener('click',()=>{if(state.phase==='ending'&&!conflict&&save(C.create(state.variant,C.chapterId(state))))render(true);});
  $('nextChapter').addEventListener('click',()=>{const next=C.nextChapter(state);if(next&&!conflict&&save(next))render(true);});
  $('rest').addEventListener('click',()=>{$('restNote').hidden=false;showReader({title:'故事先留在這裡',type:'隨時可以回來',text:'今天先到這裡。\n\n'+(writable?'這段進度已留在這台裝置。':'這次無法保存；關閉後可能需要重新開始。')+'想繼續時，再翻開就好。'},true);$('announcement').textContent='故事先留在這裡。';});
  $('menuOpen').addEventListener('click',()=>{$('chapterChoice').value=C.chapterId(state);$('game').classList.add('paused');$('menu').showModal();});
  $('menuClose').addEventListener('click',()=>$('menu').close());$('menu').addEventListener('close',()=>$('game').classList.remove('paused'));
  $('chapterStart').addEventListener('click',()=>{const id=$('chapterChoice').value;if(!conflict&&C.chapters.includes(id)&&save(C.create(state.variant,id))){$('menu').close();render(true);}});
  $('backStory').addEventListener('click',showBase);
  $('pagePrev').addEventListener('click',()=>{if(pageIndex>0){pageIndex--;paintPage();}});
  $('pageNext').addEventListener('click',()=>{if(pageIndex<pages.length-1){pageIndex++;paintPage();}});
  window.addEventListener('resize',scheduleLayout);
  window.visualViewport?.addEventListener('resize',scheduleLayout);
  if(typeof ResizeObserver==='function')new ResizeObserver(scheduleLayout).observe($('reader'));
  document.fonts?.ready.then(scheduleLayout);
  $('loadLatest').addEventListener('click',()=>{conflict=false;writable=true;state=C.create();$('saveStatus').textContent='';$('loadLatest').hidden=true;restore();render(true);});
  window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){conflict=true;$('saveStatus').textContent='另一個分頁已更新進度。讀取後可以繼續。';$('loadLatest').hidden=false;}});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;$('installStatus').textContent='已加入主畫面，下次可以從那裡開啟《渡》。';});
  $('install').addEventListener('click',async()=>{
    if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();const choice=await prompt.userChoice;$('installStatus').textContent=choice.outcome==='accepted'?'正在安裝到主畫面。':'這次先不安裝，仍可以在這裡遊玩。';}catch(_){$('installStatus').textContent='可從瀏覽器選單選擇加入主畫面。';}}
    else $('installStatus').textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'用 Safari 開啟，點「分享」→「加入主畫面」。':'用手機 Chrome 選單，選「安裝應用程式」或「加入主畫面」。';
  });
  $('chapterChoice').replaceChildren();
  for(const [index,id] of C.chapters.entries()){const option=document.createElement('option');option.value=id;option.textContent=(index+1)+' · '+C.chapterFor(C.create(0,id)).title;$('chapterChoice').append(option);}
  restore();if(!writable&&!$('saveStatus').textContent)$('saveStatus').textContent='此裝置無法保存進度，本次仍可試玩。';render();
})();
