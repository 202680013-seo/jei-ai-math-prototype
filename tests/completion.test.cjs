const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/ui-harness.cjs');

function finishLesson(h,wrong='none'){
  h.click('program',0);h.click('program-begin');
  const limit=h.evaluate('current().programs[0].frames.length+1');
  for(let i=0;i<limit&&h.evaluate('current().programs[0].progress')<100;i++){
    const correct=h.evaluate('DEMO[(current().programs[0].completedFrames||0)%3].correct');
    h.click('learner-answer',wrong==='all'||wrong==='first'&&i===0?(correct+1)%3:correct);h.click('learner-next');
  }
  assert.equal(h.evaluate('current().programs[0].progress'),100);
}
const phase=h=>h.evaluate('current().diagnosisOutcome?.stage');
const advance=h=>{const timer=h.evaluate('diagnosisOutcomeTimer');assert(timer&&!timer.cancelled);timer.fn();};
function finishOutcome(h){h.click('diagnosis-outcome-confirm');while(h.evaluate('!!diagnosisOutcomeRun'))advance(h);}

test('passed and failed onboarding cues remain independent and attached only to the first eligible card',()=>{
  const h=harness();h.seed('passed');h.evaluate("current().programs[1].status='passed';M.setProgress(current().programs[1],100);current().programs[2].status='failed';M.setProgress(current().programs[2],100);render()");
  const before=h.data('current().programs'),html=h.node('#programs').innerHTML;
  assert.equal((html.match(/id="first-passed-card-hint"/g)||[]).length,1);assert.equal((html.match(/id="first-failed-card-hint"/g)||[]).length,1);
  assert.equal(h.evaluate('firstCompletedCardHint(current(),current().programs[0])'),true);
  assert.equal(h.evaluate('firstCompletedCardHint(current(),current().programs[1])'),false);
  h.click('completed-card',1);assert.equal(h.node('#activity').open,true);
  assert(h.node('#activity').innerHTML.includes('완료한 학습을 한 번 더 연습해볼까요?'));
  assert(!h.node('#programs').innerHTML.includes('id="first-passed-card-hint"'));assert(h.node('#programs').innerHTML.includes('id="first-failed-card-hint"'));
  h.click('close-activity');const restored=harness(h.saved());assert(!restored.node('#programs').innerHTML.includes('id="first-passed-card-hint"'));
  restored.click('failed-card',2);assert(!restored.node('#programs').innerHTML.includes('role="tooltip"'));assert.deepEqual(restored.data('current().programs'),before);
});

test('a passed program shows actual achievement, answers and time, then shares diagnosis reward and collection',()=>{
  const h=harness(undefined,{reducedMotion:false});h.evaluate('M.preset(state,3);current().diagnosticResult={questionCount:3,incorrect:1,deficits:1,seconds:23,goals:[]};render()');
  const diagnosis=h.data('current().diagnosticResult'),next=h.data('current().programs[1]');finishLesson(h);
  assert.equal(phase(h),'summary');assert.equal(h.evaluate('current().diagnosisOutcome.kind'),'program');
  const total=h.evaluate('current().programs[0].frames.length'),html=h.node('#diagnosis-inline-summary').innerHTML;
  assert.equal(h.node('#composition-title').textContent,'수고했어요!');assert(html.includes('달성률 100%'));assert(html.includes(`정답 ${total}개 · 오답 0개`));assert(html.includes('학습 시간'));
  assert(html.includes('completion-confetti'));assert.equal((html.match(/class="confetti-color-/g)||[]).length,22);
  assert(!html.includes('더 익힐 목표'));assert(h.node('#composition-topic-context').textContent.includes(h.evaluate('current().programs[0].name')));
  assert(h.node('#learning').classList.contains('program-outcome-screen'));assert.equal(h.evaluate('daily().timerRunning'),false);
  let writes=0,markup=html;Object.defineProperty(h.node('#diagnosis-inline-summary'),'innerHTML',{get:()=>markup,set:value=>{markup=value;writes++;},configurable:true});
  h.evaluate('refreshDialog();render();refreshDialog()');assert.equal(writes,0);
  h.escape();h.click('program',1);assert.equal(phase(h),'summary');assert.equal(h.evaluate('M.canStart(current(),current().programs[1])'),false);
  h.click('diagnosis-outcome-confirm');assert.equal(phase(h),'reward');assert(h.node('#learning').innerHTML.includes(`${total}문제를 맞혔어요!`));
  assert.equal(h.evaluate('skyState().totalPieces'),total);assert.equal(h.evaluate('Object.keys(state.programRewards).length'),1);
  const timer=h.evaluate('diagnosisOutcomeTimer');h.click('diagnosis-outcome-confirm');assert.equal(h.evaluate('diagnosisOutcomeTimer'),timer);
  advance(h);assert.equal(phase(h),'collecting');assert(h.node('.constellation-trigger').classList.contains('is-receiving-fragments'));advance(h);
  assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('M.canStart(current(),current().programs[1])'),true);
  assert.deepEqual(h.data('current().programs[1]'),next);assert.deepEqual(h.data('current().diagnosticResult'),diagnosis);assert.equal(h.evaluate('current().diagnosis'),'done');
  h.click('program',0);assert(h.node('#learning').innerHTML.includes('program-outcome-metrics'));assert(!h.node('#learning').innerHTML.includes('completion-confetti'));
  assert.equal(h.evaluate('skyState().totalPieces'),total);assert.equal(h.evaluate('diagnosisOutcomeRun'),null);
});

test('a failed program shows a lower achievement ring and still earns pieces for its correct answers',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');finishLesson(h,'first');
  const total=h.evaluate('current().programs[0].frames.length'),html=h.node('#diagnosis-inline-summary').innerHTML;
  assert.equal(h.evaluate('current().programs[0].status'),'failed');assert(html.includes('class="badge failed">미통과'));
  assert(html.includes(`달성률 ${Math.round((total-1)/total*100)}%`));assert(html.includes(`정답 ${total-1}개 · 오답 1개`));
  h.click('diagnosis-outcome-confirm');assert.equal(phase(h),'reward','program failure never starts diagnosis search or prescription generation');
  assert.equal(h.evaluate('skyState().totalPieces'),total-1);advance(h);assert.equal(phase(h),'collecting');advance(h);
  h.click('failed-card',0);assert.equal(h.node('#activity').open,true);assert.equal(h.evaluate('current().programs[0].status'),'failed');
});

test('all-wrong program results show 0% and zero reward without sending fragments to the shortcut',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');finishLesson(h,'all');
  assert(h.node('#diagnosis-inline-summary').innerHTML.includes('달성률 0%'));h.click('diagnosis-outcome-confirm');
  assert.equal(phase(h),'reward');assert(h.node('#learning').innerHTML.includes('다음에는 별 조각도 모아봐요'));advance(h);
  assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.evaluate('skyState().totalPieces'),0);assert.equal(h.evaluate('Object.values(state.programRewards)[0].pieces'),0);
});

test('review completion gets its own summary and reward, keeping the initial result and next active work intact',()=>{
  const h=harness();h.seed('failed');const original=h.data('current().programs[0]'),next=h.data('current().programs[1]');
  h.click('failed-card',0);h.click('study-choice-review');h.finishReview();
  assert.equal(phase(h),'summary');assert.equal(h.evaluate('current().diagnosisOutcome.review'),true);
  assert(h.node('#diagnosis-inline-summary').innerHTML.includes('달성률 100%'));assert(h.node('#composition-topic-context').textContent.includes('복습 결과'));
  assert.equal(h.evaluate('current().programs[0].status'),'passed');assert.equal(h.evaluate('current().programs[0].initialResult.status'),original.status);
  finishOutcome(h);assert.deepEqual(h.data('current().programs[1]'),next);
  h.click('completed-card',0);h.click('study-choice-result');assert(h.node('#learning').innerHTML.includes('첫 학습 결과'));
  assert(h.node('#learning').innerHTML.includes('오답 1개'));assert(!h.node('#learning').innerHTML.includes('completion-confetti'));
  assert.equal(h.evaluate('Object.keys(state.programRewards).length'),1);
});

test('reload restores all program outcome stages without overwriting prescription or granting twice',()=>{
  let h=harness();h.evaluate('M.preset(state,3);render()');finishLesson(h);const total=h.evaluate('current().programs[0].frames.length');
  for(const stage of ['summary','reward','collecting']){
    assert.equal(phase(h),stage);const programs=h.data('current().programs');h=harness(h.saved());
    assert.equal(phase(h),stage);assert.deepEqual(h.data('current().programs'),programs);assert.equal(h.node('#learning-workspace').inert,true);
    if(stage==='summary')h.click('diagnosis-outcome-confirm');else advance(h);
  }
  assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('skyState().totalPieces'),total);assert.equal(h.evaluate('Object.keys(state.programRewards).length'),1);
});

test('program result time excludes hidden, closed and entry-screen time while resume retains answers',()=>{
  const h=harness();h.evaluate('let testClock=1000;Date.now=()=>testClock;M.preset(state,3);render()');
  h.click('program',0);h.evaluate('testClock+=100000');h.click('program-begin');h.evaluate('testClock+=10000');
  h.document.visibilityState='hidden';h.emitDocument('visibilitychange');h.evaluate('testClock+=200000');
  h.document.visibilityState='visible';h.emitDocument('visibilitychange');h.evaluate('testClock+=10000');h.click('learner-answer',0);h.click('close-learning');
  assert.equal(h.evaluate('current().programs[0].studyTiming.normal.elapsedMs'),20000);assert.equal(h.evaluate('current().programs[0].studyTiming.normal.runningSince'),null);
  h.evaluate('testClock+=300000');h.click('program',0);h.evaluate('testClock+=100000');h.click('program-begin');h.evaluate('testClock+=45000');
  const total=h.evaluate('current().programs[0].frames.length');for(let i=0;i<total;i++){const a=h.evaluate('DEMO[(current().programs[0].completedFrames||0)%3].correct');h.click('learner-answer',a);h.click('learner-next');}
  assert.equal(phase(h),'summary');assert.equal(h.evaluate('current().diagnosisOutcome.result.seconds'),65);
  assert(h.node('#diagnosis-inline-summary').innerHTML.includes('1<small>분</small> 05<small>초</small>'));
});

test('program rewards and collection pause while hidden and stale callbacks never finish a different scenario',()=>{
  const h=harness(undefined,{reducedMotion:false});h.evaluate('M.preset(state,3);render()');finishLesson(h);h.click('diagnosis-outcome-confirm');
  for(const stage of ['reward','collecting']){
    assert.equal(phase(h),stage);const timer=h.evaluate('diagnosisOutcomeTimer');h.document.visibilityState='hidden';h.emitDocument('visibilitychange');
    timer.fn();assert.equal(phase(h),stage);assert.equal(h.evaluate('diagnosisOutcomeTimer'),null);
    h.document.visibilityState='visible';h.emitDocument('visibilitychange');timer.fn();assert.equal(phase(h),stage);
    if(stage==='reward')advance(h);
  }
  const stale=h.evaluate('diagnosisOutcomeTimer'),earned=h.evaluate('skyState().totalPieces');h.click('preset',0);stale.fn();
  assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.evaluate('skyState().totalPieces'),earned);
  assert.equal(h.node('#learning-workspace').inert,false);assert(!h.node('.constellation-trigger').classList.contains('is-receiving-fragments'));
});

test('program validation replays use the real flow without crediting pieces or changing later program progress',()=>{
  const h=harness();h.seed('passed');const next=h.data('current().programs[1]'),before=h.evaluate('skyState().totalPieces');
  for(const action of ['replay-program-pass','replay-program-fail']){
    h.click('test');h.click(action);assert.equal(phase(h),'summary');assert.equal(h.evaluate('current().diagnosisOutcome.preview'),true);
    assert(h.node('#diagnosis-inline-summary').innerHTML.includes('1<small>분</small> 05<small>초</small>'));
    finishOutcome(h);assert.equal(h.evaluate('skyState().totalPieces'),before);assert.deepEqual(h.data('current().programs[1]'),next);
  }
});
