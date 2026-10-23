// UI state-flow smoke checks with a minimal DOM substitute; not browser layout QA.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map(),timers=[],listeners={};
function node(key){if(nodes.has(key))return nodes.get(key);const classes=new Set();const n={style:{setProperty(name,value){this[name]=value;}},hidden:false,disabled:false,innerHTML:'',textContent:'',value:8,offsetWidth:1,children:[],classList:{add(...a){a.forEach(x=>classes.add(x));},remove(...a){a.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);}},setAttribute(k,v){this[k]=v;},getAttribute(k){return this[k]??null;},removeAttribute(k){delete this[k];},getBoundingClientRect(){return {left:0,top:0,width:key==='#mentor-measure'?this.textContent.length*8:key==='.ai-top'?616:240,height:240};},append(x){if(x.parent)x.parent.children=x.parent.children.filter(y=>y!==x);this.children.push(x);x.parent=this;},prepend(x){if(x.parent)x.parent.children=x.parent.children.filter(y=>y!==x);this.children.unshift(x);x.parent=this;},animate(){},focus(){},close(){this.open=false;},showModal(){this.open=true;},addEventListener(k,f){(this.listeners??={})[k]=f;},contains(t){for(let p=t;p;p=p.parent)if(p===this)return true;return false;},querySelectorAll(){return [];}};nodes.set(key,n);return n;}
const c=vm.createContext({console,SkyModel:require('../dist/working/sky.js').SkyModel,window:{innerWidth:1200,innerHeight:800,scrollY:0,scrollTo(){}},MathModel:require('../dist/working/model.js').MathModel,document:{querySelector:node,addEventListener(k,f){const previous=listeners[k];listeners[k]=previous?e=>{previous(e);f(e);}:f;},body:node('body')},localStorage:{getItem(){return null;},setItem(){}},matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},setInterval:()=>0,clearInterval(){}});
// Real-document adapter runs before the application's original event handlers.
c.innerWidth=1200;c.innerHeight=800;c.scrollY=0;c.scrollTo=()=>{};c.window=c;
c.document.currentScript={dataset:{version:'working'}};c.location={search:'',origin:'https://review.example'};c.URLSearchParams=URLSearchParams;
vm.runInContext(fs.readFileSync('dist/preview-runtime.js','utf8'),c);
vm.runInContext(fs.readFileSync('dist/working/app.js','utf8'),c);
vm.runInContext(fs.readFileSync('dist/preview-controls.js','utf8'),c);
function settleDiagnosisOutcome(){
  if(vm.runInContext('current().diagnosisOutcome?.stage',c)==='summary')click('diagnosis-outcome-confirm');
  for(let i=0;i<10&&vm.runInContext('!!diagnosisOutcomeRun',c);i++){
    const timer=vm.runInContext('diagnosisOutcomeTimer',c);assert(timer&&!timer.cancelled);timer.fn();
  }
  assert.equal(vm.runInContext('diagnosisOutcomeRun',c),null);
}
assert.equal(node('#diagnostic').parent,node('#diagnosis-welcome-action'));
vm.runInContext('M.preset(state,3);render()',c);assert.equal(node('#diagnostic').parent,node('#diagnostic-result-slot'));assert.equal(node('#diagnosis-section').hidden,true);
vm.runInContext('M.preset(state,0);render();beginComposition(8)',c);assert.equal(node('#programs').hidden,true);assert.equal(node('#composition').hidden,false);assert.equal(node('#diagnostic').disabled,true);assert.equal(vm.runInContext('current().programs.length',c),0);
for(const t of [...timers].sort((a,b)=>a.ms-b.ms)){if(!t.cancelled)t.fn();}
assert.equal(vm.runInContext('current().programs.length',c),8);assert.equal(node('#composition').hidden,true);assert.equal(node('#diagnostic').parent,node('#diagnostic-result-slot'));assert.equal(node('#diagnostic').disabled,false);
vm.runInContext('M.preset(state,2);render()',c);assert.equal(node('#diagnostic').parent,node('#diagnosis-slot'));assert.equal(node('#diagnosis-section').hidden,false);
vm.runInContext('beginComposition(52);select(3,1)',c);for(const t of [...timers]){if(!t.cancelled&&(t.ms===8000||t.ms===7000))t.fn();}assert.equal(vm.runInContext('current().programs.length',c),0);
for(const i of [0,1,2]){vm.runInContext(`M.preset(state,${i});render()`,c);assert.equal(node('#programs').hidden,true);assert.equal(node('#programs').innerHTML,'');assert(!node('#diagnostic').innerHTML.includes('진단 열기'));}
const html=fs.readFileSync('dist/working/index.html','utf8');for(const text of ['<footer>','선택한 그룹의 진단','id="program-heading"'])assert(!html.includes(text));
// Accessible section names may describe AI guidance; duplicate visible headings stay absent.
assert(!/<h[1-6]\b[^>]*>\s*학습 안내\s*<\/h[1-6]>/u.test(html));
settleGuidance();assert(node('#ai-message').textContent.includes('진단을 통과했어요'));assert.equal(node('#ai-message')['aria-busy'],'false');
vm.runInContext('M.preset(state,0);render()',c);assert(!node('#ai-message').textContent);assert.equal(node('#ai-message')['aria-busy'],'true');
vm.runInContext('M.preset(state,3);render()',c);assert(!node('#programs').innerHTML.includes('<progress'));assert(node('#programs').innerHTML.includes('is-locked'));assert(!node('#programs').innerHTML.includes('프로그램 01'));vm.runInContext('M.preset(state,4);render()',c);assert.equal((node('#programs').innerHTML.match(/<progress/g)||[]).length,1);assert.equal((node('#programs').innerHTML.match(/is-current/g)||[]).length,1);vm.runInContext('current().programs[0].progress=100;render()',c);assert(!node('#programs').innerHTML.includes('<progress'));assert(node('#programs').innerHTML.includes('풀이 완료'));vm.runInContext('M.preset(state,6);render()',c);assert(!node('#programs').innerHTML.includes('<progress'));
vm.runInContext('state=M.create();render()',c);assert(node('#group-title').textContent.includes('비교와 분류'));assert(!node('#group-title').textContent.includes('D01'));vm.runInContext('openPanel("groups")',c);assert(node('#group-panel').innerHTML.includes('모으기와 가르기(10)'));vm.runInContext('select(0,0)',c);assert(node('#group-title').textContent.includes('모양'));
function settleGuidance(){const panelExit=vm.runInContext('panelMotionTimer',c);if(panelExit&&!panelExit.cancelled&&vm.runInContext("groupPanelPhase==='closing'",c))panelExit.fn();const t=vm.runInContext('guidanceClosingTimer',c);if(t&&!t.cancelled)t.fn();}
function finishSpeech(){if(vm.runInContext('bubblePhase',c)==='thinking')vm.runInContext('thinkTimer',c)?.fn();for(let i=0;i<1000&&vm.runInContext('aiState',c)==='반응 중';i++)vm.runInContext('animTimer',c)?.fn();}
function prepareOverview(){vm.runInContext("editing=null;activityKind=null;myOpen=false;skyBusy=false;$('#learning').close();$('#activity').close();$('#help').close();if(panel)closePanel();",c);settleGuidance();}
function click(action,id=0,waitForRecommendation=true,waitForGuidance=true){
  if(action==='recommend'&&waitForRecommendation){const t=vm.runInContext('recommendationTimer',c);if(t&&!t.cancelled)t.fn();}
  listeners.click({target:{closest:()=>({dataset:{action,id:String(id)},disabled:action==='recommend'?node('#recommend').disabled:false})}});
  if(waitForGuidance&&!['groups','select-group'].includes(action))settleGuidance();
}
click('recommend');assert.equal(node('#activity').open,true);assert(node('#activity').innerHTML.includes('목표 학습 시간'));node('#goal-minutes').value=20;click('save-goal');assert.equal(vm.runInContext('state.daily.target',c),20);assert(node('#recommend-copy').textContent.includes('오늘의 학습'));
click('diagnosis');click('diag-start');assert.equal(vm.runInContext('state.daily.started',c),true);click('diag-prescribe');settleDiagnosisOutcome();click('program',0);click('program-start');click('program-frame');assert.equal(vm.runInContext('current().programs[0].completedFrames',c),1);for(let i=0;i<5;i++)click('program-retry');assert(vm.runInContext('M.message(state)',c).includes('차분하게'));click('program-frame');assert(!vm.runInContext('M.message(state)',c).includes('차분하게'));
node('#sky-transition').animate=undefined;node('#activity').animate=undefined;click('constellation');assert(node('#activity').innerHTML.includes('별자리'));click('close-activity');vm.runInContext('state.daily.unreadAnswers=1;render()',c);click('recommend');assert(node('#activity').innerHTML.includes('도와줘요'));click('answer-read');assert.equal(vm.runInContext('state.daily.unreadAnswers',c),0);
click('mypage');assert.equal(node('main').hidden,true);assert(node('#mypage').innerHTML.includes('학습 캘린더'));assert(node('#mypage').innerHTML.includes('오답노트'));const prior=vm.runInContext('current().groupId',c);click('back-main');assert.equal(node('main').hidden,false);assert.equal(vm.runInContext('current().groupId',c),prior);
click('sky-case',3);assert(node('#activity').innerHTML.includes('건너뛰기'));click('sky-skip');assert.equal(vm.runInContext('state.sky.items[0].stars',c),3);assert.equal(vm.runInContext('state.sky.pending',c),null);click('sky-detail',0);assert(node('#activity').innerHTML.includes('보상 확인'));for(const t of [...timers])if(!t.cancelled&&t.ms===700)t.fn();assert(node('#activity').innerHTML.includes('번째 별'));click('sky-detail-back');click('close-activity');
click('sky-case',10);click('sky-detail',0);for(const t of [...timers])if(!t.cancelled&&t.ms===1000)t.fn();assert(node('#activity').innerHTML.includes('이야기'));assert.equal(vm.runInContext('state.sky.items[0].viewed',c),true);click('sky-detail-back');click('sky-search');assert(node('#activity').innerHTML.includes('이름을 알려주세요'));click('close-activity');
vm.runInContext('state=M.create();editing=null;render()',c);click('diagnosis');assert.equal(vm.runInContext('current().diagnosis',c),'idle');assert(node('#learning').classList.contains('diagnosis-screen'));assert(node('#learning').innerHTML.includes('어디를 더 공부하면'));click('diagnosis-begin');assert.equal(vm.runInContext('current().diagnosis',c),'active');assert(!node('#learning').innerHTML.includes('테스트 전용'));assert(!node('#learning').innerHTML.includes('data-action="diag-start"'));
click('diagnosis-answer',0);click('diagnosis-next');click('close-learning');assert(node('#learning').innerHTML.includes('지금까지 푼 내용은 저장'));click('diagnosis-stay');assert(node('#learning').innerHTML.includes('문항 2 / 3'));click('close-learning');click('diagnosis-leave');assert.equal(node('#learning').open,false);assert.equal(vm.runInContext('state.daily.timerRunning',c),false);click('diagnosis');assert(node('#learning').innerHTML.includes('문항 2 / 3'));assert(!node('#learning').innerHTML.includes('diagnosis-begin'));click('diagnosis-answer',0);click('diagnosis-next');click('diagnosis-answer',0);click('diagnosis-next');assert.equal(node('#prescription').open||false,false);assert.equal(node('#learning').open,true);assert.equal(node('#composition-title').textContent,'수고했어요!');assert.equal(vm.runInContext('current().diagnosisOutcome.stage',c),'summary');settleDiagnosisOutcome();assert.equal(node('#prescription').open,false);assert.equal(vm.runInContext('current().diagnosticResult.incorrect',c),2);click('diagnosis');assert(node('#learning').innerHTML.includes('실력 확인 결과'));assert(!node('#learning').classList.contains('diagnosis-screen'));assert(node('#learning').innerHTML.includes('결손 학습 목표'));assert(!node('#learning').innerHTML.includes('data-action="diag-prescribe"'));click('close-learning');click('program',0);assert.equal(vm.runInContext('current().programs[0].status',c),'idle');assert.equal(vm.runInContext('editing.intro',c),true);click('program-begin');assert.equal(vm.runInContext('current().programs[0].status',c),'active');assert(!node('#learning').innerHTML.includes('data-action="program-start"'));assert(node('#learning').innerHTML.includes('data-action="learner-next"'));click('learner-answer',0);click('learner-next');assert.equal(vm.runInContext('current().programs[0].completedFrames',c),1);
vm.runInContext('state.ui.testControls=true;refreshDialog()',c);assert(node('#learning').innerHTML.includes('테스트 전용'));assert(node('#learning').innerHTML.includes('data-action="program-pass"'));
vm.runInContext('select(3,1);current().diagnosis="idle";current().programs=[];render()',c);click('diagnosis');assert(!node('#learning').innerHTML.includes('diagnosis-begin'));for(const answer of [0,1,1]){click('diagnosis-answer',answer);click('diagnosis-next');}settleDiagnosisOutcome();assert.equal(node('#learning').open,false);assert.equal(vm.runInContext('state.index',c),2);vm.runInContext('select(3,1)',c);click('diagnosis');assert(node('#learning').innerHTML.includes('실력 확인 결과'));assert(!node('#learning').classList.contains('diagnosis-screen'));
click('close-learning');click('replay-first');assert.equal(vm.runInContext('current().diagnosisOutcome.stage',c),'summary');settleDiagnosisOutcome();assert(!node('#programs').innerHTML.includes('여기부터 시작해요'));assert.equal(vm.runInContext('current().presentationPending',c),true);assert.equal(vm.runInContext('state.ui.prescriptionSeen',c),true);click('replay-repeat');settleDiagnosisOutcome();click('program',0);click('program-begin');assert.equal(vm.runInContext('current().presentationPending',c),false);assert(!node('#programs').innerHTML.includes('여기부터 시작해요'));
console.log('UI state-flow, diagnosis result and clean learner-view checks passed (DOM substitute)');

// Preset loading uses the original app without replacing its click listeners.
vm.runInContext("window.__JEI_REVIEW__.scenario='4'",c);
vm.runInContext(fs.readFileSync('dist/preview-controls.js','utf8'),c);
assert.equal(vm.runInContext('current().programs[0].status',c),'active');
click('program',0);assert.equal(node('#learning').open,true);
click('close-learning');click('mypage');assert.equal(node('main').hidden,true);
console.log('Direct-view storage adapter and original prototype button interactions passed');

// Preserve the old explicit celebration flow in its immutable V6.3 snapshot.
{
const legacy=require('./helpers/ui-harness.cjs').harness(undefined,{appSource:fs.readFileSync('dist/versions/v68/app.js','utf8'),reducedMotion:false,mentorPolicy:false});
const c=legacy.context,node=legacy.node;
const click=(action,id=0)=>{
 const t=legacy.evaluate('recommendationTimer');if(action==='recommend'&&t&&!t.cancelled)t.fn();legacy.click(action,id);
 const closing=legacy.evaluate('guidanceClosingTimer');if(closing&&!closing.cancelled)closing.fn();
}
const prepareOverview=()=>{legacy.evaluate('cancelDiagnosisOutcome(true);editing=null;render()');}
const settleDiagnosisOutcome=()=>{click('diagnosis-outcome-confirm');for(let i=0;i<5&&legacy.evaluate('!!diagnosisOutcomeRun');i++)legacy.evaluate('diagnosisOutcomeTimer').fn();}

prepareOverview();
vm.runInContext('state=M.create();editing=null;render()',c);
click('diagnosis');click('diagnosis-begin');
for(const answer of [0,1,1]){click('diagnosis-answer',answer);click('diagnosis-next');}settleDiagnosisOutcome();
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
assert(node('#recommend-copy').textContent.includes('다음 단계 만나기'));
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
assert(node('#learning').innerHTML.includes('class="diagnosis-grade">E등급</span>'));
assert(!node('#learning').innerHTML.includes('E등급 /'));
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
assert(/class="groups-trigger"[^>]+aria-label="학습 주제 열기"[^>]*>\s*<img[^>]+rail-tab\.svg/.test(html));
console.log('V3.3 celebration, preparation, explicit start, grade accuracy, pause/persistence and progress preservation passed');

}

// The decorative morph follows real typing, and stale timers cannot restart it.
prepareOverview();
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
assert.equal(parseFloat(node('#mentor-bubble').style.width),shortWidth); // target width stays fixed while text reveals
assert(parseFloat(node('#mentor-bubble').style.width)<=404);
const message=node('#ai-message').textContent,oldRest=vm.runInContext('bubbleTimer',c);
c.document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(vm.runInContext('bubbleTimer',c),null);
c.document.visibilityState='visible';listeners.visibilitychange();
vm.runInContext('thinkTimer',c).fn();
for(let i=0;i<300&&vm.runInContext('aiState',c)==='반응 중';i++)vm.runInContext('animTimer',c).fn();
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
    assert.equal(node('#mentor-bubble').style.height,'48px');
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
assert.equal(node('.recommend')['data-recommend-state'],'loading');
assert.equal(node('#recommend').disabled,true);
assert.equal(node('#recommend-status').textContent,'추천 활동 준비 중');
const firstPreparation=vm.runInContext('recommendationTimer',c);
assert.equal(firstPreparation.ms,1400);
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
assert.equal(node('.recommend')['data-recommend-state'],'ready');
assert.equal(node('#recommend').disabled,false);
assert(node('#recommend-copy').textContent.includes('도와줘요'));
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

// V3.7: a non-modal outline stays beside the interactive main area.
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
assert(node('body').classList.contains('learning-navigation-open'));
assert(!node('body').classList.contains('panel-open'));
assert.equal(node('#overlay').hidden,true);
const groupBefore=vm.runInContext('current().groupId',c);
click('close-panel',0,true,false);
const interruptedExit=vm.runInContext('panelMotionTimer',c);
assert.equal(node('#group-panel')['data-panel-phase'],'closing');
assert.equal(node('#group-panel').hidden,false);
assert.equal(node('#group-panel').inert,true);
assert.equal(node('#group-panel')['aria-hidden'],'true');
assert.equal(node('#overlay').hidden,true);
assert.equal(node('.groups-trigger')['aria-expanded'],'false');
assert.equal(focusReturned,true);
vm.runInContext('render()',c);assert.equal(node('#group-panel').hidden,false);
click('groups');interruptedExit.fn();
assert.equal(node('#group-panel').hidden,false);
assert.equal(node('#group-panel')['data-panel-phase'],'open');
assert.equal(node('#overlay').hidden,true);
assert(node('body').classList.contains('learning-navigation-open'));
assert.equal(vm.runInContext('current().groupId',c),groupBefore);
// Selecting a started topic updates main content and keeps the outline open.
vm.runInContext("state.grades[state.grade][1].diagnosis='active';renderPanel()",c);
click('select-group',1);assert.equal(vm.runInContext('state.index',c),1);
assert.equal(vm.runInContext('panel',c),'groups');assert.equal(vm.runInContext('panelMotionTimer',c),null);
assert.equal(node('#group-panel')['data-panel-phase'],'open');
click('close-panel',0,true,false);vm.runInContext('panelMotionTimer',c).fn();
assert.equal(node('#group-panel').hidden,true);assert.equal(node('#overlay').hidden,true);
assert(!node('body').classList.contains('learning-navigation-open'));
// Escape uses the same exit. A modal test panel cancels its pending cleanup.
click('groups');listeners.keydown({key:'Escape'});
const escapeExit=vm.runInContext('panelMotionTimer',c);
assert.equal(node('#group-panel')['data-panel-phase'],'closing');
click('test');escapeExit.fn();
assert.equal(node('#test-panel').hidden,false);assert.equal(node('#group-panel').hidden,true);
assert.equal(node('#overlay').hidden,false);assert.equal(vm.runInContext('panel',c),'test');
assert(node('body').classList.contains('panel-open'));assert(!node('body').classList.contains('learning-navigation-open'));
click('close-panel');assert.equal(node('#test-panel').hidden,true);assert.equal(node('#overlay').hidden,true);
c.matchMedia=()=>({matches:true});click('groups');click('close-panel');
assert.equal(vm.runInContext('panelMotionTimer',c),null);assert.equal(vm.runInContext('groupRevealTimer',c),null);
assert.equal(node('#group-panel').hidden,true);assert.equal(node('#overlay').hidden,true);
assert(!node('body').classList.contains('learning-navigation-open'));
console.log('Non-modal outline open/exit, Escape, interrupted reopen, stable render, persistent topic selection and reduced-motion passed');


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

// Long guidance advances between complete readable clauses rather than scrolling sideways.
prepareOverview();c.mentorTestCopy='한 문제씩 천천히 풀면서 먼저 첫 번째 내용을 읽어보세요. 잠깐 뒤 다음 내용이 이어지니 차근차근 확인해 봐요.';
c.matchMedia=()=>({matches:false});c.document.visibilityState='visible';
const originalMentorRect=node('.ai-top').getBoundingClientRect,originalMentorMeasure=node('#mentor-measure').getBoundingClientRect;
node('.ai-top').getBoundingClientRect=()=>({width:616,height:48});
node('#mentor-measure').getBoundingClientRect=function(){return {width:this.textContent.length*10,height:22};};
vm.runInContext('animateMessage(true,mentorTestCopy)',c);finishSpeech();
assert.equal(vm.runInContext('mentorRun.pages.length',c),2);
assert.equal(node('#mentor-read-controls').hidden,true);
assert.equal(node('#ai-message').scrollLeft,0);
assert.equal(node('#ai-message').textContent,vm.runInContext('mentorRun.pages[0]',c));
const firstPage=node('#ai-message').textContent;
vm.runInContext('bubbleTimer',c).fn();assert.equal(node('.ai-top')['data-bubble-phase'],'paging');
assert.equal(node('#ai-message').textContent,firstPage);assert.equal(vm.runInContext('mentorReadTimer',c).ms,380);
vm.runInContext('mentorReadTimer',c).fn();finishSpeech();
assert.equal(node('#ai-message').textContent,vm.runInContext('mentorRun.pages[1]',c));
assert.equal(node('#ai-message').scrollLeft,0);assert.equal(vm.runInContext('mentorTargetText',c),c.mentorTestCopy);
vm.runInContext('bubbleTimer',c).fn();assert.equal(node('.ai-top')['data-bubble-phase'],'rest');
node('.ai-top').getBoundingClientRect=originalMentorRect;node('#mentor-measure').getBoundingClientRect=originalMentorMeasure;
console.log('Long mentor copy is shown as two complete clauses with a short quiet transition and no horizontal scrolling');


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

// V3.4.6: short mentor reminders rotate with the current learning context and leave state untouched.
prepareOverview();
c.matchMedia=()=>({matches:true});c.document.visibilityState='visible';
vm.runInContext("cancelComposition();state=M.create();editing=null;panel=null;activityKind=null;myOpen=false;skyBusy=false;mentorPointerPaused=false;mentorFocusPaused=false;recommendationPointerPaused=false;recommendationFocusPaused=false;$('#learning').close();$('#help').close();$('#activity').close();lastMessage='';render();setBubblePhase('rest')",c);
const learnerBeforeReminder=JSON.stringify(vm.runInContext('state',c));
const firstMentorReminder=vm.runInContext('mentorReminderTimer',c);
assert.equal(firstMentorReminder.ms,6500);
firstMentorReminder.fn();
const reminderOne=node('#ai-message').textContent;
assert(reminderOne.includes('실력알기'));
assert.equal(node('.ai-top')['data-bubble-phase'],'holding');
assert.equal(JSON.stringify(vm.runInContext('state',c)),learnerBeforeReminder); // no fake progress/variant changes
vm.runInContext('render()',c);assert.equal(node('#ai-message').textContent,reminderOne); // unrelated render cannot revert a reminder
vm.runInContext("setBubblePhase('rest')",c);vm.runInContext('mentorReminderTimer',c).fn();
const reminderTwo=node('#ai-message').textContent;assert.notEqual(reminderOne,reminderTwo);
vm.runInContext("setBubblePhase('rest')",c);
const heldDeadline=vm.runInContext('mentorReminderTimer',c);
vm.runInContext('render()',c);assert.equal(vm.runInContext('mentorReminderTimer',c),heldDeadline);
vm.runInContext("current().diagnosis='active';render();setBubblePhase('rest')",c);
heldDeadline.fn();assert.equal(node('.ai-top')['data-bubble-phase'],'rest'); // stale context cannot interrupt
vm.runInContext('mentorReminderTimer',c).fn();assert(node('#ai-message').textContent.includes('진행 중'));
vm.runInContext("setBubblePhase('rest')",c);
const pausedMentor=vm.runInContext('mentorReminderTimer',c);
node('#mentor-bubble').listeners.pointerenter({pointerType:'mouse'});
assert.equal(vm.runInContext('mentorReminderTimer',c),null);pausedMentor.fn();
assert.equal(node('.ai-top')['data-bubble-phase'],'rest');
node('#mentor-bubble').listeners.pointerleave();assert(vm.runInContext('mentorReminderTimer',c));
// Recommendation refresh stays noticeable and repeats without changing its action.
c.matchMedia=()=>({matches:false});
vm.runInContext("state=M.create();recommendationSignature='';render()",c);
assert.equal(vm.runInContext('recommendationTimer',c).ms,1400);
vm.runInContext('recommendationTimer',c).fn();
const repeatedAction=node('#recommend-copy').textContent;
const firstRecommendationReminder=vm.runInContext('recommendationReminderTimer',c);
assert.equal(firstRecommendationReminder.ms,24000);
vm.runInContext('render()',c);assert.equal(vm.runInContext('recommendationReminderTimer',c),firstRecommendationReminder);
firstRecommendationReminder.fn();
assert.equal(node('.recommend')['data-recommend-state'],'loading');
assert.equal(node('.recommend')['data-recommend-state'],'loading');
assert.equal(node('#recommend').disabled,true);
assert.equal(node('#recommend-copy').textContent,repeatedAction);
assert.equal(vm.runInContext('state.daily.target',c),null);
vm.runInContext('recommendationTimer',c).fn();
assert.equal(node('.recommend')['data-recommend-state'],'ready');
assert.equal(node('#recommend').disabled,false);
const secondRecommendationReminder=vm.runInContext('recommendationReminderTimer',c);
assert.notEqual(secondRecommendationReminder,firstRecommendationReminder);
firstRecommendationReminder.fn();assert.equal(node('.recommend')['data-recommend-state'],'ready');
secondRecommendationReminder.fn();assert.equal(node('.recommend')['data-recommend-state'],'loading');
vm.runInContext('recommendationTimer',c).fn();
// Protect an impending click or keyboard selection from a periodic loading replacement.
const beforeHoverReminder=vm.runInContext('recommendationReminderTimer',c);
node('.recommend').listeners.pointerenter();assert.equal(vm.runInContext('recommendationReminderTimer',c),null);
beforeHoverReminder.fn();assert.equal(node('#recommend').disabled,false);
node('.recommend').listeners.pointerleave();assert(vm.runInContext('recommendationReminderTimer',c));
node('.recommend').listeners.focusin();assert.equal(vm.runInContext('recommendationReminderTimer',c),null);
node('.recommend').listeners.focusout({relatedTarget:null});
const beforeActionChange=vm.runInContext('recommendationReminderTimer',c);
vm.runInContext('daily().unreadAnswers=1;render()',c);beforeActionChange.fn();
vm.runInContext('recommendationTimer',c).fn();assert(node('#recommend-copy').textContent.includes('도와줘요'));
// Both loops pause while a lesson is open or the tab is hidden, and resume afterward.
vm.runInContext("setBubblePhase('rest')",c);
const staleLessonMentor=vm.runInContext('mentorReminderTimer',c),staleLessonRecommendation=vm.runInContext('recommendationReminderTimer',c);
vm.runInContext("$('#learning').showModal();syncGuidanceReminders()",c);
assert.equal(vm.runInContext('mentorReminderTimer',c),null);
assert.equal(vm.runInContext('recommendationReminderTimer',c),null);
staleLessonMentor.fn();staleLessonRecommendation.fn();assert.equal(node('.recommend')['data-recommend-state'],'ready');
vm.runInContext("$('#learning').close();syncGuidanceReminders()",c);finishSpeech();vm.runInContext("setBubblePhase('rest')",c);
assert(vm.runInContext('mentorReminderTimer',c));assert(vm.runInContext('recommendationReminderTimer',c));
c.document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(vm.runInContext('mentorReminderTimer',c),null);
assert.equal(vm.runInContext('recommendationReminderTimer',c),null);
c.document.visibilityState='visible';listeners.visibilitychange();finishSpeech();vm.runInContext("setBubblePhase('rest')",c);
assert(vm.runInContext('mentorReminderTimer',c));assert(vm.runInContext('recommendationReminderTimer',c));
vm.runInContext("daily().unreadAnswers=0;daily().target=20;daily().started=true;current().diagnosis='done';current().programs=M.programs(1);current().programs[0].status='locked';render()",c);
vm.runInContext('recommendationTimer',c).fn();assert.equal(vm.runInContext('recommendationReminderTimer',c),null); // no reminder for an unavailable action
console.log('Contextual mentor rotation and recurring recommendation loading repeat, preserve state, protect interaction, cancel stale callbacks and pause off the overview');

// The prescribed diagnosis is a result entry beside the heading, separate from learning cards.
vm.runInContext('M.preset(state,3);render()',c);
assert.equal(node('#diagnostic').parent,node('#diagnostic-result-slot'));
assert.equal(node('#diagnostic-result-slot').hidden,false);
assert.equal(node('#diagnosis-section').hidden,true);
assert(node('#diagnostic').classList.contains('diagnostic-summary-trigger'));
assert(!node('#diagnostic').classList.contains('card'));
assert(!node('#programs').innerHTML.includes('grid-diagnostic'));
click('diagnosis');assert.equal(vm.runInContext('editing.kind',c),'diagnosis-result');
assert(node('#learning').innerHTML.includes('실력 확인 결과'));
click('close-learning');vm.runInContext('M.preset(state,0);render()',c);
assert.equal(node('#diagnostic-result-slot').hidden,true);
assert.equal(node('#diagnostic').parent,node('#diagnosis-welcome-action'));
assert.equal(node('#diagnosis-section').hidden,false);
assert(!node('#diagnostic').classList.contains('diagnostic-summary-trigger'));
vm.runInContext("beginComposition(2,'first')",c);
vm.runInContext('composeTimers.find(t=>t.ms===5200)',c).fn();
assert.equal(node('#composition')['data-compose-step'],'2');
assert(node('#composition').innerHTML.includes('prescription-ready'));
assert(node('#composition').innerHTML.includes('ready-stack'));
vm.runInContext('composeTimers.find(t=>t.ms===8000)',c).fn();
assert.equal(node('#diagnostic').parent,node('#diagnostic-result-slot'));
assert.equal(vm.runInContext('cardRevealTimer',c).ms,vm.runInContext('cardRevealRun.remaining',c));
console.log('Prepared-learning graphic, gentle card reveal lifetime, result navigation and diagnostic/result hierarchy passed');

// V3.4.7: the target width is established before a steady, grapheme-by-grapheme reveal.
prepareOverview();
c.matchMedia=()=>({matches:false});c.document.visibilityState='visible';
vm.runInContext("cancelComposition();panel=null;myOpen=false;activityKind=null;skyBusy=false;mentorPointerPaused=false;mentorFocusPaused=false;$('#learning').close();$('#activity').close();state=M.create();render()",c);
vm.runInContext("animateMessage(true,'가나다 👨‍👩‍👧‍👦 끝')",c);
vm.runInContext('thinkTimer',c).fn();
assert.equal(node('#ai-message').textContent,'');
assert.equal(vm.runInContext('animTimer',c).ms,300); // give the container time to expand first
const stableSpeechWidth=node('#mentor-bubble').style.width;
const familyCopy=['가','가나','가나다','가나다 ','가나다 👨‍👩‍👧‍👦','가나다 👨‍👩‍👧‍👦 '];
for(const visibleCopy of familyCopy){vm.runInContext('animTimer',c).fn();assert.equal(node('#ai-message').textContent,visibleCopy);assert.equal(node('#mentor-bubble').style.width,stableSpeechWidth);assert.equal(vm.runInContext('animTimer',c).ms,48);}
vm.runInContext('animTimer',c).fn();assert.equal(node('#ai-message').textContent,'가나다 👨‍👩‍👧‍👦 끝');
assert.equal(node('#ai-message')['aria-busy'],'false');
vm.runInContext("animateMessage(true,'이전 안내')",c);vm.runInContext('thinkTimer',c).fn();
const outdatedLetter=vm.runInContext('animTimer',c);
vm.runInContext("animateMessage(true,'새 안내')",c);outdatedLetter.fn();assert.equal(node('#ai-message').textContent,'');
// The shaped tab is also the close control and follows every drawer phase.
click('groups');
assert.equal(node('.groups-trigger')['aria-expanded'],'true');
assert.equal(node('.groups-trigger')['data-tab-phase'],'open');
assert.equal(node('.groups-trigger')['aria-label'],'학습 주제 닫기');
click('groups');
assert.equal(node('.groups-trigger')['data-tab-phase'],'closing');
assert.equal(node('.groups-trigger')['aria-expanded'],'false');
assert.equal(node('#group-panel').hidden,false);
assert.equal(vm.runInContext('panelMotionTimer',c).ms,500);
vm.runInContext('panelMotionTimer',c).fn();
assert.equal(node('#group-panel').hidden,true);
assert.equal(node('.groups-trigger')['data-tab-phase'],'closed');
assert.equal(node('.groups-trigger')['aria-label'],'학습 주제 열기');
const refinedHTML=fs.readFileSync('dist/working/index.html','utf8');
assert(refinedHTML.includes('활동을 고르고 있어요'));
assert(!refinedHTML.includes('학습을 고르고 있어요'));
assert(refinedHTML.includes('recommend-spinner'));
const headingMarkup=refinedHTML.match(/<section class="heading"[^>]*>(.*?)<\/section>/)[1];
assert(headingMarkup.includes('id="diagnostic-result-slot"'));
assert(!headingMarkup.includes('id="personalized-summary"')); // compact result control sits beside the topic title
console.log('Stable-width sequential speech, grapheme continuity, stale-letter cancellation and shaped-tab open/close passed');

// V3.4.8: meaningful view changes move gently; answer selection and repeated renders do not.
c.matchMedia=()=>({matches:false});
vm.runInContext("cancelComposition();state=M.create();panel=null;myOpen=false;activityKind=null;skyBusy=false;skyRun=null;editing=null;$('#learning').close();$('#activity').close();render()",c);
assert.equal(node('#group-title').textContent,'비교와 분류');
assert(node('#grade-badge').innerHTML.includes('<strong>D</strong>'));
vm.runInContext('M.preset(state,3);render()',c);
assert(node('#diagnostic').innerHTML.includes('<strong>실력알기 결과 확인</strong>'));
assert(!node('#diagnostic').innerHTML.includes('틀린 내용 확인'));
assert.equal(node('#diagnostic')['aria-label'],vm.runInContext('groupName(state.index)',c)+' · 실력알기 결과 확인');
vm.runInContext('state=M.create();render()',c);
const viewMotions=[];
node('#learning > .dialog-view').animate=(frames,timing)=>{
  const motion={frames,timing,cancelled:false,cancel(){this.cancelled=true;},finished:Promise.resolve()};viewMotions.push(motion);return motion;
};
click('diagnosis');
assert.equal(viewMotions.length,0); // a closed dialog uses its own surface entrance, without two stacked animations
click('diagnosis-begin');assert.equal(viewMotions.length,1);
click('diagnosis-answer',0);assert.equal(viewMotions.length,1);
assert(!node('#learning').innerHTML.includes('<small>선택한 답</small>'));
assert(node('#learning').innerHTML.includes('answer-selected'));
assert(node('#learning').innerHTML.includes('aria-label="동그라미 · 선택한 답"'));
assert.equal(viewMotions[0].cancelled,true); // a new render cancels the replaced content's motion
click('diagnosis-next');assert.equal(viewMotions.length,2);
vm.runInContext('refreshDialog()',c);assert.equal(viewMotions.length,2);
click('diagnosis-answer',1);click('diagnosis-next');assert.equal(viewMotions.length,3);
assert.equal(viewMotions[1].cancelled,true);
assert.equal(vm.runInContext('current().diagnosticSession.index',c),2);
assert.deepEqual(Array.from(vm.runInContext('current().diagnosticSession.answers',c)),[0,1]);
c.matchMedia=()=>({matches:true});
click('close-learning');assert.equal(viewMotions.length,3);
assert(node('#learning').innerHTML.includes('지금까지 푼 내용은 저장'));
click('diagnosis-stay');click('diagnosis-answer',1);click('diagnosis-next');settleDiagnosisOutcome();
assert.equal(viewMotions.length,3);
assert.equal(node('#learning').open,false);
assert.equal(vm.runInContext('state.grades[3][0].diagnosticResult.incorrect',c),0);
assert.equal(vm.runInContext('current().diagnosis',c),'idle');
c.matchMedia=()=>({matches:false});
const beforeNextPart=viewMotions.length;click('diagnosis');
assert.equal(viewMotions.length,beforeNextPart); // native modal entry stays mounted without a duplicate soft reveal
assert(node('#learning').innerHTML.includes('문항 1 / 3'));
click('close-learning');click('diagnosis-leave');
const pageMotions=[];
for(const selector of ['main','#mypage'])node(selector).animate=(frames,timing)=>{pageMotions.push({selector,frames,timing});return {finished:Promise.resolve(),cancel(){}};};
const pageState=vm.runInContext('JSON.stringify(state.grades)',c);
click('mypage');assert.equal(node('main').hidden,true);assert.equal(pageMotions.at(-1).selector,'#mypage');
click('back-main');assert.equal(node('main').hidden,false);assert.equal(pageMotions.at(-1).selector,'main');
assert.equal(vm.runInContext('JSON.stringify(state.grades)',c),pageState);
c.matchMedia=()=>({matches:true});const priorPageMotions=pageMotions.length;
click('mypage');click('back-main');assert.equal(pageMotions.length,priorPageMotions);
c.matchMedia=()=>({matches:false});
console.log('Grade/topic hierarchy, result wording, rapid question changes, stable answer selection, page navigation and reduced-motion state preservation passed');

// V3.4.10 keeps the AI label mounted through both recommendation phases.
vm.runInContext("cancelComposition();state=M.create();editing=null;panel=null;myOpen=false;activityKind=null;skyBusy=false;$('#learning').close();$('#activity').close();render()",c);
settleGuidance();
vm.runInContext('M.preset(state,3);render()',c);
assert(node('#programs').innerHTML.includes('시작 전'));
assert(!node('#programs').innerHTML.includes('class="badge locked"'));
const lockedCards=vm.runInContext('current().programs.filter(p=>!M.canStudy(current(),p)).length',c);
assert.equal((node('#programs').innerHTML.match(/class="card-lock"/g)||[]).length,lockedCards);
click('program',1);assert.equal(node('#learning').open,false);
const compactHTML=fs.readFileSync('dist/working/index.html','utf8');
const recommendMarkup=compactHTML.match(/<button id="recommend"[^>]*>(.*?)<\/button>/)[1];
assert(recommendMarkup.includes('class="recommend-label">AI 추천</span>'));
assert(recommendMarkup.includes('class="recommend-content"'));
assert(recommendMarkup.includes('class="recommend-loader"'));
assert(!compactHTML.includes('id="unit-progress"'));
vm.runInContext('daily().target=20;daily().started=true;render()',c);
assert.equal(node('#recommend-copy').textContent,'오늘의 학습 문제 풀기');
assert.equal(node('#recommend')['aria-label'],'AI 추천 · 오늘의 학습 문제 풀기');
vm.runInContext('recommendationTimer',c).fn();click('recommend',0,false);
assert.equal(node('#learning').open,true);assert.equal(vm.runInContext('editing.kind',c),'program');
click('close-learning');
console.log('Locked-icon gating, fixed recommendation label structure, retained actions and removed overview progress passed');

require('node:test')('star transition expands and contracts at the button instead of travelling through the viewport center',async()=>{
  c.matchMedia=()=>({matches:false});
  vm.runInContext("cancelComposition();state=M.create();panel=null;myOpen=false;activityKind=null;skyBusy=false;skyRun=null;skyReturnToLearning=false;$('#learning').close();$('#help').close();$('#activity').close();render()",c);
  const transitionFrames=[],dialogFrames=[];
  node('.constellation-trigger').getBoundingClientRect=()=>({left:780,top:40,width:120,height:44});
  node('#sky-transition').animate=(frames,timing)=>{transitionFrames.push({frames,timing});return {finished:Promise.resolve()};};
  node('#activity').animate=(frames,timing)=>{dialogFrames.push({frames,timing});return {finished:Promise.resolve()};};
  await vm.runInContext('skyEnter()',c);
  assert.equal(node('#sky-transition').style.left,'840px');
  assert.equal(node('#sky-transition').style.top,'62px');
  assert.equal(dialogFrames[0].frames[0].clipPath,'circle(28px at 840px 62px)');
  const endRadius=Number(dialogFrames[0].frames[1].clipPath.match(/circle\((\d+)px/)[1]);
  const furthestCorner=Math.hypot(840,738);
  assert(endRadius>furthestCorner&&endRadius<=furthestCorner+25); // only enough radius to cover this viewport
  assert(dialogFrames[0].frames[1].clipPath.endsWith('at 840px 62px)'));
  assert.equal(dialogFrames[0].frames[0].opacity,.2);
  assert.equal(dialogFrames[0].frames[1].opacity,1);
  assert(dialogFrames[0].timing.duration>=750&&dialogFrames[0].timing.duration<=1000);
  assert(transitionFrames[0].frames.every(f=>!/translate\([^)]*px/.test(f.transform)));
  assert.equal(vm.runInContext('skyBusy',c),false);
  assert.equal(node('#activity').open,true);
  assert.equal(node('#sky-transition').hidden,true);
  // Exit aims at the button's current position, including after a resize.
  node('.constellation-trigger').getBoundingClientRect=()=>({left:650,top:32,width:100,height:40});
  await vm.runInContext('skyExit()',c);
  assert.equal(dialogFrames[1].frames[1].clipPath,'circle(28px at 700px 52px)');
  assert.equal(dialogFrames[1].frames[1].opacity,.2);
  assert(dialogFrames[1].timing.duration>=550&&dialogFrames[1].timing.duration<=800);
  assert.equal(node('#sky-transition').style.left,'700px');
  assert.equal(node('#sky-transition').style.top,'52px');
  assert(transitionFrames[1].frames.every(f=>!/translate\([^)]*px/.test(f.transform)));
  assert.equal(node('#activity').open,false);
  assert.equal(vm.runInContext('activityKind',c),null);
  assert.equal(node('#sky-transition').hidden,true);
});

require('node:test')('reduced-motion star navigation stays immediate and restores the learning timer without animation',async()=>{
  c.matchMedia=()=>({matches:true});
  vm.runInContext("cancelComposition();state=M.create();panel=null;myOpen=false;activityKind=null;skyBusy=false;skyRun=null;skyReturnToLearning=false;$('#learning').close();$('#activity').close();daily().timerRunning=true;render()",c);
  let animations=0;
  for(const selector of ['#sky-transition','#activity'])node(selector).animate=()=>{animations++;return {finished:Promise.resolve()};};
  const selected=vm.runInContext('current().groupId',c);
  await vm.runInContext('skyEnter()',c);
  assert.equal(node('#activity').open,true);assert.equal(vm.runInContext('daily().timerRunning',c),false);
  await vm.runInContext('skyExit()',c);
  assert.equal(animations,0);assert.equal(node('#activity').open,false);
  assert.equal(vm.runInContext('daily().timerRunning',c),true);
  assert.equal(vm.runInContext('current().groupId',c),selected);
  assert.equal(vm.runInContext('skyBusy',c),false);assert.equal(node('#sky-transition').hidden,true);
});
