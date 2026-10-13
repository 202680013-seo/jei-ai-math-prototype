// UI state-flow smoke checks with a minimal DOM substitute; not browser layout QA.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map(),timers=[],listeners={};
function node(key){if(nodes.has(key))return nodes.get(key);const classes=new Set();const n={style:{},hidden:false,disabled:false,innerHTML:'',textContent:'',value:8,offsetWidth:1,children:[],classList:{add(...a){a.forEach(x=>classes.add(x));},remove(...a){a.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);}},setAttribute(k,v){this[k]=v;},getBoundingClientRect(){return {left:0,top:0,width:240,height:240};},append(x){if(x.parent)x.parent.children=x.parent.children.filter(y=>y!==x);this.children.push(x);x.parent=this;},prepend(x){if(x.parent)x.parent.children=x.parent.children.filter(y=>y!==x);this.children.unshift(x);x.parent=this;},animate(){},focus(){},close(){this.open=false;},showModal(){this.open=true;},addEventListener(){},querySelectorAll(){return [];}};nodes.set(key,n);return n;}
const c=vm.createContext({console,SkyModel:require('../dist/versions/v8/sky.js').SkyModel,window:{innerWidth:1200,innerHeight:800,scrollY:0,scrollTo(){}},MathModel:require('../dist/versions/v8/model.js').MathModel,document:{querySelector:node,addEventListener(k,f){listeners[k]=f;},body:node('body')},localStorage:{getItem(){return null;},setItem(){}},matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},setInterval:()=>0,clearInterval(){}});
// Real-document adapter runs before the application's original event handlers.
c.innerWidth=1200;c.innerHeight=800;c.scrollY=0;c.scrollTo=()=>{};c.window=c;
c.document.currentScript={dataset:{version:'working'}};c.location={search:'',origin:'https://review.example'};c.URLSearchParams=URLSearchParams;
vm.runInContext(fs.readFileSync('dist/preview-runtime.js','utf8'),c);
vm.runInContext(fs.readFileSync('dist/versions/v8/app.js','utf8'),c);
vm.runInContext(fs.readFileSync('dist/preview-controls.js','utf8'),c);
const html=fs.readFileSync('dist/versions/v8/index.html','utf8');
function click(action,id=0){listeners.click({target:{closest:()=>({dataset:{action,id:String(id)},disabled:false})}});}
// Automatic clean-pass handoff: preserve results, allow pauses, never advance unseen.
function position(){return vm.runInContext('state.grade+":"+state.index',c);}
function completeClean(g,i){
  c.document.visibilityState='visible';
  vm.runInContext(`cancelCleanMove();state=M.create();state.ui={diagnosisIntroSeen:true};select(${g},${i});`,c);
  click('diagnosis');for(const answer of [0,1,1]){click('diagnosis-answer',answer);click('diagnosis-next');}
  assert(node('#learning').innerHTML.includes('훌륭해요!'));
}
function advanceStage(){const t=vm.runInContext('cleanMove?.timer',c);assert(t&&!t.cancelled);t.fired=true;t.fn();}
completeClean(3,0);
assert.equal(position(),'3:0');assert.equal(vm.runInContext('cleanMove.timer.ms',c),2100);
assert(!node('#learning').innerHTML.includes('clean-route'));assert(!node('#learning').innerHTML.includes('결과 살펴보기'));
assert(!node('#learning').innerHTML.includes('다음 실력알기로 가요'),'messages must appear one at a time');
const resultBefore=vm.runInContext('JSON.stringify(current().diagnosticResult)',c);
assert.throws(()=>c.__JEI_REVIEW_BRIDGE__.capture(),/화면 전환이 끝난 뒤/);
const firstTimer=vm.runInContext('cleanMove.timer',c);
click('clean-toggle');assert.equal(firstTimer.cancelled,true);assert(node('#learning').innerHTML.includes('계속하기'));
firstTimer.fn();assert.equal(position(),'3:0');assert.equal(vm.runInContext('cleanMove.phase',c),'celebrate');
assert.equal(c.__JEI_REVIEW_BRIDGE__.capture().appState.grades[3][0].diagnosis,'done','a paused result may be saved');
click('clean-toggle');advanceStage();assert.equal(position(),'3:0');assert.equal(vm.runInContext('cleanMove.timer.ms',c),1600);
assert(node('#learning').innerHTML.includes('다음 실력알기로 가요'));assert(!node('#learning').innerHTML.includes('훌륭해요!'));
const secondTimer=vm.runInContext('cleanMove.timer',c);advanceStage();secondTimer.fn();assert.equal(position(),'3:1','repeated timer callbacks cannot skip a group');
assert.equal(node('#learning').open,false);assert.equal(vm.runInContext('JSON.stringify(state.grades[3][0].diagnosticResult)',c),resultBefore);
assert.equal(vm.runInContext('current().diagnosis',c),'idle');assert.equal(vm.runInContext('state.daily.timerRunning',c),false);
assert(node('#learning-arrival').textContent.includes('다음 실력알기로 넘어왔어요'));
assert(/id="learning-arrival" class="sr-only"/.test(html),'arrival is announced without a visible information panel');
click('diagnosis');assert.equal(node('#learning-arrival').hidden,true);click('close-learning');click('diagnosis-leave');

const lastD=vm.runInContext('state.grades[3].length-1',c);completeClean(3,lastD);advanceStage();
assert(node('#learning').innerHTML.includes('E등급으로 가요'));
vm.runInContext('state.grades[4][0].diagnosis="done";state.grades[4][0].programs=M.programs(1,4,0);state.grades[4][0].programs[0].status="active";M.setProgress(state.grades[4][0].programs[0],40)',c);
const destinationBefore=vm.runInContext('JSON.stringify(state.grades[4][0])',c);advanceStage();assert.equal(position(),'4:0');
assert.equal(vm.runInContext('JSON.stringify(current())',c),destinationBefore);
assert(node('#learning-arrival').textContent.includes('E등급으로 넘어왔어요'));

completeClean(3,lastD);const leavingTimer=vm.runInContext('cleanMove.timer',c);click('diagnosis-leave');leavingTimer.fn();assert.equal(position(),'3:'+lastD);
assert.equal(vm.runInContext('current().diagnosis',c),'done');
click('diagnosis');assert(node('#learning').innerHTML.includes('실력 확인 결과'));click('clean-summary');assert(node('#learning').innerHTML.includes('훌륭해요!'));
advanceStage();const staleTimer=vm.runInContext('cleanMove.timer',c);vm.runInContext('select(2,0)',c);staleTimer.fn();assert.equal(position(),'2:0');

completeClean(3,lastD);advanceStage();const backgroundTimer=vm.runInContext('cleanMove.timer',c);
c.document.visibilityState='hidden';listeners.visibilitychange();assert.equal(vm.runInContext('cleanMove.paused',c),true);backgroundTimer.fn();assert.equal(position(),'3:'+lastD);
c.document.visibilityState='visible';listeners.visibilitychange();assert.equal(vm.runInContext('cleanMove.paused',c),true,'returning to the tab waits for the learner');
click('clean-toggle');advanceStage();assert.equal(position(),'4:0');
const lastJ=vm.runInContext('state.grades[9].length-1',c);completeClean(9,lastJ);assert.equal(vm.runInContext('cleanMove',c),null);
assert(!node('#learning').innerHTML.includes('data-action="clean-toggle"'));assert(node('#learning').innerHTML.includes('학습 목록으로'));click('diagnosis-leave');
c.matchMedia=()=>({matches:true});completeClean(3,lastD);assert.equal(vm.runInContext('cleanMove.timer.ms',c),2100,'reduced motion still allows time to read');advanceStage();advanceStage();assert.equal(position(),'4:0');c.matchMedia=()=>({matches:false});
console.log('Automatic clean-pass stages, pause/resume, hidden-tab handling, cancellation, result retention and final grade passed');
