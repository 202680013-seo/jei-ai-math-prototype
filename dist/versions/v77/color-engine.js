(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function lab(hex){const rgb=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4),[r,g,b]=rgb;
const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
const L=.2104542553*l+.793617785*m-.0040720468*s,a=1.9779984951*l-2.428592205*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.808675766*s;return {l:L,c:Math.hypot(a,B),h:(Math.atan2(B,a)*180/Math.PI+360)%360};}
function linear(l,c,h){const a=c*Math.cos(h*Math.PI/180),b=c*Math.sin(h*Math.PI/180),L=(l+.3963377774*a+.2158037573*b)**3,M=(l-.1055613458*a-.0638541728*b)**3,S=(l-.0894841775*a-1.291485548*b)**3;return [4.0767416621*L-3.3077115913*M+.2309699292*S,-1.2684380046*L+2.6097574011*M-.3413193965*S,-.0041960863*L-.7034186147*M+1.707614701*S];}
function hex(l,c,h){l=clamp(l,0,1);let rgb=linear(l,c,h);if(rgb.some(x=>x<0||x>1)){let lo=0,hi=c;for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(linear(l,mid,h).every(x=>x>=0&&x<=1))lo=mid;else hi=mid;}rgb=linear(l,lo,h);}return '#'+rgb.map(x=>Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055))).map(x=>clamp(x,0,255).toString(16).padStart(2,'0')).join('');}
function luminance(h){return h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function palette(input){const v={l:clamp(Number(input.l)||.6,.15,.9),c:clamp(Number(input.c)||0,0,.32),h:((Number(input.h)||0)%360+360)%360},c=v.c,h=v.h,tone=(l,f=1)=>hex(l,c*f,h);let p=clamp(v.l,.28,.65);while(contrast(tone(p),'#ffffff')<4.5&&p>.2)p-=.005;
return {seed:tone(v.l),page:tone(.99,.025),surface:'#ffffff',surfaceAlt:tone(.966,.035),soft:tone(.952,.14),active:tone(.925,.22),activeHover:tone(.895,.28),border:tone(.86,.12),strongBorder:tone(.76,.4),text:tone(.29,.1),muted:tone(.48,.12),primary:tone(p),hover:tone(Math.max(.2,p-.065)),accent:tone(Math.min(.68,p+.06)),onPrimary:'#ffffff',disabled:tone(.7,.035),light:tone(.977,.08),night:tone(.29,.2),v};}
const api={lab,hex,palette,contrast};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JeiOKLCH=api;
})(typeof window!=='undefined'?window:globalThis);
