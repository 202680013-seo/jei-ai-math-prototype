const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness:baseHarness}=require('./helpers/ui-harness.cjs');
const harness=(saved,options={})=>baseHarness(saved,{...options,appSource:fs.readFileSync('dist/versions/v64/app.js','utf8')});
const {MathModel:M}=require('../dist/working/model.js');
const run=h=>h.evaluate('welcomeGuideRun');
const index=h=>Number(h.node('#diagnosis-welcome-guide').getAttribute('data-guide-index'));
function advance(h){const r=run(h);assert(r?.timer);r.timer.fn();assert(r.fadeTimer);r.fadeTimer.fn();return r;}
function releaseDim(h){const t=h.evaluate('guidanceClosingTimer');if(t&&!t.cancelled)t.fn();}
function activeState(answers=[0],i=1){const state=M.create();state.grades[3][0].diagnosis='active';state.grades[3][0].diagnosticSession={answers,index:i,started:Date.now(),notes:'saved'};state.ui={diagnosisWelcomeSeen:true,diagnosisIntroSeen:true};return state;}

test('V6.2 has no carousel controls and keeps the first-visit guidance cycling without moving the real action',()=>{
  const h=harness(undefined,{reducedMotion:false}),before=h.data('current()'),button=h.node('#diagnostic').innerHTML,parent=h.node('#diagnostic').parent;
  const markup=h.node('#diagnosis-welcome-guide').innerHTML;
  assert(!markup.includes('<button'));assert(!markup.includes('welcome-guide-controls'));
  assert.equal(index(h),0);assert.equal(run(h).timer.ms,4800);
  for(const next of [1,2,0,1,2]){advance(h);assert.equal(index(h),next);assert.equal(run(h).timer.ms,4800);}
  assert.equal(h.node('#welcome-guide-slide-0').hidden,true);assert.equal(h.node('#welcome-guide-slide-1').hidden,true);assert.equal(h.node('#welcome-guide-slide-2').hidden,false);
  const timer=run(h).timer;h.evaluate('render();render();syncGuidanceReminders()');assert.equal(index(h),2);assert.equal(run(h).timer,timer);
  assert.equal(h.node('#diagnostic').innerHTML,button);assert.equal(h.node('#diagnostic').parent,parent);assert.deepEqual(h.data('current()'),before);
  assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('daily().timerRunning'),false);
});

test('V6.2 pauses the short explanation on hover, keyboard focus and hidden or dimmed pages, and ignores stale work',()=>{
  const h=harness(undefined,{reducedMotion:false});const r=run(h),first=r.timer;
  h.node('#diagnosis-welcome-guide').emit('pointerenter',{pointerType:'mouse'});assert.equal(r.timer,null);assert.equal(first.cancelled,true);
  h.node('#diagnosis-welcome-guide').emit('pointerleave');first.fn();assert.equal(index(h),0);assert.equal(r.phase,'reading');
  r.timer.fn();const fade=r.fadeTimer;
  h.document.visibilityState='hidden';h.emitDocument('visibilitychange');assert.equal(fade.cancelled,true);assert.equal(r.timer,null);
  h.document.visibilityState='visible';h.emitDocument('visibilitychange');fade.fn();assert.equal(index(h),0);assert.equal(r.timer.ms,4800);
  h.node('#diagnosis-welcome').emit('focusin');assert.equal(r.timer,null);h.node('#diagnosis-welcome').emit('focusout',{});assert.equal(r.timer.ms,4800);
  h.click('test');assert.equal(r.timer,null);h.click('close-panel');releaseDim(h);assert.equal(run(h),r);assert.equal(r.timer.ms,4800);
  h.emitWindow('pagehide');assert.equal(r.timer,null);assert.equal(h.node('#diagnosis-welcome').getAttribute('data-welcome-motion'),'paused');
  h.emitWindow('pageshow');assert.equal(r.timer.ms,4800);assert.equal(h.node('#diagnosis-welcome').getAttribute('data-welcome-motion'),'running');
});

test('V6.2 preserves one-time guidance and the full help while reduced motion uses a static benefit',()=>{
  const h=harness();assert.equal(index(h),2);assert.equal(run(h).timer,null);assert.equal(h.saved().ui.diagnosisWelcomeSeen,true);
  h.click('welcome-help');assert.equal(run(h),null);assert.equal(h.node('#activity').open,true);
  for(const copy of ['차분히 집중해서 스스로 문제를 풀어요','중간에 나가도 이어서 할 수 있어요','실력알기를 마치면 나에게 맞는 학습을 준비해요'])assert(h.node('#activity').innerHTML.includes(copy));
  h.click('welcome-help-start');assert.equal(h.evaluate('editing.intro'),true);h.click('close-learning');releaseDim(h);
  assert.equal(h.node('#diagnosis-welcome-guide').hidden,true);
  const restored=harness(h.saved(),{reducedMotion:false});assert.equal(run(restored),null);assert.equal(restored.node('#diagnosis-welcome-guide').hidden,true);
});

test('V6.2 fills the actual paper area using saved valid answers, including answer zero, with no invented progress',()=>{
  for(const [answers,expected] of [[[],0],[[0],1],[[0,1],2],[[0,1,2],3],[[99,-1,null],0]]){
    const h=harness(activeState(answers)),fill=h.node('#diagnosis-sheet-fill'),sheet=h.node('#diagnosis-welcome-progress');
    const height=Number(fill.getAttribute('height')),y=Number(fill.getAttribute('y'));
    assert(Math.abs(height-200*expected/3)<.00001);assert(Math.abs(y+height-218)<.00001);
    assert.equal(sheet.getAttribute('aria-valuenow'),String(Math.round(expected/3*100)));
    assert.equal(sheet.getAttribute('data-has-progress'),String(expected>0));
    assert.equal(h.node('#diagnosis-sheet-count').textContent,expected?`${expected} / 3`:'');
    assert.equal(h.node('#diagnosis-sheet-count').getAttribute('visibility'),expected?'visible':'hidden');
    assert.equal(h.node('#diagnosis-sheet-waterline').getAttribute('d')==='',expected===0||expected===3);
  }
  const html=fs.readFileSync('dist/versions/v64/index.html','utf8');assert(!html.includes('diagnosis-sheet-percent'));assert(!html.includes('diagnosis-sheet-items'));assert(!html.includes('welcome-dismiss'));
  assert.match(html,/id="diagnosis-sheet-fill"/);assert.match(html,/clip-path="url\(#diagnosis-ink-clip\)"/);
  assert(!html.includes('한 문제씩 채워가요'));assert.match(html,/<text id="diagnosis-sheet-count"/);
});

test('V6.2 resumes real questions, adds actual answers to the fill and preserves mounted geometry during stable renders',()=>{
  const h=harness(activeState()),session=h.data('current().diagnosticSession');
  h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),false);assert.deepEqual(h.data('current().diagnosticSession'),session);
  h.click('diagnosis-answer',1);h.click('close-learning');h.click('diagnosis-leave');
  assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'67');
  assert(Math.abs(Number(h.node('#diagnosis-sheet-fill').getAttribute('height'))-400/3)<.00001);
  let writes=0;const fill=h.node('#diagnosis-sheet-fill'),original=fill.setAttribute.bind(fill);fill.setAttribute=(k,v)=>{writes++;original(k,v);};
  h.evaluate('render();render();syncGuidanceReminders()');assert.equal(writes,0);
  h.click('test');h.click('welcome-preview-first');releaseDim(h);assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'0');
  assert.equal(h.node('#diagnosis-sheet-fill').getAttribute('height'),'0');assert.equal(h.node('#diagnosis-welcome-guide').hidden,false);
  h.click('test');h.click('welcome-preview-progress');releaseDim(h);assert.equal(h.node('#diagnosis-welcome-guide').hidden,true);
  assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'33');
});

test('V6.2 keeps its SVG fill and clipping inside the native document instead of the source asset base URL',()=>{
  const h=harness(activeState());
  for(const href of ['https://example.test/v6.html','https://example.test/views/v64.html?theme=green#top']){
    h.context.location={href};h.evaluate('syncDiagnosisSheetReferences()');const page=href.split('#')[0];
    assert.equal(h.node('#diagnosis-sheet-clip').getAttribute('clip-path'),`url("${page}#diagnosis-ink-clip")`);
    for(const id of ['fill','waterline'])assert.equal(h.node('#diagnosis-sheet-'+id).getAttribute('fill'),`url("${page}#diagnosis-ink-color")`);
  }
});
