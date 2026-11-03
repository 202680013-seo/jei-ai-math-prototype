/* Shared editor color values, including alpha. */
(function(root){'use strict';
function normalize(v){v=String(v??'').trim().toLowerCase();if(v==='transparent'||v==='투명')return '#00000000';if(/^#?[a-f\d]{6}(?:[a-f\d]{2})?$/.test(v))return '#'+v.replace('#','');if(/^#[a-f\d]{3,4}$/.test(v))return '#'+v.slice(1).split('').map(c=>c+c).join('');return null;}
function fromCSS(v){const h=normalize(v);if(h)return h;const nums=String(v).match(/^rgba?\((.+)\)$/)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);if(!nums||nums.length<3)return '#ffffff';const rgb=nums.slice(0,3).map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join(''),a=nums[3]??1;return '#'+rgb+(a<1?Math.round(Math.max(0,a)*255).toString(16).padStart(2,'0'):'');}
const base=c=>(normalize(c)||fromCSS(c)).slice(0,7);
const opacity=c=>{c=normalize(c)||fromCSS(c);return c.length===9?Math.round(parseInt(c.slice(7),16)/255*100):100;};
function withOpacity(c,p){c=base(c);p=Math.max(0,Math.min(100,Number(p)));return c+(p===100?'':Math.round(p/100*255).toString(16).padStart(2,'0'));}
function composite(front,back='#ffffff'){front=normalize(front)||fromCSS(front);back=normalize(back)||fromCSS(back);const alpha=front.length===9?parseInt(front.slice(7),16)/255:1;return '#'+[1,3,5].map(i=>Math.round(parseInt(front.slice(i,i+2),16)*alpha+parseInt(back.slice(i,i+2),16)*(1-alpha)).toString(16).padStart(2,'0')).join('');}
const api={normalize,fromCSS,base,opacity,withOpacity,composite};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JeiDesignColors=api;
})(globalThis);
