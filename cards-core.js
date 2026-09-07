/* Original fiction and deterministic branching; no scores or spiritual rankings. */
(function(root){
  'use strict';
  const stories=typeof module==='object'&&module.exports?require('./cards-stories.js'):root.FerryCardStories;
  const chapters=['flowers','review','order'];
  function chapterId(s){return s.chapter===undefined?'flowers':s.chapter;}
  function chapterFor(s){return chapterId(s)==='flowers'?{
    title:'一直沒開門的花店',thought:'一定要照原計畫才行。',
    opening:{title:'今天，花店要開門了',text:'小禾把鑰匙握在手裡。準備了好久的小店，今天終於要開門。\n\n這一天，你想陪她帶著什麼心願開始？'},
    event:{title:'花，還沒有來',text:'花桶排好了，包裝紙也備齊了。訂好的花卻遲遲沒有送到。\n\n小禾看看空蕩蕩的展示架，又看看門外。她原本想像的開幕，不是這個樣子。'}
  }:stories[chapterId(s)];}
  function actionsFor(s){return chapterId(s)==='flowers'?actions:stories[chapterId(s)].actions;}
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
  const branchReplies={
    call:[
      {id:'open',title:'先接預約',text:'說明到貨時間，讓客人決定要不要等。',mark:'約',preview:'先確認需求，不收訂金；需要立刻用花的人，可能會離開。'},
      {id:'later',title:'等花到再開門',text:'改約開門時間，把準備工作做完。',mark:'候',preview:'能完整整理花材，但原本約好的人不一定有空再來。'},
      {id:'pickup',title:'去取現有花材',text:'到附近倉庫，取回少量可用的花。',mark:'取',preview:'能先做少量花束；取貨時，小店要暫時關著。'}
    ],
    borrow:[
      {id:'open',title:'先做小葉束',text:'用借來的枝葉，做幾束小小的綠意。',mark:'葉',preview:'今天有作品能分享，但葉束無法代替客人原本想買的鮮花。'},
      {id:'later',title:'先把枝葉養好',text:'先處理借來的枝葉，等花到再搭配。',mark:'養',preview:'保留枝葉的狀態，今天原定的開幕仍需要改期。'},
      {id:'together',title:'邀鄰居一起佈置',text:'問阿姨願不願意，一起整理門邊。',mark:'伴',preview:'可以試著邀請，對方能留下多久，還要問過才知道。'}
    ],
    notice:[
      {id:'open',title:'先回覆著急的人',text:'先處理今天就需要花的那則留言。',mark:'覆',preview:'說清楚做不到的部分；這次訂單可能留不住。'},
      {id:'later',title:'把改期說清楚',text:'更新開門時間，再通知約好的人。',mark:'告',preview:'大家能重新安排，但不是每個人都會回覆或改約。'},
      {id:'invite',title:'先開門讓人看看',text:'告訴想來坐坐的人，今天沒有鮮花。',mark:'迎',preview:'先有一個見面的地方；有人來，也不代表今天就有生意。'}
    ]
  };
  function repliesFor(s){
    if(chapterId(s)!=='flowers')return stories[chapterId(s)]?.branches[s.action]?.cards||[];
    return s.edition===2?(branchReplies[s.action]||[]):replies;
  }
  const stages=['opening','action','sealed','response','ending'];
  function create(variant=0,chapter='flowers'){
    if(!chapters.includes(chapter))throw new Error('Unknown chapter');
    return {v:1,edition:2,...(chapter==='flowers'?{}:{chapter}),phase:'opening',variant:variant===1?1:0,wish:null,action:null,reply:null,aside:false};
  }
  function nextChapter(s){
    if(!valid(s)||s.phase!=='ending')return null;
    const id=chapters[chapters.indexOf(chapterId(s))+1];return id?create(s.variant,id):null;
  }
  function valid(s){
    if(!s||s.v!==1||!stages.includes(s.phase)||![0,1].includes(s.variant)||typeof s.aside!=='boolean')return false;
    if(s.edition!==undefined&&s.edition!==2)return false;
    if(!chapters.includes(chapterId(s))||(chapterId(s)!=='flowers'&&s.edition!==2))return false;
    if(s.wish!==null&&!wishes.some(c=>c.id===s.wish))return false;
    if(s.action!==null&&!actionsFor(s).some(c=>c.id===s.action))return false;
    if(s.reply!==null&&!repliesFor(s).some(c=>c.id===s.reply))return false;
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
    else if(s.phase==='action'&&event.type==='action'&&actionsFor(s).some(c=>c.id===event.id)){next.action=event.id;next.phase='sealed';}
    else if(s.phase==='sealed'&&event.type==='reveal')next.phase='response';
    else if(s.phase==='response'&&event.type==='reply'&&repliesFor(s).some(c=>c.id===event.id)){next.reply=event.id;next.phase='ending';}
    else return s;
    return next;
  }
  function legacyAftermath(s){
    const arrival=s.variant===0?'下午':'明天早上';
    const content={
      call:{title:'電話那一頭',text:`送花的人接起電話：車子出了狀況，最快要${arrival}。\n\n小禾把到貨時間記下來。展示架仍是空的，但現在知道要安排什麼了。`},
      borrow:{title:'鄰居拿來的枝葉',text:`隔壁阿姨拿來一把修剪下的枝葉。不是原本訂的花，卻能先做些小小的搭配。\n\n送花的人也傳來消息：最快${arrival}才會到。`},
      notice:{title:'消息送出去了',text:`小禾寫明花材延誤，今天不一定能照原定時間開門。有人回覆「知道了」，也有人沒有回應。\n\n接著收到到貨通知：最快${arrival}。`}
    };
    return content[s.action];
  }
  function legacyEnding(s){
    const open=s.reply==='open',today=s.variant===0;
    const beginnings={call:'電話裡確認過的安排，成了今天的依據。',borrow:'隔壁送來的枝葉，被小禾放進了玻璃瓶。',notice:'門外的新告示，替今天的變動留了說明。'};
    const scene=open?
      (today?'小禾先開了門。上午有人探頭看看，聽完說明便離開了。下午花終於送到，她開始整理遲來的花桶。':'小禾先開了門。今天沒有完整的花束可賣，她把桌面整理好，和一位路過的鄰居聊了幾句。花仍要明天才到。'):
      (today?'小禾把開門時間改到下午。有人因此沒能趕上，她逐一回覆。花送到後，小店終於有了原先想像的一部分模樣。':'小禾決定明天再正式開門。今天她整理空花桶、確認貨單，也把改期的消息告訴原先約好的人。');
    return {title:open?'門開了，故事還在走':'換個時間，繼續這件事',text:beginnings[s.action]+'\n\n'+scene,after:'這不是原先想像的開幕日。小店的以後，也還沒有答案。'};
  }
  function aftermath(s){
    if(chapterId(s)!=='flowers')return stories[chapterId(s)].branches[s.action].reveal;
    if(s.edition!==2)return legacyAftermath(s);
    const arrival=s.variant===0?'下午':'明天早上';
    return {
      call:{title:'電話那一頭',clue:'到貨消息 · '+arrival+'／附近可取少量花材',text:`車子出了狀況，整批花最快${arrival}才到。送花的人說，附近的合作倉庫還有少量花材，可以自己去取。\n\n小禾記下地址。要出門拿花，就得先把店關著。`},
      borrow:{title:'鄰居拿來的枝葉',clue:'手邊多了 · 一把枝葉，還沒有鮮花',text:`隔壁阿姨拿來一把修剪下的枝葉。「鮮花沒有，這些你先用。」\n\n花要${arrival}才到。小禾攤開枝葉，看見幾種葉形，也想起原本答應客人的花束。`},
      notice:{title:'客人回了消息',clue:'兩則回覆 · 一位急用花，一位想來看看',text:`消息發出去後，一位客人問：「今天中午要送人的花，還來得及嗎？」另一位說：「沒花也可以去看看嗎？」\n\n送花的人確認，最快${arrival}才到。小禾看著兩則不同的期待。`}
    }[s.action];
  }
  function ending(s){
    if(chapterId(s)!=='flowers')return stories[chapterId(s)].branches[s.action].ends[s.reply];
    if(s.edition!==2)return legacyEnding(s);
    const today=s.variant===0,arrival=today?'下午':'明天早上';
    const outcomes={
      call:{
        open:{title:'預約簿上的一個名字',text:`小禾寫明花要${arrival}才到，先記需求，不收訂金。一位客人留下名字，另一位急用花，決定去別家。\n\n${today?'下午花到了。她先整理預約要用的花，其他花桶還來不及擺齊。':'今天的花桶仍空著。她和留下名字的客人約好明早再確認，還不能把預約當成成交。'}`,after:'留下了一個待確認的約定，也放走了一次來不及接的需求。'},
        later:{title:'門上的新時間',text:`小禾把開門時間改到${arrival}，打給原本約好的客人。一位說可以，另一位那時要上班，只能取消。\n\n${today?'花在下午送到。她有時間逐桶整理，開門時，上午的熱鬧已經散了。':'她把貨單與工作桌準備好，今天沒有正式開門。那位願意等的客人，改約了明天。'}`,after:'準備更完整了，但不是每個原定的相遇都留得住。'},
        pickup:{title:'帶回來的不是全部',text:`小禾貼上暫離告示，去附近倉庫取花。現貨的顏色比預訂少，只夠先做兩束。\n\n回店時，一位來過的客人已離開。她把兩束花擺好；${today?'下午整批花到貨，又得重新整理一次。':'其餘花材仍要明天早上才到，今天只能先接少量需求。'}`,after:'換來了提早動手的材料，也付出了離店與多跑一趟的時間。'}
      },
      borrow:{
        open:{title:'第一束，是綠色的',text:`小禾用枝葉紮了幾束小作品，標明「葉束，沒有鮮花」。有人選了一束，也有人問完玫瑰就離開。\n\n${today?'下午訂好的花送到，她留下部分枝葉搭配，也另外準備客人原本要的花束。':'花要明天早上才到。她把今天做不到的花束說清楚，沒有用葉束代替承諾。'}`,after:'小作品找到了喜歡它的人；原本要鮮花的需求，仍要另外處理。'},
        later:{title:'先照顧手裡這一把',text:`小禾修掉枝葉下端，放進清水裡，跟阿姨說了聲謝謝。她通知原先約好的人，開門要改到${arrival}。\n\n${today?'花到時，枝葉正好能搭配。但一位上午想來的客人，今天已經沒有空了。':'今天沒有賣出作品。她先清出搭配的位置，鮮花與客人的回覆都還要等。'}`,after:'借來的心意被好好照顧；延誤沒有消失，開門的安排也改了。'},
        together:{title:'阿姨只能留十分鐘',text:`阿姨答應幫忙，卻說等一下還要回去顧店。兩人只整理了門邊一角，剩下的由小禾接手。\n\n${today?'下午花送到，第一桶就放在一起整理的角落。其他佈置還沒完成。':'花仍要明天早上才來。今天門邊多了一點綠意，還不是能賣花的開幕。'}`,after:'得到了一小段陪伴，也知道了對方能幫忙的界線。'}
      },
      notice:{
        open:{title:'這一單，來不及接',text:`小禾先回覆中午急用花的客人：「這次我趕不上，不想耽誤你送禮。」對方去問了別家，沒有留下訂單。\n\n她再回覆另一位客人，約等花到再來。${today?'下午花到時，她才開始接新的需求。':'花要明天早上才到，今天還沒有完成一筆生意。'}`,after:'失去了一張訂單，但客人及早知道了實情，可以另作安排。'},
        later:{title:'告示改好了，回覆還沒齊',text:`小禾在門上與原來發消息的地方，都寫明改到${arrival}開門。急用花的客人取消了；想來看看的那位，還沒回覆。\n\n${today?'下午花到，她依新時間開門。直到收拾時，仍不知道那位客人看見消息沒有。':'今天先完成準備。明早要再確認花到了，才能請客人出門。'}`,after:'安排說清楚了。別人會不會再來，暫時沒有答案。'},
        invite:{title:'有人來坐，沒有買花',text:`小禾先說明今天眼下沒有鮮花，還是把門打開。想來看看的客人坐了一會兒，聊起家裡窗邊適合放什麼；急用花的那位則取消了。\n\n${today?'客人離開後，花才在下午送到。這次見面沒有成交。':'今天沒有成交，花仍要明天早上才到。她記下窗邊採光，留待下次聊。'}`,after:'小店先有了一次相遇，還沒有因此解決生意的問題。'}
      }
    };
    return outcomes[s.action][s.reply];
  }
  const api={wishes,actions,replies,repliesFor,actionsFor,chapters,chapterId,chapterFor,nextChapter,stages,create,valid,transition,aftermath,ending};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FerryCardsCore=api;
})(typeof globalThis==='object'?globalThis:this);
