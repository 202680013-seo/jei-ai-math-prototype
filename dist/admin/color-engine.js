/* Pure sRGB ↔ OKLab/OKLCH math. No DOM or dependencies. */
(function(root){
'use strict';
const steps=[50,100,200,300,400,500,600,700,800,900,950];
const normalize=v=>{v=String(v).trim();if(/^#?[\da-f]{3}$/i.test(v))v='#'+v.replace('#','').split('').map(c=>c+c).join('');if(/^#?[\da-f]{6}$/i.test(v))return '#'+v.replace('#','').toLowerCase();return null;};
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const rgb=h=>[1,3,5].map(i=>linear(parseInt(h.slice(i,i+2),16)/255));
function lch(hex){const [r,g,b]=rgb(hex),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b),L=.2104542553*l+.793617785*m-.0040720468*s,a=1.9779984951*l-2.428592205*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.808675766*s,C=Math.hypot(a,B);return [L,C,C<.00001?0:(Math.atan2(B,a)*180/Math.PI+360)%360];}
function toLinear([L,C,h]){const a=C*Math.cos(h*Math.PI/180),b=C*Math.sin(h*Math.PI/180),l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];}
const inGamut=v=>v.every(n=>n>=-1e-7&&n<=1.0000001);
function map(L,C,h){let lo=0,hi=C;if(!inGamut(toLinear([L,C,h]))){for(let i=0;i<26;i++){const mid=(lo+hi)/2;if(inGamut(toLinear([L,mid,h])))lo=mid;else hi=mid;}C=lo;}return [L,C,h];}
function hex(v){return '#'+toLinear(v).map(n=>{n=Math.max(0,Math.min(1,n));return Math.round(255*(n<=.0031308?12.92*n:1.055*n**(1/2.4)-.055)).toString(16).padStart(2,'0');}).join('');}
const css=v=>`oklch(${(v[0]*100).toFixed(3)}% ${v[1].toFixed(5)} ${v[2].toFixed(3)})`;
function palette(input){input=normalize(input);if(!input)throw Error('Invalid HEX');const [L,C,h]=lch(input),levels=[.975,.95,.90,.83,.74,.65,.56,.47,.38,.29,.21],curve=[.10,.20,.38,.60,.84,1,.94,.82,.65,.48,.32];return Object.fromEntries(steps.map((s,i)=>{const mapped=map(levels[i],Math.min(C,.23)*curve[i],h);return [s,{hex:hex(mapped),oklch:css(mapped)}];}));}
function contrast(a,b){const lum=h=>{const [r,g,B]=rgb(h);return .2126*r+.7152*g+.0722*B;},x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const ink=bg=>contrast(bg,'#ffffff')>=contrast(bg,'#000000')?'#ffffff':'#000000';
const api={steps,normalize,lch,toLinear,inGamut,map,hex,css,palette,contrast,ink};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JeiColorEngine=api;
})(globalThis);
