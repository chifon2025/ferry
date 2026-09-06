/* Heartlight: one gesture, local preferences, original recorded synthesis. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const garden = $('garden'), heart = $('heart'), panel = $('functionPanel');
  const music = $('music');
  const MASTER = 'du_ferry_sound', MIX = 'du_ferry_audio_v2', PREFS = 'du_ferry_heartlight_v1';
  const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const parse = raw => { try { return JSON.parse(raw) || {}; } catch (_) { return {}; } };
  const clamp = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  let enabled = !['0','off','false'].includes(String(read(MASTER)).toLowerCase());
  let storedMix = parse(read(MIX));
  let mix = {music:clamp(storedMix.music,.45), effects:clamp(storedMix.effects,.6), riverOnly:storedMix.riverOnly === true};
  let storedPrefs = parse(read(PREFS));
  let prefs = {tap:storedPrefs.tap === true, reminder:storedPrefs.reminder !== false};
  let activePointer = null, activeKey = null, held = false, settleTimer = null;
  let installPrompt = null, effectContext = null, soundStarted = false, lastEffect = -Infinity;
  let installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const effectiveSound = () => enabled && !mix.riverOnly;

  function persist(key, value) {
    try { localStorage.setItem(key, value); }
    catch (_) { $('soundStatus').textContent = '本次設定已生效，這台裝置暫時無法記住。'; }
  }
  function saveMix() {
    // Preserve old ambience and unknown future keys without loading old sound code.
    const previous = parse(read(MIX));
    persist(MIX, JSON.stringify({...previous, ...mix}));
  }
  function soundUI() {
    $('btnSound').setAttribute('aria-pressed', String(effectiveSound()));
    $('btnSound').setAttribute('aria-label', effectiveSound() ? '關閉音樂音效' : '開啟音樂音效');
    $('soundToggle').textContent = effectiveSound() ? '開' : '靜';
    $('soundState').textContent = effectiveSound() ? '回暖 · 溫柔的琴聲' : '安靜也很好';
    $('musicVolume').value = String(Math.round(mix.music * 100));
    $('effectVolume').value = String(Math.round(mix.effects * 100));
    music.volume = mix.music;
  }
  async function startSound() {
    soundStarted = true;
    if (!effectiveSound() || document.hidden || mix.music === 0) return;
    music.volume = mix.music;
    try {
      await music.play();
      if (!effectiveSound() || document.hidden || mix.music === 0) music.pause();
      else $('soundStatus').textContent = '原創配樂《回暖》';
    } catch (_) { $('soundStatus').textContent = '琴聲暫時未能播放，可以再碰一下心燈。'; }
  }
  function releaseSound() {
    if (!effectiveSound() || document.hidden || mix.effects === 0) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      effectContext ||= new AC();
      if (effectContext.state === 'suspended') effectContext.resume().catch(() => {});
      const t = effectContext.currentTime;
      if (t - lastEffect < .3) return;
      lastEffect = t;
      for (const [f, amplitude] of [[349.228,.018],[523.251,.004]]) {
        const oscillator = effectContext.createOscillator(), gain = effectContext.createGain();
        oscillator.frequency.value = f;
        gain.gain.setValueAtTime(0,t);
        gain.gain.linearRampToValueAtTime(amplitude * mix.effects,t+.025);
        gain.gain.exponentialRampToValueAtTime(.00001,t+1.15);
        oscillator.connect(gain);gain.connect(effectContext.destination);
        oscillator.onended = () => { oscillator.disconnect();gain.disconnect(); };
        oscillator.start(t);oscillator.stop(t+1.2);
      }
    } catch (_) { /* The gesture remains available without audio support. */ }
  }
  function stopEffects() {
    const context = effectContext;
    effectContext = null;lastEffect = -Infinity;
    context?.close().catch(() => {});
  }
  function render(state) {
    garden.dataset.state = state;
    heart.setAttribute('aria-pressed',String(state === 'held'));
    const messages = {rest:'心裡的事，先放在這裡',held:'想抓住的，想推開的',released:'都可以，先鬆一點'};
    $('heartMessage').textContent = messages[state];
    $('heartMessage').hidden = !prefs.reminder;
    $('gestureHint').textContent = state === 'held' ? (prefs.tap ? '再點一下，鬆開' : '隨時都能鬆手') : state === 'released' ? '帶著這份鬆，回到生活' : prefs.tap ? '輕點心燈，收攏再鬆開' : '按住，再鬆開';
    $('quietLine').textContent = state === 'released' ? '還放不下，也不用逼自己' : '隨時都可以';
    heart.setAttribute('aria-label',prefs.tap ? (held ? '鬆開心燈' : '收攏心燈') : '心燈，按住再鬆開');
  }
  function begin() {
    clearTimeout(settleTimer);
    held = true;
    render('held');
    startSound();
  }
  function release() {
    if (!held) return;
    held = false;
    render('released');
    releaseSound();
    $('heartAnnouncement').textContent = '都可以，先鬆一點。';
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { render('rest');$('heartAnnouncement').textContent = ''; },4200);
  }
  function cancel() {
    clearTimeout(settleTimer);
    const pointer = activePointer;
    activePointer = null;activeKey = null;held = false;
    if (pointer !== null && heart.hasPointerCapture?.(pointer)) heart.releasePointerCapture(pointer);
    render('rest');
    $('heartAnnouncement').textContent = '';
  }
  heart.addEventListener('pointerdown', event => {
    if (prefs.tap || activePointer !== null || activeKey !== null || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    activePointer = event.pointerId;
    heart.setPointerCapture?.(event.pointerId);
    begin();
  });
  heart.addEventListener('pointerup', event => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    if (heart.hasPointerCapture?.(event.pointerId)) heart.releasePointerCapture(event.pointerId);
    release();
  });
  heart.addEventListener('pointercancel', event => { if (event.pointerId === activePointer) cancel(); });
  heart.addEventListener('lostpointercapture', event => { if (event.pointerId === activePointer) cancel(); });
  heart.addEventListener('contextmenu', event => event.preventDefault());
  heart.addEventListener('keydown', event => {
    if (![' ','Enter'].includes(event.key) || prefs.tap) return;
    event.preventDefault();
    if (event.repeat || activeKey !== null || activePointer !== null) return;
    activeKey = event.key;begin();
  });
  heart.addEventListener('keyup', event => {
    if (prefs.tap || activeKey !== event.key) return;
    event.preventDefault();activeKey = null;release();
  });
  heart.addEventListener('click', event => {
    if (prefs.tap) { held ? release() : begin(); }
    else if (event.detail === 0 && !held && activeKey === null) {
      // Assistive technology's synthetic click offers an equivalent one-shot gesture.
      begin();release();
    }
  });
  heart.addEventListener('blur', () => { if (activeKey !== null) cancel(); });
  window.addEventListener('blur', () => { if (held) cancel(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancel();music.pause();stopEffects(); }
    else if (soundStarted) startSound();
  });
  window.addEventListener('pagehide', () => { cancel();music.pause();stopEffects(); });
  window.addEventListener('pageshow', () => { if (soundStarted) startSound(); });

  $('btnMenu').addEventListener('click', () => { cancel();panel.showModal();$('btnMenu').setAttribute('aria-expanded','true'); });
  $('functionClose').addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => { $('btnMenu').setAttribute('aria-expanded','false');$('btnMenu').focus(); });
  panel.addEventListener('click', event => {
    if (event.target !== panel) return;
    const bounds = panel.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) panel.close();
  });
  $('btnSound').addEventListener('click', () => {
    enabled = !effectiveSound();
    if (enabled) { mix.riverOnly = false;saveMix(); }
    persist(MASTER,enabled ? '1' : '0');soundUI();
    if (enabled) startSound();else { music.pause();stopEffects(); }
  });
  for (const [id,key] of [['musicVolume','music'],['effectVolume','effects']]) {
    $(id).addEventListener('input', event => {
      mix[key] = clamp(Number(event.target.value)/100,0);
      saveMix();soundUI();
      if (effectiveSound()) { if (mix.music === 0) music.pause();else startSound(); }
    });
  }
  $('tapMode').checked = prefs.tap;
  $('reminderMode').checked = prefs.reminder;
  for (const [id,key] of [['tapMode','tap'],['reminderMode','reminder']]) $(id).addEventListener('change',event => {
    cancel();prefs[key] = event.target.checked;persist(PREFS,JSON.stringify(prefs));render('rest');
  });
  window.addEventListener('storage',event => {
    if (event.key === MASTER) enabled = !['0','off','false'].includes(String(event.newValue).toLowerCase());
    else if (event.key === MIX) {
      const value = parse(event.newValue);
      mix = {music:clamp(value.music,.45),effects:clamp(value.effects,.6),riverOnly:value.riverOnly === true};
    } else if (event.key === PREFS) {
      const value = parse(event.newValue);prefs = {tap:value.tap === true,reminder:value.reminder !== false};
      $('tapMode').checked = prefs.tap;$('reminderMode').checked = prefs.reminder;cancel();return;
    } else return;
    soundUI();
    if (!effectiveSound() || mix.music === 0) { music.pause();stopEffects(); }
    else if (soundStarted) startSound();
  });

  function installUI() { $('installStatus').textContent = installed ? '已可從主畫面直接開啟' : installPrompt ? '點一下，安裝到主畫面' : '放在主畫面，想用就打開'; }
  function installGuide() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/.test(navigator.userAgent);
    $('installGuide').hidden = false;
    $('installText').textContent = installed ? '《渡》已安裝，回到手機主畫面點「渡」即可開啟。' : ios ? '用 Safari 開啟《渡》，點「分享」，選「加入主畫面」，再點「加入」。若有「以網頁 App 打開」，請保持開啟。' : android ? '用 Chrome 開啟《渡》，點右上角選單，選「安裝應用程式」或「加到主畫面」，依畫面完成安裝。' : '手機：iPhone 用 Safari 的「分享 → 加入主畫面」；Android 用 Chrome 選單的「安裝應用程式」。電腦可使用瀏覽器網址列的安裝功能。';
  }
  window.addEventListener('beforeinstallprompt',event => { event.preventDefault();installPrompt = event;installUI(); });
  window.addEventListener('appinstalled',() => { installed = true;installPrompt = null;installUI(); });
  $('btnMenuInstall').addEventListener('click',async () => {
    if (installed || !installPrompt) return installGuide();
    const prompt = installPrompt;installPrompt = null;
    try { await prompt.prompt();await prompt.userChoice; }
    catch (_) { installGuide(); }
    installUI();
  });
  // The updater can safely reload this screen; there is no text-entry draft.
  window.FerryHeartlight = {prepareUpdate:() => { cancel();return true; }};
  soundUI();installUI();render('rest');
})();
