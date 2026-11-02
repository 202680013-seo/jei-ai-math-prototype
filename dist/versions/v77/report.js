(function(){
 'use strict';
 const I=window.JeiReportI18n,root=document.documentElement;
 let theme=window.JeiReportColors.current;
 const dock=document.createElement('nav');dock.id='report-dock';dock.lang='ko';dock.setAttribute('aria-label','보고용 테스트 컨트롤');
 const gear=document.createElement('button');gear.id='report-settings-toggle';gear.type='button';gear.setAttribute('aria-label','테스트 패널 열기');gear.setAttribute('aria-controls','report-dock');gear.innerHTML="<svg width=\"19\" height=\"19\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" aria-hidden=\"true\"><path d=\"m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>";
 dock.setAttribute('aria-label','테스트 패널');dock.innerHTML=`<div class="settings-head"><strong>테스트 패널</strong><button type="button" data-report-toggle aria-label="테스트 패널 닫기">×</button></div><div class="report-controls" id="report-controls"><h3 style="margin-top:0">화면 언어</h3><div class="report-segment report-language" role="group" aria-label="언어"><button type="button" data-report-language="ko">한</button><button type="button" data-report-language="en">EN</button></div><div id="color-editor"></div><h3>학습 상태</h3><div class="scenario-buttons"><button type="button" data-action="preset" data-id="0">첫 진입 · 처방 없음</button><button type="button" data-action="replay-first">첫 처방 공개</button><button type="button" data-action="replay-clean-pass">실력알기 통과</button><button type="button" data-action="test">상세 테스트 시나리오 열기</button></div><button type="button" class="report-restart" data-report-restart>처음으로</button></div>`;
 document.body.append(dock,gear);let collapsed=true;
 function setPanelCollapsed(value){collapsed=!!value;dock.hidden=collapsed;gear.setAttribute('aria-expanded',String(!collapsed));if(!collapsed)dock.querySelector('[data-report-toggle]').focus({preventScroll:true});else gear.focus({preventScroll:true});}
 gear.addEventListener('click',()=>setPanelCollapsed(!collapsed));
 dock.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();setPanelCollapsed(true);}});
 dock.addEventListener('click',e=>{if(e.target.closest('[data-action]'))setPanelCollapsed(true);});
 dock.hidden=true;gear.setAttribute('aria-expanded','false');
 function labels(){
  // The operator panel has its own fixed Korean locale, separate from the UI.
  for(const e of dock.querySelectorAll('[data-report-label]'))e.textContent=e.dataset.reportLabel;
  for(const b of dock.querySelectorAll('[data-report-language]'))b.setAttribute('aria-pressed',String(b.dataset.reportLanguage===I.language));
  for(const b of dock.querySelectorAll('[data-report-theme]'))b.setAttribute('aria-pressed',String(b.dataset.reportTheme===theme));
 }
 function applyTheme(next=theme,animate=false){
  const pending=window.JeiReportColors.select(next,{animate});
  const sync=()=>{theme=window.JeiReportColors.current;labels();window.JeiReportDialogs?.sync();};
  sync();return pending.then(sync);
 }
 const sources=new WeakMap(),attrs=new WeakMap();let observer,pending=new Set(),queued=false;
 const skip='script,style,textarea,input,[contenteditable=true],#report-dock,#report-settings-toggle,#test-panel,#ai-message,#mentor-measure';
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
  if(event.target.closest('[data-report-toggle]')){setPanelCollapsed(!collapsed);return;}
  if(event.target.closest('[data-report-restart]')){window.JeiReportEntry.restart();return;}
  const language=event.target.closest('[data-report-language]'),button=event.target.closest('[data-report-theme]');
  if(language){I.setLanguage(language.dataset.reportLanguage);translateAll();document.querySelector('[data-action="mentor-repeat"]')?.click();return;}
  if(button){applyTheme(button.dataset.reportTheme,true);return;}
 },false);
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='jei-theme-preview')applyTheme();});
 translateAll();
})();
