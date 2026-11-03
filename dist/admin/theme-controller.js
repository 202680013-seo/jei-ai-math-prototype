/* State and token adapter. Existing learner state and report color variants stay independent. */
(function(){
'use strict';const E=window.JeiColorEngine,R=document.documentElement,key='jei-color-studio-v1';
let storageError=false;const initial={version:1,current:{mode:'default',hex:'#e5303a'},slots:[null,null,null]};let state=structuredClone(initial);
const valid=v=>v&&['default','custom'].includes(v.mode)&&E.normalize(v.hex);
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1&&valid(saved.current)){state={version:1,current:{mode:saved.current.mode,hex:E.normalize(saved.current.hex)},slots:[0,1,2].map(i=>{const v=saved.slots?.[i];return valid(v)&&typeof v.name==='string'?{mode:v.mode,hex:E.normalize(v.hex),name:v.name.slice(0,32)}:null;})};}}catch{storageError=true;}
// Retain the exact original red scale for default and reset; generated only for custom themes.
const brand=["#FEF2F2","#FFE2E2","#FFC9C9","#FFA2A2","#FF6467","#FB2C36","#E7000B","#C10007","#9F0712","#82181A","#460809"];
let tokens={},activePalette={};
function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch{storageError=true;}}
function apply(){const custom=state.current.mode==='custom',p=custom?E.palette(state.current.hex):Object.fromEntries(E.steps.map((s,i)=>[s,{hex:brand[i],oklch:E.css(E.lch(brand[i]))}]));activePalette=p;tokens={};
for(const s of E.steps){tokens['--color-accent-'+s]=p[s].hex;tokens['--accent-'+s]='var(--color-accent-'+s+')';}
const ref=(n)=>`var(--accent-${n})`;
Object.assign(tokens,{'--color-primary':ref(600),'--color-primary-hover':ref(700),'--color-primary-active':ref(800),'--color-primary-subtle':ref(200),'--color-on-primary':E.ink(p[600].hex),'--color-on-primary-hover':E.ink(p[700].hex),'--color-on-primary-active':E.ink(p[800].hex),'--color-focus-ring':ref(700),'--theme-primary':'var(--color-primary)','--theme-primary-hover':'var(--color-primary-hover)','--theme-on-primary':'var(--color-on-primary)','--theme-accent':ref(500),'--jei-accent':ref(500),'--theme-soft':'var(--color-primary-subtle)','--theme-soft-strong':ref(300)});
R.toggleAttribute('data-custom-accent',custom);
for(const [k,v]of Object.entries(tokens))R.style.setProperty(k,v);
window.dispatchEvent(new CustomEvent('jei-color-change'));
}
function select(hex){hex=E.normalize(hex);if(!hex)return false;state.current={mode:'custom',hex};apply();persist();return true;}
function reset(){state.current={...initial.current};apply();persist();}
function save(i,name){if(i<0||i>2)return;state.slots[i]={...state.current,name:(name.trim()||`컬러 시안 ${i+1}`).slice(0,32)};persist();window.dispatchEvent(new CustomEvent('jei-color-change'));}
function load(i){if(!state.slots[i])return;const {mode,hex}=state.slots[i];state.current={mode,hex};apply();persist();}
function remove(i){state.slots[i]=null;persist();window.dispatchEvent(new CustomEvent('jei-color-change'));}
// Existing color1/2 control may rewrite inline theme variables asynchronously. Reapply after that commit.
new MutationObserver(records=>{if(records.some(r=>r.attributeName==='data-report-theme'))apply();}).observe(R,{attributes:true,attributeFilter:['data-report-theme']});
window.JeiThemeStudio={select,reset,save,load,remove,apply,get state(){return structuredClone(state);},get palette(){return activePalette;},get storageError(){return storageError;},exportCSS(){return ':root {\n'+Object.entries(tokens).map(([k,v])=>`  ${k}: ${v};`).join('\n')+'\n}';}};
apply();
})();
