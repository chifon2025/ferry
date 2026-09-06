/* Phone-first sound: sparse Zen-style strings and tactile actions. Water stays off. */
'use strict';
const ZenAudio=(()=>{
  const MASTER='du_ferry_sound',MIX='du_ferry_audio_v2';
  let enabled=true,prefs={...FerrySound.defaults},ctx=null,palette=null,timer=null,nextPhrase=0,phraseIndex=0,scene='home',initialized=false,lastEffect=-Infinity;
  try{enabled=FerrySound.enabled(localStorage.getItem(MASTER));prefs=FerrySound.settings(localStorage.getItem(MIX));}catch(_){}
  const $=id=>document.getElementById(id);
  function status(message){if($('soundStatus'))$('soundStatus').textContent=message;}
  function persist(master=false){try{
    const raw=JSON.stringify(prefs);localStorage.setItem(MIX,raw);if(localStorage.getItem(MIX)!==raw)throw Error('readback');
    if(master){localStorage.setItem(MASTER,enabled?'1':'0');if(localStorage.getItem(MASTER)!==(enabled?'1':'0'))throw Error('readback');}
    status(enabled?(prefs.riverOnly?'安靜模式：目前不播放聲音。':'聲音設定已記住，持續水聲已關閉。'):'目前全部靜音，音量設定仍保留。');
  }catch(_){status('本次調整已生效，但無法記住；重新開啟後可能恢復原設定。');}}
  function ui(){
    const b=$('btnSound');if(b){b.innerHTML='<span class="function-icon">♫</span><span><b>音樂音效</b><small>'+(enabled?'聲音已開啟，點此全部靜音':'目前全部靜音，點此開啟')+'</small></span><strong>'+(enabled?'開':'靜')+'</strong>';b.setAttribute('aria-pressed',String(enabled));b.setAttribute('aria-label',enabled?'全部聲音已開啟，點此靜音':'全部聲音已靜音，點此開啟');}
    for(const key of ['music','ambience','effects']){const el=$('sound-'+key);if(el)el.value=String(Math.round(prefs[key]*100));}
    $('soundRiverOnly')?.setAttribute('aria-pressed',String(enabled&&prefs.riverOnly));
    $('soundNormal')?.setAttribute('aria-pressed',String(enabled&&!prefs.riverOnly));
  }
  function apply(){palette?.mix(prefs,enabled);}
  function startTimer(){if(timer!==null)return;timer=setInterval(()=>{
    if(!ctx||ctx.state!=='running'||document.hidden||!enabled)return;
    if(ctx.currentTime>=nextPhrase){
      if(!prefs.riverOnly&&prefs.music>0&&!['shore','note','done'].includes(scene))palette.phrase(phraseIndex);
      if(!prefs.riverOnly&&prefs.ambience>0&&['home','walk'].includes(scene))palette.creak();
      phraseIndex++;nextPhrase=ctx.currentTime+27+(phraseIndex%3)*4;
    }
  },700);}
  function stopTimer(){if(timer!==null){clearInterval(timer);timer=null;}}
  function silence(){stopTimer();setTimeout(()=>{if(ctx&&!enabled)ctx.suspend().catch(()=>{});},450);}
  function unlock(){
    if(!enabled||document.hidden)return false;
    try{
      if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC){status('此瀏覽器不支援聲音，仍可安靜遊玩。');return false;}
        ctx=new AC();palette=FerrySound.create(ctx);palette.mix(prefs,enabled);palette.scene(scene);palette.startAmbience();nextPhrase=ctx.currentTime+1.5;}
      if(ctx.state==='suspended')ctx.resume().catch(()=>status('聲音尚未啟動，請再點一下畫面。'));
      startTimer();return true;
    }catch(_){status('聲音暫時無法啟動，遊戲仍可繼續。');return false;}
  }
  function effect(kind){if(!unlock()||prefs.riverOnly||prefs.effects===0)return;
    const t=ctx.currentTime;if(t-lastEffect<.07)return;lastEffect=t;palette.effect(kind);
  }
  function setScene(name){scene=name;palette?.scene(name);}
  function toggle(){enabled=!enabled;persist(true);ui();apply();if(enabled)unlock();else silence();}
  function preset(riverOnly){prefs=riverOnly?{...prefs,riverOnly:true,ambience:prefs.ambience||.7}:{...prefs,riverOnly:false};enabled=true;persist(true);ui();apply();unlock();}
  function init(){
    if(initialized)return;initialized=true;ui();
    $('btnSound')?.addEventListener('click',toggle);
    $('soundRiverOnly')?.addEventListener('click',()=>preset(true));$('soundNormal')?.addEventListener('click',()=>preset(false));
    for(const key of ['music','ambience','effects'])$('sound-'+key)?.addEventListener('input',event=>{
      prefs[key]=Number(event.target.value)/100;if(key!=='ambience')prefs.riverOnly=false;
      persist();ui();apply();if(enabled)unlock();
    });
    // Scene sounds fire only once, after the action/save succeeds.
    document.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b||b.closest('#soundSettings')||b.id==='btnSound')return;
      unlock();const action=b.dataset.river||'';
      if(['release','ready','sip','story:reply','act:tea','act:greeting','act:sit','old:mail','book','notes'].includes(action))return;
      effect(b.dataset.do==='mail'?'mail':'touch');
    },true);
    document.addEventListener('visibilitychange',()=>{
      if(!ctx)return;if(document.hidden){stopTimer();ctx.suspend().catch(()=>{});}else if(enabled)unlock();
    });
    window.addEventListener('storage',event=>{
      if(event.key===MASTER)enabled=FerrySound.enabled(event.newValue);
      else if(event.key===MIX)prefs=FerrySound.settings(event.newValue);else return;
      ui();apply();if(!enabled)silence();
    });
  }
  return {init,toggle,effect,setScene,tick:()=>effect('touch'),toll:()=>effect('bell'),ensureAmbience:unlock,
    deepIn:()=>setScene('shore'),deepOut:()=>setScene('home'),
    startBinaural:()=>{if(unlock())palette.binaural(true);},stopBinaural:()=>palette?.binaural(false)};
})();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ZenAudio.init,{once:true});else ZenAudio.init();
