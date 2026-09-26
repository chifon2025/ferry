(function(root){
  'use strict';
  const data=typeof module==='object'&&module.exports?require('./scenario-data.js'):root.FerryScenarioData;
  const ids=data.scenarios.map(c=>c.id),byId=new Map(data.scenarios.map(c=>[c.id,c]));
  const filters=['all',...data.categories.map(c=>c.id)],phases=['scene','response','ending'];
  function caseFor(s){return byId.get(s.caseId);}
  function pathFor(s){return caseFor(s)?.paths.find(p=>p.id===s.action);}
  function valid(s){
    if(!s||typeof s!=='object'||Array.isArray(s)||s.v!==1||!byId.has(s.caseId)||!filters.includes(s.filter)||!phases.includes(s.phase))return false;
    const keys=['v','caseId','filter','phase','action','reply','seen'];
    if(Object.keys(s).length!==keys.length||Object.keys(s).some(k=>!keys.includes(k)))return false;
    if(!Array.isArray(s.seen)||s.seen.length>ids.length||!s.seen.includes(s.caseId)||new Set(s.seen).size!==s.seen.length||s.seen.some(id=>!byId.has(id)))return false;
    if(s.filter!=='all'&&caseFor(s).category!==s.filter)return false;
    if(s.phase==='scene')return s.action===null&&s.reply===null;
    const p=pathFor(s);if(!p)return false;
    return s.phase==='response'?s.reply===null:p.replies.some(r=>r.id===s.reply);
  }
  function draw(previous=null,filter=previous?.filter||'all',random=Math.random){
    if(previous&&!valid(previous))throw new Error('Invalid state');
    if(!filters.includes(filter))throw new Error('Unknown filter');
    let seen=previous?[...previous.seen]:[];
    const pool=ids.filter(id=>filter==='all'||byId.get(id).category===filter),poolSet=new Set(pool),visited=new Set(seen);
    let available=pool.filter(id=>!visited.has(id));
    if(!available.length){seen=seen.filter(id=>!poolSet.has(id));available=pool.filter(id=>id!==previous?.caseId);}
    let n=random();if(!Number.isFinite(n))n=0;n=Math.max(0,Math.min(n,1-Number.EPSILON));
    const caseId=available[Math.floor(n*available.length)];
    return {v:1,caseId,filter,phase:'scene',action:null,reply:null,seen:[...seen,caseId]};
  }
  function create(filter='all',random=Math.random){return draw(null,filter,random);}
  function replay(s){if(!valid(s))throw new Error('Invalid state');return {...s,phase:'scene',action:null,reply:null,seen:[...s.seen]};}
  function choicesFor(s){return s.phase==='scene'?caseFor(s).paths:s.phase==='response'?pathFor(s).replies:[];}
  function sceneFor(s){return s.phase==='scene'?caseFor(s).event:s.phase==='response'?pathFor(s).after:pathFor(s).replies.find(r=>r.id===s.reply).end;}
  function transition(s,e,random=Math.random){
    if(!valid(s))throw new Error('Invalid state');
    if(!e)return s;
    if(e.type==='choose'&&choicesFor(s).some(c=>c.id===e.id))return s.phase==='scene'?{...s,action:e.id,phase:'response'}:{...s,reply:e.id,phase:'ending'};
    if(e.type==='next'&&s.phase==='ending')return draw(s,s.filter,random);
    return s;
  }
  const api={...data,ids,filters,phases,create,valid,caseFor,draw,replay,choicesFor,sceneFor,transition};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FerryScenarioCore=api;
})(typeof globalThis==='object'?globalThis:this);
