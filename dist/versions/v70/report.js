(function(){
 'use strict';
 const I=window.JeiReportI18n,root=document.documentElement;
 let theme=window.JeiReportColors.current;
 const dock=document.createElement('nav');dock.id='report-dock';dock.lang='ko';dock.setAttribute('aria-label','보고용 테스트 컨트롤');
 dock.innerHTML=`<strong class="report-label" data-report-label="테스트 패널"></strong><div class="report-controls" id="report-controls"><div class="report-segment report-language" role="group" aria-label="언어"><button type="button" data-report-language="ko" lang="ko" aria-label="한국어">한</button><button type="button" data-report-language="en" lang="en" aria-label="English">EN</button></div><span class="report-divider"></span><div class="report-segment report-theme" role="group" aria-label="컬러"><button type="button" data-report-theme="1"><i class="report-swatch" aria-hidden="true"></i><span data-report-label="컬러1"></span></button><button type="button" data-report-theme="2"><i class="report-swatch" aria-hidden="true"></i><span data-report-label="컬러2"></span></button></div></div><button type="button" class="report-restart" id="report-restart" data-report-restart title="D등급 01의 첫 시연 상태로 돌아가기" aria-label="D등급 01의 첫 시연 상태로 돌아가기">처음으로</button><button type="button" class="report-toggle" data-report-toggle aria-expanded="true" aria-controls="report-controls report-restart" aria-label="테스트 패널 접기" title="테스트 패널 접기"><i aria-hidden="true"></i></button>`;
 document.body.append(dock);
 let collapsed=false,panelMotion=null;
 function setPanelCollapsed(value,animate=true){
  const before=dock.getBoundingClientRect(),fromOpacity=Number(window.getComputedStyle?.(dock)?.opacity??(collapsed ? .35 : 1));panelMotion?.cancel?.();panelMotion=null;dock.removeAttribute('data-panel-moving');
  if(animate)dock.setAttribute('data-panel-interacted','true');
  collapsed=!!value;dock.setAttribute('data-collapsed',String(collapsed));
  dock.querySelector('.report-controls').hidden=collapsed;dock.querySelector('.report-restart').hidden=collapsed;
  const toggle=dock.querySelector('[data-report-toggle]'),label=collapsed?'테스트 패널 펼치기':'테스트 패널 접기';
  toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',label);toggle.setAttribute('title',label);
  if(animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&dock.animate){
   const after=dock.getBoundingClientRect(),toOpacity=Number(window.getComputedStyle?.(dock)?.opacity??(collapsed ? .35 : 1)),motion=dock.animate([{width:before.width+'px',height:before.height+'px',opacity:fromOpacity},{width:after.width+'px',height:after.height+'px',opacity:toOpacity}],{duration:200,easing:'cubic-bezier(.25,.1,.25,1)'});
   if(motion){panelMotion=motion;dock.setAttribute('data-panel-moving','true');const finish=()=>{if(panelMotion===motion){panelMotion=null;dock.removeAttribute('data-panel-moving');}};motion.finished?.then(finish,finish);}
  }
 }
 setPanelCollapsed(false,false);
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
  if(event.target.closest('[data-report-toggle]')||collapsed){setPanelCollapsed(!collapsed);return;}
  if(event.target.closest('[data-report-restart]')){window.JeiReportEntry.restart();return;}
  const language=event.target.closest('[data-report-language]'),button=event.target.closest('[data-report-theme]');
  if(language){I.setLanguage(language.dataset.reportLanguage);translateAll();document.querySelector('[data-action="mentor-repeat"]')?.click();return;}
  if(button){applyTheme(button.dataset.reportTheme,true);return;}
 },false);
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='jei-theme-preview')applyTheme();});
 applyTheme();translateAll();
})();
