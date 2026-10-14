// UI state-flow smoke checks with a minimal DOM substitute; not browser layout QA.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map(),timers=[],listeners={};
function node(key){if(nodes.has(key))return nodes.get(key);const classes=new Set();const n={style:{},hidden:false,disabled:false,innerHTML:'',textContent:'',value:8,offsetWidth:1,children:[],classList:{add(...a){a.forEach(x=>classes.add(x));},remove(...a){a.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);}},setAttribute(k,v){this[k]=v;},getBoundingClientRect(){return {left:0,top:0,width:240,height:240};},append(x){if(x.parent)x.parent.children=x.parent.children.filter(y=>y!==x);this.children.push(x);x.parent=this;},prepend(x){if(x.parent)x.parent.children=x.parent.children.filter(y=>y!==x);this.children.unshift(x);x.parent=this;},animate(){},focus(){},close(){this.open=false;},showModal(){this.open=true;},addEventListener(){},querySelectorAll(){return [];}};nodes.set(key,n);return n;}
const c=vm.createContext({console,SkyModel:require('../dist/working/sky.js').SkyModel,window:{innerWidth:1200,innerHeight:800,scrollY:0,scrollTo(){}},MathModel:require('../dist/working/model.js').MathModel,document:{querySelector:node,addEventListener(k,f){listeners[k]=f;},body:node('body')},localStorage:{getItem(){return null;},setItem(){}},matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},setInterval:()=>0,clearInterval(){}});
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
vm.runInContext('beginComposition(52);select(3,1)',c);for(const t of [...timers]){if(!t.cancelled&&(t.ms===3400||t.ms===1800))t.fn();}assert.equal(vm.runInContext('current().programs.length',c),0);
for(const i of [0,1,2]){vm.runInContext(`M.preset(state,${i});render()`,c);assert.equal(node('#programs').hidden,true);assert.equal(node('#programs').innerHTML,'');assert(!node('#diagnostic').innerHTML.includes('진단 열기'));}
const html=fs.readFileSync('dist/working/index.html','utf8');for(const text of ['<footer>','선택한 그룹의 진단','id="program-heading"'])assert(!html.includes(text));
// Accessible section names may describe AI guidance; duplicate visible headings stay absent.
assert(!/<h[1-6]\b[^>]*>\s*학습 안내\s*<\/h[1-6]>/u.test(html));
assert(node('#ai-message').textContent.includes('진단을 통과했어요'));assert.equal(node('#ai-message')['aria-busy'],'false');
vm.runInContext('M.preset(state,0);render()',c);assert(!node('#ai-message').textContent);assert.equal(node('#ai-message')['aria-busy'],'true');
vm.runInContext('M.preset(state,3);render()',c);assert(!node('#programs').innerHTML.includes('<progress'));assert(node('#programs').innerHTML.includes('is-locked'));assert(!node('#programs').innerHTML.includes('프로그램 01'));vm.runInContext('M.preset(state,4);render()',c);assert.equal((node('#programs').innerHTML.match(/<progress/g)||[]).length,1);assert.equal((node('#programs').innerHTML.match(/is-current/g)||[]).length,1);vm.runInContext('current().programs[0].progress=100;render()',c);assert(!node('#programs').innerHTML.includes('<progress'));assert(node('#programs').innerHTML.includes('풀이 완료'));vm.runInContext('M.preset(state,6);render()',c);assert(!node('#programs').innerHTML.includes('<progress'));
vm.runInContext('state=M.create();render()',c);assert(node('#group-title').textContent.includes('비교와 분류'));assert(!node('#group-title').textContent.includes('D01'));vm.runInContext('openPanel("groups")',c);assert(node('#group-panel').innerHTML.includes('모으기와 가르기(10)'));vm.runInContext('select(0,0)',c);assert(node('#group-title').textContent.includes('모양'));
function click(action,id=0){listeners.click({target:{closest:()=>({dataset:{action,id:String(id)},disabled:false})}});}
click('recommend');assert.equal(node('#activity').open,true);assert(node('#activity').innerHTML.includes('목표 학습 시간'));node('#goal-minutes').value=20;click('save-goal');assert.equal(vm.runInContext('state.daily.target',c),20);assert(node('#recommend').textContent.includes('오늘의 학습'));
click('diagnosis');click('diag-start');assert.equal(vm.runInContext('state.daily.started',c),true);click('diag-prescribe');for(const t of [...timers])if(!t.cancelled&&(t.ms===3400||t.ms===1800))t.fn();click('program',0);click('program-start');click('program-frame');assert.equal(vm.runInContext('current().programs[0].completedFrames',c),1);for(let i=0;i<5;i++)click('program-retry');assert(vm.runInContext('M.message(state)',c).includes('차분하게'));click('program-frame');assert(!vm.runInContext('M.message(state)',c).includes('차분하게'));
node('#sky-transition').animate=undefined;node('#activity').animate=undefined;click('constellation');assert(node('#activity').innerHTML.includes('별자리'));click('close-activity');vm.runInContext('state.daily.unreadAnswers=1;render()',c);click('recommend');assert(node('#activity').innerHTML.includes('도와줘요'));click('answer-read');assert.equal(vm.runInContext('state.daily.unreadAnswers',c),0);
click('mypage');assert.equal(node('main').hidden,true);assert(node('#mypage').innerHTML.includes('학습 캘린더'));assert(node('#mypage').innerHTML.includes('오답노트'));const prior=vm.runInContext('current().groupId',c);click('back-main');assert.equal(node('main').hidden,false);assert.equal(vm.runInContext('current().groupId',c),prior);
click('sky-case',3);assert(node('#activity').innerHTML.includes('건너뛰기'));click('sky-skip');assert.equal(vm.runInContext('state.sky.items[0].stars',c),3);assert.equal(vm.runInContext('state.sky.pending',c),null);click('sky-detail',0);assert(node('#activity').innerHTML.includes('보상 확인'));for(const t of [...timers])if(!t.cancelled&&t.ms===700)t.fn();assert(node('#activity').innerHTML.includes('번째 별'));click('sky-detail-back');click('close-activity');
click('sky-case',10);click('sky-detail',0);for(const t of [...timers])if(!t.cancelled&&t.ms===1000)t.fn();assert(node('#activity').innerHTML.includes('이야기'));assert.equal(vm.runInContext('state.sky.items[0].viewed',c),true);click('sky-detail-back');click('sky-search');assert(node('#activity').innerHTML.includes('이름을 알려주세요'));click('close-activity');
vm.runInContext('state=M.create();editing=null;render()',c);click('diagnosis');assert.equal(vm.runInContext('current().diagnosis',c),'idle');assert(node('#learning').classList.contains('diagnosis-screen'));assert(node('#learning').innerHTML.includes('어디를 더 공부하면'));click('diagnosis-begin');assert.equal(vm.runInContext('current().diagnosis',c),'active');assert(!node('#learning').innerHTML.includes('테스트 전용'));assert(!node('#learning').innerHTML.includes('data-action="diag-start"'));
click('diagnosis-answer',0);click('diagnosis-next');click('close-learning');assert(node('#learning').innerHTML.includes('지금까지 푼 내용은 저장'));click('diagnosis-stay');assert(node('#learning').innerHTML.includes('문항 2 / 3'));click('close-learning');click('diagnosis-leave');assert.equal(node('#learning').open,false);assert.equal(vm.runInContext('state.daily.timerRunning',c),false);click('diagnosis');assert(node('#learning').innerHTML.includes('문항 2 / 3'));assert(!node('#learning').innerHTML.includes('diagnosis-begin'));click('diagnosis-answer',0);click('diagnosis-next');click('diagnosis-answer',0);click('diagnosis-next');assert.equal(node('#prescription').open,true);assert(node('#composition').innerHTML.includes('수고했어요'));for(const t of [...timers])if(!t.cancelled&&t.ms===600)t.fn();assert(node('#composition').innerHTML.includes('더 익힐 내용을'));for(const t of [...timers])if(!t.cancelled&&(t.ms===3400||t.ms===1800))t.fn();assert.equal(node('#prescription').open,false);assert.equal(vm.runInContext('current().diagnosticResult.incorrect',c),2);click('diagnosis');assert(node('#learning').innerHTML.includes('실력 확인 결과'));assert(!node('#learning').classList.contains('diagnosis-screen'));assert(node('#learning').innerHTML.includes('결손 학습 목표'));assert(!node('#learning').innerHTML.includes('data-action="diag-prescribe"'));click('close-learning');click('program',0);assert.equal(vm.runInContext('current().programs[0].status',c),'active');assert(!node('#learning').innerHTML.includes('data-action="program-start"'));assert(node('#learning').innerHTML.includes('data-action="learner-next"'));click('learner-answer',0);click('learner-next');assert.equal(vm.runInContext('current().programs[0].completedFrames',c),1);
vm.runInContext('state.ui.testControls=true;refreshDialog()',c);assert(node('#learning').innerHTML.includes('테스트 전용'));assert(node('#learning').innerHTML.includes('data-action="program-pass"'));
vm.runInContext('select(3,1);current().diagnosis="idle";current().programs=[];render()',c);click('diagnosis');assert(!node('#learning').innerHTML.includes('diagnosis-begin'));for(const answer of [0,1,1]){click('diagnosis-answer',answer);click('diagnosis-next');}assert(node('#learning').innerHTML.includes('훌륭해요'));assert(node('#learning').classList.contains('diagnosis-screen'));click('diagnosis-leave');click('diagnosis');assert(node('#learning').innerHTML.includes('실력 확인 결과'));assert(!node('#learning').classList.contains('diagnosis-screen'));
click('close-learning');click('replay-first');assert.equal(vm.runInContext('composing.total',c),3400);assert.equal(vm.runInContext('current().presentationPending',c),undefined);for(const t of [...timers])if(!t.cancelled&&t.ms===1500)t.fn();assert(node('#composition').innerHTML.includes('님을 위한 학습'));for(const t of [...timers])if(!t.cancelled&&t.ms===3400)t.fn();assert(node('#programs').innerHTML.includes('여기부터 시작해요'));assert.equal(vm.runInContext('state.ui.prescriptionSeen',c),true);click('replay-repeat');assert.equal(vm.runInContext('composing.total',c),1800);for(const t of [...timers])if(!t.cancelled&&t.ms===1800)t.fn();click('program',0);assert.equal(vm.runInContext('current().presentationPending',c),false);assert(!node('#programs').innerHTML.includes('여기부터 시작해요'));
console.log('UI state-flow, diagnosis result and clean learner-view checks passed (DOM substitute)');

// Preset loading uses the original app without replacing its click listeners.
vm.runInContext("window.__JEI_REVIEW__.scenario='4'",c);
vm.runInContext(fs.readFileSync('dist/preview-controls.js','utf8'),c);
assert.equal(vm.runInContext('current().programs[0].status',c),'active');
click('program',0);assert.equal(node('#learning').open,true);
click('close-learning');click('mypage');assert.equal(node('main').hidden,true);
console.log('Direct-view storage adapter and original prototype button interactions passed');

// V3.2: explicit pass acknowledgement, truthful grade completion and direct continuation.
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
assert(node('#recommend').textContent.includes('다음 실력알기 시작'));
// A persisted clean record has the same clear status after re-rendering.
vm.runInContext('state=JSON.parse(JSON.stringify(state));render()',c);
assert(node('#diagnostic').classList.contains('clean-passed'));
click('recommend');assert.equal(vm.runInContext('state.index',c),1);
assert.equal(vm.runInContext('current().diagnosis',c),'active');
assert.equal(node('#learning').open,true);
assert(node('#learning').innerHTML.includes('문항 1 / 3'));
assert.equal(vm.runInContext('state.grades[3][0].diagnosticResult.incorrect',c),0);
click('pass-next');assert.equal(vm.runInContext('state.index',c),1); // stale/double click
click('diagnosis-answer',0);click('diagnosis-next');
vm.runInContext('select(3,0)',c);click('pass-next');
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
assert(node('#learning').innerHTML.includes('E등급 시작하기'));
click('pass-next');assert.equal(vm.runInContext('state.grade',c),4);
assert(node('#learning').innerHTML.includes('E등급 /'));
// Existing prescribed learning resumes instead of being reset or skipped.
vm.runInContext('state=M.create();state.ui={diagnosisIntroSeen:true};current().diagnosis="done";state.grades[3][1].diagnosis="done";state.grades[3][1].programs=M.programs(1,3,1);state.grades[3][1].programs[0].status="active";M.setProgress(state.grades[3][1].programs[0],40);render()',c);
const progressBefore=vm.runInContext('state.grades[3][1].programs[0].progress',c);
click('pass-next');assert.equal(vm.runInContext('editing.kind',c),'program');
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
console.log('V3.2 pass acknowledgement, next diagnosis, grade accuracy, persistence and progress preservation passed');

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

