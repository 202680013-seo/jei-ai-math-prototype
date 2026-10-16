const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');
const appSource=fs.readFileSync('dist/versions/v48/app.js','utf8');
const setup=(reducedMotion=false)=>harness(undefined,{reducedMotion,appSource});
function finish(h,pass=false){
  h.click('diagnosis');h.click('diagnosis-begin');
  for(let i=0;i<3;i++){const correct=h.evaluate(`DEMO[${i}].correct`);h.click('diagnosis-answer',pass?correct:(correct+1)%3);h.click('diagnosis-next');}
}
function finishCourse(h){
  finish(h);const total=h.evaluate('composing.total');h.evaluate(`composeTimers.find(t=>t.ms===${total})`).fn();
  h.evaluate('guidanceClosingTimer')?.fn();h.evaluate('cardRevealTimer')?.fn();
}

test('V3.8.2 shows arrows only between earned grades, keeps the selected study unchanged, and cannot browse unavailable grades',()=>{
  const h=setup();h.click('groups');
  assert.deepEqual(h.data('availableRailGrades()'),[3]);assert(!h.node('#group-panel').innerHTML.includes('class="nav-grade-arrow"'));
  h.click('next-grade');assert.equal(h.evaluate('browseGrade'),3);
  h.evaluate("state.grades[1][0].diagnosis='done';state.grades[4][0].diagnosis='active';renderPanel()");
  assert.deepEqual(h.data('availableRailGrades()'),[1,3,4]);
  h.click('prev-grade');assert.equal(h.evaluate('browseGrade'),1);assert.equal(h.evaluate('state.grade'),3);
  h.click('prev-grade');assert.equal(h.evaluate('browseGrade'),1);
  h.click('next-grade');assert.equal(h.evaluate('browseGrade'),3);
  h.click('next-grade');assert.equal(h.evaluate('browseGrade'),4);h.click('next-grade');assert.equal(h.evaluate('browseGrade'),4);
  assert.equal(h.evaluate('state.index'),0);assert.equal(h.node('#learning').open,false);
});

test('the pinned grade progress counts completed diagnoses, including prescriptions still being studied, rather than finished cards',()=>{
  const h=setup();h.evaluate(`
    const topics=state.grades[3];topics[0].diagnosis='done';topics[0].programs=M.programs(8);topics[1].diagnosis='done';
    topics[2].diagnosis='active';topics[2].diagnosticSession={index:1,answers:[0]};render();
  `);h.click('groups');
  assert.deepEqual(h.data('railGradeProgress()'),{total:19,completed:2,percent:11});
  const html=h.node('#group-panel').innerHTML;
  assert.match(html,/<\/div><\/div><footer class="nav-grade-progress/);
  assert.match(html,/<progress max="19" value="2" aria-label="D등급 실력 알기 진행률"/);
  assert.match(html,/전체 19개 중 2개 완료, 11%/);
  h.evaluate("state.grades[3][2].diagnosis='done';renderPanel()");assert.equal(h.evaluate('railGradeProgress().completed'),3);
  h.evaluate("state.grades[4][0].diagnosis='active';renderPanel()");h.click('next-grade');
  assert.deepEqual(h.data('railGradeProgress()'),{total:27,completed:0,percent:0});
  assert.match(h.node('#group-panel').innerHTML,/E등급 진행률/);assert.equal(h.evaluate('state.grade'),3);
  assert.deepEqual(h.data('railGradeProgress(99)'),{total:0,completed:0,percent:0});
});

test('the rail help explains status icons; blank study space closes the rail while interactive study controls keep working',()=>{
  const h=setup(true);h.click('groups');h.click('help');assert.equal(h.node('#help').open,true);
  assert.match(h.node('#help').innerHTML,/실력 알기 또는 맞춤 학습/);assert.match(h.node('#help').innerHTML,/아직 실력 알기를 시작하지/);
  h.emitDocument('click',{target:{closest(){return null;}}});assert.equal(h.evaluate('panel'),'groups');
  h.click('close-help');h.click('mentor-repeat');assert.equal(h.evaluate('panel'),'groups');
  const blank={closest(selector){return selector==='#learning-workspace'?h.node('#learning-workspace'):null;}};
  h.emitDocument('click',{target:blank});assert.equal(h.evaluate('panel'),null);assert.equal(h.node('#group-panel').hidden,true);
  h.click('groups');h.click('select-group',1);assert.equal(h.evaluate('state.index'),0,'unstarted topics remain disabled');
});

test('the result cue waits for both the dim exit and the actual card reveal, appears once, and does not restart on stable renders or reload',()=>{
  const h=setup();finish(h);
  assert.equal(h.node('#diagnosis-result-hint').hidden,true);
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();assert.equal(h.evaluate('state.ui.diagnosisResultHintSeen'),undefined);
  assert.equal(h.node('#diagnosis-result-hint').hidden,true);h.evaluate('guidanceClosingTimer').fn();
  assert.equal(h.node('#diagnosis-result-hint').hidden,true,'cards are still arriving');
  h.evaluate('cardRevealTimer').fn();assert.equal(h.node('#diagnosis-result-hint').hidden,false);
  assert.equal(h.node('#diagnosis-result-hint').textContent,'실력 알기 결과를 확인해보세요!');
  assert.equal(h.node('#diagnostic').getAttribute('aria-describedby'),'diagnosis-result-hint');
  assert.equal(h.evaluate('state.ui.diagnosisResultHintSeen'),true);
  const timer=h.evaluate('diagnosisResultHintTimer');h.evaluate('render();render()');assert.equal(h.evaluate('diagnosisResultHintTimer'),timer);
  timer.fn();assert.equal(h.node('#diagnosis-result-hint').hidden,true);h.evaluate('render()');assert.equal(h.node('#diagnosis-result-hint').hidden,true);
  const restored=harness(h.saved(),{appSource});assert.equal(restored.node('#diagnosis-result-hint').hidden,true);
  h.evaluate('select(3,1)');finishCourse(h);assert.equal(h.node('#diagnosis-result-hint').hidden,true);
});

test('opening the result before the cue counts as discovery; modal or hidden states never keep the cue over another screen',()=>{
  const h=setup();finish(h);h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();
  h.click('diagnosis');assert.equal(h.evaluate('editing.kind'),'diagnosis-result');assert.equal(h.evaluate('state.ui.diagnosisResultHintSeen'),true);
  assert.equal(h.node('#diagnosis-result-hint').hidden,true);h.click('close-learning');h.evaluate('guidanceClosingTimer').fn();
  assert.equal(h.node('#diagnosis-result-hint').hidden,true);
  const next=setup();finishCourse(next);assert.equal(next.node('#diagnosis-result-hint').hidden,false);
  next.click('test');assert.equal(next.node('#diagnosis-result-hint').hidden,true);next.click('close-panel');assert.equal(next.node('#diagnosis-result-hint').hidden,true);
});

test('validation cases deliberately re-arm the result cue, stale cue timers cannot hide the new cue, and clean passes have no cue',()=>{
  const h=setup(true);h.click('preset',3);assert.equal(h.node('#diagnosis-result-hint').hidden,false);
  const old=h.evaluate('diagnosisResultHintTimer');h.click('preset',3);const current=h.evaluate('diagnosisResultHintRun');
  old.fn();assert.equal(h.evaluate('diagnosisResultHintRun'),current);assert.equal(h.node('#diagnosis-result-hint').hidden,false);
  h.click('preset',0);assert.equal(h.node('#diagnosis-result-hint').hidden,true);finish(h,true);
  assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.node('#diagnosis-result-hint').hidden,true);
  assert.equal(h.node('#learning').classList.contains('diagnosis-post-flow'),false);
});
