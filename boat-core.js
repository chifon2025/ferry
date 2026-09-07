/* Pure simulation. Currents depend only on time and location, never on releasing. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const goal={x:.49,y:.20};
  function create(){return {x:.25,y:.85,t:0,vx:0,angle:0,arrived:false};}
  function current(t,y){return .019*Math.sin(t*.27+y*3)+.013*Math.cos(t*.51+.7);}
  function step(state,input,elapsed){
    if(state.arrived)return {...state};
    const dt=clamp(Number.isFinite(elapsed)?elapsed:0,0,.05);
    const steer=clamp(Number.isFinite(input)?input:0,-1,1);
    const t=state.t+dt;
    const target=current(t,state.y)+steer*.105;
    const vx=state.vx+(target-state.vx)*Math.min(1,dt*4);
    const x=clamp(state.x+vx*dt,.10,.90);
    // The river carries the boat forward, but does not steer toward the landing.
    const y=Math.max(goal.y,state.y-dt*.026);
    const angle=state.angle+((Math.atan2(vx,.075)*.6)-state.angle)*Math.min(1,dt*5);
    return {x,y,t,vx,angle,arrived:y<=goal.y+.002&&Math.abs(x-goal.x)<.068};
  }
  function positionText(s){
    if(s.arrived)return '小舟已靠岸。';
    if(s.y<.30)return s.x<goal.x-.068?'渡口在右邊，可以向右調整。':s.x>goal.x+.068?'渡口在左邊，可以向左調整。':'前方就是渡口。';
    const flow=current(s.t,s.y);
    return flow>.008?'水流正往右帶。':flow<-.008?'水流正往左帶。':'水流正慢慢轉向。';
  }
  const api={create,current,step,positionText,goal};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FerryBoatCore=api;
})(typeof globalThis==='object'?globalThis:this);
