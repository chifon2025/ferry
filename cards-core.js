/* Original fiction and deterministic branching; no scores or spiritual rankings. */
(function(root){
  'use strict';
  const wishes=[
    {id:'share',title:'分享喜歡的花',text:'讓路過的人，帶走一點喜歡。'},
    {id:'steady',title:'把日子過踏實',text:'讓這間小店，慢慢站穩腳步。'},
    {id:'welcome',title:'有個相遇的地方',text:'讓人願意推開門，進來坐坐。'}
  ];
  const actions=[
    {id:'call',title:'先問清楚',text:'聯絡送花的人，確認現在的情況。',mark:'信'},
    {id:'borrow',title:'向隔壁借一點',text:'問問鄰居，有沒有能先用上的枝葉。',mark:'鄰'},
    {id:'notice',title:'把消息說明白',text:'告訴等候的人，今天的安排有變。',mark:'話'}
  ];
  const replies=[
    {id:'open',title:'先把門打開',text:'把手邊有的擺出來，見到客人再說。',mark:'開'},
    {id:'later',title:'調整開門時間',text:'先安排好今天能做的，再迎接客人。',mark:'整'}
  ];
  const stages=['opening','action','sealed','response','ending'];
  function create(variant=0){return {v:1,phase:'opening',variant:variant===1?1:0,wish:null,action:null,reply:null,aside:false};}
  function valid(s){
    if(!s||s.v!==1||!stages.includes(s.phase)||![0,1].includes(s.variant)||typeof s.aside!=='boolean')return false;
    if(s.wish!==null&&!wishes.some(c=>c.id===s.wish))return false;
    if(s.action!==null&&!actions.some(c=>c.id===s.action))return false;
    if(s.reply!==null&&!replies.some(c=>c.id===s.reply))return false;
    const p=stages.indexOf(s.phase);
    return (p===0?s.wish===null&&s.action===null&&s.reply===null:
      p===1?s.wish!==null&&s.action===null&&s.reply===null:
      p<4?s.wish!==null&&s.action!==null&&s.reply===null:s.wish!==null&&s.action!==null&&s.reply!==null);
  }
  function transition(s,event){
    if(!valid(s))throw new Error('Invalid story state');
    let next={...s};
    if(event.type==='aside'&&s.phase!=='opening'&&s.phase!=='ending')next.aside=!s.aside;
    else if(s.phase==='opening'&&event.type==='wish'&&wishes.some(c=>c.id===event.id)){next.wish=event.id;next.phase='action';}
    else if(s.phase==='action'&&event.type==='action'&&actions.some(c=>c.id===event.id)){next.action=event.id;next.phase='sealed';}
    else if(s.phase==='sealed'&&event.type==='reveal')next.phase='response';
    else if(s.phase==='response'&&event.type==='reply'&&replies.some(c=>c.id===event.id)){next.reply=event.id;next.phase='ending';}
    else return s;
    return next;
  }
  function aftermath(s){
    const arrival=s.variant===0?'下午':'明天早上';
    const content={
      call:{title:'電話那一頭',text:`送花的人接起電話：車子出了狀況，最快要${arrival}。\n\n小禾把到貨時間記下來。展示架仍是空的，但現在知道要安排什麼了。`},
      borrow:{title:'鄰居拿來的枝葉',text:`隔壁阿姨拿來一把修剪下的枝葉。不是原本訂的花，卻能先做些小小的搭配。\n\n送花的人也傳來消息：最快${arrival}才會到。`},
      notice:{title:'消息送出去了',text:`小禾寫明花材延誤，今天不一定能照原定時間開門。有人回覆「知道了」，也有人沒有回應。\n\n接著收到到貨通知：最快${arrival}。`}
    };
    return content[s.action];
  }
  function ending(s){
    const open=s.reply==='open',today=s.variant===0;
    const beginnings={call:'電話裡確認過的安排，成了今天的依據。',borrow:'隔壁送來的枝葉，被小禾放進了玻璃瓶。',notice:'門外的新告示，替今天的變動留了說明。'};
    const scene=open?
      (today?'小禾先開了門。上午有人探頭看看，聽完說明便離開了。下午花終於送到，她開始整理遲來的花桶。':'小禾先開了門。今天沒有完整的花束可賣，她把桌面整理好，和一位路過的鄰居聊了幾句。花仍要明天才到。'):
      (today?'小禾把開門時間改到下午。有人因此沒能趕上，她逐一回覆。花送到後，小店終於有了原先想像的一部分模樣。':'小禾決定明天再正式開門。今天她整理空花桶、確認貨單，也把改期的消息告訴原先約好的人。');
    return {title:open?'門開了，故事還在走':'換個時間，繼續這件事',text:beginnings[s.action]+'\n\n'+scene,after:'這不是原先想像的開幕日。小店的以後，也還沒有答案。'};
  }
  const api={wishes,actions,replies,stages,create,valid,transition,aftermath,ending};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FerryCardsCore=api;
})(typeof globalThis==='object'?globalThis:this);
