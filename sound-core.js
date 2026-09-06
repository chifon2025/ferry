/* Original procedural sound palette. No recordings, network assets or health claims. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FerrySound=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const defaults={music:.45,ambience:.7,effects:.6,riverOnly:false};
  // Quiet source calibration also applies to existing saved mixer levels.
  const WATER_LEVEL=.10,WIND_LEVEL=.025;
  const motifs=[[0,2,4,2,1],[0,1,2,4,2],[4,2,1,0]],scale=[293.665,329.628,391.995,440,523.251];
  function settings(raw){
    let data;try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch(_){data=null;}
    const value={...defaults};if(data&&typeof data==='object'){
      for(const key of ['music','ambience','effects'])if(typeof data[key]==='number'&&Number.isFinite(data[key]))value[key]=Math.max(0,Math.min(1,data[key]));value.riverOnly=data.riverOnly===true;
    }return value;
  }
  function enabled(raw){return !['0','off','false'].includes(String(raw).toLowerCase());}
  function create(ctx){
    const master=ctx.createGain(),music=ctx.createGain(),ambience=ctx.createGain(),effects=ctx.createGain();
    master.gain.value=0;master.connect(ctx.destination);for(const bus of [music,ambience,effects])bus.connect(master);
    const water=ctx.createGain(),wind=ctx.createGain();water.connect(ambience);wind.connect(ambience);water.gain.value=WATER_LEVEL;wind.gain.value=WIND_LEVEL;
    const sources=[],active=new Set(),buffers=new Map();let running=false,currentScene='home',prefs={...defaults},on=true,binauralNodes=null;
    function ramp(param,value,time=.25){const t=ctx.currentTime;if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);else {const old=param.value;param.cancelScheduledValues(t);param.setValueAtTime(old,t);}param.setTargetAtTime(value,t,time);}
    function mix(value,isOn=true){prefs=settings(value);on=isOn;const quiet=['shore','note','done'].includes(currentScene);
      ramp(master.gain,on?.8:0,.1);ramp(music.gain,prefs.riverOnly?0:prefs.music*(quiet?.035:currentScene==='see'?.38:.75),quiet?1.3:.7);
      ramp(ambience.gain,prefs.ambience,.5);ramp(effects.gain,prefs.riverOnly?0:prefs.effects,.1);ramp(wind.gain,prefs.riverOnly?0:WIND_LEVEL,.6);
    }
    function scene(name){currentScene=name;mix(prefs,on);}
    function noise(seconds=4){
      if(buffers.has(seconds))return buffers.get(seconds);
      const b=ctx.createBuffer(1,Math.round(ctx.sampleRate*seconds),ctx.sampleRate),d=b.getChannelData(0);let brown=0;
      for(let i=0;i<d.length;i++){brown=(brown+.035*(Math.random()*2-1))/1.035;d[i]=brown*3.4;}
      const fade=Math.min(1024,Math.floor(d.length/10));for(let i=0;i<fade;i++){const t=i/fade;d[i]*=t;d[d.length-1-i]*=t;}
      buffers.set(seconds,b);return b;
    }
    function continuous(freq,level,speed,bus,seconds){
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),lfo=ctx.createOscillator(),depth=ctx.createGain();
      source.buffer=noise(seconds);source.loop=true;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.45;gain.gain.value=level;
      lfo.frequency.value=speed;depth.gain.value=level*.22;lfo.connect(depth);depth.connect(gain.gain);source.connect(filter);filter.connect(gain);gain.connect(bus);
      source.start();lfo.start();sources.push(source,lfo);
    }
    function startAmbience(){if(running)return;running=true;continuous(550,.55,.09,water,7);continuous(1050,.10,.17,water,5);continuous(1200,.12,.055,wind,9);}
    function cleanup(source,nodes){active.add(source);source.onended=()=>{active.delete(source);for(const node of [source,...nodes])try{node.disconnect();}catch(_){}};}
    function tone(f,t,duration,volume,bus=effects,type='sine',endFrequency=null){
      const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(endFrequency)o.frequency.exponentialRampToValueAtTime(endFrequency,t+duration);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.014);g.gain.exponentialRampToValueAtTime(.00001,t+duration);o.connect(g);g.connect(bus);cleanup(o,[g]);o.start(t);o.stop(t+duration+.03);
    }
    function rustle(t,duration,volume,freq=1500,bus=effects){
      const s=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise(2);filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.65;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+Math.min(.07,duration/3));g.gain.exponentialRampToValueAtTime(.00001,t+duration);
      s.connect(filter);filter.connect(g);g.connect(bus);cleanup(s,[filter,g]);s.start(t);s.stop(t+duration+.02);
    }
    function pluck(f,t){tone(f,t,2.8,.09,music,'triangle');tone(f*2.002,t,1.6,.018,music);tone(f,t+.19,2,.015,music);}
    function phrase(index=0,at=ctx.currentTime){motifs[index%motifs.length].forEach((n,i)=>pluck(scale[n],at+i*.82));}
    function creak(){tone(210,ctx.currentTime,.4,.022,ambience,'triangle',255);}
    function effect(kind,at=ctx.currentTime){
      if(kind==='paper'){rustle(at,.35,.2,2300);rustle(at+.18,.4,.12,1600);}
      else if(kind==='mail'){tone(310,at,.13,.055,effects,'triangle',245);rustle(at+.1,.26,.18,1500);rustle(at+.34,.45,.13,2400);}
      else if(kind==='tea'){
        rustle(at,.7,.3,1100);for(let i=0;i<5;i++)tone(650+i*55,at+i*.115,.085,.014,effects,'sine',420+i*30);
        tone(1120,at+.8,.25,.03);tone(1820,at+.8,.13,.007);
      }
      else if(kind==='release'){rustle(at,.5,.3,750);tone(390,at,.25,.025,effects,'sine',180);rustle(at+.22,.7,.15,1350);}
      else if(kind==='boat'){tone(210,at,.4,.025,effects,'triangle',255);rustle(at,.3,.065,800);}
      else if(kind==='sit'){rustle(at,.35,.12,1000);tone(235,at+.1,.17,.018,effects,'triangle',195);}
      else if(kind==='greeting'){rustle(at,.22,.06,900);tone(330,at,.13,.016,effects,'triangle');}
      else if(kind==='bell'){tone(293.665,at,3,.03);tone(809,at,2,.008);}
      else {tone(520,at,.065,.018,effects,'sine',360);}
    }
    // Compatibility for the old opt-in headphone scene; never enabled by the new journey.
    function binaural(start){if(binauralNodes){for(const n of binauralNodes){try{n.stop?.();n.disconnect();}catch(_){}}binauralNodes=null;}if(!start)return;
      binauralNodes=[];for(const [f,pan] of [[196,-1],[206,1]]){const o=ctx.createOscillator(),p=ctx.createStereoPanner(),g=ctx.createGain();o.frequency.value=f;p.pan.value=pan;g.gain.value=.009;o.connect(p);p.connect(g);g.connect(effects);o.start();binauralNodes.push(o,p,g);}
    }
    function dispose(){binaural(false);for(const s of [...sources,...active]){try{s.stop();s.disconnect();}catch(_){}}master.disconnect();active.clear();}
    return {mix,scene,startAmbience,phrase,effect,creak,binaural,dispose,levels:()=>({master:master.gain.value,music:music.gain.value,ambience:ambience.gain.value,effects:effects.gain.value,scene:currentScene,active:active.size})};
  }
  return {settings,enabled,defaults,motifs,create};
});
