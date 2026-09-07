/* Isolated prototype: no access to game saves; sound preferences only. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),C=window.FerryBoatCore;
  const river=$('river'),helm=$('helm'),music=$('music'),menu=$('menu'),canvas=$('flow');
  const ctx=canvas.getContext('2d'),reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  let state=C.create(),started=false,paused=false,frame=0,last=0,renderTime=0;
  let input=0,pointer=null,keys=new Set(),pulseUntil=0,playEpoch=0,userAudio=false,installPrompt=null;
  let width=320,height=400,sound=false,mix={};
  const read=key=>{try{return localStorage.getItem(key);}catch(_){return null;}};
  const save=(key,value)=>{try{localStorage.setItem(key,value);}catch(_){$('audioStatus').textContent='此裝置暫時無法記住聲音設定。';}};
  function preferences(){
    try{const parsed=JSON.parse(read('du_ferry_audio_v2')||'{}');mix=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch(_){mix={};}
    sound=!['0','off','false'].includes(read('du_ferry_sound'))&&!mix.riverOnly;
    music.volume=typeof mix.music==='number'&&Number.isFinite(mix.music)?Math.max(0,Math.min(1,mix.music)):.45;
    $('volume').value=String(Math.round(music.volume*100));audioUI();
  }
  function audioUI(){$('sound').textContent='配樂《回暖》：'+(sound?'開':'關');$('sound').setAttribute('aria-pressed',String(sound));}
  function stopAudio(){playEpoch++;music.pause();}
  function startAudio(){
    if(!sound||!userAudio||document.hidden||paused||state.arrived)return;
    const epoch=++playEpoch;
    Promise.resolve(music.play()).then(()=>{if(epoch!==playEpoch||!sound||paused||document.hidden)music.pause();}).catch(()=>{
      if(epoch===playEpoch)$('audioStatus').textContent='配樂未能播放，可關閉再開啟重試。';
    });
  }
  function setInput(value){
    input=Math.max(-1,Math.min(1,value));
    const travel=Math.max(0,(helm.getBoundingClientRect().width-54)/2);
    $('thumb').style.transform=`translateX(${input*travel}px)`;
    helm.setAttribute('aria-valuenow',String(Math.round(input*100)));
    helm.setAttribute('aria-valuetext',input<-.1?'向左掌舵':input>.1?'向右掌舵':'隨水漂行');
  }
  function release(){
    const id=pointer;pointer=null;keys.clear();pulseUntil=0;setInput(0);
    if(id!==null&&helm.hasPointerCapture(id))helm.releasePointerCapture(id);
  }
  function usable(){return started&&!paused&&!document.hidden&&!state.arrived;}
  function render(){
    $('skiff').style.left=state.x*100+'%';$('skiff').style.top=state.y*100+'%';
    $('skiff').style.transform=`translate(-50%,-50%) rotate(${reduce.matches?0:state.angle}rad)`;
    if(!ctx)return;
    ctx.clearRect(0,0,width,height);
    ctx.strokeStyle='rgba(221,237,216,.32)';ctx.lineWidth=1.3;
    // Flow marks communicate the same lateral current used by the boat.
    for(let row=0;row<7;row++)for(let col=0;col<4;col++){
      const y=(row+.5)/7,x=(col+.5)/4;
      const dx=C.current(state.t,y)*width*2.4,dy=-10;
      const offset=reduce.matches?0:(state.t*9)%45;
      const px=x*width,py=(y*height-offset+height)%height;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+dx,py+dy);ctx.stroke();
    }
  }
  function resize(){
    release();const rect=river.getBoundingClientRect();width=rect.width;height=rect.height;
    const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);render();
  }
  function controls(enabled){$('left').disabled=!enabled;$('right').disabled=!enabled;helm.setAttribute('aria-disabled',String(!enabled));}
  function arrive(){
    release();controls(false);$('heading').textContent='這一趟，到了';$('sceneStatus').textContent=C.positionText(state);
    $('arrival').hidden=false;$('controlCaption').textContent='可以再走一趟，也可以先停在這裡。';stopAudio();$('again').focus();
  }
  function tick(now){
    frame=0;if(!usable()){last=0;return;}
    if(!last)last=now;
    const elapsed=(now-last)/1000;
    if(elapsed>=1/30){
      last=now;if(pulseUntil&&now>=pulseUntil){pulseUntil=0;setInput(0);}
      state=C.step(state,input,elapsed);
      if(now-renderTime>=(reduce.matches?100:30)){render();renderTime=now;}
      const message=C.positionText(state);if($('sceneStatus').textContent!==message)$('sceneStatus').textContent=message;
      if(state.arrived){render();arrive();return;}
    }
    frame=requestAnimationFrame(tick);
  }
  function run(){if(usable()&&!frame){last=0;frame=requestAnimationFrame(tick);}}
  function suspend(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;release();stopAudio();}
  function begin(){
    suspend();state=C.create();started=true;paused=false;userAudio=true;
    $('begin').hidden=true;$('arrival').hidden=true;$('heading').textContent='往燈火那邊去';
    $('controlCaption').textContent='拇指拖動船舵，也可以按左右鍵';
    controls(true);render();startAudio();run();helm.focus({preventScroll:true});
  }
  $('begin').addEventListener('click',begin);$('again').addEventListener('click',begin);
  helm.addEventListener('pointerdown',event=>{
    if(!usable()||pointer!==null||event.isPrimary===false||(event.button!==undefined&&event.button!==0))return;
    event.preventDefault();pointer=event.pointerId;keys.clear();pulseUntil=0;helm.setPointerCapture(pointer);helm.focus({preventScroll:true});move(event);
  });
  function move(event){if(event.pointerId!==pointer)return;const rect=helm.getBoundingClientRect();setInput((event.clientX-rect.left-rect.width/2)/Math.max(1,(rect.width-54)/2));}
  helm.addEventListener('pointermove',move);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])helm.addEventListener(type,event=>{if(event.pointerId===pointer)release();});
  helm.addEventListener('keydown',event=>{
    if(!usable())return;
    if(['ArrowLeft','ArrowRight',' ','Escape','Home'].includes(event.key)){
      event.preventDefault();if(!event.key.startsWith('Arrow')){release();return;}
      keys.add(event.key);pulseUntil=0;setInput((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0));
    }
  });
  helm.addEventListener('keyup',event=>{if(event.key.startsWith('Arrow')){event.preventDefault();keys.delete(event.key);setInput((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0));}});
  helm.addEventListener('blur',release);
  for(const [id,direction] of [['left',-1],['right',1]])$(id).addEventListener('click',()=>{if(usable()){release();setInput(direction);pulseUntil=performance.now()+700;}});
  $('menuOpen').addEventListener('click',()=>{paused=true;suspend();menu.showModal();});
  for(const id of ['menuClose','resume'])$(id).addEventListener('click',()=>menu.close());
  menu.addEventListener('close',()=>{paused=false;startAudio();run();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else{startAudio();run();}});
  window.addEventListener('blur',suspend);window.addEventListener('focus',()=>{startAudio();run();});
  window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',()=>{run();});
  window.addEventListener('resize',resize);
  $('sound').addEventListener('click',()=>{
    sound=!sound;userAudio=true;save('du_ferry_sound',sound?'1':'0');
    if(sound&&mix.riverOnly){mix.riverOnly=false;save('du_ferry_audio_v2',JSON.stringify(mix));}
    audioUI();if(!sound)stopAudio();else $('audioStatus').textContent='繼續遊玩時播放《回暖》。';
  });
  $('volume').addEventListener('input',()=>{music.volume=Number($('volume').value)/100;mix.music=music.volume;save('du_ferry_audio_v2',JSON.stringify(mix));});
  window.addEventListener('storage',event=>{if(['du_ferry_sound','du_ferry_audio_v2'].includes(event.key)||event.key===null){preferences();if(!sound)stopAudio();else startAudio();}});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;$('installStatus').textContent='已加入手機主畫面。試玩入口在首頁功能選單裡。';});
  $('install').addEventListener('click',async()=>{
    if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();await prompt.userChoice;$('installStatus').textContent='安裝後，從首頁功能選單開啟「小舟試玩」。';}catch(_){$('installStatus').textContent='可用瀏覽器選單加入主畫面。';}}
    else $('installStatus').textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'用 Safari 開啟，點「分享」→「加入主畫面」。安裝後從首頁功能選單開啟小舟試玩。':'用手機 Chrome 選單選「安裝應用程式」或「加入主畫面」。安裝後從首頁功能選單開啟小舟試玩。';
  });
  window.FerryHeartlight={prepareUpdate(){suspend();return true;}};
  document.querySelector('.destination').style.left=C.goal.x*100+'%';
  document.querySelector('.destination').style.top=C.goal.y*100+'%';
  preferences();resize();
})();
