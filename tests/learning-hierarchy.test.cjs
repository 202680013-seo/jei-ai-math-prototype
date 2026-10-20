const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

test('the compact result control appears only after a diagnosis produces learning cards',()=>{
  const h=harness();
  for(const preset of [0,1,2]){
    h.evaluate(`M.preset(state,${preset});render()`);
    assert.equal(h.node('#learning-context').hidden,true);
    assert.equal(h.node('#personalized-summary').textContent,'');
  }
  h.evaluate('M.preset(state,3);render()');
  assert.equal(h.node('#learning-context').hidden,false);
  assert(h.node('body').classList.contains('has-personalized-learning'));
  assert.equal(h.node('#personalized-summary').textContent,'');
  assert.equal(h.node('#diagnostic-result-slot').hidden,false);
  h.evaluate('select(3,1)');
  assert.equal(h.node('#learning-context').hidden,true);
  assert.equal(h.node('#diagnostic-result-slot').hidden,true);
  assert.equal(h.node('#diagnostic').parent,h.node('#diagnosis-welcome-action'));
  assert.equal(h.node('#diagnosis-welcome').hidden,false);
});

test('topic changes refresh the explanation count and result label without changing saved learning',()=>{
  const h=harness();h.seed('failed');
  const before=h.data('current().programs');
  assert(h.node('#diagnostic')['aria-label'].includes(h.evaluate('groupName(state.index)')));
  h.click('diagnosis');assert.equal(h.evaluate('editing.kind'),'diagnosis-result');
  assert.deepEqual(h.data('current().programs'),before);
  h.click('close-learning');
  h.evaluate("state.grades[3][1].diagnosis='done';state.grades[3][1].programs=M.programs(2,3,1);select(3,1)");
  assert.equal(h.node('#personalized-summary').textContent,'');assert.equal(h.evaluate('current().programs.length'),2);
  assert(h.node('#diagnostic')['aria-label'].includes('모으기와 가르기(10)'));
  h.evaluate('select(3,0)');assert.deepEqual(h.data('current().programs'),before);
  assert.equal(h.node('#personalized-summary').textContent,'');assert.equal(h.evaluate('current().programs.length'),3);
});

test('preparation retains its topic identity and connects the ready count to the overview cards',()=>{
  const h=harness(undefined,{reducedMotion:false});
  h.evaluate('beginComposition(2)');const topic=h.evaluate('composing.topicName');
  assert.equal(h.node('#learning-context').hidden,true);
  assert.equal(h.node('#composition-topic-context').textContent,topic+' · 실력 알기 완료');
  h.evaluate('composeTimers.find(t=>t.ms===2400)').fn();
  assert.equal(h.node('#composition-topic-context').textContent,topic+' · 실력알기 결과로 준비 중');
  h.evaluate('composeTimers.find(t=>t.ms===5200)').fn();
  assert.equal(h.node('#composition-topic-context').textContent,topic+' · 더 연습할 학습 2개');
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();
  assert.equal(h.evaluate('current().programs.length'),2);
  assert.equal(h.node('#learning-context').hidden,false);
  assert.equal(h.node('#personalized-summary').textContent,'');assert.equal(h.node('#diagnostic-result-slot').hidden,false);
});

test('the result control belongs to the topic heading and the rail consistently names learning topics',()=>{
  const html=fs.readFileSync('dist/working/index.html','utf8'),context=html.slice(html.indexOf('id="learning-context"'),html.indexOf('<section id="diagnosis-section"'));
  assert(!context.includes('나에게 필요한 맞춤 학습'));
  assert(context.includes('<h2 id="personalized-title" class="sr-only">맞춤 학습</h2>'));
  assert(!context.includes('id="personalized-summary"'));assert(context.includes('diagnostic-result-slot'));
  assert(html.indexOf('id="learning-context"')<html.indexOf('id="programs"'));
  assert(html.includes('aria-labelledby="group-title personalized-title"'));
  assert(html.includes('id="diagnosis-result-hint"'));
  assert(!html.includes('학습 목차'));
  for(const version of ['working','versions/v48','versions/v49']){
    const h=harness(undefined,{appSource:fs.readFileSync(`dist/${version}/app.js`,'utf8')});
    if(version!=='versions/v49')h.evaluate("state.grades[4][0].diagnosis='active'");
    h.click('groups');
    const markup=h.node('#group-panel').innerHTML;
    assert(markup.indexOf('<h2 id="nav-grade-title">')<markup.indexOf('<h3 id="nav-topic-heading">'));
    assert(markup.includes('<h3 id="nav-topic-heading">학습 주제 <span>'));
    assert(!markup.includes('<h2>학습 주제</h2>'));assert(!markup.includes('학습 목차'));
    assert(markup.includes('class="group-list" role="group" aria-labelledby="nav-topic-heading"'));
    assert.equal(h.node('.groups-trigger')['aria-label'],'학습 주제 닫기');
    h.click('next-grade');
    assert(h.node('#group-panel').innerHTML.includes('<h2 id="nav-grade-title"><span>E</span>등급</h2>'));
    assert.equal(h.evaluate('state.grade'),3);
  }
});

test('unchanged guidance renders retain mounted card hints while progress and dismissal still update',()=>{
  const h=harness(undefined,{reducedMotion:false});h.seed('passed');
  const cards=h.node('#programs');let html=cards.innerHTML,writes=0;
  Object.defineProperty(cards,'innerHTML',{configurable:true,get:()=>html,set:value=>{html=value;writes++;}});
  assert(html.includes('id="first-passed-card-hint"'));
  h.evaluate('render();daily().variant++;render();render()');
  assert.equal(writes,0,'unchanged cards must not restart their tooltip animation');
  const beforeProgress=h.evaluate('current().programs[1].progress');
  h.evaluate('M.setProgress(current().programs[1],60);render()');
  const progress=h.evaluate('current().programs[1].progress');
  assert.notEqual(progress,beforeProgress);
  assert.equal(writes,1);assert(html.includes(`value="${progress}"`));
  h.evaluate('render()');assert.equal(writes,1);
  h.click('completed-card',0);
  assert.equal(writes,2);assert(!html.includes('id="first-passed-card-hint"'));
  assert.equal(h.node('#activity').open,true);
});

test('the grade badge follows the selected topic ordinal independently of learning card progress',()=>{
  const h=harness();
  assert(h.node('#grade-badge').innerHTML.includes('<strong>D</strong>'));
  assert(h.node('#grade-badge').innerHTML.includes('class="grade-topic-number">01</span>'));
  h.evaluate('select(3,1)');
  assert(h.node('#grade-badge').innerHTML.includes('class="grade-topic-number">02</span>'));
  h.evaluate("current().diagnosis='done';current().programs=M.programs(8,3,1);M.setProgress(current().programs[0],100);render()");
  assert(h.node('#grade-badge').innerHTML.includes('class="grade-topic-number">02</span>'));
  h.evaluate('select(3,9)');
  assert(h.node('#grade-badge').innerHTML.includes('class="grade-topic-number">10</span>'));
  h.evaluate('select(0,0)');
  assert(h.node('#grade-badge').innerHTML.includes('<strong>A</strong>'));
  assert(h.node('#grade-badge').innerHTML.includes('class="grade-topic-number">01</span>'));
});
