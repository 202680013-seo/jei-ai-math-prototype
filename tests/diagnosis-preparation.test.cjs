const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/ui-harness.cjs');

function finish(h,wrong=[1]){
  h.click('diagnosis');h.click('diagnosis-begin');
  for(let i=0;i<3;i++){const correct=h.evaluate(`DEMO[${i}].correct`);h.click('diagnosis-answer',wrong.includes(i)?(correct+1)%3:correct);h.click('diagnosis-next');}
}
const phase=h=>h.evaluate('current().diagnosisOutcome?.stage');
const advance=h=>{const timer=h.evaluate('diagnosisOutcomeTimer');assert(timer&&!timer.cancelled);timer.fn();};
function finishOutcome(h){h.click('diagnosis-outcome-confirm');while(h.evaluate('!!diagnosisOutcomeRun'))advance(h);}

test('both outcomes first summarize real answers and time on the final question, and wait for confirmation',()=>{
  for(const wrong of [[],[1]]){
    const h=harness(undefined,{reducedMotion:false}),learning=h.node('#learning');let closes=0;
    const close=learning.close.bind(learning);learning.close=()=>{closes++;close();};finish(h,wrong);
    const result=h.data('current().diagnosticResult'),html=learning.innerHTML;
    assert.equal(closes,0);assert.equal(learning.open,true);assert.equal(h.node('#prescription').open,false);
    assert.equal(phase(h),'summary');assert.equal(h.evaluate('diagnosisOutcomeTimer'),null);
    assert(html.includes('수고했어요!'));assert(html.includes(`정답 ${3-wrong.length}개 · 오답 ${wrong.length}개`));
    assert(html.includes(`전체 3개 중 ${wrong.length}개`));assert(html.includes('학습 시간'));
    assert(html.includes('문항 3 / 3'));assert(html.includes('inert aria-hidden="true"'));
    assert.equal(h.evaluate('mainGuidanceVisible()'),false);assert.equal(h.evaluate('daily().timerRunning'),false);
    h.escape();h.click('diagnosis-next');h.click('diagnosis-answer',1);h.click('pass-next');h.click('program',0);
    assert.equal(phase(h),'summary');assert.deepEqual(h.data('current().diagnosticResult'),result);assert.equal(closes,0);
    assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.node('#learning-workspace').inert,true);
    finishOutcome(h);assert.equal(h.node('#learning-workspace').inert,false);
  }
});

test('passed diagnosis rewards correct answers once and then requires an explicit next-diagnosis action',()=>{
  const h=harness(),before=h.evaluate('skyState().totalPieces');finish(h,[]);
  h.click('diagnosis-outcome-confirm');assert.equal(phase(h),'reward');
  assert(h.node('#learning').innerHTML.includes('3문제를 맞혔어요!'));assert(h.node('#learning').innerHTML.includes('별 조각 <strong>+3'));
  assert.equal(h.evaluate('skyState().totalPieces'),before+3);assert.equal(h.evaluate('daily().fragments'),3);
  const timer=h.evaluate('diagnosisOutcomeTimer');h.click('diagnosis-outcome-confirm');assert.equal(h.evaluate('diagnosisOutcomeTimer'),timer);
  h.evaluate("setDiagnosisOutcomeStage('reward')");assert.equal(h.evaluate('skyState().totalPieces'),before+3);
  const saved=h.saved(),restored=harness(saved);assert.equal(phase(restored),'reward');assert.equal(restored.evaluate('skyState().totalPieces'),before+3);
  advance(restored);assert.equal(restored.evaluate('diagnosisOutcomeRun'),null);assert.equal(restored.node('#learning').open,true);
  assert(restored.node('#learning').innerHTML.includes('진단을 통과했어요!'));assert.equal(restored.evaluate('state.index'),0);
  assert.equal(restored.evaluate('current().programs.length'),0);assert.equal(restored.evaluate('current().diagnosticResult.incorrect'),0);
  restored.click('pass-details');restored.click('pass-summary');restored.click('pass-next');assert.equal(restored.evaluate('state.index'),0);
  restored.click('pass-begin');assert.equal(restored.evaluate('state.index'),1);assert.equal(restored.evaluate('current().diagnosis'),'active');
  assert.equal(restored.evaluate('skyState().totalPieces'),before+3);
});

test('failed diagnosis follows summary → original acknowledgment, lens and ready → locked course → reward → first program open',()=>{
  const h=harness(undefined,{reducedMotion:false});finish(h,[1]);h.click('diagnosis-outcome-confirm');
  assert.equal(phase(h),'acknowledge');assert.equal(h.node('#composition-title').textContent,'수고했어요!');
  assert.equal(h.node('#composition-copy').textContent,'실력알기를 마쳤어요.');assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),3000);
  h.click('diagnosis-outcome-confirm');assert.equal(phase(h),'acknowledge');advance(h);
  assert.equal(phase(h),'searching');assert.equal(h.node('#composition-title').textContent,'맞춤 학습을 찾고 있어요');
  assert.equal(h.node('#composition').getAttribute('data-compose-step'),'1');assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),3000);
  h.escape();assert.equal(phase(h),'searching');advance(h);
  assert.equal(phase(h),'ready');assert(h.node('#composition-title').textContent.includes('학습이 준비됐어요'));
  assert.equal(h.node('#composition').getAttribute('data-compose-step'),'2');assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),3000);advance(h);
  assert.equal(phase(h),'generating');assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('current().programs.length'),8);
  assert(h.node('#programs').classList.contains('reveal'));assert(h.node('#learning').classList.contains('diagnosis-generating'));
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[0])'),false);
  for(const action of ['program','recommend','groups','mypage','constellation','test','close-learning'])h.click(action,0);
  assert.equal(phase(h),'generating');assert.equal(h.evaluate('editing.outcome'),true);
  advance(h);assert.equal(phase(h),'reward');assert(h.node('#learning').innerHTML.includes('2문제를 맞혔어요!'));
  assert.equal(h.evaluate('skyState().totalPieces'),2);assert.equal(h.evaluate('M.canStudy(current(),current().programs[0])'),false);
  advance(h);assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.node('#learning').open,false);
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[0])'),true);
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[1])'),false);
  assert.equal(h.evaluate('current().programs[0].status'),'idle');assert.equal(h.node('#learning-workspace').inert,false);
  assert.equal(h.evaluate('current().presentationPending'),true);
  h.evaluate('guidanceClosingTimer').fn();assert.equal(h.evaluate('mainGuidanceVisible()'),true);
  assert(h.node('#programs').innerHTML.includes('시작하기'));h.click('program',0);assert.equal(h.evaluate('editing.intro'),true);
});

test('all-wrong results receive zero fragments without clearing earlier sky reward indicators',()=>{
  const h=harness();h.evaluate('K.addPieces(skyState(),4)');finish(h,[0,1,2]);finishOutcome(h);
  assert.equal(h.evaluate('skyState().totalPieces'),4);assert.equal(h.evaluate('skyState().newPieces'),true);
  assert.equal(h.evaluate('daily().fragments'),0);assert.equal(h.evaluate('Object.values(state.diagnosisRewards)[0].pieces'),0);
});

test('summary counts distinct deficit goals, actual question totals and a readable duration',()=>{
  const h=harness();h.evaluate(`beginDiagnosisOutcome({questionCount:9,incorrect:3,seconds:605,goals:[{questions:[{correct:0,chosen:1},{correct:0,chosen:1},{correct:0,chosen:1}]},{questions:[{correct:0,chosen:0}]},{questions:[{correct:0,chosen:0}]}]})`);
  const stats=h.data('diagnosisSummary(current().diagnosticResult)'),html=h.node('#learning').innerHTML;
  assert.deepEqual(stats,{total:9,wrong:3,correct:6,deficits:1,goalCount:3,seconds:605});
  assert(html.includes('정답 6개 · 오답 3개'));assert(html.includes('전체 3개 중 1개'));assert(html.includes('10<small>분</small> 05<small>초</small>'));
});

test('hidden tabs pause completion timing, stale callbacks cannot advance, and resume keeps the same phase',()=>{
  const h=harness(undefined,{reducedMotion:false});finish(h,[1]);h.click('diagnosis-outcome-confirm');
  for(const expected of ['acknowledge','searching','ready','generating','reward']){
    assert.equal(phase(h),expected);const old=h.evaluate('diagnosisOutcomeTimer');
    h.document.visibilityState='hidden';h.emitDocument('visibilitychange');assert.equal(h.evaluate('diagnosisOutcomeTimer'),null);
    old.fn();assert.equal(phase(h),expected);assert.equal(h.node('#learning').getAttribute('data-outcome-paused'),'true');
    h.document.visibilityState='visible';h.emitDocument('visibilitychange');const resumed=h.evaluate('diagnosisOutcomeTimer');
    assert(resumed);assert.equal(h.node('#learning').getAttribute('data-outcome-paused'),'false');old.fn();assert.equal(phase(h),expected);advance(h);
  }
  assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.evaluate('skyState().totalPieces'),2);
});

test('reload restores each pending stage and never recreates a generated course or rewards it twice',()=>{
  let h=harness();finish(h,[1]);
  for(const expected of ['summary','acknowledge','searching','ready','generating','reward']){
    assert.equal(phase(h),expected);const saved=h.saved();h=harness(saved);
    assert.equal(phase(h),expected);assert.equal(h.node('#learning').open,true);assert.equal(h.node('#learning-workspace').inert,true);
    if(expected==='generating')assert.deepEqual(h.data('current().programs'),saved.grades[3][0].programs);
    if(expected==='summary')h.click('diagnosis-outcome-confirm');else advance(h);
  }
  assert.equal(h.evaluate('skyState().totalPieces'),2);assert.equal(h.node('#learning').open,false);
  h.click('diagnosis');assert(h.node('#learning').innerHTML.includes('실력 확인 결과'));assert.equal(h.evaluate('skyState().totalPieces'),2);
});

test('explicit scenario changes cancel timers and release inert elements without prescribing or crediting another topic',()=>{
  const h=harness();finish(h,[1]);h.click('diagnosis-outcome-confirm');const old=h.evaluate('diagnosisOutcomeTimer');
  h.click('preset',0);assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.node('#learning').open,false);
  old.fn();assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.evaluate('current().programs.length'),0);
  assert.equal(h.evaluate('skyState().totalPieces'),0);assert.equal(h.node('#learning-workspace').inert,false);
  finish(h,[1]);h.click('diagnosis-outcome-confirm');const stale=h.evaluate('diagnosisOutcomeTimer');
  h.evaluate('select(3,1)');stale.fn();assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.node('#learning').open,false);
  h.evaluate('select(3,0)');assert.equal(phase(h),'acknowledge');assert.equal(h.node('#learning').open,true);
});

test('reduced motion preserves readable stage holds and model locks, then opens the course normally',()=>{
  const h=harness(undefined,{reducedMotion:true});finish(h,[1]);h.click('diagnosis-outcome-confirm');for(const expected of ['acknowledge','searching','ready']){assert.equal(phase(h),expected);assert.equal(h.node('#composition').hidden,false);advance(h);}
  assert.equal(phase(h),'generating');assert.equal(h.evaluate('cardRevealRun'),null);assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),2200);
  assert.equal(h.evaluate('M.canStart(current(),current().programs[0])'),false);advance(h);
  assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),3600);advance(h);assert.equal(h.evaluate('M.canStart(current(),current().programs[0])'),true);
});


test('restored preparation reuses the original SVGs and one mounted screen through all three steps',()=>{
  const fs=require('node:fs'),original=harness(undefined,{appSource:fs.readFileSync('dist/versions/v55/app.js','utf8')});
  original.evaluate("beginComposition(8,'first','learning')");const originalGraphics=original.node('#composition').innerHTML;
  const h=harness(undefined,{reducedMotion:false});finish(h,[1]);h.click('diagnosis-outcome-confirm');
  assert.equal(h.node('#composition').innerHTML,originalGraphics,'the original check, scanning lens and ready artwork are reused exactly');
  const composition=h.node('#composition'),host=h.node('#learning');let writes=0,markup=host.innerHTML;
  Object.defineProperty(host,'innerHTML',{get:()=>markup,set:value=>{markup=value;writes++;},configurable:true});
  for(const expected of ['acknowledge','searching','ready']){
    assert.equal(phase(h),expected);assert.equal(composition.parent,h.node('#diagnosis-composition-slot'));
    assert.equal(composition.hidden,false);assert.equal(composition.innerHTML,originalGraphics);
    assert.equal(host.getAttribute('aria-labelledby'),'composition-title');assert(host.classList.contains('diagnosis-preparing'));
    h.evaluate('render();refreshDialog();refreshDialog()');assert.equal(writes,0,'routine renders and stage changes keep the mounted preparation screen');
    if(expected!=='ready')advance(h);
  }
  assert.equal(h.evaluate('current().programs.length'),0);advance(h);
  assert.equal(phase(h),'generating');assert.equal(composition.parent,h.node('#prescription'));assert.equal(composition.hidden,true);
  assert.equal(host.classList.contains('diagnosis-preparing'),false);advance(h);advance(h);
  assert.equal(h.evaluate('skyState().totalPieces'),2);
});

test('cancelling either restored step releases the reusable graphic and stale timers cannot reveal a new course',()=>{
  for(const expected of ['searching','ready']){
    const h=harness();h.click('replay-first');h.click('diagnosis-outcome-confirm');advance(h);if(expected==='ready')advance(h);
    assert.equal(phase(h),expected);const stale=h.evaluate('diagnosisOutcomeTimer');h.click('preset',0);stale.fn();
    assert.equal(h.node('#composition').parent,h.node('#prescription'));assert.equal(h.node('#composition').hidden,true);
    assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.evaluate('skyState().totalPieces'),0);assert.equal(h.node('#learning').open,false);
    h.click('replay-first');h.click('diagnosis-outcome-confirm');advance(h);
    assert.equal(phase(h),'searching');assert.equal(h.node('#composition').parent,h.node('#diagnosis-composition-slot'));
  }
});
