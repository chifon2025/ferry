(() => {
  'use strict';
  const C=window.FerryFlowCore,L=window.FerryCardLayout,$=id=>document.getElementById(id),KEY='du_ferry_flow_v1',OLD_KEY='du_ferry_scenarios_v1';
  let state=C.create(),lastRaw=null,writable=true,conflict=false,selected=null,view=null,installPrompt=null;
  let readerText='',pages=[{text:'',start:0}],pageIndex=0,layoutTimer=0;
  function notice(text){$('saveStatus').textContent=text;$('saveNotice').hidden=false;}
  function restore(){
    try{
      lastRaw=localStorage.getItem(KEY);
      if(lastRaw!==null){const parsed=JSON.parse(lastRaw);state=C.restore(parsed);}
      else {const old=localStorage.getItem(OLD_KEY);if(old!==null){state=C.migrate(JSON.parse(old));if(state.legacy)notice('已保留這一局的進度；先接續原本的收尾，下一件事就是複選轉念。');}}
    }catch(_){writable=false;notice('無法讀取或辨識這份情境進度。本次可試玩，但不會覆寫原資料。');}
  }
  function save(next){
    if(conflict)return false;
    if(!writable){state=next;return true;}
    try{
      if(localStorage.getItem(KEY)!==lastRaw){conflict=true;notice('另一個分頁已更新情境。請先讀取最新進度，再繼續。');$('loadLatest').hidden=false;return false;}
      const raw=JSON.stringify(C.snapshot(next));localStorage.setItem(KEY,raw);lastRaw=raw;state=next;return true;
    }catch(_){writable=false;state=next;notice('這台裝置暫時無法保存。仍可試玩，但關閉後可能需要重新開始。');return true;}
  }
  function paintPage(){
    $('storyText').textContent=pages[pageIndex].text;
    $('pageCount').textContent=(pageIndex+1)+' / '+pages.length;
    $('pagePrev').disabled=pageIndex===0;$('pageNext').disabled=pageIndex===pages.length-1;
  }
  function fitReader(){
    const height=$('reader').clientHeight;if(!height)return;
    const offset=pages[pageIndex]?.start||0;
    pages=L.paginate(readerText,text=>{$('storyText').textContent=text;return $('storyText').scrollHeight<=height;});
    pageIndex=L.pageAt(pages,offset);paintPage();
  }
  function syncViewport(){
    const viewport=window.visualViewport;
    // Pinch zoom is a magnification, not a new layout height. Keep it usable.
    if(viewport?.scale&&Math.abs(viewport.scale-1)>.05)return;
    const heights=[window.innerHeight,viewport?.height].filter(n=>Number.isFinite(n)&&n>0);
    if(!heights.length)return;
    const height=Math.floor(Math.min(...heights));
    $('game').style.setProperty('--app-height',height+'px');
    $('menu').style.setProperty('--app-height',height+'px');
    $('game').dataset.compact=String(height<640);
  }
  function scheduleLayout(){clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>{syncViewport();fitReader();},30);}
  function showScene(scene,label,back=false){
    readerText=scene.text;pages=[{text:readerText,start:0}];pageIndex=0;
    $('sceneTitle').textContent=scene.title;$('stageLabel').textContent=label;$('backStory').hidden=!back;
    paintPage();fitReader();
  }
  function focusScene(){ $('sceneTitle').focus({preventScroll:true});$('announcement').textContent=$('sceneTitle').textContent; }
  function baseScene(){
    const scene=C.sceneFor(state);
    return state.phase==='ending'?{title:scene.title,text:scene.text+'\n\n帶回日常\n'+C.caseFor(state).carry}:scene;
  }
  function phaseLabel(){if(state.phase==='flip'&&C.caseFor(state).release)return '② 容許感受 · 鬆開一點';return {scene:'① 認出第一反應',flip:'② 翻牌 · 看見在意',response:'③ 選眼前的一步',ending:'做完，先到這裡'}[state.phase];}
  function syncReactions(){
    if(state.phase!=='scene')return;
    for(const [i,button] of Array.from($('hand').children).entries()){
      const checked=state.reactions.includes(C.caseFor(state).reactions[i].id);
      button.setAttribute('aria-pressed',String(checked));button.children[0].textContent=checked?'✓':'□';
    }
    $('confirm').textContent=state.reactions.length?'翻牌看看 · 已選 '+state.reactions.length+' 句':'都不像，先略過';
  }
  function render(focus=false){
    selected=null;view=null;$('game').classList.remove('is-reflection');
    const ch=C.caseFor(state),index=C.phases.indexOf(state.phase);
    $('game').dataset.landscape=ch.landscape;$('game').dataset.phase=state.phase;
    $('chapterName').textContent='情境 '+ch.id.slice(1)+' · '+ch.categoryName;
    $('ageLabel').textContent='500 種生活片刻';
    $('landscapeCaption').textContent='光，一直都在';
    document.title='渡 · '+ch.title;
    $('journeyTrack').replaceChildren();
    for(let i=0;i<C.phases.length;i++){const dot=document.createElement('span');dot.className=i===index?'current':i<index?'past':'';$('journeyTrack').append(dot);}
    const active=['scene','response'].includes(state.phase);
    $('reflectionTools').hidden=state.phase!=='response';$('choicesArea').hidden=!active;
    $('endingTools').hidden=state.phase!=='ending';
    $('mirror').setAttribute('aria-pressed','false');$('timeLens').setAttribute('aria-pressed','false');
    $('mirror').textContent='◇ 照一照心裡';$('timeLens').textContent='↗ 往後看看';
    $('instruction').textContent=state.phase==='response'?(state.legacy?'接續原本這一局，選下一步':'選做法，再按確認看後續'):'哪些像第一反應？可複選，再點可取消';
    $('hand').replaceChildren();
    for(const [i,card] of C.choicesFor(state).entries()){
      const button=document.createElement('button');button.className='choice';button.type='button';button.setAttribute('aria-pressed','false');
      const number=document.createElement('span');number.className='number';number.textContent='0'+(i+1);number.setAttribute('aria-hidden','true');
      const title=document.createElement('b');title.textContent=card.title;button.append(number,title);button.setAttribute('aria-label',state.phase==='scene'?card.title:card.title+'。'+card.text);
      button.addEventListener('click',()=>{
        if(conflict||view)return;if(state.phase==='scene'){state=C.transition(state,{type:'choose',id:card.id});syncReactions();return;}selected=card.id;
        for(const peer of $('hand').children)peer.setAttribute('aria-pressed',String(peer===button));
        $('confirm').disabled=false;$('confirm').textContent='就這樣做 · 看後續';
        showScene({title:card.title,text:card.text+'\n\n這是你準備做的一步。按下方確認，才會看見這一步的後續。'},'選牌 · 尚未確認',true);
      });$('hand').append(button);
    }
    $('confirm').disabled=state.phase==='response';
    $('confirm').textContent={scene:'都不像，先略過',flip:ch.release?'帶著現在的自己，選下一步':'選眼前的一小步',response:'先選一個做法',ending:'再遇見一件事'}[state.phase];
    $('footerNote').textContent=writable?'反應不存檔；事情與行動進度留在這台裝置。':'本次暫不保存；關閉後可能需要重新開始。';
    syncReactions();$('backStory').textContent=state.phase==='flip'?'調整選擇':'回情境';showScene(baseScene(),phaseLabel(),state.phase==='flip');if(focus)focusScene();
  }
  function openReflection(kind){
    if(conflict||state.phase!=='response')return;
    if(view){closeView();return;}
    view=kind;const ch=C.caseFor(state);$('game').classList.add('is-reflection');
    $('choicesArea').hidden=true;$('confirm').disabled=false;$('confirm').textContent='帶著現在的自己，回情境';
    $('mirror').setAttribute('aria-pressed',String(kind==='mirror'));$('timeLens').setAttribute('aria-pressed',String(kind==='time'));
    $('mirror').textContent='回到情境';$('timeLens').textContent='回到情境';
    const scene=kind==='mirror'?{title:'鏡子不急著改變你',text:'也許，心裡有兩個方向。\n\n想要 · '+ch.mirror.want+'\n\n不想要 · '+ch.mirror.avoid+'\n\n只看看，哪一句碰到此刻的你。若都不像，也不用套在自己身上。\n\n不用消滅感覺，也不用聽從每一個念頭。還沒平靜，也能選下一步。'}:{title:'現在，不是永遠',text:'十年之後，這件事還會在我心裡嗎？\n\n也許會淡一些，也許仍然重要，也可以先不知道。\n\n把時間拉遠，不是說現在的難處不算什麼。事情可能有長久影響，生活也不只剩這一件事。\n\n'+ch.carry+'\n\n這只是換個距離看看，不是預告未來，也不會替你改變情境結果。'};
    showScene(scene,kind==='mirror'?'觀照 · 不需要答對':'時間卡 · 不用回答',true);focusScene();
  }
  function closeView(){
    view=null;$('game').classList.remove('is-reflection');
    $('choicesArea').hidden=!['scene','response'].includes(state.phase);
    $('mirror').setAttribute('aria-pressed','false');$('timeLens').setAttribute('aria-pressed','false');
    $('mirror').textContent='◇ 照一照心裡';$('timeLens').textContent='↗ 往後看看';
    if(['scene','response'].includes(state.phase)){$('confirm').disabled=!selected;$('confirm').textContent=selected?'就這樣做 · 看後續':'先選一張牌';}
    else {$('confirm').disabled=false;$('confirm').textContent='再遇見一件事';$('endingTools').hidden=false;}
    showScene(baseScene(),phaseLabel());focusScene();
  }
  function dispatch(e){if(conflict)return;const next=C.transition(state,e);if(next===state)return;if(['flip','back'].includes(e.type)){state=next;render(true);}else if(save(next))render(true);}
  function rest(){
    view='rest';$('endingTools').hidden=true;$('confirm').disabled=false;$('confirm').textContent='回到這一頁';
    showScene({title:'今天先走到這裡',text:'不必帶走所有道理。\n\n下次事情來了，若想起「先看看，再選一步」，就試試看；沒想起來，也可以事後再看。\n\n'+(writable?'這件事與行動進度已留在這台裝置；勾選的反應不會保存。現在可以關閉，想繼續時再回來。':'這次無法保存進度；關閉後可能需要重新開始。')},'停靠 · 不需要打卡',true);focusScene();
  }
  $('confirm').addEventListener('click',()=>{
    if(view){closeView();return;}
    if(state.phase==='scene')dispatch({type:state.reactions.length?'flip':'skip'});
    else if(state.phase==='flip')dispatch({type:'continue'});
    else if(state.phase==='ending')dispatch({type:'next'});
    else if(selected)dispatch({type:'choose',id:selected});
  });
  $('backStory').addEventListener('click',()=>view?closeView():state.phase==='flip'?dispatch({type:'back'}):showScene(baseScene(),phaseLabel()));
  $('mirror').addEventListener('click',()=>openReflection('mirror'));$('timeLens').addEventListener('click',()=>openReflection('time'));
  $('replay').addEventListener('click',()=>{if(!conflict&&state.phase==='ending'&&save(C.replay(state)))render(true);});
  $('rest').addEventListener('click',rest);
  $('pagePrev').addEventListener('click',()=>{if(pageIndex>0){pageIndex--;paintPage();}});
  $('pageNext').addEventListener('click',()=>{if(pageIndex<pages.length-1){pageIndex++;paintPage();}});
  window.addEventListener('resize',scheduleLayout);window.addEventListener('orientationchange',scheduleLayout);window.addEventListener('pageshow',scheduleLayout);
  window.visualViewport?.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('scroll',scheduleLayout);
  if(typeof ResizeObserver==='function')new ResizeObserver(scheduleLayout).observe($('reader'));
  document.fonts?.ready.then(scheduleLayout);
  $('menuOpen').addEventListener('click',()=>{$('chapterChoice').value=state.filter;$('menu').showModal();});
  $('menuClose').addEventListener('click',()=>$('menu').close());
  $('chapterStart').addEventListener('click',()=>{const id=$('chapterChoice').value;if(!conflict&&C.filters.includes(id)&&save(C.draw(state,id))){$('menu').close();render(true);}});
  $('chapterChoice').replaceChildren();
  for(const group of [{id:'all',name:'全部情境 · 隨機遇見'},...C.categories]){const option=document.createElement('option');option.value=group.id;option.textContent=group.name;$('chapterChoice').append(option);}
  $('dismissNotice').addEventListener('click',()=>{if(!conflict)$('saveNotice').hidden=true;});
  $('loadLatest').addEventListener('click',()=>{conflict=false;writable=true;lastRaw=null;state=C.create();$('saveNotice').hidden=true;$('loadLatest').hidden=true;restore();if(lastRaw===null&&writable)save(state);render(true);});
  window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){conflict=true;notice('另一個分頁已更新情境。請讀取最新進度再繼續。');$('loadLatest').hidden=false;}});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;$('installStatus').textContent='已加入主畫面，下次從這裡繼續情境。';});
  $('install').addEventListener('click',async()=>{
    if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();const c=await prompt.userChoice;$('installStatus').textContent=c.outcome==='accepted'?'正在加入主畫面。':'這次先不安裝，仍可繼續情境。';}catch(_){$('installStatus').textContent='請從瀏覽器選單選擇加入主畫面。';}}
    else $('installStatus').textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'請用 Safari 開啟，點「分享」→「加入主畫面」。':'請用手機 Chrome 選單，選「安裝應用程式」或「加入主畫面」。';
  });
  syncViewport();restore();if(lastRaw===null&&writable)save(state);render();
})();
