const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/ui-harness.cjs');

test('ready cards use one accessible card button with a text-only start action and no ordinal',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');
  const html=h.evaluate('programCard(current(),current().programs[0])');
  assert(!html.includes('card-number'));
  assert(html.includes('<span class="card-start-box" aria-hidden="true">시작하기</span>'));
  assert.equal((html.match(/<button\b/g)||[]).length,1);
  assert(!html.includes(' disabled'));assert(!html.includes('<progress'));
  assert(!html.includes('card-top'));assert(!html.includes('여기부터 시작해요'));
  const visible=html.replace(/<[^>]*>/g,'');assert(!visible.includes('시작 전'));
  h.evaluate('current().presentationPending=true');assert(!h.evaluate('programCard(current(),current().programs[0])').includes('여기부터 시작해요'));
  h.click('program',0);assert.equal(h.node('#learning').open,true);
});

test('the active card shows only a bar and percentage, retains accessible counts, and resumes the current frame after its entry screen',()=>{
  const h=harness();h.evaluate('M.preset(state,4);render()');
  const p=h.data('current().programs[0]'),html=h.evaluate('programCard(current(),current().programs[0])');
  assert(html.includes(`class="card-percent" aria-hidden="true">${p.progress}%</span>`));
  assert(html.includes(`value="${p.progress}"`));
  assert(html.includes(`${p.completedFrames} / ${p.frames.length}문항`));
  const visible=html.replace(/<[^>]*>/g,'');
  assert(!visible.includes('문항'));assert(!visible.includes('진행률'));assert(!visible.includes('진행중'));
  assert(!html.includes('card-number'));assert(!html.includes('card-top'));
  assert(html.includes('<span class="card-start-box" aria-hidden="true">이어서 하기</span>'));
  assert(html.includes('이어서 하기'));assert(html.includes('aria-current="step"'));
  h.click('program',0);assert.equal(h.data('current().programs[0].progress'),p.progress);
  assert.equal(h.evaluate('editing.intro'),true);h.click('program-begin');
  assert(h.node('#learning').innerHTML.includes(`문항 ${p.completedFrames+1} /`));
});

test('complete and failed cards share a native choice trigger with their status icon in the footer',()=>{
  const h=harness();h.evaluate('M.preset(state,5);render()');
  for(const [status,action,icon] of [['passed','completed-card','is-passed'],['failed','failed-card','needs-review']]){
    h.evaluate(`current().programs[0].status='${status}';render()`);
    const html=h.evaluate('programCard(current(),current().programs[0])');
    assert(html.startsWith('<button '));assert.equal((html.match(/<button\b/g)||[]).length,1);
    assert(html.includes(`data-action="${action}"`));assert(html.includes(`card-state-icon ${icon}`));
    assert(html.indexOf('card-footer')<html.indexOf('card-state-icon'));
    assert(!html.includes('card-actions-trigger'));assert(!html.includes('card-options-icon'));assert(!html.includes('card-result-action'));
    assert(!html.includes('card-number'));assert(!html.includes('<progress'));assert(!html.includes('card-start-box'));
  }
});

test('locked cards show a footer lock without an ordinal, and never expose a start or result action',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');
  let html=h.evaluate('programCard(current(),current().programs[1])');
  assert(!html.includes('card-number'));
  assert(html.includes('is-locked'));assert(html.includes(' disabled'));
  assert(html.includes('class="card-lock"'));assert(html.indexOf('card-lock')>html.indexOf('card-footer'));
  assert(!html.includes('card-start-box'));assert(!html.includes('card-state-icon'));
  h.evaluate("current().programs[1].progress=100;current().programs[1].status='locked'");
  html=h.evaluate('programCard(current(),current().programs[1])');
  assert(html.includes('is-locked'));assert(!html.includes('is-complete'));
  h.click('program',1);assert.equal(h.node('#learning').open,false);
});

test('a passed card opens result and review choices without starting or resetting learning',()=>{
  const h=harness();h.seed();const before=h.data('current().programs');
  h.click('completed-card',0);assert.equal(h.node('#activity').open,true);assert.equal(h.node('#learning').open,false);
  assert(h.node('#activity').innerHTML.includes('data-action="study-choice-review"'));assert(h.node('#activity').innerHTML.includes('data-action="study-choice-result"'));
  assert.deepEqual(h.data('current().programs'),before);
  h.click('study-choice-result');assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('editing.showResult'),true);assert.deepEqual(h.data('current().programs'),before);
  h.click('close-learning');h.click('completed-card',1);assert.equal(h.node('#activity').open,false);assert.deepEqual(h.data('current().programs'),before);
});
