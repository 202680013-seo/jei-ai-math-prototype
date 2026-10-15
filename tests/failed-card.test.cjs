const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

function geometry(svg){
  return [...svg.matchAll(/<(svg|rect|path|circle)\b([^>]*)>/g)].map(([,tag,attrs])=>[tag,Object.fromEntries([...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].filter(([,key])=>!['fill','stroke','aria-hidden','focusable'].includes(key)).map(([,key,value])=>[key,value]).sort(([a],[b])=>a.localeCompare(b)))]);
}

test('the supplied status SVGs retain every geometric and line-style attribute and use semantic theme paint',()=>{
  const h=harness();
  for(const kind of ['passed','failed','locked']){
    const original=fs.readFileSync('tests/fixtures/status-icons/'+kind+'.svg','utf8'),applied=h.evaluate(`statusSVG('${kind}')`);
    assert.deepEqual(geometry(applied),geometry(original));assert(applied.includes('var(--status-'));
  }
  h.evaluate('M.preset(state,6);render()');h.click('groups');
  assert(h.node('#group-panel').innerHTML.includes(h.evaluate("statusSVG('failed')")));
  assert(h.node('#programs').innerHTML.includes(h.evaluate("statusSVG('passed')")));
});

test('a failed card opens a choice dialog without changing canonical results or the next active program',()=>{
  const h=harness(undefined,{reducedMotion:false});h.seed('failed');const before=h.data('current().programs');let returned=0;
  h.node('[data-action="failed-card"][data-id="0"]').focus=()=>{returned++;};
  h.click('failed-card',0);assert.equal(h.node('#activity').open,true);assert.equal(h.node('#learning').open,false);
  assert.equal(h.evaluate('activityKind'),'completed-study');assert.equal(h.evaluate('mainGuidanceVisible()'),false);
  assert(h.node('#activity').innerHTML.includes('data-action="study-choice-review"'));assert(h.node('#activity').innerHTML.includes('data-action="study-choice-result"'));
  assert.equal(h.evaluate('daily().timerRunning'),false);assert.deepEqual(h.data('current().programs'),before);
  h.click('close-activity');assert.equal(h.node('#activity').open,false);assert.equal(returned,1);assert.deepEqual(h.data('current().programs'),before);
  h.click('failed-card',0);h.node('#activity').close();assert.equal(h.evaluate('completedCardSelection'),null);assert.equal(returned,2);
  h.click('goal');assert(!h.node('#activity').classList.contains('study-choice-dialog'));assert.equal(h.node('#activity').getAttribute('aria-labelledby'),null);
});

test('the dialog result action is read-only and the review action creates or resumes an independent session',()=>{
  const h=harness();h.seed('failed');const before=h.data('current().programs');
  h.click('failed-card',0);h.click('study-choice-result');assert.equal(h.node('#activity').open,false);assert.equal(h.node('#learning').open,true);
  assert.equal(h.evaluate('editing.showResult'),true);assert.equal(h.evaluate('editing.reviewing||false'),false);assert.deepEqual(h.data('current().programs'),before);
  h.click('close-learning');h.click('failed-card',0);h.click('study-choice-review');
  assert.equal(h.evaluate('editing.reviewing'),true);assert.equal(h.evaluate('editing.entryAction'),'failed-card');
  assert.equal(h.evaluate('daily().timerRunning'),true);assert.deepEqual(h.data('current().programs[1]'),before[1]);
  h.answer();const review=h.data('current().programs[0].reviewSession');h.click('close-learning');h.click('failed-card',0);
  assert(h.node('#activity').innerHTML.includes('복습 이어하기'));h.click('study-choice-review');
  assert.deepEqual(h.data('current().programs[0].reviewSession'),review);assert.deepEqual(h.data('current().programs[1]'),before[1]);
  assert.equal(h.evaluate('current().programs[0].status'),'failed');assert.equal(h.evaluate('current().programs[0].progress'),100);
});

test('failed-card choices cannot enter locked or unfinished work, or a different topic after a stale popup',()=>{
  const h=harness();h.seed('failed');h.click('failed-card',1);assert.equal(h.node('#activity').open,false);
  h.evaluate("current().programs[0].status='locked';render()");h.click('failed-card',0);assert.equal(h.node('#activity').open,false);
  h.seed('failed');h.click('failed-card',0);h.evaluate('select(3,1)');const next=h.data('current()');
  h.click('study-choice-review');assert.equal(h.node('#learning').open,false);assert.equal(h.node('#activity').open,false);assert.deepEqual(h.data('current()'),next);
});

test('only the first available failed card shows the introductory tooltip, and one card visit dismisses it persistently',()=>{
  const h=harness();h.seed('failed');
  h.evaluate("current().programs[1].status='failed';M.setProgress(current().programs[1],100);render()");
  const before=h.data('current().programs'),html=h.node('#programs').innerHTML;
  assert.equal((html.match(/role="tooltip"/g)||[]).length,1);
  const first=h.evaluate('programCard(current(),current().programs[0])'),second=h.evaluate('programCard(current(),current().programs[1])');
  assert(first.includes('aria-describedby="first-failed-card-hint"'));assert(first.includes('카드를 눌러 복습해보세요!'));
  assert(!second.includes('role="tooltip"'));assert(!html.includes('다시 살펴보기'));
  assert(first.indexOf('card-footer')<first.indexOf('card-state-icon'),'the cue is anchored to the lower-right status icon');
  h.click('failed-card',1);assert.equal(h.node('#activity').open,true);assert(!h.node('#programs').innerHTML.includes('role="tooltip"'));
  assert.deepEqual(h.data('current().programs'),before);h.click('close-activity');
  const restored=harness(h.saved());assert(!restored.node('#programs').innerHTML.includes('role="tooltip"'));
  restored.evaluate("M.preset(state,6);render()");assert(!restored.node('#programs').innerHTML.includes('id="first-failed-card-hint"'));
});

test('the first-failure hint never attaches to passed, locked, or unfinished cards',()=>{
  const h=harness();h.seed('passed');assert(!h.node('#programs').innerHTML.includes('id="first-failed-card-hint"'));
  h.evaluate("current().programs[2].status='failed';M.setProgress(current().programs[2],100);render()");
  assert.equal((h.node('#programs').innerHTML.match(/id="first-failed-card-hint"/g)||[]).length,1);
  assert.equal(h.evaluate('firstCompletedCardHint(current(),current().programs[2])'),true);
  h.evaluate("current().programs[2].status='locked';render()");assert(!h.node('#programs').innerHTML.includes('id="first-failed-card-hint"'));
  h.click('failed-card',2);assert.equal(h.evaluate('state.ui?.failedCardHintSeen||false'),false);
});
