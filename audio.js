/* 《渡》聲音 —— 零音檔，Web Audio 即時生成
   禪風配樂：低吟持續音＋五聲音階撥音＋偶爾一聲鐘
   點擊音效：輕木魚一聲
   一鍵「音／默」總管兩者；偏好存 localStorage（與遊戲存檔分開，重起爐灶不影響） */
"use strict";

const ZenAudio = (() => {
  const PREF_KEY = "du_ferry_sound";
  let enabled = true;
  try { enabled = localStorage.getItem(PREF_KEY) !== "0"; } catch (e) {}

  let ctx = null;
  let musicBus = null;   // 配樂總量（開停淡入淡出）
  let sfxBus = null;     // 音效走自己的路，配樂停了點擊仍有聲
  let delaySend = null;  // 空間感（回聲匯流）
  let droneOscs = [];
  let schedTimer = null;
  let nextPluckAt = 0;
  let playing = false;

  // A 小調五聲，兩個八度（宮商角徵羽的空靈感）
  const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

  function ensureCtx() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(ctx.destination);

    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.46;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(musicBus);
    delaySend = delay;
    return true;
  }

  /* ---- 配樂 ---- */
  function startMusic() {
    if (!enabled || playing) return;
    if (!ensureCtx()) return;
    if (ctx.state === "suspended") ctx.resume();
    playing = true;

    const t = ctx.currentTime;

    // 低吟持續音：兩支微弱的低音，音量隨極慢的呼吸起伏
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.016;
    droneGain.connect(musicBus);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;          // 約 16 秒一個呼吸
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.006;
    lfo.connect(lfoDepth); lfoDepth.connect(droneGain.gain);
    lfo.start(t);

    const d1 = ctx.createOscillator(); d1.type = "triangle"; d1.frequency.value = 110;    // A2
    const d2 = ctx.createOscillator(); d2.type = "sine";     d2.frequency.value = 164.81; // E3
    const d2g = ctx.createGain(); d2g.gain.value = 0.6;
    d1.connect(droneGain);
    d2.connect(d2g); d2g.connect(droneGain);
    d1.start(t); d2.start(t);
    droneOscs = [d1, d2, lfo];

    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(0.9, t, 1.2);   // 緩緩浮現

    nextPluckAt = t + 1.5 + Math.random() * 2;
    schedTimer = setInterval(() => {
      if (!ctx || document.hidden) return;
      const now = ctx.currentTime;
      if (now >= nextPluckAt) {
        if (Math.random() < 0.12) bell(now);
        else pluck(now);
        nextPluckAt = now + 3.5 + Math.random() * 5.5;   // 稀疏，留白
      }
    }, 400);
  }

  function stopMusic() {
    if (!ctx || !playing) return;
    playing = false;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(0, t, 0.5);
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    const oscs = droneOscs; droneOscs = [];
    setTimeout(() => { oscs.forEach((o) => { try { o.stop(); } catch (e) {} }); }, 2200);
  }

  // 古琴式撥音：三角波＋一絲高八度，低通收圓，送一點回聲
  function pluck(t) {
    const f = SCALE[Math.floor(Math.random() * SCALE.length)];
    const o1 = ctx.createOscillator(); o1.type = "triangle"; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.003;
    const o2g = ctx.createGain(); o2g.gain.value = 0.25;
    const env = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500; lp.Q.value = 0.4;

    o1.connect(env);
    o2.connect(o2g); o2g.connect(env);
    env.connect(lp);
    lp.connect(musicBus);
    lp.connect(delaySend);

    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.085, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0004, t + 2.6);
    o1.start(t); o2.start(t);
    o1.stop(t + 2.8); o2.stop(t + 2.8);
  }

  // 遠鐘：基音＋不諧和泛音，長長散去
  function bell(t) {
    const f = 146.83;   // D3
    [[1, 0.05], [2.756, 0.018]].forEach(([ratio, amp]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * ratio;
      const g = ctx.createGain();
      o.connect(g); g.connect(musicBus); g.connect(delaySend);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0003, t + 6);
      o.start(t); o.stop(t + 6.2);
    });
  }

  /* ---- 沉浸靜坐音場 ---- */
  let riverNodes = null;
  let binauralNodes = null;

  // 河聲：生成的褐噪音過低通，加極慢的水勢起伏（零音檔）
  function startRiver() {
    if (!enabled || riverNodes) return;
    if (!ensureCtx()) return;
    if (ctx.state === "suspended") ctx.resume();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.014;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(sfxBus);
    g.gain.setTargetAtTime(0.055, ctx.currentTime, 1.8);
    src.start(); lfo.start();
    riverNodes = { src, lfo, g };
  }
  function stopRiver() {
    if (!riverNodes || !ctx) return;
    const n = riverNodes; riverNodes = null;
    n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
    setTimeout(() => { try { n.src.stop(); n.lfo.stop(); } catch (e) {} }, 1800);
  }

  // 入定聲：左右耳頻差 10Hz 的低鳴（戴耳機才有意義；不作任何療效宣稱）
  function startBinaural() {
    if (!enabled || binauralNodes) return;
    if (!ensureCtx()) return;
    if (ctx.state === "suspended") ctx.resume();
    const g = ctx.createGain(); g.gain.value = 0;
    const mk = (freq, side) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
      const p = ctx.createStereoPanner(); p.pan.value = side;
      o.connect(p); p.connect(g); o.start();
      return o;
    };
    const oL = mk(196, -1);
    const oR = mk(206, 1);
    g.connect(sfxBus);
    g.gain.setTargetAtTime(0.022, ctx.currentTime, 1.5);
    binauralNodes = { oL, oR, g };
  }
  function stopBinaural() {
    if (!binauralNodes || !ctx) return;
    const n = binauralNodes; binauralNodes = null;
    n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    setTimeout(() => { try { n.oL.stop(); n.oR.stop(); } catch (e) {} }, 1500);
  }

  /* ---- 點擊音效：輕木魚一聲 ---- */
  function tick() {
    if (!enabled) return;
    if (!ensureCtx()) return;
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(740, t);
    o.frequency.exponentialRampToValueAtTime(430, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.09);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + 0.12);
  }

  /* ---- 功能鍵 ---- */
  function updateBtn() {
    const b = document.getElementById("btnSound");
    if (!b) return;
    b.textContent = enabled ? "音" : "默";
    b.setAttribute("aria-label", enabled ? "聲音：開（點擊轉靜默）" : "聲音：關（點擊開聲）");
    b.classList.toggle("muted", !enabled);
  }

  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem(PREF_KEY, enabled ? "1" : "0"); } catch (e) {}
    updateBtn();
    if (enabled) startMusic();   // 點擊本身就是手勢，瀏覽器允許出聲
    else stopMusic();
  }

  function init() {
    updateBtn();
    const b = document.getElementById("btnSound");
    if (b) b.addEventListener("click", (e) => { e.stopPropagation(); toggle(); if (enabled) tick(); });

    // 任何按鈕點擊：木魚一聲；且首次手勢順勢把配樂帶起來
    document.addEventListener("click", (e) => {
      if (!e.target.closest("button")) return;
      if (e.target.closest("#btnSound")) return;
      if (enabled && !playing) startMusic();
      tick();
    }, true);

    // 頁面離開就靜，回來再續（省電、不發燙）
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) { if (ctx.state === "running") ctx.suspend(); }
      else if (enabled && playing && ctx.state === "suspended") ctx.resume();
    });
  }

  return { init, tick, toggle, startRiver, stopRiver, startBinaural, stopBinaural };
})();

document.addEventListener("DOMContentLoaded", ZenAudio.init);
if (document.readyState !== "loading") ZenAudio.init();
