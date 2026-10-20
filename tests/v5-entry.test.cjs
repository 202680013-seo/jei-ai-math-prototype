const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

test('V5 starts at an actionable diagnosis welcome without starting a session or inventing progress',()=>{
  const h=harness();
  assert.equal(h.node('#diagnosis-welcome').hidden,false);
  assert.equal(h.node('#diagnostic').parent,h.node('#diagnosis-welcome-action'));
  assert.equal(h.node('#diagnostic').getAttribute('aria-label'),'실력알기 시작하기');
  assert.equal(h.node('#diagnosis-welcome-progress').hidden,true);
  assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.evaluate('current().diagnosticSession'),undefined);
  assert.equal(h.evaluate('daily().timerRunning'),false);
  h.click('diagnosis');
  assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('editing.intro'),true);
  assert.match(h.node('#learning').innerHTML,/diagnosis-begin/);
  assert.equal(h.evaluate('current().diagnosis'),'idle');
  h.click('close-learning');assert.equal(h.node('#learning').open,false);
  assert.equal(h.evaluate('current().diagnosis'),'idle');
});

test('V5 resumes real saved answers and the rail never changes the diagnosis welcome or its progress',()=>{
  const h=harness();h.click('diagnosis');h.click('diagnosis-begin');h.click('diagnosis-answer',1);h.click('diagnosis-next');
  h.click('close-learning');h.click('diagnosis-leave');
  const reloaded=harness(h.saved());
  assert.equal(reloaded.node('#diagnostic').getAttribute('aria-label'),'실력알기 이어하기');
  assert.equal(reloaded.node('#diagnosis-welcome-progress').hidden,false);
  assert.equal(reloaded.node('#diagnosis-welcome-progress').textContent,'1 / 3문항 풀었어요');
  const before=reloaded.data('current().diagnosticSession');reloaded.click('groups');
  assert.equal(reloaded.node('#diagnosis-welcome').hidden,false);assert.equal(reloaded.node('#overlay').hidden,true);
  reloaded.click('diagnosis');assert.equal(reloaded.evaluate('editing.intro'),false);
  assert.deepEqual(reloaded.data('current().diagnosticSession'),before);
  assert.match(reloaded.node('#learning').innerHTML,/문항 2 \/ 3/);
});

test('V5 removes the welcome after prescription and preserves the real result control and completed diagnosis states',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');
  assert.equal(h.node('#diagnosis-welcome').hidden,true);assert.equal(h.node('#diagnosis-section').hidden,true);
  assert.equal(h.node('#diagnostic').parent,h.node('#diagnostic-result-slot'));
  assert.match(h.node('#diagnostic').innerHTML,/실력알기 결과 확인/);
  h.click('diagnosis');assert.equal(h.evaluate('editing.kind'),'diagnosis-result');h.click('close-learning');
  h.evaluate('M.preset(state,2);render()');
  assert.equal(h.node('#diagnosis-welcome').hidden,true);assert.equal(h.node('#diagnosis-slot').hidden,false);
  assert.match(h.node('#diagnostic').innerHTML,/진단 통과/);
  h.click('test');h.click('preset',0);
  assert.equal(h.node('#diagnosis-welcome').hidden,false);assert.equal(h.node('#diagnostic').parent,h.node('#diagnosis-welcome-action'));
  assert.equal(h.node('#diagnostic').getAttribute('aria-label'),'실력알기 시작하기');
});

test('V5 has a direct responsive learner entry and leaves the V4 iPad entry on its own saved family',()=>{
  const registry=JSON.parse(fs.readFileSync('dist/versions.json','utf8'));
  const version=registry.versions.filter(v=>/^V5(?:\.|$)/.test(v.label)).at(-1);assert(version);
  const html=fs.readFileSync('dist/v5.html','utf8'),v4=fs.readFileSync('dist/v4.html','utf8');
  assert.match(html,new RegExp('data-version="'+version.id+'"'));
  assert.match(html,/data-v5-standalone="true"/);assert(!html.includes('data-v4-standalone'));
  assert.match(v4,/data-v4-standalone="true"/);assert(!v4.includes('v5.css'));
  assert.match(html,/width=device-width,initial-scale=1/);assert.match(html,/apple-mobile-web-app-capable/);
  assert.match(html,/NanumSquareRoundR\.woff2/);assert(!html.includes('<iframe'));assert(!html.includes('workspace.js'));
  const base=new URL(`/versions/${version.id}/`,'https://example.test');
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const u=new URL(m[1],base);if(u.origin!==base.origin)continue;
    assert(fs.existsSync('dist'+decodeURIComponent(u.pathname)),'missing V5 entry asset '+u.pathname);
  }
});
