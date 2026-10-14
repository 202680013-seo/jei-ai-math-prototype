// Review-state tests use a DOM substitute; they do not claim browser layout QA.
const test=require('node:test');
const assert=require('node:assert/strict');
const {MathModel:M}=require('../dist/working/model.js');
const {harness}=require('./helpers/ui-harness.cjs');

function canonical(h,id=0){return h.data(`(({status,progress,completedFrames,wrongFrames,demoChoice})=>({status,progress,completedFrames,wrongFrames,demoChoice}))(current().programs[${id}])`);}

test('completed-program review is independent of the next active program and keeps normal lock gates',()=>{
  const state=M.create(),s=state.grades[state.grade][state.index];s.diagnosis='done';s.programs=M.programs(3);
  const [finished,next,locked]=s.programs;
  finished.status='passed';M.setProgress(finished,100);next.status='active';M.setProgress(next,50);
  assert.equal(M.canStart(s,finished),false);
  assert.equal(M.canReview(s,finished),true);
  assert.equal(M.canReview(s,next),false);
  assert.equal(M.canReview(s,locked),false);
  assert.equal(M.canStudy(s,locked),false);
  assert.equal(M.learningRecommend(state).id,next.id);
  finished.status='locked';assert.equal(M.canReview(s,finished),false);
  assert.equal(M.canReview(s,null),false);
});

test('completed-card click shows the saved result and explicit review while preserving active-next progress',()=>{
  const h=harness();h.seed();const original=canonical(h),next=h.data('current().programs[1]');
  assert.match(h.node('#programs').innerHTML,/결과\s*·\s*복습/);
  h.click('program',0);
  assert.equal(h.node('#learning').open,true);
  assert.match(h.node('#learning').innerHTML,/data-action="learner-review"/);
  assert.equal(h.evaluate('current().programs[0].reviewSession===undefined'),true);
  assert.deepEqual(canonical(h),original);
  h.click('learner-review');
  assert.equal(h.evaluate('editing.reviewing'),true);
  assert.equal(h.evaluate('current().programs[0].reviewSession.index'),0);
  assert.deepEqual(canonical(h),original);
  assert.deepEqual(h.data('current().programs[1]'),next);
  assert.equal(h.evaluate('M.currentProgram(current()).id'),1);
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[1])'),true);
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[2])'),false);
});

test('an interrupted review persists answers and resumes without resetting a completed card',()=>{
  const h=harness();h.seed();const original=canonical(h);h.click('program',0);h.click('learner-review');h.answer();
  const session=h.data('current().programs[0].reviewSession');assert.equal(session.index,1);
  h.click('close-learning');assert.equal(h.node('#learning').open,false);
  assert.equal(h.evaluate('daily().timerRunning'),false);assert.deepEqual(canonical(h),original);
  const reloaded=harness(h.saved());reloaded.click('program',0);
  assert.match(reloaded.node('#learning').innerHTML,/복습 이어하기/);
  reloaded.click('learner-review');
  assert.equal(reloaded.evaluate('editing.reviewing'),true);
  assert.deepEqual(reloaded.data('current().programs[0].reviewSession'),session);
  assert.deepEqual(canonical(reloaded),original);
});

test('mistakes during voluntary review never downgrade an already passed program or relock later cards',()=>{
  const h=harness();h.seed();const original=canonical(h),next=h.data('current().programs[1]');
  h.click('program',0);h.click('learner-review');h.finishReview(true);
  assert.deepEqual(canonical(h),original);
  assert.equal(h.evaluate('current().programs[0].reviewSession.wrongFrames.length'),1);
  assert.equal(h.evaluate('daily().timerRunning'),false);
  assert.deepEqual(h.data('current().programs[1]'),next);
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[1])'),true);
  assert.equal(h.evaluate('M.learningRecommend(state).id'),1);
});

test('all-correct remediation upgrades a failed result while retaining the initial result and next work',()=>{
  const h=harness();h.seed('failed');const original=canonical(h),next=h.data('current().programs[1]');
  assert.equal(h.evaluate('M.wrongEntries(state).length'),1);
  h.click('program',0);h.click('learner-review');h.finishReview();
  assert.equal(h.evaluate('current().programs[0].status'),'passed');
  assert.equal(h.evaluate('current().programs[0].progress'),100);
  assert.equal(h.evaluate('current().programs[0].completedFrames'),original.completedFrames);
  assert.equal(h.evaluate('current().programs[0].reviewed'),true);
  assert.equal(h.evaluate('current().reviewHistory'),true);
  assert.equal(h.evaluate('M.wrongEntries(state).length'),0);
  const initial=h.data('current().programs[0].initialResult');
  assert.equal(initial.status,'failed');assert.deepEqual(initial.wrongFrames,original.wrongFrames);
  assert.deepEqual(h.data('current().programs[1]'),next);
  h.click('close-learning');h.click('program',0);
  const result=h.node('#learning').innerHTML;
  assert.match(result,/첫 학습 결과/);
  assert.match(result,/복습으로 통과했어요\./);
  assert.match(result,/오답 1개/);
});

test('an unsuccessful remediation preserves the failed result and its original diagnostic evidence',()=>{
  const h=harness();h.seed('failed');const original=canonical(h);
  h.click('program',0);h.click('learner-review');h.finishReview(true);
  assert.deepEqual(canonical(h),original);
  assert.equal(h.evaluate('M.wrongEntries(state).length'),1);
  assert.equal(h.evaluate('current().programs[0].reviewed'),false);
});

test('review learning time records only active visible review and native dismissal saves and stops it',()=>{
  const h=harness();h.seed('passed',false);
  h.click('program',0);h.tick();assert.equal(h.evaluate('daily().minutes'),0,'viewing a saved result is not learning');
  h.click('learner-review');h.tick();assert.equal(h.evaluate('daily().minutes'),1,'a review counts without any active canonical program');
  h.document.visibilityState='hidden';h.tick();assert.equal(h.evaluate('daily().minutes'),1);
  h.document.visibilityState='visible';h.answer();const session=h.data('current().programs[0].reviewSession');
  h.escape();assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('daily().timerRunning'),false);
  h.tick();assert.equal(h.evaluate('daily().minutes'),1);
  assert.deepEqual(h.saved().grades[3][0].programs[0].reviewSession,session);
});

test('review reporting keeps the original learning log and records a distinct review entry',()=>{
  const h=harness();h.seed();
  h.evaluate("daily().log={[current().groupId+':'+current().programs[0].programId]:{name:'Saved learning',progress:100,status:'passed',reviewed:false}};save()");
  const original=h.data("daily().log[current().groupId+':'+current().programs[0].programId]");
  h.click('program',0);h.click('learner-review');h.answer();
  assert.deepEqual(h.data("daily().log[current().groupId+':'+current().programs[0].programId]"),original);
  const review=h.data("daily().log[current().groupId+':'+current().programs[0].programId+':review']");
  assert.equal(review.reviewed,true);assert.ok(review.progress>0&&review.progress<100);
  h.click('review-original');h.click('close-learning');
  assert.deepEqual(h.data("daily().log[current().groupId+':'+current().programs[0].programId]"),original,'reading and closing the prior result does not overwrite the saved learning log');
});

test('a locked card cannot open learning or create a review session',()=>{
  const h=harness();h.evaluate("state=M.create();daily();current().diagnosis='done';current().programs=M.programs(3);render()");
  h.click('program',1);assert.equal(h.node('#learning').open,false);
  assert.equal(h.evaluate('current().programs[1].reviewSession===undefined'),true);
  h.evaluate("current().programs[0].status='locked';M.setProgress(current().programs[0],100);render()");
  h.click('program',0);assert.equal(h.node('#learning').open,false);
  assert.equal(h.evaluate('current().programs[0].reviewSession===undefined'),true);
});
