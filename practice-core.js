/* 純狀態轉移：瀏覽器與 node:test 共用，不讀時間、不接觸 DOM。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FerryCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const phases = ["intro", "observe", "choose", "act", "effect", "release", "carry"];
  function migrate(old) {
    if (!old || typeof old !== "object" || Array.isArray(old)) throw new Error("存檔格式無法辨識");
    for (const key of ["seeds", "quotes", "letters", "history"]) {
      if (old[key] != null && !Array.isArray(old[key])) throw new Error("舊存檔欄位無法辨識");
    }
    const s = clone(old);
    s.seeds ||= []; s.quotes ||= []; s.letters ||= []; s.history ||= [];
    if (s.dailyPractice && s.dailyPractice.version !== 1) throw new Error("此存檔需要其他版本的渡");
    s.dailyPractice ||= {version:1, active:null, completed:[], pending:[], life:[], reviews:[], lastDate:null};
    const p = s.dailyPractice;
    for (const key of ["completed", "pending", "life", "reviews"]) {
      if (!Array.isArray(p[key])) throw new Error("日常存檔欄位無法辨識");
    }
    if (p.active && (!phases.includes(p.active.phase) || !Array.isArray(p.active.seen))) throw new Error("這段故事暫時無法讀取");
    return s;
  }
  function canBegin(s, day) {
    return !s.dailyPractice.active && (!s.lastRoundDate || s.lastRoundDate < day) &&
      (!s.dailyPractice.lastDate || s.dailyPractice.lastDate < day);
  }
  function begin(old, story, day, replay = false) {
    const s = migrate(old);
    if (s.dailyPractice.active || (!replay && !canBegin(s, day))) return s;
    s.dailyPractice.active = {story, day, replay, phase:"intro", seen:[], action:null};
    return s;
  }
  function observe(old, index) {
    const s = migrate(old), a = s.dailyPractice.active;
    if (a?.phase === "observe" && Number.isInteger(index) && index >= 0 && index < 3 && !a.seen.includes(index)) a.seen.push(index);
    return s;
  }
  function choose(old, action) {
    const s = migrate(old), a = s.dailyPractice.active;
    if (a?.phase === "choose" && typeof action === "string") {a.action = action; a.phase = "act";}
    return s;
  }
  function advance(old) {
    const s = migrate(old), a = s.dailyPractice.active;
    if (!a) return s;
    const i = phases.indexOf(a.phase);
    if (i >= 0 && i < phases.length - 1 && a.phase !== "choose") a.phase = phases[i + 1];
    return s;
  }
  function finish(old, day, story, invitation) {
    const s = migrate(old), p = s.dailyPractice, a = p.active;
    if (!a || a.phase !== "carry" || a.story !== story.id) return s;
    const action = story.actions.find(x => x.id === a.action);
    if (!action) throw new Error("找不到這一步行動");
    if (!a.replay) {
      const date = [day, a.day, p.lastDate || ""].sort().pop();
      const entry = {id:date + ":" + story.id, date, story:story.id, title:story.title, action:action.label};
      if (!p.completed.some(x => x.id === entry.id)) {
        p.completed.push(entry);
        p.pending.push({...entry, text:action.later});
        if (invitation) p.life.push({...entry, when:invitation.when, step:invitation.step, review:null});
        p.lastDate = date;
        s.lastRoundDate = date;
        s.totalRounds = (s.totalRounds || 0) + 1;
        // 不修改 calmCount、舊金點或以心境評分的 flags。
      }
    }
    p.active = null;
    return s;
  }
  function settle(old, day) {
    const s = migrate(old), p = s.dailyPractice;
    for (const item of p.pending.filter(x => x.date < day)) {
      if (!s.letters.some(x => x.practiceId === item.id)) {
        s.letters.push({practiceId:item.id, title:item.title, text:item.text, date:day, read:false});
      }
    }
    p.pending = p.pending.filter(x => x.date >= day);
    return s;
  }
  function reflect(old, id, response, day) {
    const s = migrate(old), p = s.dailyPractice, item = p.life.find(x => x.id === id);
    if (item && !item.review) {item.review = response; p.reviews.push({id, response, date:day});}
    return s;
  }
  return {migrate, canBegin, begin, observe, choose, advance, finish, settle, reflect};
});
