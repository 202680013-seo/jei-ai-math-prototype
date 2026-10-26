(function(){
 'use strict';
 const I=window.JeiReportI18n,root=document.documentElement;
 let theme='1';try{if(localStorage.getItem('report-theme')==='2')theme='2';}catch{}
 const dock=document.createElement('nav');dock.id='report-dock';dock.setAttribute('aria-label','보고용 테스트 컨트롤');
 const reportIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>';
 dock.innerHTML=`<div class="report-identity"><span class="report-mark">${reportIcon}</span><div><strong data-report-label="테스트 패널"></strong><small data-report-label="보고용 V1"></small></div></div><span class="report-divider"></span><div class="report-controls"><div class="report-segment report-language" role="group" aria-label="Language"><button type="button" data-report-language="ko" lang="ko" aria-label="한국어">한</button><button type="button" data-report-language="en" lang="en" aria-label="English">EN</button></div><span class="report-divider"></span><div class="report-segment report-theme" role="group" aria-label="Theme"><button type="button" data-report-theme="1"><i class="report-swatch" aria-hidden="true"></i><span data-report-label="테마1"></span></button><button type="button" data-report-theme="2"><i class="report-swatch" aria-hidden="true"></i><span data-report-label="테마2"></span></button></div><button id="report-state-toggle" type="button" aria-expanded="false" aria-controls="report-scenarios">${reportIcon}<span data-report-label="상태 변경"></span><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button></div><div id="report-scenarios" hidden><strong data-report-label="화면 상태 선택"></strong>${[
 ['실력알기 전','preset',0],['실력알기 진행 중','preset',1],['학습 시작 전','preset',3],['학습 진행 중','preset',4],['학습 모두 완료','preset',5],['복습이 필요한 상태','preset',6],['처방 공개 흐름','replay-first',''],['진단 통과 흐름','replay-clean-pass',''],['학습 통과 흐름','replay-program-pass',''],['학습 미통과 흐름','replay-program-fail','']
 ].map(([label,action,id])=>`<button type="button" data-action="${action}" data-id="${id}" data-report-label="${label}"></button>`).join('')}</div>`;
 document.body.append(dock);
 const menu=dock.querySelector('#report-scenarios'),toggle=dock.querySelector('#report-state-toggle');
 function closeMenu(){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}
 function labels(){
  for(const e of dock.querySelectorAll('[data-report-label]'))e.textContent=I.t(e.dataset.reportLabel);
  dock.setAttribute('aria-label',I.t('보고용 테스트 컨트롤'));
  for(const b of dock.querySelectorAll('[data-report-language]'))b.setAttribute('aria-pressed',String(b.dataset.reportLanguage===I.language));
  for(const b of dock.querySelectorAll('[data-report-theme]'))b.setAttribute('aria-pressed',String(b.dataset.reportTheme===theme));
 }
 const themeImages=[['.recommend-arrow','recommend-arrow.svg','assets/figma-v4-1/recommend-arrow.svg'],['.shortcut-profile-art','my-profile.svg','assets/figma-v4-1/my-profile.svg'],['.shortcut-report-art','my-report.svg','assets/figma-v4-1/my-report.svg'],['.constellation-art>img','constellation.svg','assets/figma-v4-1/constellation.svg']];
 function applyTheme(){
  root.setAttribute('data-report-theme',theme);
  for(const [key,value]of Object.entries(window.JeiTheme.presetPalette('current')))root.style.setProperty(key,value);
  for(const [selector,name,original]of themeImages){const img=document.querySelector(selector);if(img)img.setAttribute('src',theme==='2'?'assets/report-theme2/'+name:original);}
  try{localStorage.setItem('report-theme',theme);}catch{}labels();
 }
 const sources=new WeakMap(),attrs=new WeakMap();let observer,pending=new Set(),queued=false;
 const skip='script,style,textarea,input,[contenteditable=true],#report-dock,#ai-message,#mentor-measure';
 function textNode(n){
  if(!n.parentElement||n.parentElement.closest(skip))return;
  const previous=sources.get(n),value=n.nodeValue;
  const original=previous&&previous.rendered===value?previous.original:I.original(value);
  const weekdays={일:'Sun',월:'Mon',화:'Tue',수:'Wed',목:'Thu',금:'Fri',토:'Sat'};
  const translated=I.language==='en'&&n.parentElement.matches('.calendar-grid>small')?(weekdays[original.trim()]||I.t(original)):I.t(original);
  sources.set(n,{original,rendered:translated});if(value!==translated)n.nodeValue=translated;
 }
 function element(e){
  if(e.nodeType!==1||e.closest(skip))return;
  for(const name of ['aria-label','aria-valuetext','title','placeholder','alt']){
   if(!e.hasAttribute(name))continue;const map=attrs.get(e)||new Map(),prev=map.get(name),value=e.getAttribute(name),original=prev&&prev.rendered===value?prev.original:I.original(value),translated=I.t(original);
   map.set(name,{original,rendered:translated});attrs.set(e,map);if(value!==translated)e.setAttribute(name,translated);
  }
 }
 function visit(node){
  if(!node.isConnected)return;if(node.nodeType===3){textNode(node);return;}
  if(node.nodeType!==1||node.closest(skip))return;element(node);
  const walk=document.createTreeWalker(node,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);let next;
  while((next=walk.nextNode())){if(next.nodeType===3)textNode(next);else element(next);}
 }
 function mount(){
  const dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>!d.hidden);const host=dialogs.at(-1)||document.body;
  if(dock.parentElement!==host)host.append(dock);
 }
 const observed={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','aria-valuetext','title','placeholder','alt','open','hidden']};
 function flush(){
  queued=false;observer?.disconnect();for(const node of pending)visit(node);pending.clear();mount();observer?.observe(document.body,observed);
 }
 function translateAll(){pending.add(document.body);flush();labels();}
 observer=new MutationObserver(records=>{
  for(const r of records){if(r.target===dock||dock.contains(r.target))continue;if(r.type==='childList'){for(const n of r.addedNodes)pending.add(n);}else pending.add(r.target);}
  if(!queued){queued=true;queueMicrotask(flush);}
 });
 dock.addEventListener('click',event=>{
  const language=event.target.closest('[data-report-language]'),button=event.target.closest('[data-report-theme]');
  if(language){closeMenu();I.setLanguage(language.dataset.reportLanguage);translateAll();document.querySelector('[data-action="mentor-repeat"]')?.click();return;}
  if(button){closeMenu();theme=button.dataset.reportTheme;applyTheme();return;}
  if(event.target.closest('#report-state-toggle')){menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));return;}
 },false);
 dock.addEventListener('click',event=>{if(event.target.closest('#report-scenarios [data-action]')){closeMenu();queueMicrotask(()=>{pending.add(document.body);flush();});}},true);
 document.addEventListener('click',event=>{if(!dock.contains(event.target))closeMenu();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){closeMenu();toggle.focus();}});
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='jei-theme-preview')applyTheme();});
 applyTheme();translateAll();
})();
