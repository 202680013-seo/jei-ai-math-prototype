(function(){'use strict';
const R=document.documentElement,E=window.JeiColorEngine,C=window.JeiDesignColors,T=window.JeiThemeStudio,D=window.JeiDesignStore.create(localStorage);window.JeiDesignEditor=D;
// Tailwind CSS v4 theme.css OKLCH palette, converted to sRGB HEX.
const presets={"red":{"label":"빨강","colors":["#fef2f2","#ffe2e2","#ffc9c9","#ffa2a2","#ff6467","#fb2c36","#e7000b","#c10007","#9f0712","#82181a","#460809"]},"yellow":{"label":"노랑","colors":["#fefce8","#fef9c2","#fff085","#ffdf20","#fdc700","#f0b100","#d08700","#a65f00","#894b00","#733e0a","#432004"]},"green":{"label":"초록","colors":["#f0fdf4","#dcfce7","#b9f8cf","#7bf1a8","#05df72","#00c950","#00a63e","#008236","#016630","#0d542b","#032e15"]},"blue":{"label":"파랑","colors":["#eff6ff","#dbeafe","#bedbff","#8ec5ff","#51a2ff","#2b7fff","#155dfc","#1447e6","#193cb8","#1c398e","#162456"]},"violet":{"label":"보라","colors":["#f5f3ff","#ede9fe","#ddd6ff","#c4b4ff","#a684ff","#8e51ff","#7f22fe","#7008e7","#5d0ec0","#4d179a","#2f0d68"]}};
const roleGroups=[
 ['Primary',[['메인 컬러','--theme-primary'],['버튼 텍스트','--theme-on-primary'],['Hover','--theme-primary-hover'],['AI 추천 테두리','--theme-recommend-border'],['AI 추천 배경','--theme-recommend-bg'],['말풍선 테두리','--theme-mentor-border'],['말풍선 배경','--theme-mentor-bg'],['강조 배경','--theme-soft']]],
 ['Neutral',[['강조 텍스트','--theme-brand'],['말풍선 텍스트','--theme-mentor-text'],['제목','--theme-title'],['본문','--theme-text'],['보조 텍스트','--theme-muted'],['테두리·구분선','--theme-line'],['비활성 텍스트','--theme-disabled'],['카드·팝업','--theme-surface'],['보조 배경','--theme-surface-alt']]],
 ['Semantic Color',[['완료','--status-pass-fill'],['정답','--status-correct'],['오답','--status-wrong'],['재학습','--status-review-fill'],['시작 전','--navigation-idle'],['잠금 아이콘','--status-lock-fill'],['잠금 배경','--status-lock-surface']]]
];
const paletteGroups = [['Primary','accent'],['Neutral','neutral'],['Semantic · 완료','info'],['Semantic · 정답','success'],['Semantic · 재학습','warning'],['Semantic · 오답','danger']];
const groups=[['#grade-badge','등급 배지'],['.program-title','카드 제목'],['.card-start-box','학습 버튼'],['.diagnostic-start-button','진단 버튼'],['.primary','주요 버튼'],['.program-card.is-complete','완료 카드'],['.program-card.is-locked','잠금 카드'],['.program-card','학습 카드'],['.group-item','학습 주제'],['.question-choices>button','답안'],['.recommend','AI 추천'],['.mentor-bubble','말풍선'],['h1','제목'],['h2','제목'],['input','입력 필드'],['button','버튼']];
const targets={
 '--theme-recommend-border':[['.ai .recommend,.ai .recommend-label','border-color']],
 '--theme-recommend-bg':[['.ai .recommend','background-color']],
 '--theme-mentor-text':[['.ai #ai-message,.ai .mentor-dots','color']],
 '--theme-primary':[['.primary,.card-start-box,#diagnosis-welcome-action>.diagnostic-start-button','background-color']],
 '--theme-primary-hover':[['.primary:hover:not(:disabled),.program-card:hover .card-start-box,#diagnosis-welcome-action>.diagnostic-start-button:hover','background-color']],
 '--theme-on-primary':[['.primary,.card-start-box,#diagnosis-welcome-action>.diagnostic-start-button','color']],
 '--theme-brand':[['#grade-badge,.group-item.selected,.rail-current-highlight','color']],
 '--theme-soft':[['.program-card:is(.is-ready,.is-current,.is-introduced),.question-choices>button.answer-selected','background-color']],
 '--theme-surface':[['.program-card.is-complete,dialog,.recommend','background-color']],
 '--theme-surface-alt':[['.program-card.is-locked','background-color']],
 '--theme-title':[['#group-title,.program-title,.diagnosis-screen h1,.diagnosis-screen h2','color']],
 '--theme-text':[['#learning-workspace p,.lesson-question p','color']],
 '--theme-muted':[['#learning-workspace small,.welcome-progress-count','color']],
 '--theme-disabled':[['#group-panel .group-item:disabled .nav-topic-copy strong,#group-panel .group-item:disabled .nav-topic-number,.grid>.program-card.is-locked>.program-title','color']],
 '--theme-line':[['.ai::after','background-color'],['.program-card.is-complete,.question-choices>button','border-color']],
 '--status-lock-surface':[['.program-card.is-locked','background-color']],
 '--status-lock-fill':[['.program-card.is-locked','color']],
 '--status-correct':[['.question-choices>button.answer-correct','border-color']],
 '--status-wrong':[['.question-choices>button.answer-wrong','border-color']]
};
let active=false,tab='global',selected=null,selectedKey='',scope='one',state='base',scheduled=false;
const host=document.createElement('aside');host.id='design-studio';host.lang='ko';host.hidden=true;host.setAttribute('aria-label','디자인모드');
const outline=document.createElement('div');outline.id='design-highlight';outline.hidden=true;
const overrides=document.createElement('style');overrides.id='design-overrides';document.head.append(overrides);document.body.append(host,outline);
const dock=document.querySelector('#report-dock'),controls=document.querySelector('#report-controls');
const modes=document.createElement('div');modes.className='report-segment report-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','작업 모드');modes.innerHTML='<button type="button" id="scenario-mode" data-action="test">시나리오</button><button type="button" id="design-mode" aria-pressed="false">디자인</button>';controls.append(modes);
const designButton=modes.querySelector('#design-mode'),scenarioButton=modes.querySelector('#scenario-mode');
scenarioButton.addEventListener('click',e=>{setMode(false);if(document.querySelector('dialog[open]')&&typeof window.resetValidationSurfaces==='function'){e.stopPropagation();window.resetValidationSurfaces();mount();window.openPanel('test');}});designButton.addEventListener('click',()=>{if(!active)document.querySelector('#test-panel:not([hidden]) [data-action="close-panel"]')?.click();setMode(!active);});
const panelView=new Map();
let renderedTab=null;
const defaultDesignKey='jei-design-default-v1';
if(!localStorage.getItem(defaultDesignKey))localStorage.setItem(defaultDesignKey,D.export(T.state.current));
function setMode(value){active=!!value;host.hidden=!active;R.toggleAttribute('data-design-editing',active);R.toggleAttribute('data-design-picking',active);designButton.setAttribute('aria-pressed',String(active));scenarioButton.setAttribute('aria-pressed',String(!active));if(!active){panelView.clear();renderedTab=null;selected?.removeAttribute('data-ds-preview');outline.hidden=true;}else{tab='global';render();mark(selected);} }
scenarioButton.setAttribute('aria-pressed','true');
const own=el=>el?.closest?.('#design-studio,#report-dock,#test-panel');
function block(e){e.preventDefault();e.stopImmediatePropagation();}
// Window capture runs before the existing document-level learning handlers.
window.addEventListener('pointerdown',e=>{if(!active||own(e.target))return;block(e);choose(normalizeTarget(e.target));},true);
window.addEventListener('click',e=>{if(!active||own(e.target))return;block(e);if(e.detail===0)choose(normalizeTarget(e.target));},true);
for(const name of ['pointerup','dblclick','contextmenu'])window.addEventListener(name,e=>{if(active&&!own(e.target))block(e);},true);
window.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){block(e);setMode(false);return;}if(!own(e.target)&&['Enter',' '].includes(e.key)){block(e);choose(normalizeTarget(e.target));}},true);
window.addEventListener('pointerover',e=>{if(active&&!own(e.target))mark(normalizeTarget(e.target));},true);
window.addEventListener('scroll',()=>{if(active)mark(resolve());},{capture:true,passive:true});
function normalizeTarget(el){if(!(el instanceof Element))return null;if(el.closest('#grade-badge'))return el.closest('#grade-badge');if(el instanceof SVGElement||el.tagName==='IMG')return el.closest('button,.program-card,.group-item')||el;if(el.tagName==='DIV'&&el.closest('.program-card'))return el.closest('.program-card');return el;}
function context(){try{const s=window.__JEI_REVIEW_BRIDGE__?.capture().appState;if(s)R.dataset.dsContext=`g${s.grade}-t${s.index}`;}catch{}}
context();
function key(el){const card=el.closest('.program-card[data-id]');if(card){let tail=[],n=el;while(n!==card){tail.unshift(part(n));n=n.parentElement;}return `html[data-ds-context="${R.dataset.dsContext||'main'}"] .program-card[data-id="${card.dataset.id}"]${tail.length?'>'+tail.join('>'):''}`;}if(el.id)return '#'+CSS.escape(el.id);let bits=[],n=el;while(n&&n!==document.body){if(n.id){bits.unshift('#'+CSS.escape(n.id));break;}bits.unshift(part(n));n=n.parentElement;}return bits.join('>');}
function part(el){const peers=[...el.parentElement.children].filter(x=>x.tagName===el.tagName);return el.tagName.toLowerCase()+`:nth-of-type(${peers.indexOf(el)+1})`;}
function kind(el){return groups.find(([s])=>el.matches(s))||[key(el),'선택 요소'];}
function resolve(){if(selected&&!selected.isConnected)selected=selectedKey?document.querySelector(selectedKey):null;return selected;}
function choose(el){if(!el||own(el)||el===document.body||el===R)return;selected?.removeAttribute('data-ds-preview');selected=el;selectedKey=key(el);state='base';tab='element';el.setAttribute('data-ds-preview',state);render();mark(el);}
function mark(el){if(!active||!el?.isConnected){outline.hidden=true;return;}const b=el.getBoundingClientRect();Object.assign(outline.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'});outline.hidden=false;}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hex(v){return C.fromCSS(v);}
function value(role){return hex(getComputedStyle(R).getPropertyValue(role).trim());}
const fonts={square:"'NanumSquare',sans-serif",round:"'NanumSquareRound',sans-serif",pretendard:"'Pretendard',sans-serif"};
function apply(){const d=D.data;let variables={...d.roles};
variables['--theme-page']='#ffffff';
if(d.roles['--theme-primary']&&!d.roles['--theme-primary'].startsWith('var(')&&!d.roles['--primary-seed']){const c=d.roles['--theme-primary'],p=E.palette(C.base(c));for(const s of E.steps)variables['--color-accent-'+s]=d.roles['--color-accent-'+s]||p[s].hex;Object.assign(variables,{'--theme-accent':c,'--color-primary':c,'--color-on-primary':d.roles['--theme-on-primary']||E.ink(C.composite(c,C.composite(value('--theme-page')))),'--theme-on-primary':d.roles['--theme-on-primary']||E.ink(C.composite(c,C.composite(value('--theme-page')))),'--color-primary-hover':d.roles['--theme-primary-hover']||p[700].hex,'--theme-primary-hover':d.roles['--theme-primary-hover']||p[700].hex,'--theme-soft':d.roles['--theme-soft']||p[200].hex,'--theme-recommend-bg':d.roles['--theme-recommend-bg']||p[50].hex,'--theme-recommend-border':d.roles['--theme-recommend-border']||p[200].hex,'--theme-mentor-bg':d.roles['--theme-mentor-bg']||p[100].hex,'--theme-mentor-border':d.roles['--theme-mentor-border']||p[300].hex});}
const seed=d.roles['--primary-seed'];
if(seed){
  const palette=E.palette(C.base(seed));
  for(const step of E.steps){
    const key='--color-accent-'+step;
    variables[key]=step===500?C.base(seed):d.roles[key]||palette[step].hex;
  }
  const primary=d.roles['--theme-primary']||'var(--color-accent-600)';
  const background=variables['--color-accent-600'];
  Object.assign(variables,{
    '--theme-primary':primary,'--color-primary':primary,
    '--theme-primary-hover':d.roles['--theme-primary-hover']||'var(--color-accent-700)',
    '--color-primary-hover':d.roles['--theme-primary-hover']||'var(--color-accent-700)',
    '--theme-soft':d.roles['--theme-soft']||'var(--color-accent-200)',
    '--theme-on-primary':d.roles['--theme-on-primary']||E.ink(background),
    '--color-on-primary':d.roles['--theme-on-primary']||E.ink(background),
    '--theme-accent':'var(--color-accent-500)'
  });
}
Object.assign(variables,Object.fromEntries(Object.entries(d.roles).filter(([,v])=>v.startsWith('var('))));
let css='html[data-report-variant] {'+Object.entries(variables).map(([k,v])=>`${k}:${v}!important;`).join('')+'}';
if(d.roles['--theme-primary'])css+='.program-card .card-progress progress::-webkit-progress-bar{background:var(--accent-300)!important}.program-card .card-progress progress{background:var(--accent-300)!important}';
css+=`html body :not(#design-studio):not(#design-studio *):not(#report-dock):not(#report-dock *):not(#test-panel):not(#test-panel *){font-family:${fonts[d.font]||fonts.square}!important;}`;
for(const [role,routes]of Object.entries(targets)){const c=variables[role];if(c)for(const [s,p]of routes)css+=`${s}{${p}:${c}!important;${p==='background-color'?'background-image:none!important;':''}}`;}
if(variables['--theme-recommend-bg'])css+='#recommend,.recommend-label{background-color:transparent!important;background-image:none!important}';
for(const r of d.rules){const suffix={base:'',hover:':hover',active:':active',disabled:':disabled'}[r.state];const selector=r.state==='base'?r.selector:`${r.selector}${suffix},${r.selector}[data-ds-preview="${r.state}"]`;css+=`${':is('+selector+',#design-overrides#design-studio)'}{${Object.entries(r.props).map(([p,v])=>`${p}:${v}!important;${p==='background-color'?'background-image:none!important;':''}`).join('')}}`;}
overrides.textContent=css;syncAssets();updateTools();syncRoleFields();checkContrast();}
function syncStatusIcons(){for(const [role,sel,path]of [['--status-pass-fill','.passed-card .figma-status-icon','<path d="m13 22 6 6 12-13" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'],['--status-review-fill','.failed-card .figma-status-icon','<path d="M22 12v12" stroke="white" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="32" r="2.5" fill="white"/>']]){const family=role==='--status-pass-fill'?'info':'warning';const color=D.data.roles[role]||D.data.roles['--color-'+family+'-600'];const iconColor=color?value(role):null;document.querySelectorAll(sel).forEach(img=>{if(img.tagName!=='IMG')return;if(!iconColor){if(img.dataset.dsOriginalSrc){img.src=img.dataset.dsOriginalSrc;delete img.dataset.dsOriginalSrc;}return;}if(!img.dataset.dsOriginalSrc)img.dataset.dsOriginalSrc=img.src;const src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="${iconColor}"/>${path}</svg>`);if(img.getAttribute('src')!==src)img.src=src;});}}const artCache=new Map();
function syncAssets(){syncStatusIcons();const color=value('--theme-primary');document.querySelectorAll('img.active-card-art').forEach(img=>{const src=img.getAttribute('src');if(!src||src===img.dataset.dsTintedSrc)return;let svg;try{if(src.startsWith('data:image/svg+xml;base64,'))svg=atob(src.split(',')[1]);else if(src.startsWith('data:image/svg+xml,'))svg=decodeURIComponent(src.slice(src.indexOf(',')+1));else{if(artCache.has(src)){svg=artCache.get(src);}else{fetch(src).then(r=>{if(!r.ok)throw Error('SVG load');return r.text();}).then(s=>{artCache.set(src,s);syncAssets();}).catch(()=>{});return;}}}catch{return;}
if(!img.dataset.dsOriginalArt)img.dataset.dsOriginalArt=svg;svg=img.dataset.dsOriginalArt;const tinted=svg.replace(/#(?:e5303a|d62532|b81f2e|0ec7ae|0cad98|2c64c8)\b/gi,color);const next='data:image/svg+xml,'+encodeURIComponent(tinted);img.dataset.dsTintedSrc=next;if(src!==next)img.setAttribute('src',next);});}
function recolorArt(){document.querySelectorAll('img.active-card-art[data-ds-tinted-src]').forEach(img=>{const svg=img.dataset.dsOriginalArt;if(!svg)return;const next='data:image/svg+xml,'+encodeURIComponent(svg.replace(/#(?:e5303a|d62532|b81f2e|0ec7ae|0cad98|2c64c8)\b/gi,value('--theme-primary')));img.dataset.dsTintedSrc=next;if(img.getAttribute('src')!==next)img.src=next;});}
function colorRow(label,role,property,current){const id=role||property,key=escape(id),c=C.normalize(current)||C.fromCSS(current);return `<label class="ds-color-row"><span>${label}</span><span class="ds-field" data-color-key="${key}" style="--ds-color:${c}"><span class="ds-swatch"><input type="color" ${role?`data-role="${role}"`:`data-prop="${property}"`} value="${C.base(c)}" aria-label="${label} 색상"></span><input type="text" class="ds-hex" ${role?`data-hex-role="${role}"`:`data-hex-prop="${property}"`} value="${c}" spellcheck="false" maxlength="11" aria-label="${label} HEX"><span class="ds-alpha"><input type="number" min="0" max="100" step="1" data-alpha="${key}" value="${C.opacity(c)}" aria-label="${label} 불투명도" title="불투명도 · 0%는 투명">%</span><button type="button" class="ds-reset" ${role?`data-reset-role="${role}"`:`data-reset-prop="${property}"`} title="${label} 초기화" aria-label="${label} 초기화">↺</button></span></label>`;}
const familyRoles={
  neutral:{'--theme-brand':800,'--theme-title':900,'--theme-text':900,'--theme-muted':600,'--theme-disabled':600,'--theme-line':200,'--theme-surface':50,'--theme-surface-alt':100,'--theme-mentor-text':900,'--status-lock-fill':400,'--status-lock-surface':100,'--navigation-idle':400},
  info:{'--status-pass-fill':600},
  success:{'--status-correct':700},
  warning:{'--status-review-fill':700},
  danger:{'--status-wrong':700}
};
const grayLevels=[250,245,229,212,163,115,82,64,38,23,10];
const grayRamp=offsets=>grayLevels.map(level=>'#'+offsets.map(offset=>Math.max(0,Math.min(255,level+offset)).toString(16).padStart(2,'0')).join(''));
const neutralPresets=[
  ['회색',grayRamp([0,0,0])],
  ['중간 쿨그레이',grayRamp([-4,0,5])],
  ['웜그레이',grayRamp([9,3,-6])],
  ['쿨그레이',grayRamp([-8,1,10])]
];
const semanticPresets=[
  ...Object.values(presets).map(({label,colors})=>[label,colors]),
  ['앰버',E.steps.map(step=>E.palette('#d97706')[step].hex)]
];
function palettePicker(family,label,choices){
  const section=document.createElement('section');
  section.className='ds-primary ds-family-picker';
  section.dataset.family=family;
  section.innerHTML=`<h3>${label}</h3><div class="ds-presets" role="group" aria-label="${label} 팔레트">${choices.map(([name,colors],index)=>`<button type="button" data-palette-choice="${index}" aria-label="${name}" title="${name}" aria-pressed="false" style="--preset-color:${colors[5]}"></button>`).join('')}</div><div class="ds-ramp" aria-hidden="true">${E.steps.map(step=>`<span style="background:var(--color-${family}-${step})"></span>`).join('')}</div>`;
  section.querySelectorAll('button').forEach(button=>button.onclick=()=>{
    const [,colors]=choices[Number(button.dataset.paletteChoice)];
    D.setPalette(family,Object.fromEntries(E.steps.map((step,index)=>[step,colors[index]])),familyRoles[family]);
  });
  return section;
}
function paletteOptions(current){
  const choices=[['White','--color-white'],['Black','--color-black'],
    ...paletteGroups.flatMap(([name,family])=>E.steps.map(step=>[name+' '+step,'--color-'+family+'-'+step]))];
  return choices.map(([label,key])=>{
    const token='var('+key+')';
    return `<option value="${token}" ${current===token?'selected':''}>${label}</option>`;
  }).join('');
}
function roleEditor(label,key){
  return colorRow(label,key,null,value(key))+`<label class="ds-select-row">팔레트 연결<select data-palette-role="${key}"><option value="">기본 연결 / 직접 지정</option>${paletteOptions(D.data.roles[key])}</select></label>`;
}
function elementColorEditor(label,property,current){
  const selector=scope==='kind'?kind(resolve())[0]:selectedKey;
  const stored=D.data.rules.find(rule=>rule.selector===selector&&rule.state===state)?.props[property];
  return colorRow(label,null,property,current)+`<label class="ds-select-row">${label} 팔레트 연결<select data-element-palette="${property}"><option value="">기본색 / 직접 지정</option>${paletteOptions(stored)}</select></label>`;
}
function render(){
  if(renderedTab!==null)panelView.set(renderedTab,{
    scroll:host.scrollTop,
    open:[...host.querySelectorAll('#ds-content details')].map(detail=>detail.open)
  });
  const el=resolve();host.innerHTML=`<header class="ds-head"><h2>디자인모드</h2><div><button id="ds-undo" title="실행 취소" aria-label="실행 취소">← 취소</button><button id="ds-redo" title="다시 실행" aria-label="다시 실행">다시 →</button><button id="ds-close" title="디자인모드 종료" aria-label="디자인모드 종료">×</button></div></header><nav class="ds-tabs" role="tablist" aria-label="디자인 편집">${[['global','테마'],['element','요소'],['plans','시안']].map(([k,n])=>`<button role="tab" data-tab="${k}" aria-selected="${tab===k}">${n}</button>`).join('')}</nav><div id="ds-content">${tab==='element'?el?`<div class="ds-selection"><strong>${escape(kind(el)[1])}</strong><button id="ds-parent" title="상위 요소 선택" aria-label="상위 요소 선택">↑</button></div><label class="ds-select-row">적용<select id="ds-scope"><option value="one">이 요소</option><option value="kind">같은 종류 전체</option></select></label><label class="ds-select-row">상태<select id="ds-state">${[['base','기본'],['hover','Hover'],['active','누름'],['disabled','비활성']].map(([k,n])=>`<option value="${k}" ${state===k?'selected':''}>${n}</option>`).join('')}</select></label><section id="ds-fields"></section>`:'<div class="ds-empty"><span aria-hidden="true">⌖</span><p>편집할 요소를 클릭하세요.</p></div>':tab==='global'?`<label class="ds-select-row ds-font-row">서체<select id="ds-font">${[['square','나눔스퀘어'],['round','나눔스퀘어라운드'],['pretendard','Pretendard']].map(([k,n])=>`<option value="${k}" ${D.data.font===k?'selected':''}>${n}</option>`).join('')}</select></label>${roleGroups.map(([name,roles],i)=>`<details class="ds-role-group" ${false?'open':''}><summary>${name}</summary>${roles.map(([n,k])=>roleEditor(n,k)).join('')}</details>`).join('')}`:plansHTML()}</div><div id="ds-contrast" hidden></div><p id="ds-status" role="status" aria-live="polite"></p>`;
if(tab==='global'){
  const area=host.querySelector('#ds-content');
  area.insertAdjacentHTML('afterbegin',`<section class="ds-primary"><h3>메인 컬러</h3>${colorRow('기준 색상','--primary-seed',null,D.data.roles['--primary-seed']||value('--color-accent-500'))}<div class="ds-presets" aria-label="Tailwind 색상 프리셋">${Object.entries(presets).map(([id,preset])=>`<button type="button" data-color-preset="${id}" aria-label="${preset.label}" title="${preset.label}" style="--preset-color:${preset.colors[5]}"></button>`).join('')}</div><div class="ds-ramp" aria-label="Primary 50–950">${E.steps.map(step=>`<span title="Primary ${step}" style="background:var(--color-accent-${step})"></span>`).join('')}</div></section>`);
  area.querySelectorAll('[data-color-preset]').forEach(button=>button.onclick=()=>{
    const {colors}=presets[button.dataset.colorPreset];
    D.setPrimarySeed(colors[5],Object.fromEntries(E.steps.map((step,index)=>['--color-accent-'+step,colors[index]])));
    render();
  });
  const advanced=document.createElement('details');
  advanced.className='ds-palette';
  advanced.innerHTML='<summary>고급 색상 설정</summary>';
  area.append(advanced);
  area.querySelectorAll('.ds-role-group').forEach(group=>advanced.append(group));
  area.querySelectorAll('[data-palette-role]').forEach(select=>select.onchange=()=>{D.setRole(select.dataset.paletteRole,select.value||null);render();});
  advanced.insertAdjacentHTML('beforeend',paletteGroups.map(([label,name])=>`<details class="ds-palette"><summary>${label} · 50–950</summary>${E.steps.map(step=>{const key='--color-'+name+'-'+step;return colorRow(String(step),key,null,value(key));}).join('')}</details>`).join(''));
  area.querySelector('.ds-primary').after(palettePicker('neutral','Neutral',neutralPresets));
  const semantic=document.createElement('details');
  semantic.className='ds-palette';
  semantic.innerHTML='<summary>Semantic 색상</summary>';
  for(const [label,family] of paletteGroups.slice(2)) semantic.append(palettePicker(family,label.replace('Semantic · ',''),semanticPresets));
  area.querySelector('.ds-primary').nextElementSibling.after(semantic);
}
wire();if(tab==='element'&&el)renderFields();updateTools();syncRoleFields();checkContrast();
const view=panelView.get(tab);
if(view)host.querySelectorAll('#ds-content details').forEach((detail,index)=>{if(index<view.open.length)detail.open=view.open[index];});
host.scrollTop=view?.scroll||0;
renderedTab=tab;
}
function renderFields(){const el=resolve(),area=host.querySelector('#ds-fields');if(!el||!area)return;host.querySelector('#ds-scope').value=scope;const computed=getComputedStyle(el),bg=computed.backgroundColor;
if(el.closest('#mentor-bubble')){
  const stops=[['배경 시작','--theme-mentor-bg'],['배경 중간','--mentor-bg-middle'],['배경 끝','--mentor-bg-end'],['테두리 시작','--theme-mentor-border'],['테두리 중간','--mentor-border-middle'],['테두리 끝','--mentor-border-end'],['글자·점','--theme-mentor-text']];
  area.innerHTML='<h3>멘토 말풍선 그라데이션</h3>'+stops.map(([label,key])=>colorRow(label,key,null,value(key))).join('');
  wireColors();
  return;
}
area.innerHTML=elementColorEditor('배경','background-color',hex(bg))+elementColorEditor('텍스트','color',hex(computed.color))+elementColorEditor('테두리','border-color',hex(computed.borderColor))+`<label class="ds-border-width">테두리 두께<span><input type="number" min="0" max="40" step="0.5" data-number="border-width" value="${parseFloat(computed.borderTopWidth)||0}" aria-label="테두리 두께">px<button type="button" class="ds-reset" data-reset-prop="border-width" aria-label="테두리 두께 초기화">↺</button></span></label><div class="ds-dimensions"><label>크기<input type="number" min="0" max="160" data-number="font-size" value="${parseFloat(computed.fontSize)||14}" aria-label="글자 크기"></label><label>굵기<select id="ds-weight">${[400,600,700,800].map(n=>`<option value="${n}" ${computed.fontWeight==n?'selected':''}>${n}</option>`).join('')}</select></label><label>모서리<input type="number" min="0" max="160" data-number="border-radius" value="${parseFloat(computed.borderRadius)||0}" aria-label="모서리"></label></div>`;wireColors();area.querySelectorAll('[data-element-palette]').forEach(select=>select.onchange=()=>{edit(select.dataset.elementPalette,select.value||null);renderFields();});area.querySelectorAll('[data-number]').forEach(x=>x.oninput=()=>edit(x.dataset.number,Math.min(x.dataset.number==='border-width'?40:160,Math.max(0,+x.value))+'px'));area.querySelector('#ds-weight').onchange=e=>edit('font-weight',e.target.value);}
function edit(property,c){const el=resolve();if(!el)return;const selector=scope==='kind'?kind(el)[0]:selectedKey;if(property==='border-width'&&c&&parseFloat(c)>0&&getComputedStyle(el).borderTopStyle==='none')D.setRule(selector,state,'border-style','solid');D.setRule(selector,state,property,c);if(property==='border-width'&&!c)D.setRule(selector,state,'border-style',null);recolorArt();}
function paint(row,c,except){row.style.setProperty('--ds-color',c);row.querySelectorAll('input').forEach(x=>{if(x===except)return;x.value=x.hasAttribute('data-alpha')?C.opacity(c):x.type==='color'?C.base(c):c;});}
function wireColors(){host.querySelectorAll('[data-color-key]').forEach(row=>{const role=row.querySelector('[data-role]')?.dataset.role,prop=row.querySelector('[data-prop]')?.dataset.prop;row.querySelectorAll('input').forEach(input=>input.oninput=()=>{const previous=row.querySelector('.ds-hex').value;let c;if(input.hasAttribute('data-alpha'))c=C.withOpacity(previous,input.value);else if(input.type==='color')c=C.withOpacity(input.value,row.querySelector('[data-alpha]').value);else c=C.normalize(input.value);input.setAttribute('aria-invalid',String(!c));if(!c)return;if(role==='--primary-seed')D.setPrimarySeed(C.base(c));else if(role)D.setRole(role,c);else {edit(prop,c);const link=host.querySelector('[data-element-palette="'+prop+'"]');if(link)link.value='';}paint(row,c,input);recolorArt();});});host.querySelectorAll('[data-reset-role]').forEach(b=>b.onclick=()=>{if(b.dataset.resetRole==='--primary-seed')D.setPrimarySeed(null);else D.setRole(b.dataset.resetRole,null);recolorArt();render();});host.querySelectorAll('[data-reset-prop]').forEach(b=>b.onclick=()=>{edit(b.dataset.resetProp,null);renderFields();});}
function syncRoleFields(){
  host.querySelectorAll('.ds-family-picker').forEach(section=>{
    const {family}=section.dataset;
    const choices=family==='neutral'?neutralPresets:semanticPresets;
    section.querySelectorAll('[data-palette-choice]').forEach(button=>{
      const [,colors]=choices[Number(button.dataset.paletteChoice)];
      button.setAttribute('aria-pressed',String(E.steps.every((step,index)=>value('--color-'+family+'-'+step)===colors[index])));
    });
  });host.querySelectorAll('[data-color-key]').forEach(row=>{const role=row.querySelector('[data-role]')?.dataset.role;if(role)paint(row,value(role),document.activeElement);});}
function updateTools(){host.querySelector('#ds-undo')?.toggleAttribute('disabled',!D.canUndo);host.querySelector('#ds-redo')?.toggleAttribute('disabled',!D.canRedo);}
function checkContrast(){const out=host.querySelector('#ds-contrast');if(!out)return;const page=C.composite(value('--theme-page')),bg=C.composite(value('--theme-primary'),page),fg=C.composite(value('--theme-on-primary'),bg),ratio=E.contrast(bg,fg);out.hidden=ratio>=4.5;out.textContent=`버튼 대비 부족 · ${ratio.toFixed(2)}:1`;}
function plansHTML(){return `<div class="ds-plan-list">${D.slots.map((s,i)=>`<article class="ds-plan"><input id="ds-name-${i}" maxlength="32" aria-label="시안 ${i+1} 이름" placeholder="시안 ${i+1}" value="${escape(s?.name||'')}"><div><button data-save="${i}">저장</button><button data-load="${i}" ${s?'':'disabled'}>적용</button><button data-remove="${i}" ${s?'':'disabled'} aria-label="시안 ${i+1} 삭제">×</button></div></article>`).join('')}</div><footer class="ds-plan-actions"><button id="ds-export">내보내기</button><label class="ds-file">불러오기<input id="ds-import" type="file" accept=".json,application/json"></label><button id="ds-save-default">현재 디자인을 기본으로 저장</button><button id="ds-reset-all">기본 디자인 적용</button></footer>`;}
function restoreAccent(a){if(a)a.mode==='default'?T.reset():T.select(a.hex);}
function wire(){host.querySelector('#ds-close').onclick=()=>setMode(false);host.querySelector('#ds-undo').onclick=()=>{D.undo();recolorArt();render();};host.querySelector('#ds-redo').onclick=()=>{D.redo();recolorArt();render();};host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});host.querySelector('#ds-parent')?.addEventListener('click',()=>{if(resolve()?.parentElement!==document.body)choose(resolve().parentElement);});host.querySelector('#ds-scope')?.addEventListener('change',e=>{scope=e.target.value;renderFields();});host.querySelector('#ds-state')?.addEventListener('change',e=>{state=e.target.value;resolve()?.setAttribute('data-ds-preview',state);renderFields();});host.querySelector('#ds-font')?.addEventListener('change',e=>D.setFont(e.target.value));wireColors();
host.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{D.save(+b.dataset.save,host.querySelector('#ds-name-'+b.dataset.save).value,T.state.current);render();});host.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{restoreAccent(D.load(+b.dataset.load));apply();recolorArt();render();});host.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{D.remove(+b.dataset.remove);render();});host.querySelector('#ds-reset-all')?.addEventListener('click',()=>{restoreAccent(D.import(localStorage.getItem(defaultDesignKey)));apply();recolorArt();render();});host.querySelector('#ds-save-default')?.addEventListener('click',()=>{localStorage.setItem(defaultDesignKey,D.export(T.state.current));host.querySelector('#ds-status').textContent='이 브라우저의 기본 디자인으로 저장했습니다.';});host.querySelector('#ds-export')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([D.export(T.state.current)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='jei-design-theme.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});host.querySelector('#ds-import')?.addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>500000)throw Error('500KB 이하 파일을 선택하세요.');restoreAccent(D.import(await file.text()));apply();recolorArt();render();}catch(err){host.querySelector('#ds-status').textContent=err.message;}});}
function mount(){context();const modal=[...document.querySelectorAll('dialog[open]')].at(-1),parent=modal?.id==='help'?document.body:modal||document.body;if(host.parentElement!==parent)parent.append(host,outline);if(dock.parentElement!==document.body)document.body.append(dock);if(active)mark(resolve());syncAssets();recolorArt();}
new MutationObserver(records=>{if(records.every(r=>own(r.target)||r.target===outline))return;if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;mount();});}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','src']});
D.onChange=()=>{apply();recolorArt();};window.addEventListener('jei-color-change',()=>{apply();recolorArt();});
apply();mount();
})();
