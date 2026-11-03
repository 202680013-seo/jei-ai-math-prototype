(function(){
  'use strict';const T=window.JeiTheme,root=document.documentElement;if(!T||root.getAttribute('data-jei-color-theme')!=='true')return;
  function apply(theme='current',color=null){
    const legacy=theme==='current'&&T.normalize(color),values=legacy?T.palette(legacy):T.presetPalette(theme);
    for(const [key,value] of Object.entries(values))root.style.setProperty(key,value);
    root.setAttribute('data-preview-theme',legacy?'custom':theme);
    root.setAttribute('data-preview-color',legacy||T.THEMES[theme].roles.accent);
  }
  const params=new URLSearchParams(location.search),theme=T.normalizeTheme(params.get('theme'))||'current';
  apply(theme,params.has('theme')?null:params.get('color'));
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='jei-theme-preview')return;
    if(Object.hasOwn(event.data,'theme')){const id=event.data.theme===null?'current':T.normalizeTheme(event.data.theme);if(!id)return;if(event.data.color!=null&&!T.normalize(event.data.color))return;apply(id,event.data.color);}
    else{if(event.data.color!==null&&!T.normalize(event.data.color))return;apply('current',event.data.color);}
  });
})();
