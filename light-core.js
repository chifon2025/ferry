(function(root){
  'use strict';
  const story=typeof module==='object'&&module.exports?require('./light-story.js'):root.FerryLightStory;
  const ids=story.chapters.map(c=>c.id),phases=['prologue','scene','response','ending','complete'];
  function chapterFor(s){return story.chapters.find(c=>c.id===s.chapter);}
  function pathFor(s){return chapterFor(s)?.paths.find(p=>p.id===s.action);}
  function create(chapter=ids[0],prologue=true){
    if(!ids.includes(chapter))throw new Error('Unknown chapter');
    return {v:1,chapter,phase:chapter===ids[0]&&prologue?'prologue':'scene',action:null,reply:null};
  }
  function valid(s){
    if(!s||typeof s!=='object'||s.v!==1||!ids.includes(s.chapter)||!phases.includes(s.phase))return false;
    if(Object.keys(s).some(k=>!['v','chapter','phase','action','reply'].includes(k)))return false;
    if(s.phase==='prologue')return s.chapter===ids[0]&&s.action===null&&s.reply===null;
    if(s.phase==='scene')return s.action===null&&s.reply===null;
    const p=pathFor(s);if(!p)return false;
    if(s.phase==='response')return s.reply===null;
    return p.replies.some(r=>r.id===s.reply)&&(s.phase!=='complete'||s.chapter===ids.at(-1));
  }
  function choicesFor(s){return s.phase==='scene'?chapterFor(s).paths:s.phase==='response'?pathFor(s).replies:[];}
  function sceneFor(s){
    if(s.phase==='prologue')return story.prologue;
    if(s.phase==='complete')return story.epilogue;
    if(s.phase==='scene')return chapterFor(s).event;
    if(s.phase==='response')return pathFor(s).after;
    return pathFor(s).replies.find(r=>r.id===s.reply).end;
  }
  function transition(s,e){
    if(!valid(s))throw new Error('Invalid state');
    if(!e)return s;
    if(e.type==='start'&&s.phase==='prologue')return {...s,phase:'scene'};
    if(e.type==='choose'&&choicesFor(s).some(c=>c.id===e.id))return s.phase==='scene'?{...s,action:e.id,phase:'response'}:{...s,reply:e.id,phase:'ending'};
    if(e.type==='next'&&s.phase==='ending'){
      const id=ids[ids.indexOf(s.chapter)+1];return id?create(id,false):{...s,phase:'complete'};
    }
    return s;
  }
  const api={...story,ids,phases,create,valid,chapterFor,choicesFor,sceneFor,transition};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FerryLightCore=api;
})(typeof globalThis==='object'?globalThis:this);
