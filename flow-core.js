/* Durable progress excludes transient emotional selections. Old rounds finish unchanged. */
(function(root){
  'use strict';
  const node=typeof module==='object'&&module.exports,D=node?require('./flow-data.js'):root.FerryFlowData,O=node?require('./scenario-core.js'):root.FerryScenarioCore;
  const ids=D.scenarios.map(c=>c.id),byId=new Map(D.scenarios.map(c=>[c.id,c])),filters=['all',...D.categories.map(c=>c.id)],phases=['scene','flip','response','ending'];
  const keys=['v','caseId','filter','phase','action','legacy','seen','reactions'];
  function caseFor(s){return byId.get(s.caseId);}
  function valid(s){
    if(!s||typeof s!=='object'||Array.isArray(s)||s.v!==1||Object.keys(s).length!==keys.length||Object.keys(s).some(k=>!keys.includes(k)))return false;
    const c=caseFor(s);if(!c||!filters.includes(s.filter)||(s.filter!=='all'&&c.category!==s.filter)||!phases.includes(s.phase))return false;
    if(!Array.isArray(s.seen)||!s.seen.includes(s.caseId)||s.seen.length>500||new Set(s.seen).size!==s.seen.length||s.seen.some(id=>!byId.has(id)))return false;
    if(!Array.isArray(s.reactions)||new Set(s.reactions).size!==s.reactions.length||s.reactions.some(id=>!c.reactions.some(r=>r.id===id)))return false;
    if(s.legacy!==null)return s.reactions.length===0&&O.valid(s.legacy)&&['response','ending'].includes(s.phase)&&s.legacy.phase===s.phase&&s.legacy.caseId===s.caseId&&s.legacy.filter===s.filter&&s.action===s.legacy.action&&s.seen.join()===s.legacy.seen.join();
    if(s.phase==='flip'&&!s.reactions.length)return false;
    return s.phase==='ending'?c.actions.some(a=>a.id===s.action):s.action===null;
  }
  function draw(previous=null,filter=previous?.filter||'all',random=Math.random){
    if(previous&&!valid(previous))throw new Error('Invalid state');if(!filters.includes(filter))throw new Error('Unknown filter');
    let seen=previous?[...previous.seen]:[];const pool=ids.filter(id=>filter==='all'||byId.get(id).category===filter),poolSet=new Set(pool),visited=new Set(seen);
    let available=pool.filter(id=>!visited.has(id));if(!available.length){seen=seen.filter(id=>!poolSet.has(id));available=pool.filter(id=>id!==previous?.caseId);}
    let n=random();if(!Number.isFinite(n))n=0;n=Math.max(0,Math.min(n,1-Number.EPSILON));const caseId=available[Math.floor(n*available.length)];
    return {v:1,caseId,filter,phase:'scene',action:null,legacy:null,seen:[...seen,caseId],reactions:[]};
  }
  function create(filter='all',random=Math.random){return draw(null,filter,random);}
  function replay(s){if(!valid(s))throw new Error('Invalid state');return {...s,phase:'scene',action:null,legacy:null,reactions:[],seen:[...s.seen]};}
  function migrate(old){if(!O.valid(old))throw new Error('Invalid old state');return {v:1,caseId:old.caseId,filter:old.filter,phase:old.phase,action:old.action,legacy:old.phase==='scene'?null:JSON.parse(JSON.stringify(old)),seen:[...old.seen],reactions:[]};}
  function snapshot(s){if(!valid(s))throw new Error('Invalid state');const {reactions,...saved}=s;return {...saved,phase:s.phase==='flip'?'scene':s.phase};}
  function restore(saved){if(!saved||typeof saved!=='object'||Object.hasOwn(saved,'reactions'))throw new Error('Invalid save');const s={...saved,reactions:[]};if(!valid(s))throw new Error('Invalid save');return s;}
  function choicesFor(s){if(s.legacy)return O.choicesFor(s.legacy);const c=caseFor(s);return s.phase==='scene'?c.reactions:s.phase==='response'?c.actions:[];}
  function sceneFor(s){
    if(s.legacy)return O.sceneFor(s.legacy);const c=caseFor(s);
    if(s.phase==='scene')return c.event;
    if(s.phase==='flip'){
      const chosen=c.reactions.filter(r=>s.reactions.includes(r.id));
      if(c.release)return {title:c.release.title,text:'剛才冒出的念頭\n'+chosen.map(r=>'「'+r.title+'」').join('\n')+'\n\n'+c.release.feel+'\n\n也許，我正抓緊的是：\n'+c.release.wants.join('\n')+'\n\n不用分析哪一個才對，只輕輕問自己：\n我能允許現在的感覺先在這裡嗎？\n我願意鬆開一點點嗎？\n\n答案是「還不願意」也可以。放下不是命令；先不跟著念頭衝出去，就已經多了一點空間。'};
      return {title:chosen.length===1?'「'+chosen[0].title+'」':'幾種心情，可以同時存在',text:chosen.map(r=>'「'+r.title+'」\n'+r.text).join('\n\n')+'\n\n我可以看見這些念頭，不用急著跟著它們走。\n\n這只是另一個角度，不貼近你也沒關係。還沒平靜，也可以選下一步。'};
    }
    if(s.phase==='response')return {title:'眼前，先做哪一步？',text:'事情還是這件事，不用勉強自己想開。\n\n'+c.event.text+'\n\n先選一個你願意試的做法，不需要答對。'};
    return c.actions.find(a=>a.id===s.action).end;
  }
  function transition(s,e,random=Math.random){
    if(!valid(s))throw new Error('Invalid state');if(!e)return s;
    if(e.type==='next'&&s.phase==='ending')return draw(s,s.filter,random);
    if(s.legacy){const legacy=O.transition(s.legacy,e,random);return legacy===s.legacy?s:{...s,legacy,phase:legacy.phase,action:legacy.action};}
    if(e.type==='choose'&&choicesFor(s).some(c=>c.id===e.id))return s.phase==='scene'?{...s,reactions:s.reactions.includes(e.id)?s.reactions.filter(id=>id!==e.id):[...s.reactions,e.id]}:{...s,phase:'ending',action:e.id};
    if(e.type==='flip'&&s.phase==='scene'&&s.reactions.length)return {...s,phase:'flip'};
    if(e.type==='back'&&s.phase==='flip')return {...s,phase:'scene'};
    if(e.type==='continue'&&s.phase==='flip'||e.type==='skip'&&s.phase==='scene'&&!s.reactions.length)return {...s,phase:'response'};
    return s;
  }
  const api={...D,ids,filters,phases,caseFor,valid,draw,create,replay,migrate,snapshot,restore,choicesFor,sceneFor,transition};if(node)module.exports=api;else root.FerryFlowCore=api;
})(typeof globalThis==='object'?globalThis:this);
