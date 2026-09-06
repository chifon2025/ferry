/* 河一直在流：只管理這一趟的心願，不評分、不追蹤願望是否實現。 */
(function(root, factory) {
  const api = factory();
  if(typeof module === 'object' && module.exports)module.exports = api;
  else root.RiverCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const phases = ['wish','see','release','shore'];
  function read(state) {
    const value = state.riverJourney;
    if(!value)return {version:1,active:null,encounters:[],notes:[],pending:[]};
    if(value.version!==1 || !Array.isArray(value.encounters) || !Array.isArray(value.notes) || !Array.isArray(value.pending))throw Error('這份渡口紀錄需要其他版本');
    if(value.active && (!phases.includes(value.active.phase) || typeof value.active.wish!=='string'))throw Error('這一趟的紀錄暫時無法讀取');
    return JSON.parse(JSON.stringify(value));
  }
  function change(state, fn) {
    const next = JSON.parse(JSON.stringify(state));
    next.riverJourney = read(state); fn(next.riverJourney); return next;
  }
  function begin(state, story, day) {
    return change(state,p=>{if(!p.active)p.active={phase:'wish',story:story||null,wish:'',day,shoreAction:null};});
  }
  function draft(state, wish) {
    return change(state,p=>{if(p.active?.phase==='wish')p.active.wish=String(wish).slice(0,120);});
  }
  function advance(state, target) {
    return change(state,p=>{const a=p.active;if(!a)return;
      if(phases.indexOf(target)===phases.indexOf(a.phase)+1)a.phase=target;
    });
  }
  function act(state, action) {
    return change(state,p=>{if(p.active?.phase==='shore' && ['tea','greeting','sit'].includes(action))p.active.shoreAction=action;});
  }
  function finish(state, day, note, later) {
    return change(state,p=>{
      const a=p.active;if(!a || a.phase!=='shore')return;
      if(note?.trim())p.notes.push({date:day,text:note.trim().slice(0,160)});
      if(a.story && !p.encounters.includes(a.story)) {
        p.encounters.push(a.story);
        if(later)p.pending.push({id:a.story,date:[day,a.day].sort().pop(),text:later});
      }
      p.active=null; // 心願只用於續接這一趟，結束後不建立願望追蹤表。
    });
  }
  function settle(state, day) {
    if(!state.riverJourney)return JSON.parse(JSON.stringify(state));
    const next=change(state,p=>{p.pending=p.pending.filter(item=>item.date>=day);});
    for(const item of read(state).pending.filter(item=>item.date<day)) {
      if(!next.letters.some(letter=>letter.riverId===item.id))next.letters.push({riverId:item.id,title:'渡口的後來',text:item.text,date:day,read:false});
    }
    return next;
  }
  return {read,begin,draft,advance,act,finish,settle};
});
