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
assert(!node('#ai-message').textContent);assert.equal(node('#ai-message')['aria-busy'],'true');
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

// Clean-pass handoff: actual diagnosis answers, preserved results, and cancellable navigation.
function position(){return vm.runInContext('state.grade+":"+state.index',c);}
function completeClean(g,i){
  vm.runInContext(`cancelCleanMove();state=M.create();state.ui={diagnosisIntroSeen:true};select(${g},${i});`,c);
  click('diagnosis');for(const answer of [0,1,1]){click('diagnosis-answer',answer);click('diagnosis-next');}
  assert(node('#learning').innerHTML.includes('훌륭해요!'));
}
function flushMoves(ms=760){for(const t of [...timers])if(t.ms===ms&&!t.cancelled&&!t.fired){t.fired=true;t.fn();}}
completeClean(3,0);
assert.equal(position(),'3:0','celebration must not navigate before the learner continues');
assert(node('#learning').innerHTML.includes('다음 실력알기로 넘어가기'));
assert(!node('#learning').innerHTML.includes('E등급으로 넘어가기'));
click('clean-result');assert(node('#learning').innerHTML.includes('실력 확인 결과'));assert.equal(position(),'3:0');
click('clean-summary');assert(node('#learning').innerHTML.includes('훌륭해요!'));
const resultBefore=vm.runInContext('JSON.stringify(current().diagnosticResult)',c);
click('clean-continue');click('clean-continue');
assert.equal(timers.filter(t=>t.ms===760&&!t.cancelled&&!t.fired).length,1,'double clicks must schedule only one move');
assert.throws(()=>c.__JEI_REVIEW_BRIDGE__.capture(),/화면 전환이 끝난 뒤/);
assert.equal(position(),'3:0','the displayed origin stays selected during the handoff');
flushMoves();assert.equal(position(),'3:1');assert.equal(node('#learning').open,false);
assert.equal(vm.runInContext('JSON.stringify(state.grades[3][0].diagnosticResult)',c),resultBefore);
assert.equal(vm.runInContext('state.grades[3][0].diagnosis',c),'done');
assert.equal(vm.runInContext('current().diagnosis',c),'idle','arrival must not start the next diagnosis automatically');
assert.equal(vm.runInContext('state.daily.timerRunning',c),false);
assert.equal(node('#learning-arrival').hidden,false);assert(node('#learning-arrival').innerHTML.includes('다음 실력알기로 넘어왔어요'));
assert.equal(c.__JEI_REVIEW_BRIDGE__.capture().appState.ui.cleanArrival.toIndex,1);
click('diagnosis');assert.equal(node('#learning-arrival').hidden,true);click('close-learning');click('diagnosis-leave');

const lastD=vm.runInContext('state.grades[3].length-1',c);
completeClean(3,lastD);assert(node('#learning').innerHTML.includes('E등급으로 넘어가기'));
// Advancing must never reset existing progress at the destination.
vm.runInContext('state.grades[4][0].diagnosis="done";state.grades[4][0].programs=M.programs(1,4,0);state.grades[4][0].programs[0].status="active";M.setProgress(state.grades[4][0].programs[0],40)',c);
const destinationBefore=vm.runInContext('JSON.stringify(state.grades[4][0])',c);
click('clean-continue');flushMoves();assert.equal(position(),'4:0');
assert.equal(vm.runInContext('JSON.stringify(current())',c),destinationBefore);
assert(node('#learning-arrival').innerHTML.includes('E등급으로 넘어왔어요'));
click('clean-dismiss');assert.equal(node('#learning-arrival').hidden,true);

completeClean(3,lastD);click('clean-continue');click('close-learning');flushMoves();assert.equal(position(),'3:'+lastD);assert.equal(node('#learning').open,false);
assert.equal(vm.runInContext('current().diagnosis',c),'done','leaving preserves the completed result');
completeClean(3,lastD);click('clean-continue');vm.runInContext('select(2,0)',c);flushMoves();assert.equal(position(),'2:0','a cancelled timer cannot later override a different selection');
const lastJ=vm.runInContext('state.grades[9].length-1',c);completeClean(9,lastJ);
assert(!node('#learning').innerHTML.includes('data-action="clean-continue"'));click('clean-continue');flushMoves();assert.equal(position(),'9:'+lastJ);click('diagnosis-leave');
c.matchMedia=()=>({matches:true});completeClean(3,lastD);click('clean-continue');flushMoves(0);assert.equal(position(),'4:0','reduced motion retains navigation without an animation delay');
c.matchMedia=()=>({matches:false});
console.log('Clean-pass next-group/grade handoff, result retention, cancellation, final grade and reduced motion passed');
