const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/ui-harness.cjs');

test('opening and leaving a full-screen entry does not start learning, change progress or write a learning log',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');const before=h.data('current().programs[0]');
  h.click('program',0);
  assert(h.node('#learning').classList.contains('program-screen'));assert(h.node('#learning').classList.contains('diagnosis-screen'));
  assert(h.node('#learning').innerHTML.includes('data-action="program-begin"'));assert(!h.node('#learning').innerHTML.includes('data-action="learner-answer"'));
  assert.equal(h.evaluate('editing.intro'),true);assert.equal(h.evaluate('daily().timerRunning'),false);
  h.tick();assert.equal(h.evaluate('daily().minutes'),0);
  h.click('learner-answer',1);h.click('learner-next');assert.deepEqual(h.data('current().programs[0]'),before);
  h.click('close-learning');assert.equal(h.node('#learning').open,false);assert.deepEqual(h.data('current().programs[0]'),before);
  assert.equal(h.evaluate('Object.keys(daily().log||{}).length'),0);assert.equal(h.evaluate('current().attempts||0'),0);
});

test('the explicit entry action begins once, transitions to questions and preserves selected answers on resume',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');h.click('program',0);h.click('program-begin');
  assert.equal(h.evaluate('editing.intro'),false);assert.equal(h.evaluate('current().programs[0].status'),'active');
  assert.equal(h.evaluate('daily().timerRunning'),true);assert.equal(h.evaluate('current().attempts'),1);
  assert(h.node('#learning').innerHTML.includes('data-action="learner-answer"'));
  h.click('learner-answer',0);const selected=h.data('current().programs[0]');
  h.click('program-begin');assert.deepEqual(h.data('current().programs[0]'),selected);assert.equal(h.evaluate('current().attempts'),1);
  h.click('close-learning');assert.equal(h.evaluate('daily().timerRunning'),false);
  const reloaded=harness(h.saved());reloaded.click('program',0);assert.equal(reloaded.evaluate('editing.intro'),true);
  assert(reloaded.node('#learning').innerHTML.includes('이어서 학습하기'));assert.deepEqual(reloaded.data('current().programs[0]'),selected);
  reloaded.click('program-begin');assert.deepEqual(reloaded.data('current().programs[0]'),selected);
  assert(reloaded.node('#learning').innerHTML.includes('answer-correct'));assert.equal(reloaded.evaluate('daily().timerRunning'),true);
  reloaded.click('learner-next');assert.equal(reloaded.evaluate('current().programs[0].completedFrames'),1);
  reloaded.click('close-learning');reloaded.click('program',0);reloaded.click('program-begin');
  assert(reloaded.node('#learning').innerHTML.includes('문항 2 /'));assert.equal(reloaded.evaluate('current().attempts'),1);
});

test('completed results stay directly accessible in the full-screen lesson and entry cannot bypass locks',()=>{
  const h=harness();h.evaluate('M.preset(state,5);render()');h.click('program',0);
  assert(h.node('#learning').classList.contains('program-screen'));assert.equal(h.evaluate('editing.intro'),false);
  assert(!h.node('#learning').innerHTML.includes('data-action="program-begin"'));assert(h.node('#learning').innerHTML.includes('data-action="learner-review"'));
  const before=h.data('current().programs[0]');h.click('program-begin');assert.deepEqual(h.data('current().programs[0]'),before);
  h.click('close-learning');h.evaluate('M.preset(state,3);render()');h.click('program',1);assert.equal(h.node('#learning').open,false);
  h.click('program-begin');assert.equal(h.evaluate('current().programs[1].status'),'idle');
});
