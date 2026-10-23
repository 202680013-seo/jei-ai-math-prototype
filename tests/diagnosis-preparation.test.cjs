const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/ui-harness.cjs');

function finish(h,wrong=[1]){
  h.click('diagnosis');h.click('diagnosis-begin');
  for(let i=0;i<3;i++){const correct=h.evaluate(`DEMO[${i}].correct`);h.click('diagnosis-answer',wrong.includes(i)?(correct+1)%3:correct);h.click('diagnosis-next');}
}
const phase=h=>h.evaluate('current().diagnosisOutcome?.stage');
const advance=h=>{const timer=h.evaluate('diagnosisOutcomeTimer');assert(timer&&!timer.cancelled);timer.fn();};
function finishOutcome(h){h.click('diagnosis-outcome-confirm');while(h.evaluate('!!diagnosisOutcomeRun'))advance(h);}
function reachReward(h){h.click('diagnosis-outcome-confirm');while(phase(h)!=='reward')advance(h);}

test('both outcomes integrate actual counts and time into the original full screen without a second thank-you or a result popup',()=>{
  for(const wrong of [[],[1]]){
    const h=harness(undefined,{reducedMotion:false}),learning=h.node('#learning');let closes=0;
    const close=learning.close.bind(learning);learning.close=()=>{closes++;close();};finish(h,wrong);
    const result=h.data('current().diagnosticResult'),html=h.node('#diagnosis-inline-summary').innerHTML;
    assert.equal(closes,0);assert.equal(learning.open,true);assert.equal(h.node('#prescription').open,false);
    assert.equal(phase(h),'summary');assert.equal(h.evaluate('diagnosisOutcomeTimer'),null);
    assert.equal(h.node('#composition-title').textContent,wrong.length?'수고했어요!':'실력알기를 통과했어요!');assert.equal(h.node('#diagnosis-inline-summary').hidden,false);
    assert(html.includes(`정답 ${3-wrong.length}개 · 오답 ${wrong.length}개`));assert(html.includes(`전체 3개 중 ${wrong.length}개`));assert(html.includes('학습 시간'));
    assert(learning.classList.contains('diagnosis-summary-screen'));assert(!learning.innerHTML.includes('diagnosis-outcome-summary'));
    assert(!learning.innerHTML.includes('diagnosis-outcome-scrim'));assert(!learning.innerHTML.includes('문항 3 / 3'));
    assert.equal(h.node('#composition').parent,h.node('#diagnosis-composition-slot'));
    assert.equal(h.evaluate('mainGuidanceVisible()'),false);assert.equal(h.evaluate('daily().timerRunning'),false);
    h.escape();h.click('diagnosis-next');h.click('diagnosis-answer',1);h.click('pass-next');h.click('program',0);
    assert.equal(phase(h),'summary');assert.deepEqual(h.data('current().diagnosticResult'),result);assert.equal(closes,0);
    assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.node('#learning-workspace').inert,true);
    h.click('diagnosis-outcome-confirm');
    assert.equal(phase(h),wrong.length?'searching':'reward','the summary never leads to another acknowledgment screen');
    while(h.evaluate('!!diagnosisOutcomeRun'))advance(h);assert.equal(h.node('#learning-workspace').inert,false);
  }
});

test('passed diagnosis rewards once, collects, completes the clover and returns to the next diagnosis invitation',()=>{
  const h=harness(),before=h.evaluate('skyState().totalPieces');finish(h,[]);
  h.click('diagnosis-outcome-confirm');assert.equal(phase(h),'reward');
  assert(h.node('#learning').innerHTML.includes('3문제를 맞혔어요!'));assert(h.node('#learning').innerHTML.includes('별 조각 <strong>+3'));
  assert.equal(h.evaluate('skyState().totalPieces'),before+3);assert.equal(h.evaluate('daily().fragments'),3);
  const timer=h.evaluate('diagnosisOutcomeTimer');h.click('diagnosis-outcome-confirm');assert.equal(h.evaluate('diagnosisOutcomeTimer'),timer);
  h.evaluate("setDiagnosisOutcomeStage('reward')");assert.equal(h.evaluate('skyState().totalPieces'),before+3);
  const restored=harness(h.saved());assert.equal(phase(restored),'reward');assert.equal(restored.evaluate('skyState().totalPieces'),before+3);
  advance(restored);assert.equal(phase(restored),'collecting');assert.equal(restored.node('#learning-workspace').inert,true);advance(restored);
  assert.equal(phase(restored),'clover-complete');assert.equal(restored.node('#learning').open,false);
  assert.equal(restored.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'100');
  for(const stage of ['clover-complete','clover-glow','rail-complete','rail-next','rail-close']){
    assert.equal(restored.evaluate('diagnosisOutcomeRun.target.diagnosisOutcome.stage'),stage);advance(restored);
  }
  assert.equal(restored.evaluate('diagnosisOutcomeRun'),null);assert.equal(restored.evaluate('state.index'),1);
  assert.equal(restored.evaluate('current().diagnosis'),'idle');assert.equal(restored.node('#learning').open,false);
  assert.equal(restored.evaluate('state.grades[3][0].diagnosticResult.incorrect'),0);
  assert.equal(restored.node('#diagnosis-welcome-title').textContent,'나의 실력을 알아볼까요?');
  assert.equal(restored.evaluate('skyState().totalPieces'),before+3);
});

test('failed diagnosis preserves lens, ready, course reveal and reward, then unlocks only after collection',()=>{
  const h=harness(undefined,{reducedMotion:false});finish(h,[1]);h.click('diagnosis-outcome-confirm');
  assert.equal(phase(h),'searching');assert.equal(h.node('#composition-title').textContent,'맞춤 학습을 찾고 있어요');
  assert.equal(h.node('#diagnosis-inline-summary').hidden,true);assert.equal(h.node('#composition').getAttribute('data-compose-step'),'1');
  assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),3000);h.escape();h.click('diagnosis-outcome-confirm');assert.equal(phase(h),'searching');advance(h);
  assert.equal(phase(h),'ready');assert(h.node('#composition-title').textContent.includes('학습이 준비됐어요'));
  assert.equal(h.node('#composition').getAttribute('data-compose-step'),'2');assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),3000);advance(h);
  assert.equal(phase(h),'generating');assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('current().programs.length'),8);
  assert(h.node('#programs').classList.contains('reveal'));assert(h.node('#learning').classList.contains('diagnosis-generating'));
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[0])'),false);
  for(const action of ['program','recommend','groups','mypage','constellation','test','close-learning'])h.click(action,0);
  assert.equal(phase(h),'generating');advance(h);assert.equal(phase(h),'reward');assert(h.node('#learning').innerHTML.includes('2문제를 맞혔어요!'));
  assert.equal(h.evaluate('skyState().totalPieces'),2);advance(h);assert.equal(phase(h),'collecting');
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[0])'),false);h.click('program',0);assert.equal(phase(h),'collecting');advance(h);
  assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.node('#learning').open,false);
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[0])'),true);assert.equal(h.evaluate('M.canStudy(current(),current().programs[1])'),false);
  assert.equal(h.evaluate('current().programs[0].status'),'idle');assert.equal(h.node('#learning-workspace').inert,false);
  assert.equal(h.evaluate('current().presentationPending'),true);assert(!h.node('.constellation-trigger').classList.contains('is-receiving-fragments'));
  h.evaluate('guidanceClosingTimer').fn();assert.equal(h.evaluate('mainGuidanceVisible()'),true);
  assert(h.node('#programs').innerHTML.includes('시작하기'));h.click('program',0);assert.equal(h.evaluate('editing.intro'),true);
});

test('all-wrong results receive zero fragments and skip the flight without clearing earlier sky indicators',()=>{
  const h=harness();h.evaluate('K.addPieces(skyState(),4)');finish(h,[0,1,2]);reachReward(h);advance(h);
  assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.evaluate('skyState().totalPieces'),4);
  assert.equal(h.evaluate('skyState().newPieces'),true);assert.equal(h.evaluate('daily().fragments'),0);
  assert.equal(h.evaluate('Object.values(state.diagnosisRewards)[0].pieces'),0);assert(!h.node('.constellation-trigger').classList.contains('is-receiving-fragments'));
});

test('full-screen summary counts distinct goals, actual question totals and a readable duration',()=>{
  const h=harness();h.evaluate(`beginDiagnosisOutcome({questionCount:9,incorrect:3,seconds:605,goals:[{questions:[{correct:0,chosen:1},{correct:0,chosen:1},{correct:0,chosen:1}]},{questions:[{correct:0,chosen:0}]},{questions:[{correct:0,chosen:0}]}]})`);
  const stats=h.data('diagnosisSummary(current().diagnosticResult)'),html=h.node('#diagnosis-inline-summary').innerHTML;
  assert.deepEqual(stats,{total:9,wrong:3,correct:6,deficits:1,goalCount:3,seconds:605});
  assert(html.includes('정답 6개 · 오답 3개'));assert(html.includes('전체 3개 중 1개'));assert(html.includes('10<small>분</small> 05<small>초</small>'));
});

test('hidden tabs pause preparation, rewards and collection; stale callbacks cannot unlock the overview',()=>{
  const h=harness(undefined,{reducedMotion:false});finish(h,[1]);h.click('diagnosis-outcome-confirm');
  for(const expected of ['searching','ready','generating','reward','collecting']){
    assert.equal(phase(h),expected);const old=h.evaluate('diagnosisOutcomeTimer');
    h.document.visibilityState='hidden';h.emitDocument('visibilitychange');assert.equal(h.evaluate('diagnosisOutcomeTimer'),null);
    old.fn();assert.equal(phase(h),expected);assert.equal(h.node('#learning').getAttribute('data-outcome-paused'),'true');
    if(expected==='collecting')assert.equal(h.node('.constellation-trigger').getAttribute('data-reward-paused'),'true');
    h.document.visibilityState='visible';h.emitDocument('visibilitychange');assert(h.evaluate('diagnosisOutcomeTimer'));
    assert.equal(h.node('#learning').getAttribute('data-outcome-paused'),'false');old.fn();assert.equal(phase(h),expected);advance(h);
  }
  assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.evaluate('skyState().totalPieces'),2);
});

test('reload restores every pending stage, including collection, without recreating courses or duplicating rewards',()=>{
  let h=harness();finish(h,[1]);
  for(const expected of ['summary','searching','ready','generating','reward','collecting']){
    assert.equal(phase(h),expected);const saved=h.saved();h=harness(saved);
    assert.equal(phase(h),expected);assert.equal(h.node('#learning').open,true);assert.equal(h.node('#learning-workspace').inert,true);
    if(expected==='generating')assert.deepEqual(h.data('current().programs'),saved.grades[3][0].programs);
    if(expected==='summary')h.click('diagnosis-outcome-confirm');else advance(h);
  }
  assert.equal(h.evaluate('skyState().totalPieces'),2);assert.equal(h.node('#learning').open,false);
  h.click('diagnosis');assert(h.node('#learning').innerHTML.includes('실력 확인 결과'));assert.equal(h.evaluate('skyState().totalPieces'),2);
});

test('explicit scenario changes cancel pending work and release reusable elements without affecting another topic',()=>{
  const h=harness();finish(h,[1]);h.click('diagnosis-outcome-confirm');const old=h.evaluate('diagnosisOutcomeTimer');
  h.click('preset',0);assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.node('#learning').open,false);old.fn();
  assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.evaluate('current().programs.length'),0);
  assert.equal(h.evaluate('skyState().totalPieces'),0);assert.equal(h.node('#learning-workspace').inert,false);
  finish(h,[1]);h.click('diagnosis-outcome-confirm');const stale=h.evaluate('diagnosisOutcomeTimer');
  h.evaluate('select(3,1)');stale.fn();assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.node('#learning').open,false);
  h.evaluate('select(3,0)');assert.equal(phase(h),'searching');assert.equal(h.node('#learning').open,true);
});

test('reduced motion retains stage holds and uses a brief destination highlight instead of travelling fragments',()=>{
  const h=harness(undefined,{reducedMotion:true});finish(h,[1]);h.click('diagnosis-outcome-confirm');
  for(const expected of ['searching','ready']){assert.equal(phase(h),expected);assert.equal(h.node('#composition').hidden,false);advance(h);}
  assert.equal(phase(h),'generating');assert.equal(h.evaluate('cardRevealRun'),null);assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),2200);advance(h);
  assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),3600);advance(h);assert.equal(phase(h),'collecting');assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),450);
  assert.equal(h.evaluate('M.canStart(current(),current().programs[0])'),false);advance(h);assert.equal(h.evaluate('M.canStart(current(),current().programs[0])'),true);
});

test('full-screen results, scanning lens and ready step reuse the original SVGs without replacing their mounted screen',()=>{
  const fs=require('node:fs'),original=harness(undefined,{appSource:fs.readFileSync('dist/versions/v55/app.js','utf8')});
  original.evaluate("beginComposition(8,'first','learning')");const svgs=markup=>(markup.match(/<svg\b[\s\S]*?<\/svg>/g)||[]).join('');
  const originalGraphics=svgs(original.node('#composition').innerHTML),h=harness(undefined,{reducedMotion:false});finish(h,[1]);
  assert.equal(svgs(h.node('#composition').innerHTML),originalGraphics);
  const composition=h.node('#composition'),host=h.node('#learning');let writes=0,markup=host.innerHTML;
  Object.defineProperty(host,'innerHTML',{get:()=>markup,set:value=>{markup=value;writes++;},configurable:true});
  for(const expected of ['summary','searching','ready']){
    assert.equal(phase(h),expected);assert.equal(composition.parent,h.node('#diagnosis-composition-slot'));
    assert.equal(composition.hidden,false);assert.equal(svgs(composition.innerHTML),originalGraphics);
    assert.equal(host.getAttribute('aria-labelledby'),'composition-title');assert.equal(h.node('#diagnosis-inline-summary').hidden,expected!=='summary');
    h.evaluate('render();refreshDialog();refreshDialog()');assert.equal(writes,0);
    if(expected==='summary')h.click('diagnosis-outcome-confirm');else if(expected==='searching')advance(h);
  }
  assert.equal(h.evaluate('current().programs.length'),0);advance(h);assert.equal(phase(h),'generating');
  assert.equal(composition.parent,h.node('#prescription'));assert.equal(composition.hidden,true);
  assert.equal(host.classList.contains('diagnosis-preparing'),false);advance(h);advance(h);advance(h);assert.equal(h.evaluate('skyState().totalPieces'),2);
});

test('cancelling either preparation step returns the original graphic and ignores stale timers',()=>{
  for(const expected of ['searching','ready']){
    const h=harness();h.click('replay-first');h.click('diagnosis-outcome-confirm');if(expected==='ready')advance(h);
    assert.equal(phase(h),expected);const stale=h.evaluate('diagnosisOutcomeTimer');h.click('preset',0);stale.fn();
    assert.equal(h.node('#composition').parent,h.node('#prescription'));assert.equal(h.node('#composition').hidden,true);
    assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.evaluate('skyState().totalPieces'),0);assert.equal(h.node('#learning').open,false);
    h.click('replay-first');h.click('diagnosis-outcome-confirm');assert.equal(phase(h),'searching');
    assert.equal(h.node('#composition').parent,h.node('#diagnosis-composition-slot'));
  }
});

test('collection uses the on-screen reward center and real shortcut, retargets after resize and stays mounted',()=>{
  const h=harness(undefined,{reducedMotion:false});
  h.node('.outcome-fragment').getBoundingClientRect=()=>({left:534,top:334,width:132,height:132,right:666,bottom:466});
  let button={left:1100,top:40,width:48,height:48,right:1148,bottom:88};h.node('.constellation-trigger').getBoundingClientRect=()=>button;
  finish(h,[1]);reachReward(h);advance(h);assert.equal(phase(h),'collecting');
  const host=h.node('#diagnosis-reward-flight'),timer=h.evaluate('diagnosisOutcomeTimer');
  assert.equal(host.style['--flight-from-x'],'600px');assert.equal(host.style['--flight-from-y'],'400px');
  assert.equal(host.style['--flight-dx'],'524px');assert.equal(host.style['--flight-dy'],'-336px');
  assert.equal(h.evaluate('diagnosisOutcomeTimer.ms'),1800);assert(h.node('.constellation-trigger').classList.contains('is-receiving-fragments'));
  assert.equal((h.node('#learning').innerHTML.match(/class="fragment-particle"/g)||[]).length,2);
  let writes=0,markup=h.node('#learning').innerHTML;Object.defineProperty(h.node('#learning'),'innerHTML',{get:()=>markup,set:value=>{markup=value;writes++;},configurable:true});
  button={left:760,top:30,width:48,height:48,right:808,bottom:78};h.emitWindow('resize');h.evaluate('render();refreshDialog()');
  assert.equal(host.style['--flight-dx'],'184px');assert.equal(host.style['--flight-dy'],'-346px');assert.equal(h.evaluate('diagnosisOutcomeTimer'),timer);assert.equal(writes,0);
  advance(h);assert.equal(h.evaluate('skyState().totalPieces'),2);assert(!h.node('.constellation-trigger').classList.contains('is-receiving-fragments'));
});

test('cancelling a collection removes its pulse, preserves already-earned pieces and blocks stale completion',()=>{
  const h=harness(undefined,{reducedMotion:false});finish(h,[1]);reachReward(h);advance(h);const stale=h.evaluate('diagnosisOutcomeTimer');
  h.click('preset',0);stale.fn();assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.evaluate('skyState().totalPieces'),2);
  assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.node('#learning-workspace').inert,false);
  assert(!h.node('.constellation-trigger').classList.contains('is-receiving-fragments'));assert.equal(h.node('.constellation-trigger').getAttribute('data-reward-paused'),null);
});

test('learner shortcut omits the numeric star badge',()=>{
  const fs=require('node:fs'),html=fs.readFileSync('dist/working/index.html','utf8');
  assert(!html.includes('id="star-balance"'));assert(html.includes('class="constellation-trigger compact-shortcut"'));
});
