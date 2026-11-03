(function(){
  'use strict';
  const T=window.JeiTheme;if(!T)return;
  // V4 has its own palette. Shared themes and earlier immutable designs stay intact.
  const original=T.presetPalette,previous={...T.THEMES.teal.roles};
  const roles={"page": "#ffffff", "pageEnd": "#ffffff", "surface": "#ffffff", "surfaceAlt": "#f3f4f6", "soft": "#fde4e0", "softStrong": "#fddcd6", "title": "#0f2f57", "text": "#383838", "muted": "#5e6b80", "line": "#e3e6eb", "lineStrong": "#e5303a", "accent": "#e5303a", "primary": "#d62532", "primaryHover": "#b81f2e", "onPrimary": "#ffffff", "brand": "#0f2f57", "active": "#fde4e0", "onActive": "#0f2f57", "completed": "#ffffff", "locked": "#f3f4f6", "disabled": "#a9aeb6", "night": "#0f2f57", "nightSurface": "#193f6c", "nightLine": "#5e6b80", "nightText": "#e4eefb", "overlay": "#0f2f5755"};
  T.THEMES.current={name:'보고용 V4 레드',description:'화이트 · 레드 행동 · 네이비 정보',roles};
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
