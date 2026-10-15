const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/ui-harness.cjs');

function finishLesson(h,wrongFirst=false){
  h.click('program',0);h.click('program-begin');
  const limit=h.evaluate('current().programs[0].frames.length+1');
  for(let i=0;i<limit&&h.evaluate('current().programs[0].progress')<100;i++){
    const correct=h.evaluate('DEMO[(current().programs[0].completedFrames||0)%3].correct');
    h.click('learner-answer',wrongFirst&&i===0?(correct+1)%4:correct);h.click('learner-next');
  }
  assert.equal(h.evaluate('current().programs[0].progress'),100);
}

test('passed and failed onboarding cues are independent, each attached only to its first eligible card',()=>{
  const h=harness();h.seed('passed');h.evaluate("current().programs[1].status='passed';M.setProgress(current().programs[1],100);current().programs[2].status='failed';M.setProgress(current().programs[2],100);render()");
  const before=h.data('current().programs'),html=h.node('#programs').innerHTML;
  assert.equal((html.match(/id="first-passed-card-hint"/g)||[]).length,1);assert.equal((html.match(/id="first-failed-card-hint"/g)||[]).length,1);
  assert.equal(h.evaluate('firstCompletedCardHint(current(),current().programs[0])'),true);
  assert.equal(h.evaluate('firstCompletedCardHint(current(),current().programs[1])'),false);
  h.click('completed-card',1);assert.equal(h.node('#activity').open,true);
  assert(h.node('#activity').innerHTML.includes('완료한 학습을 한 번 더 연습해볼까요?'));
  assert(!h.node('#programs').innerHTML.includes('id="first-passed-card-hint"'));assert(h.node('#programs').innerHTML.includes('id="first-failed-card-hint"'));
  h.click('close-activity');const restored=harness(h.saved());assert(!restored.node('#programs').innerHTML.includes('id="first-passed-card-hint"'));
  restored.click('failed-card',2);assert(!restored.node('#programs').innerHTML.includes('role="tooltip"'));
  assert.deepEqual(restored.data('current().programs'),before);
});

test('fresh lesson completion mounts celebration once, keeps the next program intact, and saved result views do not replay it',()=>{
  const h=harness(undefined,{reducedMotion:false});h.evaluate('M.preset(state,4);render()');const next=h.data('current().programs[1]');
  finishLesson(h);assert.equal(h.evaluate('current().programs[0].status'),'passed');
  const result=h.node('#learning').innerHTML;
  assert(result.includes('has-completion'));assert(result.includes('completion-result'));assert(result.includes('학습을 마쳤어요!'));
  assert(result.includes('completion-confetti'));assert.equal((result.match(/class="confetti-color-/g)||[]).length,22);
  assert(result.includes('class="actions completion-actions"'));assert.deepEqual(h.data('current().programs[1]'),next);
  let writes=0,markup=result;Object.defineProperty(h.node('#learning'),'innerHTML',{get:()=>markup,set:value=>{markup=value;writes++;},configurable:true});
  h.evaluate('refreshDialog();render();refreshDialog()');assert.equal(writes,0,'unchanged result renders preserve the mounted celebration');
  h.click('close-learning');h.click('program',0);assert(!h.node('#learning').innerHTML.includes('completion-confetti'));
  assert.deepEqual(h.data('current().programs[1]'),next);
});

test('finishing with mistakes acknowledges completion without claiming a pass',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');finishLesson(h,true);
  const html=h.node('#learning').innerHTML;
  assert.equal(h.evaluate('current().programs[0].status'),'failed');assert(html.includes('class="badge failed">미통과'));
  assert(html.includes('학습을 마쳤어요!'));assert(html.includes('completion-confetti'));
  h.click('close-learning');h.click('failed-card',0);assert.equal(h.node('#activity').open,true);
});

test('a completed review celebrates its own completion and retains the original result and next active progress',()=>{
  const h=harness();h.seed('failed');const original=h.data('current().programs[0]'),next=h.data('current().programs[1]');
  h.click('failed-card',0);h.click('study-choice-review');h.finishReview();
  assert(h.node('#learning').innerHTML.includes('has-completion'));assert(h.node('#learning').innerHTML.includes('completion-confetti'));
  assert(h.node('#learning').innerHTML.includes('한 번 더 익혔어요!'));assert.equal(h.evaluate('current().programs[0].status'),'passed');
  assert.equal(h.evaluate('current().programs[0].initialResult.status'),original.status);assert.deepEqual(h.data('current().programs[1]'),next);
  h.click('close-learning');h.click('completed-card',0);h.click('study-choice-result');
  assert(h.node('#learning').innerHTML.includes('첫 학습 결과'));assert(!h.node('#learning').innerHTML.includes('completion-confetti'));
  assert.deepEqual(h.data('current().programs[1]'),next);
});
