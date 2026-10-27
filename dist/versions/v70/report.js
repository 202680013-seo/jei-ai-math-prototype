(function(){
 'use strict';
 const I=window.JeiReportI18n,root=document.documentElement;
 let theme='1';try{if(localStorage.getItem('report-theme')==='2')theme='2';}catch{}
 const dock=document.createElement('nav');dock.id='report-dock';dock.lang='ko';dock.setAttribute('aria-label','보고용 테스트 컨트롤');
 dock.innerHTML=`<strong class="report-label" data-report-label="테스트 패널"></strong><div class="report-controls"><div class="report-segment report-language" role="group" aria-label="언어"><button type="button" data-report-language="ko" lang="ko" aria-label="한국어">한</button><button type="button" data-report-language="en" lang="en" aria-label="English">EN</button></div><span class="report-divider"></span><div class="report-segment report-theme" role="group" aria-label="컬러"><button type="button" data-report-theme="1"><i class="report-swatch" aria-hidden="true"></i><span data-report-label="컬러1"></span></button><button type="button" data-report-theme="2"><i class="report-swatch" aria-hidden="true"></i><span data-report-label="컬러2"></span></button></div></div><button type="button" class="report-restart" data-report-restart title="D등급 01의 첫 시연 상태로 돌아가기" aria-label="D등급 01의 첫 시연 상태로 돌아가기">처음으로</button>`;
 document.body.append(dock);
 function labels(){
  // The operator panel has its own fixed Korean locale, separate from the UI.
  for(const e of dock.querySelectorAll('[data-report-label]'))e.textContent=e.dataset.reportLabel;
  for(const b of dock.querySelectorAll('[data-report-language]'))b.setAttribute('aria-pressed',String(b.dataset.reportLanguage===I.language));
  for(const b of dock.querySelectorAll('[data-report-theme]'))b.setAttribute('aria-pressed',String(b.dataset.reportTheme===theme));
 }
 const themeImages=[['.recommend-arrow','recommend-arrow.svg','assets/figma-v4-1/recommend-arrow.svg'],['.shortcut-profile-art','my-profile.svg','assets/figma-v4-1/my-profile.svg'],['.shortcut-report-art','my-report.svg','assets/figma-v4-1/my-report.svg'],['.constellation-art>img','constellation.svg','assets/figma-v4-1/constellation.svg']];
 function applyTheme(){
  root.setAttribute('data-report-theme',theme);
  for(const [key,value]of Object.entries(window.JeiTheme.presetPalette('current')))root.style.setProperty(key,value);
  for(const [selector,name,original]of themeImages){const img=document.querySelector(selector);if(img)img.setAttribute('src',theme==='2'?'assets/report-theme2/'+name:original);}
  try{localStorage.setItem('report-theme',theme);}catch{}labels();window.JeiReportDialogs?.sync();
 }
 const sources=new WeakMap(),attrs=new WeakMap();let observer,pending=new Set(),queued=false;
 const skip='script,style,textarea,input,[contenteditable=true],#report-dock,#ai-message,#mentor-measure';
 function textNode(n){
  if(!n.parentElement||n.parentElement.closest(skip))return;
  const previous=sources.get(n),value=n.nodeValue;
  const original=previous&&previous.rendered===value?previous.original:I.original(value);
  const weekdays={일:'Sun',월:'Mon',화:'Tue',수:'Wed',목:'Thu',금:'Fri',토:'Sat'};
  const topic=n.parentElement.matches('#group-panel .nav-topic-copy>strong');
  const translated=topic?window.JeiReportTopics.short(original):I.language==='en'&&n.parentElement.matches('.calendar-grid>small')?(weekdays[original.trim()]||I.t(original)):I.t(original);
  if(topic){
   if(I.language==='en'){n.parentElement.setAttribute('title',I.t(original));n.parentElement.setAttribute('aria-label',I.t(original));}
   else{n.parentElement.removeAttribute('title');n.parentElement.removeAttribute('aria-label');}
  }
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
 const observed={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','aria-valuetext','title','placeholder','alt','open','hidden']};
 function flush(){
  queued=false;observer?.disconnect();for(const node of pending)visit(node);pending.clear();observer?.observe(document.body,observed);
 }
 function translateAll(){pending.add(document.body);flush();labels();}
 observer=new MutationObserver(records=>{
  for(const r of records){if(r.target===dock||dock.contains(r.target))continue;if(r.type==='childList'){for(const n of r.addedNodes)pending.add(n);}else pending.add(r.target);}
  if(!queued){queued=true;queueMicrotask(flush);}
 });
 dock.addEventListener('click',event=>{
  if(event.target.closest('[data-report-restart]')){window.JeiReportEntry.restart();return;}
  const language=event.target.closest('[data-report-language]'),button=event.target.closest('[data-report-theme]');
  if(language){I.setLanguage(language.dataset.reportLanguage);translateAll();document.querySelector('[data-action="mentor-repeat"]')?.click();return;}
  if(button){theme=button.dataset.reportTheme;applyTheme();return;}
 },false);
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='jei-theme-preview')applyTheme();});
 applyTheme();translateAll();
})();
