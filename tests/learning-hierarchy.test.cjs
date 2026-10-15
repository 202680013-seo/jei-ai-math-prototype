const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

test('the personalized-learning explanation appears only after a diagnosis produces learning cards',()=>{
  const h=harness();
  for(const preset of [0,1,2]){
    h.evaluate(`M.preset(state,${preset});render()`);
    assert.equal(h.node('#learning-context').hidden,true);
    assert.equal(h.node('#personalized-summary').textContent,'');
  }
  h.evaluate('M.preset(state,3);render()');
  assert.equal(h.node('#learning-context').hidden,false);
  assert(h.node('body').classList.contains('has-personalized-learning'));
  assert.equal(h.node('#personalized-summary').textContent,`실력 알기 결과에 맞춰 ${h.evaluate('current().programs.length')}개의 학습을 준비했어요.`);
  h.evaluate('select(3,1)');
  assert.equal(h.node('#learning-context').hidden,true);
  assert.equal(h.node('#diagnostic-result-slot').hidden,true);
  assert.equal(h.node('#diagnostic').parent,h.node('#diagnosis-slot'));
});

test('topic changes refresh the explanation count and result label without changing saved learning',()=>{
  const h=harness();h.seed('failed');
  const before=h.data('current().programs');
  assert(h.node('#diagnostic')['aria-label'].includes(h.evaluate('groupName(state.index)')));
  h.click('diagnosis');assert.equal(h.evaluate('editing.kind'),'diagnosis-result');
  assert.deepEqual(h.data('current().programs'),before);
  h.click('close-learning');
  h.evaluate("state.grades[3][1].diagnosis='done';state.grades[3][1].programs=M.programs(2,3,1);select(3,1)");
  assert.equal(h.node('#personalized-summary').textContent,'실력 알기 결과에 맞춰 2개의 학습을 준비했어요.');
  assert(h.node('#diagnostic')['aria-label'].includes('모으기와 가르기(10)'));
  h.evaluate('select(3,0)');assert.deepEqual(h.data('current().programs'),before);
  assert.equal(h.node('#personalized-summary').textContent,'실력 알기 결과에 맞춰 3개의 학습을 준비했어요.');
});

test('preparation retains its topic identity and connects the ready count to the overview cards',()=>{
  const h=harness(undefined,{reducedMotion:false});
  h.evaluate('beginComposition(2)');const topic=h.evaluate('composing.topicName');
  assert.equal(h.node('#learning-context').hidden,true);
  assert.equal(h.node('#composition-topic-context').textContent,topic+' · 실력 알기 완료');
  h.evaluate('composeTimers.find(t=>t.ms===2400)').fn();
  assert.equal(h.node('#composition-topic-context').textContent,topic+' · 실력 알기 결과로 준비 중');
  h.evaluate('composeTimers.find(t=>t.ms===5200)').fn();
  assert.equal(h.node('#composition-topic-context').textContent,topic+' · 더 연습할 학습 2개');
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();
  assert.equal(h.evaluate('current().programs.length'),2);
  assert.equal(h.node('#learning-context').hidden,false);
  assert.equal(h.node('#personalized-summary').textContent,'실력 알기 결과에 맞춰 2개의 학습을 준비했어요.');
});

test('the result control belongs to the card explanation and the rail consistently names learning topics',()=>{
  const html=fs.readFileSync('dist/working/index.html','utf8'),context=html.match(/<section id="learning-context"[^>]*>(.*?)<\/section>/)[1];
  assert(context.includes('나에게 필요한 맞춤 학습'));
  assert(context.indexOf('personalized-summary')<context.indexOf('diagnostic-result-slot'));
  assert(html.indexOf('id="learning-context"')<html.indexOf('id="programs"'));
  assert(html.includes('aria-labelledby="group-title personalized-title"'));
  assert(html.includes('aria-describedby="personalized-summary"'));
  assert(!html.includes('학습 목차'));
  const h=harness();h.click('groups');
  assert(h.node('#group-panel').innerHTML.includes('<h2>학습 주제</h2>'));
  assert(!h.node('#group-panel').innerHTML.includes('학습 목차'));
  assert.equal(h.node('.groups-trigger')['aria-label'],'학습 주제 닫기');
});
