/* Lossless, measured paging. No font shrinking or truncation to fit a phone. */
(function(root){
  'use strict';
  function paginate(text,fits){
    const chars=Array.from(text),pages=[];let start=0;
    while(start<chars.length){
      let low=1,high=chars.length-start,best=0;
      while(low<=high){const mid=Math.floor((low+high)/2);if(fits(chars.slice(start,start+mid).join(''))){best=mid;low=mid+1;}else high=mid-1;}
      best=Math.max(1,best);
      if(start+best<chars.length){
        for(let i=best-1;i>=Math.floor(best*.6);i--)if(/[。！？；\n]/u.test(chars[start+i])){best=i+1;break;}
      }
      pages.push({text:chars.slice(start,start+best).join(''),start});start+=best;
    }
    return pages.length?pages:[{text:'',start:0}];
  }
  function pageAt(pages,offset){let i=pages.length-1;while(i>0&&pages[i].start>offset)i--;return i;}
  const api={paginate,pageAt};if(typeof module==='object'&&module.exports)module.exports=api;else root.FerryCardLayout=api;
})(typeof globalThis==='object'?globalThis:this);
