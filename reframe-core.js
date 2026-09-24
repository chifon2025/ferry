/* Five original, optional reframing trials. No storage, scores or diagnosis. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./scenario-data.js'):root.FerryScenarioData);if(typeof module==='object'&&module.exports)module.exports=api;else root.FerryReframeCore=api;})(typeof window==='object'?window:globalThis,function(data){
  'use strict';
  const definitions=[
    {id:'s041',reactions:[
      ['你懂什麼！','熬夜做的努力被一句話帶過，難免不甘心。也許我在意的是：先看清楚我的付出，再給具體的意見。'],
      ['是不是我很差？','我很希望自己做得好。但「這份報告還能改」和「我整個人很差」，並不是同一件事。'],
      ['不想再做了。','我可能累了，也不想再受打擊。現在不用決定以後都不做；先處理眼前這一份就好。']
    ],actions:[
      ['問清楚哪裡要改','「你覺得缺的是哪一段資料？可以指出來嗎？」先把籠統的評語，變成能討論的事情。','話題回到報告','你把問題問得具體了。對方是否願意好好回答，還不知道；你可以等具體意見，再判斷哪些值得修改。'],
      ['先停一下，晚點談','「我現在有點累，晚點再跟你確認要補的地方。」先不在氣頭上回擊，也沒有放掉工作的責任。','替自己留一點空間','你說明了晚點再談。報告還在，意見也還沒釐清；下一步是休息後，回來確認要補什麼，不必立刻證明自己。']
    ]},
    {id:'s003',reactions:[
      ['又要我等！','我的時間也重要。生氣提醒我很在意約定；我可以把時間界線說清楚，不必用爭吵才能表達。'],
      ['是不是不重視我？','等不到人，很容易連自己的重要性也一起懷疑。目前知道的是他塞車，還不知道這代表他怎麼看我。'],
      ['算了，我也不敢催。','我可能怕一開口就傷和氣。但想知道還要等多久，是一個可以直接提出的需要。']
    ],actions:[
      ['問還需要多久','「我已經到了，你大約還要多久？我需要安排後面的時間。」先問一個能幫自己決定的資訊。','先把時間問清楚','你傳出了詢問。還沒收到答覆前，不用替沉默下結論；收到時間後，再決定是否繼續等。'],
      ['說明能等到幾點','看看自己的安排，說：「我只能再等十五分鐘，來不及我們就另外約。」這個時間要是自己真的能接受的。','等候有了界線','你說清楚了能等多久。朋友不一定高興，但你不必無限等下去；到約定時間，再照自己的安排決定。']
    ]},
    {id:'s201',reactions:[
      ['他是不是不想理我？','我想被回應，也在意這段關係。但已讀只告訴我訊息被看過，還不能替對方說明所有原因。'],
      ['是不是我說錯話了？','我怕自己的話讓人不舒服。目前沒有足夠資訊證明自己說錯了，不必先把責任全攬過來。'],
      ['我要再傳一則。','我想趕快確定關係沒事。可以先看看：我是真的有新事情要說，還是正在等一個讓自己安心的訊號？']
    ],actions:[
      ['先回到手邊的事','把手機放到一旁，先完成手邊一件小事。不是故意冷落對方，也不用禁止自己還在意。','生活不只在訊息框裡','你暫時離開了對話框。訊息是否回來還不知道，但接下來這一小段時間，可以先留給眼前的生活。'],
      ['直接約個聊天時間','如果確實想聊聊，就說：「我想找你聊一下，你什麼時候方便？」不用用連續試探來猜對方的意思。','把需要說明白','你提出了聊天的邀請。對方可能有空，也可能沒有；等他回覆，再決定怎麼安排，不必立刻得到答案。']
    ]},
    {id:'s096',reactions:[
      ['怎麼又是我？','我想互相幫忙，也希望自己的休息被尊重。這次有怨氣，可能是在提醒我：答應前先看看自己還有多少餘力。'],
      ['不答應會不會得罪人？','我在意關係，不想讓人失望。但有界線不等於不近人情；我可以好好說，不必保證對方一定滿意。'],
      ['算了，忍一下就好。','我可能習慣先讓別人方便。但自己的休息也是需要，這一次可以把它一起算進決定裡。']
    ],actions:[
      ['說這次沒辦法','「我這次休假已經有安排，沒辦法代班。」不用編造理由，也不用批評對方怎麼又來問。','這次沒有再勉強答應','你把自己的安排說清楚了。對方的排班問題仍需要他去處理；你可以在意他的難處，同時保留這次休息。'],
      ['先不答應，確認安排','「我先確認自己的安排，今天下班前回覆你，你也先找其他人看看。」只有真的需要確認時，才用這個做法。','把自動答應停了一下','你沒有立刻說好，也給了回覆時間。接下來先確認自己的餘力，再如實回覆；若做不到，仍然可以說不。']
    ]},
    {id:'s131',reactions:[
      ['是他先惹我的！','我也有委屈，原本的問題需要談。但對自己的用語負責，不代表對方的做法就全都沒問題。'],
      ['我怎麼又搞砸了。','我在意這段關係，也不喜歡剛才的自己。可以承認那句話傷人，不必把自己整個人判成失敗。'],
      ['算了，當沒發生。','我可能怕尷尬，也不知道怎麼開口。不用一次把所有事修好，可以先承認剛才那一句。']
    ],actions:[
      ['為用語道歉，再談事情','「剛才我說『隨便你』太重了，對不起。但那件事我還是想跟你好好談。」把用語與原本的問題分開。','先為自己那一句負責','你說出了道歉。對方不一定立刻接受；你已承認自己的用語，原本的問題仍可以等雙方願意時再談。'],
      ['先說明需要暫停','「剛才我講太重了，我想先停一下，晚點再談。」若現在還容易衝出口，就先說明暫停，而不是突然消失。','替下一次對話留位置','你承認了剛才的話，也說明需要暫停。暫停不是結案；等能好好說話時，再找合適時間把事情談清楚。']
    ]}
  ];
  const cases=definitions.map(d=>{
    const original=data.scenarios.find(c=>c.id===d.id);
    return {...original,reactions:d.reactions.map(([title,text],i)=>({id:'t'+i,title,text})),actions:d.actions.map(([title,text,endTitle,endText],i)=>({id:'a'+i,title,text,end:{title:endTitle,text:endText}}))};
  });
  const phases=['scene','flip','response','ending'];
  function create(id=cases[0].id){if(!cases.some(c=>c.id===id))throw new Error('Unknown trial');return {caseId:id,phase:'scene',reactions:[],action:null,seen:[id]};}
  function caseFor(s){return cases.find(c=>c.id===s.caseId);}
  function valid(s){
    if(!s||typeof s!=='object'||Object.keys(s).sort().join()!=='action,caseId,phase,reactions,seen')return false;
    if(!caseFor(s)||!phases.includes(s.phase)||!Array.isArray(s.seen)||new Set(s.seen).size!==s.seen.length||!s.seen.includes(s.caseId)||s.seen.some(id=>!cases.some(c=>c.id===id)))return false;
    if(!Array.isArray(s.reactions)||new Set(s.reactions).size!==s.reactions.length||s.reactions.some(id=>!caseFor(s).reactions.some(r=>r.id===id)))return false;
    if(s.phase==='scene')return s.action===null;
    if(s.phase==='flip')return s.reactions.length>0&&s.action===null;
    if(s.phase==='response')return s.action===null;
    return caseFor(s).actions.some(a=>a.id===s.action);
  }
  function replay(s){return {...s,phase:'scene',reactions:[],action:null};}
  function draw(s,random=Math.random){let pool=cases.filter(c=>!s.seen.includes(c.id)),seen=s.seen;if(!pool.length){pool=cases.filter(c=>c.id!==s.caseId);seen=[];}const id=pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))].id;return {...create(id),seen:[...seen,id]};}
  function choicesFor(s){const c=caseFor(s);return s.phase==='scene'?c.reactions:s.phase==='response'?c.actions:[];}
  function sceneFor(s){const c=caseFor(s);if(s.phase==='scene')return c.event;if(s.phase==='flip'){const chosen=c.reactions.filter(r=>s.reactions.includes(r.id));return {title:chosen.length===1?'「'+chosen[0].title+'」':'幾種心情，可以同時存在',text:chosen.map(r=>'「'+r.title+'」\n'+r.text).join('\n\n')+'\n\n我現在很在意，但不用急著跟著這些念頭走。\n\n這只是另一個角度，不貼近你也沒關係。還沒平靜，也可以選下一步。'};}if(s.phase==='response')return {title:'眼前，先做哪一步？',text:'事情還是這件事，不用勉強自己想開。\n\n'+c.event.text+'\n\n先選一個你願意試的做法，不需要答對。'};return c.actions.find(a=>a.id===s.action).end;}
  function transition(s,e,random=Math.random){
    if(!valid(s)||!e)return s;
    if(e.type==='choose'&&choicesFor(s).some(c=>c.id===e.id))return s.phase==='scene'?{...s,reactions:s.reactions.includes(e.id)?s.reactions.filter(id=>id!==e.id):[...s.reactions,e.id]}:{...s,phase:'ending',action:e.id};
    if(e.type==='flip'&&s.phase==='scene'&&s.reactions.length)return {...s,phase:'flip'};
    if(e.type==='continue'&&s.phase==='flip')return {...s,phase:'response'};
    if(e.type==='skip'&&s.phase==='scene'&&!s.reactions.length)return {...s,phase:'response'};
    if(e.type==='back'&&s.phase==='flip')return {...s,phase:'scene'};
    if(e.type==='next'&&s.phase==='ending')return draw(s,random);
    return s;
  }
  return {cases,phases,create,caseFor,valid,replay,draw,choicesFor,sceneFor,transition};
});
