const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {harness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/versions/v70/model.js');
const registry=JSON.parse(fs.readFileSync('dist/versions.json'));
const version=registry.versions.find(v=>v.label==='보고용 V1'),base='dist/'+version.path;
const read=name=>fs.readFileSync(base+name,'utf8');
function language(){
 const storage=new Map(),root={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 for(const name of ['report-copy.js','report-catalog.js','report-topics.js'])vm.runInNewContext(read(name),{window:root,Map,Date});
 root.MentorCopy=require('../dist/working/mentor-copy.js');vm.runInNewContext(read('report-mentor.js'),{window:root});
 return {I:root.JeiReportI18n,root,storage};
}
test('the report is a distinct native version and does not replace V6.4 or working',()=>{
 assert.equal(registry.working.basedOn,'v69');assert.equal(registry.working.matchesBaseline,true);
 assert(version.id!=='v69');assert.equal(registry.versions.find(v=>v.id==='v69').label,'V6.4');
 const html=fs.readFileSync('dist/report-v1.html','utf8');assert(html.includes('data-report-presentation="true"'));
 assert(html.includes('data-version="'+version.id+'"'));assert(!html.includes('class="settings-trigger"'));
 for(const file of ['report-copy.js','report-catalog.js','report-mentor.js','report.js','report.css'])assert(html.includes(file));
 assert(fs.readFileSync('dist/v6-4.html','utf8').includes('data-version="v69"'));
});
test('language switching translates main flows, dynamic metrics and all curriculum labels without changing learning storage',()=>{
 const {I,root,storage}=language();const saved=JSON.stringify(M.create());storage.set('ai-math-prototype-diagnosis-v1',saved);I.setLanguage('en');
 for(const copy of ['완성한 별자리 확인하기','틀린 문제 다시 풀기','새로운 학습 시작하기','오늘의 학습 이어가기','내 학습 현황 보기','내 실력 이어서 알아보기','첫 실력 알기 시작하기','실력 알기 진행하기','다음 실력 알아보기','추천 활동 준비 중','비교와 분류','나의 실력을 알아볼까요?','실력알기 결과 확인','모임의 크기 비교(<,>)','활동을 고르고 있어요','저장하고 나가기','계속 풀기','실력알기를 통과했어요!','카드를 눌러 복습해보세요!','정답 2개 · 오답 1개','2 / 3문제 · 67%','비교와 분류 · 실력 알기 완료','더 익힐 내용을 모으고 있어요.','재능님을 위한 학습이 준비됐어요','비교와 분류 · 더 연습할 학습 8개']){
  const en=I.t(copy);assert.notEqual(en,copy,copy);assert(!/[가-힣]/.test(en),en);I.setLanguage('ko');assert.equal(I.t(en),copy);I.setLanguage('en');
 }
 assert.equal(I.t('3 다음에 오는 수를 골라요.'),'Which number comes after 3?');
 const labels=Object.entries(root.JeiReportCatalog);assert(labels.length>1300);for(const [ko,en]of labels){assert(en.trim());assert(!/[가-힣]/.test(en),ko);}
 assert.equal(storage.get('ai-math-prototype-diagnosis-v1'),saved);
});
test('all mentor event templates have English copy, and the app measures full English sentences before paging',()=>{
 const {I,root}=language();I.setLanguage('en');
 for(const r of root.MentorCopy.rules)for(const template of r.messages){const ko=template.replace(/\[이름\]/g,'재능').replace(/\[X\]/g,'D').replace(/\[[^\]]+\]/g,'3');assert(!/[가-힣]/.test(I.t(ko)),r.id+' '+I.t(ko));}
 const h=harness(undefined,{appSource:read('app.js'),mathModel:M});h.context.JeiReportI18n=I;
 h.evaluate("const reportRun={fullText:'오늘은 무엇부터 시작해 볼까요?',index:0};prepareMentorPages(reportRun)");
 assert.equal(h.evaluate('reportRun.fullText'),'What would you like to start with today?');assert(h.evaluate('reportRun.pages.length')>0);
});
test('normal report entries restart the seven-passed/eighth-ready demo and preserve display preferences and explicit scenarios',()=>{
 const key='ai-math-prototype-diagnosis-v1';
 for(const [existing,scenario,seeded]of [[null,'keep',true],['saved-progress','keep',true],[null,'0',false]]){
  const store=new Map([['report-language','en'],['report-theme','2'],...(existing?[[key,existing]]:[])]);
  const run=()=>vm.runInNewContext(read('report-seed.js'),{MathModel:M,window:{__JEI_REVIEW__:{scenario}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});
  run();const value=store.get(key);
  if(seeded){
   const state=JSON.parse(value),topic=state.grades[3][0],p=topic.programs;assert.equal(state.grade,3);assert.equal(state.index,0);assert.equal(p.length,8);
   assert.deepEqual(p.map(p=>p.status),['passed','passed','passed','passed','passed','passed','passed','idle']);
   assert.deepEqual(p.map(p=>p.progress),[100,100,100,100,100,100,100,0]);assert(M.canStart(topic,p[7]));
   assert.deepEqual(p.map(p=>p.programId),M.programs(8,3,0).map(p=>p.programId),'original curriculum order');
   state.index=1;state.grades[3][0].programs[7].status='passed';store.set(key,JSON.stringify(state));run();const reopened=JSON.parse(store.get(key));assert.equal(reopened.index,0);assert.equal(reopened.grades[3][0].programs[7].status,'idle','each new entry restarts');assert.equal(store.get('report-language'),'en');assert.equal(store.get('report-theme'),'2');
  }else assert.equal(value,existing||undefined);
 }
});
test('report diagnosis retains the one-answer resume and clean-pass reward/rail handoff',()=>{
 const h=harness(undefined,{appSource:read('app.js'),mathModel:M});h.click('diagnosis');
 for(let i=0;i<1;i++){h.click('diagnosis-answer',h.evaluate('DEMO['+i+'].correct'));h.click('diagnosis-next');}
 h.click('close-learning');h.click('diagnosis-leave');assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'50');
 const restored=harness(h.saved(),{appSource:read('app.js'),mathModel:M});assert.equal(restored.node('#diagnosis-welcome-progress').getAttribute('data-progress-stage'),'partial');
 restored.click('diagnosis');restored.click('diagnosis-answer',restored.evaluate('DEMO[1].correct'));restored.click('diagnosis-next');restored.click('diagnosis-outcome-confirm');
 for(let i=0;restored.evaluate('!!diagnosisOutcomeRun')&&i<12;i++){const timer=restored.evaluate('diagnosisOutcomeTimer');assert(timer&&!timer.cancelled);timer.fn();}
 assert.equal(restored.evaluate('diagnosisOutcomeRun'),null);assert.equal(restored.evaluate('state.index'),1);assert.equal(restored.evaluate('skyState().totalPieces'),2);
});
test('Theme 2 uses original white Figma exports in their native-sized slots',()=>{
 const manifest=JSON.parse(read('assets/report-theme2-green/manifest.json'));assert.equal(manifest.frame,'95:1009');
 for(const file of manifest.assets){const data=fs.readFileSync(base+'assets/report-theme2-green/'+file.file);assert(data.length>100);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),file.sha256);assert(data.toString().startsWith('<svg'));}
 const css=read('report.css');assert(css.includes('background:#0ec7ae'));assert(css.includes('background:#0cad98'));assert(css.includes('background:#f1fcfa'));
 assert(!css.includes('width:100%;height:100%'));assert(!read('report.js').includes("host.append(dock)"));
});
test('English review hints override the actual important hiding utility in both themes',()=>{
 const {I}=language();I.setLanguage('en');assert.equal(I.t('카드를 눌러 복습해보세요!'),'Tap a card to practice again!');
 const hidden=read('theme.css').match(/\.sr-only\{([^}]+)\}/)[1];
 const visible=read('report.css').match(/html\[lang=en\] \.completed-first-tooltip \.sr-only\{([^}]+)\}/)[1];
 // An ordinary declaration loses to the inherited important utility even with
 // greater specificity: this is the regression behind the empty dark tooltip.
 const declarations=body=>Object.fromEntries(body.split(';').filter(Boolean).map(part=>{const i=part.indexOf(':');return [part.slice(0,i).trim(),part.slice(i+1).trim()];}));
 const from=declarations(hidden),to=declarations(visible);
 for(const [property,value]of Object.entries({position:'static',width:'auto',height:'auto',padding:'0',margin:'0',overflow:'visible',clip:'auto','white-space':'normal'})){
  assert(from[property].endsWith('!important'),property+' really is important upstream');assert.equal(to[property],value+'!important',property+' must restore visible English copy');
 }
 const script=read('report.js'),markup=script.match(/dock\.innerHTML=`([^`]+)`;/)[1];
 assert.equal((markup.match(/<button\b/g)||[]).length,6);
 assert(markup.startsWith('<strong class="report-label" data-report-label="테스트 패널"></strong>'));
 assert.equal(I.t('테스트 패널'),'Test panel');
 for(const removed of ['report-identity','report-mark','report-state-toggle','report-scenarios','<svg','<small'])assert(!script.includes(removed),removed+' is removed, not just hidden');
 assert(script.includes("dock.setAttribute('aria-label','보고용 테스트 컨트롤')"));
 // The actual labels function keeps the operator copy Korean while the screen
 // locale and each segmented control's pressed state can still change.
 const node=(key,value)=>({dataset:{[key]:value},attrs:{},setAttribute(k,v){this.attrs[k]=v;}});
 const texts=['테스트 패널','컬러1','컬러2'].map(v=>node('reportLabel',v));
 const languages=['ko','en'].map(v=>node('reportLanguage',v)),themes=['1','2'].map(v=>node('reportTheme',v));
 const dock={querySelectorAll:s=>s==='[data-report-label]'?texts:s==='[data-report-language]'?languages:themes};
 const context=vm.createContext({I,dock,theme:'1'});
 vm.runInContext(script.slice(script.indexOf(' function labels(){'),script.indexOf(' function applyTheme(')),context);
 for(const locale of ['ko','en','ko','en'])for(const theme of ['1','2']){
  I.setLanguage(locale);context.theme=theme;vm.runInContext('labels()',context);
  assert.deepEqual(texts.map(n=>n.textContent),['테스트 패널','컬러1','컬러2']);
  for(const n of languages)assert.equal(n.attrs['aria-pressed'],String(n.dataset.reportLanguage===locale));
  for(const n of themes)assert.equal(n.attrs['aria-pressed'],String(n.dataset.reportTheme===theme));
 }
 assert(script.includes("dock.lang='ko'"));
});
test('concise navigation names cover all topics without losing ranges, conditions or sequence identity',()=>{
 const {I,root,storage}=language(),T=root.JeiReportTopics,C=require('../dist/versions/v70/catalog.js').MathCatalog;
 const before=JSON.stringify(C);storage.set('learner-state','unchanged');I.setLanguage('en');
 const names=[...new Set(C.grades.flatMap(g=>g.groups.map(t=>t.name)))];assert.equal(names.length,200);
 for(const name of names){
  const full=I.t(name),short=T.short(name);assert(short.length<=25,name+' stays concise');assert(!/[가-힣]/.test(short),name);
  assert.equal(T.short(name,'ko'),name);assert.equal(I.t(name),full,'short names do not replace the main title');
  if(/\d/.test(name))assert.deepEqual(short.match(/\d+/g)||[],name.match(/\d+/g)||[],name+' retains numerical scope');
  for(const marker of name.match(/[①②③]/g)||[])assert(short.includes(marker),name+' retains sequence');
 }
 for(const g of C.grades){const labels=g.groups.map(t=>T.short(t.name));assert.equal(new Set(labels).size,labels.length,g.grade+' topics remain distinguishable');}
 assert.equal(T.short('모으기와 가르기(10)'),'Compose & Split (10)');
 assert.equal(T.short('두~세 자리 수의 덧셈'),'2–3-digit addition');assert.equal(T.short('자릿값(다섯 자리 수)'),'5-digit place value');
 for(const [a,b]of [['받아올림이 없는 덧셈','받아올림이 있는 덧셈'],['받아내림이 없는 뺄셈','받아내림이 있는 뺄셈'],['분모가 같은 분수의 덧셈','분모가 다른 분수의 덧셈'],['분모가 다른 분수의 뺄셈','분모가 다른 대분수의 뺄셈']])assert.notEqual(T.short(a),T.short(b));
 assert.equal(JSON.stringify(C),before);assert.equal(storage.get('learner-state'),'unchanged');
});
test('actual reporting text translation uses short labels only in the rail and restores Korean on repeated switches',()=>{
 const {I,root}=language(),sources=new WeakMap(),script=read('report.js');
 const translate=script.slice(script.indexOf(' function textNode(n){'),script.indexOf('\n function element(e){'));
 const context=vm.createContext({I,window:root,sources,skip:''});vm.runInContext(translate,context);
 function node(value,rail){const attrs=new Map();return {nodeValue:value,parentElement:{closest:()=>null,matches:s=>rail&&s==='#group-panel .nav-topic-copy>strong',setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getAttribute:k=>attrs.get(k)}};}
 const rail=node('모으기와 가르기(10)',true),heading=node('모으기와 가르기(10)',false);
 const run=n=>{context.n=n;vm.runInContext('textNode(n)',context);};
 for(let i=0;i<3;i++){
  I.setLanguage('en');run(rail);run(heading);
  assert.equal(rail.nodeValue,'Compose & Split (10)');assert.equal(heading.nodeValue,'Making and breaking numbers (10)');
  assert.equal(rail.parentElement.getAttribute('title'),heading.nodeValue);assert.equal(rail.parentElement.getAttribute('aria-label'),heading.nodeValue);
  I.setLanguage('ko');run(rail);run(heading);assert.equal(rail.nodeValue,'모으기와 가르기(10)');assert.equal(heading.nodeValue,rail.nodeValue);assert.equal(rail.parentElement.getAttribute('title'),undefined);
 }
 // The app can redraw/recycle the label after a grade change; it must not retain
 // the previous short name or title when the original text changes.
 rail.nodeValue='모임의 크기 비교(5)';I.setLanguage('en');run(rail);assert.equal(rail.nodeValue,'Group sizes (5)');assert.equal(rail.parentElement.getAttribute('title'),I.t('모임의 크기 비교(5)'));
 const css=read('report.css');assert(css.includes('overflow-x:hidden;touch-action:pan-y pinch-zoom'));assert(css.includes('white-space:nowrap;overflow:hidden;text-overflow:ellipsis'));
 assert(read('index.html').includes('src="report-topics.js"'));
});
test('report dialog adapter leaves the dock at body level through review, results, nested help and cancellation',()=>{
 const events=new Map();let document;
 function node(tag,id){const n={tagName:tag,id,children:[],inert:false,hidden:false,open:false,isConnected:true,attrs:{},handlers:{},style:{setProperty(k,v){this[k]=v;}},
  append(c){if(c.parentElement)c.parentElement.children=c.parentElement.children.filter(x=>x!==c);this.children.push(c);c.parentElement=this;},
  prepend(c){this.append(c);this.children.unshift(this.children.pop());},setAttribute(k,v){this.attrs[k]=v;},
  addEventListener(k,fn){(this.handlers[k]??=[]).push(fn);},dispatchEvent(e){for(const fn of this.handlers[e.type]||[])fn(e);return !e.defaultPrevented;},
  closest(){for(let p=this;p;p=p.parentElement)if(p.inert||p.hidden)return p;return null;},getClientRects:()=>[{}],
  querySelectorAll(){return this.children.filter(c=>c.tagName==='BUTTON');},focus(){document.activeElement=this;},
  show(){this.open=true;this.children[0]?.focus();},close(value){this.open=false;this.returnValue=value;this.dispatchEvent({type:'close'});}};return n;}
 const body=node('BODY'),workspace=node('MAIN','learning-workspace'),launcher=node('BUTTON'),dock=node('NAV','report-dock');
 const languageButton=node('BUTTON'),locked=node('ASIDE');locked.inert=true;dock.append(languageButton);workspace.append(launcher);
 const dialogs=['learning','activity','help','prescription'].map(id=>{const d=node('DIALOG',id);d.append(node('BUTTON'));return d;});
 body.append(workspace);body.append(locked);dialogs.forEach(d=>body.append(d));body.append(dock);
 document={body,activeElement:launcher,createElement:tag=>node(tag.toUpperCase()),querySelectorAll:()=>dialogs,querySelector:()=>dock,addEventListener:(type,fn)=>events.set(type,fn)};
 class CancelEvent{constructor(type){this.type=type;this.defaultPrevented=false;}preventDefault(){this.defaultPrevented=true;}}
 vm.runInNewContext(read('report-dialogs.js'),{document,window:{},Event:CancelEvent,MutationObserver:class{observe(){}},getComputedStyle:()=>({background:'#0004',backdropFilter:'blur(3px)'})});
 const plane=body.children.find(n=>n.id==='report-ui-plane');assert.equal(workspace.parentElement,plane);assert.equal(locked.inert,true,'learner-owned lock is untouched');
 for(const dialog of dialogs){
  launcher.focus();dialog.showModal();assert.equal(dialog.open,true);assert.equal(plane.inert,true);assert.equal(dock.parentElement,body);assert(!dialog.children.includes(dock));assert.equal(dock.inert,false);
  document.activeElement=languageButton;const tab={key:'Tab',preventDefault(){this.prevented=true;}};events.get('keydown')(tab);assert.equal(tab.prevented,true);assert.equal(document.activeElement,dialog.children[0]);
  dialog.close('done');assert.equal(dialog.returnValue,'done');assert.equal(plane.inert,false);assert.equal(document.activeElement,launcher);assert.equal(dock.parentElement,body);
 }
 const [learning,activity,help]=dialogs;learning.showModal();activity.showModal();help.showModal();assert.equal(learning.inert,true);assert.equal(activity.inert,true);help.close();assert.equal(activity.inert,false);assert.equal(plane.inert,true);activity.close();assert.equal(learning.inert,false);
 learning.addEventListener('cancel',e=>e.preventDefault());const escape={key:'Escape',preventDefault(){},stopImmediatePropagation(){}};events.get('keydown')(escape);assert.equal(learning.open,true,'diagnosis cancel can retain its pause confirmation');learning.close();
 assert.equal(plane.inert,false);assert.equal(locked.inert,true);assert.equal(dock.parentElement,body);
 assert(!read('report.js').includes('function mount()'));assert(!read('report.css').includes('dialog:has(>#report-dock)'));
});
test('report questions have two unambiguous answers and numeric choices survive translation count collisions',()=>{
 const {I}=language(),Q=M.ReportQuestions;assert.equal(Q.items.length,2);
 assert.equal(Q.items[0].choices[Q.items[0].correct].shape,'circle');
 const numbers=Q.items[1].choices.map(c=>Number(c.label));assert.equal(numbers[Q.items[1].correct],Math.max(...numbers));
 for(const q of Q.items){assert.equal(new Set(q.choices.map(c=>c.label)).size,4);assert(q.correct>=0&&q.correct<4);}
 const {root}=language();const script=read('report.js'),context=vm.createContext({I,window:root,sources:new WeakMap(),skip:''});
 vm.runInContext(script.slice(script.indexOf(' function textNode(n){'),script.indexOf('\n function element(e){')),context);
 const nodes=numbers.map(number=>({nodeValue:String(number),parentElement:{closest:()=>null,matches:()=>false}}));
 for(const locale of ['en','ko','en','ko']){I.setLanguage('en');for(const n of numbers)I.t(n+'개');I.setLanguage(locale);for(const n of nodes){context.n=n;vm.runInContext('textNode(n)',context);}assert.deepEqual(nodes.map(n=>n.nodeValue),['3','8','2','5']);}
});
function reportHarness(saved,options={}){return harness(saved,{...options,appSource:read('app.js'),mathModel:M});}
function finishReportOutcome(h){h.click('diagnosis-outcome-confirm');for(let i=0;h.evaluate('!!diagnosisOutcomeRun')&&i<20;i++){const timer=h.evaluate('diagnosisOutcomeTimer');assert(timer&&!timer.cancelled);timer.fn();}assert.equal(h.evaluate('diagnosisOutcomeRun'),null);}
test('all four two-question diagnosis outcomes have matching results, prescriptions and exact rewards',()=>{
 for(const answers of [[0,1],[0,0],[1,1],[1,0]]){
  const h=reportHarness();h.click('diagnosis');h.click('diagnosis-next');assert.equal(h.evaluate('current().diagnosticSession.index'),0);
  h.click('diagnosis-answer',99);assert.equal(h.evaluate('current().diagnosticSession.answers.length'),0);
  answers.forEach((a,i)=>{assert.equal(h.evaluate('current().diagnosticSession.index'),i);h.click('diagnosis-answer',a);h.click('diagnosis-next');});
  const wrong=Number(answers[0]!==0)+Number(answers[1]!==1);assert.equal(h.evaluate('diagnosisSummary(outcomeResult()).total'),2);assert.equal(h.evaluate('diagnosisSummary(outcomeResult()).wrong'),wrong);
  finishReportOutcome(h);assert.equal(h.evaluate('skyState().totalPieces'),2-wrong);assert.equal(h.evaluate('state.grades[3][0].diagnosticResult.questionCount'),2);
  if(wrong)assert(h.evaluate('current().programs.every(p=>p.frames.length===2)'));else assert.equal(h.evaluate('state.index'),1);
 }
});
test('normal learning and completed-card review finish after two answers, preserve next progress and credit once',()=>{
 for(const review of [false,true])for(const failed of [false,true]){
  let h=reportHarness();
  if(review){h.seed('passed',true);h.click('completed-card',0);h.click('study-choice-review');}
  else{h.evaluate("current().diagnosis='done';current().programs=M.programs(2);render()");h.click('program',0);}
  assert.equal(h.evaluate('current().programs[0].frames.length'),2);
  h.click('learner-answer',0);h.click('learner-next');
  if(review)assert.equal(h.evaluate('current().programs[0].reviewSession.index'),1);else assert.equal(h.evaluate('current().programs[0].progress'),50);
  // Exit/reload on the second question exercises the report's actual model,
  // saved state and completed-card resume route rather than a fresh replay.
  h.click('close-learning');h=reportHarness(h.saved());
  if(review){h.click('completed-card',0);h.click('study-choice-review');}else{h.click('program',0);}
  h.click('learner-answer',failed?0:1);h.click('learner-next');
  assert.equal(h.evaluate('diagnosisSummary(outcomeResult()).total'),2);assert.equal(h.evaluate('diagnosisSummary(outcomeResult()).wrong'),failed?1:0);
  finishReportOutcome(h);assert.equal(h.evaluate('skyState().totalPieces'),failed?1:2);
  if(review){assert.equal(h.evaluate('current().programs[1].progress'),50);assert.equal(h.evaluate('current().programs[0].initialResult.status'),'passed');}
  const reward=h.evaluate('skyState().totalPieces');h.click('program',0);assert.equal(h.evaluate('skyState().totalPieces'),reward,'saved result does not replay rewards');
 }
});
test('every prescribed report program has two questions and legacy sessions migrate without deleting their originals',()=>{
 const catalog=JSON.stringify(M.Catalog);
 for(let g=0;g<10;g++)for(let i=0;i<M.COUNTS[g];i++)for(const p of M.programs(M.sourceCount(g,i),g,i)){assert.equal(p.frames.length,2);M.setProgress(p,50);assert.equal(p.completedFrames,1);}
 assert.equal(JSON.stringify(M.Catalog),catalog,'the real curriculum remains unchanged');
 const saved=M.create(),t=saved.grades[3][0];t.diagnosis='active';t.diagnosticSession={index:2,answers:[0,1],started:1};
 t.programs=[{id:0,status:'active',progress:70,completedFrames:7,frames:Array.from({length:10},(_,i)=>({frameId:'original'+i})),demoChoice:1,wrongFrames:[0,5],reviewSession:{index:5,answers:[0,1,2,3,0],wrongFrames:[2],complete:false}}];
 M.ReportQuestions.prepare(saved);assert.equal(t.diagnosticSession.index,1);assert.equal(t.reportOriginalDiagnosticSession.index,2);assert.equal(t.programs[0].frames.length,2);assert.equal(t.programs[0].progress,50);assert.equal(t.programs[0].demoChoice,undefined);assert.equal(t.programs[0].reportOriginalQuestionState.frames.length,10);assert.equal(t.programs[0].reviewSession.index,1);
 const stable=JSON.stringify(saved);M.ReportQuestions.prepare(saved);assert.equal(JSON.stringify(saved),stable,'migration is idempotent');
});

test('rail icons use exact original bytes without on-open image requests and late topics have no inherited long delay',()=>{
 const root={};vm.runInNewContext(read('report-rail-icons.js'),{window:root});
 const icons=root.JeiReportRailIcons;assert(Object.isFrozen(icons));
 for(const [name,uri] of Object.entries(icons)){
  assert(uri.startsWith('data:image/svg+xml;base64,'));
  assert.deepEqual(Buffer.from(uri.split(',')[1],'base64'),fs.readFileSync(base+'assets/figma-v4-1/'+name+'.svg'));
 }
 assert.equal(Object.keys(icons).length,7);
 const html=read('index.html');assert(html.indexOf('report-rail-icons.js')<html.indexOf('src="app.js"'));
 const h=harness(undefined,{appSource:read('app.js'),mathModel:M});h.context.JeiReportRailIcons=icons;
 h.evaluate("state.grade=6;state.index=13;state.grades[6][13].diagnosis='active'");
 for(let opening=0;opening<2;opening++){
  h.click('groups');const markup=h.node('#group-panel').innerHTML;
  const sources=Array.from(markup.matchAll(/<img[^>]+src="([^"]+)"/g),m=>m[1]);
  assert(sources.length>5);for(const src of sources)assert(src.startsWith('data:image/svg+xml;base64,'));
  const current=markup.match(/<button[^>]*data-action="select-group"[^>]*data-id="13"[^>]*>/)[0];
  assert(current.includes('--nav-delay:0ms'));assert(current.includes('aria-current="true"'));
  const delays=Array.from(markup.matchAll(/class="group-item[^>]+--nav-delay:(\d+)ms/g),m=>Number(m[1]));
  assert(delays.length>13);assert(Math.max(...delays)<=56);
  h.click('close-panel');assert.equal(h.node('#group-panel').getAttribute('data-reveal'),'false');
 }
 for(const status of ['failed','passed','clean','idle','locked','active'])assert(h.evaluate('navigationStatusIcon('+JSON.stringify(status)+')').includes('data:image/svg+xml;base64,'));
 const css=read('report.css');assert(css.includes('animation:report-topic-arrive .2s'));assert(css.includes('@media(prefers-reduced-motion:reduce){#group-panel[data-panel-phase=open][data-reveal=true] .group-item.nav-stagger{animation:none!important}}'));
});

function reportFinalCard(){
 const store=new Map(),key='ai-math-prototype-diagnosis-v1';
 vm.runInNewContext(read('report-seed.js'),{MathModel:M,window:{__JEI_REVIEW__:{scenario:'keep'}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});
 return JSON.parse(store.get(key));
}
function solveReportLast(h,wrong=false){h.click('program',7);h.click('learner-answer',0);h.click('learner-next');h.click('learner-answer',wrong?0:1);h.click('learner-next');}
function reportStep(h){const t=h.evaluate('diagnosisOutcomeTimer');assert(t&&!t.cancelled);t.fn();}
const reportStage=h=>h.evaluate('diagnosisOutcomeRun?.target.diagnosisOutcome?.stage');
test('passing the eighth report lesson preserves all cards and introduces D02 through the shared rail handoff',()=>{
 const h=reportHarness(reportFinalCard(),{reducedMotion:false});
 assert.equal((h.node('#programs').innerHTML.match(/completed-card-heading/g)||[]).length,7);
 assert(h.node('#programs').innerHTML.includes('data-action="program" data-id="7"'));
 h.evaluate('current().diagnosticResult=validationDiagnosisResult(false)');const diagnosis=h.data('current().diagnosticResult');solveReportLast(h);
 assert.equal(h.node('#composition-copy').textContent,'이번 세트의 학습을 모두 마쳤어요!');
 assert(h.node('#diagnosis-inline-summary').innerHTML.includes('보상을 모은 뒤 다음 세트로 이어갈게요.'));
 assert.equal(h.evaluate('state.index'),0);h.click('diagnosis-outcome-confirm');
 assert.equal(reportStage(h),'reward');assert.equal(h.evaluate('skyState().totalPieces'),2);
 reportStep(h);assert.equal(reportStage(h),'collecting');reportStep(h);
 assert.equal(reportStage(h),'rail-open');assert.equal(h.evaluate('panel'),'groups');assert.equal(h.node('#learning').open,false);
 assert.equal(h.evaluate('navigationTopicStatus(state.grades[3][0],true)'),'active');
 assert.equal((h.node('#programs').innerHTML.match(/completed-card-heading/g)||[]).length,8,'completed cards stay visible, not temporarily locked');
 reportStep(h);assert.equal(reportStage(h),'rail-complete');assert.equal(h.evaluate('navigationTopicStatus(state.grades[3][0],true)'),'passed');
 reportStep(h);assert.equal(reportStage(h),'rail-next');assert.equal(h.evaluate('state.index'),1);assert.equal(h.node('#group-title').textContent,'비교와 분류');
 assert.equal((h.node('#programs').innerHTML.match(/completed-card-heading/g)||[]).length,8,'source cards remain mounted until the new entry');
 reportStep(h);assert.equal(reportStage(h),'rail-close');reportStep(h);assert.equal(reportStage(h),'next-entry');
 assert.equal(h.node('#group-title').textContent,'모으기와 가르기(10)');assert.equal(h.node('#diagnosis-welcome-title').textContent,'나의 실력을 알아볼까요?');
 reportStep(h);assert.equal(reportStage(h),undefined);assert.equal(h.node('#learning').open,false);assert.equal(h.node('#learning-workspace').inert,false);
 assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.evaluate('current().diagnosticSession'),undefined);
 assert.equal(h.evaluate('state.grades[3][0].programs.length'),8);assert(h.evaluate('state.grades[3][0].programs.every(p=>p.status==="passed"&&p.progress===100)'));
 assert.deepEqual(h.data('state.grades[3][0].diagnosticResult'),diagnosis);assert.equal(h.evaluate('daily().cleanStreak'),0);
 assert.equal(h.evaluate('Object.keys(state.programRewards).length'),1);assert.equal(h.evaluate('skyState().totalPieces'),2);
 const {I}=language();I.setLanguage('en');for(const s of ['이번 세트의 학습을 모두 마쳤어요!','보상을 모은 뒤 다음 세트로 이어갈게요.'])assert(!/[가-힣]/.test(I.t(s)));
});
test('a failed or unfinished report course, a preview, and already-passed-card review never trigger automatic set navigation',()=>{
 for(const mode of ['failed','unfinished','preview','review','final-grade']){
  const fixture=reportFinalCard();
  if(mode==='unfinished'){fixture.grades[3][0].programs[0].status='failed';fixture.grades[3][0].programs[0].wrongFrames=[0];}
  if(mode==='final-grade'){const source=fixture.grades[3][0];fixture.grade=9;fixture.index=M.COUNTS[9]-1;fixture.grades[9].forEach(t=>t.diagnosis='done');fixture.grades[9][fixture.index]=({...fixture.grades[9][fixture.index],diagnosis:'done',programs:source.programs});}
  const h=reportHarness(fixture),origin=h.evaluate('state.index');
  if(mode==='review'){
   h.evaluate("current().programs[7].status='passed';M.setProgress(current().programs[7],100);render()");h.click('completed-card',7);h.click('study-choice-review');h.click('learner-answer',0);h.click('learner-next');h.click('learner-answer',1);h.click('learner-next');
  }else{solveReportLast(h,mode==='failed');if(mode==='preview')h.evaluate('current().diagnosisOutcome.preview=true');}
  finishReportOutcome(h);assert.equal(h.evaluate('state.index'),origin,mode);assert.equal(h.evaluate('panel'),null,mode);assert.equal(h.node('#learning-workspace').inert,false,mode);
 }
});
test('the internal report outcome restore remains idempotent and pauses when hidden',()=>{
 let h=reportHarness(reportFinalCard(),{reducedMotion:false});solveReportLast(h);h.click('diagnosis-outcome-confirm');reportStep(h);reportStep(h);
 for(const phase of ['rail-open','rail-complete','rail-next','rail-close','next-entry']){
  assert.equal(reportStage(h),phase);h=reportHarness(h.saved(),{reducedMotion:false});assert.equal(reportStage(h),phase);
  assert.equal(h.evaluate('state.grades[3][0].programs.length'),8);assert.equal(h.evaluate('skyState().totalPieces'),2);
  const stale=h.evaluate('diagnosisOutcomeTimer');h.document.visibilityState='hidden';h.emitDocument('visibilitychange');assert.equal(h.evaluate('diagnosisOutcomeTimer'),null);stale.fn();assert.equal(reportStage(h),phase);
  h.document.visibilityState='visible';h.emitDocument('visibilitychange');const old=h.evaluate('diagnosisOutcomeTimer');reportStep(h);const after=reportStage(h);old.fn();assert.equal(reportStage(h),after,'stale timer cannot advance twice');
 }
 assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.evaluate('state.index'),1);assert.equal(h.evaluate('skyState().totalPieces'),2);assert.equal(h.evaluate('Object.keys(state.programRewards).length'),1);
});

test('standalone foreground and cached-page returns request one new report entry without resetting active in-app navigation',()=>{
 for(const standalone of [false,true]){
  const events=new Map(),pageEvents=new Map(),store=new Map(),key='ai-math-prototype-diagnosis-v1';let reloads=0;
  const document={visibilityState:'visible',addEventListener:(t,f)=>events.set(t,f)};
  const root={__JEI_REVIEW__:{scenario:'keep'},matchMedia:()=>({matches:standalone}),addEventListener:(t,f)=>pageEvents.set(t,f),location:{reload:()=>reloads++}};
  const env={MathModel:M,window:root,document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};
  vm.runInNewContext(read('report-seed.js'),env);
  const active=JSON.parse(store.get(key));active.index=1;store.set(key,JSON.stringify(active));
  // Learner routes and ordinary re-renders do not run the entry initializer.
  assert.equal(JSON.parse(store.get(key)).index,1);pageEvents.get('pageshow')({persisted:false});assert.equal(reloads,0);
  if(standalone){events.get('visibilitychange')();assert.equal(reloads,0);document.visibilityState='hidden';events.get('visibilitychange')();assert.equal(reloads,0);document.visibilityState='visible';events.get('visibilitychange')();assert.equal(reloads,1);}
  else assert.equal(events.has('visibilitychange'),false,'desktop tab changes do not reset an ongoing demo');
  pageEvents.get('pageshow')({persisted:true});assert.equal(reloads,1,'cached return and foreground cannot request duplicate reloads');
  vm.runInNewContext(read('report-seed.js'),env);const fresh=JSON.parse(store.get(key));assert.equal(fresh.index,0);assert.equal(fresh.grades[3][0].programs[7].progress,0);assert.equal(fresh.diagnosisAdvance,undefined);assert.equal(fresh.programRewards,undefined);
 }
 // A deliberately restored checkpoint still takes priority in the external review workspace.
 let changed=false,registered=false;
 vm.runInNewContext(read('report-seed.js'),{MathModel:M,window:{__JEI_REVIEW__:{scenario:'keep',restored:{}},addEventListener:()=>registered=true},localStorage:{setItem:()=>changed=true}});
 assert.equal(changed,false);assert.equal(registered,false);
});

test('report diagnosis, prescribed learning and review enter questions directly without an intro and preserve resume',()=>{
 const h=reportHarness(reportFinalCard());h.click('program',7);
 assert.equal(h.evaluate('editing.intro'),false);assert.equal(h.evaluate('current().programs[7].status'),'active');assert.equal(h.evaluate('daily().timerRunning'),true);
 assert(h.node('#learning').innerHTML.includes('동그라미를 골라요.'));assert(!h.node('#learning').innerHTML.includes('data-action="program-begin"'));
 h.click('learner-answer',0);h.click('learner-next');h.click('close-learning');h.click('program',7);
 assert.equal(h.evaluate('current().programs[7].progress'),50);assert(h.node('#learning').innerHTML.includes('가장 큰 수를 골라요.'));
 h.click('close-learning');h.click('completed-card',0);h.click('study-choice-review');assert.equal(h.evaluate('editing.intro'),false);assert(h.node('#learning').innerHTML.includes('동그라미를 골라요.'));h.click('close-learning');
 h.evaluate('select(3,1)');h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),false);assert.equal(h.evaluate('current().diagnosticSession.index'),0);assert.equal(h.evaluate('daily().timerRunning'),true);
 assert(h.node('#learning').innerHTML.includes('동그라미를 골라요.'));assert(!h.node('#learning').innerHTML.includes('data-action="diagnosis-begin"'));
 h.click('diagnosis-answer',0);h.click('diagnosis-next');h.click('close-learning');h.click('diagnosis-leave');h.click('diagnosis');
 assert.equal(h.evaluate('current().diagnosticSession.index'),1);assert(h.node('#learning').innerHTML.includes('가장 큰 수를 골라요.'));
});
test('the independent 처음으로 action resets only report progress and exits explicit scenarios without duplicate reloads',()=>{
 for(const config of [{scenario:'keep'},{scenario:'4'},{scenario:'keep',restored:{}}]){
  const key='ai-math-prototype-diagnosis-v1',old=reportFinalCard();old.index=1;
  const store=new Map([[key,JSON.stringify(old)],['report-language','en'],['report-theme','2']]);let reloads=0,updated;
  const root={__JEI_REVIEW__:config,location:{href:'https://example.com/report-v1.html?scenario=4&checkpoint=saved&demo=1',reload:()=>reloads++},history:{replaceState:(_a,_b,url)=>updated=url}};
  vm.runInNewContext(read('report-seed.js'),{MathModel:M,window:root,URL,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});
  const changed=JSON.parse(store.get(key));changed.index=1;store.set(key,JSON.stringify(changed));
  root.JeiReportEntry.restart();root.JeiReportEntry.restart();
  const reset=JSON.parse(store.get(key));assert.equal(reset.grade,3);assert.equal(reset.index,0);assert.equal(reset.grades[3][0].programs[7].status,'idle');assert.equal(reset.grades[3][0].programs.filter(p=>p.status==='passed').length,7);
  assert.equal(reloads,1);assert.equal(updated,'/report-v1.html?demo=1');assert.equal(store.get('report-language'),'en');assert.equal(store.get('report-theme'),'2');
 }
 const script=read('report.js'),markup=script.match(/dock\.innerHTML=`([^`]+)`;/)[1];assert(markup.includes('data-report-label="컬러1"'));assert(markup.includes('data-report-label="컬러2"'));assert(!markup.includes('테마'));assert(markup.includes('>처음으로</button>'));assert(markup.includes('data-report-toggle'));
 const handler=script.slice(script.indexOf(" dock.addEventListener('click'"),script.indexOf(" window.addEventListener('message'"));let restarted=0;
 vm.runInNewContext(handler,{collapsed:false,dock:{addEventListener:(_type,fn)=>fn({target:{closest:s=>s==='[data-report-restart]'?{}:null}})},window:{JeiReportEntry:{restart:()=>restarted++}}});assert.equal(restarted,1);
});

function reportColorsHarness(initial='1',{deferred=false,reducedMotion=false}={}){
 const roots=[],loads=[],waiters=[],motionCalls=[],store=new Map([['report-theme',initial],['ai-math-prototype-diagnosis-v1','saved-learning']]);
 const root={attrs:new Map(),style:{values:{},setProperty(k,v){this.values[k]=v;}},setAttribute(k,v){this.attrs.set(k,v);if(k==='data-report-theme')roots.push(v);},getAttribute(k){return this.attrs.get(k);}};
 const selectors=['.recommend-arrow','.shortcut-profile-art','.shortcut-report-art','.constellation-art>img','.active-card-art','.passed-card .figma-status-icon','.side-tab-surface','.result-icon>img'];
 const images=new Map(selectors.map(s=>[s,Array.from({length:s.includes('passed-card')?7:1},()=>({src:'',getAttribute(){return this.src;},setAttribute(_k,v){this.src=v;},animate(frames,options){const m={frames,options,cancel(){this.cancelled=true;}};motionCalls.push(m);return m;}}))]));
 class WarmImage{set src(value){loads.push(value);}decode(){return deferred?new Promise(resolve=>waiters.push(resolve)):Promise.resolve();}}
 const win={JeiTheme:{presetPalette:()=>({'--theme-completed':'#e5f5fd'}),THEMES:{current:{roles:{completed:'#e5f5fd'}}}},matchMedia:()=>({matches:reducedMotion})};
 const document={documentElement:root,timeline:{currentTime:100},querySelectorAll:s=>images.get(s)||[]};
 vm.runInNewContext(read('report-colors.js'),{window:win,document,Image:WarmImage,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});
 return {api:win.JeiReportColors,root,roots,loads,waiters,motionCalls,images,store};
}
test('Color 2 follows the green Figma frame, swaps all seven checks, and restores Color 1 without changing learner state',async()=>{
 const script=read('report.js'),manifest=JSON.parse(read('assets/report-theme2-green/manifest.json')),c=reportColorsHarness();
 const h=reportHarness(reportFinalCard());h.document.documentElement=c.root;h.context.JeiReportColors=c.api;const sourceBefore=h.data('state');
 for(const theme of ['2','1','2','1']){
  await c.api.select(theme,{animate:true});
  assert.equal(c.root.style.values['--theme-completed'],theme==='2'?'#e5f6f4':'#e5f5fd');
  for(const [selector,name]of c.api.images)for(const img of c.images.get(selector)){
   assert.equal(img.src,c.api.asset(name));const data=Buffer.from(img.src.split(',')[1],'base64');assert.deepEqual(data,fs.readFileSync(base+'assets/'+(theme==='2'?'report-theme2-green/':'figma-v4-1/')+name+'.svg'));
  }
  h.evaluate('render()');const markup=h.node('#programs').innerHTML;
  assert.equal(markup.split('src="'+c.api.asset('passed')+'"').length-1,7);
  assert(markup.includes('src="'+c.api.asset('active-card-art')+'"'));assert(h.node('#diagnostic').innerHTML.includes('src="'+c.api.asset('result-report')+'"'));
 }
 assert.deepEqual(h.data('state'),sourceBefore,'theme is presentation-only');
 const expected={'active-card-art.svg':[141,159],'recommend-arrow.svg':[18,18],'my-profile.svg':[25,25],'my-report.svg':[17,19],'constellation.svg':[33,27],'rail-tab.svg':[72,144],'rail-report.svg':[25,30],'result-report.svg':[14,18],'passed.svg':[44,44]};
 assert.equal(manifest.assets.length,9);
 for(const a of manifest.assets){const name=a.file.split('/').pop(),tag=read('assets/report-theme2-green/'+a.file).split('>')[0]+'>';assert.equal(tag,a.root);assert.deepEqual([Number(tag.match(/width="([\d.]+)"/)[1]),Number(tag.match(/height="([\d.]+)"/)[1])],expected[name],name);}
 assert(read('report.css').includes('html[data-report-theme="2"]{--status-pass-fill:#0ec7ae}'));assert(!script.includes('https://www.figma.com/api/mcp/asset/'));
});
test('saved Color 2 is restored before paint, both SVG sets are decoded before switching and rapid requests cannot flash an obsolete palette',async()=>{
 const html=read('index.html');assert(html.indexOf('src="report-colors.js"')<html.indexOf('</head>'));assert(html.indexOf('/theme-preview.js')<html.indexOf('src="report-colors.js"'));
 assert(html.indexOf('JeiReportColors.syncImages()')<html.indexOf('src="catalog.js"'));
 const saved=reportColorsHarness('2',{deferred:true});assert.equal(saved.api.current,'2');assert.deepEqual(saved.roots,['2']);assert.equal(saved.root.style.values['--theme-completed'],'#e5f6f4');assert.equal(saved.root.style.values['--report-header-color'],'#0ec7ae');
 assert.equal(saved.loads.length,16);assert(saved.loads.every(src=>src.startsWith('data:image/svg+xml;base64,')));
 const c=reportColorsHarness('1',{deferred:true});c.api.syncImages();const before=c.images.get('.passed-card .figma-status-icon')[0].src;
 const stale=c.api.select('2',{animate:true}),latest=c.api.select('1',{animate:true});assert.equal(c.api.current,'1');assert.equal(c.images.get('.passed-card .figma-status-icon')[0].src,before);
 c.waiters.forEach(resolve=>resolve());await Promise.all([stale,latest]);assert.equal(c.api.current,'1');assert(!c.roots.includes('2'),'superseded preparation never paints');
 await c.api.select('2',{animate:true});assert.equal(c.api.current,'2');assert.equal(c.motionCalls.length,14);assert(c.motionCalls.every(m=>m.options.duration===240&&m.startTime===100&&!m.frames.some(f=>'transform' in f)));
 assert.equal(c.store.get('ai-math-prototype-diagnosis-v1'),'saved-learning');
 const reduced=reportColorsHarness('1',{reducedMotion:true});await reduced.api.select('2',{animate:true});assert.equal(reduced.api.current,'2');assert.equal(reduced.motionCalls.length,0);
});

function reviewReportLast(h,wrong=false){h.click('failed-card',7);h.click('study-choice-review');h.click('learner-answer',0);h.click('learner-next');h.click('learner-answer',wrong?0:1);h.click('learner-next');}
test('recovering the failed final report program through review completes the set and advances after rewards',()=>{
 const h=reportHarness(reportFinalCard(),{reducedMotion:false});solveReportLast(h,true);finishReportOutcome(h);
 assert.equal(h.evaluate('state.index'),0);assert.equal(h.evaluate('current().programs[7].status'),'failed');assert.equal(h.evaluate('skyState().totalPieces'),1);
 reviewReportLast(h);assert.equal(h.evaluate('current().diagnosisOutcome.recoveredPass'),true);assert.equal(h.evaluate('current().diagnosisOutcome.result.status'),'passed');
 assert.equal(h.node('#composition-copy').textContent,'이번 세트의 학습을 모두 마쳤어요!');
 finishReportOutcome(h);assert.equal(h.evaluate('state.index'),1);assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.node('#diagnosis-welcome-title').textContent,'나의 실력을 알아볼까요?');
 assert(h.evaluate('state.grades[3][0].programs.every(p=>p.status==="passed")'));
 assert.equal(h.evaluate('state.grades[3][0].programs[7].initialResult.status'),'failed','retain the original attempt');
 assert.deepEqual(h.data('state.grades[3][0].programs[7].initialResult.wrongFrames'),[1]);
 assert.equal(h.evaluate('state.grades[3][0].programs[7].reviewSession.result.status'),'passed');
 assert.equal(h.evaluate('skyState().totalPieces'),3);assert.equal(h.evaluate('Object.keys(state.programRewards).length'),2);assert.equal(h.node('#learning').open,false);
});
test('review recovery advances only when it closes the last gap, and its saved outcome marker is idempotent',()=>{
 for(const anotherFailed of [false,true]){
  let h=reportHarness(reportFinalCard());solveReportLast(h,true);finishReportOutcome(h);
  reviewReportLast(h,true);assert.equal(h.evaluate('current().diagnosisOutcome.recoveredPass'),false);finishReportOutcome(h);assert.equal(h.evaluate('state.index'),0);
  if(anotherFailed)h.evaluate("current().programs[0].status='failed';current().programs[0].wrongFrames=[1];render()");
  reviewReportLast(h);assert.equal(h.evaluate('current().diagnosisOutcome.recoveredPass'),true);
  if(anotherFailed){finishReportOutcome(h);assert.equal(h.evaluate('state.index'),0);assert.equal(h.evaluate('current().programs[7].status'),'passed');}
  else{
   h.click('diagnosis-outcome-confirm');reportStep(h);reportStep(h);assert.equal(reportStage(h),'rail-open');
   for(const phase of ['rail-open','rail-complete','rail-next','rail-close','next-entry']){
    h=reportHarness(h.saved(),{reducedMotion:false});assert.equal(reportStage(h),phase);assert.equal(h.evaluate('diagnosisOutcomeRun.target.diagnosisOutcome.recoveredPass'),true);
    const old=h.evaluate('diagnosisOutcomeTimer');reportStep(h);const after=reportStage(h);old.fn();assert.equal(reportStage(h),after);
   }
   assert.equal(h.evaluate('state.index'),1);assert.equal(h.evaluate('skyState().totalPieces'),4);assert.equal(h.evaluate('Object.keys(state.programRewards).length'),3);
  }
 }
});

test('all assessment, lesson and review scores use the last editable choice, including corrected answers and next-set recovery',()=>{
 for(const mode of ['diagnosis','normal','review'])for(const wrong of [[false,false],[false,true],[true,false],[true,true]]){
  const h=reportHarness(mode==='diagnosis'?undefined:reportFinalCard());
  if(mode==='diagnosis')h.click('diagnosis');
  else if(mode==='normal')h.click('program',7);
  else{h.evaluate("current().programs[7].status='failed';M.setProgress(current().programs[7],100);current().programs[7].wrongFrames=[1];render()");h.click('failed-card',7);h.click('study-choice-review');}
  const answers=[];
  for(let i=0;i<2;i++){
   const correct=i===0?0:1,final=wrong[i]?(correct+1)%4:correct,other=final===correct?(correct+1)%4:correct,action=mode==='diagnosis'?'diagnosis-answer':'learner-answer';answers.push(final);
   for(const choice of [other,final,other,final]){
    h.click(action,choice);const html=h.node('#learning').innerHTML,board=html.match(/<div class="question-choices">([\s\S]*?)<\/div>/)[1];
    assert(!board.includes('disabled'));assert.equal((board.match(/aria-pressed="true"/g)||[]).length,1);assert.equal((board.match(/answer-selected/g)||[]).length,1);assert(!board.includes('answer-correct'));assert(!board.includes('<small>정답'));
    assert(!html.includes('class="answer-feedback"'),'do not reveal answers while the selection is editable');
    const value=h.evaluate(mode==='diagnosis'?'current().diagnosticSession.answers['+i+']':mode==='review'?'current().programs[7].reviewSession.answers['+i+']':'current().programs[7].demoChoice');assert.equal(value,choice);
   }
   h.click(action,99);h.click(action,-1);
   if(mode!=='diagnosis')assert(!h.evaluate(mode==='review'?'current().programs[7].reviewSession.wrongFrames':'current().programs[7].wrongFrames').includes(i),'grading waits for Next');
   h.click(mode==='diagnosis'?'diagnosis-next':'learner-next');
  }
  const incorrect=wrong.filter(Boolean).length;assert.equal(h.evaluate('outcomeResult().incorrect'),incorrect,mode+' '+wrong);
  if(mode==='diagnosis')assert.deepEqual(h.data('current().diagnosticResult.goals.map(g=>g.questions[0].chosen)'),answers);
  else{assert.deepEqual(h.data(mode==='review'?'current().programs[7].reviewSession.wrongFrames':'current().programs[7].wrongFrames'),wrong.flatMap((v,i)=>v?[i]:[]));if(mode==='review')assert.equal(h.evaluate('current().programs[7].initialResult.status'),'failed');}
  finishReportOutcome(h);assert.equal(h.evaluate('skyState().totalPieces'),2-incorrect);assert.equal(h.evaluate('state.index'),incorrect?0:1,mode+' final outcome follows the final choices');
 }
});
test('selected answers survive in-session exits, remain editable on return, and completed result choices stay read-only',()=>{
 const h=reportHarness(reportFinalCard());h.click('program',7);h.click('learner-answer',1);h.click('close-learning');h.click('program',7);assert.equal(h.evaluate('current().programs[7].demoChoice'),1);
 h.click('learner-answer',0);h.click('learner-next');h.click('learner-answer',1);h.click('learner-next');assert.equal(h.evaluate('outcomeResult().incorrect'),0);
 const resultBefore=h.data('current().diagnosisOutcome.result');h.click('learner-answer',0);assert.deepEqual(h.data('current().diagnosisOutcome.result'),resultBefore);
 const board=h.evaluate('choiceBoard(DEMO[0],1,null,true)');assert.equal((board.match(/disabled/g)||[]).length,4);assert(board.includes('answer-correct'));assert(board.includes('answer-wrong'));assert(!board.includes('data-action="learner-answer"'));
});
test('the independent test panel collapses to an accessible handle and reopens during any learner screen',async()=>{
 const script=read('report.js'),css=read('report.css');
 for(const reduced of [false,true]){
  const attrs=new Map(),toggleAttrs=new Map(),motions=[],controls={hidden:false},restart={hidden:false},toggle={setAttribute:(k,v)=>toggleAttrs.set(k,v)};
  const dock={setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getBoundingClientRect:()=>({width:controls.hidden?44:600,height:controls.hidden?44:72}),querySelector:s=>s==='.report-controls'?controls:s==='.report-restart'?restart:toggle,animate(frames,options){const m={frames,options,finished:Promise.resolve(),cancel(){this.cancelled=true;}};motions.push(m);return m;},addEventListener(_t,f){this.click=f;}};
  const context=vm.createContext({dock,window:{matchMedia:()=>({matches:reduced})}});
  vm.runInContext(script.slice(script.indexOf(' let collapsed='),script.indexOf(' function labels(){')),context);
  assert.equal(controls.hidden,false);assert.equal(toggleAttrs.get('aria-expanded'),'true');
  const handler=script.slice(script.indexOf(" dock.addEventListener('click'"),script.indexOf(" window.addEventListener('message'"));vm.runInContext(handler,context);
  dock.click({target:{closest:s=>s==='[data-report-toggle]'?{}:null}});assert.equal(controls.hidden,true);assert.equal(restart.hidden,true);assert.equal(toggleAttrs.get('aria-expanded'),'false');assert.equal(toggleAttrs.get('aria-label'),'테스트 패널 펼치기');
  // The compact hit area can reopen the panel, as well as its chevron.
  dock.click({target:{closest:()=>null}});assert.equal(controls.hidden,false);assert.equal(restart.hidden,false);assert.equal(toggleAttrs.get('aria-expanded'),'true');
  await Promise.resolve();assert.equal(attrs.get('data-collapsed'),'false');assert.equal(attrs.has('data-panel-moving'),false);
  if(reduced)assert.equal(motions.length,0);else{assert.equal(motions.length,2);assert.equal(motions[0].cancelled,true);assert(motions.every(m=>m.options.duration===200&&!m.frames.some(f=>'transform' in f)));}
 }
 assert(css.includes('#report-dock [hidden]{display:none!important}'));assert(css.includes('#report-dock[data-collapsed=true]{display:flex'));
 assert(script.includes('aria-controls="report-controls report-restart"'));assert(script.includes('document.body.append(dock)'));
});
