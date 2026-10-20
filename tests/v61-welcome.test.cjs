const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness:baseHarness}=require('./helpers/ui-harness.cjs');
const harness=(saved,options={})=>baseHarness(saved,{...options,appSource:fs.readFileSync('dist/versions/v63/app.js','utf8')});
const run=h=>h.evaluate('welcomeGuideRun');
const index=h=>Number(h.node('#diagnosis-welcome-guide').getAttribute('data-guide-index'));
function advance(h){const r=run(h);assert(r?.timer);r.timer.fn();assert.equal(r.phase,'leaving');assert(r.fadeTimer);r.fadeTimer.fn();return r;}
function releaseDim(h){const timer=h.evaluate('guidanceClosingTimer');if(timer&&!timer.cancelled)timer.fn();}

test('V6.1 shows one first-visit guide, rotates all three in order and leaves the real start action mounted',()=>{
  const h=harness(undefined,{reducedMotion:false}),before=h.data('current()'),parent=h.node('#diagnostic').parent,button=h.node('#diagnostic').innerHTML;
  assert.equal(h.node('#diagnosis-welcome').getAttribute('data-welcome-first'),'true');
  assert.equal(run(h).timer.ms,4800);assert.equal(index(h),0);
  for(const expected of [1,2,0,1]){
    const r=advance(h);assert.equal(r.index,expected);assert.equal(r.timer.ms,4800);
    for(let i=0;i<3;i++){assert.equal(h.node('#welcome-guide-slide-'+i).hidden,i!==expected);assert.equal(h.node('#welcome-guide-dot-'+i).getAttribute('aria-pressed'),String(i===expected));}
  }
  assert.deepEqual(h.data('current()'),before);assert.equal(h.node('#diagnostic').parent,parent);assert.equal(h.node('#diagnostic').innerHTML,button);
  assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('daily().timerRunning'),false);
  const timer=run(h).timer;h.evaluate('render();render();syncGuidanceReminders()');assert.equal(run(h).timer,timer);assert.equal(index(h),1);
});

test('V6.1 cancels stale transitions when choosing a guide, pausing, or hovering and keeps a full reading interval on return',()=>{
  const h=harness(undefined,{reducedMotion:false});const first=run(h).timer;
  h.click('welcome-guide-2');assert.equal(first.cancelled,true);assert.equal(index(h),2);first.fn();assert.equal(run(h).phase,'reading');
  h.click('welcome-guide-pause');assert.equal(run(h).timer,null);assert.equal(h.node('#welcome-guide-pause').getAttribute('aria-pressed'),'true');
  h.click('welcome-guide-1');assert.equal(index(h),1);assert.equal(run(h).timer,null);
  h.click('welcome-guide-pause');assert.equal(run(h).timer.ms,4800);
  run(h).timer.fn();const oldFade=run(h).fadeTimer;
  h.node('#diagnosis-welcome-guide').emit('pointerenter',{pointerType:'mouse'});assert.equal(oldFade.cancelled,true);assert.equal(run(h).phase,'reading');
  h.node('#diagnosis-welcome-guide').emit('pointerleave');oldFade.fn();assert.equal(index(h),1);assert.equal(run(h).timer.ms,4800);
  const hoverTimer=run(h).timer;h.node('#diagnosis-welcome-guide').emit('pointerenter',{pointerType:'touch'});assert.equal(run(h).timer,hoverTimer);
});

test('V6.1 pauses under settings, hidden tabs, keyboard focus and page suspension without consuming the visible first visit',()=>{
  const h=harness(undefined,{reducedMotion:false});advance(h);const r=run(h);
  h.node('#diagnosis-welcome-guide').emit('focusin');assert.equal(r.timer,null);
  h.node('#diagnosis-welcome-guide').emit('focusout',{});assert.equal(r.timer.ms,4800);
  h.document.visibilityState='hidden';h.emitDocument('visibilitychange');assert.equal(run(h),r);assert.equal(r.timer,null);assert.equal(index(h),1);
  h.document.visibilityState='visible';h.emitDocument('visibilitychange');assert.equal(r.timer.ms,4800);assert.equal(index(h),1);
  h.emitWindow('pagehide');assert.equal(r.timer,null);h.emitWindow('pageshow');assert.equal(r.timer.ms,4800);
  h.click('test');assert.equal(r.timer,null);assert.equal(h.node('#diagnosis-welcome').getAttribute('data-welcome-first'),'true');
  h.click('close-panel');releaseDim(h);assert.equal(run(h),r);assert.equal(r.timer.ms,4800);
});

test('V6.1 reduced-motion readers can choose every guide without automatic progression',()=>{
  const h=harness();assert.equal(run(h).timer,null);assert.equal(h.node('#welcome-guide-pause').hidden,true);
  for(const i of [1,2,0]){h.click('welcome-guide-'+i);assert.equal(index(h),i);assert.equal(run(h).timer,null);}
  h.media.matches=false;h.evaluate('syncWelcomeGuideClock()');assert.equal(run(h).timer.ms,4800);
  h.media.matches=true;h.evaluate('syncWelcomeGuideClock()');assert.equal(run(h).timer,null);
});

test('V6.1 keeps the once-only policy, help and real diagnosis entry instead of turning the guide into a blocking intro',()=>{
  const h=harness(undefined,{reducedMotion:false});advance(h);const stale=run(h).timer;
  assert.equal(h.saved().ui.diagnosisWelcomeSeen,true);
  h.click('diagnosis');assert.equal(run(h),null);assert.equal(stale.cancelled,true);assert.equal(h.evaluate('editing.intro'),true);
  stale.fn();assert.equal(h.evaluate('editing.intro'),true);h.click('close-learning');releaseDim(h);
  assert.equal(h.node('#diagnosis-welcome-guide').hidden,true);assert.equal(h.evaluate('current().diagnosis'),'idle');
  h.click('welcome-help');assert.match(h.node('#activity').innerHTML,/중간에 나가도 이어서 할 수 있어요/);
  h.click('welcome-help-start');assert.equal(h.evaluate('editing.intro'),true);
  const restored=harness(h.saved(),{reducedMotion:false});assert.equal(run(restored),null);assert.equal(restored.node('#diagnosis-welcome-guide').hidden,true);
});

test('V6.1 validation replays start the guide cleanly, while actual saved progress resumes without a carousel',()=>{
  const h=harness(undefined,{reducedMotion:false});h.click('welcome-guide-2');h.click('welcome-guide-pause');
  h.click('test');h.click('welcome-preview-first');releaseDim(h);assert.equal(index(h),0);assert.equal(run(h).timer.ms,4800);
  h.click('test');h.click('welcome-preview-progress');releaseDim(h);assert.equal(run(h),null);
  assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'33');assert.equal(h.node('#diagnosis-sheet-count').textContent,'1 / 3문항');
  const session=h.data('current().diagnosticSession');h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),false);assert.deepEqual(h.data('current().diagnosticSession'),session);
  assert.match(h.node('#learning').innerHTML,/문항 2 \/ 3/);
});
