// UI state-flow smoke checks with a minimal DOM substitute; not browser layout QA.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map(),timers=[],listeners={};
function node(key){if(nodes.has(key))return nodes.get(key);const classes=new Set();const n={style:{},hidden:false,disabled:false,innerHTML:'',textContent:'',value:8,offsetWidth:1,children:[],classList:{add(...a){a.forEach(x=>classes.add(x));},remove(...a){a.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);}},setAttribute(k,v){this[k]=v;},getBoundingClientRect(){return {left:0,top:0,width:240,height:240};},append(x){if(x.parent)x.parent.children=x.parent.children.filter(y=>y!==x);this.children.push(x);x.parent=this;},prepend(x){if(x.parent)x.parent.children=x.parent.children.filter(y=>y!==x);this.children.unshift(x);x.parent=this;},animate(){},focus(){},close(){this.open=false;},showModal(){this.open=true;},addEventListener(k,f){(this.listeners??={})[k]=f;},querySelectorAll(){return [];}};nodes.set(key,n);return n;}
const c=vm.createContext({console,SkyModel:require('../dist/working/sky.js').SkyModel,window:{innerWidth:1200,innerHeight:800,scrollY:0,scrollTo(){}},MathModel:require('../dist/working/model.js').MathModel,document:{querySelector:node,addEventListener(k,f){const previous=listeners[k];listeners[k]=previous?e=>{previous(e);f(e);}:f;},body:node('body')},localStorage:{getItem(){return null;},setItem(){}},matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},setInterval:()=>0,clearInterval(){}});
// Real-document adapter runs before the application's original event handlers.
c.innerWidth=1200;c.innerHeight=800;c.scrollY=0;c.scrollTo=()=>{};c.window=c;
c.document.currentScript={dataset:{version:'working'}};c.location={search:'',origin:'https://review.example'};c.URLSearchParams=URLSearchParams;
vm.runInContext(fs.readFileSync('dist/preview-runtime.js','utf8'),c);
vm.runInContext(fs.readFileSync('dist/working/app.js','utf8'),c);
vm.runInContext(fs.readFileSync('dist/preview-controls.js','utf8'),c);
assert.equal(node('#diagnostic').parent,node('#diagnosis-slot'));
vm.runInContext('M.preset(state,3);render()',c);assert.equal(node('#programs').children[0],node('#diagnostic'));assert.equal(node('#diagnosis-section').hidden,true);
vm.runInContext('M.preset(state,0);render();beginComposition(8)',c);assert.equal(node('#programs').hidden,true);assert.equal(node('#composition').hidden,false);assert.equal(node('#diagnostic').disabled,true);assert.equal(vm.runInContext('current().programs.length',c),0);
for(const t of [...timers].sort((a,b)=>a.ms-b.ms)){if(!t.cancelled)t.fn();}
assert.equal(vm.runInContext('current().programs.length',c),8);assert.equal(node('#composition').hidden,true);assert.equal(node('#diagnostic').parent,node('#programs'));assert.equal(node('#diagnostic').disabled,false);
vm.runInContext('M.preset(state,2);render()',c);assert.equal(node('#diagnostic').parent,node('#diagnosis-slot'));assert.equal(node('#diagnosis-section').hidden,false);
vm.runInContext('beginComposition(52);select(3,1)',c);for(const t of [...timers]){if(!t.cancelled&&(t.ms===8000||t.ms===7000))t.fn();}assert.equal(vm.runInContext('current().programs.length',c),0);
for(const i of [0,1,2]){vm.runInContext(`M.preset(state,${i});render()`,c);assert.equal(node('#programs').hidden,true);assert.equal(node('#programs').innerHTML,'');assert(!node('#diagnostic').innerHTML.includes('진단 열기'));}
const html=fs.readFileSync('dist/working/index.html','utf8');for(const text of ['<footer>','선택한 그룹의 진단','id="program-heading"'])assert(!html.includes(text));
// Accessible section names may describe AI guidance; duplicate visible headings stay absent.
assert(!/<h[1-6]\b[^>]*>\s*학습 안내\s*<\/h[1-6]>/u.test(html));
assert(node('#ai-message').textContent.includes('진단을 통과했어요'));assert.equal(node('#ai-message')['aria-busy'],'false');
vm.runInContext('M.preset(state,0);render()',c);assert(!node('#ai-message').textContent);assert.equal(node('#ai-message')['aria-busy'],'true');
vm.runInContext('M.preset(state,3);render()',c);assert(!node('#programs').innerHTML.includes('<progress'));assert(node('#programs').innerHTML.includes('is-locked'));assert(!node('#programs').innerHTML.includes('프로그램 01'));vm.runInContext('M.preset(state,4);render()',c);assert.equal((node('#programs').innerHTML.match(/<progress/g)||[]).length,1);assert.equal((node('#programs').innerHTML.match(/is-current/g)||[]).length,1);vm.runInContext('current().programs[0].progress=100;render()',c);assert(!node('#programs').innerHTML.includes('<progress'));assert(node('#programs').innerHTML.includes('풀이 완료'));vm.runInContext('M.preset(state,6);render()',c);assert(!node('#programs').innerHTML.includes('<progress'));
vm.runInContext('state=M.create();render()',c);assert(node('#group-title').textContent.includes('비교와 분류'));assert(!node('#group-title').textContent.includes('D01'));vm.runInContext('openPanel("groups")',c);assert(node('#group-panel').innerHTML.includes('모으기와 가르기(10)'));vm.runInContext('select(0,0)',c);assert(node('#group-title').textContent.includes('모양'));
function click(action,id=0,waitForRecommendation=true){
  if(action==='recommend'&&waitForRecommendation){const t=vm.runInContext('recommendationTimer',c);if(t&&!t.cancelled)t.fn();}
  listeners.click({target:{closest:()=>({dataset:{action,id:String(id)},disabled:action==='recommend'?node('#recommend').disabled:false})}});
}
click('recommend');assert.equal(node('#activity').open,true);assert(node('#activity').innerHTML.includes('목표 학습 시간'));node('#goal-minutes').value=20;click('save-goal');assert.equal(vm.runInContext('state.daily.target',c),20);assert(node('#recommend').textContent.includes('오늘의 학습'));
click('diagnosis');click('diag-start');assert.equal(vm.runInContext('state.daily.started',c),true);click('diag-prescribe');for(const t of [...timers])if(!t.cancelled&&(t.ms===8000||t.ms===7000))t.fn();click('program',0);click('program-start');click('program-frame');assert.equal(vm.runInContext('current().programs[0].completedFrames',c),1);for(let i=0;i<5;i++)click('program-retry');assert(vm.runInContext('M.message(state)',c).includes('차분하게'));click('program-frame');assert(!vm.runInContext('M.message(state)',c).includes('차분하게'));
node('#sky-transition').animate=undefined;node('#activity').animate=undefined;click('constellation');assert(node('#activity').innerHTML.includes('별자리'));click('close-activity');vm.runInContext('state.daily.unreadAnswers=1;render()',c);click('recommend');assert(node('#activity').innerHTML.includes('도와줘요'));click('answer-read');assert.equal(vm.runInContext('state.daily.unreadAnswers',c),0);
click('mypage');assert.equal(node('main').hidden,true);assert(node('#mypage').innerHTML.includes('학습 캘린더'));assert(node('#mypage').innerHTML.includes('오답노트'));const prior=vm.runInContext('current().groupId',c);click('back-main');assert.equal(node('main').hidden,false);assert.equal(vm.runInContext('current().groupId',c),prior);
click('sky-case',3);assert(node('#activity').innerHTML.includes('건너뛰기'));click('sky-skip');assert.equal(vm.runInContext('state.sky.items[0].stars',c),3);assert.equal(vm.runInContext('state.sky.pending',c),null);click('sky-detail',0);assert(node('#activity').innerHTML.includes('보상 확인'));for(const t of [...timers])if(!t.cancelled&&t.ms===700)t.fn();assert(node('#activity').innerHTML.includes('번째 별'));click('sky-detail-back');click('close-activity');
click('sky-case',10);click('sky-detail',0);for(const t of [...timers])if(!t.cancelled&&t.ms===1000)t.fn();assert(node('#activity').innerHTML.includes('이야기'));assert.equal(vm.runInContext('state.sky.items[0].viewed',c),true);click('sky-detail-back');click('sky-search');assert(node('#activity').innerHTML.includes('이름을 알려주세요'));click('close-activity');
vm.runInContext('state=M.create();editing=null;render()',c);click('diagnosis');assert.equal(vm.runInContext('current().diagnosis',c),'idle');assert(node('#learning').classList.contains('diagnosis-screen'));assert(node('#learning').innerHTML.includes('어디를 더 공부하면'));click('diagnosis-begin');assert.equal(vm.runInContext('current().diagnosis',c),'active');assert(!node('#learning').innerHTML.includes('테스트 전용'));assert(!node('#learning').innerHTML.includes('data-action="diag-start"'));
click('diagnosis-answer',0);click('diagnosis-next');click('close-learning');assert(node('#learning').innerHTML.includes('지금까지 푼 내용은 저장'));click('diagnosis-stay');assert(node('#learning').innerHTML.includes('문항 2 / 3'));click('close-learning');click('diagnosis-leave');assert.equal(node('#learning').open,false);assert.equal(vm.runInContext('state.daily.timerRunning',c),false);click('diagnosis');assert(node('#learning').innerHTML.includes('문항 2 / 3'));assert(!node('#learning').innerHTML.includes('diagnosis-begin'));click('diagnosis-answer',0);click('diagnosis-next');click('diagnosis-answer',0);click('diagnosis-next');assert.equal(node('#prescription').open,true);assert(node('#composition-title').textContent.includes('수고했어요'));for(const t of [...timers])if(!t.cancelled&&t.ms===2400)t.fn();assert(node('#composition-copy').textContent.includes('더 익힐 내용을'));for(const t of [...timers])if(!t.cancelled&&(t.ms===8000||t.ms===7000))t.fn();assert.equal(node('#prescription').open,false);assert.equal(vm.runInContext('current().diagnosticResult.incorrect',c),2);click('diagnosis');assert(node('#learning').innerHTML.includes('실력 확인 결과'));assert(!node('#learning').classList.contains('diagnosis-screen'));assert(node('#learning').innerHTML.includes('결손 학습 목표'));assert(!node('#learning').innerHTML.includes('data-action="diag-prescribe"'));click('close-learning');click('program',0);assert.equal(vm.runInContext('current().programs[0].status',c),'active');assert(!node('#learning').innerHTML.includes('data-action="program-start"'));assert(node('#learning').innerHTML.includes('data-action="learner-next"'));click('learner-answer',0);click('learner-next');assert.equal(vm.runInContext('current().programs[0].completedFrames',c),1);
vm.runInContext('state.ui.testControls=true;refreshDialog()',c);assert(node('#learning').innerHTML.includes('테스트 전용'));assert(node('#learning').innerHTML.includes('data-action="program-pass"'));
vm.runInContext('select(3,1);current().diagnosis="idle";current().programs=[];render()',c);click('diagnosis');assert(!node('#learning').innerHTML.includes('diagnosis-begin'));for(const answer of [0,1,1]){click('diagnosis-answer',answer);click('diagnosis-next');}assert(node('#learning').innerHTML.includes('훌륭해요'));assert(node('#learning').classList.contains('diagnosis-screen'));click('diagnosis-leave');click('diagnosis');assert(node('#learning').innerHTML.includes('실력 확인 결과'));assert(!node('#learning').classList.contains('diagnosis-screen'));
click('close-learning');click('replay-first');assert.equal(vm.runInContext('composing.total',c),8000);assert.equal(vm.runInContext('current().presentationPending',c),undefined);for(const t of [...timers])if(!t.cancelled&&t.ms===5200)t.fn();assert(node('#composition-title').textContent.includes('님을 위한 학습'));for(const t of [...timers])if(!t.cancelled&&t.ms===8000)t.fn();assert(node('#programs').innerHTML.includes('여기부터 시작해요'));assert.equal(vm.runInContext('state.ui.prescriptionSeen',c),true);click('replay-repeat');assert.equal(vm.runInContext('composing.total',c),7000);for(const t of [...timers])if(!t.cancelled&&t.ms===7000)t.fn();click('program',0);assert.equal(vm.runInContext('current().presentationPending',c),false);assert(!node('#programs').innerHTML.includes('여기부터 시작해요'));
console.log('UI state-flow, diagnosis result and clean learner-view checks passed (DOM substitute)');

// Preset loading uses the original app without replacing its click listeners.
vm.runInContext("window.__JEI_REVIEW__.scenario='4'",c);
vm.runInContext(fs.readFileSync('dist/preview-controls.js','utf8'),c);
assert.equal(vm.runInContext('current().programs[0].status',c),'active');
click('program',0);assert.equal(node('#learning').open,true);
click('close-learning');click('mypage');assert.equal(node('main').hidden,true);
console.log('Direct-view storage adapter and original prototype button interactions passed');

// V3.3: celebrate, introduce the next part, then start only on an explicit click.
vm.runInContext('state=M.create();editing=null;render()',c);
click('diagnosis');click('diagnosis-begin');
for(const answer of [0,1,1]){click('diagnosis-answer',answer);click('diagnosis-next');}
assert(node('#learning').innerHTML.includes('진단을 통과했어요!'));
assert(!node('#learning').innerHTML.includes('D등급을 통과했어요!'));
assert(node('#learning').innerHTML.includes('data-action="pass-next"'));
assert.equal(vm.runInContext('state.index',c),0); // no automatic navigation while reading
assert.equal(vm.runInContext('current().diagnosticResult.incorrect',c),0);
assert.equal(vm.runInContext('state.daily.timerRunning',c),false);
click('pass-details');assert(node('#learning').innerHTML.includes('실력 확인 결과'));
click('pass-summary');assert(node('#learning').innerHTML.includes('진단을 통과했어요!'));
click('diagnosis-leave');
assert(node('#diagnostic').classList.contains('clean-passed'));
assert(node('#diagnostic').innerHTML.includes('진단 통과'));
assert(node('#ai-message').textContent.includes('진단을 통과했어요'));
assert(node('#recommend').textContent.includes('다음 단계 만나기'));
// A persisted clean record has the same clear status after re-rendering.
vm.runInContext('state=JSON.parse(JSON.stringify(state));render()',c);
assert(node('#diagnostic').classList.contains('clean-passed'));
click('recommend');
assert.equal(vm.runInContext('state.index',c),0);
assert.equal(vm.runInContext('state.grades[3][1].diagnosis',c),'idle');
assert.equal(vm.runInContext('state.daily.timerRunning',c),false);
assert(node('#learning').innerHTML.includes('다음 도전이 열렸어요!'));
assert(node('#learning').innerHTML.includes('data-action="pass-begin"'));
click('pass-next');assert.equal(vm.runInContext('state.index',c),0); // repeated prepare click cannot skip a part
click('pass-summary');assert(node('#learning').innerHTML.includes('진단을 통과했어요!'));
click('pass-begin');assert.equal(vm.runInContext('state.index',c),0); // cannot start from the celebration
click('pass-next');click('diagnosis-leave');
assert.equal(node('#learning').open,false);
assert.equal(vm.runInContext('state.grades[3][1].diagnosis',c),'idle');
vm.runInContext('state=JSON.parse(JSON.stringify(state));render()',c);
click('recommend');assert(node('#learning').innerHTML.includes('다음 도전이 열렸어요!'));
click('pass-begin');assert.equal(vm.runInContext('state.index',c),1);
assert.equal(vm.runInContext('current().diagnosis',c),'active');
assert.equal(node('#learning').open,true);
assert(node('#learning').innerHTML.includes('문항 1 / 3'));
assert.equal(vm.runInContext('state.grades[3][0].diagnosticResult.incorrect',c),0);
click('pass-next');click('pass-begin');assert.equal(vm.runInContext('state.index',c),1); // stale/double click
click('diagnosis-answer',0);click('diagnosis-next');
vm.runInContext('select(3,0)',c);click('pass-next');click('pass-begin');
assert(node('#learning').innerHTML.includes('문항 2 / 3')); // existing next session survives
// The last group alone does not pass a grade; unfinished earlier groups are offered.
vm.runInContext('state=M.create();state.index=state.grades[3].length-1;current().diagnosis="done";render()',c);
assert.equal(vm.runInContext('cleanPassInfo().gradeComplete',c),false);
assert.equal(vm.runInContext('cleanPassInfo().next.grade',c),3);
assert.equal(vm.runInContext('cleanPassInfo().next.index',c),0);
assert.equal(vm.runInContext('cleanPassInfo().nextLabel',c),'남은 학습');
// A grade passes only after every group, including prescribed programs, has passed.
vm.runInContext('state.grades[3].forEach(s=>{s.diagnosis="done";s.programs=[]});state.grades[3][0].programs=M.programs(1,3,0);render()',c);
assert.equal(vm.runInContext('cleanPassInfo().gradeComplete',c),false);
assert.equal(vm.runInContext('cleanPassInfo().next.kind',c),'program');
vm.runInContext('state.grades[3][0].programs[0].status="passed";M.setProgress(state.grades[3][0].programs[0],100);editing={kind:"diagnosis",complete:true};refreshDialog()',c);
assert.equal(vm.runInContext('cleanPassInfo().gradeComplete',c),true);
assert(node('#learning').innerHTML.includes('D등급을 통과했어요!'));
assert(node('#learning').innerHTML.includes('다음 단계 만나기'));
click('pass-next');assert.equal(vm.runInContext('state.grade',c),3);
assert(node('#learning').innerHTML.includes('E등급'));
assert.equal(vm.runInContext('state.grades[4][0].diagnosis',c),'idle');
click('pass-begin');assert.equal(vm.runInContext('state.grade',c),4);
assert(node('#learning').innerHTML.includes('E등급 /'));
// Existing prescribed learning resumes instead of being reset or skipped.
vm.runInContext('state=M.create();state.ui={diagnosisIntroSeen:true};current().diagnosis="done";state.grades[3][1].diagnosis="done";state.grades[3][1].programs=M.programs(1,3,1);state.grades[3][1].programs[0].status="active";M.setProgress(state.grades[3][1].programs[0],40);render()',c);
const progressBefore=vm.runInContext('state.grades[3][1].programs[0].progress',c);
click('pass-next');assert.equal(vm.runInContext('state.index',c),0);
assert(node('#learning').innerHTML.includes('맞춤 학습'));
assert(!node('#learning').innerHTML.includes('새로운 도전'));
click('pass-begin');assert.equal(vm.runInContext('editing.kind',c),'program');
assert.equal(vm.runInContext('current().programs[0].progress',c),progressBefore);
// Final grade has no invented destination; exiting keeps the completed state.
vm.runInContext('state=M.create();state.grade=9;state.grades[9].forEach(s=>{s.diagnosis="done";s.programs=[]});editing={kind:"diagnosis",complete:true};render();refreshDialog()',c);
assert.equal(vm.runInContext('cleanPassInfo().next',c),null);
assert(node('#learning').innerHTML.includes('J등급을 통과했어요!'));
assert(!node('#learning').innerHTML.includes('data-action="pass-next"'));
click('diagnosis-leave');assert.equal(node('#learning').open,false);
assert.equal(vm.runInContext('state.grade',c),9);
assert(!html.includes('id="ai-state"'));
assert(/class="groups-trigger"[^>]+aria-label="진단 그룹 목록 열기"[^>]*>\s*<svg/.test(html));
console.log('V3.3 celebration, preparation, explicit start, grade accuracy, pause/persistence and progress preservation passed');

// The decorative morph follows real typing, and stale timers cannot restart it.
vm.runInContext("state=M.create();lastMessage='';render()",c);
assert.equal(node('.ai-top')['data-mentor-state'],'thinking');
vm.runInContext('thinkTimer',c).fn();
assert.equal(node('.ai-top')['data-mentor-state'],'speaking');
vm.runInContext('mentorTimer',c).fn();
assert.equal(node('#mentor-symbol')['data-shape'],'plus');
for(const shape of ['times','minus','divide']){
  vm.runInContext('mentorTimer',c).fn();
  assert.equal(node('#mentor-symbol')['data-shape'],shape);
}
const staleMorph=vm.runInContext('mentorTimer',c);
for(let guard=0;guard<300&&vm.runInContext('aiState',c)==='반응 중';guard++)vm.runInContext('animTimer',c).fn();
assert.equal(node('.ai-top')['data-mentor-state'],'idle');
assert.equal(node('#ai-message')['aria-busy'],'false');
const idleMorph=vm.runInContext('mentorTimer',c);staleMorph.fn();
assert.equal(vm.runInContext('mentorTimer',c),idleMorph);
idleMorph.fn();assert.equal(node('#mentor-symbol')['data-shape'],'clover');
for(let cycle=0;cycle<2;cycle++)for(const shape of ['plus','divide','times','minus','clover']){
  const timer=vm.runInContext('mentorTimer',c);assert.equal(timer.ms,2400);timer.fn();
  assert.equal(node('#mentor-symbol')['data-shape'],shape);assert(vm.runInContext('mentorTimer',c));
}
vm.runInContext("setAIState('반응 중')",c);
const hiddenMorph=vm.runInContext('mentorTimer',c);
c.document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(vm.runInContext('mentorTimer',c),null);hiddenMorph.fn();
assert.equal(vm.runInContext('mentorTimer',c),null);
assert.equal(node('.ai-top')['data-mentor-paused'],'true');
c.document.visibilityState='visible';listeners.visibilitychange();
assert.equal(node('.ai-top')['data-mentor-paused'],'false');
c.matchMedia=()=>({matches:true});vm.runInContext("setAIState('대기');setAIState('반응 중')",c);
assert.equal(node('#mentor-symbol')['data-shape'],'plus');assert.equal(vm.runInContext('mentorTimer',c),null);
vm.runInContext("setAIState('대기')",c);assert.equal(node('#mentor-symbol')['data-shape'],'clover');
console.log('Mentor message lifecycle, arithmetic cycle, stale timer cancellation, hidden-tab pause and reduced-motion checks passed');


// V3.4: dots expand into readable speech and return without erasing the message.
c.matchMedia=()=>({matches:false});c.document.visibilityState='visible';
node('.ai-top').getBoundingClientRect=()=>({width:460,height:44});
node('#mentor-measure').getBoundingClientRect=function(){const cap=parseFloat(this.style.maxWidth)||400;return {width:Math.min(cap,this.textContent.length*8),height:23*Math.max(1,Math.ceil(this.textContent.length*8/cap))};};
vm.runInContext("state=M.create();lastMessage='';render()",c);
assert.equal(node('.ai-top')['data-bubble-phase'],'thinking');
assert.equal(node('#mentor-bubble').style.width,'56px');
vm.runInContext('thinkTimer',c).fn();
assert.equal(node('.ai-top')['data-bubble-phase'],'speaking');
const shortWidth=parseFloat(node('#mentor-bubble').style.width);
for(let i=0;i<300&&vm.runInContext('aiState',c)==='반응 중';i++)vm.runInContext('animTimer',c).fn();
assert.equal(node('.ai-top')['data-bubble-phase'],'holding');
assert(parseFloat(node('#mentor-bubble').style.width)>shortWidth);
assert(parseFloat(node('#mentor-bubble').style.width)<=404);
const message=node('#ai-message').textContent,oldRest=vm.runInContext('bubbleTimer',c);
c.document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(vm.runInContext('bubbleTimer',c),null);
c.document.visibilityState='visible';listeners.visibilitychange();
vm.runInContext('bubbleTimer',c).fn();
assert.equal(node('.ai-top')['data-bubble-phase'],'rest');
assert.equal(node('#mentor-bubble').style.width,'56px');
assert.equal(node('#ai-message').textContent,message);
click('mentor-repeat');oldRest.fn();
assert.equal(node('.ai-top')['data-bubble-phase'],'thinking'); // cancelled prior rest cannot hide a replay
c.matchMedia=()=>({matches:true});click('mentor-repeat');
assert.equal(node('.ai-top')['data-bubble-phase'],'holding');
assert.equal(node('#ai-message').textContent,message);
assert.equal(node('#ai-message')['aria-busy'],'false');
console.log('V3.4 speech measurement, reading hold, collapse, replay, hidden-tab pause and reduced-motion passed');

// A long message stays at one-line height even in a narrow mentor slot.
for(const width of [210,460]){
  node('.ai-top').getBoundingClientRect=()=>({width,height:44});
  for(const length of [30,160]){
    const longMessage='학습 안내 '.repeat(length);
    node('#ai-message').textContent=longMessage;
    vm.runInContext("setBubblePhase('holding')",c);
    assert.equal(node('#mentor-bubble').style.height,'40px');
    assert(parseFloat(node('#mentor-bubble').style.width)<=width-56);
    assert.equal(node('#ai-message').textContent,longMessage); // full content remains readable by horizontal scrolling
  }
}
console.log('Long mentor messages keep fixed one-line height without losing their full content');

// V3.4.4: preparation follows the latest action, not every render or mentor message.
c.matchMedia=()=>({matches:false});c.document.visibilityState='visible';
vm.runInContext("state=M.create();editing=null;activityKind=null;$('#learning').close();$('#activity').close();render()",c);
assert.equal(node('.recommend')['data-recommend-state'],'loading');
assert.equal(node('.recommend')['aria-busy'],'true');
assert.equal(node('.recommend-loader').hidden,false);
assert.equal(node('#recommend').disabled,true);
assert.equal(node('#recommend-status').textContent,'추천 활동 준비 중');
const firstPreparation=vm.runInContext('recommendationTimer',c);
assert.equal(firstPreparation.ms,800);
click('recommend',0,false);assert.equal(node('#activity').open,false); // hidden action cannot open
vm.runInContext('daily().variant++;render()',c);
assert.equal(vm.runInContext('recommendationTimer',c),firstPreparation); // no restart for mentor variant
assert.equal(node('#recommend').disabled,true);
vm.runInContext('daily().unreadAnswers=1;render()',c);
const latestPreparation=vm.runInContext('recommendationTimer',c);
assert.notEqual(latestPreparation,firstPreparation);
assert.equal(firstPreparation.cancelled,true);
firstPreparation.fn();assert.equal(node('.recommend')['data-recommend-state'],'loading');
latestPreparation.fn();
assert.equal(node('.recommend')['data-recommend-state'],'ready');
assert.equal(node('.recommend')['aria-busy'],'false');
assert.equal(node('.recommend-loader').hidden,true);
assert.equal(node('#recommend').disabled,false);
assert(node('#recommend').textContent.includes('도와줘요'));
click('recommend',0,false);assert(node('#activity').innerHTML.includes('도와줘요'));
click('close-activity');vm.runInContext('render()',c);
assert.equal(vm.runInContext('recommendationTimer',c),null); // unchanged ready content stays ready
vm.runInContext('daily().unreadAnswers=0;render()',c);
const beforeHide=vm.runInContext('recommendationTimer',c);
c.document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(vm.runInContext('recommendationTimer',c),null);
assert.equal(node('.recommend')['data-recommend-paused'],'true');
beforeHide.fn();assert.equal(node('.recommend')['data-recommend-state'],'loading');
c.document.visibilityState='visible';listeners.visibilitychange();
const afterShow=vm.runInContext('recommendationTimer',c);
assert.notEqual(afterShow,beforeHide);
beforeHide.fn();assert.equal(node('.recommend')['data-recommend-state'],'loading');
afterShow.fn();assert.equal(node('.recommend')['data-recommend-state'],'ready');
assert.equal(node('.recommend')['data-recommend-paused'],'false');
// A locked result remains disabled after the loading effect.
vm.runInContext("daily().target=20;daily().started=true;current().diagnosis='done';current().programs=M.programs(1);current().programs[0].status='locked';render()",c);
vm.runInContext('recommendationTimer',c).fn();assert.equal(node('#recommend').disabled,true);
// Reduced motion reveals immediately; no delayed action or floating loop is required.
c.matchMedia=()=>({matches:true});
vm.runInContext('daily().unreadAnswers=1;render()',c);
assert.equal(vm.runInContext('recommendationTimer',c),null);
assert.equal(node('.recommend')['data-recommend-state'],'ready');
assert.equal(node('#recommend').disabled,false);
assert.equal(node('.recommend')['data-recommend-paused'],'true');
console.log('Recommendation preparation, click gating, latest-action cancellation, stable renders, hidden-tab pause and reduced-motion passed');

// V3.4.5: drawer exit remains visible until complete and cannot close a newer panel.
c.matchMedia=()=>({matches:true});
vm.runInContext("if(panel)closePanel();state=M.create();editing=null;$('#learning').close();$('#activity').close();render()",c);
c.matchMedia=()=>({matches:false});
let focusReturned=false;
node('[data-action="groups"]').focus=()=>{focusReturned=true;};
click('groups');
assert.equal(node('#group-panel').hidden,false);
assert.equal(node('#group-panel')['data-panel-phase'],'open');
assert.equal(node('#group-panel').inert,false);
assert.equal(node('.groups-trigger')['aria-expanded'],'true');
assert(node('body').classList.contains('panel-open'));
const groupBefore=vm.runInContext('current().groupId',c);
node('#overlay').listeners.click(); // backdrop uses the real close handler
const interruptedExit=vm.runInContext('panelMotionTimer',c);
assert.equal(node('#group-panel')['data-panel-phase'],'closing');
assert.equal(node('#group-panel').hidden,false);
assert.equal(node('#group-panel').inert,true);
assert.equal(node('#group-panel')['aria-hidden'],'true');
assert.equal(node('#overlay').hidden,false);
assert.equal(node('.groups-trigger')['aria-expanded'],'false');
assert.equal(focusReturned,true);
vm.runInContext('render()',c);
assert.equal(node('#group-panel').hidden,false); // background update cannot cut off the exit
click('groups');interruptedExit.fn();
assert.equal(node('#group-panel').hidden,false);
assert.equal(node('#group-panel')['data-panel-phase'],'open');
assert.equal(node('#overlay').hidden,false);
assert(node('body').classList.contains('panel-open'));
assert.equal(vm.runInContext('current().groupId',c),groupBefore);
// Selecting a group takes effect at once, while the drawer finishes its exit.
click('select-group',1);
assert.equal(vm.runInContext('state.index',c),1);
assert.equal(node('#group-panel').hidden,false);
const selectionExit=vm.runInContext('panelMotionTimer',c);
selectionExit.fn();
assert.equal(node('#group-panel').hidden,true);
assert.equal(node('#overlay').hidden,true);
assert(!node('body').classList.contains('panel-open'));
// Escape uses the same exit. Opening the right test panel cancels its pending cleanup.
click('groups');listeners.keydown({key:'Escape'});
const escapeExit=vm.runInContext('panelMotionTimer',c);
assert.equal(node('#group-panel')['data-panel-phase'],'closing');
click('test');escapeExit.fn();
assert.equal(node('#test-panel').hidden,false);
assert.equal(node('#group-panel').hidden,true);
assert.equal(node('#overlay').hidden,false);
assert.equal(vm.runInContext('panel',c),'test');
assert(node('body').classList.contains('panel-open'));
click('close-panel');
assert.equal(node('#test-panel').hidden,true);
assert.equal(node('#overlay').hidden,true);
// Reduced motion closes immediately with no invisible blocking overlay.
c.matchMedia=()=>({matches:true});click('groups');click('close-panel');
assert.equal(vm.runInContext('panelMotionTimer',c),null);
assert.equal(node('#group-panel').hidden,true);
assert.equal(node('#overlay').hidden,true);
assert(!node('body').classList.contains('panel-open'));
console.log('Side drawer open/exit, backdrop, Escape, interrupted reopen, render continuity, group selection and reduced-motion passed');

// V3.4.5 overwrite: scanning graphic stays mounted during typing, and card reveal is a single handoff.
c.matchMedia=()=>({matches:false});c.document.visibilityState='visible';
vm.runInContext("cancelComposition();state=M.create();editing=null;$('#learning').close();$('#activity').close();render()",c);
let compositionMarkup=node('#composition').innerHTML,mountWrites=0;
Object.defineProperty(node('#composition'),'innerHTML',{configurable:true,get(){return compositionMarkup;},set(value){compositionMarkup=value;mountWrites++;}});
vm.runInContext('beginComposition(2)',c);
assert.equal(mountWrites,1);
assert(node('#composition').innerHTML.includes('search-lens'));
assert.equal(node('#composition-title').textContent,'수고했어요!');
assert.equal(node('#composition-caret').hidden,true);
vm.runInContext("composing.step=2;composing.text='여기';renderComposition()",c);
assert.equal(node('#composition-copy').textContent,'여기');
assert.equal(node('#composition-caret').hidden,false);
vm.runInContext("composing.text='여기부터';renderComposition();renderComposition()",c);
assert.equal(mountWrites,1); // typing cannot restart the looping lens animation
c.document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(node('#composition')['data-compose-paused'],'true');
c.document.visibilityState='visible';listeners.visibilitychange();
assert.equal(node('#composition')['data-compose-paused'],'false');
vm.runInContext('composeTimers.find(t=>t.ms===8000)',c).fn();
assert.equal(node('#prescription').open,false);
assert.equal(vm.runInContext('current().programs.length',c),2);
assert(node('#programs').classList.contains('reveal'));
const oldCardEnd=vm.runInContext('cardRevealTimer',c);
// Starting a new composition cancels the prior reveal; its end cannot hide the newer animation.
vm.runInContext("beginComposition(1,'repeat')",c);
assert.equal(mountWrites,2);
assert(!node('#programs').classList.contains('reveal'));
vm.runInContext('composeTimers.find(t=>t.ms===7000)',c).fn();
assert(node('#programs').classList.contains('reveal'));
const latestCardEnd=vm.runInContext('cardRevealTimer',c);
oldCardEnd.fn();assert(node('#programs').classList.contains('reveal'));
latestCardEnd.fn();assert(!node('#programs').classList.contains('reveal'));
vm.runInContext('render()',c);assert(!node('#programs').classList.contains('reveal')); // no replay on state refresh
vm.runInContext("beginComposition(1,'repeat')",c);vm.runInContext('composeTimers.find(t=>t.ms===7000)',c).fn();
const cancelledCardEnd=vm.runInContext('cardRevealTimer',c);
vm.runInContext('select(3,1)',c);cancelledCardEnd.fn();
assert.equal(vm.runInContext('current().programs.length',c),0);
assert(!node('#programs').classList.contains('reveal'));
// Reduced motion retains all prescription content and suppresses the card movement.
c.matchMedia=()=>({matches:true});
vm.runInContext("beginComposition(3,'repeat')",c);vm.runInContext('composeTimers.find(t=>t.ms===7000)',c).fn();
assert.equal(vm.runInContext('current().programs.length',c),3);
assert.equal(vm.runInContext('cardRevealTimer',c),null);
assert(!node('#programs').classList.contains('reveal'));
assert.equal(node('#prescription').open,false);
console.log('Prescription scan mount continuity, typing, hidden pause, one-time reveal, interrupted replay, selection and reduced-motion passed');

// The whole long mentor message remains available; reading reaches its end before collapse.
c.matchMedia=()=>({matches:false});c.document.visibilityState='visible';
const originalMentorRect=node('.ai-top').getBoundingClientRect,originalMentorMeasure=node('#mentor-measure').getBoundingClientRect;
node('.ai-top').getBoundingClientRect=()=>({width:300,height:44});
node('#mentor-measure').getBoundingClientRect=function(){return {width:this.textContent.length*10,height:22};};
node('#ai-message').clientWidth=130;node('#ai-message').scrollWidth=680;
vm.runInContext("cancelComposition();state=M.create();M.preset(state,3);lastMessage='';render();animateMessage(true)",c);
vm.runInContext('thinkTimer',c).fn();
for(let i=0;i<500&&vm.runInContext('aiState',c)==='반응 중';i++)vm.runInContext('animTimer',c).fn();
const fullMentorCopy=node('#ai-message').textContent;
assert.equal(node('#mentor-bubble').style.height,'40px');
assert.equal(node('#mentor-read-controls').hidden,false);
assert.equal(node('#ai-message').tabIndex,0);
assert.equal(node('#ai-message').scrollLeft,0);
assert.equal(vm.runInContext('bubbleTimer',c),null); // no expiry while words are still outside the viewport
assert.equal(vm.runInContext('mentorReadTimer',c).ms,1800);
for(let i=0;i<500&&vm.runInContext('mentorReadTimer',c);i++)vm.runInContext('mentorReadTimer',c).fn();
assert.equal(node('#ai-message').scrollLeft,550);
assert.equal(node('#mentor-read-next').disabled,true);
assert.equal(node('#ai-message').textContent,fullMentorCopy);
assert.equal(node('.ai-top')['data-bubble-phase'],'holding');
assert.equal(vm.runInContext('bubbleTimer',c).ms,5000); // final words get their own reading hold
vm.runInContext('bubbleTimer',c).fn();assert.equal(node('.ai-top')['data-bubble-phase'],'rest');
// Pause on hover/focus and leave manual navigation in the learner's control.
node('#ai-message').scrollLeft=0;vm.runInContext("setBubblePhase('holding');scheduleBubbleRest()",c);
const staleRead=vm.runInContext('mentorReadTimer',c);
node('#mentor-bubble').listeners.pointerenter({pointerType:'mouse'});
assert.equal(vm.runInContext('mentorReadTimer',c),null);staleRead.fn();assert.equal(node('#ai-message').scrollLeft,0);
node('#mentor-bubble').listeners.pointerleave();
const hiddenRead=vm.runInContext('mentorReadTimer',c);
c.document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(vm.runInContext('mentorReadTimer',c),null);
c.document.visibilityState='visible';listeners.visibilitychange();hiddenRead.fn();
assert.equal(node('#ai-message').scrollLeft,0);
node('#mentor-bubble').listeners.focusin();click('mentor-read-next');
assert.equal(node('#ai-message').scrollLeft,104);
assert.equal(vm.runInContext('mentorReadTimer',c),null);
assert.equal(vm.runInContext('bubbleTimer',c),null);
let keyHandled=false;node('#ai-message').listeners.keydown({key:'ArrowRight',preventDefault(){keyHandled=true;}});
assert.equal(keyHandled,true);assert.equal(node('#ai-message').scrollLeft,208);
click('mentor-read-back');assert.equal(node('#ai-message').scrollLeft,104);
node('#mentor-bubble').listeners.focusout({relatedTarget:null});
assert(vm.runInContext('mentorReadTimer',c));
// Reduced motion still exposes all words with the arrows; the bubble does not expire unseen.
c.matchMedia=()=>({matches:true});vm.runInContext('animateMessage(true)',c);
assert.equal(vm.runInContext('mentorReadTimer',c),null);
assert.equal(vm.runInContext('bubbleTimer',c),null);
assert.equal(node('#mentor-read-controls').hidden,false);
assert.equal(node('#ai-message').textContent,fullMentorCopy);
click('mentor-read-next');assert.equal(node('#ai-message').scrollLeft,104);
node('.ai-top').getBoundingClientRect=originalMentorRect;node('#mentor-measure').getBoundingClientRect=originalMentorMeasure;
delete node('#ai-message').clientWidth;delete node('#ai-message').scrollWidth;
console.log('Long single-line mentor copy reaches its end, supports arrows/keyboard, pauses for reading, and remains readable with reduced motion');

// Acknowledgment, search and preparation each have reading time, including repeated prescriptions.
c.matchMedia=()=>({matches:false});
vm.runInContext("cancelComposition();state=M.create();render();beginComposition(2,'first')",c);
assert.equal(vm.runInContext('composing.searchAt',c),2400);
assert.equal(vm.runInContext('composing.readyAt',c),5200);
assert.equal(vm.runInContext('composing.total',c),8000);
assert.equal(node('#composition')['data-compose-step'],'0');
assert(node('#composition').innerHTML.includes('prescription-complete'));
for(const t of vm.runInContext('composeTimers',c))if(t.ms<2400&&!t.cancelled)t.fn();
assert.equal(node('#composition-title').textContent,'수고했어요!');
vm.runInContext('composeTimers.find(t=>t.ms===2400)',c).fn();
assert.equal(node('#composition')['data-compose-step'],'1');
assert(node('#composition-title').textContent.includes('찾고 있어요'));
assert.equal(vm.runInContext('current().programs.length',c),0);
vm.runInContext('composeTimers.find(t=>t.ms===5200)',c).fn();
for(const t of vm.runInContext('composeTimers',c).filter(t=>t.ms>5200&&t.ms<8000).sort((a,b)=>a.ms-b.ms))t.fn();
assert.equal(node('#composition-copy').textContent,'여기부터 시작해 볼까요?');
assert.equal(node('#prescription').open,true);
assert(vm.runInContext('composing.total-composing.readyAt-composing.message.length*45>=2000',c));
vm.runInContext('composeTimers.find(t=>t.ms===8000)',c).fn();
assert.equal(vm.runInContext('current().programs.length',c),2);
vm.runInContext("beginComposition(1,'repeat')",c);
const priorSearch=vm.runInContext('composeTimers.find(t=>t.ms===2000)',c),priorFinish=vm.runInContext('composeTimers.find(t=>t.ms===7000)',c);
assert.equal(vm.runInContext('composing.searchAt',c),2000);
assert.equal(vm.runInContext('composing.readyAt',c),4400);
assert.equal(vm.runInContext('composing.total',c),7000);
vm.runInContext("beginComposition(3,'repeat')",c);priorSearch.fn();priorFinish.fn();
assert.equal(node('#composition')['data-compose-step'],'0');
assert.equal(vm.runInContext('composing.count',c),3); // cancelled callbacks for the same group cannot skip the new acknowledgment
assert.equal(node('#prescription').open,true);
vm.runInContext('composeTimers.find(t=>t.ms===7000)',c).fn();
assert.equal(vm.runInContext('current().programs.length',c),3);
console.log('Prescription acknowledgment/search/reading durations and cancelled-run isolation passed');
