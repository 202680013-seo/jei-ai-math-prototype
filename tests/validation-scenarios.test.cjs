const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

for(const version of ['working','versions/v48','versions/v49']){
  const appSource=fs.readFileSync(`dist/${version}/app.js`,'utf8'),popup=version==='versions/v49';
  const setup=()=>harness(undefined,{reducedMotion:false,appSource});

  test(version+' first-entry fixture replays the intro after prior visits without erasing another topic, and genuine resume keeps answers',()=>{
    const h=setup();h.evaluate(`
      state.ui={testControls:true,diagnosisIntroSeen:true,passedCardHintSeen:true,failedCardHintSeen:true,prescriptionSeen:true};
      Object.assign(daily(),{target:1,minutes:99,started:true,unreadAnswers:4});state.sky.newPieces=true;
      state.grades[3][1].diagnosis='done';state.grades[3][1].programs=M.programs(1,3,1);render();
    `);
    const other=h.data('state.grades[3][1]');h.click('test');h.click('preset',0);
    assert.equal(h.evaluate('panel'),null);assert.equal(h.node('#test-panel').hidden,true);
    assert.equal(h.evaluate('state.ui.testControls'),true);assert.equal(h.evaluate('state.ui.diagnosisIntroSeen'),false);
    assert.equal(h.evaluate('state.ui.prescriptionSeen'),false);assert.equal(h.evaluate('daily().started'),false);
    assert.equal(h.evaluate('daily().target'),null);assert.equal(h.evaluate('daily().minutes'),0);
    assert.equal(h.evaluate('daily().unreadAnswers'),0);assert.equal(h.evaluate('state.sky.newPieces'),false);
    assert.deepEqual(h.data('state.grades[3][1]'),other);
    h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),true);
    assert.match(h.node('#learning').innerHTML,/어디를 더 공부하면 좋을지 알아볼까요/);
    assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.evaluate('daily().timerRunning'),false);
    h.click('diagnosis-begin');h.click('diagnosis-answer',0);h.click('diagnosis-next');
    h.click('close-learning');h.click('diagnosis-leave');
    const saved=h.saved(),restored=harness(saved,{appSource});restored.click('diagnosis');
    assert.equal(restored.evaluate('editing.intro'),false);assert.equal(restored.evaluate('current().diagnosticSession.index'),1);
    assert.deepEqual(restored.data('current().diagnosticSession.answers'),[0]);
    assert.match(restored.node('#learning').innerHTML,/문항 2 \/ 3/);
  });

  test(version+' completed-card fixtures re-arm only their first eligible hints when explicitly selected again',()=>{
    const h=setup();h.click('preset',5);
    assert.equal((h.node('#programs').innerHTML.match(/id="first-passed-card-hint"/g)||[]).length,1);
    h.click('completed-card',0);h.click('close-activity');
    assert.equal(h.evaluate('state.ui.passedCardHintSeen'),true);assert(!h.node('#programs').innerHTML.includes('first-passed-card-hint'));
    h.evaluate('render();render()');assert(!h.node('#programs').innerHTML.includes('first-passed-card-hint'));
    const restored=harness(h.saved(),{appSource});assert(!restored.node('#programs').innerHTML.includes('first-passed-card-hint'));
    restored.click('test');restored.click('preset',5);
    assert.equal((restored.node('#programs').innerHTML.match(/id="first-passed-card-hint"/g)||[]).length,1);
    restored.click('preset',6);
    assert.equal((restored.node('#programs').innerHTML.match(/id="first-failed-card-hint"/g)||[]).length,1);
    const id=restored.evaluate('current().programs.find(p=>p.status==="failed").id');
    restored.click('failed-card',id);restored.click('close-activity');assert(!restored.node('#programs').innerHTML.includes('first-failed-card-hint'));
    restored.click('preset',6);assert.equal((restored.node('#programs').innerHTML.match(/id="first-failed-card-hint"/g)||[]).length,1);
    assert(restored.node('#programs').innerHTML.includes('is-locked')===false);
  });

  test(version+' all mandatory fixtures give their advertised states and the in-progress diagnosis really resumes',()=>{
    const expected=['idle','active','clean','active','active','passed','failed','passed','active','active','idle'];
    const h=setup();
    expected.forEach((status,id)=>{h.click('test');h.click('preset',id);assert.equal(h.evaluate('M.status(current(),state.policy)'),status,`scenario ${id}`);assert.equal(h.evaluate('editing'),null);assert.equal(h.evaluate('panel'),null);assert.equal(h.evaluate('daily().timerRunning'),false);});
    h.click('preset',1);const answers=h.data('current().diagnosticSession.answers');
    h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),false);assert.match(h.node('#learning').innerHTML,/문항 2 \/ 3/);
    assert.deepEqual(h.data('current().diagnosticSession.answers'),answers);
    h.click('diagnosis-answer',1);h.click('diagnosis-next');assert.equal(h.evaluate('current().diagnosticSession.index'),2);
  });

  test(version+' first and repeat prescription replays use the version-specific diagnosis host through every stage',()=>{
    const h=setup();
    for(const [action,search,ready,total] of [['replay-first',2400,5200,8000],['replay-repeat',2000,4400,7000]]){
      h.click('test');h.click(action);
      assert.equal(h.evaluate('panel'),null);assert.equal(h.node('#learning').open,true);assert.equal(h.node('#prescription').open,false);
      assert.equal(h.evaluate('composing.surface'),'learning');assert.equal(h.evaluate('composing.total'),total);
      assert.equal(h.node('#learning').classList.contains('diagnosis-post-flow'),popup);
      assert.equal(h.node('#learning').innerHTML.includes('id="diagnosis-post-popup"'),popup);
      if(popup)assert.match(h.evaluate('diagnosisEndBackground.html'),/문항 3 \/ 3/);
      assert.equal(h.node('#composition-title').textContent,'수고했어요!');
      assert.equal(h.node('#composition').parent,h.node('#diagnosis-composition-slot'));
      h.evaluate(`composeTimers.find(t=>t.ms===${search})`).fn();assert.equal(h.node('#composition-title').textContent,'맞춤 학습을 찾고 있어요');
      h.evaluate(`composeTimers.find(t=>t.ms===${ready})`).fn();assert.match(h.node('#composition-title').textContent,/학습이 준비됐어요/);
      assert.equal(h.node('#learning').open,true);assert.equal(h.node('#prescription').open,false);
      h.evaluate(`composeTimers.find(t=>t.ms===${total})`).fn();
      assert.equal(h.node('#learning').open,false);assert.equal(h.node('#prescription').open,false);
      assert.equal(h.evaluate('current().programs.length'),8);assert.equal(h.evaluate('current().programs[0].status'),'idle');
    }
    h.click('replay-first');const stale=h.evaluate('composeTimers.slice()');h.click('preset',0);
    for(const timer of stale)timer.fn();
    assert.equal(h.evaluate('composing'),null);assert.equal(h.evaluate('current().diagnosis'),'idle');
    assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.node('#learning').open,false);
  });

  test(version+' no-prescription replay uses the same completion flow and a fresh fixture cannot retain its result popup',()=>{
    const h=setup();h.click('test');h.click('replay-clean-pass');
    assert.equal(h.evaluate('panel'),null);assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('editing.complete'),true);
    assert.equal(h.node('#learning').classList.contains('diagnosis-post-flow'),popup);assert.match(h.node('#learning').innerHTML,/훌륭해요!/);
    assert.equal(h.evaluate('current().programs.length'),0);h.click('pass-next');assert.match(h.node('#learning').innerHTML,/다음 학습 준비/);
    h.click('preset',0);assert.equal(h.node('#learning').open,false);h.click('diagnosis');
    assert.equal(h.evaluate('editing.intro'),true);assert.equal(h.node('#learning').classList.contains('diagnosis-post-flow'),false);
    assert(!h.node('#learning').innerHTML.includes('훌륭해요!'));
    h.click('draft-preset',0);assert.equal(h.node('#learning').open,false);h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),true);
  });
}
