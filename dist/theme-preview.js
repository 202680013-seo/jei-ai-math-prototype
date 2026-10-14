(function(){
  'use strict';const T=window.JeiTheme;if(!T||document.documentElement.getAttribute('data-jei-color-theme')!=='true')return;
  function apply(value){const color=T.normalize(value)||T.DEFAULT;for(const [key,value] of Object.entries(T.palette(color)))document.documentElement.style.setProperty(key,value);document.documentElement.setAttribute('data-preview-color',color);}
  apply(new URLSearchParams(location.search).get('color'));
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='jei-theme-preview')return;if(event.data.color!==null&&!T.normalize(event.data.color))return;apply(event.data.color);});
})();
