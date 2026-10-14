(function(root){
  'use strict';
  const DEFAULT='#9fe870',PRESETS={lime:DEFAULT,mint:'#8edbb6',sage:'#bad18d'};
  function normalize(value){return typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value.toLowerCase():null;}
  function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
  function hsl(hex){const [r,g,b]=rgb(hex),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;}return [h,s,l];}
  function fromHsl(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;const v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+v.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');}
  function luminance(hex){const v=rgb(hex).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function recolor(original,color){
    if(!normalize(color)||color===DEFAULT)return original;
    const base=original.slice(0,7),alpha=original.slice(7);if(base===DEFAULT)return color+alpha;
    const [h,s,l]=hsl(base),[targetH,targetS,targetL]=hsl(color),[baseH,baseS,baseL]=hsl(DEFAULT);
    const delta=((h-baseH+540)%360)-180,newH=(targetH+delta*.2+360)%360;
    const newS=targetS<.02?0:Math.min(.95,Math.max(.02,s*(.65+.35*targetS/baseS)));
    const weight=l>.92||l<.24?0:.45*(1-Math.abs(l-baseL));
    const newL=Math.max(.04,Math.min(.98,l+(targetL-baseL)*weight));
    return fromHsl(newH,newS,newL)+alpha;
  }
  function palette(color){
    color=normalize(color)||DEFAULT;const result={};
    for(const original of TOKENS)result['--jei-c-'+original.slice(1)]=recolor(original,color);
    const ink=recolor('#163300',color);result['--jei-accent']=color;
    result['--jei-on-accent']=contrast(color,ink)>=4.5?ink:contrast(color,'#ffffff')>contrast(color,'#000000')?'#ffffff':'#000000';
    for(const [key,url] of Object.entries(IMAGES))result[key]='url("'+url.replace(/%23([a-f\d]{6})/gi,(match,hex)=>'%23'+recolor('#'+hex.toLowerCase(),color).slice(1))+'")';
    return result;
  }
  // Original colors remain the default; tokens are generated from the V3.4 theme.
  const TOKENS=["#13221b", "#15270c55", "#163300", "#16330002", "#16330003", "#16330004", "#16330005", "#16330008", "#1633000d", "#16330012", "#16330020", "#1e3728", "#22372a", "#22392b", "#244a0d", "#244b0c", "#254018", "#25490e", "#285515", "#29431c", "#2b442e", "#2c5017", "#2d5514", "#2e4732", "#305413", "#31571c", "#315c17", "#315d17", "#315e16", "#32501f", "#325b19", "#345236", "#354b3d", "#365c20", "#365f1f", "#36691c18", "#37512b", "#385b23", "#3c5c29", "#3c621e", "#3c6c20", "#3f6328", "#416f26", "#42682c", "#42692a", "#426c27", "#427323", "#45543b", "#456a2e", "#466248", "#477b28", "#496242", "#496d32", "#49702e", "#497e2410", "#4a6542", "#4e7237", "#4e812d", "#506744", "#526b43", "#52734c", "#536946", "#53773a", "#537e36", "#547141", "#567448", "#568b32", "#57753f", "#578634", "#597444", "#59992f", "#5b8b39", "#5d913d", "#5e7450", "#60993013", "#617154", "#617451", "#627255", "#638c46", "#647758", "#65705f", "#65904730", "#66775a", "#667e53", "#668853", "#68795c", "#698057", "#6a7e5a", "#6a8258", "#6a934e", "#6aa83f", "#6aab43", "#6b7a5f", "#6baa42", "#6d7e5f", "#6eaa45", "#718261", "#71ad4310", "#73be43", "#76816d", "#76b951", "#76ba49", "#78846f", "#78ae56", "#78bb4c", "#79866e", "#79ab55", "#79b74f", "#7b8574", "#7c8674", "#7dbd50", "#7ec44b", "#81c357", "#83b15f", "#88ab70", "#89917f", "#89927f", "#8aaa76", "#8ad75240", "#8ebd6d", "#8ec565", "#8faf72", "#8fd960", "#9bc480", "#9cca7c", "#9dcb80", "#9fe870", "#a0bf88", "#a6c88e", "#aaf17d", "#adc99b", "#b0f18c", "#b3d297", "#b4c6ae", "#b6cfaa", "#b7dda2", "#b8d2a7", "#b9f191", "#badba7", "#badca6", "#bdde9e", "#bfcab6", "#bfd3b4", "#c1d8af", "#c6d6bb", "#c6ddba", "#c6e6b3", "#c8f2b1", "#c8f5a9", "#cbf3b3", "#ccd8c2", "#cce0be", "#d0f8b7", "#d1dcc8", "#d1e2c4", "#d1e6c3", "#d2e0c8", "#d3e0c9", "#d4e6c6", "#d5ebc4", "#d6eac7", "#d6ebc5", "#d7e8ca", "#d7f4c2", "#d8ebce", "#d9e4cf", "#d9e7cf", "#d9eacd", "#dbe2d5", "#dce5d4", "#dce7d2", "#dce7d3", "#dce9d1", "#dcf0cd", "#ddfac9", "#e0e6db", "#e0e7da", "#e0e8d9", "#e0e9d8", "#e1e9db", "#e3e8df", "#e3f6d5", "#e4f3d9", "#e4f7d8", "#e5ebdf", "#e5f2dd", "#e5f4da", "#e6ffd3", "#e7f5dc", "#e8f3df", "#e8f8db", "#eaf2e3", "#eaf5e1", "#eaf5e2", "#eaf7e1", "#ecf9e4", "#edf5e7", "#edf7e5", "#edf8e5", "#edf8e6", "#edf8e7", "#eef2e8", "#eef6e8", "#eef8e6", "#eff9e8", "#f0f3ed", "#f0f5eb", "#f0f9e9", "#f1f5ec", "#f1f7eb", "#f2f5ee", "#f4f9ec", "#f5f7f1", "#f6f8f2", "#f6fdf0", "#f7f9f4", "#f8fbf5", "#fcfff9"];
  const IMAGES={"--jei-img-0":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 32 32' fill='none' stroke='%23163300' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16 8C12 5 7 5 3 7v19c4-2 9-2 13 1 4-3 9-3 13-1V7c-4-2-9-2-13 1Zm0 0v19M7 11l5 1M7 16l5 1M20 12l5-1M20 17l5-1'/%3E%3C/svg%3E","--jei-img-1":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='30' height='30' fill='none' stroke='%23163300' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m8 16 5 5 12-12'/%3E%3C/svg%3E"};
  // Complete, independently designed palettes. Legacy HEX routes above stay readable.
  const THEMES={
    current:{name:'현재 컬러',description:'라임 · 따뜻한 화이트 · 짙은 초록',roles:{page:'#f7f9f4',pageEnd:'#f7f9f4',surface:'#ffffff',surfaceAlt:'#f8fbf5',soft:'#edf5e7',softStrong:'#c8f2b1',title:'#163300',text:'#305413',muted:'#65705f',line:'#e0e6db',lineStrong:'#9bc480',accent:'#9fe870',primary:'#9fe870',primaryHover:'#b0f18c',onPrimary:'#163300',brand:'#49702e',active:'#9fe870',onActive:'#163300',completed:'#f8fbf5',locked:'#f7f9f4',disabled:'#7b8574',night:'#13221b',nightSurface:'#22392b',nightLine:'#466248',nightText:'#edf8e7',overlay:'#15270c55'}},
    teal:{name:'청록',description:'물빛 배경 · 흰 카드 · 깊은 청록',roles:{page:'#edf8f8',pageEnd:'#e3f3f2',surface:'#ffffff',surfaceAlt:'#f5fafb',soft:'#e0f4f3',softStrong:'#c4e8e6',title:'#223940',text:'#344c54',muted:'#586f77',line:'#d3e4e6',lineStrong:'#75b8b8',accent:'#007f84',primary:'#007f84',primaryHover:'#006b70',onPrimary:'#ffffff',brand:'#006f75',active:'#d3efed',onActive:'#204b50',completed:'#f3faf9',locked:'#eff4f5',disabled:'#778a91',night:'#122c34',nightSurface:'#1c3e46',nightLine:'#41636c',nightText:'#e6f7f6',overlay:'#173c4266'}},
    green:{name:'초록',description:'밝은 회색 · 화이트 · 에메랄드 초록',roles:{page:'#f3f6f9',pageEnd:'#f3f6f9',surface:'#ffffff',surfaceAlt:'#f6f8fb',soft:'#e7f7f0',softStrong:'#c4edda',title:'#2c3c4e',text:'#3f5161',muted:'#5d707f',line:'#e0e7ed',lineStrong:'#84cfac',accent:'#00b878',primary:'#00875a',primaryHover:'#00724c',onPrimary:'#ffffff',brand:'#007c52',active:'#e2f7eb',onActive:'#1d503b',completed:'#f7faf9',locked:'#f1f4f8',disabled:'#7c8c9b',night:'#142c27',nightSurface:'#203c33',nightLine:'#486b5a',nightText:'#ebf8ef',overlay:'#203b4666'}}
  };
  const normalizeTheme=value=>typeof value==='string'&&Object.hasOwn(THEMES,value)?value:null;
  function presetPalette(id){
    id=normalizeTheme(id)||'current';const r=THEMES[id].roles,out=id==='current'?palette(DEFAULT):{};
    if(id!=='current'){
      // Existing illustrations and older theme-aware screens use these aliases.
      // Color families are assigned to roles, rather than rotating a single accent hue.
      const explicit={};
      const group=(role,values)=>values.split(' ').forEach(c=>explicit[c]=r[role]);
      group('page','#f7f9f4 #f6f8f2 #f0f3ed');
      group('surfaceAlt','#fcfff9 #f8fbf5 #f5f7f1 #f6fdf0');
      group('title','#163300 #244b0c #244a0d #25490e #305413');
      group('text','#45543b #31571c #365c20');
      group('muted','#65705f #627255 #617154 #617451 #647758 #66775a #68795c #6d7e5f #76816d #79866e #89917f #89927f #6a7e5a #7b8574 #7c8674 #78846f');
      group('brand','#49702e #4e812d #3c6c20 #416f26 #426c27 #427323 #477b28 #568b32 #5d913d #668853');
      group('accent','#9fe870 #8fd960 #aaf17d #b0f18c #b9f191');
      group('line','#e0e6db #e0e7da #e0e8d9 #e1e9db #d9e4cf #dbe2d5 #dce7d2 #dce7d3 #ccd8c2 #e5ebdf #d1dcc8');
      group('lineStrong','#7ec44b #6baa42 #9bc480 #78ae56 #6aa83f #81c357 #8ec565');
      group('soft','#edf5e7 #edf8e5 #edf8e6 #eef8e6 #eaf5e2 #f1f7eb #f0f9e9 #e5f4da');
      group('softStrong','#c8f2b1 #c8f5a9 #b7dda2 #d8ebce #e3f6d5');
      for(const original of TOKENS){
        const base=original.slice(0,7),alpha=original.slice(7),light=hsl(base)[2];
        const role=light<.24?'title':light<.40?'brand':light<.56?'muted':light<.70?'accent':light<.84?'softStrong':light<.94?'line':'soft';
        out['--jei-c-'+original.slice(1)]=(explicit[base]||r[role])+alpha;
      }
      for(const [key,url] of Object.entries(IMAGES))out[key]='url("'+url.replace(/%23([a-f\d]{6})/gi,()=>'%23'+r.brand.slice(1))+'")';
      out['--jei-accent']=r.accent;out['--jei-on-accent']=contrast(r.accent,r.onActive)>=4.5?r.onActive:contrast(r.accent,'#ffffff')>=4.5?'#ffffff':'#12382b';
    }
    for(const [key,value] of Object.entries(r))out['--theme-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=value;
    return out;
  }
  const api={DEFAULT,PRESETS,normalize,contrast,recolor,palette,THEMES,normalizeTheme,presetPalette};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JeiTheme=api;
})(typeof window!=='undefined'?window:globalThis);
