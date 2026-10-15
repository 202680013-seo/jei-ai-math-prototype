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
  assert.equal(h.evaluate('activityKind'),'failed-study');assert.equal(h.evaluate('mainGuidanceVisible()'),false);
  assert(h.node('#activity').innerHTML.includes('data-action="failed-study-review"'));assert(h.node('#activity').innerHTML.includes('data-action="failed-study-result"'));
  assert.equal(h.evaluate('daily().timerRunning'),false);assert.deepEqual(h.data('current().programs'),before);
  h.click('close-activity');assert.equal(h.node('#activity').open,false);assert.equal(returned,1);assert.deepEqual(h.data('current().programs'),before);
  h.click('failed-card',0);h.node('#activity').close();assert.equal(h.evaluate('failedCardSelection'),null);assert.equal(returned,2);
  h.click('goal');assert(!h.node('#activity').classList.contains('failed-study-dialog'));assert.equal(h.node('#activity').getAttribute('aria-labelledby'),null);
});

test('the dialog result action is read-only and the review action creates or resumes an independent session',()=>{
  const h=harness();h.seed('failed');const before=h.data('current().programs');
  h.click('failed-card',0);h.click('failed-study-result');assert.equal(h.node('#activity').open,false);assert.equal(h.node('#learning').open,true);
  assert.equal(h.evaluate('editing.showResult'),true);assert.equal(h.evaluate('editing.reviewing||false'),false);assert.deepEqual(h.data('current().programs'),before);
  h.click('close-learning');h.click('failed-card',0);h.click('failed-study-review');
  assert.equal(h.evaluate('editing.reviewing'),true);assert.equal(h.evaluate('editing.entryAction'),'failed-card');
  assert.equal(h.evaluate('daily().timerRunning'),true);assert.deepEqual(h.data('current().programs[1]'),before[1]);
  h.answer();const review=h.data('current().programs[0].reviewSession');h.click('close-learning');h.click('failed-card',0);
  assert(h.node('#activity').innerHTML.includes('복습 이어하기'));h.click('failed-study-review');
  assert.deepEqual(h.data('current().programs[0].reviewSession'),review);assert.deepEqual(h.data('current().programs[1]'),before[1]);
  assert.equal(h.evaluate('current().programs[0].status'),'failed');assert.equal(h.evaluate('current().programs[0].progress'),100);
});

test('failed-card choices cannot enter locked or unfinished work, or a different topic after a stale popup',()=>{
  const h=harness();h.seed('failed');h.click('failed-card',1);assert.equal(h.node('#activity').open,false);
  h.evaluate("current().programs[0].status='locked';render()");h.click('failed-card',0);assert.equal(h.node('#activity').open,false);
  h.seed('failed');h.click('failed-card',0);h.evaluate('select(3,1)');const next=h.data('current()');
  h.click('failed-study-review');assert.equal(h.node('#learning').open,false);assert.equal(h.node('#activity').open,false);assert.deepEqual(h.data('current()'),next);
});
