(function(){
  'use strict';
  const T=window.JeiTheme;if(!T)return;
  // V4 has its own palette. Shared themes and earlier immutable designs stay intact.
  const original=T.presetPalette,previous={...T.THEMES.teal.roles};
  const roles={page:'#ffffff',pageEnd:'#ffffff',surface:'#ffffff',surfaceAlt:'#f8f9fa',soft:'#eef2f4',softStrong:'#cdf1ee',title:'#414f62',text:'#414f62',muted:'#758391',line:'#dce1e5',lineStrong:'#0ec7ae',accent:'#0ec7ae',primary:'#0c9f8b',primaryHover:'#078c7c',onPrimary:'#ffffff',brand:'#0c9f8b',active:'#0ec7ae',onActive:'#ffffff',completed:'#e5f5fd',locked:'#f8f9fa',disabled:'#b7bec3',night:'#142c35',nightSurface:'#23434d',nightLine:'#527783',nightText:'#e5f5fd',overlay:'#24354555'};
  T.THEMES.current={name:'V4 민트',description:'화이트 · 민트 학습 카드 · 하늘색 완료 카드',roles};
  T.presetPalette=function(id){
    if(id!=='current')return original(id);
    const result=original('teal');
    const route=new Map(Object.keys(previous).map(k=>[previous[k].toLowerCase(),roles[k]]));
    // A legacy accent and primary share the same teal value; route it to mint.
    route.set(previous.accent,roles.accent);route.set(previous.brand,roles.brand);
    for(const [key,value]of Object.entries(result)){
      if(/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value))result[key]=(route.get(value.slice(0,7).toLowerCase())||value.slice(0,7))+value.slice(7);
      else if(value.startsWith('url('))result[key]=value.replaceAll(previous.brand.slice(1),roles.brand.slice(1));
    }
    for(const [key,value]of Object.entries(roles))result['--theme-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=value;
    result['--jei-accent']=roles.accent;result['--jei-on-accent']=roles.onActive;
    return result;
  };
})();
