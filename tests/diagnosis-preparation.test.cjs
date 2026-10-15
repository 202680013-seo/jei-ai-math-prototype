const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/ui-harness.cjs');

function finishWithPrescription(h){
  h.click('diagnosis');h.click('diagnosis-begin');
  for(const answer of [0,0,0]){h.click('diagnosis-answer',answer);h.click('diagnosis-next');}
}

test('a diagnosis with deficits keeps its full-screen host open through acknowledgment, search and ready stages',()=>{
  const h=harness(undefined,{reducedMotion:false}),learning=h.node('#learning');let closes=0;
  const close=learning.close.bind(learning);learning.close=()=>{closes++;close();};
  finishWithPrescription(h);const result=h.data('current().diagnosticResult'),run=h.evaluate('composing');
  assert.equal(closes,0,'the last answer never closes the diagnosis to reveal the overview');
  assert.equal(learning.open,true);assert.equal(h.node('#prescription').open,false);
  assert.equal(h.evaluate('editing.preparing'),true);assert(learning.classList.contains('diagnosis-screen'));
  assert.equal(h.node('#composition').parent,h.node('#diagnosis-composition-slot'));
  assert(learning.innerHTML.includes('맞춤 학습 준비'));assert.equal(h.node('#composition-title').textContent,'수고했어요!');
  assert.equal(h.evaluate('mainGuidanceVisible()'),false);assert.equal(h.evaluate('daily().timerRunning'),false);
  h.escape();h.click('diagnosis-next');h.click('diagnosis-answer',1);
  assert.equal(learning.open,true);assert.equal(h.evaluate('composing'),run);
  for(const [time,step] of [[2400,'1'],[5200,'2']]){
    h.evaluate(`composeTimers.find(t=>t.ms===${time})`).fn();
    assert.equal(h.node('#composition')['data-compose-step'],step);assert.equal(closes,0);assert.equal(learning.open,true);
  }
  assert.equal(h.evaluate('current().programs.length'),0);
  h.node('#composition').emit('click');assert.equal(h.node('#composition-copy').textContent,'여기부터 시작해 볼까요?');
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();
  assert.equal(closes,1);assert.equal(learning.open,false);assert.equal(h.node('#prescription').open,false);
  assert.equal(h.node('#composition').parent,h.node('#prescription'));assert.equal(h.node('#composition').hidden,true);
  assert.equal(h.evaluate('current().programs.length'),8);assert.deepEqual(h.data('current().diagnosticResult'),result);
  assert.equal(h.evaluate('current().programs[0].status'),'idle');assert.equal(h.evaluate('current().presentationPending'),true);
  assert.equal(h.evaluate('mainGuidanceVisible()'),false,'overview guidance waits for the full-screen exit');
  h.evaluate('guidanceClosingTimer').fn();assert.equal(h.evaluate('mainGuidanceVisible()'),true);
});

test('interrupted preparation releases its graphic and stale timers cannot prescribe another topic',()=>{
  const h=harness();finishWithPrescription(h);const oldTimers=h.evaluate('composeTimers.slice()');
  h.evaluate('cancelComposition();select(3,1)');assert.equal(h.node('#learning').open,false);
  assert.equal(h.node('#composition').parent,h.node('#prescription'));
  for(const timer of oldTimers)timer.fn();assert.equal(h.evaluate('current().programs.length'),0);
  finishWithPrescription(h);assert.equal(h.node('#composition').parent,h.node('#diagnosis-composition-slot'));
  assert.equal(h.node('#learning').open,true);assert.equal(h.node('#prescription').open,false);
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();assert.equal(h.evaluate('current().programs.length'),20);
});
