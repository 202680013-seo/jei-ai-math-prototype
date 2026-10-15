const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/ui-harness.cjs');

function finish(h,passed){
  h.click('diagnosis');h.click('diagnosis-begin');
  for(let i=0;i<3;i++){
    const correct=h.evaluate(`DEMO[${i}].correct`);
    h.click('diagnosis-answer',passed?correct:(correct+1)%3);h.click('diagnosis-next');
  }
}

test('the preparation popup retains the final diagnosis underneath and preserves all stage durations and results',()=>{
  const h=harness(undefined,{reducedMotion:false}),host=h.node('#learning');let closes=0;
  const close=host.close.bind(host);host.close=()=>{closes++;close();};
  finish(h,false);
  assert.equal(closes,0);assert.equal(host.open,true);assert(host.classList.contains('diagnosis-post-flow'));
  assert.match(host.innerHTML,/class="diagnosis-post-background" inert aria-hidden="true"/);
  assert.match(host.innerHTML,/id="diagnosis-post-popup"/);
  const background=h.evaluate('diagnosisEndBackground.html'),result=h.data('current().diagnosticResult');
  assert.match(background,/문항 3 \/ 3/);assert.match(background,/answer-selected/);
  assert.equal(host.getAttribute('aria-labelledby'),'composition-title');
  assert.equal(h.node('#composition-title').textContent,'수고했어요!');
  h.click('diagnosis-tool');h.escape();assert.equal(closes,0);assert.equal(h.evaluate('editing.preparing'),true);
  for(const [ms,title] of [[2400,'맞춤 학습을 찾고 있어요'],[5200,'재능님을 위한 학습이 준비됐어요']]){
    h.evaluate(`composeTimers.find(t=>t.ms===${ms})`).fn();
    assert.equal(h.node('#composition-title').textContent,title);
    assert.equal(h.evaluate('diagnosisEndBackground.html'),background);assert.equal(closes,0);
    assert.equal(h.evaluate('mainGuidanceVisible()'),false);assert.equal(h.evaluate('current().programs.length'),0);
  }
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();
  assert.equal(closes,1);assert.equal(host.open,false);assert.equal(h.evaluate('current().programs.length'),8);
  assert.deepEqual(h.data('current().diagnosticResult'),result);
  h.click('program',0);assert.equal(host.classList.contains('diagnosis-post-flow'),false);
  assert.equal(host.getAttribute('aria-labelledby'),null);assert.equal(h.evaluate('editing.intro'),true);
});

test('a clean pass keeps celebration, next-step preparation and result details in the popup until an explicit next action',()=>{
  for(const reducedMotion of [false,true]){
    const h=harness(undefined,{reducedMotion}),host=h.node('#learning');finish(h,true);
    const topic=h.evaluate('state.grade+":"+state.index'),background=h.evaluate('diagnosisEndBackground.html'),result=h.data('current().diagnosticResult');
    assert(host.classList.contains('diagnosis-post-flow'));assert.match(host.innerHTML,/훌륭해요!/);
    assert.equal(host.getAttribute('aria-labelledby'),'pass-title');assert.equal(h.evaluate('mainGuidanceVisible()'),false);
    h.click('diagnosis-next');h.click('diagnosis-answer',2);assert.deepEqual(h.data('current().diagnosticResult'),result);
    h.click('pass-details');assert.match(host.innerHTML,/실력 확인 결과/);assert(host.classList.contains('diagnosis-post-flow'));
    h.click('pass-summary');h.click('pass-next');assert.match(host.innerHTML,/다음 학습 준비/);
    assert.equal(h.evaluate('state.grade+":"+state.index'),topic);assert.equal(h.evaluate('diagnosisEndBackground.html'),background);
    h.click('pass-begin');assert.notEqual(h.evaluate('state.grade+":"+state.index'),topic);
    assert.equal(host.open,true);assert.equal(host.classList.contains('diagnosis-post-flow'),false);
    assert.equal(h.evaluate('diagnosisEndBackground'),null);assert.equal(h.evaluate('current().diagnosis'),'active');
  }
});
